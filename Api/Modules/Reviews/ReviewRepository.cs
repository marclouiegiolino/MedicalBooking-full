using System.Data.Common;
using Medical.Api.Main;
using Medical.Api.Modules.Review;

namespace Medical.Api.Modules.Review
{
    public class ReviewRepository : BaseRepository, IReviewRepository
    {
        public ReviewRepository(MyCon dbConnection) : base(dbConnection) { }

        // JOIN doctor and patient so names come back with the review row
        private const string BaseSelect = @"
            SELECT
                r.review_id,
                r.doctor_id,
                r.patient_id,
                r.rating,
                r.comment,
                r.created_at
            FROM reviews r
            LEFT JOIN doctors       d   ON d.doctor_id = r.doctor_id
            LEFT JOIN patients      p   ON p.patient_id = r.patient_id";

        private Review MapReader(DbDataReader reader)
        {
            return new Review
            {
                ReviewId           = ReadValue(reader, "review_id",            0L),
                DoctorId           = ReadValue(reader, "doctor_id",            0L),
                PatientId          = ReadValue(reader, "patient_id",           0L),
                Rating             = ReadValue(reader, "rating",               5),
                Comment            = ReadValue(reader, "comment",                string.Empty),
                CreatedAt          = ReadValue(reader, "created_at",             string.Empty),
            };
        }

        public async Task<IEnumerable<Review>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY r.created_at DESC";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Review?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE r.review_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<Review?> GetByReviewIdAsync(long reviewId)
        {
            string sql = BaseSelect + " WHERE r.review_id = @reviewId";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("reviewId", reviewId) });
            return items.FirstOrDefault();
        }

        public async Task AddAsync(Review entity)
        {
            string sql = @"
                INSERT INTO reviews (doctor_id, patient_id, rating, comment, created_at)
                VALUES (@doctor_id, @patient_id, @rating, @comment, @created_at)
                RETURNING review_id";

            string createdAtStr = string.IsNullOrWhiteSpace(entity.CreatedAt)
                ? DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
                : entity.CreatedAt;

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("doctor_id",        entity.DoctorId),
                CreateParameter("patient_id",       entity.PatientId),
                CreateParameter("rating",           entity.Rating),
                CreateParameter("comment",          entity.Comment),
                CreateParameter("created_at",       createdAtStr),
            });

            entity.ReviewId = newId.GetValueOrDefault();
            entity.CreatedAt = createdAtStr;
        }

        public async Task UpdateAsync(Review entity)
        {
            string sql = @"
                UPDATE reviews
                SET doctor_id          = @doctor_id,
                    patient_id         = @patient_id,
                    rating             = @rating,
                    comment            = @comment,
                    created_at         = @created_at
                WHERE review_id = @review_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("doctor_id",          entity.DoctorId),
                CreateParameter("patient_id",         entity.PatientId),
                CreateParameter("rating",             entity.Rating),
                CreateParameter("comment",            entity.Comment),
                CreateParameter("created_at",       entity.CreatedAt),
                CreateParameter("review_id",        entity.ReviewId),
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM reviews WHERE review_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM reviews WHERE review_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Review>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY r.created_at
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int? totalNullable = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM reviews");
            int total = totalNullable.GetValueOrDefault();

            return new PaginationModel<Review>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }
    }
}
