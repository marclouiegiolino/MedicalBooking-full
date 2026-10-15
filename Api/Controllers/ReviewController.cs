using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Medical.Api.Modules.Review;
using Medical.Api.Modules.Patients;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    /// <summary>
    /// Review management.
    /// - Admin: Full access (view, create, update, delete all reviews).
    /// - Doctor/Staff: Read-only access (view all, by id, paginated). Cannot add, edit, or delete.
    /// - User / Patient: Can view reviews, create reviews (for their own patient profile),
    ///   and update / delete their own reviews.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
    public class ReviewController : ControllerBase
    {
        private readonly IReviewRepository   _repository;
        private readonly IPatientsRepository _patientRepository;
        private readonly IDoctorRepository   _doctorRepository;

        public ReviewController(
            IReviewRepository repository,
            IPatientsRepository patientRepository,
            IDoctorRepository doctorRepository)
        {
            _repository        = repository;
            _patientRepository = patientRepository;
            _doctorRepository  = doctorRepository;
        }

        // ── Identity helpers ──────────────────────────────────────────────────

        private bool TryGetUserIdClaim(out long userId)
        {
            var claim = User.FindFirst("user_id")?.Value
                     ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out userId);
        }

        private bool TryGetRoleIdClaim(out int roleId)
        {
            var claim = User.FindFirst("user_role_id")?.Value;
            return int.TryParse(claim, out roleId);
        }

        // ── GET all (Admin, Doctor, Patient) ───────────────────────────────────

        [HttpGet]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<Review>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // ── GET by ID (Admin, Doctor, Patient) ─────────────────────────────────

        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<Review>> GetById(long id)
        {
            var review = await _repository.GetByIdAsync(id);
            if (review is null)
                return NotFound();

            return Ok(review);
        }

        // ── GET paginated (Admin, Doctor, Patient) ─────────────────────────────

        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // ── POST (Patient creates own review, Admin creates any review) ────────

        [HttpPost]
        [Authorize(Policy = AppPolicies.UserAndAdmin)]
        public async Task<ActionResult<Review>> Create([FromBody] Review review)
        {
            if (!TryGetUserIdClaim(out long callerUserId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            // Patient role: Automatically bind to caller's patient profile
            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(callerUserId);
                if (patient is null)
                    return BadRequest(new { message = "No patient profile found for current user." });

                review.PatientId = patient.PatientId;
            }
            else if (roleId == AppRoles.Admin)
            {
                if (review.PatientId <= 0)
                    return BadRequest(new { message = "patient_id is required and must be greater than 0." });

                var patientExists = await _patientRepository.ExistsAsync(review.PatientId);
                if (!patientExists)
                    return BadRequest(new { message = $"Patient with ID {review.PatientId} does not exist." });
            }

            // Validate Doctor
            if (review.DoctorId <= 0)
                return BadRequest(new { message = "doctor_id is required and must be greater than 0." });

            var doctor = await _doctorRepository.GetByIdAsync(review.DoctorId);
            if (doctor is null)
                return BadRequest(new { message = $"Doctor with ID {review.DoctorId} does not exist." });

            // Validate Rating
            if (review.Rating is null or < 1 or > 5)
                return BadRequest(new { message = "rating is required and must be between 1 and 5." });

            await _repository.AddAsync(review);
            return CreatedAtAction(nameof(GetById), new { id = review.ReviewId }, review);
        }

        // ── PUT (Patient edits own review, Admin edits any review) ─────────────

        [HttpPut("{id:long}")]
        [Authorize(Policy = AppPolicies.UserAndAdmin)]
        public async Task<IActionResult> Update(long id, [FromBody] Review review)
        {
            if (!TryGetUserIdClaim(out long callerUserId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (review.ReviewId == 0)
                review.ReviewId = id;

            if (id != review.ReviewId)
                return BadRequest(new { message = "Route id does not match review_id in request body." });

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            // Patient role: can only edit their own review
            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(callerUserId);
                if (patient is null || existing.PatientId != patient.PatientId)
                    return Forbid();

                // Preserve original patient and doctor IDs
                review.PatientId = existing.PatientId;
                review.DoctorId  = existing.DoctorId;
            }
            else if (roleId == AppRoles.Admin)
            {
                if (review.PatientId <= 0)
                    review.PatientId = existing.PatientId;

                if (review.DoctorId <= 0)
                    review.DoctorId = existing.DoctorId;
            }

            // Validate Rating if provided
            if (review.Rating is < 1 or > 5)
                return BadRequest(new { message = "rating must be between 1 and 5." });

            if (string.IsNullOrWhiteSpace(review.CreatedAt))
                review.CreatedAt = existing.CreatedAt;

            await _repository.UpdateAsync(review);
            return NoContent();
        }

        // ── DELETE (Patient deletes own review, Admin deletes any review) ──────

        [HttpDelete("{id:long}")]
        [Authorize(Policy = AppPolicies.UserAndAdmin)]
        public async Task<IActionResult> Delete(long id)
        {
            if (!TryGetUserIdClaim(out long callerUserId) || !TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            // Patient role: can only delete their own review
            if (roleId == AppRoles.User)
            {
                var patient = await _patientRepository.GetByUserIdAsync(callerUserId);
                if (patient is null || existing.PatientId != patient.PatientId)
                    return Forbid();
            }

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}
