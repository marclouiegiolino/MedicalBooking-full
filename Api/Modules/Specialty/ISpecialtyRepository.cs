using System.Collections.Generic;
using System.Threading.Tasks;
using Medical.Api.Main;

namespace Medical.Api.Modules.Specialty
{
	public interface ISpecialtyRepository
	{
		Task<IEnumerable<Specialty>> GetAllAsync();
		Task<Specialty?> GetByIdAsync(long id);
		Task AddAsync(Specialty entity);
		Task UpdateAsync(Specialty entity);
		Task DeleteAsync(long id);
		Task<bool> IsInUseAsync(long id);
		Task<PaginationModel<Specialty>> GetPaginatedAsync(int pageNumber, int pageSize);
	}
}
