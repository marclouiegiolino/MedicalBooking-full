using Medical.Api.Main;

namespace Medical.Api.Modules.EmergencyContact
{
    public interface IEmergencyContactRepository
    {
        Task<IEnumerable<EmergencyContact>> GetAllAsync();
        Task<EmergencyContact?> GetByIdAsync(long id);
        Task<IEnumerable<EmergencyContact>> GetByUserIdAsync(long userId);
        Task<List<EmergencyContact>> GetByPatientIdAsync(long patientId);
        Task AddAsync(EmergencyContact entity);
        Task UpdateAsync(EmergencyContact entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<EmergencyContact>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
