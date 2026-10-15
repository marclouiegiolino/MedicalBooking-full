using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using Medical.Api.Modules.UserRoles;
using Medical.Api.Main;
using Medical.Api.DTOs;
using Medical.Api.Security;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/userrole")]
    [Produces("application/json")]
    [Authorize] // All endpoints require authentication
    public class UserroleController : ControllerBase
    {
        private readonly IUserRoleRepository _repository;

        public UserroleController(IUserRoleRepository repository)
        {
            _repository = repository;
        }

        private static UserroleResponse ToResponse(UserRole entity)
        {
            return new UserroleResponse
            {
                UserRoleId = entity.UserRoleId,
                UserRole = entity.RoleName,
            };
        }

        public sealed class SearchByFilterRequest
        {
            public int? userRoleId { get; set; }
        }

        private static Dictionary<string, object?> BuildFilterMap(SearchByFilterRequest request)
        {
            var filters = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            if (request.userRoleId != null)
            {
                filters["userRoleId"] = request.userRoleId;
            }
            return filters;
        }

        /// <summary>
        /// Get all userrole (Admin only)
        /// </summary>
        [HttpGet]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult<IEnumerable<UserroleResponse>>> GetAll()
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
        /// Get userrole by ID (Admin only)
        /// </summary>
        [HttpGet("{id}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult<UserroleResponse>> GetById(int id)
        {
            try
            {
                var entity = await _repository.GetByIdAsync(id);
                if (entity == null)
                    return NotFound(new { message = "Userrole not found" });
                return Ok(ToResponse(entity));
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Dynamic exact-match filters for userrole (Admin only)
        /// </summary>
        [HttpGet("search-by-filter-ematch")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult<IEnumerable<UserroleResponse>>> SearchByFilterExact([FromQuery] SearchByFilterRequest request)
        {
            try
            {
                IReadOnlyDictionary<string, object?> filters = BuildFilterMap(request);
                if (filters.Count == 0)
                {
                    return BadRequest(new { message = "At least one filter must be provided." });
                }

                var result = await _repository.GetFilteredExactAsync(filters);
                return Ok(result.Select(ToResponse).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Dynamic partial-match filters for userrole (Admin only)
        /// </summary>
        [HttpGet("search-by-filter-lmatch")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult<IEnumerable<UserroleResponse>>> SearchByFilterLike([FromQuery] SearchByFilterRequest request)
        {
            try
            {
                IReadOnlyDictionary<string, object?> filters = BuildFilterMap(request);
                if (filters.Count == 0)
                {
                    return BadRequest(new { message = "At least one filter must be provided." });
                }

                var result = await _repository.GetFilteredLikeAsync(filters);
                return Ok(result.Select(ToResponse).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Search all userrole (Admin only)
        /// </summary>
        [HttpGet("search-all")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult<IEnumerable<UserroleResponse>>> SearchAll([FromQuery] string query)
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

        /// <summary>
        /// Get paginated userrole (Admin only)
        /// </summary>
        [HttpGet("paginated")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> GetPaginated(int pageNumber = 1, int pageSize = 25)
        {
            try
            {
                var pagedResult = await _repository.GetPaginatedAsync(pageNumber, pageSize);
                var response = new PaginationModel<UserroleResponse>
                {
                    Items = pagedResult.Items.Select(ToResponse).ToList(),
                    TotalCount = pagedResult.TotalCount,
                    PageSize = pagedResult.PageSize,
                    CurrentPage = pagedResult.CurrentPage
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Create new userrole (Admin only)
        /// </summary>
        [HttpPost]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> Create([FromBody] CreateUserRoleRequest request)
        {
            try
            {
                // Validation
                if (string.IsNullOrWhiteSpace(request.UserRole))
                    return BadRequest(new { message = "RoleName is required" });

                var entity = new UserRole
                {
                    RoleName = request.UserRole,
                };

                await _repository.AddAsync(entity);
                return Ok(new { message = "Userrole created successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Update userrole (Admin only)
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateUserroleRequest request)
        {
            try
            {
                // Validation
                if (string.IsNullOrWhiteSpace(request.UserRole))
                    return BadRequest(new { message = "RoleName is required" });

                // Get existing entity
                var existingEntity = await _repository.GetByIdAsync(id);
                if (existingEntity == null)
                    return NotFound(new { message = "Userrole not found" });

                // Update properties
                existingEntity.RoleName = request.UserRole;

                await _repository.UpdateAsync(existingEntity);
                return Ok(new { message = "Userrole updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Delete userrole (Admin only)
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                // Get existing entity
                var existingEntity = await _repository.GetByIdAsync(id);
                if (existingEntity == null)
                    return NotFound(new { message = "Userrole not found" });

                await _repository.DeleteAsync(id);
                return Ok(new { message = "Userrole deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Delete all userrole (Admin only)
        /// </summary>
        [HttpDelete]
        [Authorize(Policy = "AdminOnly")]
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

        /// <summary>
        /// Bulk upload userrole (Admin only)
        /// </summary>
        [HttpPost("bulk-upload")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> BulkUpload([FromBody] List<CreateUserRoleRequest> dataList)
        {
            try
            {
                if (dataList == null || dataList.Count == 0)
                    return BadRequest("Data list cannot be null or empty.");

                if (dataList.Any(item => string.IsNullOrWhiteSpace(item.UserRole)))
                    return BadRequest(new { message = "One or more records have empty RoleName." });

                var entities = dataList.Select(item => new UserRole
                {
                    RoleName = item.UserRole,
                }).ToList();

                await _repository.BulkUploadAsync(entities);
                return Ok(new { message = $"Successfully uploaded {entities.Count} userrole records." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}