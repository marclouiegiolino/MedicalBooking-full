namespace Medical.Api.Modules.Notification
{
    /// <summary>
    /// Implements <see cref="INotificationService"/>.
    /// This is the single point of entry for all notification creation in the system.
    /// Controllers must NOT call the repository's AddAsync directly — they go through this service.
    /// </summary>
    public class NotificationService : INotificationService
    {
        private readonly INotificationRepository _repository;

        public NotificationService(INotificationRepository repository)
        {
            _repository = repository;
        }

        /// <inheritdoc/>
        public async Task SendAsync(
            long   userId,
            string title,
            string message,
            string notificationType,
            string referenceType = "",
            long   referenceId   = 0)
        {
            var notification = new Notification
            {
                UserId           = userId,
                Title            = title,
                Message          = message,
                NotificationType = notificationType,
                ReferenceType    = referenceType,
                ReferenceId      = referenceId,
                IsRead           = false,
                CreatedAt        = DateTime.UtcNow,
                Guid             = System.Guid.NewGuid().ToString(),
            };

            await _repository.AddAsync(notification);
        }

        /// <inheritdoc/>
        public async Task<int> BroadcastAsync(
            IEnumerable<long> userIds,
            string            title,
            string            message)
        {
            var now   = DateTime.UtcNow;
            int count = 0;

            foreach (long userId in userIds)
            {
                var notification = new Notification
                {
                    UserId           = userId,
                    Title            = title,
                    Message          = message,
                    NotificationType = "announcement",
                    ReferenceType    = string.Empty,
                    ReferenceId      = 0,
                    IsRead           = false,
                    CreatedAt        = now,
                    Guid             = System.Guid.NewGuid().ToString(),
                };

                await _repository.AddAsync(notification);
                count++;
            }

            return count;
        }
    }
}
