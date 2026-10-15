using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.Appointments;

namespace Medical.Api.Modules.Appointments
{
    public class AppointmentRepository : BaseRepository, IAppointmentRepository
    {
        public AppointmentRepository(MyCon dbConnection) : base(dbConnection) { }

        // JOIN doctors, patients, appointment_types and status so names come back with the appointment row
        private const string BaseSelect = @"
            SELECT
                a.appointment_id,
                a.patient_id,
                a.doctor_id,
                a.appointment_type_id,
                a.appointment_date,
                a.appointment_time,
                a.status_id,
                COALESCE(s.status_name, '') as status,
                a.remarks,
                a.created_at,
                a.updated_at,
                a.is_deleted,
                a.deleted_at
            FROM appointments a
            LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
            LEFT JOIN patients p ON p.patient_id = a.patient_id
            LEFT JOIN appointment_types pt ON pt.appointment_type_id  = a.appointment_type_id
            LEFT JOIN status s ON s.status_id  = a.status_id";

        private Appointment MapReader(DbDataReader reader)
        {
            return new Appointment
            {
                AppointmentId     = ReadValue(reader, "appointment_id",      0L),
                PatientId         = ReadValue(reader, "patient_id",          0L),
                DoctorId          = ReadValue(reader, "doctor_id",           0L),
                AppointmentTypeId = ReadValue(reader, "appointment_type_id", 0L),
                AppointmentDate   = ReadValue(reader, "appointment_date",    string.Empty),
                AppointmentTime   = ReadValue(reader, "appointment_time",    string.Empty),
                StatusId          = ReadValue(reader, "status_id",           0L),
                Status            = ReadValue(reader, "status",              string.Empty),
                Remarks           = ReadValue(reader, "remarks",             string.Empty),
                CreatedAt         = ReadValue(reader, "created_at",          string.Empty),
                UpdatedAt         = ReadValue(reader, "updated_at",          string.Empty),
                IsDeleted         = ReadValue(reader, "is_deleted",          false),
                DeletedAt         = ReadValue(reader, "deleted_at",          string.Empty),
            };
        }

