using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Medical.Api.Main;

namespace Medical.Api.Modules.User
{
    public interface IUserRepository
    {
        Task<IEnumerable<User>> GetAllAsync();
        Task<User?> GetByIdAsync(int userId);
        Task DeleteAsync(int userId);
        Task AddAsync(User entity);
        Task UpdateAsync(User entity);
        Task<User?> GetByUserNameAsync(string userName);
        Task DeleteAllAsync();
        Task<IEnumerable<User>> GetFilteredExactAsync(IReadOnlyDictionary<string, object?> filters);
        Task<IEnumerable<User>> GetFilteredLikeAsync(IReadOnlyDictionary<string, object?> filters);
        Task<IEnumerable<User>> SearchAsync(string query);
        Task<IEnumerable<User>> SearchAsyncAll(string query);
        Task<PaginationModel<User>> GetPaginatedAsync(int pageNumber, int pageSize);
        Task BulkUploadAsync(List<User> dataList);
    }
}