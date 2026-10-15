using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.AppointmentType;

namespace Medical.Api.Modules.AppointmentType
{
    public class AppointmentTypeRepository : BaseRepository, IAppointmentTypeRepository
    {
        public AppointmentTypeRepository(MyCon dbConnection) : base(dbConnection) { }

        private AppointmentType MapReader(DbDataReader reader)
        {
            return new AppointmentType
            {
                AppointmentTypeId = !reader.IsDBNull(reader.GetOrdinal("appointment_type_id")) 
                    ? Convert.ToInt64(reader["appointment_type_id"]) 
                    : 0,
                AppointmentName = reader["appointment_name"]?.ToString() ?? ""
            };
        }

        public async Task<IEnumerable<AppointmentType>> GetAllAsync()
        {
            string sql = "SELECT appointment_type_id, appointment_name FROM appointment_types ORDER BY appointment_name";
            return await ExecuteReaderToListAsync(sql, MapReader);  
        }

        public async Task<AppointmentType?> GetByIdAsync(long id)
        {
            string sql = "SELECT appointment_type_id, appointment_name FROM appointment_types WHERE appointment_type_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(AppointmentType entity)
        {
            string sql = @"INSERT INTO appointment_types (appointment_name) 
                          VALUES (@appointment_name)
                          RETURNING appointment_type_id";

            var result = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("appointment_name", entity.AppointmentName)
            });
            entity.AppointmentTypeId = result;
        }

        public async Task UpdateAsync(AppointmentType entity)
        {
            string sql = @"
                UPDATE appointment_types
                SET appointment_name = @appointment_name
                WHERE appointment_type_id = @appointment_type_id";
            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("appointment_name", entity.AppointmentName),
                CreateParameter("appointment_type_id", entity.AppointmentTypeId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM appointment_types WHERE appointment_type_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> IsInUseAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM appointment_types WHERE appointment_type_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<AppointmentType>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = @"
                SELECT appointment_type_id, appointment_name
                FROM appointment_types
                ORDER BY appointment_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size", pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize)
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM appointment_types");

            return new PaginationModel<AppointmentType>
            {
                Items = items.ToList(),
                TotalCount = total,
                PageSize = pageSize,
                CurrentPage = pageNumber
            };
        }
    }
}