using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Notification
{
    /// <summary>
    /// Request body for the Admin-only POST /api/notification/broadcast endpoint.
    /// </summary>
    public sealed class BroadcastRequest
    {
        /// <summary>
        /// Explicit list of user IDs to target.
        /// If null or empty and <see cref="SendToAll"/> is true, the broadcast goes to every active user.
        /// </summary>
        [JsonPropertyName("user_ids")]
        public List<long>? UserIds { get; set; }

        /// <summary>
        /// When true, the broadcast is sent to all users (Admin pulls the full user list server-side).
        /// Ignored when <see cref="UserIds"/> is provided.
        /// </summary>
        [JsonPropertyName("send_to_all")]
        public bool SendToAll { get; set; }

        [Required]
        [JsonPropertyName("title")]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [JsonPropertyName("message")]
        [MaxLength(2000)]
        public string Message { get; set; } = string.Empty;
    }
}
