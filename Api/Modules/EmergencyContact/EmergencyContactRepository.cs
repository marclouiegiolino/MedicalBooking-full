using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.EmergencyContact;

namespace Medical.Api.Modules.EmergencyContact
{
    public class EmergencyContactRepository : BaseRepository, IEmergencyContactRepository
    {
        public EmergencyContactRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                e.contact_id,
                e.patient_id,
                e.first_name,
                e.last_name,
                e.relationship,
                e.phone
            FROM emergency_contacts e
            LEFT JOIN patients p ON p.patient_id = e.patient_id
        ";

        private EmergencyContact MapReader(DbDataReader reader)
        {
            return new EmergencyContact
            {
                ContactId    = ReadValue(reader, "contact_id",   0L),
                PatientId    = ReadValue(reader, "patient_id",   0L),
                FirstName    = ReadValue(reader, "first_name",   string.Empty),
                LastName     = ReadValue(reader, "last_name",    string.Empty),
                Relationship = ReadValue(reader, "relationship", string.Empty),
                Phone        = ReadValue(reader, "phone",        string.Empty),
            };
        }

        public async Task<IEnumerable<EmergencyContact>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY e.last_name, e.first_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<EmergencyContact?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE e.contact_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<IEnumerable<EmergencyContact>> GetByUserIdAsync(long userId)
        {
            string sql = BaseSelect + " WHERE p.user_id = @userId ORDER BY e.last_name, e.first_name";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("userId", userId) });
        }

        public async Task<List<EmergencyContact>> GetByPatientIdAsync(long patientId)
        {
            string sql = BaseSelect + " WHERE e.patient_id = @patientId ORDER BY e.last_name, e.first_name";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("patientId", patientId) });
            return items.ToList();
        }

        public async Task AddAsync(EmergencyContact entity)
        {
            string sql = @"
                INSERT INTO emergency_contacts (patient_id, first_name, last_name, relationship, phone)
                VALUES (@patient_id, @first_name, @last_name, @relationship, @phone)
                RETURNING contact_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("patient_id",   entity.PatientId),
                CreateParameter("first_name",   entity.FirstName),
                CreateParameter("last_name",    entity.LastName),
                CreateParameter("relationship", entity.Relationship),
                CreateParameter("phone",        entity.Phone),
            });

            entity.ContactId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(EmergencyContact entity)
        {
            string sql = @"
                UPDATE emergency_contacts
                SET patient_id   = @patient_id,
                    first_name   = @first_name,
                    last_name    = @last_name,
                    relationship = @relationship,
                    phone        = @phone
                WHERE contact_id = @contact_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("patient_id",   entity.PatientId),
                CreateParameter("first_name",   entity.FirstName),
                CreateParameter("last_name",    entity.LastName),
                CreateParameter("relationship", entity.Relationship),
                CreateParameter("phone",        entity.Phone),
                CreateParameter("contact_id",   entity.ContactId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM emergency_contacts WHERE contact_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM emergency_contacts WHERE contact_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<EmergencyContact>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY e.last_name, e.first_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM emergency_contacts");

            return new PaginationModel<EmergencyContact>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
