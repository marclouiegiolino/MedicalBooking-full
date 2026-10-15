using Medical.Api.Main;

namespace Medical.Api.Modules.MedicalResult
{
    public interface IMedicalResultRepository
    {
        Task<IEnumerable<MedicalResult>> GetAllAsync();
        Task<MedicalResult?> GetByIdAsync(long id);
        Task<List<MedicalResult>> GetByRequestIdAsync(long requestId);
        /// <summary>Returns all results uploaded by a given user (Lab/Radiology staff).</summary>
        Task<List<MedicalResult>> GetByUploadedByUserIdAsync(long userId);
        Task AddAsync(MedicalResult entity);
        Task UpdateAsync(MedicalResult entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<MedicalResult>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
