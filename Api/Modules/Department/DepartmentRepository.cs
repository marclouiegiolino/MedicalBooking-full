using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.Department;

namespace Medical.Api.Modules.Department
{
    public class DepartmentRepository : BaseRepository, IDepartmentRepository
    {
        public DepartmentRepository(MyCon dbConnection) : base(dbConnection) { }

        private Department MapReader(DbDataReader reader)
        {
            return new Department
            {
                DepartmentId   = !reader.IsDBNull(reader.GetOrdinal("department_id")) 
                    ? Convert.ToInt64(reader["department_id"]) : 0,
                DepartmentName = reader["department_name"]?.ToString() ?? ""
            };
        }

        public async Task<IEnumerable<Department>> GetAllAsync()
        {
            string sql = "SELECT department_id, department_name FROM departments ORDER BY department_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Department?> GetByIdAsync(long id)
        {
            string sql = "SELECT department_id, department_name FROM departments WHERE department_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(Department entity)
        {
            string sql = @"INSERT INTO departments (department_name) 
                          VALUES (@department_name)
                          RETURNING department_id";

            var result = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("department_name", entity.DepartmentName)
            });
            entity.DepartmentId = result;
        }

        public async Task UpdateAsync(Department entity)
        {
            string sql = @"
                UPDATE departments
                SET department_name = @department_name
                WHERE department_id = @department_id";
            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("department_name", entity.DepartmentName),
                CreateParameter("department_id", entity.DepartmentId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM departments WHERE department_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> IsInUseAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM departments WHERE department_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Department>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = @"
                SELECT department_id, department_name
                FROM departments
                ORDER BY department_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size", pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize)
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM departments");

            return new PaginationModel<Department>
            {
                Items = items.ToList(),
                TotalCount = total,
                PageSize = pageSize,
                CurrentPage = pageNumber
            };
        }
    }
}