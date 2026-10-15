using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.Specialty;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SpecialtyController : ControllerBase
    {
        private readonly ISpecialtyRepository _repository;

        public SpecialtyController(ISpecialtyRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<Specialty>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<Specialty>> GetById(long id)
        {
            var spec = await _repository.GetByIdAsync(id);
            if (spec is null)
                return NotFound();

            return Ok(spec);
        }

        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        [HttpPost]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<Specialty>> Create(Specialty spec)
        {
            await _repository.AddAsync(spec);
            return CreatedAtAction(nameof(GetById), new { id = spec.SpecialtyId }, spec);
        }

        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, Specialty spec)
        {
            if (spec.SpecialtyId == 0)
                spec.SpecialtyId = id;

            if (id != spec.SpecialtyId)
                return BadRequest("Route id does not match specialty_id in request body.");

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            await _repository.UpdateAsync(spec);
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
