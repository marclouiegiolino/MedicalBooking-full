using System.Data.Common;
using Medical.Api.Main;

namespace Medical.Api.Modules.Consultation
{
    public class ConsultationRepository : BaseRepository, IConsultationRepository
    {
        public ConsultationRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                c.consultation_id,
                c.guid,
                c.appointment_id,
                c.doctor_id,
                c.patient_id,
                c.diagnosis,
                c.consultation_notes,
                c.treatment_plan,
                c.prescription,
                c.created_at,
                c.updated_at,
                c.is_deleted,
                c.deleted_at,
                c.completed_at
            FROM consultations c
            WHERE c.is_deleted = 0";

        private Consultation MapReader(DbDataReader reader)
        {
            return new Consultation
            {
                ConsultationId    = ReadValue(reader, "consultation_id",   0L),
                Guid              = ReadValue(reader, "guid",              string.Empty),
                AppointmentId     = ReadValue(reader, "appointment_id",    0L),
                DoctorId          = ReadValue(reader, "doctor_id",         0L),
                PatientId         = ReadValue(reader, "patient_id",        0L),
                Diagnosis         = ReadValue(reader, "diagnosis",         string.Empty),
                ConsultationNotes = ReadValue(reader, "consultation_notes",string.Empty),
                TreatmentPlan     = ReadValue(reader, "treatment_plan",    string.Empty),
                Prescription      = ReadValue(reader, "prescription",      string.Empty),
                CreatedAt         = ReadValue(reader, "created_at",        string.Empty),
                UpdatedAt         = ReadValue(reader, "updated_at",        string.Empty),
                IsDeleted         = ReadValue(reader, "is_deleted",        false),
                DeletedAt         = ReadValue(reader, "deleted_at",        string.Empty),
                CompletedAt       = ReadValue(reader, "completed_at",      string.Empty),
            };
        }

        public async Task<IEnumerable<Consultation>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY c.created_at DESC";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Consultation?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " AND c.consultation_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<IEnumerable<Consultation>> GetByPatientIdAsync(long patientId)
        {
            string sql = BaseSelect + " AND c.patient_id = @patientId ORDER BY c.created_at DESC";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("patientId", patientId) });
        }

        public async Task<IEnumerable<Consultation>> GetByDoctorIdAsync(long doctorId)
        {
            string sql = BaseSelect + " AND c.doctor_id = @doctorId ORDER BY c.created_at DESC";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("doctorId", doctorId) });
        }

        public async Task<IEnumerable<Consultation>> GetByAppointmentIdAsync(long appointmentId)
        {
            string sql = BaseSelect + " AND c.appointment_id = @appointmentId";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("appointmentId", appointmentId) });
        }

        public async Task AddAsync(Consultation entity)
        {
            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = System.Guid.NewGuid().ToString();

            string sql = @"
                INSERT INTO consultations
                    (guid, appointment_id, doctor_id, patient_id,
                     diagnosis, consultation_notes, treatment_plan, prescription,
                     created_at, updated_at, is_deleted, deleted_at,completed_at)
                VALUES
                    (@guid, @appointment_id, @doctor_id, @patient_id,
                     @diagnosis, @consultation_notes, @treatment_plan, @prescription,
                     @created_at, @updated_at, @is_deleted, @deleted_at,@completed_at)
                RETURNING consultation_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("guid",               entity.Guid),
                CreateParameter("appointment_id",     entity.AppointmentId),
                CreateParameter("doctor_id",          entity.DoctorId),
                CreateParameter("patient_id",         entity.PatientId),
                CreateParameter("diagnosis",          entity.Diagnosis),
                CreateParameter("consultation_notes", entity.ConsultationNotes),
                CreateParameter("treatment_plan",     entity.TreatmentPlan),
                CreateParameter("prescription",       entity.Prescription),
                CreateParameter("created_at",         entity.CreatedAt),
                CreateParameter("updated_at",         string.IsNullOrEmpty(entity.UpdatedAt) ? null : (object)entity.UpdatedAt),
                CreateParameter("is_deleted",         entity.IsDeleted),
                CreateParameter("deleted_at",         string.IsNullOrEmpty(entity.DeletedAt) ? null : (object)entity.DeletedAt),
                CreateParameter("completed_at",       string.IsNullOrEmpty(entity.CompletedAt) ? null : (object)entity.CompletedAt),
            });

            entity.ConsultationId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(Consultation entity)
        {
            string sql = @"
                UPDATE consultations
                SET diagnosis          = @diagnosis,
                    consultation_notes = @consultation_notes,
                    treatment_plan     = @treatment_plan,
                    prescription       = @prescription,
                    updated_at         = @updated_at,
                    is_deleted         = @is_deleted,
                    deleted_at         = @deleted_at,
                    completed_at       = @completed_at
                WHERE consultation_id = @consultation_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("diagnosis",          entity.Diagnosis),
                CreateParameter("consultation_notes", entity.ConsultationNotes),
                CreateParameter("treatment_plan",     entity.TreatmentPlan),
                CreateParameter("prescription",       entity.Prescription),
                CreateParameter("updated_at",         string.IsNullOrEmpty(entity.UpdatedAt) ? null : (object)entity.UpdatedAt),
                CreateParameter("is_deleted",         entity.IsDeleted),
                CreateParameter("deleted_at",         string.IsNullOrEmpty(entity.DeletedAt) ? null : (object)entity.DeletedAt),
                CreateParameter("completed_at",       string.IsNullOrEmpty(entity.CompletedAt) ? null : (object)entity.CompletedAt),
                CreateParameter("consultation_id",    entity.ConsultationId),
            });
        }

        public async Task SoftDeleteAsync(long id)
        {
            string sql = @"
                UPDATE consultations
                SET is_deleted = 1,
                    deleted_at = @deleted_at
                WHERE consultation_id = @id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("deleted_at", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")),
                CreateParameter("id",         id),
            });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM consultations WHERE consultation_id = @id AND is_deleted = 0";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Consultation>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY c.created_at DESC
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int? totalNullable = await ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM consultations WHERE is_deleted = 0");
            int total = totalNullable.GetValueOrDefault();

            return new PaginationModel<Consultation>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
