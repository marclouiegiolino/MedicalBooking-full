using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.MedicalRequestType;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Route("api/requesttypes")]
    [Route("api/medicalrequesttype")]
    [Route("api/medicalrequesttypes")]
    [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
    public class RequestTypeController : ControllerBase
    {
        private readonly IMedicalRequestTypeRepository _repository;

        public RequestTypeController(IMedicalRequestTypeRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<RequestType>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<RequestType>> GetById(long id)
        {
            var type = await _repository.GetByIdAsync(id);
            if (type is null)
                return NotFound();

            return Ok(type);
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
        public async Task<ActionResult<RequestType>> Create(RequestType type)
        {
            await _repository.AddAsync(type);
            return CreatedAtAction(nameof(GetById), new { id = type.RequestTypeId }, type);
        }

        [HttpPut("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Update(long id, RequestType type)
        {
            if (type.RequestTypeId == 0)
                type.RequestTypeId = id;

            if (id != type.RequestTypeId)
                return BadRequest("Route id does not match request_type_id in request body.");

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            await _repository.UpdateAsync(type);
            return NoContent();
        }

        [HttpDelete("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
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
