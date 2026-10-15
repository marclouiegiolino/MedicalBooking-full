using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.Insurance;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    /// <summary>
    /// Insurance management.
    /// - Patient: Own records only — view, add, edit, delete, set-primary
    /// - Receptionist: Any patient's — view, add, edit, delete, set-primary (front-desk/billing intake)
    /// - Admin: Any patient's — full access
    /// - Doctor: ❌ None at all — no view, no write, not even read-only
    /// - Lab/Radiology: ❌ None at all — never had a reason to be considered
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // All endpoints require authentication at minimum
    public class InsuranceController : ControllerBase
    {
        private readonly IInsuranceRepository _repository;
        private readonly IPatientsRepository  _patientRepository;
        private readonly IDoctorRepository    _doctorRepository;

        public InsuranceController(
            IInsuranceRepository repository,
            IPatientsRepository  patientRepository,
            IDoctorRepository    doctorRepository)
        {
            _repository        = repository;
            _patientRepository = patientRepository;
            _doctorRepository  = doctorRepository;
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

        /// <summary>
        /// Determines whether the authenticated caller is a Doctor (clinical staff).
        /// Doctors have ZERO access to insurance / billing records.
        /// </summary>
        private async Task<bool> IsDoctorUserAsync(long userId)
        {
            var doctor = await _doctorRepository.GetByUserIdAsync(userId);
            return doctor != null;
        }

        /// <summary>
        /// Verifies whether the caller is Admin or Receptionist (non-clinical staff).
        /// </summary>
        private async Task<bool> CanManageAnyPatientInsuranceAsync(int roleId, long userId)
        {
            if (roleId == AppRoles.Admin)
                return true;

            if (roleId == AppRoles.Staff)
            {
                // Doctors are blocked
                if (await IsDoctorUserAsync(userId))
                    return false;

                // Non-doctor staff = Receptionist / Billing intake
                return true;
            }

            return false;
        }

        // ── GET all (Admin, Doctor, Receptionist) ─────────────────────────────

        /// <summary>Get all insurance records. Admin, Doctor, and Receptionist.</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Insurance>>> GetAll()
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (roleId != AppRoles.Admin && roleId != AppRoles.Staff)
                return Forbid();

            return Ok(await _repository.GetAllAsync());
        }

        // ── GET paginated (Admin, Doctor, Receptionist) ───────────────────────

        [HttpGet("paginated")]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (roleId != AppRoles.Admin && roleId != AppRoles.Staff)
                return Forbid();

            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ── GET my insurance (Patient convenience endpoint) ────────────────────

        /// <summary>
        /// Get all insurance policies for the currently authenticated patient.
        /// Doctors/Staff are blocked.
        /// </summary>
        [HttpGet("my")]
        [Authorize(Policy = AppPolicies.UserOnly)]
        public async Task<ActionResult<IEnumerable<Insurance>>> GetMyInsurance()
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var records = await _repository.GetByUserIdAsync(userId);
            return Ok(records);
        }

        // ── GET by patient ID (Admin, Doctor, Receptionist, or own Patient) ───

        /// <summary>
        /// Get all insurance policies belonging to a specific patient.
        /// </summary>
        [HttpGet("patient/{patientId:long}")]
        public async Task<ActionResult<IEnumerable<Insurance>>> GetByPatientId(long patientId)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            // Admin or Staff (Doctor and Receptionist)
            if (roleId == AppRoles.Admin || roleId == AppRoles.Staff)
            {
                var records = await _repository.GetByPatientIdAsync(patientId);
                return Ok(records);
            }

            // Patient (role 3) — check own patient ID
            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null || patient.PatientId != patientId)
                    return Forbid();

                var records = await _repository.GetByPatientIdAsync(patientId);
                return Ok(records);
            }

            return Forbid();
        }

        // ── GET by insurance ID ────────────────────────────────────────────────

        /// <summary>
        /// Get a single insurance record by its ID.
        /// Admin, Doctor, Receptionist can access any. Patients can only access their own.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<Insurance>> GetById(long id)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            var insurance = await _repository.GetByIdAsync(id);
            if (insurance is null)
                return NotFound();

            if (roleId == AppRoles.Admin || roleId == AppRoles.Staff)
                return Ok(insurance);

            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null || patient.PatientId != insurance.PatientId)
                    return Forbid();

                return Ok(insurance);
            }

            return Forbid();
        }

        // ── POST (Admin, Receptionist, or own Patient) ─────────────────────────

        /// <summary>
        /// Create an insurance record.
        /// Admin/Receptionist can create for any patient. Patient can only create for their own record.
        /// Doctors are blocked.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<Insurance>> Create([FromBody] Insurance insurance)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (roleId == AppRoles.Staff && await IsDoctorUserAsync(userId))
                return Forbid();

            // Patient (role 3) — enforce patient_id ownership
            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null)
                    return BadRequest(new { message = "No patient record found for current user." });

                // Override patient_id to prevent spoofing
                insurance.PatientId = patient.PatientId;
            }
            else if (!await CanManageAnyPatientInsuranceAsync(roleId, userId))
            {
                return Forbid();
            }

            if (insurance.PatientId <= 0)
                return BadRequest(new { message = "patient_id is required." });

            if (string.IsNullOrWhiteSpace(insurance.ProviderName))
                return BadRequest(new { message = "provider_name is required." });

            if (string.IsNullOrWhiteSpace(insurance.PolicyNumber))
                return BadRequest(new { message = "policy_number is required." });

            await _repository.AddAsync(insurance);
            return CreatedAtAction(nameof(GetById), new { id = insurance.InsuranceId }, insurance);
        }

        // ── PUT (Admin, Receptionist, or own Patient) ──────────────────────────

        /// <summary>
        /// Update an insurance record.
        /// Admin/Receptionist can update any. Patient can only update their own.
        /// Doctors are blocked.
        /// </summary>
        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, [FromBody] Insurance insurance)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (roleId == AppRoles.Staff && await IsDoctorUserAsync(userId))
                return Forbid();

            if (insurance.InsuranceId == 0) insurance.InsuranceId = id;
            if (id != insurance.InsuranceId)
                return BadRequest(new { message = "Route id does not match insurance_id in body." });

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            // Patient — verify ownership
            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null || patient.PatientId != existing.PatientId)
                    return Forbid();

                // Prevent patient from reassigning record to another patient
                insurance.PatientId = existing.PatientId;
            }
            else if (!await CanManageAnyPatientInsuranceAsync(roleId, userId))
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(insurance.ProviderName))
                return BadRequest(new { message = "provider_name is required." });

            if (string.IsNullOrWhiteSpace(insurance.PolicyNumber))
                return BadRequest(new { message = "policy_number is required." });

            await _repository.UpdateAsync(insurance);
            return NoContent();
        }

        // ── SET PRIMARY (Admin, Receptionist, or own Patient) ──────────────────

        /// <summary>
        /// Designate an insurance record as the primary policy for the patient.
        /// Automatically clears primary flag on other policies for the same patient.
        /// </summary>
        [HttpPut("{id:long}/set-primary")]
        [HttpPost("{id:long}/set-primary")]
        public async Task<IActionResult> SetPrimary(long id)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (roleId == AppRoles.Staff && await IsDoctorUserAsync(userId))
                return Forbid();

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null || patient.PatientId != existing.PatientId)
                    return Forbid();
            }
            else if (!await CanManageAnyPatientInsuranceAsync(roleId, userId))
            {
                return Forbid();
            }

            await _repository.SetPrimaryAsync(id, existing.PatientId);
            return Ok(new { message = "Insurance marked as primary policy." });
        }

        // ── DELETE (Admin, Receptionist, or own Patient) ───────────────────────

        /// <summary>
        /// Delete an insurance record.
        /// Admin/Receptionist can delete any. Patient can delete their own record.
        /// Doctors are blocked.
        /// </summary>
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (roleId == AppRoles.Staff && await IsDoctorUserAsync(userId))
                return Forbid();

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null || patient.PatientId != existing.PatientId)
                    return Forbid();
            }
            else if (!await CanManageAnyPatientInsuranceAsync(roleId, userId))
            {
                return Forbid();
            }

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}

