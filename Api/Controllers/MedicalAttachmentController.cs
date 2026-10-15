using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.MedicalAttachment;
using Medical.Api.Modules.MedicalRequest;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{

    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
    public class MedicalAttachmentController : ControllerBase
    {
        private readonly IMedicalAttachmentRepository _repository;
        private readonly IMedicalRequestRepository    _requestRepository;
        private readonly IPatientsRepository          _patientRepository;
        private readonly IDoctorRepository            _doctorRepository;

        public MedicalAttachmentController(
            IMedicalAttachmentRepository repository,
            IMedicalRequestRepository    requestRepository,
            IPatientsRepository          patientRepository,
            IDoctorRepository            doctorRepository)
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
        public async Task<ActionResult<IEnumerable<MedicalAttachment>>> GetAll()
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
        /// Get a single attachment by ID.
        ///   Admin        → any
        ///   Doctor       → only if they own the parent request (doctor_id match)
        ///   Lab/Radiology (Staff w/o doctor profile) → any (they need to see all)
        ///   Patient      → only if they own the parent request (patient_id match via user_id)
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<MedicalAttachment>> GetById(long id)
        {
            var attachment = await _repository.GetByIdAsync(id);
            if (attachment is null)
                return NotFound();

            if (IsAdmin())
                return Ok(attachment);

            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            if (IsStaff())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return StatusCode(403, "Receptionists do not have access to medical attachments.");

                // Doctor — verify parent request belongs to them
                var req = await _requestRepository.GetByIdAsync(attachment.RequestId);
                if (req is null || req.DoctorId != doctor.DoctorId)
                    return Forbid();

                return Ok(attachment);
            }

            // Patient — verify parent request belongs to them
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId.Value);
                if (patient is null)
                    return Forbid();

                var req = await _requestRepository.GetByIdAsync(attachment.RequestId);
                if (req is null || req.PatientId != patient.PatientId)
                    return Forbid();

                return Ok(attachment);
            }
        }

        // ── GET /my ───────────────────────────────────────────────────────────

        /// <summary>
        /// Get attachments relevant to the caller:
        ///   Admin        → all
        ///   Doctor       → attachments on their own requests
        ///   Lab/Radiology → all
        ///   Patient      → attachments on their own requests
        /// </summary>
        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<MedicalAttachment>>> GetMine()
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
                    return StatusCode(403, "Receptionists do not have access to medical attachments.");

                // Doctor — gather attachments for all their requests
                var requests = await _requestRepository.GetByDoctorIdAsync(doctor.DoctorId);
                var results  = new List<MedicalAttachment>();
                foreach (var req in requests)
                    results.AddRange(await _repository.GetByRequestIdAsync(req.RequestId));
                return Ok(results);
            }

            // Patient — gather attachments for all their requests
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId.Value);
                if (patient is null)
                    return NotFound(new { message = "Patient record not found for current user." });

                var requests = await _requestRepository.GetByPatientIdAsync(patient.PatientId);
                var results  = new List<MedicalAttachment>();
                foreach (var req in requests)
                    results.AddRange(await _repository.GetByRequestIdAsync(req.RequestId));
                return Ok(results);
            }
        }

        // ── POST / — JSON metadata only (kept for backward compat) ───────────────

        /// <summary>
        /// Create an attachment record from a JSON body (no file binary).
        ///   Admin   → any request
        ///   Doctor  → own requests only
        ///   Others  → 403
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<MedicalAttachment>> Create([FromBody] MedicalAttachment attachment)
        {
            if (!IsAdmin() && !IsStaff())
                return Forbid();

            if (attachment.RequestId <= 0)
                return BadRequest(new { message = "request_id is required and must be greater than 0." });

            var request = await _requestRepository.GetByIdAsync(attachment.RequestId);
            if (request is null)
                return BadRequest(new { message = $"Medical request with ID {attachment.RequestId} does not exist." });

            // Doctor — can only attach to their own requests
            if (IsStaff() && !IsAdmin())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid();

                if (request.DoctorId != doctor.DoctorId)
                    return Forbid();
            }

            attachment.UploadedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            await _repository.AddAsync(attachment);

            if (request.StatusId == 1 || request.StatusId == 2)
            {
                request.StatusId  = 3; // Completed
                request.UpdatedAt = DateTime.UtcNow;
                await _requestRepository.UpdateAsync(request);
            }

            return CreatedAtAction(nameof(GetById), new { id = attachment.AttachmentId }, attachment);
        }

        // ── POST /upload — Multipart file upload ───────────────────────────────────

        /// <summary>
        /// Upload a real file attached to a medical request.
        ///   Form fields: request_id (required), file (IFormFile, required)
        ///   Admin   → any request
        ///   Doctor  → own requests only
        ///   Others  → 403
        /// </summary>
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<MedicalAttachment>> Upload(
            [FromForm] long request_id,
            IFormFile file,
            IWebHostEnvironment env)
        {
            if (!IsAdmin() && !IsStaff())
                return Forbid();

            if (request_id <= 0)
                return BadRequest(new { message = "request_id is required and must be greater than 0." });

            if (file is null || file.Length == 0)
                return BadRequest(new { message = "A file is required." });

            const long MaxBytes = 50 * 1024 * 1024; // 50 MB
            if (file.Length > MaxBytes)
                return BadRequest(new { message = "File exceeds the 50 MB limit." });

            var request = await _requestRepository.GetByIdAsync(request_id);
            if (request is null)
                return BadRequest(new { message = $"Medical request with ID {request_id} does not exist." });

            // Doctor — can only attach to their own requests
            if (IsStaff() && !IsAdmin())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid();

                if (request.DoctorId != doctor.DoctorId)
                    return Forbid();
            }

            // Save file to wwwroot/uploads/attachments/
            var uploadsDir = Path.Combine(env.WebRootPath ?? "wwwroot", "uploads", "attachments");
            Directory.CreateDirectory(uploadsDir);

            var ext       = Path.GetExtension(file.FileName);
            var safeGuid  = System.Guid.NewGuid().ToString("N");
            var diskName  = $"{safeGuid}{ext}";
            var diskPath  = Path.Combine(uploadsDir, diskName);

            using (var fs = System.IO.File.Create(diskPath))
                await file.CopyToAsync(fs);

            // Build a publicly accessible URL path
            var filePath = $"/uploads/attachments/{diskName}";

            var attachment = new MedicalAttachment
            {
                Guid       = safeGuid,
                RequestId  = request_id,
                FileName   = file.FileName,
                FilePath   = filePath,
                UploadedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
            };

            await _repository.AddAsync(attachment);

            // Automatically advance medical request status to Completed (3) upon attachment upload
            if (request.StatusId == 1 || request.StatusId == 2)
            {
                request.StatusId  = 3; // Completed
                request.UpdatedAt = DateTime.UtcNow;
                await _requestRepository.UpdateAsync(request);
            }

            return CreatedAtAction(nameof(GetById), new { id = attachment.AttachmentId }, attachment);
        }

        // ── DELETE /{id} ───────────────────────────────────────────────────────

        /// <summary>
        /// Delete an attachment.
        ///   Admin   → any
        ///   Doctor  → own requests only
        ///   Others  → 403
        /// </summary>
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            if (!IsAdmin() && !IsStaff())
                return Forbid();

            var attachment = await _repository.GetByIdAsync(id);
            if (attachment is null)
                return NotFound();

            // Doctor — verify ownership of parent request
            if (IsStaff() && !IsAdmin())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid(); // Lab/Radiology cannot delete attachments

                var request = await _requestRepository.GetByIdAsync(attachment.RequestId);
                if (request is null || request.DoctorId != doctor.DoctorId)
                    return Forbid();
            }

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}
