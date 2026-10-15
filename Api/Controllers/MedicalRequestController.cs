using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.MedicalRequest;
using Medical.Api.Modules.Consultation;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.MedicalRequestType;
using Medical.Api.Modules.Notification;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    /// <summary>
    /// Medical Request management.
    ///
    /// RBAC (per RBAC reference):
    ///   GET  /            — Admin only (all records)
    ///   GET  /paginated   — Admin only
    ///   GET  /my          — Admin (all) | Doctor (own) | Lab/Staff (all assigned) | Patient (own)
    ///   GET  /{id}        — Admin | Doctor (own) | Lab/Staff | Patient (own)
    ///   POST /            — Admin | Doctor (doctor_id auto-set to caller)
    ///   PATCH/{id}/status — Admin | Lab/Radiology Staff
    ///   DELETE/{id}       — Admin only (soft-delete)
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
    public class MedicalRequestController : ControllerBase
    {
        private readonly IMedicalRequestRepository      _repository;
        private readonly IConsultationRepository        _consultationRepository;
        private readonly IPatientsRepository            _patientRepository;
        private readonly IDoctorRepository              _doctorRepository;
        private readonly IMedicalRequestTypeRepository  _requestTypeRepository;
        private readonly INotificationService           _notifications;

        public MedicalRequestController(
            IMedicalRequestRepository     repository,
            IConsultationRepository       consultationRepository,
            IPatientsRepository           patientRepository,
            IDoctorRepository             doctorRepository,
            IMedicalRequestTypeRepository requestTypeRepository,
            INotificationService          notifications)
        {
            _repository             = repository;
            _consultationRepository = consultationRepository;
            _patientRepository      = patientRepository;
            _doctorRepository       = doctorRepository;
            _requestTypeRepository  = requestTypeRepository;
            _notifications          = notifications;
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

        /// <summary>Returns all medical requests. Admin only.</summary>
        [HttpGet]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<MedicalRequest>>> GetAll()
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

        // ── GET /my — role-scoped view ─────────────────────────────────────────

        /// <summary>
        /// Returns the caller's relevant requests:
        ///   Admin   → all requests
        ///   Doctor  → requests they created (doctor_id match)
        ///   Staff   → all requests (Lab/Radiology need to see assigned work)
        ///   Patient → requests belonging to them (patient_id match via user_id)
        /// </summary>
        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<MedicalRequest>>> GetMine()
        {
            if (IsAdmin())
                return Ok(await _repository.GetAllAsync());

            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            if (IsStaff())
            {
                var doctor = await GetCurrentDoctorAsync();
                // If caller is a doctor → show their requests; otherwise Receptionist → forbidden
                if (doctor is not null)
                    return Ok(await _repository.GetByDoctorIdAsync(doctor.DoctorId));

                return StatusCode(403, "Receptionists do not have access to medical records.");
            }

            // Patient — own requests only (resolved via user_id → patient)
            return Ok(await _repository.GetByUserIdAsync(userId.Value));
        }

        // ── GET /{id} ──────────────────────────────────────────────────────────

        /// <summary>
        /// Get a single medical request by ID.
        ///   Admin   → any
        ///   Doctor  → own (doctor_id match)
        ///   Staff   → any (Lab/Radiology need to view assigned requests)
        ///   Patient → own only (patient_id via user_id)
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<MedicalRequest>> GetById(long id)
        {
            var request = await _repository.GetByIdAsync(id);
            if (request is null)
                return NotFound();

            if (IsAdmin())
                return Ok(request);

            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            if (IsStaff())
            {
                // Both doctors and Lab/Radiology staff can view any request
                return Ok(request);
            }

            // Patient — ownership check via patient record or user_id
            var patient = await _patientRepository.GetByUserIdAsync(userId.Value);
            bool isOwner = (patient != null && patient.PatientId == request.PatientId) || request.PatientId == userId.Value;
            if (!isOwner)
                return Forbid();

            return Ok(request);
        }

        // ── POST / — Create a medical request ─────────────────────────────────

        /// <summary>
        /// Create a new medical request.
        ///   Admin   → can specify any doctor_id / patient_id
        ///   Doctor  → doctor_id is auto-set to their own profile
        ///   Others  → 403
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<MedicalRequest>> Create([FromBody] MedicalRequest medicalRequest)
        {
            if (!IsAdmin() && !IsStaff())
                return Forbid();

            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { message = "Could not resolve user identity from token." });

            // If caller is a Doctor, force doctor_id to their own profile
            if (IsStaff())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is null)
                    return Forbid(); // Lab/Radiology staff cannot create requests

                medicalRequest.DoctorId = doctor.DoctorId;
            }

            // Validate consultation_id FK
            if (medicalRequest.ConsultationId <= 0)
                return BadRequest(new { message = "consultation_id is required and must be greater than 0." });

            var consultation = await _consultationRepository.GetByIdAsync(medicalRequest.ConsultationId);
            if (consultation is null)
                return BadRequest(new { message = $"Consultation with ID {medicalRequest.ConsultationId} does not exist." });

            // Validate patient_id FK
            if (medicalRequest.PatientId <= 0)
                return BadRequest(new { message = "patient_id is required and must be greater than 0." });

            var patient = await _patientRepository.GetByIdAsync(medicalRequest.PatientId);
            if (patient is null)
                return BadRequest(new { message = $"Patient with ID {medicalRequest.PatientId} does not exist." });

            // Validate doctor_id FK
            if (medicalRequest.DoctorId <= 0)
                return BadRequest(new { message = "doctor_id is required and must be greater than 0." });

            var doctor2 = await _doctorRepository.GetByIdAsync(medicalRequest.DoctorId);
            if (doctor2 is null)
                return BadRequest(new { message = $"Doctor with ID {medicalRequest.DoctorId} does not exist." });

            // Validate request_type_id FK
            if (medicalRequest.RequestTypeId <= 0)
                return BadRequest(new { message = "request_type_id is required and must be greater than 0." });

            var requestType = await _requestTypeRepository.GetByIdAsync(medicalRequest.RequestTypeId);
            if (requestType is null)
                return BadRequest(new { message = $"Request type with ID {medicalRequest.RequestTypeId} does not exist." });

            // status_id defaults to 1 (Pending) if not supplied
            if (medicalRequest.StatusId <= 0)
                medicalRequest.StatusId = 1;

            await _repository.AddAsync(medicalRequest);

            // Notify the patient that a new medical request was placed for them
            try
            {
                var patientUser = await _patientRepository.GetByIdAsync(medicalRequest.PatientId);
                if (patientUser?.UserId is long patientUserId)
                {
                    var typeName = requestType?.RequestName ?? "medical";
                    await _notifications.SendAsync(
                        userId:           patientUserId,
                        title:            "New Medical Request",
                        message:          $"A new {typeName} request has been placed for you. Request #{medicalRequest.RequestId}.",
                        notificationType: "medical_request",
                        referenceType:    "medical_request",
                        referenceId:      medicalRequest.RequestId);
                }
            }
            catch { /* notifications are non-critical */ }

            return CreatedAtAction(nameof(GetById), new { id = medicalRequest.RequestId }, medicalRequest);
        }

        // ── PATCH /{id}/status — Update status ────────────────────────────────

        /// <summary>
        /// Update the status of a medical request.
        ///   Admin        → any request
        ///   Lab/Radiology (Staff without a doctor profile) → any request
        ///   Doctor / Patient → 403
        /// </summary>
        [HttpPatch("{id:long}/status")]
        public async Task<IActionResult> UpdateStatus(long id, [FromBody] UpdateStatusRequest body)
        {
            if (!IsAdmin() && !IsStaff())
                return Forbid();

            // Doctors should not update status — only Lab/Radiology
            if (IsStaff() && !IsAdmin())
            {
                var doctor = await GetCurrentDoctorAsync();
                if (doctor is not null)
                    return Forbid(); // Doctor → use the consultation workflow instead
            }

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            if (body.StatusId <= 0)
                return BadRequest(new { message = "status_id is required and must be greater than 0." });

            var prevStatusId = existing.StatusId;
            existing.StatusId = body.StatusId;
            await _repository.UpdateAsync(existing);

            // Notify patient of status change (only if status actually changed)
            if (prevStatusId != body.StatusId)
            {
                try
                {
                    var patientRec = await _patientRepository.GetByIdAsync(existing.PatientId);
                    if (patientRec?.UserId is long pUserId)
                    {
                        var statusLabel = body.StatusId switch
                        {
                            1 => "Pending",
                            2 => "In Progress",
                            3 => "Completed",
                            4 => "Rejected",
                            _ => $"#{body.StatusId}"
                        };
                        await _notifications.SendAsync(
                            userId:           pUserId,
                            title:            "Medical Request Updated",
                            message:          $"Your medical request #{existing.RequestId} status has been updated to {statusLabel}.",
                            notificationType: "medical_request",
                            referenceType:    "medical_request",
                            referenceId:      existing.RequestId);
                    }
                }
                catch { /* notifications are non-critical */ }
            }

            return NoContent();
        }

        // ── DELETE /{id} — Soft-delete (Admin only) ────────────────────────────

        /// <summary>Soft-delete a medical request. Admin only.</summary>
        [HttpDelete("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Delete(long id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            existing.IsDeleted = true;
            existing.DeletedAt = DateTime.UtcNow;
            await _repository.UpdateAsync(existing);
            return NoContent();
        }
    }

    /// <summary>Body DTO for PATCH /{id}/status.</summary>
    public sealed class UpdateStatusRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("status_id")]
        public long StatusId { get; set; }
    }
}
