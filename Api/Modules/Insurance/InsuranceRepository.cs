using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.Insurance;

namespace Medical.Api.Modules.Insurance
{
    public class InsuranceRepository : BaseRepository, IInsuranceRepository
    {
        public InsuranceRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                i.insurance_id,
                i.guid,
                i.patient_id,
                i.provider_name,
                i.policy_number,
                i.coverage_type,
                i.valid_until,
                i.is_primary,
                i.created_at,
                i.updated_at
            FROM insurance i
            LEFT JOIN patients p ON p.patient_id = i.patient_id
        ";

        private Insurance MapReader(DbDataReader reader)
        {
            return new Insurance
            {
                InsuranceId  = ReadValue(reader, "insurance_id",  0L),
                Guid         = ReadValue(reader, "guid",          string.Empty),
                PatientId    = ReadValue(reader, "patient_id",    0L),
                ProviderName = ReadValue(reader, "provider_name", string.Empty),
                PolicyNumber = ReadValue(reader, "policy_number", string.Empty),
                CoverageType = ReadValue(reader, "coverage_type", string.Empty),
                ValidUntil   = ReadValue(reader, "valid_until",   string.Empty),
                IsPrimary    = ReadValue(reader, "is_primary",    false),
                CreatedAt    = ReadValue(reader, "created_at",    string.Empty),
                UpdatedAt    = ReadValue(reader, "updated_at",    string.Empty),
            };
        }

        public async Task<IEnumerable<Insurance>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY i.provider_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Insurance?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE i.insurance_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<IEnumerable<Insurance>> GetByUserIdAsync(long userId)
        {
            string sql = BaseSelect + " WHERE p.user_id = @userId ORDER BY i.is_primary DESC, i.provider_name ASC";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("userId", userId) });
        }

        public async Task<IEnumerable<Insurance>> GetByPatientIdAsync(long patientId)
        {
            string sql = BaseSelect + " WHERE i.patient_id = @patientId ORDER BY i.is_primary DESC, i.provider_name ASC";
            return await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("patientId", patientId) });
        }

        public async Task AddAsync(Insurance entity)
        {
            if (string.IsNullOrWhiteSpace(entity.Guid))
                entity.Guid = System.Guid.NewGuid().ToString();

            if (string.IsNullOrWhiteSpace(entity.CreatedAt))
                entity.CreatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            if (string.IsNullOrWhiteSpace(entity.UpdatedAt))
                entity.UpdatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            if (entity.IsPrimary)
            {
                string unsetSql = "UPDATE insurance SET is_primary = false WHERE patient_id = @patient_id";
                await ExecuteNonQueryAsync(unsetSql, new[] { CreateParameter("patient_id", entity.PatientId) });
            }

            string sql = @"
                INSERT INTO insurance (guid, patient_id, provider_name, policy_number, coverage_type, valid_until, is_primary, created_at, updated_at)
                VALUES (@guid, @patient_id, @provider_name, @policy_number, @coverage_type, @valid_until, @is_primary, @created_at, @updated_at)
                RETURNING insurance_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("guid",          entity.Guid),
                CreateParameter("patient_id",    entity.PatientId),
                CreateParameter("provider_name", entity.ProviderName),
                CreateParameter("policy_number", entity.PolicyNumber),
                CreateParameter("coverage_type", entity.CoverageType),
                CreateParameter("valid_until",   entity.ValidUntil),
                CreateParameter("is_primary",    entity.IsPrimary),
                CreateParameter("created_at",    entity.CreatedAt),
                CreateParameter("updated_at",    entity.UpdatedAt),
            });

            entity.InsuranceId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(Insurance entity)
        {
            if (string.IsNullOrWhiteSpace(entity.UpdatedAt))
                entity.UpdatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            if (entity.IsPrimary)
            {
                string unsetSql = "UPDATE insurance SET is_primary = false WHERE patient_id = @patient_id AND insurance_id != @insurance_id";
                await ExecuteNonQueryAsync(unsetSql, new[]
                {
                    CreateParameter("patient_id",    entity.PatientId),
                    CreateParameter("insurance_id",  entity.InsuranceId),
                });
            }

            string sql = @"
                UPDATE insurance
                SET patient_id    = @patient_id,
                    provider_name = @provider_name,
                    policy_number = @policy_number,
                    coverage_type = @coverage_type,
                    valid_until   = @valid_until,
                    is_primary    = @is_primary,
                    updated_at    = @updated_at
                WHERE insurance_id = @insurance_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("patient_id",    entity.PatientId),
                CreateParameter("provider_name", entity.ProviderName),
                CreateParameter("policy_number", entity.PolicyNumber),
                CreateParameter("coverage_type", entity.CoverageType),
                CreateParameter("valid_until",   entity.ValidUntil),
                CreateParameter("is_primary",    entity.IsPrimary),
                CreateParameter("updated_at",    entity.UpdatedAt),
                CreateParameter("insurance_id",  entity.InsuranceId)
            });
        }

        public async Task SetPrimaryAsync(long insuranceId, long patientId)
        {
            string unsetSql = "UPDATE insurance SET is_primary = false WHERE patient_id = @patient_id";
            await ExecuteNonQueryAsync(unsetSql, new[] { CreateParameter("patient_id", patientId) });

            string setSql = "UPDATE insurance SET is_primary = true WHERE insurance_id = @insurance_id AND patient_id = @patient_id";
            await ExecuteNonQueryAsync(setSql, new[]
            {
                CreateParameter("insurance_id", insuranceId),
                CreateParameter("patient_id",   patientId),
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM insurance WHERE insurance_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM insurance WHERE insurance_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Insurance>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY i.provider_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM insurance");

            return new PaginationModel<Insurance>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}

