using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Medical.Api.Main;

namespace Medical.Api.Modules.UserRoles
{
    public interface IUserRoleRepository
    {
        Task<IEnumerable<UserRole>> GetAllAsync();
        Task<UserRole?> GetByIdAsync(int userRoleId);
        Task DeleteAsync(int userRoleId);
        Task AddAsync(UserRole entity);
        Task UpdateAsync(UserRole entity);
        Task DeleteAllAsync();
        Task<IEnumerable<UserRole>> GetFilteredExactAsync(IReadOnlyDictionary<string, object?> filters);
        Task<IEnumerable<UserRole>> GetFilteredLikeAsync(IReadOnlyDictionary<string, object?> filters);
        Task<IEnumerable<UserRole>> SearchAsync(string query);
        Task<IEnumerable<UserRole>> SearchAsyncAll(string query);
        Task<PaginationModel<UserRole>> GetPaginatedAsync(int pageNumber, int pageSize);
        Task BulkUploadAsync(List<UserRole> dataList);
    }
}