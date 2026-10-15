using Medical.Api.Main;

namespace Medical.Api.Modules.Staff
{
    public interface IStaffRepository
    {
        Task<IEnumerable<Staff>> GetAllAsync();
        Task<Staff?> GetByIdAsync(long id);
        Task<Staff?> GetByGuidAsync(Guid guid);
        Task AddAsync(Staff entity);
        Task UpdateAsync(Staff entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<Staff>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
