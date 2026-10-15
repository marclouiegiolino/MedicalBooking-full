using Medical.Api.Main;

namespace Medical.Api.Modules.Insurance
{
    public interface IInsuranceRepository
    {
        Task<IEnumerable<Insurance>> GetAllAsync();
        Task<Insurance?> GetByIdAsync(long id);
        Task<IEnumerable<Insurance>> GetByUserIdAsync(long userId);
        Task<IEnumerable<Insurance>> GetByPatientIdAsync(long patientId);
        Task AddAsync(Insurance entity);
        Task UpdateAsync(Insurance entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<Insurance>> GetPaginatedAsync(int pageNumber, int pageSize);
        Task SetPrimaryAsync(long insuranceId, long patientId);
    }
}

