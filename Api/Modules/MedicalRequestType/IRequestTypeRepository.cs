using Medical.Api.Main;

namespace Medical.Api.Modules.MedicalRequestType
{
    public interface IMedicalRequestTypeRepository
    {
        Task<IEnumerable<RequestType>> GetAllAsync();
        Task<RequestType?> GetByIdAsync(long id);
        Task AddAsync(RequestType entity);
        Task UpdateAsync(RequestType entity);
        Task DeleteAsync(long id);
        Task<bool> IsInUseAsync(long id);
        Task<PaginationModel<RequestType>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}