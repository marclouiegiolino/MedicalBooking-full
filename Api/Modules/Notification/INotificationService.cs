namespace Medical.Api.Modules.Notification
{
    /// <summary>
    /// Internal service for creating notifications.
    /// Other modules (Appointments, Lab Results, etc.) depend on this interface
    /// to dispatch notifications without going through the public HTTP layer.
    /// The public API has no general POST endpoint — this is the only way to create notifications.
    /// </summary>
    public interface INotificationService
    {
        /// <summary>
        /// Send a notification to a single user.
        /// </summary>
        /// <param name="userId">Target user.</param>
        /// <param name="title">Short title shown in the notification bell.</param>
        /// <param name="message">Full notification body.</param>
        /// <param name="notificationType">Domain category, e.g. "appointment", "lab_result", "billing".</param>
        /// <param name="referenceType">The entity type that triggered this notification, e.g. "appointment".</param>
        /// <param name="referenceId">The primary key of that entity (0 if not applicable).</param>
        Task SendAsync(
            long   userId,
            string title,
            string message,
            string notificationType,
            string referenceType = "",
            long   referenceId   = 0);

        /// <summary>
        /// Broadcast a manual admin announcement to all provided user IDs.
        /// Returns the number of notifications inserted.
        /// </summary>
        Task<int> BroadcastAsync(
            IEnumerable<long> userIds,
            string            title,
            string            message);
    }
}
