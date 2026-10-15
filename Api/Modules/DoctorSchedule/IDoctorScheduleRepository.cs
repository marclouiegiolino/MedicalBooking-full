using Medical.Api.Main;

namespace Medical.Api.Modules.DoctorSchedule
{
    public interface IDoctorScheduleRepository
    {
        Task<IEnumerable<DoctorSchedule>> GetAllAsync();
        Task<DoctorSchedule?> GetByIdAsync(long id);
        Task<List<DoctorSchedule>> GetByDoctorIdAsync(long doctorId);
        Task AddAsync(DoctorSchedule entity);
        Task UpdateAsync(DoctorSchedule entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<DoctorSchedule>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
