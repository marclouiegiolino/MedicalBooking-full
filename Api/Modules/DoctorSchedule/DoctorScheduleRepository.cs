using System.Data.Common;
using Medical.Api.Main;

namespace Medical.Api.Modules.DoctorSchedule
{
    public class DoctorScheduleRepository : BaseRepository, IDoctorScheduleRepository
    {
        public DoctorScheduleRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                ds.schedule_id,
                ds.doctor_id,
                ds.day_of_week,
                ds.start_time,
                ds.end_time,
                ds.slot_duration,
                ds.max_appointments,
                ds.is_active
            FROM doctor_schedules ds
            LEFT JOIN doctors d ON d.doctor_id = ds.doctor_id
        ";

        private DoctorSchedule MapReader(DbDataReader reader)
        {
            return new DoctorSchedule
            {
                ScheduleId      = ReadValue(reader, "schedule_id",      0L),
                DoctorId        = ReadValue(reader, "doctor_id",        0L),
                DayOfWeek       = ReadValue(reader, "day_of_week",      string.Empty),
                StartTime       = ReadValue(reader, "start_time",       string.Empty),
                EndTime         = ReadValue(reader, "end_time",         string.Empty),
                SlotDuration    = ReadValue(reader, "slot_duration",    0),
                MaxAppointments = ReadValue(reader, "max_appointments", 0),
                IsActive        = ReadValue(reader, "is_active",        false),
            };
        }

        public async Task<IEnumerable<DoctorSchedule>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY ds.doctor_id, ds.day_of_week";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<DoctorSchedule?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE ds.schedule_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<List<DoctorSchedule>> GetByDoctorIdAsync(long doctorId)
        {
            string sql = BaseSelect + " WHERE ds.doctor_id = @doctorId ORDER BY ds.day_of_week";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("doctorId", doctorId) });
            return items.ToList();
        }

        public async Task AddAsync(DoctorSchedule entity)
        {
            string sql = @"
                INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration, max_appointments, is_active)
                VALUES (@doctor_id, @day_of_week, @start_time, @end_time, @slot_duration, @max_appointments, @is_active)
                RETURNING schedule_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("doctor_id",        entity.DoctorId),
                CreateParameter("day_of_week",      entity.DayOfWeek),
                CreateParameter("start_time",       entity.StartTime),
                CreateParameter("end_time",         entity.EndTime),
                CreateParameter("slot_duration",    entity.SlotDuration),
                CreateParameter("max_appointments", entity.MaxAppointments),
                CreateParameter("is_active",        entity.IsActive),
            });

            entity.ScheduleId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(DoctorSchedule entity)
        {
            string sql = @"
                UPDATE doctor_schedules
                SET doctor_id        = @doctor_id,
                    day_of_week      = @day_of_week,
                    start_time       = @start_time,
                    end_time         = @end_time,
                    slot_duration    = @slot_duration,
                    max_appointments = @max_appointments,
                    is_active        = @is_active
                WHERE schedule_id = @schedule_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("doctor_id",        entity.DoctorId),
                CreateParameter("day_of_week",      entity.DayOfWeek),
                CreateParameter("start_time",       entity.StartTime),
                CreateParameter("end_time",         entity.EndTime),
                CreateParameter("slot_duration",    entity.SlotDuration),
                CreateParameter("max_appointments", entity.MaxAppointments),
                CreateParameter("is_active",        entity.IsActive),
                CreateParameter("schedule_id",      entity.ScheduleId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM doctor_schedules WHERE schedule_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM doctor_schedules WHERE schedule_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<DoctorSchedule>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY ds.doctor_id, ds.day_of_week
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM doctor_schedules");

            return new PaginationModel<DoctorSchedule>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
