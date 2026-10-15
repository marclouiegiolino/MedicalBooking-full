using System.Data.Common;
using Medical.Api.Main;

namespace Medical.Api.Modules.MedicalRequestType
{
    public class RequestTypeRepository : BaseRepository, IMedicalRequestTypeRepository
    {
        public RequestTypeRepository(MyCon dbConnection) : base(dbConnection) { }

        private RequestType MapReader(DbDataReader reader)
        {
            return new RequestType
            {
                RequestTypeId = !reader.IsDBNull(reader.GetOrdinal("request_type_id"))
                    ? Convert.ToInt64(reader["request_type_id"])
                    : 0L,
                RequestName = reader["request_name"]?.ToString() ?? string.Empty,
            };
        }

        private static bool _seeded = false;

        private async Task EnsureSeededAsync()
        {
            if (_seeded) return;
            try
            {
                var existing = await ExecuteReaderToListAsync("SELECT request_name FROM medical_request_types", r => r["request_name"]?.ToString() ?? string.Empty);
                var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
                var required = new[] { "Laboratory", "Imaging", "Cardiology-ECG", "2D Echo", "Medical Certificate", "Referral Letter" };
                foreach (var req in required)
                {
                    if (!existingSet.Contains(req))
                    {
                        try
                        {
                            await ExecuteNonQueryAsync("INSERT INTO medical_request_types (request_name) VALUES (@req)", new[] { CreateParameter("req", req) });
                        }
                        catch { /* handle duplicate race condition gracefully */ }
                    }
                }
                _seeded = true;
            }
            catch { }
        }

        public async Task<IEnumerable<RequestType>> GetAllAsync()
        {
            await EnsureSeededAsync();
            string sql = "SELECT request_type_id, request_name FROM medical_request_types ORDER BY request_type_id ASC";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<RequestType?> GetByIdAsync(long id)
        {
            string sql = "SELECT request_type_id, request_name FROM medical_request_types WHERE request_type_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(RequestType entity)
        {
            string sql = @"INSERT INTO medical_request_types (request_name)
                           VALUES (@request_name)
                           RETURNING request_type_id";
            long? newId = await ExecuteScalarAsync<long>(sql,
                new[] { CreateParameter("request_name", entity.RequestName) });
            entity.RequestTypeId = newId ?? 0L;
        }

        public async Task UpdateAsync(RequestType entity)
        {
            string sql = @"
                UPDATE medical_request_types
                SET request_name = @request_name
                WHERE request_type_id = @request_type_id";
            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("request_name",    entity.RequestName),
                CreateParameter("request_type_id", entity.RequestTypeId),
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM medical_request_types WHERE request_type_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> IsInUseAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM medical_requests WHERE request_type_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<RequestType>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = @"
                SELECT request_type_id, request_name
                FROM medical_request_types
                ORDER BY request_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int? totalNullable = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM medical_request_types");

            return new PaginationModel<RequestType>
            {
                Items       = items.ToList(),
                TotalCount  = totalNullable.GetValueOrDefault(),
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
