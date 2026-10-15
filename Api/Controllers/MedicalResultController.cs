using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.MedicalResult;
using Medical.Api.Modules.MedicalRequest;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    /// <summary>
    /// Medical Result management.
    ///
    /// RBAC (per RBAC reference):
    ///   GET  /            — Admin only (all records)
    ///   GET  /paginated   — Admin only
    ///   GET  /my          — Admin | Doctor (own requests) | Lab/Staff | Patient (own requests)
    ///   GET  /{id}        — Admin | Doctor (own request) | Lab/Staff | Patient (own request)
    ///   POST /            — Lab/Radiology Staff | Admin (also flips request status → Completed)
    ///   DELETE/{id}       — Admin | Lab/Radiology (own upload only)
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
    public class MedicalResultController : ControllerBase
    {
        private readonly IMedicalResultRepository  _repository;
        private readonly IMedicalRequestRepository _requestRepository;
        private readonly IPatientsRepository       _patientRepository;
        private readonly IDoctorRepository         _doctorRepository;

        // Status ID for "Completed" — adjust to match your status table
        private const long StatusCompleted = 3;

        public MedicalResultController(
            IMedicalResultRepository  repository,
            IMedicalRequestRepository requestRepository,
            IPatientsRepository       patientRepository,
            IDoctorRepository         doctorRepository)
        {
            _repository        = repository;
            _requestRepository = requestRepository;
            _patientRepository = patientRepository;
            _doctorRepository  = doctorRepository;
        }

        // ── Identity helpers ───────────────────────────────────────────────────

        private long? GetCurrentUserId()
        {
            var claim = User.FindFirst("user_id")?.Value
                     ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out long id) ? id : null;
        }

        private bool IsAdmin()   => User.HasClaim("user_role_id", AppRoles.Admin.ToString());
        private bool IsStaff()   => User.HasClaim("user_role_id", AppRoles.Staff.ToString());
        private bool IsPatient() => User.HasClaim("user_role_id", AppRoles.User.ToString());

        private async Task<Doctor?> GetCurrentDoctorAsync()
        {
            var userId = GetCurrentUserId();
            if (userId is null) return null;
            return await _doctorRepository.GetByUserIdAsync(userId.Value);
        }

        // ── GET all (Admin only) ───────────────────────────────────────────────

        [HttpGet]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<MedicalResult>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // ── GET paginated (Admin only) ─────────────────────────────────────────

        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ── GET /{id} ──────────────────────────────────────────────────────────

        /// <summary>
        /// Get a single result by ID.
        ///   Admin        → any
        ///   Doctor       → only if they own the parent request
        ///   Lab/Radiology (Staff) → any result
        ///   Patient      → only if they own the parent request
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<MedicalResult>> GetById(long id)
        {
            var result = await _repository.GetByIdAsync(id);
            if (result is null)
                return NotFound();

            if (IsAdmin())
                return Ok(result);

            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            if (IsStaff())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return StatusCode(403, "Receptionists do not have access to medical results.");

                // Doctor — verify parent request belongs to them
                var req = await _requestRepository.GetByIdAsync(result.RequestId);
                if (req is null || req.DoctorId != doctor.DoctorId)
                    return Forbid();

                return Ok(result);
            }

            // Patient — verify parent request belongs to them
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId.Value);
                if (patient is null)
                    return Forbid();

                var req = await _requestRepository.GetByIdAsync(result.RequestId);
                if (req is null || req.PatientId != patient.PatientId)
                    return Forbid();

                return Ok(result);
            }
        }

        // ── GET /my ───────────────────────────────────────────────────────────

        /// <summary>
        /// Get results relevant to the caller:
        ///   Admin        → all
        ///   Doctor       → results for their own requests
        ///   Lab/Radiology → results they uploaded (uploaded_by_user_id match)
        ///   Patient      → results for their own requests
        /// </summary>
        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<MedicalResult>>> GetMine()
        {
            if (IsAdmin())
                return Ok(await _repository.GetAllAsync());

            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            if (IsStaff())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                {
                    // Receptionist — no access to medical results
                    return StatusCode(403, "Receptionists do not have access to medical results.");
                }

                // Doctor — gather results for all their requests
                var requests = await _requestRepository.GetByDoctorIdAsync(doctor.DoctorId);
                var results  = new List<MedicalResult>();
                foreach (var req in requests)
                    results.AddRange(await _repository.GetByRequestIdAsync(req.RequestId));
                return Ok(results);
            }

            // Patient — gather results for all their requests
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId.Value);
                if (patient is null)
                    return NotFound(new { message = "Patient record not found for current user." });

                var requests = await _requestRepository.GetByPatientIdAsync(patient.PatientId);
                var results  = new List<MedicalResult>();
                foreach (var req in requests)
                    results.AddRange(await _repository.GetByRequestIdAsync(req.RequestId));
                return Ok(results);
            }
        }

        // ── GET /by-request/{requestId} ───────────────────────────────────────

        /// <summary>
        /// Get all results for a specific request.
        ///   Admin / Staff → any request
        ///   Patient       → own request only
        /// </summary>
        [HttpGet("by-request/{requestId:long}")]
        public async Task<ActionResult<IEnumerable<MedicalResult>>> GetByRequest(long requestId)
        {
            var request = await _requestRepository.GetByIdAsync(requestId);
            if (request is null)
                return NotFound(new { message = $"Medical request {requestId} not found." });

            if (IsAdmin() || IsStaff())
                return Ok(await _repository.GetByRequestIdAsync(requestId));

            // Patient — ownership check
            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            var patient = await _patientRepository.GetByUserIdAsync(userId.Value);
            if (patient is null || patient.PatientId != request.PatientId)
                return Forbid();

            return Ok(await _repository.GetByRequestIdAsync(requestId));
        }

        // ── POST / — Upload result (Lab/Radiology or Admin) ───────────────────

        /// <summary>
        /// Upload a result for a medical request.
        /// Only Lab/Radiology Staff or Admin can do this.
        /// Automatically flips the parent request status to Completed.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<MedicalResult>> Create([FromBody] MedicalResult result)
        {
            // Only Lab/Radiology (Staff without doctor profile) or Admin
            if (!IsAdmin() && !IsStaff())
                return Forbid();

            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            // Doctors are not allowed to upload results — only Lab/Radiology
            if (IsStaff() && !IsAdmin())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is not null)
                    return Forbid(); // Doctors use consultation notes, not results
            }

            if (result.RequestId <= 0)
                return BadRequest(new { message = "request_id is required and must be greater than 0." });

            var request = await _requestRepository.GetByIdAsync(result.RequestId);
            if (request is null)
                return BadRequest(new { message = $"Medical request with ID {result.RequestId} does not exist." });

            // Stamp who uploaded this
            result.UploadedByUserId = userId.Value;

            await _repository.AddAsync(result);

            // Flip parent request status to Completed
            request.StatusId = StatusCompleted;
            await _requestRepository.UpdateAsync(request);

            return CreatedAtAction(nameof(GetById), new { id = result.ResultId }, result);
        }

        // ── DELETE /{id} ───────────────────────────────────────────────────────

        /// <summary>
        /// Delete a result.
        ///   Admin        → any result
        ///   Lab/Radiology → own uploads only (uploaded_by_user_id match)
        ///   Others       → 403
        /// </summary>
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            if (!IsAdmin() && !IsStaff())
                return Forbid();

            var result = await _repository.GetByIdAsync(id);
            if (result is null)
                return NotFound();

            // Lab/Radiology — can only delete their own uploads
            if (IsStaff() && !IsAdmin())
            {
                // Ensure caller is not a doctor
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is not null)
                    return Forbid(); // Doctors cannot delete results

                var userId = GetCurrentUserId();
                if (userId is null)
                    return Unauthorized(new { message = "Could not resolve user identity from token." });

                if (result.UploadedByUserId != userId.Value)
                    return Forbid(); // Can only delete own uploads
            }

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}
