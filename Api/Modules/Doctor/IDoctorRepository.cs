using Medical.Api.Main;

namespace Medical.Api.Modules.Doctor
{
    public interface IDoctorRepository
    {
        Task<IEnumerable<Doctor>> GetAllAsync();
        Task<Doctor?> GetByIdAsync(long id);
        Task<Doctor?> GetByUserIdAsync(long userId);
        Task<Doctor?> GetByDepartmentIdAsync(long departmentId);
        Task<Doctor?> GetBySpecialtyIdAsync(long specialtyId);
        Task AddAsync(Doctor entity);
        Task UpdateAsync(Doctor entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<Doctor>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
