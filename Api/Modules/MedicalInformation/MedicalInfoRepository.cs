using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.MedicalInformation;

namespace Medical.Api.Modules.MedicalInformation
{
    public class MedicalInfoRepository : BaseRepository, IMedicalInfoRepository
    {
        public MedicalInfoRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                m.medical_info_id,
                m.patient_id,
                m.allergies,
                m.medical_history,
                m.medications
            FROM medical_information m
            LEFT JOIN patients p ON p.patient_id = m.patient_id
        ";

        private MedicalInfo MapReader(DbDataReader reader)
        {
            return new MedicalInfo
            {
                MedicalInfoId  = ReadValue(reader, "medical_info_id", 0L),
                PatientId      = ReadValue(reader, "patient_id",      0L),
                Allergies      = ReadValue(reader, "allergies",       string.Empty),
                MedicalHistory = ReadValue(reader, "medical_history", string.Empty),
                Medications    = ReadValue(reader, "medications",     string.Empty),
            };
        }

        public async Task<IEnumerable<MedicalInfo>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY m.patient_id";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<MedicalInfo?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE m.medical_info_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<MedicalInfo?> GetByUserIdAsync(long userId)
        {
            string sql = BaseSelect + " WHERE p.user_id = @userId";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("userId", userId) });
            return items.FirstOrDefault();
        }

        public async Task<MedicalInfo?> GetByPatientIdAsync(long patientId)
        {
            string sql = BaseSelect + " WHERE m.patient_id = @patientId";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("patientId", patientId) });
            return items.FirstOrDefault();
        }


        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM medical_information WHERE medical_info_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task AddAsync(MedicalInfo entity)
        {
            string sql = @"
                INSERT INTO medical_information (patient_id, allergies, medical_history, medications)
                VALUES (@patient_id, @allergies, @medical_history, @medications)
                RETURNING medical_info_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("patient_id",      entity.PatientId),
                CreateParameter("allergies",       entity.Allergies),
                CreateParameter("medical_history", entity.MedicalHistory),
                CreateParameter("medications",     entity.Medications),
            });

            entity.MedicalInfoId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(MedicalInfo entity)
        {
            string sql = @"
                UPDATE medical_information
                SET patient_id      = @patient_id,
                    allergies       = @allergies,
                    medical_history = @medical_history,
                    medications     = @medications
                WHERE medical_info_id = @medical_info_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("patient_id",      entity.PatientId),
                CreateParameter("allergies",       entity.Allergies),
                CreateParameter("medical_history", entity.MedicalHistory),
                CreateParameter("medications",     entity.Medications),
                CreateParameter("medical_info_id", entity.MedicalInfoId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM medical_information WHERE medical_info_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<PaginationModel<MedicalInfo>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY m.patient_id
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM medical_information");

            return new PaginationModel<MedicalInfo>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
