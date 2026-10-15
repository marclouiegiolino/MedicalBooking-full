using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.JobRoles;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class JobRoleController : ControllerBase
    {
        private readonly IJobRolesRepository _repository;

        public JobRoleController(IJobRolesRepository repository)
        {
            _repository = repository;
        }

        // GET api/jobrole
        [HttpGet]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<JobRoles>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // GET api/jobrole/{id}
        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<JobRoles>> GetById(long id)
        {
            var role = await _repository.GetByIdAsync(id);
            if (role is null)
                return NotFound();

            return Ok(role);
        }

        // GET api/jobrole/paginated?pageNumber=1&pageSize=10
        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize < 1) pageSize = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // POST api/jobrole
        [HttpPost]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<JobRoles>> Create(JobRoles jobrole)
        {
            await _repository.AddAsync(jobrole);
            return CreatedAtAction(nameof(GetById), new { id = jobrole.RoleId }, jobrole);
        }

        // PUT api/jobrole/{id}
        [HttpPut("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Update(long id, JobRoles jobrole)
        {
            if (jobrole.RoleId == 0)
                jobrole.RoleId = id;

            if (id != jobrole.RoleId)
                return BadRequest("Route id does not match role_id in request body.");

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            await _repository.UpdateAsync(jobrole);
            return NoContent();
        }

        // DELETE api/jobrole/{id}
        [HttpDelete("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Delete(long id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            var inUse = await _repository.IsInUseAsync(id);
            if (inUse)
                return Conflict("Cannot delete a job role that is currently assigned to staff members.");

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}
