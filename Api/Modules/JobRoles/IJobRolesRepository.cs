using Medical.Api.Main;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Medical.Api.Modules.JobRoles
{
	public interface IJobRolesRepository
	{
		Task<IEnumerable<JobRoles>> GetAllAsync();
		Task<JobRoles?> GetByIdAsync(long id);
		Task AddAsync(JobRoles entity);
		Task UpdateAsync(JobRoles entity);
		Task DeleteAsync(long id);
		Task<bool> IsInUseAsync(long id);
		Task<PaginationModel<JobRoles>> GetPaginatedAsync(int pageNumber, int pageSize);
	}
}
