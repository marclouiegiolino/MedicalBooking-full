using Medical.Api.Main;

namespace Medical.Api.Modules.Notification
{
    public interface INotificationRepository
    {
        Task<IEnumerable<Notification>> GetAllAsync();
        Task<Notification?>             GetByIdAsync(long id);
        Task<List<Notification>>        GetByUserIdAsync(long userId);
        Task                            AddAsync(Notification entity);
        Task                            UpdateAsync(Notification entity);
        Task                            DeleteAsync(long id);
        Task<bool>                      ExistsAsync(long id);
        Task<PaginationModel<Notification>> GetPaginatedAsync(int pageNumber, int pageSize);

        /// <summary>Flips is_read = true directly in the DB without loading the full row.</summary>
        Task MarkAsReadAsync(long notificationId);

        /// <summary>Count of unread notifications owned by a specific user (for notification badge).</summary>
        Task<int> GetUnreadCountAsync(long userId);
    }
}


