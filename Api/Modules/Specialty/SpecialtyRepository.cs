using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.Specialty;

namespace Medical.Api.Modules.Specialty
{
    public class SpecialtyRepository : BaseRepository, ISpecialtyRepository
    {
        public SpecialtyRepository(MyCon dbConnection) : base(dbConnection) { }

        private Specialty MapReader(DbDataReader reader)
        {
            return new Specialty
            {
                SpecialtyId = !reader.IsDBNull(reader.GetOrdinal("specialty_id")) 
                    ? Convert.ToInt64(reader["specialty_id"]) 
                    : 0,
                SpecialtyName = reader["specialty_name"]?.ToString() ?? ""
            };
        }

        public async Task<IEnumerable<Specialty>> GetAllAsync()
        {
            string sql = "SELECT specialty_id, specialty_name FROM specialization ORDER BY specialty_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Specialty?> GetByIdAsync(long id)
        {
            string sql = "SELECT specialty_id, specialty_name FROM specialization WHERE specialty_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(Specialty entity)
        {
            string sql = @"INSERT INTO specialization (specialty_name) 
                          VALUES (@specialty_name)
                          RETURNING specialty_id";

            var result = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("specialty_name", entity.SpecialtyName)
            });
            entity.SpecialtyId = result;
        }

        public async Task UpdateAsync(Specialty entity)
        {
            string sql = @"
                UPDATE specialization
                SET specialty_name = @specialty_name
                WHERE specialty_id = @specialty_id";
            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("specialty_name", entity.SpecialtyName),
                CreateParameter("specialty_id", entity.SpecialtyId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM specialization WHERE specialty_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> IsInUseAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM specialization WHERE specialty_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Specialty>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = @"
                SELECT specialty_id, specialty_name
                FROM specialization
                ORDER BY specialty_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size", pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize)
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM specialization");

            return new PaginationModel<Specialty>
            {
                Items = items.ToList(),
                TotalCount = total,
                PageSize = pageSize,
                CurrentPage = pageNumber
            };
        }
    }
}