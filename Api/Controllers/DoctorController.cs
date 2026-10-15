using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Department;
using Medical.Api.Modules.Specialty;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DoctorController : ControllerBase
    {
        private readonly IDoctorRepository     _repository;
        private readonly IDepartmentRepository _departmentRepository;
        private readonly ISpecialtyRepository  _specialtyRepository;

        public DoctorController(
            IDoctorRepository repository,
            IDepartmentRepository departmentRepository,
            ISpecialtyRepository specialtyRepository)
        {
            _repository           = repository;
            _departmentRepository = departmentRepository;
            _specialtyRepository  = specialtyRepository;
        }

        // ── Claim helpers ────────────────────────────────────────────────────────

        private bool TryGetCallerUserId(out long userId)
        {
            var claim = User.FindFirst("user_id")?.Value
                     ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out userId);
        }

        private bool TryGetRoleIdClaim(out int roleId)
        {
            var claim = User.FindFirst("user_role_id")?.Value;
            return int.TryParse(claim, out roleId);
        }

        // ── GET api/doctor ───────────────────────────────────────────────────────

        [HttpGet]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<Doctor>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<Doctor>> GetById(long id)
        {
            var doctor = await _repository.GetByIdAsync(id);
            if (doctor is null)
                return NotFound();

            return Ok(doctor);
        }

        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ── GET api/doctor/my-profile ────────────────────────────────────────────
        // Returns the doctor profile of the currently authenticated Staff user.
        // Returns 404 if the Staff user has no doctor profile (i.e. they are a Receptionist).

        [HttpGet("my-profile")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetMyProfile()
        {
            if (!TryGetCallerUserId(out long userId))
                return Unauthorized("Could not resolve user identity from token.");

            var doctor = await _repository.GetByUserIdAsync(userId);
            if (doctor is null)
                return NotFound("No doctor profile found for the current user.");

            return Ok(doctor);
        }

        [HttpPost]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<Doctor>> Create(Doctor doctor)
        {
            if (doctor.DepartmentId <= 0)
                return BadRequest("department_id is required and must be greater than 0.");

            var department = await _departmentRepository.GetByIdAsync(doctor.DepartmentId);
            if (department is null)
                return BadRequest($"Department with ID {doctor.DepartmentId} does not exist.");

            if (doctor.SpecialtyId <= 0)
                return BadRequest("specialty_id is required and must be greater than 0.");

            var specialty = await _specialtyRepository.GetByIdAsync(doctor.SpecialtyId);
            if (specialty is null)
                return BadRequest($"Specialty with ID {doctor.SpecialtyId} does not exist.");

            await _repository.AddAsync(doctor);

            return CreatedAtAction(nameof(GetById), new { id = doctor.DoctorId }, doctor);
        }

        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, Doctor doctor)
        {
            if (doctor.DoctorId == 0)
                doctor.DoctorId = id;

            if (id != doctor.DoctorId)
                return BadRequest("Route id does not match doctor_id in request body.");

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            if (doctor.DepartmentId <= 0)
                return BadRequest("department_id is required and must be greater than 0.");

            var department = await _departmentRepository.GetByIdAsync(doctor.DepartmentId);
            if (department is null)
                return BadRequest($"Department with ID {doctor.DepartmentId} does not exist.");

            if (doctor.SpecialtyId <= 0)
                return BadRequest("specialty_id is required and must be greater than 0.");

            var specialty = await _specialtyRepository.GetByIdAsync(doctor.SpecialtyId);
            if (specialty is null)
                return BadRequest($"Specialty with ID {doctor.SpecialtyId} does not exist.");

            await _repository.UpdateAsync(doctor);

            return NoContent();
        }

        [HttpDelete("{id:long}")]
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
