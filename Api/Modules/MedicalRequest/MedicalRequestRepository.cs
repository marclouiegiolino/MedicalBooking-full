using System.Data.Common;
using Medical.Api.Main;

namespace Medical.Api.Modules.MedicalRequest
{
    public class MedicalRequestRepository : BaseRepository, IMedicalRequestRepository
    {
        public MedicalRequestRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                mr.request_id,
                mr.guid,
                mr.consultation_id,
                mr.patient_id,
                mr.doctor_id,
                mr.request_type_id,
                mr.status_id,
                mr.notes,
                mr.created_at,
                mr.updated_at,
                mr.is_deleted,
                mr.deleted_at,
                rt.request_name AS request_type_name
            FROM medical_requests mr
            LEFT JOIN patients             p  ON p.patient_id          = mr.patient_id
            LEFT JOIN doctors              d  ON d.doctor_id           = mr.doctor_id
            LEFT JOIN medical_request_types rt ON rt.request_type_id   = mr.request_type_id
            LEFT JOIN consultations        c  ON c.consultation_id     = mr.consultation_id";

        private MedicalRequest MapReader(DbDataReader reader)
        {
            return new MedicalRequest
            {
                RequestId       = ReadValue(reader, "request_id",        0L),
                Guid            = ReadValue(reader, "guid",              string.Empty),
                ConsultationId  = ReadValue(reader, "consultation_id",   0L),
                PatientId       = ReadValue(reader, "patient_id",        0L),
                DoctorId        = ReadValue(reader, "doctor_id",         0L),
                RequestTypeId   = ReadValue(reader, "request_type_id",   0L),
                StatusId        = ReadValue(reader, "status_id",         0L),
                Notes           = ReadValue(reader, "notes",             (string?)null),
                CreatedAt       = ReadValue(reader, "created_at",        DateTime.MinValue),
                UpdatedAt       = ReadValue(reader, "updated_at",        DateTime.MinValue),
                IsDeleted       = ReadValue(reader, "is_deleted",        false),
                DeletedAt       = ReadValue(reader, "deleted_at",        (DateTime?)null),
                RequestTypeName = ReadValue(reader, "request_type_name", string.Empty),
            };
        }

        public async Task<IEnumerable<MedicalRequest>> GetAllAsync()
        {
            string sql = BaseSelect + " WHERE (mr.is_deleted = 0 OR mr.is_deleted IS NULL) ORDER BY mr.created_at DESC";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<MedicalRequest?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE mr.request_id = @id AND (mr.is_deleted = 0 OR mr.is_deleted IS NULL)";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        /// <summary>Get all requests matching user_id (via patients join or direct patient_id match).</summary>
        public async Task<List<MedicalRequest>> GetByUserIdAsync(long userId)
        {
            string sql = BaseSelect + @"
                WHERE (p.user_id = @userId OR mr.patient_id = @userId OR mr.patient_id IN (SELECT patient_id FROM patients WHERE user_id = @userId))
                  AND (mr.is_deleted = 0 OR mr.is_deleted IS NULL)
                ORDER BY mr.created_at DESC";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("userId", userId) });
            return items.ToList();
        }

        public async Task<List<MedicalRequest>> GetByPatientIdAsync(long patientId)
        {
            string sql = BaseSelect + " WHERE mr.patient_id = @patientId AND mr.is_deleted = 0 ORDER BY mr.created_at DESC";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("patientId", patientId) });
            return items.ToList();
        }

