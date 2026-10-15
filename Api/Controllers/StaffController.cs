using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.Staff;
using Medical.Api.Modules.Department;
using Medical.Api.Modules.JobRoles;
using Medical.Api.Modules.User;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class StaffController : ControllerBase
    {
        private readonly IStaffRepository     _repository;
        private readonly IDepartmentRepository _departmentRepository;
        private readonly IJobRolesRepository   _jobRoleRepository;
        private readonly IUserRepository       _userRepository;

        public StaffController(
            IStaffRepository     repository,
            IDepartmentRepository departmentRepository,
            IJobRolesRepository   jobRoleRepository,
            IUserRepository       userRepository)
        {
            _repository           = repository;
            _departmentRepository = departmentRepository;
            _jobRoleRepository    = jobRoleRepository;
            _userRepository       = userRepository;
        }

        // GET api/staff
        [HttpGet]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<IEnumerable<Staff>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        // GET api/staff/{id}
        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<Staff>> GetById(long id)
        {
            var staff = await _repository.GetByIdAsync(id);
            if (staff is null)
                return NotFound();

            return Ok(staff);
        }

        // GET api/staff/paginated?pageNumber=1&pageSize=10
        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize  < 1) pageSize  = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        // POST api/staff
        [HttpPost]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<Staff>> Create(Staff staff)
        {
            // Validate user_id FK
            if (staff.UserId <= 0)
                return BadRequest("user_id is required and must be greater than 0.");

            var user = await _userRepository.GetByIdAsync((int)staff.UserId);
            if (user is null)
                return BadRequest($"User with ID {staff.UserId} does not exist.");

            // Validate job_role_id FK
            if (staff.RoleId <= 0)
                return BadRequest("role_id (job_role_id) is required and must be greater than 0.");

            var role = await _jobRoleRepository.GetByIdAsync(staff.RoleId);
            if (role is null)
                return BadRequest($"Job role with ID {staff.RoleId} does not exist.");

            // Validate department_id FK (optional — NULL is allowed)
            if (staff.DepartmentId.HasValue && staff.DepartmentId.Value > 0)
            {
                var department = await _departmentRepository.GetByIdAsync(staff.DepartmentId.Value);
                if (department is null)
                    return BadRequest($"Department with ID {staff.DepartmentId} does not exist.");
            }

            await _repository.AddAsync(staff);
            return CreatedAtAction(nameof(GetById), new { id = staff.StaffId }, staff);
        }

        // PUT api/staff/{id}
        [HttpPut("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Update(long id, Staff staff)
        {
            if (staff.StaffId == 0)
                staff.StaffId = id;

            if (id != staff.StaffId)
                return BadRequest("Route id does not match staff_id in request body.");

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            // Validate user_id FK
            if (staff.UserId <= 0)
                return BadRequest("user_id is required and must be greater than 0.");

            var user = await _userRepository.GetByIdAsync((int)staff.UserId);
            if (user is null)
                return BadRequest($"User with ID {staff.UserId} does not exist.");

            // Validate job_role_id FK
            if (staff.RoleId <= 0)
                return BadRequest("role_id (job_role_id) is required and must be greater than 0.");

            var role = await _jobRoleRepository.GetByIdAsync(staff.RoleId);
            if (role is null)
                return BadRequest($"Job role with ID {staff.RoleId} does not exist.");

            // Validate department_id FK (optional — NULL is allowed)
            if (staff.DepartmentId.HasValue && staff.DepartmentId.Value > 0)
            {
                var department = await _departmentRepository.GetByIdAsync(staff.DepartmentId.Value);
                if (department is null)
                    return BadRequest($"Department with ID {staff.DepartmentId} does not exist.");
            }

            await _repository.UpdateAsync(staff);
            return NoContent();
        }

        // DELETE api/staff/{id}
        [HttpDelete("{id:long}")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Delete(long id)
        {
            var exists = await _repository.ExistsAsync(id);
            if (!exists)
                return NotFound();

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}
