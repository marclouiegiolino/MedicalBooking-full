using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using System.Data.Common;
using Medical.Api.Main;

namespace Medical.Api.Modules.User
{
    public class UserRepository : BaseRepository, IUserRepository
    {
        public UserRepository(MyCon dbConnection) : base(dbConnection) { }


        private User MapReaderToUser(DbDataReader reader)
        {
            try
            {
                return new User()
                {
                    UserId             = ReadValue<int>(reader, "user_id", 0),
                    Guid               = ReadValue<string>(reader, "guid", string.Empty),
                    UserName           = ReadValue<string>(reader, "username", string.Empty),
                    UserPass           = ReadValue<string>(reader, "password", string.Empty),
                    UserRoleId         = ReadValue<int>(reader, "role_id", 0),
                    ProfilePicturePath = ReadValue<string>(reader, "profile_picture_path", string.Empty),
                };
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "Failed to map database row to User. Check schema/type alignment for generated columns.",
                    ex);
            }
        }

        /// <summary>
        /// Retrieves all entities from the database
        /// </summary>
        public async Task<IEnumerable<User>> GetAllAsync()
        {
            return await ExecuteReaderToListAsync("SELECT * FROM users", MapReaderToUser);
        }

        /// <summary>
        /// Retrieves an entity by UserId
        /// </summary>
        public async Task<User?> GetByIdAsync(int userId)
        {
            var results = await ExecuteReaderToListAsync(
                "SELECT * FROM users WHERE user_id = @userId", 
                MapReaderToUser, 
                new[] { CreateParameter("userId", userId) });
            return results.FirstOrDefault();
        }

        /// <summary>
        /// Retrieves an entity by UserName
        /// </summary>
        public async Task<User?> GetByUserNameAsync(string userName)
        {
            var results = await ExecuteReaderToListAsync(
                "SELECT * FROM users WHERE username = @userName",
                MapReaderToUser,
                new[] { CreateParameter("userName", userName) });
            return results.FirstOrDefault();
        }


        /// <summary>
        /// Adds a new entity to the database
        /// </summary>
        public async Task AddAsync(User entity)
        {
            // Auto-generate a GUID for protection if not already set
            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = System.Guid.NewGuid().ToString();

            var sql = "INSERT INTO users (username, password, role_id, guid, profile_picture_path) VALUES (@userName, @userPass, @userRoleId, @guid, @profilePicturePath)";
            var dbParameters = new List<DbParameter>();
            dbParameters.Add(CreateParameter("userName",           entity.UserName));
            dbParameters.Add(CreateParameter("userPass",           entity.UserPass));
            dbParameters.Add(CreateParameter("userRoleId",         entity.UserRoleId));
            dbParameters.Add(CreateParameter("guid",               entity.Guid));
            dbParameters.Add(CreateParameter("profilePicturePath", string.IsNullOrWhiteSpace(entity.ProfilePicturePath) ? (object)DBNull.Value : entity.ProfilePicturePath));
            await ExecuteNonQueryAsync(sql, dbParameters.ToArray());
        }

        /// <summary>
        /// Updates an existing entity in the database
        /// </summary>
        public async Task UpdateAsync(User entity)
        {
            var sql = "UPDATE users SET username = @userName, password = @userPass, role_id = @userRoleId, profile_picture_path = @profilePicturePath WHERE user_id = @userId";
            var dbParameters = new List<DbParameter>();
            dbParameters.Add(CreateParameter("userId",             entity.UserId));
            dbParameters.Add(CreateParameter("userName",           entity.UserName));
            dbParameters.Add(CreateParameter("userPass",           entity.UserPass));
            dbParameters.Add(CreateParameter("userRoleId",         entity.UserRoleId));
            dbParameters.Add(CreateParameter("profilePicturePath", string.IsNullOrWhiteSpace(entity.ProfilePicturePath) ? (object)DBNull.Value : entity.ProfilePicturePath));
            await ExecuteNonQueryAsync(sql, dbParameters.ToArray());
        }

