using Medical.Api.Main;

namespace Medical.Api.Modules.MedicalInformation
{
    public interface IMedicalInfoRepository
    {
        Task<IEnumerable<MedicalInfo>> GetAllAsync();
        Task<MedicalInfo?> GetByIdAsync(long id);
        Task<MedicalInfo?> GetByUserIdAsync(long userId);
        Task<MedicalInfo?> GetByPatientIdAsync(long patientId);
        Task<bool> ExistsAsync(long id);
        Task AddAsync(MedicalInfo entity);
        Task UpdateAsync(MedicalInfo entity);
        Task DeleteAsync(long id);
        Task<PaginationModel<MedicalInfo>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
