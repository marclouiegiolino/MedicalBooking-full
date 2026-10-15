using System.Data.Common;
using Medical.Api.Main;

namespace Medical.Api.Modules.Notification
{
    public class NotificationRepository : BaseRepository, INotificationRepository
    {
        public NotificationRepository(MyCon dbConnection) : base(dbConnection) { }

        private const string BaseSelect = @"
            SELECT
                n.notification_id,
                n.guid,
                n.user_id,
                n.title,
                n.message,
                n.notification_type,
                n.reference_type,
                n.reference_id,
                n.is_read,
                n.created_at
            FROM notifications n 
            LEFT JOIN users u ON u.user_id = n.user_id
        ";

        private Notification MapReader(DbDataReader reader)
        {
            return new Notification
            {
                NotificationId   = ReadValue(reader, "notification_id",   0L),
                Guid             = ReadValue(reader, "guid",              string.Empty),
                UserId           = ReadValue(reader, "user_id",           0L),
                Title            = ReadValue(reader, "title",             string.Empty),
                Message          = ReadValue(reader, "message",           string.Empty),
                NotificationType = ReadValue(reader, "notification_type", string.Empty),
                ReferenceType    = ReadValue(reader, "reference_type",    string.Empty),
                ReferenceId      = ReadValue(reader, "reference_id",      0L),
                IsRead           = ReadValue(reader, "is_read",           false),
                CreatedAt        = ReadValue(reader, "created_at",        DateTime.MinValue),
            };
        }

        public async Task<IEnumerable<Notification>> GetAllAsync()
        {
            string sql = BaseSelect + " ORDER BY n.created_at DESC";
            return await ExecuteReaderToListAsync(sql, MapReader);
        }

        public async Task<Notification?> GetByIdAsync(long id)
        {
            string sql = BaseSelect + " WHERE n.notification_id = @id";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("id", id) });
            return items.FirstOrDefault();
        }

        public async Task<List<Notification>> GetByUserIdAsync(long userId)
        {
            string sql = BaseSelect + " WHERE n.user_id = @userId ORDER BY n.created_at DESC";
            var items = await ExecuteReaderToListAsync(sql, MapReader,
                new[] { CreateParameter("userId", userId) });
            return items.ToList();
        }

        public async Task AddAsync(Notification entity)
        {
            if (string.IsNullOrWhiteSpace(entity.Guid))
            {
                entity.Guid = System.Guid.NewGuid().ToString();
            }

            if (entity.CreatedAt == default || entity.CreatedAt == DateTime.MinValue)
            {
                entity.CreatedAt = DateTime.UtcNow;
            }

            string sql = @"
                INSERT INTO notifications (guid, user_id, title, message, notification_type, reference_type, reference_id, is_read, created_at)
                VALUES (@guid, @user_id, @title, @message, @notification_type, @reference_type, @reference_id, @is_read, @created_at)
                RETURNING notification_id";

            long? newId = await ExecuteScalarAsync<long>(sql, new[]
            {
                CreateParameter("guid",              entity.Guid),
                CreateParameter("user_id",           entity.UserId),
                CreateParameter("title",             entity.Title),
                CreateParameter("message",           entity.Message),
                CreateParameter("notification_type", entity.NotificationType),
                CreateParameter("reference_type",    entity.ReferenceType),
                CreateParameter("reference_id",      entity.ReferenceId),
                CreateParameter("is_read",           entity.IsRead),
                CreateParameter("created_at",        entity.CreatedAt),
            });

            entity.NotificationId = newId.GetValueOrDefault();
        }

        public async Task UpdateAsync(Notification entity)
        {
            string sql = @"
                UPDATE notifications
                SET 
                    guid              = @guid,
                    user_id           = @user_id,
                    title             = @title,
                    message           = @message,
                    notification_type = @notification_type,
                    reference_type    = @reference_type,
                    reference_id      = @reference_id,
                    is_read           = @is_read,
                    created_at        = @created_at
                WHERE notification_id = @notification_id";

            await ExecuteNonQueryAsync(sql, new[]
            {
                CreateParameter("guid",              entity.Guid),
                CreateParameter("user_id",           entity.UserId),
                CreateParameter("title",             entity.Title),
                CreateParameter("message",           entity.Message),
                CreateParameter("notification_type", entity.NotificationType),
                CreateParameter("reference_type",    entity.ReferenceType),
                CreateParameter("reference_id",      entity.ReferenceId),
                CreateParameter("is_read",           entity.IsRead),
                CreateParameter("created_at",        entity.CreatedAt),
                CreateParameter("notification_id",   entity.NotificationId)
            });
        }

        public async Task DeleteAsync(long id)
        {
            string sql = "DELETE FROM notifications WHERE notification_id = @id";
            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", id) });
        }

        public async Task<bool> ExistsAsync(long id)
        {
            string sql = "SELECT COUNT(*) FROM notifications WHERE notification_id = @id";
            var count = await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("id", id) });
            return count > 0;
        }

        public async Task<PaginationModel<Notification>> GetPaginatedAsync(int pageNumber, int pageSize)
        {
            string sql = BaseSelect + @"
                ORDER BY n.created_at DESC
                LIMIT @size OFFSET @offset";

            var items = await ExecuteReaderToListAsync(sql, MapReader, new[]
            {
                CreateParameter("size",   pageSize),
                CreateParameter("offset", (pageNumber - 1) * pageSize),
            });

            int total = await ExecuteScalarAsync<int>("SELECT COUNT(*) FROM notifications");

            return new PaginationModel<Notification>
            {
                Items       = items,
                TotalCount  = total,
                PageSize    = pageSize,
                CurrentPage = pageNumber,
            };
        }

        public async Task MarkAsReadAsync(long notificationId)
        {
            const string sql = @"
                UPDATE notifications
                SET is_read = true
                WHERE notification_id = @id";

            await ExecuteNonQueryAsync(sql, new[] { CreateParameter("id", notificationId) });
        }

        public async Task<int> GetUnreadCountAsync(long userId)
        {
            const string sql = @"
                SELECT COUNT(*)
                FROM notifications
                WHERE user_id = @userId AND is_read = false";

            return await ExecuteScalarAsync<int>(sql, new[] { CreateParameter("userId", userId) });
        }
    }
}

