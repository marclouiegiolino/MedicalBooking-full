using Medical.Api.Main;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Medical.Api.Modules.HospitalInformation
{
	public interface IHospitalInformationRepository
	{
		Task<IEnumerable<HospitalInformation>> GetAllAsync();
		Task<HospitalInformation?> GetByIdAsync(long id);
		Task AddAsync(HospitalInformation entity);
		Task UpdateAsync(HospitalInformation entity);
		Task DeleteAsync(long id);
		Task<bool> IsInUseAsync(long id);
		Task<PaginationModel<HospitalInformation>> GetPaginatedAsync(int pageNumber, int pageSize);
		Task<IEnumerable<HospitalInformation>> GetNearbyAsync(double latitude, double longitude, double radiusKm);
	}
}
