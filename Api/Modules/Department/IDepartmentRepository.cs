using Medical.Api.Main;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Medical.Api.Modules.Department
{
	public interface IDepartmentRepository
	{
		Task<IEnumerable<Department>> GetAllAsync();
		Task<Department?> GetByIdAsync(long id);
		Task AddAsync(Department entity);
		Task UpdateAsync(Department entity);
		Task DeleteAsync(long id);
		Task<bool> IsInUseAsync(long id);
		Task<PaginationModel<Department>> GetPaginatedAsync(int pageNumber, int pageSize);
	}
}
