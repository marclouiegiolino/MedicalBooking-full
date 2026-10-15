using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.MedicalInformation;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    /// <summary>
    /// Medical Information management.
    /// - Admin: full access.
    /// - Staff/Doctor (role 2): can READ (they need clinical info for care), but cannot create/update/delete.
    /// - Patient (role 3): can only read and update THEIR OWN medical info.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // All endpoints require authentication
    public class MedicalInformationController : ControllerBase
    {
        private readonly IMedicalInfoRepository _repository;
        private readonly IPatientsRepository    _patientRepository;

        public MedicalInformationController(
            IMedicalInfoRepository repository,
            IPatientsRepository    patientRepository)
        {
            _repository        = repository;
            _patientRepository = patientRepository;
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

        // ── GET all (Admin and Staff/Doctor) ──────────────────────────────────

        /// <summary>Get all medical info records. Admin and Staff can view all.</summary>
        [HttpGet]
        [Authorize(Policy = AppPolicies.StaffAndAbove)]
        public async Task<ActionResult<IEnumerable<MedicalInfo>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // ── GET by ID ─────────────────────────────────────────────────────────

        /// <summary>
        /// Get a single medical info record by its ID.
        /// Admin and Staff/Doctor can read any record.
        /// Patient can only read their own record.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<MedicalInfo>> GetById(long id)
        {
            if (!TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            var medInfo = await _repository.GetByIdAsync(id);
            if (medInfo is null)
                return NotFound();

            // Admin and Staff can read any record
            if (roleId == AppRoles.Admin || roleId == AppRoles.Staff)
                return Ok(medInfo);

            // Patient (role 3) — must own this record
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var patient = await _patientRepository.GetByUserIdAsync(userId);
            if (patient is null || patient.PatientId != medInfo.PatientId)
                return Forbid();

            return Ok(medInfo);
        }

        // ── GET my medical info (Patient convenience endpoint) ─────────────────

        /// <summary>
        /// Get the medical info record for the currently authenticated patient.
        /// </summary>
        [HttpGet("my")]
        [Authorize(Policy = AppPolicies.UserOnly)]
        public async Task<ActionResult<MedicalInfo>> GetMyMedicalInfo()
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var medInfo = await _repository.GetByUserIdAsync(userId);
            if (medInfo is null)
                return NotFound(new { message = "No medical info record found for current user." });

            return Ok(medInfo);
        }

        // ── GET by PatientId (Admin + Staff) ──────────────────────────────────

        /// <summary>
        /// Get the medical info record for a given patient ID.
        /// Admin and Staff can read any patient's medical info.
        /// </summary>
        [HttpGet("patient/{patientId:long}")]
        [Authorize(Policy = AppPolicies.StaffAndAbove)]
        public async Task<ActionResult<MedicalInfo>> GetByPatientId(long patientId)
        {
            var medInfo = await _repository.GetByPatientIdAsync(patientId);
            if (medInfo is null)
                return NotFound(new { message = "No medical info record found for this patient." });

            return Ok(medInfo);
        }


        // ── GET paginated (Admin and Staff) ───────────────────────────────────

        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.StaffAndAbove)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ── POST (Admin or own patient) ────────────────────────────────────────

        /// <summary>
        /// Create a medical info record.
        /// Admin and Staff (receptionist) can create for any patient. Patient can only create for their own record.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<MedicalInfo>> Create([FromBody] MedicalInfo medInfo)
        {
            if (!TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            // Patient (role 3) — enforce patient_id ownership
            if (roleId == AppRoles.User)
            {
                if (!TryGetUserIdClaim(out long userId))
                    return Unauthorized();

                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null)
                    return BadRequest(new { message = "No patient record found for current user." });

                // Override patient_id to prevent spoofing
                medInfo.PatientId = patient.PatientId;
            }

            if (medInfo.PatientId <= 0)
                return BadRequest(new { message = "patient_id is required." });

            await _repository.AddAsync(medInfo);
            return CreatedAtAction(nameof(GetById), new { id = medInfo.MedicalInfoId }, medInfo);
        }

        // ── PUT (Admin or own patient) ─────────────────────────────────────────

        /// <summary>
        /// Update a medical info record.
        /// Admin and Staff (receptionist) can update any record. Patient can only update their own.
        /// </summary>
        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, [FromBody] MedicalInfo medInfo)
        {
            if (!TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (medInfo.MedicalInfoId == 0) medInfo.MedicalInfoId = id;
            if (id != medInfo.MedicalInfoId)
                return BadRequest(new { message = "Route id does not match medical_info_id in body." });

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            // Patient — verify ownership
            if (roleId == AppRoles.User)
            {
                if (!TryGetUserIdClaim(out long userId))
                    return Unauthorized();

                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null || patient.PatientId != existing.PatientId)
                    return Forbid();

                // Prevent reassignment
                medInfo.PatientId = existing.PatientId;
            }

            await _repository.UpdateAsync(medInfo);
            return NoContent();
        }

        // ── DELETE (Admin only) ────────────────────────────────────────────────

        /// <summary>Delete a medical info record. Admin only.</summary>
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
