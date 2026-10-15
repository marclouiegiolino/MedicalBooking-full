using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Medical.Api.Modules.Appointments;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
    public class AppointmentController : ControllerBase
    {
        private readonly IAppointmentRepository _repository;
        private readonly IAppointmentService    _appointmentService;
        private readonly IDoctorRepository      _doctorRepository;
        private readonly IPatientsRepository    _patientsRepository;

        public AppointmentController(
            IAppointmentRepository repository,
            IAppointmentService appointmentService,
            IDoctorRepository doctorRepository,
            IPatientsRepository patientsRepository)
        {
            _repository         = repository;
            _appointmentService = appointmentService;
            _doctorRepository   = doctorRepository;
            _patientsRepository = patientsRepository;
        }

        // ── Identity helpers ──────────────────────────────────────────────────

        private string? GetCurrentUserGuid() =>
            User.FindFirst("user_guid")?.Value;

        private long? GetCurrentUserId()
        {
            var claim = User.FindFirst("user_id")?.Value
                     ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out long id) ? id : null;
        }

        private bool IsAdmin()  => User.HasClaim("user_role_id", AppRoles.Admin.ToString());
        private bool IsDoctor() => User.HasClaim("user_role_id", AppRoles.Staff.ToString());
        private bool IsUser()   => User.HasClaim("user_role_id", AppRoles.User.ToString());

        private bool TryGetCallerIdentity(out long userId, out string userGuid)
        {
            userId   = 0;
            userGuid = string.Empty;

            var guid = GetCurrentUserGuid();
            var id   = GetCurrentUserId();

            if (string.IsNullOrWhiteSpace(guid) || id is null)
                return false;

            userId   = id.Value;
            userGuid = guid;
            return true;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // ADMIN-ONLY — Full list / paginated
        // ═══════════════════════════════════════════════════════════════════════

        // GET api/appointment
        [HttpGet]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<Appointment>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // ═══════════════════════════════════════════════════════════════════════
        // GET /booked-slots?doctorId={id}&date={yyyy-MM-dd}
        // ═══════════════════════════════════════════════════════════════════════

        [HttpGet("booked-slots")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<string>>> GetBookedSlots(
            [FromQuery] long doctorId,
            [FromQuery] string date)
        {
            if (doctorId <= 0)
                return BadRequest("doctorId is required.");

            if (string.IsNullOrWhiteSpace(date))
                return BadRequest("date is required (yyyy-MM-dd).");

            var slots = await _repository.GetBookedSlotsAsync(doctorId, date);
            return Ok(slots);
        }

        // GET /api/appointment/daily-count?doctorId={id}&date={yyyy-MM-dd}
        [HttpGet("daily-count")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<int>> GetDailyCount(
            [FromQuery] long doctorId,
            [FromQuery] string date)
        {
            if (doctorId <= 0)
                return BadRequest("doctorId is required.");

            if (string.IsNullOrWhiteSpace(date))
                return BadRequest("date is required (yyyy-MM-dd).");

            var count = await _repository.GetDailyAppointmentCountAsync(doctorId, date);
            return Ok(new { count, limit = 10, isFull = count >= 10 });
        }

        // ═══════════════════════════════════════════════════════════════════════
        // GET /api/appointment/live-today
        // ═══════════════════════════════════════════════════════════════════════

        [HttpGet("live-today")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetLiveToday([FromQuery] string? date = null)
        {
            long? userId = GetCurrentUserId();
            var result = await _appointmentService.GetLiveTodayAsync(date, userId, IsAdmin(), IsDoctor());
            return Ok(result);
        }

        // GET api/appointment/paginated?pageNumber=1&pageSize=10
        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ═══════════════════════════════════════════════════════════════════════
        // GET /my  — Each role sees their own slice
        //   Admin       → all appointments
        //   Staff+Doctor→ appointments assigned to them (doctor_id match)
        //   Staff+No Doc→ all appointments (Receptionist)
        //   User        → appointments they booked (patient_id match)
        // ═══════════════════════════════════════════════════════════════════════

        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<Appointment>>> GetMine()
        {
            if (IsAdmin())
                return Ok(await _repository.GetAllAsync());

            if (!TryGetCallerIdentity(out long userId, out _))
                return Unauthorized("Could not resolve user identity from token.");

            if (IsDoctor()) // IsDoctor() == IsStaff() — covers all staff roles
            {
                var doctor = await _doctorRepository.GetByUserIdAsync(userId);

                if (doctor is not null)
                {
                    // Confirmed doctor → return only their own assigned appointments
                    return Ok(await _repository.GetByDoctorIdAsync(doctor.DoctorId));
                }

                // Staff with no doctor profile = Receptionist → sees all appointments
                // (Receptionists need visibility across all doctors to manage scheduling)
                return Ok(await _repository.GetAllAsync());
            }

            // Regular patient — return their own booked appointments
            var patient = await _patientsRepository.GetByUserIdAsync(userId);
            if (patient is null)
                return Ok(Array.Empty<Appointment>());

            return Ok(await _repository.GetByPatientIdAsync(patient.PatientId));
        }


        // ═══════════════════════════════════════════════════════════════════════
        // GET /{id}
        //   Admin  → any
        //   Doctor → any (they need full visibility to manage)
        //   User   → own only (patient_id must match)
        // ═══════════════════════════════════════════════════════════════════════

        [HttpGet("{id:long}")]
        public async Task<ActionResult<Appointment>> GetById(long id)
        {
            var appointment = await _repository.GetByIdAsync(id);
            if (appointment is null)
                return NotFound();

            if (IsAdmin())
                return Ok(appointment);

            if (!TryGetCallerIdentity(out long userId, out _))
                return Unauthorized("Could not resolve user identity from token.");

            if (IsDoctor()) // Covers all staff (doctors + receptionists)
            {
                var doctor = await _doctorRepository.GetByUserIdAsync(userId);

                if (doctor is not null)
                {
                    // Confirmed doctor: can only view their own assigned appointments
                    if (doctor.DoctorId != appointment.DoctorId)
                        return StatusCode(403, "You can only view appointments assigned to you.");
                    return Ok(appointment);
                }

                // Receptionist (staff without doctor profile): can view any appointment
                return Ok(appointment);
            }

            // Patient: must match patient_id
            var pat = await _patientsRepository.GetByUserIdAsync(userId);
            if (pat is null || pat.PatientId != appointment.PatientId)
                return StatusCode(403, "You can only view your own appointments.");

            return Ok(appointment);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // POST — Book an appointment
        //   Admin  → can book for any patient
        //   Doctor → FORBIDDEN
        //   User   → books for themselves only (patient_id auto-set)
        // ═══════════════════════════════════════════════════════════════════════

        [HttpPost]
        public async Task<IActionResult> Create(Appointment appointment)
        {
            if (IsDoctor())
                return StatusCode(403, "Doctors cannot book appointments. Only patients or admins may book.");

            if (!TryGetCallerIdentity(out long userId, out _))
                return Unauthorized("Could not resolve user identity from token.");

            var error = await _appointmentService.CreateAsync(appointment, userId, IsAdmin());

            if (error is not null)
            {
                // Detect daily-limit conflict (prefixed with "CONFLICT:")
                if (error.StartsWith("CONFLICT:"))
                {
                    var parts   = error.Substring("CONFLICT:".Length).Split('|');
                    var message = parts[0];
                    int count   = int.TryParse(parts.ElementAtOrDefault(1)?.Split('=').LastOrDefault(), out int c) ? c : 0;
                    int limit   = int.TryParse(parts.ElementAtOrDefault(2)?.Split('=').LastOrDefault(), out int l) ? l : 10;
                    return Conflict(new { message, count, limit });
                }

                return BadRequest(new { message = error });
            }

            return CreatedAtAction(nameof(GetById), new { id = appointment.AppointmentId }, appointment);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // PUT /{id} — Update an appointment
        //   Admin  → any
        //   Doctor → any (e.g. change status, add remarks)
        //   User   → own only (patient_id must match), cannot re-assign patient
        // ═══════════════════════════════════════════════════════════════════════

        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, Appointment appointment)
        {
            if (appointment.AppointmentId == 0)
                appointment.AppointmentId = id;

            if (id != appointment.AppointmentId)
                return BadRequest("Route id does not match appointment_id in request body.");

            if (!TryGetCallerIdentity(out long userId, out _))
                return Unauthorized("Could not resolve user identity from token.");

            var error = await _appointmentService.UpdateAsync(appointment, userId, IsAdmin(), IsDoctor());

            return error switch
            {
                null            => NoContent(),
                "NOT_FOUND"     => NotFound(),
                "FORBID"        => Forbid(),
                _               => BadRequest(new { message = error })
            };
        }

        // ═══════════════════════════════════════════════════════════════════════
        // DELETE /{id}
        //   Admin  → any
        //   Doctor → FORBIDDEN
        //   User   → own only (patient_id must match)
        // ═══════════════════════════════════════════════════════════════════════

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            if (!TryGetCallerIdentity(out long userId, out _))
                return Unauthorized("Could not resolve user identity from token.");

            var error = await _appointmentService.DeleteAsync(id, userId, IsAdmin(), IsDoctor());

            return error switch
            {
                null               => NoContent(),
                "NOT_FOUND"        => NotFound(),
                "FORBID"           => Forbid(),
                "DOCTOR_FORBIDDEN" => StatusCode(403, "Doctors are not permitted to delete appointments."),
                _                  => BadRequest(new { message = error })
            };
        }
    }
}
