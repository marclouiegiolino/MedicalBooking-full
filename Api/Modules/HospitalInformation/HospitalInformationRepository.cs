using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.HospitalInformation;

namespace Medical.Api.Modules.HospitalInformation
{
    public class HospitalInformationRepository : BaseRepository, IHospitalInformationRepository
    {
        public HospitalInformationRepository(MyCon dbConnection) : base(dbConnection) { }

        private HospitalInformation MapReader(DbDataReader reader)
        {
            return new HospitalInformation
            {
                HospitalId = !reader.IsDBNull(reader.GetOrdinal("hospital_id")) 
                    ? Convert.ToInt64(reader["hospital_id"]) 
                    : 0,
                HospitalName = reader["hospital_name"]?.ToString() ?? "",
                Address = reader["address"]?.ToString() ?? "",
                PhoneNumber = reader["phone_number"]?.ToString() ?? "",
                Email = reader["email"]?.ToString() ?? "",
                LogoPath = reader["logo_path"]?.ToString() ?? "",
                UpdatedAt = reader["updated_at"]?.ToString() ?? "",
                Latitude = !reader.IsDBNull(reader.GetOrdinal("latitude"))
                    ? Convert.ToDouble(reader["latitude"])
                    : 0.0,
                Longitude = !reader.IsDBNull(reader.GetOrdinal("longitude"))
                    ? Convert.ToDouble(reader["longitude"])
                    : 0.0,
                ServiceRadius = !reader.IsDBNull(reader.GetOrdinal("service_radius"))
                    ? Convert.ToDouble(reader["service_radius"])
                    : 0.0
            };
        }

        public async Task<IEnumerable<HospitalInformation>> GetAllAsync()
        {
            string sql = "SELECT hospital_id, hospital_name, address, phone_number, email, logo_path, updated_at, latitude, longitude, service_radius FROM hospital_information ORDER BY hospital_name";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<HospitalInformation?> GetByIdAsync(long id)
        {
            string sql = "SELECT hospital_id, hospital_name, address, phone_number, email, logo_path, updated_at, latitude, longitude, service_radius FROM hospital_information WHERE hospital_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(HospitalInformation entity)
        {
            string sql = @"INSERT INTO hospital_information (hospital_name, address, phone_number, email, logo_path, latitude, longitude, service_radius) 
                          VALUES (@hospital_name, @address, @phone_number, @email, @logo_path, @latitude, @longitude, @service_radius)
                          RETURNING hospital_id";

            var result = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("hospital_name", entity.HospitalName),
                CreateParameter("address", entity.Address),
                CreateParameter("phone_number", entity.PhoneNumber),
                CreateParameter("email", entity.Email),
                CreateParameter("logo_path", entity.LogoPath),
                CreateParameter("latitude", entity.Latitude),
                CreateParameter("longitude", entity.Longitude),
                CreateParameter("service_radius", entity.ServiceRadius)
            });
            entity.HospitalId = result;
        }

        public async Task UpdateAsync(HospitalInformation entity)
        {
            string sql = @"
                UPDATE hospital_information
                SET hospital_name = @hospital_name, address = @address, phone_number = @phone_number, email = @email, logo_path = @logo_path, updated_at = @updated_at,
                    latitude = @latitude, longitude = @longitude, service_radius = @service_radius
                WHERE hospital_id = @hospital_id";
            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("hospital_name", entity.HospitalName),
                CreateParameter("address", entity.Address),
                CreateParameter("phone_number", entity.PhoneNumber),
                CreateParameter("email", entity.Email),
                CreateParameter("logo_path", entity.LogoPath),
                CreateParameter("updated_at", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")),
                CreateParameter("latitude", entity.Latitude),
                CreateParameter("longitude", entity.Longitude),
                CreateParameter("service_radius", entity.ServiceRadius),
                CreateParameter("hospital_id", entity.HospitalId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM hospital_information WHERE hospital_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> IsInUseAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM hospital_information WHERE hospital_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<HospitalInformation>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = @"
                SELECT hospital_id, hospital_name, address, phone_number, email, logo_path, updated_at, latitude, longitude, service_radius
                FROM hospital_information
                ORDER BY hospital_name
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size", pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize)
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM hospital_information");

            return new PaginationModel<HospitalInformation>
            {
                Items = items.ToList(),
                TotalCount = total,
                PageSize = pageSize,
                CurrentPage = pageNumber
            };
        }

        public async Task<IEnumerable<HospitalInformation>> GetNearbyAsync(double latitude, double longitude, double radiusKm)
        {
            var all = await GetAllAsync();
            var list = new List<HospitalInformation>();
            foreach (var h in all)
            {
                if (h.Latitude == 0.0 && h.Longitude == 0.0) continue;
                double distKm = Math.Round(HaversineDistance(latitude, longitude, h.Latitude, h.Longitude), 2);
                h.DistanceKm = distKm;
                h.IsWithinServiceRadius = h.ServiceRadius <= 0 || distKm <= h.ServiceRadius;

                double effectiveRadius = h.ServiceRadius > 0 ? h.ServiceRadius : radiusKm;
                if (radiusKm <= 0 || distKm <= effectiveRadius)
                {
                    list.Add(h);
                }
            }
            return list.OrderBy(h => h.DistanceKm ?? double.MaxValue);
        }

        /// <summary>Calculates great-circle distance in kilometres using the Haversine formula.</summary>
        private static double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371.0; // Earth radius in km
            double dLat = DegreesToRadians(lat2 - lat1);
            double dLon = DegreesToRadians(lon2 - lon1);
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                     + Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2))
                     * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return R * c;
        }

        private static double DegreesToRadians(double deg) => deg * Math.PI / 180.0;
    }
}