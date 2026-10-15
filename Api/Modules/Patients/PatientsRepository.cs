using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.Patients;

namespace Medical.Api.Modules.Patients
{
    public class PatientsRepository : BaseRepository, IPatientsRepository
    {
        public PatientsRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                p.patient_id,
                p.guid,
                p.user_id,
                p.first_name,
                p.middle_name,
                p.last_name,
                p.birth_date,
                p.gender,
                p.address,
                p.blood_type,
                u.profile_picture_path
            FROM patients p
            LEFT JOIN users u ON u.user_id = p.user_id";

        private Patients MapReader(DbDataReader reader)
        {
            return new Patients
            {
                PatientId = !reader.IsDBNull(reader.GetOrdinal("patient_id")) 
                    ? Convert.ToInt64(reader["patient_id"]) 
                    : 0,
                Guid = !reader.IsDBNull(reader.GetOrdinal("guid"))
                    ? reader["guid"]?.ToString() ?? string.Empty
                    : string.Empty,
                UserId = !reader.IsDBNull(reader.GetOrdinal("user_id")) 
                    ? Convert.ToInt64(reader["user_id"]) 
                    : 0,
                FirstName = reader["first_name"]?.ToString() ?? "",
                MiddleName = reader["middle_name"]?.ToString() ?? "",
                LastName = reader["last_name"]?.ToString() ?? "",
                BirthDate = reader["birth_date"]?.ToString() ?? "",
                Gender = reader["gender"]?.ToString() ?? "",
                Address = reader["address"]?.ToString() ?? "",
                BloodType = reader["blood_type"]?.ToString() ?? "",
                ProfilePicturePath = ReadValue(reader, "profile_picture_path", string.Empty),
            };
        }

        public async Task<IEnumerable<Patients>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY p.patient_id";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Patients?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE p.patient_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(Patients entity)
        {
            // Always ensure a unique GUID — callers may omit it (e.g. auto-created patient on registration)
            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = Guid.NewGuid().ToString();

            string patientNo = $"PAT-{entity.UserId}-{DateTime.UtcNow.Ticks % 10000}";
            string sql = @"INSERT INTO patients (guid, user_id, patient_no, first_name, middle_name, last_name, birth_date, gender, address, blood_type) 
                          VALUES (@guid, @user_id, @patient_no, @first_name, @middle_name, @last_name, @birth_date, @gender, @address, @blood_type)
                          RETURNING patient_id";

            var result = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("guid", entity.Guid),
                CreateParameter("user_id", entity.UserId),
                CreateParameter("patient_no", patientNo),
                CreateParameter("first_name", entity.FirstName),
                CreateParameter("middle_name", entity.MiddleName),
                CreateParameter("last_name", entity.LastName),
                CreateParameter("birth_date", entity.BirthDate),
                CreateParameter("gender", entity.Gender),
                CreateParameter("address", entity.Address),
                CreateParameter("blood_type", entity.BloodType)
            });
            entity.PatientId = result;
        }

        public async Task UpdateAsync(Patients entity)
        {
            string sql = @"
                UPDATE patients
                SET user_id = @user_id, first_name = @first_name, middle_name = @middle_name, last_name = @last_name, birth_date = @birth_date, gender = @gender, address = @address, blood_type = @blood_type
                WHERE patient_id = @patient_id";
            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("user_id", entity.UserId),
                CreateParameter("first_name", entity.FirstName),
                CreateParameter("middle_name", entity.MiddleName),
                CreateParameter("last_name", entity.LastName),
                CreateParameter("birth_date", entity.BirthDate),
                CreateParameter("gender", entity.Gender),
                CreateParameter("address", entity.Address),
                CreateParameter("blood_type", entity.BloodType),
                CreateParameter("patient_id", entity.PatientId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM patients WHERE patient_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<Patients?> GetByUserIdAsync(long userId)
        {
            string sql = BaseSelect + " WHERE p.user_id = @userId";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("userId", userId) });
            return items.FirstOrDefault();
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM patients WHERE patient_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Patients>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY p.patient_id
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size", pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize)
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM patients");

            return new PaginationModel<Patients>
            {
                Items = items.ToList(),
                TotalCount = total,
                PageSize = pageSize,
                CurrentPage = pageNumber
            };
        }
    }
}