        /// <summary>
        /// Deletes a user and all their associated records in safe dependency order.
        /// </summary>
        public async Task DeleteAsync(int userId)
        {
            var p = new[] { CreateParameter("userId", userId) };

            await ExecuteNonQueryAsync(@"
                DELETE FROM medical_results
                WHERE request_id IN (
                    SELECT request_id FROM medical_requests
                    WHERE consultation_id IN (
                        SELECT consultation_id FROM consultations
                        WHERE doctor_id IN (SELECT doctor_id FROM doctors WHERE user_id = @userId)
                        OR patient_id = @userId
                    )
                )", p);

            await ExecuteNonQueryAsync(@"
                DELETE FROM medical_request_attachments
                WHERE request_id IN (
                    SELECT request_id FROM medical_requests
                    WHERE consultation_id IN (
                        SELECT consultation_id FROM consultations
                        WHERE doctor_id IN (SELECT doctor_id FROM doctors WHERE user_id = @userId)
                        OR patient_id = @userId
                    )
                )", p);

            // 3. Medical requests → depend on consultations
            await ExecuteNonQueryAsync(@"
                DELETE FROM medical_requests
                WHERE consultation_id IN (
                    SELECT consultation_id FROM consultations
                    WHERE doctor_id IN (SELECT doctor_id FROM doctors WHERE user_id = @userId)
                    OR patient_id = @userId
                )", p);

            // 4. Consultations
            await ExecuteNonQueryAsync(@"
                DELETE FROM consultations
                WHERE doctor_id IN (SELECT doctor_id FROM doctors WHERE user_id = @userId)
                OR patient_id = @userId", p);

            // 5. Appointments
            await ExecuteNonQueryAsync(@"
                DELETE FROM appointments
                WHERE doctor_id IN (SELECT doctor_id FROM doctors WHERE user_id = @userId)
                OR patient_id = @userId", p);

            // 6. Medical info (table is medical_infos)
            await ExecuteNonQueryAsync(@"
                DELETE FROM medical_information
                WHERE patient_id IN (SELECT patient_id FROM patients WHERE user_id = @userId)", p);

            // 7. Emergency contacts
            await ExecuteNonQueryAsync(@"
                DELETE FROM emergency_contacts
                WHERE patient_id IN (SELECT patient_id FROM patients WHERE user_id = @userId)", p);

            // 8. Insurance
            await ExecuteNonQueryAsync(@"
                DELETE FROM insurance
                WHERE patient_id IN (SELECT patient_id FROM patients WHERE user_id = @userId)", p);

            // 9. Patients
            await ExecuteNonQueryAsync("DELETE FROM patients WHERE user_id = @userId", p);

            // 10. Doctors
            await ExecuteNonQueryAsync("DELETE FROM doctors WHERE user_id = @userId", p);

            // 11. Auth / session tables
            await ExecuteNonQueryAsync("DELETE FROM login_logs WHERE user_id = @userId", p);
            await ExecuteNonQueryAsync("DELETE FROM login_attempts WHERE user_id = @userId", p);
            await ExecuteNonQueryAsync("DELETE FROM token_refresh WHERE user_id = @userId", p);

            // 12. Finally delete the user
            await ExecuteNonQueryAsync("DELETE FROM users WHERE user_id = @userId", p);
        }

        /// <summary>
        /// Deletes all entities from the database
        /// </summary>
        public async Task DeleteAllAsync()
        {
            await ExecuteNonQueryAsync("DELETE FROM users");
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


        public async Task<IEnumerable<User>> GetFilteredExactAsync(IReadOnlyDictionary<string, object?> filters)
        {
            if (filters == null || filters.Count == 0)
            {
                return await GetAllAsync();
            }

            var sqlFilters = new List<string>();
            var dbParameters = new List<DbParameter>();
            if (filters.TryGetValue("userId", out object? userIdFilter) && userIdFilter != null)
            {
                sqlFilters.Add("user_id = @userId");
                dbParameters.Add(CreateParameter("userId", userIdFilter));
            }

            IEnumerable<User> queryable = sqlFilters.Count == 0
                ? await GetAllAsync()
                : await ExecuteReaderToListAsync(
                    $"SELECT * FROM users WHERE {string.Join(" AND ", sqlFilters)}",
                    MapReaderToUser,
                    dbParameters.ToArray());
            return queryable.ToList();
        }

        public async Task<IEnumerable<User>> GetFilteredLikeAsync(IReadOnlyDictionary<string, object?> filters)
        {
            if (filters == null || filters.Count == 0)
            {
                return await GetAllAsync();
            }

            var sqlFilters = new List<string>();
            var dbParameters = new List<DbParameter>();
            string? userIdFilter = GetFilterText(filters, "userId");
            if (!string.IsNullOrWhiteSpace(userIdFilter))
            {
                string userIdPattern = "%" + userIdFilter + "%";
                sqlFilters.Add("CAST(user_id AS TEXT) LIKE @userIdPattern");
                dbParameters.Add(CreateParameter("userIdPattern", userIdPattern));
            }

            IEnumerable<User> queryable = sqlFilters.Count == 0
                ? await GetAllAsync()
                : await ExecuteReaderToListAsync(
                    $"SELECT * FROM users WHERE {string.Join(" AND ", sqlFilters)}",
                    MapReaderToUser,
                    dbParameters.ToArray());
            return queryable.ToList();
        }

        /// <summary>
        /// Searches for entities by query string
        /// </summary>
        public async Task<IEnumerable<User>> SearchAsync(string query)
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
        public async Task<IEnumerable<User>> SearchAsyncAll(string query)
        {
            var filters = new List<string>();
            filters.Add("CAST(user_id AS TEXT) LIKE @query");
            filters.Add("username LIKE @query");
            if (filters.Count == 0)
            {
                return await GetAllAsync();
            }
            string sql = $"SELECT * FROM users WHERE {string.Join(" OR ", filters)}";
            return await ExecuteReaderToListAsync(sql, MapReaderToUser, new[] { CreateParameter("query", "%" + query + "%") });
        }

        /// <summary>
        /// Retrieves a paginated list of entities
        /// </summary>
        public async Task<PaginationModel<User>> GetPaginatedAsync(int pageNumber, int pageSize)
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
                var allItems = await ExecuteReaderToListAsync("SELECT * FROM users", MapReaderToUser);
                var totalRecords = allItems.Count;
                return new PaginationModel<User>()
                {
                    Items = allItems,
                    TotalCount = totalRecords,
                    PageSize = totalRecords,
                    CurrentPage = 1
                };
            }

            string sql = "SELECT * FROM users ORDER BY user_id LIMIT @pageSize OFFSET @offset";
            var items = await ExecuteReaderToListAsync(sql, MapReaderToUser, new[]
            {
                CreateParameter("offset", (pageNumber - 1) * pageSize),
                CreateParameter("pageSize", pageSize)
            });

            var totalRecordsCount = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM users");
            return new PaginationModel<User>()
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
        public async Task BulkUploadAsync(List<User> dataList)
        {
            if (dataList == null || dataList.Count == 0) return;

            foreach (var item in dataList)
            {
                await AddAsync(item);
            }
        }
    }
}