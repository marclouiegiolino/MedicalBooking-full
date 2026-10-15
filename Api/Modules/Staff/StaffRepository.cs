using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.Staff;

namespace Medical.Api.Modules.Staff
{
    public class StaffRepository : BaseRepository, IStaffRepository
    {
        public StaffRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                s.staff_id,
                s.user_id,
                s.guid,
                s.department_id,
                s.access_id,
                s.job_role_id AS role_id,
                s.employee_no,
                s.first_name,
                s.middle_name,
                s.last_name,
                s.created_at,
                s.updated_at,
                u.profile_picture_path
            FROM staff s
            LEFT JOIN users u ON u.user_id = s.user_id
            LEFT JOIN departments   dep ON dep.department_id = s.department_id
            LEFT JOIN access_level  al  ON al.role_id        = s.access_id
            LEFT JOIN job_roles     jr  ON jr.role_id        = s.job_role_id";

        private Staff MapReader(DbDataReader reader)
        {
            return new Staff
            {
                StaffId            = ReadValue(reader, "staff_id",             0L),
                UserId             = ReadValue(reader, "user_id",              0L),
                Guid               = ReadValue(reader, "guid",                 string.Empty),
                DepartmentId       = reader.IsDBNull(reader.GetOrdinal("department_id"))
                                        ? (long?)null
                                        : Convert.ToInt64(reader["department_id"]),
                AccessId           = ReadValue(reader, "access_id",            0L),
                RoleId             = ReadValue(reader, "role_id",              0L),
                EmployeeNumber     = ReadValue(reader, "employee_no",          string.Empty),
                FirstName          = ReadValue(reader, "first_name",           string.Empty),
                MiddleName         = ReadValue(reader, "middle_name",          string.Empty),
                LastName           = ReadValue(reader, "last_name",            string.Empty),
                CreatedAt          = ReadValue(reader, "created_at",           string.Empty),
                UpdatedAt          = ReadValue(reader, "updated_at",           string.Empty),
                ProfilePicturePath = ReadValue(reader, "profile_picture_path", string.Empty),
            };
        }

        public async Task<IEnumerable<Staff>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY s.last_name, s.first_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Staff?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE s.staff_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<Staff?> GetByGuidAsync(Guid guid)
        {
            string sql = BaseSelect + " WHERE s.guid = @guid";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("guid", guid.ToString()) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(Staff entity)
        {
            string sql = @"
                INSERT INTO staff (user_id, guid, job_role_id, department_id, access_id, employee_no, first_name, middle_name, last_name, created_at, updated_at)
                VALUES (@user_id, @guid, @job_role_id, @department_id, @access_id, @employee_no, @first_name, @middle_name, @last_name, @created_at, @updated_at)
                RETURNING staff_id";

            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = System.Guid.NewGuid().ToString();

            if (string.IsNullOrWhiteSpace(entity.CreatedAt))
                entity.CreatedAt = DateTime.UtcNow.ToString("o");

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("user_id",       entity.UserId),
                CreateParameter("guid",          entity.Guid),
                CreateParameter("job_role_id",   entity.RoleId),
                CreateParameter("department_id", (object?)entity.DepartmentId ?? DBNull.Value),
                CreateParameter("access_id",     entity.AccessId),
                CreateParameter("employee_no",   entity.EmployeeNumber),
                CreateParameter("first_name",    entity.FirstName),
                CreateParameter("middle_name",   entity.MiddleName),
                CreateParameter("last_name",     entity.LastName),
                CreateParameter("created_at",    entity.CreatedAt),
                CreateParameter("updated_at",    (object?)entity.UpdatedAt ?? DBNull.Value),
            });

            entity.StaffId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(Staff entity)
        {
            entity.UpdatedAt = DateTime.UtcNow.ToString("o");

            string sql = @"
                UPDATE staff
                SET user_id       = @user_id,
                    guid          = @guid,
                    job_role_id   = @job_role_id,
                    department_id = @department_id,
                    access_id     = @access_id,
                    employee_no   = @employee_no,
                    first_name    = @first_name,
                    middle_name   = @middle_name,
                    last_name     = @last_name,
                    updated_at    = @updated_at
                WHERE staff_id = @staff_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("user_id",       entity.UserId),
                CreateParameter("guid",          entity.Guid),
                CreateParameter("job_role_id",   entity.RoleId),
                CreateParameter("department_id", (object?)entity.DepartmentId ?? DBNull.Value),
                CreateParameter("access_id",     entity.AccessId),
                CreateParameter("employee_no",   entity.EmployeeNumber),
                CreateParameter("first_name",    entity.FirstName),
                CreateParameter("middle_name",   entity.MiddleName),
                CreateParameter("last_name",     entity.LastName),
                CreateParameter("updated_at",    entity.UpdatedAt),
                CreateParameter("staff_id",      entity.StaffId),
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM staff WHERE staff_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM staff WHERE staff_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Staff>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY s.last_name, s.first_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int? totalNullable = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM staff");
            int total = totalNullable.GetValueOrDefault();

            return new PaginationModel<Staff>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
