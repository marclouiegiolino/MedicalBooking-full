using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.Department;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DepartmentController : ControllerBase
    {
        private readonly IDepartmentRepository _repository;

        public DepartmentController(IDepartmentRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<Department>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<Department>> GetById(long id)
        {
            var dept = await _repository.GetByIdAsync(id);
            if (dept is null)
                return NotFound();

            return Ok(dept);
        }

        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize < 1) pageSize = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        [HttpPost]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<Department>> Create(Department dept)
        {
            await _repository.AddAsync(dept);
            return CreatedAtAction(nameof(GetById), new { id = dept.DepartmentId }, dept);
        }

        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, Department dept)
        {
            if (dept.DepartmentId == 0)
                dept.DepartmentId = id;

            if (id != dept.DepartmentId)
                return BadRequest("Route id does not match department_id in request body.");

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            await _repository.UpdateAsync(dept);
            return NoContent();
        }

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}
