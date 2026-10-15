using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.DoctorSchedule;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DoctorScheduleController : ControllerBase
    {
        private readonly IDoctorScheduleRepository _repository;
        private readonly IDoctorRepository         _doctorRepository;

        public DoctorScheduleController(
            IDoctorScheduleRepository repository,
            IDoctorRepository         doctorRepository)
        {
            _repository        = repository;
            _doctorRepository = doctorRepository;
        }

        // ── Identity helpers ───────────────────────────────────────────────────
        private long? GetCurrentUserId()
        {
            var claim = User.FindFirst("user_id")?.Value
                     ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out long id) ? id : null;
        }

        private bool IsAdmin() => User.HasClaim("user_role_id", AppRoles.Admin.ToString());
        private bool IsStaff() => User.HasClaim("user_role_id", AppRoles.Staff.ToString());

        // ── GET all schedules ──────────────────────────────────────────────────
        [HttpGet]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<DoctorSchedule>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // ── GET /my — Role-scoped (Doctor sees own, Patient/Admin sees all) ──────
        [HttpGet("my")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<DoctorSchedule>>> GetMine()
        {
            if (IsAdmin())
                return Ok(await _repository.GetAllAsync());

            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            if (IsStaff())
            {
                var doctor = await _doctorRepository.GetByUserIdAsync(userId.Value);
                if (doctor is not null)
                    return Ok(await _repository.GetByDoctorIdAsync(doctor.DoctorId));

                return Ok(await _repository.GetAllAsync());
            }

            // Patients/Users see all schedules
            return Ok(await _repository.GetAllAsync());
        }

        // ── GET by schedule ID ─────────────────────────────────────────────────
        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<DoctorSchedule>> GetById(long id)
        {
            var schedule = await _repository.GetByIdAsync(id);
            if (schedule is null)
                return NotFound();

            return Ok(schedule);
        }

        // ── GET schedules by Doctor ID ─────────────────────────────────────────
        [HttpGet("doctor/{doctorId:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<DoctorSchedule>>> GetByDoctorId(long doctorId)
        {
            var doctorExists = await _doctorRepository.ExistsAsync(doctorId);
            if (!doctorExists)
                return NotFound(new { message = $"Doctor with ID {doctorId} does not exist." });

            var schedules = await _repository.GetByDoctorIdAsync(doctorId);
            return Ok(schedules);
        }

        // ── GET paginated ──────────────────────────────────────────────────────
        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ── POST (Admin only) ──────────────────────────────────────────────────
        [HttpPost]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<DoctorSchedule>> Create([FromBody] DoctorSchedule schedule)
        {
            if (schedule.DoctorId <= 0)
                return BadRequest(new { message = "doctor_id is required and must be greater than 0." });

            var doctorExists = await _doctorRepository.ExistsAsync(schedule.DoctorId);
            if (!doctorExists)
                return BadRequest(new { message = $"Doctor with ID {schedule.DoctorId} does not exist." });

            if (string.IsNullOrWhiteSpace(schedule.DayOfWeek))
                return BadRequest(new { message = "day_of_week is required." });

            if (string.IsNullOrWhiteSpace(schedule.StartTime) || string.IsNullOrWhiteSpace(schedule.EndTime))
                return BadRequest(new { message = "start_time and end_time are required." });

            if (schedule.SlotDuration <= 0)
                return BadRequest(new { message = "slot_duration must be greater than 0 minutes." });

            await _repository.AddAsync(schedule);
            return CreatedAtAction(nameof(GetById), new { id = schedule.ScheduleId }, schedule);
        }

        // ── PUT (Admin only) ───────────────────────────────────────────────────
        [HttpPut("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Update(long id, [FromBody] DoctorSchedule schedule)
        {
            if (schedule.ScheduleId == 0)
                schedule.ScheduleId = id;

            if (id != schedule.ScheduleId)
                return BadRequest(new { message = "Route id does not match schedule_id in body." });

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            if (schedule.DoctorId <= 0)
                return BadRequest(new { message = "doctor_id is required." });

            var doctorExists = await _doctorRepository.ExistsAsync(schedule.DoctorId);
            if (!doctorExists)
                return BadRequest(new { message = $"Doctor with ID {schedule.DoctorId} does not exist." });

            if (string.IsNullOrWhiteSpace(schedule.DayOfWeek))
                return BadRequest(new { message = "day_of_week is required." });

            if (string.IsNullOrWhiteSpace(schedule.StartTime) || string.IsNullOrWhiteSpace(schedule.EndTime))
                return BadRequest(new { message = "start_time and end_time are required." });

            if (schedule.SlotDuration <= 0)
                return BadRequest(new { message = "slot_duration must be greater than 0 minutes." });

            await _repository.UpdateAsync(schedule);
            return NoContent();
        }

        // ── DELETE (Admin only) ────────────────────────────────────────────────
        [HttpDelete("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Delete(long id)
        {
            var exists = await _repository.ExistsAsync(id);
            if (!exists)
                return NotFound();

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}
