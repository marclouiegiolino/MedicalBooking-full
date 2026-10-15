using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using System.Data.Common;
using Medical.Api.Main;

namespace Medical.Api.Modules.UserRoles
{
    public class UserRoleRepository : BaseRepository, IUserRoleRepository
    {
        public UserRoleRepository(MyCon dbConnection) : base(dbConnection) { }


        private UserRole MapReaderToUserRole(DbDataReader reader)
        {
            try
            {
                return new UserRole()
                {
                    UserRoleId = ReadValue<int>(reader, "role_id", 0),
                    RoleName = ReadValue<string>(reader, "role_name", string.Empty),
                };
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "Failed to map database row to UserRole. Check schema/type alignment for generated columns.",
                    ex);
            }
        }

        /// <summary>
        /// Retrieves all entities from the database
        /// </summary>
        public async Task<IEnumerable<UserRole>> GetAllAsync()
        {
            return await ExecuteReaderToListAsync("SELECT * FROM access_level", MapReaderToUserRole);
        }

        /// <summary>
        /// Retrieves an entity by UserRoleId
        /// </summary>
        public async Task<UserRole?> GetByIdAsync(int userRoleId)
        {
            var results = await ExecuteReaderToListAsync(
                "SELECT * FROM access_level WHERE role_id = @userRoleId", 
                MapReaderToUserRole, 
                new[] { CreateParameter("userRoleId", userRoleId) });
            return results.FirstOrDefault();
        }


        /// <summary>
        /// Adds a new entity to the database
        /// </summary>
        public async Task AddAsync(UserRole entity)
        {
            var sql = "INSERT INTO access_level (role_name) VALUES (@userRole)";
            var dbParameters = new List<DbParameter>();
            dbParameters.Add(CreateParameter("userRole", entity.RoleName));
            await ExecuteNonQueryAsync(sql, dbParameters.ToArray());
        }

        /// <summary>
        /// Updates an existing entity in the database
        /// </summary>
        public async Task UpdateAsync(UserRole entity)
        {
            var sql = "UPDATE access_level SET role_name = @userRole WHERE role_id = @userRoleId";
            var dbParameters = new List<DbParameter>();
            dbParameters.Add(CreateParameter("userRoleId", entity.UserRoleId));
            dbParameters.Add(CreateParameter("userRole", entity.RoleName));
            await ExecuteNonQueryAsync(sql, dbParameters.ToArray());
        }

        /// <summary>
        /// Deletes an entity from the database by its UserRoleId
        /// </summary>
        public async Task DeleteAsync(int userRoleId)
        {
            await ExecuteNonQueryAsync("DELETE FROM access_level WHERE role_id = @userRoleId", new[] { CreateParameter("userRoleId", userRoleId) });
        }

        /// <summary>
        /// Deletes all entities from the database
        /// </summary>
        public async Task DeleteAllAsync()
        {
            await ExecuteNonQueryAsync("DELETE FROM access_level");
        }

