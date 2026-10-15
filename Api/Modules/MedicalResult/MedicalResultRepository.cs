using System.Data.Common;
using Medical.Api.Main;

namespace Medical.Api.Modules.MedicalResult
{
    public class MedicalResultRepository : BaseRepository, IMedicalResultRepository
    {
        public MedicalResultRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                mr.result_id,
                mr.guid,
                mr.request_id,
                mr.result_notes,
                mr.result_file_path,
                mr.uploaded_by_user_id,
                mr.uploaded_at
            FROM medical_results mr
        ";

        private MedicalResult MapReader(DbDataReader reader)
        {
            return new MedicalResult
            {
                ResultId         = ReadValue(reader, "result_id",          0L),
                Guid             = ReadValue(reader, "guid",               string.Empty),
                RequestId        = ReadValue(reader, "request_id",         0L),
                ResultNotes      = ReadValue(reader, "result_notes",       (string?)null),
                ResultFilePath   = ReadValue(reader, "result_file_path",   (string?)null),
                UploadedByUserId = ReadValue(reader, "uploaded_by_user_id", 0L),
                UploadedAt       = ReadValue(reader, "uploaded_at",        (string?)null),
            };
        }

        public async Task<IEnumerable<MedicalResult>> GetAllAsync()
        {
            string sql = BaseSelect + "ORDER BY mr.result_id";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<MedicalResult?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + "WHERE mr.result_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<List<MedicalResult>> GetByRequestIdAsync(long requestId)
        {
            string sql = BaseSelect + "WHERE mr.request_id = @requestId ORDER BY mr.result_id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("requestId", requestId) });
            return items.ToList();
        }

        public async Task<List<MedicalResult>> GetByUploadedByUserIdAsync(long userId)
        {
            string sql = BaseSelect + "WHERE mr.uploaded_by_user_id = @userId ORDER BY mr.result_id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("userId", userId) });
            return items.ToList();
        }

        public async Task AddAsync(MedicalResult entity)
        {
            string sql = @"
                INSERT INTO medical_results
                    (guid, request_id, result_notes, result_file_path, uploaded_by_user_id, uploaded_at)
                VALUES
                    (@guid, @request_id, @result_notes, @result_file_path, @uploaded_by_user_id, @uploaded_at)
                RETURNING result_id";

            // Auto-generate GUID if not set
            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = System.Guid.NewGuid().ToString();

            entity.UploadedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("guid",                entity.Guid),
                CreateParameter("request_id",          entity.RequestId),
                CreateParameter("result_notes",        entity.ResultNotes),
                CreateParameter("result_file_path",    entity.ResultFilePath),
                CreateParameter("uploaded_by_user_id", entity.UploadedByUserId),
                CreateParameter("uploaded_at",         entity.UploadedAt),
            });

            entity.ResultId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(MedicalResult entity)
        {
            string sql = @"
                UPDATE medical_results
                SET request_id          = @request_id,
                    result_notes        = @result_notes,
                    result_file_path    = @result_file_path,
                    uploaded_by_user_id = @uploaded_by_user_id,
                    uploaded_at         = @uploaded_at
                WHERE result_id = @result_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("request_id",          entity.RequestId),
                CreateParameter("result_notes",        entity.ResultNotes),
                CreateParameter("result_file_path",    entity.ResultFilePath),
                CreateParameter("uploaded_by_user_id", entity.UploadedByUserId),
                CreateParameter("uploaded_at",         entity.UploadedAt),
                CreateParameter("result_id",           entity.ResultId),
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM medical_results WHERE result_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM medical_results WHERE result_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<MedicalResult>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY mr.result_id
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int? totalNullable = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM medical_results");
            int  total         = totalNullable.GetValueOrDefault();

            return new PaginationModel<MedicalResult>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
