using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.EmergencyContact;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] 
    public class EmergencyContactController : ControllerBase
    {
        private readonly IEmergencyContactRepository _repository;
        private readonly IPatientsRepository         _patientRepository;
        private readonly IDoctorRepository           _doctorRepository;

        public EmergencyContactController(
            IEmergencyContactRepository repository,
            IPatientsRepository         patientRepository,
            IDoctorRepository           doctorRepository)
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
        /// Doctors have ZERO access to emergency contact records.
        /// </summary>
        private async Task<bool> IsDoctorUserAsync(long userId)
        {
            var doctor = await _doctorRepository.GetByUserIdAsync(userId);
            return doctor != null;
        }

        /// <summary>
        /// Verifies whether the caller is Admin or Receptionist (non-clinical staff).
        /// </summary>
        private async Task<bool> CanManageAnyPatientEmergencyContactAsync(int roleId, long userId)
        {
            if (roleId == AppRoles.Admin)
                return true;

            if (roleId == AppRoles.Staff)
            {
                // Doctors are blocked
                if (await IsDoctorUserAsync(userId))
                    return false;

                // Non-doctor staff = Receptionist / Front-desk intake
                return true;
            }

            return false;
        }

        // ── GET all (Admin, Doctor, Receptionist) ─────────────────────────────

        /// <summary>Get all emergency contacts. Admin, Doctor, and Receptionist.</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmergencyContact>>> GetAll()
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

        // ── GET my contacts (Patient convenience endpoint) ─────────────────────

        /// <summary>
        /// Get all emergency contacts for the currently authenticated patient.
        /// Doctors/Staff are blocked.
        /// </summary>
        [HttpGet("my")]
        [Authorize(Policy = AppPolicies.UserOnly)]
        public async Task<ActionResult<IEnumerable<EmergencyContact>>> GetMyContacts()
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var records = await _repository.GetByUserIdAsync(userId);
            return Ok(records);
        }

        // ── GET by patient ID (Admin, Doctor, Receptionist, or own Patient) ───

        /// <summary>
        /// Get all emergency contacts belonging to a specific patient.
        /// </summary>
        [HttpGet("patient/{patientId:long}")]
        public async Task<ActionResult<IEnumerable<EmergencyContact>>> GetByPatientId(long patientId)
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

        // ── GET by contact ID ──────────────────────────────────────────────────

        /// <summary>
        /// Get a single emergency contact by its ID.
        /// Admin, Doctor, Receptionist can access any. Patients can only access their own.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<EmergencyContact>> GetById(long id)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            var contact = await _repository.GetByIdAsync(id);
            if (contact is null)
                return NotFound();

            if (roleId == AppRoles.Admin || roleId == AppRoles.Staff)
                return Ok(contact);

            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(userId);
                if (patient is null || patient.PatientId != contact.PatientId)
                    return Forbid();

                return Ok(contact);
            }

            return Forbid();
        }
        
        [HttpPost]
        public async Task<ActionResult<EmergencyContact>> Create([FromBody] EmergencyContact contact)
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
                contact.PatientId = patient.PatientId;
            }
            else if (!await CanManageAnyPatientEmergencyContactAsync(roleId, userId))
            {
                return Forbid();
            }

            if (contact.PatientId <= 0)
                return BadRequest(new { message = "patient_id is required." });

            if (string.IsNullOrWhiteSpace(contact.FirstName))
                return BadRequest(new { message = "first_name is required." });

            if (string.IsNullOrWhiteSpace(contact.LastName))
                return BadRequest(new { message = "last_name is required." });

            if (string.IsNullOrWhiteSpace(contact.Phone))
                return BadRequest(new { message = "phone is required." });

            await _repository.AddAsync(contact);
            return CreatedAtAction(nameof(GetById), new { id = contact.ContactId }, contact);
        }

        // ── PUT (Admin, Receptionist, or own Patient) ──────────────────────────

        /// <summary>
        /// Update an emergency contact.
        /// Admin/Receptionist can update any. Patient can only update their own.
        /// Doctors are blocked.
        /// </summary>
        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, [FromBody] EmergencyContact contact)
        {
            if (!TryGetUserIdClaim(out long userId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (roleId == AppRoles.Staff && await IsDoctorUserAsync(userId))
                return Forbid();

            if (contact.ContactId == 0) contact.ContactId = id;
            if (id != contact.ContactId)
                return BadRequest(new { message = "Route id does not match contact_id in body." });

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
                contact.PatientId = existing.PatientId;
            }
            else if (!await CanManageAnyPatientEmergencyContactAsync(roleId, userId))
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(contact.FirstName))
                return BadRequest(new { message = "first_name is required." });

            if (string.IsNullOrWhiteSpace(contact.LastName))
                return BadRequest(new { message = "last_name is required." });

            if (string.IsNullOrWhiteSpace(contact.Phone))
                return BadRequest(new { message = "phone is required." });

            await _repository.UpdateAsync(contact);
            return NoContent();
        }

        // ── DELETE (Admin, Receptionist, or own Patient) ───────────────────────

        /// <summary>
        /// Delete an emergency contact.
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
            else if (!await CanManageAnyPatientEmergencyContactAsync(roleId, userId))
            {
                return Forbid();
            }

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}