        public async Task<List<MedicalRequest>> GetByDoctorIdAsync(long doctorId)
        {
            string sql = BaseSelect + " WHERE mr.doctor_id = @doctorId AND mr.is_deleted = 0 ORDER BY mr.created_at DESC";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("doctorId", doctorId) });
            return items.ToList();
        }

        public async Task AddAsync(MedicalRequest entity)
        {
            // Auto-generate a GUID if not already set
            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = System.Guid.NewGuid().ToString();

            entity.CreatedAt = DateTime.UtcNow;
            entity.IsDeleted = false;

            string sql = @"
                INSERT INTO medical_requests
                    (guid, consultation_id, patient_id, doctor_id, request_type_id, status_id, notes, created_at, is_deleted)
                VALUES
                    (@guid, @consultation_id, @patient_id, @doctor_id, @request_type_id, @status_id, @notes, @created_at, 0)
                RETURNING request_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("guid",            entity.Guid),
                CreateParameter("consultation_id", entity.ConsultationId),
                CreateParameter("patient_id",      entity.PatientId),
                CreateParameter("doctor_id",       entity.DoctorId),
                CreateParameter("request_type_id", entity.RequestTypeId),
                CreateParameter("status_id",       entity.StatusId),
                CreateParameter("notes",           entity.Notes),
                CreateParameter("created_at",      entity.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")),
            });

            entity.RequestId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(MedicalRequest entity)
        {
            entity.UpdatedAt = DateTime.UtcNow;

            string sql = @"
                UPDATE medical_requests
                SET guid             = @guid,
                    consultation_id  = @consultation_id,
                    patient_id       = @patient_id,
                    doctor_id        = @doctor_id,
                    request_type_id  = @request_type_id,
                    status_id        = @status_id,
                    notes            = @notes,
                    updated_at       = @updated_at,
                    is_deleted       = @is_deleted,
                    deleted_at       = @deleted_at
                WHERE request_id = @request_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("guid",            entity.Guid),
                CreateParameter("consultation_id", entity.ConsultationId),
                CreateParameter("patient_id",      entity.PatientId),
                CreateParameter("doctor_id",       entity.DoctorId),
                CreateParameter("request_type_id", entity.RequestTypeId),
                CreateParameter("status_id",       entity.StatusId),
                CreateParameter("notes",           entity.Notes),
                CreateParameter("updated_at",      entity.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss")),
                CreateParameter("is_deleted",      entity.IsDeleted ? 1 : 0),
                CreateParameter("deleted_at",      entity.DeletedAt.HasValue
                    ? entity.DeletedAt.Value.ToString("yyyy-MM-dd HH:mm:ss")
                    : (object)DBNull.Value),
                CreateParameter("request_id",      entity.RequestId),
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM medical_requests WHERE request_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        /// <inheritdoc/>
        public async Task<bool> HasActiveRequestsForAppointmentAsync(long appointmentId)
        {
            // A medical request is "active" when it is not soft-deleted and still pending (status 1).
            // We join through consultations so we can match by appointment_id.
            string sql = @"
                SELECT COUNT(*)
                FROM medical_requests mr
                INNER JOIN consultations c ON c.consultation_id = mr.consultation_id
                WHERE c.appointment_id = @appointmentId
                  AND (mr.is_deleted = 0 OR mr.is_deleted IS NULL)
                  AND mr.status_id = 1";

            var count = await ExecuteScalarAsync<int>(sql,
                new[] { CreateParameter("appointmentId", appointmentId) });
            return count > 0;
        }

        /// <inheritdoc/>
        public async Task<bool> HasPendingRequestsByPatientAsync(long patientId)
        {
            // Returns true if the patient has ANY non-deleted pending (status 1) medical request.
            // status_id = 1 means the result has not yet been uploaded by staff.
            string sql = @"
                SELECT COUNT(*)
                FROM medical_requests mr
                WHERE mr.patient_id = @patientId
                  AND (mr.is_deleted = 0 OR mr.is_deleted IS NULL)
                  AND mr.status_id = 1";

            var count = await ExecuteScalarAsync<int>(sql,
                new[] { CreateParameter("patientId", patientId) });
            return count > 0;
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM medical_requests WHERE request_id = @id AND is_deleted = 0";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<MedicalRequest>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                WHERE mr.is_deleted = 0
                ORDER BY mr.created_at DESC
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int? totalNullable = await ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM medical_requests WHERE is_deleted = 0");
            int total = totalNullable.GetValueOrDefault();

            return new PaginationModel<MedicalRequest>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