        public async Task<IEnumerable<Appointment>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY a.appointment_date, a.appointment_time";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Appointment?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE a.appointment_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<IEnumerable<Appointment>> GetByPatientIdAsync(long patientId)
        {
            string sql = BaseSelect + " WHERE a.patient_id = @patientId ORDER BY a.appointment_date, a.appointment_time";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("patientId", patientId) });
        }

        public async Task<IEnumerable<Appointment>> GetByDoctorIdAsync(long doctorId)
        {
            string sql = BaseSelect + " WHERE a.doctor_id = @doctorId ORDER BY a.appointment_date, a.appointment_time";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("doctorId", doctorId) });
        }

        public async Task<IEnumerable<Appointment>> GetByAppointmentTypeIdAsync(long appointmentTypeId)
        {
            string sql = BaseSelect + " WHERE a.appointment_type_id = @appointmentTypeId ORDER BY a.appointment_date, a.appointment_time";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("appointmentTypeId", appointmentTypeId) });
        }

        public async Task<IEnumerable<string>> GetBookedSlotsAsync(long doctorId, string date)
        {
            string sql = @"
                SELECT a.appointment_time
                FROM appointments a
                WHERE a.doctor_id = @doctorId
                  AND DATE(a.appointment_date) = DATE(@date)
                  AND (a.is_deleted IS NULL OR a.is_deleted = 0)
                  AND a.status_id <> 4";

            var items = await ExecuteReaderToListAsync(sql, (reader) =>
                ReadValue(reader, "appointment_time", string.Empty),
                new[]
                {
                    CreateParameter("doctorId", doctorId),
                    CreateParameter("date",     date),
                });

            return items.Where(t => !string.IsNullOrWhiteSpace(t));
        }

        public async Task<int> GetDailyAppointmentCountAsync(long doctorId, string date)
        {
            // SQLite: use DATE() to compare only the date portion
            string sql = @"
                SELECT COUNT(*)
                FROM appointments
                WHERE doctor_id = @doctorId
                  AND DATE(appointment_date) = DATE(@date)
                  AND (is_deleted IS NULL OR is_deleted = 0)
                  AND status_id <> 4";

            int? count = await ExecuteScalarAsync<int>(sql, new[]
            {
                CreateParameter("doctorId", doctorId),
                CreateParameter("date",     date),
            });
            return count.GetValueOrDefault();
        }

        public async Task AddAsync(Appointment entity)
        {
            string sql = @"
                INSERT INTO appointments (patient_id, doctor_id, appointment_type_id, appointment_date, appointment_time, status_id, remarks, created_at, updated_at, is_deleted, deleted_at)
                VALUES (@patient_id, @doctor_id, @appointment_type_id, @appointment_date, @appointment_time, @status_id, @remarks, @created_at, @updated_at, @is_deleted, @deleted_at)
                RETURNING appointment_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("patient_id",           entity.PatientId),
                CreateParameter("doctor_id",            entity.DoctorId),
                CreateParameter("appointment_type_id",  entity.AppointmentTypeId),
                CreateParameter("appointment_date",     entity.AppointmentDate),
                CreateParameter("appointment_time",     entity.AppointmentTime),
                CreateParameter("status_id",            entity.StatusId),
                CreateParameter("remarks",              entity.Remarks),
                CreateParameter("created_at",           entity.CreatedAt),
                CreateParameter("updated_at",           entity.UpdatedAt),
                CreateParameter("is_deleted",           entity.IsDeleted),
                CreateParameter("deleted_at",           entity.DeletedAt),
            });

            entity.AppointmentId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(Appointment entity)
        {
            string sql = @"
                UPDATE appointments
                SET patient_id           = @patient_id,
                    doctor_id            = @doctor_id,
                    appointment_type_id  = @appointment_type_id,
                    appointment_date     = @appointment_date,
                    appointment_time     = @appointment_time,
                    status_id            = @status_id,
                    remarks              = @remarks,
                    updated_at           = @updated_at,
                    is_deleted           = @is_deleted,
                    deleted_at           = @deleted_at
                WHERE appointment_id   = @appointment_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("patient_id",           entity.PatientId),
                CreateParameter("doctor_id",            entity.DoctorId),
                CreateParameter("appointment_type_id",  entity.AppointmentTypeId),
                CreateParameter("appointment_date",     entity.AppointmentDate),
                CreateParameter("appointment_time",     entity.AppointmentTime),
                CreateParameter("status_id",            entity.StatusId),
                CreateParameter("remarks",              entity.Remarks),
                CreateParameter("updated_at",           entity.UpdatedAt),
                CreateParameter("is_deleted",           entity.IsDeleted),
                CreateParameter("deleted_at",           entity.DeletedAt),
                CreateParameter("appointment_id",       entity.AppointmentId),
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM appointments WHERE appointment_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM appointments WHERE appointment_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Appointment>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY a.appointment_date, a.appointment_time
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int? totalNullable = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM appointments");
            int total = totalNullable.GetValueOrDefault();

            return new PaginationModel<Appointment>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }

        public async Task<IEnumerable<Appointment>> GetOverdueAsync(IEnumerable<long> activeStatusIds)
        {
            var ids = string.Join(",", activeStatusIds);
            if (string.IsNullOrWhiteSpace(ids))
                return Enumerable.Empty<Appointment>();

            // Filter only by date so we get all candidates from today or earlier.
            // The precise local-time check (date+time vs DateTime.Now) is done in C#
            // inside AppointmentOverdueService to avoid the SQLite datetime('now') UTC offset.
            string sql = BaseSelect + $@"
                WHERE a.is_deleted = 0
                  AND a.status_id IN ({ids})
                  AND SUBSTR(a.appointment_date, 1, 10) <= date('now', '+8 hours')";

            return await ExecuteReaderToListAsync(sql, MapReader);
        }

    }
}
