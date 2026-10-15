using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    /// <summary>
    /// Patient profile management.
    /// - Admin: full access (list, view, create, update, delete all).
    /// - Staff/Doctor: can list and view patient profiles (StaffAndAbove).
    /// - Patient (User role): can view and update ONLY their own profile. Cannot delete.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // All endpoints require at minimum an authenticated token
    public class PatientController : ControllerBase
    {
        private readonly IPatientsRepository _repository;

        public PatientController(IPatientsRepository repository)
        {
            _repository = repository;
        }

        // ── Helpers ────────────────────────────────────────────────────────────

        private bool TryGetUserIdClaim(out long userId)
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

        // ── GET all (Admin + Staff) ────────────────────────────────────────────

        /// <summary>Get all patients. Admin and Staff/Doctors can access.</summary>
        [HttpGet]
        [Authorize(Policy = AppPolicies.StaffAndAbove)]
        public async Task<ActionResult<IEnumerable<Patients>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // ── GET by ID ─────────────────────────────────────────────────────────

        /// <summary>
        /// Get a patient by ID.
        /// Admin and Staff can access any patient.
        /// A patient (User role) can only access their own record.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<Patients>> GetById(long id)
        {
            if (!TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            var patient = await _repository.GetByIdAsync(id);
            if (patient is null)
                return NotFound();

            // Admin and Staff can view any patient
            if (roleId == AppRoles.Admin || roleId == AppRoles.Staff)
                return Ok(patient);

            // Patient — must be their own record
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            if (patient.UserId != userId)
                return Forbid();

            return Ok(patient);
        }

        // ── GET my profile (Patient convenience endpoint) ──────────────────────

        /// <summary>Get the patient profile belonging to the currently authenticated user.</summary>
        [HttpGet("my")]
        [Authorize(Policy = AppPolicies.UserOnly)]
        public async Task<ActionResult<Patients>> GetMyProfile()
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var patient = await _repository.GetByUserIdAsync(userId);
            if (patient is null)
                return NotFound(new { message = "No patient profile found for current user." });

            return Ok(patient);
        }

        // ── GET paginated (Admin + Staff) ──────────────────────────────────────

        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.StaffAndAbove)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ── POST (Admin + Staff) ───────────────────────────────────────────────

        [HttpPost]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<Patients>> Create([FromBody] Patients patient)
        {
            if (TryGetUserIdClaim(out long callerUserId) && TryGetRoleIdClaim(out int roleId))
            {
                if (roleId == AppRoles.User)
                {
                    patient.UserId = callerUserId;
                }
            }

            if (patient.UserId <= 0)
                return BadRequest(new { message = "user_id is required and must be greater than 0." });

            if (string.IsNullOrWhiteSpace(patient.FirstName))
                return BadRequest(new { message = "first_name is required." });

            if (string.IsNullOrWhiteSpace(patient.LastName))
                return BadRequest(new { message = "last_name is required." });

            await _repository.AddAsync(patient);
            return CreatedAtAction(nameof(GetById), new { id = patient.PatientId }, patient);
        }

        // ── PUT (own account OR Admin) ─────────────────────────────────────────

        /// <summary>
        /// Update a patient record.
        /// Admin can update any patient.
        /// A patient (User role) can only update their own profile.
        /// Staff/Doctors cannot update patient profiles.
        /// </summary>
        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, [FromBody] Patients patient)
        {
            if (!TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            // Staff cannot modify patient profiles
            if (roleId == AppRoles.Staff)
                return Forbid();

            if (patient.PatientId == 0) patient.PatientId = id;
            if (id != patient.PatientId)
                return BadRequest(new { message = "Route id does not match patient_id in body." });

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            // Patient (role 3) — verify they own this record
            if (roleId == AppRoles.User)
            {
                if (!TryGetUserIdClaim(out long userId))
                    return Unauthorized();

                if (existing.UserId != userId)
                    return Forbid();

                // Patients cannot change their linked user_id
                patient.UserId = existing.UserId;
            }

            if (string.IsNullOrWhiteSpace(patient.FirstName))
                return BadRequest(new { message = "first_name is required." });

            if (string.IsNullOrWhiteSpace(patient.LastName))
                return BadRequest(new { message = "last_name is required." });

            await _repository.UpdateAsync(patient);
            return NoContent();
        }

        // ── DELETE (Admin only) ────────────────────────────────────────────────

        /// <summary>Delete a patient record. Admin only.</summary>
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
