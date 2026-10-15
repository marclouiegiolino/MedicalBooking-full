using Medical.Api.Main;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Medical.Api.Modules.AppointmentType
{
	public interface IAppointmentTypeRepository
	{
		Task<IEnumerable<AppointmentType>> GetAllAsync();
		Task<AppointmentType?> GetByIdAsync(long id);
		Task AddAsync(AppointmentType entity);
		Task UpdateAsync(AppointmentType entity);
		Task DeleteAsync(long id);
		Task<bool> IsInUseAsync(long id);
		Task<PaginationModel<AppointmentType>> GetPaginatedAsync(int pageNumber, int pageSize);
	}
}
