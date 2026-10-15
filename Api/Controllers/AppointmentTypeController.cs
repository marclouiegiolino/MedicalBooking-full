using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.AppointmentType;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AppointmentTypeController : ControllerBase
    {
        private readonly IAppointmentTypeRepository _repository;

        public AppointmentTypeController(IAppointmentTypeRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<AppointmentType>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<AppointmentType>> GetById(long id)
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
        public async Task<ActionResult<AppointmentType>> Create(AppointmentType dept)
        {
            await _repository.AddAsync(dept);
            return CreatedAtAction(nameof(GetById), new { id = dept.AppointmentTypeId }, dept);
        }

        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, AppointmentType dept)
        {
            if (dept.AppointmentTypeId == 0)
                dept.AppointmentTypeId = id;

            if (id != dept.AppointmentTypeId)
                return BadRequest("Route id does not match appointment_type_id in request body.");

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
