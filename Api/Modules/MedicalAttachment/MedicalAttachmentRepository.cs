using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.MedicalAttachment;

namespace Medical.Api.Modules.MedicalAttachment
{
    public class MedicalAttachmentRepository : BaseRepository, IMedicalAttachmentRepository
    {
        public MedicalAttachmentRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                ma.attachment_id,
                ma.guid,
                ma.request_id,
                ma.file_name,
                ma.file_path,
                ma.uploaded_at
            FROM medical_request_attachments ma
            LEFT JOIN medical_requests mr ON mr.request_id = ma.request_id
        ";

        private MedicalAttachment MapReader(DbDataReader reader)
        {
            return new MedicalAttachment
            {
                AttachmentId = ReadValue(reader, "attachment_id", 0L),
                Guid         = ReadValue(reader, "guid",          string.Empty),
                RequestId    = ReadValue(reader, "request_id",    0L),
                FileName     = ReadValue(reader, "file_name",     string.Empty),
                FilePath     = ReadValue(reader, "file_path",     string.Empty),
                UploadedAt   = ReadValue(reader, "uploaded_at",   string.Empty),
            };
        }

        public async Task<IEnumerable<MedicalAttachment>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY ma.file_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<MedicalAttachment?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE ma.attachment_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<List<MedicalAttachment>> GetByRequestIdAsync(long requestId)
        {
            string sql = BaseSelect + " WHERE ma.request_id = @requestId ORDER BY ma.file_name";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("requestId", requestId) });
            return items.ToList();
        }

        public async Task AddAsync(MedicalAttachment entity)
        {
            // Auto-generate a GUID if not provided
            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = System.Guid.NewGuid().ToString();

            string sql = @"
                INSERT INTO medical_request_attachments (guid, request_id, file_name, file_path, uploaded_at)
                VALUES (@guid, @request_id, @file_name, @file_path, @uploaded_at)
                RETURNING attachment_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("guid",       entity.Guid),
                CreateParameter("request_id", entity.RequestId),
                CreateParameter("file_name",  entity.FileName),
                CreateParameter("file_path",  entity.FilePath),
                CreateParameter("uploaded_at",entity.UploadedAt),
            });

            entity.AttachmentId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(MedicalAttachment entity)
        {
            string sql = @"
                UPDATE medical_request_attachments
                SET request_id   = @request_id,
                    file_name   = @file_name,
                    file_path    = @file_path,
                    uploaded_at = @uploaded_at
                WHERE attachment_id = @attachment_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("request_id",   entity.RequestId),
                CreateParameter("file_name",   entity.FileName),
                CreateParameter("file_path",    entity.FilePath),
                CreateParameter("uploaded_at", entity.UploadedAt),
                CreateParameter("attachment_id",   entity.AttachmentId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM medical_request_attachments WHERE attachment_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM medical_request_attachments WHERE attachment_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<MedicalAttachment>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY ma.file_name, ma.uploaded_at
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM medical_request_attachments");

            return new PaginationModel<MedicalAttachment>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
