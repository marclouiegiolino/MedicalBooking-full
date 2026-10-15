using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Medical.Api.Modules.User;
using Medical.Api.Modules.Authorizations;
using Medical.Api.Main;
using Medical.Api.DTOs;
using Medical.Api.Security;
using Medical.Api.Services;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/user")]
    [Produces("application/json")]
    [Authorize] // All endpoints require authentication
    public class UserController : ControllerBase
    {
        private readonly IUserRepository    _repository;
        private readonly IFileStorageService _fileStorage;

        public UserController(IUserRepository repository, IFileStorageService fileStorage)
        {
            _repository  = repository;
            _fileStorage = fileStorage;
        }

        // ── Helpers ────────────────────────────────────────────────────────────

        private static UserResponse ToResponse(User entity)
        {
            return new UserResponse
            {
                UserId             = entity.UserId,
                Guid               = entity.Guid,
                UserName           = entity.UserName,
                UserRoleId         = entity.UserRoleId,
                ProfilePicturePath = entity.ProfilePicturePath,
            };
        }

        private bool TryGetCallerUserId(out int userId)
        {
            var claim = User.FindFirst("user_id")?.Value
                     ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out userId);
        }

        private bool TryGetRoleIdClaim(out int roleId)
        {
            var claim = User.FindFirst("user_role_id")?.Value;
            return int.TryParse(claim, out roleId);
        }

        private bool IsAdmin() =>
            TryGetRoleIdClaim(out int roleId) && roleId == AppRoles.Admin;

        // ── Filter helpers ─────────────────────────────────────────────────────

        public sealed class SearchByFilterRequest
        {
            public int? userId { get; set; }
        }

        private static Dictionary<string, object?> BuildFilterMap(SearchByFilterRequest request)
        {
            var filters = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            if (request.userId != null)
            {
                filters["userId"] = request.userId;
            }
            return filters;
        }

        // ── Profile / Me Endpoints (Any authenticated user) ────────────────────

        /// <summary>
        /// Get the currently authenticated user's own profile.
        /// Available to all authenticated roles.
        /// </summary>
        [HttpGet("profile")]
        [HttpGet("me")]
        public async Task<ActionResult<UserResponse>> GetMyProfile()
        {
            try
            {
                if (!TryGetCallerUserId(out int callerId))
                    return Unauthorized();

                var entity = await _repository.GetByIdAsync(callerId);
                if (entity == null)
                    return NotFound(new { message = "User not found" });

                return Ok(ToResponse(entity));
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Update own profile (username, password, and/or profile picture path).
        /// </summary>
        [HttpPut("profile")]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateUsermanRequest request)
        {
            try
            {
                if (!TryGetCallerUserId(out int callerId))
                    return Unauthorized();

                return await Update(callerId, request);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // ── Profile Picture Upload ─────────────────────────────────────────────

        /// <summary>
        /// Upload a profile picture for the currently authenticated user.
        /// Accepts multipart/form-data with a "file" field.
        /// </summary>
        [HttpPost("profile-picture")]
        [HttpPost("me/profile-picture")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<UserResponse>> UploadMyProfilePicture(IFormFile file)
        {
            if (!TryGetCallerUserId(out int callerId))
                return Unauthorized();

            return await UploadProfilePictureInternal(callerId, file);
        }

        /// <summary>
        /// Upload a profile picture for a specific user ID.
        /// Users can upload for their own account; Admin can upload for any account.
        /// </summary>
        [HttpPost("{id}/profile-picture")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<UserResponse>> UploadProfilePicture(int id, IFormFile file)
        {
            if (!TryGetRoleIdClaim(out int roleId))
                return Unauthorized();

            if (!TryGetCallerUserId(out int callerId))
                return Unauthorized();

            bool isAdmin = roleId == AppRoles.Admin;
            if (!isAdmin && callerId != id)
                return Forbid();

            return await UploadProfilePictureInternal(id, file);
        }

        private async Task<ActionResult<UserResponse>> UploadProfilePictureInternal(int userId, IFormFile file)
        {
            try
            {
                var existingEntity = await _repository.GetByIdAsync(userId);
                if (existingEntity == null)
                    return NotFound(new { message = "User not found." });

                // Delete old picture before saving the new one
                await _fileStorage.DeleteFileAsync(existingEntity.ProfilePicturePath);

                var relativeUrl = await _fileStorage.SaveProfilePictureAsync(file, userId);
                existingEntity.ProfilePicturePath = relativeUrl;

                await _repository.UpdateAsync(existingEntity);

                return Ok(ToResponse(existingEntity));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // ── GET all (Admin only) ───────────────────────────────────────────────

        /// <summary>Get all user accounts. Admin only.</summary>
        [HttpGet]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<UserResponse>>> GetAll()
        {
            try
            {
                var result = await _repository.GetAllAsync();
                return Ok(result.Select(ToResponse).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Get a user account by ID.
        /// Admin can view any account.
        /// A user (any role) can view their own account.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<UserResponse>> GetById(int id)
        {
            try
            {
                if (!TryGetRoleIdClaim(out int roleId))
                    return Unauthorized();

                // Non-admins can only view their own account
                if (roleId != AppRoles.Admin)
                {
                    if (!TryGetCallerUserId(out int callerId) || callerId != id)
                        return Forbid();
                }

                var entity = await _repository.GetByIdAsync(id);
                if (entity == null)
                    return NotFound(new { message = "User not found" });

                return Ok(ToResponse(entity));
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>Dynamic exact-match filter search. Admin only.</summary>
        [HttpGet("search-by-filter-ematch")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<UserResponse>>> SearchByFilterExact([FromQuery] SearchByFilterRequest request)
        {
            try
            {
                IReadOnlyDictionary<string, object?> filters = BuildFilterMap(request);
                if (filters.Count == 0)
                    return BadRequest(new { message = "At least one filter must be provided." });

                var result = await _repository.GetFilteredExactAsync(filters);
                return Ok(result.Select(ToResponse).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>Dynamic partial-match filter search. Admin only.</summary>
        [HttpGet("search-by-filter-lmatch")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<UserResponse>>> SearchByFilterLike([FromQuery] SearchByFilterRequest request)
        {
            try
            {
                IReadOnlyDictionary<string, object?> filters = BuildFilterMap(request);
                if (filters.Count == 0)
                    return BadRequest(new { message = "At least one filter must be provided." });

                var result = await _repository.GetFilteredLikeAsync(filters);
                return Ok(result.Select(ToResponse).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>Search all user accounts. Admin only.</summary>
        [HttpGet("search-all")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<UserResponse>>> SearchAll([FromQuery] string query)
        {
            try
            {
                var result = await _repository.SearchAsyncAll(query);
                return Ok(result.Select(ToResponse).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>Get paginated user accounts. Admin only.</summary>
        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult> GetPaginated(int pageNumber = 1, int pageSize = 25)
        {
            try
            {
                var pagedResult = await _repository.GetPaginatedAsync(pageNumber, pageSize);
                var response = new PaginationModel<UserResponse>
                {
                    Items       = pagedResult.Items.Select(ToResponse).ToList(),
                    TotalCount  = pagedResult.TotalCount,
                    PageSize    = pagedResult.PageSize,
                    CurrentPage = pagedResult.CurrentPage
                };
                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // ── POST (Admin only) ──────────────────────────────────────────────────

        /// <summary>Create a new user account. Admin only.</summary>
        [HttpPost]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Create([FromBody] CreateUserManRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.UserName))
                    return BadRequest(new { message = "UserName is required" });
                if (string.IsNullOrWhiteSpace(request.Password))
                    return BadRequest(new { message = "Password is required" });

                var entity = new Medical.Api.Modules.User.User
                {
                    UserName           = request.UserName,
                    UserPass           = PasswordHasher.Hash(request.Password),
                    UserRoleId         = request.UserRoleId,
                    ProfilePicturePath = request.ProfilePicturePath ?? string.Empty,
                };

                await _repository.AddAsync(entity);
                return Ok(new { message = "User created successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // ── PUT (own account OR Admin) ─────────────────────────────────────────

        /// <summary>
        /// Update a user account.
        /// Admin can update any account, including changing the role.
        /// A user can update ONLY their own account (UserName, Password, ProfilePicturePath).
        /// A non-admin user CANNOT change their own role.
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateUsermanRequest request)
        {
            try
            {
                if (!TryGetRoleIdClaim(out int roleId))
                    return Unauthorized();

                if (!TryGetCallerUserId(out int callerId))
                    return Unauthorized();

                bool isAdmin = roleId == AppRoles.Admin;

                // Non-admins can only update their own account
                if (!isAdmin && callerId != id)
                    return Forbid();

                if (string.IsNullOrWhiteSpace(request.UserName))
                    return BadRequest(new { message = "UserName is required" });

                var existingEntity = await _repository.GetByIdAsync(id);
                if (existingEntity == null)
                    return NotFound(new { message = "User not found" });

                // Update username and optionally password
                existingEntity.UserName = request.UserName;
                if (!string.IsNullOrWhiteSpace(request.NewPassword))
                {
                    existingEntity.UserPass = PasswordHasher.Hash(request.NewPassword);
                }

                // Update profile picture path if provided
                if (request.ProfilePicturePath != null)
                {
                    existingEntity.ProfilePicturePath = request.ProfilePicturePath;
                }

                // Only Admin can change the role — patients cannot promote themselves
                if (isAdmin)
                {
                    existingEntity.UserRoleId = request.UserRoleId;
                }

                await _repository.UpdateAsync(existingEntity);
                return Ok(new { message = "User updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // ── DELETE (Admin only) ────────────────────────────────────────────────

        /// <summary>Delete a single user account. Admin only.</summary>
        [HttpDelete("{id}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var existingEntity = await _repository.GetByIdAsync(id);
                if (existingEntity == null)
                    return NotFound(new { message = "User not found" });

                await _repository.DeleteAsync(id);
                return Ok(new { message = "User deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>Delete ALL user accounts. Admin only.</summary>
        [HttpDelete]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> DeleteAll()
        {
            try
            {
                await _repository.DeleteAllAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // ── Bulk (Admin only) ──────────────────────────────────────────────────

        /// <summary>Bulk upload user accounts. Admin only.</summary>
        [HttpPost("bulk-upload")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> BulkUpload([FromBody] List<CreateUserManRequest> dataList)
        {
            try
            {
                if (dataList == null || dataList.Count == 0)
                    return BadRequest("Data list cannot be null or empty.");

                if (dataList.Any(item => string.IsNullOrWhiteSpace(item.UserName)))
                    return BadRequest(new { message = "One or more records have empty UserName." });
                if (dataList.Any(item => string.IsNullOrWhiteSpace(item.Password)))
                    return BadRequest(new { message = "One or more records have empty Password." });

                var entities = dataList.Select(item => new Medical.Api.Modules.User.User
                {
                    UserName           = item.UserName,
                    UserPass           = PasswordHasher.Hash(item.Password),
                    UserRoleId         = item.UserRoleId,
                    ProfilePicturePath = item.ProfilePicturePath ?? string.Empty,
                }).ToList();

                await _repository.BulkUploadAsync(entities);
                return Ok(new { message = $"Successfully uploaded {entities.Count} user records." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}