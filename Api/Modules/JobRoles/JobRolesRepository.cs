using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.JobRoles;

namespace Medical.Api.Modules.JobRoles
{
    public class JobRoleRepository : BaseRepository, IJobRolesRepository
    {
        public JobRoleRepository(MyCon dbConnection) : base(dbConnection) { }

        private JobRoles MapReader(DbDataReader reader)
        {
            return new JobRoles
            {
                RoleId = !reader.IsDBNull(reader.GetOrdinal("role_id")) 
                    ? Convert.ToInt64(reader["role_id"]) 
                    : 0,
                RoleName = reader["role_name"]?.ToString() ?? ""
            };
        }

        public async Task<IEnumerable<JobRoles>> GetAllAsync()
        {
            string sql = "SELECT role_id, role_name FROM job_roles ORDER BY role_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<JobRoles?> GetByIdAsync(long id)
        {
            string sql = "SELECT role_id, role_name FROM job_roles WHERE role_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(JobRoles entity)
        {
            string sql = @"INSERT INTO job_roles (role_name) 
                          VALUES (@role_name)
                          RETURNING role_id";

            var result = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("role_name", entity.RoleName)
            });
            entity.RoleId = result;
        }

        public async Task UpdateAsync(JobRoles entity)
        {
            string sql = @"
                UPDATE job_roles
                SET role_name = @role_name
                WHERE role_id = @role_id";
            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("role_name", entity.RoleName),
                CreateParameter("role_id", entity.RoleId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM job_roles WHERE role_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> IsInUseAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM staff WHERE job_role_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<JobRoles>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = @"
                SELECT role_id, role_name
                FROM job_roles
                ORDER BY role_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size", pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize)
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM job_roles");

            return new PaginationModel<JobRoles>
            {
                Items = items.ToList(),
                TotalCount = total,
                PageSize = pageSize,
                CurrentPage = pageNumber
            };
        }
    }
}