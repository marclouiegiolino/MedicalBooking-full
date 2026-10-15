using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.Doctor;

namespace Medical.Api.Modules.Doctor
{
    public class DoctorRepository : BaseRepository, IDoctorRepository
    {
        public DoctorRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                d.doctor_id,
                d.user_id,
                d.guid,
                d.department_id,
                d.specialty_id,
                d.license_number,
                d.consultation_fee,
                d.first_name,
                d.middle_name,
                d.last_name,
                d.is_timed_in,
                d.hospital_id,
                u.profile_picture_path
            FROM doctors d
            LEFT JOIN users         u   ON u.user_id = d.user_id
            LEFT JOIN departments   dep ON dep.department_id = d.department_id 
            LEFT JOIN specialization sp ON sp.specialty_id  = d.specialty_id
            LEFT JOIN hospital_information h ON h.hospital_id = d.hospital_id";

        private Doctor MapReader(DbDataReader reader)
        {
            return new Doctor
            {
                DoctorId           = ReadValue(reader, "doctor_id",            0L),
                UserId             = ReadValue(reader, "user_id",              0L),
                Guid               = ReadValue(reader, "guid",                 string.Empty),
                DepartmentId       = ReadValue(reader, "department_id",        0L),
                SpecialtyId        = ReadValue(reader, "specialty_id",         0L),
                LicenseNumber      = ReadValue(reader, "license_number",       string.Empty),
                ConsultationFee    = ReadValue(reader, "consultation_fee",      0M),
                FirstName          = ReadValue(reader, "first_name",           string.Empty),
                MiddleName         = ReadValue(reader, "middle_name",          string.Empty),
                LastName           = ReadValue(reader, "last_name",            string.Empty),
                IsTimedIn          = ReadValue(reader, "is_timed_in",          false),
                HospitalId         = ReadValue(reader, "hospital_id",            0L),
                ProfilePicturePath = ReadValue(reader, "profile_picture_path", string.Empty),
            };
        }

        public async Task<IEnumerable<Doctor>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY d.last_name, d.first_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Doctor?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE d.doctor_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<Doctor?> GetByUserIdAsync(long userId)
        {
            string sql = BaseSelect + " WHERE d.user_id = @userId";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("userId", userId) });
            return items.FirstOrDefault();
        }

        public async Task<Doctor?> GetByDepartmentIdAsync(long departmentId)
        {
            string sql = BaseSelect + " WHERE d.department_id = @departmentId";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("departmentId", departmentId) });
            return items.FirstOrDefault();
        }

        public async Task<Doctor?> GetBySpecialtyIdAsync(long specialtyId)
        {
            string sql = BaseSelect + " WHERE d.specialty_id = @specialtyId";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("specialtyId", specialtyId) });
            return items.FirstOrDefault();
        }

        

        public async Task AddAsync(Doctor entity)
        {
            string sql = @"
                INSERT INTO doctors (user_id, guid, department_id, specialty_id, consultation_fee, license_number, first_name, middle_name, last_name, is_timed_in, hospital_id)
                VALUES (@user_id, @guid, @department_id, @specialty_id, @consultation_fee, @license_number, @first_name, @middle_name, @last_name, @is_timed_in, @hospital_id)
                RETURNING doctor_id";

            // Auto-generate a GUID for protection if not already set
            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = System.Guid.NewGuid().ToString();

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("user_id",          entity.UserId),
                CreateParameter("guid",              entity.Guid),
                CreateParameter("department_id",    entity.DepartmentId),
                CreateParameter("specialty_id",     entity.SpecialtyId),
                CreateParameter("consultation_fee", entity.ConsultationFee.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)),
                CreateParameter("license_number",   entity.LicenseNumber),
                CreateParameter("first_name",       entity.FirstName),
                CreateParameter("middle_name",      entity.MiddleName),
                CreateParameter("last_name",        entity.LastName),
                CreateParameter("is_timed_in",      entity.IsTimedIn),
                CreateParameter("hospital_id",      entity.HospitalId),
            });

            entity.DoctorId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(Doctor entity)
        {
            string sql = @"
                UPDATE doctors
                SET user_id          = @user_id,
                    department_id    = @department_id,
                    specialty_id     = @specialty_id,
                    consultation_fee = @consultation_fee,
                    license_number   = @license_number,
                    first_name       = @first_name,
                    middle_name      = @middle_name,
                    last_name        = @last_name,
                    is_timed_in      = @is_timed_in,
                    hospital_id      = @hospital_id
                WHERE doctor_id = @doctor_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("user_id",          entity.UserId),
                CreateParameter("department_id",    entity.DepartmentId),
                CreateParameter("specialty_id",     entity.SpecialtyId),
                CreateParameter("consultation_fee", entity.ConsultationFee.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)),
                CreateParameter("license_number",   entity.LicenseNumber),
                CreateParameter("first_name",       entity.FirstName),
                CreateParameter("middle_name",      entity.MiddleName),
                CreateParameter("last_name",        entity.LastName),
                CreateParameter("is_timed_in",      entity.IsTimedIn),
                CreateParameter("hospital_id",      entity.HospitalId),
                CreateParameter("doctor_id",        entity.DoctorId),
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM doctors WHERE doctor_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM doctors WHERE doctor_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Doctor>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY d.last_name, d.first_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int? totalNullable = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM doctors");
            int total = totalNullable.GetValueOrDefault();

            return new PaginationModel<Doctor>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
