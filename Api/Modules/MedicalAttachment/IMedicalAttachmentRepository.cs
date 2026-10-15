using Medical.Api.Main;

namespace Medical.Api.Modules.MedicalAttachment
{
    public interface IMedicalAttachmentRepository
    {
        Task<IEnumerable<MedicalAttachment>> GetAllAsync();
        Task<MedicalAttachment?> GetByIdAsync(long id);
        Task<List<MedicalAttachment>> GetByRequestIdAsync(long requestId);
        Task AddAsync(MedicalAttachment entity);
        Task UpdateAsync(MedicalAttachment entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<MedicalAttachment>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