        private static int? GetFilterInt(IReadOnlyDictionary<string, object?> filters, string key)
        {
            if (!filters.TryGetValue(key, out object? rawValue) || rawValue == null)
            {
                return null;
            }

            if (rawValue is int intValue)
            {
                return intValue;
            }

            string text = Convert.ToString(rawValue, CultureInfo.InvariantCulture) ?? string.Empty;
            return int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out int parsed)
                ? parsed
                : null;
        }

        private static string? GetFilterText(IReadOnlyDictionary<string, object?> filters, string key)
        {
            if (!filters.TryGetValue(key, out object? rawValue) || rawValue == null)
            {
                return null;
            }

            string text = (Convert.ToString(rawValue, CultureInfo.InvariantCulture) ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }

        private static bool TryParseTimeToken(string value, out TimeSpan parsedTime, out bool hasSeconds)
        {
            parsedTime = default;
            hasSeconds = false;

            string normalized = value.Trim();
            if (TimeSpan.TryParseExact(normalized, "hh\\:mm\\:ss", CultureInfo.InvariantCulture, out parsedTime))
            {
                hasSeconds = true;
                return true;
            }

            return TimeSpan.TryParseExact(normalized, "hh\\:mm", CultureInfo.InvariantCulture, out parsedTime);
        }


        public async Task<IEnumerable<UserRole>> GetFilteredExactAsync(IReadOnlyDictionary<string, object?> filters)
        {
            if (filters == null || filters.Count == 0)
            {
                return await GetAllAsync();
            }

            var sqlFilters = new List<string>();
            var dbParameters = new List<DbParameter>();
            if (filters.TryGetValue("userRoleId", out object? userRoleIdFilter) && userRoleIdFilter != null)
            {
                sqlFilters.Add("role_id = @userRoleId");
                dbParameters.Add(CreateParameter("userRoleId", userRoleIdFilter));
            }

            IEnumerable<UserRole> queryable = sqlFilters.Count == 0
                ? await GetAllAsync()
                : await ExecuteReaderToListAsync(
                    $"SELECT * FROM access_level WHERE {string.Join(" AND ", sqlFilters)}",
                    MapReaderToUserRole,
                    dbParameters.ToArray());
            return queryable.ToList();
        }

        public async Task<IEnumerable<UserRole>> GetFilteredLikeAsync(IReadOnlyDictionary<string, object?> filters)
        {
            if (filters == null || filters.Count == 0)
            {
                return await GetAllAsync();
            }

            var sqlFilters = new List<string>();
            var dbParameters = new List<DbParameter>();
            string? userRoleIdFilter = GetFilterText(filters, "userRoleId");
            if (!string.IsNullOrWhiteSpace(userRoleIdFilter))
            {
                string userRoleIdPattern = "%" + userRoleIdFilter + "%";
                sqlFilters.Add("CAST(role_id AS TEXT) LIKE @userRoleIdPattern");
                dbParameters.Add(CreateParameter("userRoleIdPattern", userRoleIdPattern));
            }

            IEnumerable<UserRole> queryable = sqlFilters.Count == 0
                ? await GetAllAsync()
                : await ExecuteReaderToListAsync(
                    $"SELECT * FROM access_level WHERE {string.Join(" AND ", sqlFilters)}",
                    MapReaderToUserRole,
                    dbParameters.ToArray());
            return queryable.ToList();
        }

        /// <summary>
        /// Searches for entities by query string
        /// </summary>
        public async Task<IEnumerable<UserRole>> SearchAsync(string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return await GetAllAsync();
            }
            return await SearchAsyncAll(query);
        }

        /// <summary>
        /// Searches for entities by all column
        /// </summary>
        public async Task<IEnumerable<UserRole>> SearchAsyncAll(string query)
        {
            var filters = new List<string>();
            filters.Add("CAST(role_id AS TEXT) LIKE @query");
            filters.Add("role_name LIKE @query");
            if (filters.Count == 0)
            {
                return await GetAllAsync();
            }
            string sql = $"SELECT * FROM access_level WHERE {string.Join(" OR ", filters)}";
            return await ExecuteReaderToListAsync(sql, MapReaderToUserRole, new[] { CreateParameter("query", "%" + query + "%") });
        }

        /// <summary>
        /// Retrieves a paginated list of entities
        /// </summary>
        public async Task<PaginationModel<UserRole>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            if (pageNumber <= 0)
            {
                pageNumber = 1;
            }

            if (pageSize < 0)
            {
                pageSize = 0;
            }

            if (pageSize <= 0)
            {
                var allItems = await ExecuteReaderToListAsync("SELECT * FROM access_level", MapReaderToUserRole);
                var totalRecords = allItems.Count;
                return new PaginationModel<UserRole>()
                {
                    Items = allItems,
                    TotalCount = totalRecords,
                    PageSize = totalRecords,
                    CurrentPage = 1
                };
            }

            string sql = "SELECT * FROM access_level ORDER BY role_id LIMIT @pageSize OFFSET @offset";
            var items = await ExecuteReaderToListAsync(sql, MapReaderToUserRole, new[]
            {
                CreateParameter("offset", (pageNumber - 1) * pageSize),
                CreateParameter("pageSize", pageSize)
            });

            var totalRecordsCount = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM access_level");
            return new PaginationModel<UserRole>()
            {
                Items = items,
                TotalCount = totalRecordsCount,
                PageSize = pageSize,
                CurrentPage = pageNumber
            };
        }

        /// <summary>
        /// Uploads data from a list to the database.
        /// </summary>
        public async Task BulkUploadAsync(List<UserRole> dataList)
        {
            if (dataList == null || dataList.Count == 0) return;

            foreach (var item in dataList)
            {
                await AddAsync(item);
            }
        }
    }
}