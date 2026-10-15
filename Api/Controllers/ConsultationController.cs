using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Medical.Api.Modules.Consultation;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Authorizations;
using Medical.Api.Modules.Appointments;
using Medical.Api.Modules.Patients;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
    public class ConsultationController : ControllerBase
    {
        private readonly IConsultationRepository _repository;
        private readonly IDoctorRepository        _doctorRepository;
        private readonly IPatientsRepository       _patientRepository;
        private readonly IAppointmentRepository    _appointmentRepository;

        public ConsultationController(
            IConsultationRepository repository,
            IDoctorRepository doctorRepository,
            IPatientsRepository patientRepository,
            IAppointmentRepository appointmentRepository)
        {
            _repository            = repository;
            _doctorRepository      = doctorRepository;
            _patientRepository     = patientRepository;
            _appointmentRepository = appointmentRepository;
        }

        // ── Identity helpers ──────────────────────────────────────────────────

        private string? GetCurrentUserGuid() =>
            User.FindFirst("user_guid")?.Value;

        private long? GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out long id) ? id : null;
        }

        private bool IsAdmin()   => User.HasClaim("user_role_id", AppRoles.Admin.ToString());
        private bool IsStaff()   => User.HasClaim("user_role_id", AppRoles.Staff.ToString());
        private bool IsPatient() => User.HasClaim("user_role_id", AppRoles.User.ToString());

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

        /// <summary>
        /// Resolves the doctor record for the currently logged-in staff user.
        /// Returns null if the staff user is NOT a registered doctor
        /// (i.e. is a Receptionist, Lab technician, Radiology staff, etc.).
        /// </summary>
        private async Task<Doctor?> GetCurrentDoctorAsync()
        {
            var userId = GetCurrentUserId();
            if (userId is null) return null;
            return await _doctorRepository.GetByUserIdAsync(userId.Value);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // ADMIN-ONLY — Full list / paginated
        // ═══════════════════════════════════════════════════════════════════════

        // GET api/consultation
        [HttpGet]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<Consultation>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // GET api/consultation/paginated?pageNumber=1&pageSize=10
        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ═══════════════════════════════════════════════════════════════════════
        // GET /my — Each role sees their own slice
        //   Admin       → all consultations
        //   Doctor      → consultations where they are the attending doctor
        //   Patient     → their own consultations (patient_id match)
        //   Receptionist / Lab / Radiology → 403 Forbidden
        // ═══════════════════════════════════════════════════════════════════════

        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<Consultation>>> GetMine()
        {
            if (IsAdmin())
                return Ok(await _repository.GetAllAsync());

            if (!TryGetCallerIdentity(out long userId, out _))
                return Unauthorized("Could not resolve user identity from token.");

            if (IsStaff())
            {
                // Only staff with a doctor profile may access consultations.
                // Receptionist, Lab, Radiology, etc. have no doctor profile → 403.
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid();

                return Ok(await _repository.GetByDoctorIdAsync(doctor.DoctorId));
            }

            // Patient — return their own consultations only (resolve patient_id from user_id)
            var patient = await _patientRepository.GetByUserIdAsync(userId);
            long patientId = patient?.PatientId ?? userId;
            var list = (await _repository.GetByPatientIdAsync(patientId)).ToList();
            if (!list.Any() && patientId != userId)
            {
                list.AddRange(await _repository.GetByPatientIdAsync(userId));
            }
            return Ok(list);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // GET /{id}
        //   Admin       → any
        //   Doctor      → any (full clinical visibility)
        //   Patient     → own only (patient_id must match)
        //   Receptionist / Lab / Radiology → 403 Forbidden
        // ═══════════════════════════════════════════════════════════════════════

        [HttpGet("{id:long}")]
        public async Task<ActionResult<Consultation>> GetById(long id)
        {
            if (IsAdmin())
            {
                var c = await _repository.GetByIdAsync(id);
                return c is null ? NotFound() : Ok(c);
            }

            if (!TryGetCallerIdentity(out long userId, out _))
                return Unauthorized("Could not resolve user identity from token.");

            if (IsStaff())
            {
                // Non-doctor staff (Receptionist, Lab, etc.) are forbidden.
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid();

                // Doctors have full read visibility across all consultations.
                var c = await _repository.GetByIdAsync(id);
                return c is null ? NotFound() : Ok(c);
            }

            // Patient — ownership check
            {
                var c = await _repository.GetByIdAsync(id);
                if (c is null) return NotFound();
                var patient = await _patientRepository.GetByUserIdAsync(userId);
                bool isOwner = (patient != null && c.PatientId == patient.PatientId) || c.PatientId == userId;
                if (!isOwner) return Forbid();
                return Ok(c);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // GET /by-appointment/{appointmentId}
        //   Admin / Doctor → all consultations for that appointment
        //   Patient        → filtered to own (patient_id match)
        //   Receptionist / Lab / Radiology → 403 Forbidden
        // ═══════════════════════════════════════════════════════════════════════

        [HttpGet("by-appointment/{appointmentId:long}")]
        public async Task<ActionResult<IEnumerable<Consultation>>> GetByAppointment(long appointmentId)
        {
            if (IsAdmin())
                return Ok(await _repository.GetByAppointmentIdAsync(appointmentId));

            if (!TryGetCallerIdentity(out long userId, out _))
                return Unauthorized("Could not resolve user identity from token.");

            if (IsStaff())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid();

                return Ok(await _repository.GetByAppointmentIdAsync(appointmentId));
            }

            // Patient — return only consultations belonging to them
            var patientRec = await _patientRepository.GetByUserIdAsync(userId);
            long pid = patientRec?.PatientId ?? userId;
            var all = await _repository.GetByAppointmentIdAsync(appointmentId);
            return Ok(all.Where(c => c.PatientId == pid || c.PatientId == userId));
        }

        // ═══════════════════════════════════════════════════════════════════════
        // POST — Create a consultation
        //   Admin       → can create for any doctor / patient
        //   Doctor      → can create; doctor_id is auto-set to their own profile
        //   Receptionist / Lab / Radiology → 403 Forbidden
        //   Patient     → 403 Forbidden (blocked by StaffAndAbove policy)
        // ═══════════════════════════════════════════════════════════════════════

        [HttpPost]
        [Authorize(Policy = AppPolicies.StaffAndAbove)]
        public async Task<IActionResult> Create(Consultation consultation)
        {
            if (!IsAdmin())
            {
                // Staff user — must have a doctor profile to create consultations.
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid(); // Receptionist / Lab / Radiology

                // Force doctor_id to the authenticated doctor's own profile.
                consultation.DoctorId = doctor.DoctorId;
            }

            if (consultation.AppointmentId <= 0)
                return BadRequest("appointment_id is required and must be greater than 0.");

            if (consultation.PatientId <= 0)
                return BadRequest("patient_id is required and must be greater than 0.");

            if (consultation.DoctorId <= 0)
                return BadRequest("doctor_id is required and must be greater than 0.");

            consultation.CreatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            consultation.UpdatedAt = string.Empty;
            consultation.IsDeleted = false;
            consultation.DeletedAt = string.Empty;

            await _repository.AddAsync(consultation);

            return CreatedAtAction(nameof(GetById), new { id = consultation.ConsultationId }, consultation);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // PUT /{id} — Update a consultation
        //   Admin       → any consultation
        //   Doctor      → own consultations only (doctor_id must match their profile)
        //   Receptionist / Lab / Radiology → 403 Forbidden
        //   Patient     → 403 Forbidden (blocked by StaffAndAbove policy)
        // ═══════════════════════════════════════════════════════════════════════

        [HttpPut("{id:long}")]
        [Authorize(Policy = AppPolicies.StaffAndAbove)]
        public async Task<IActionResult> Update(long id, Consultation consultation)
        {
            if (consultation.ConsultationId == 0)
                consultation.ConsultationId = id;

            if (id != consultation.ConsultationId)
                return BadRequest("Route id does not match consultation_id in request body.");

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            if (!IsAdmin())
            {
                // Staff user — must have a doctor profile to edit consultations.
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid(); // Receptionist / Lab / Radiology

                // Doctors may only edit their own consultations.
                if (existing.DoctorId != doctor.DoctorId)
                    return Forbid();

                // Lock immutable fields — doctors cannot reassign appointment, patient, or doctor.
                consultation.DoctorId      = existing.DoctorId;
                consultation.PatientId     = existing.PatientId;
                consultation.AppointmentId = existing.AppointmentId;
            }

            // Preserve original created_at; stamp updated_at.
            consultation.CreatedAt = existing.CreatedAt;
            consultation.UpdatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            await _repository.UpdateAsync(consultation);
            return NoContent();
        }

        // ═══════════════════════════════════════════════════════════════════════
        // DELETE /{id} — Soft-delete (Admin only)
        //   Only administrators may delete consultations (soft-delete).
        //   Doctors, Patients, and all other staff are forbidden.
        // ═══════════════════════════════════════════════════════════════════════

        [HttpDelete("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Delete(long id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            await _repository.SoftDeleteAsync(id);
            return NoContent();
        }

        // ═══════════════════════════════════════════════════════════════════════
        // PATCH /{id}/complete — Mark a consultation as completed
        //   Admin       → any consultation
        //   Doctor      → own consultations only
        //   All others  → 403 Forbidden
        // ═══════════════════════════════════════════════════════════════════════

        [HttpPatch("{id:long}/complete")]
        [Authorize(Policy = AppPolicies.StaffAndAbove)]
        public async Task<IActionResult> Complete(long id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            if (!IsAdmin())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid();

                if (existing.DoctorId != doctor.DoctorId)
                    return Forbid();
            }

            // Stamp completed_at (idempotent — re-completing is a no-op on the timestamp if already set)
            existing.CompletedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            existing.UpdatedAt   = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            await _repository.UpdateAsync(existing);

            // Also mark the linked appointment as Completed (status_id = 3) so the
            // appointment list always reflects the real state of the visit.
            if (existing.AppointmentId > 0)
            {
                var appt = await _appointmentRepository.GetByIdAsync(existing.AppointmentId);
                if (appt is not null && appt.StatusId != 3)
                {
                    appt.StatusId  = 3; // Completed
                    appt.UpdatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                    await _appointmentRepository.UpdateAsync(appt);
                }
            }

            return Ok(existing);
        }
    }
}
