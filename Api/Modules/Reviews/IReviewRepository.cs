using Medical.Api.Main;

namespace Medical.Api.Modules.Review
{
    public interface IReviewRepository
    {
        Task<IEnumerable<Review>> GetAllAsync();
        Task<Review?> GetByIdAsync(long id);
        Task<Review?> GetByReviewIdAsync(long reviewId);
        Task AddAsync(Review entity);
        Task UpdateAsync(Review entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<Review>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
