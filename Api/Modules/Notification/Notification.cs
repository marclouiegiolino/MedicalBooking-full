using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Notification
{
    public sealed class Notification : IEquatable<Notification>
    {
        private long?    _notificationId;
        private string?    _guid;
        private long? _userId;
        private string? _title;
        private string? _message;
        private string? _notificationType;
        private string? _referenceType;
        private long? _referenceId;
        private bool? _isRead;
        private DateTime? _createdAt;


        public Notification() { }

        public Notification(long notificationId, string guid, long userId, string title, string message,
                      string notificationType, string referenceType, long referenceId, bool isRead, DateTime createdAt)
        {
            NotificationId       = notificationId;
            Guid       = guid;
            UserId       = userId;
            Title       = title;
            Message        = message;
            NotificationType    = notificationType;
            ReferenceType           = referenceType;
            ReferenceId           = referenceId;
            IsRead           = isRead;
            CreatedAt           = createdAt;
        }

        [JsonPropertyName("notification_id")]
        [JsonPropertyOrder(1)]
        public long NotificationId
        {
            get => _notificationId ?? 0L;
            set => _notificationId = value;
        }

        [JsonPropertyName("guid")]
        [JsonPropertyOrder(2)]
        public string Guid
        {
            get => _guid ?? string.Empty;
            set => _guid = value;
        }

        [JsonPropertyName("user_id")]
        [JsonPropertyOrder(3)]
        public long UserId
        {
            get => _userId ?? 0L;
            set => _userId = value;
        }

        [JsonPropertyName("title")]
        [JsonPropertyOrder(4)]
        public string Title
        {
            get => _title ?? string.Empty;
            set => _title = NormalizeSpaces(value);
        }

        [JsonPropertyName("message")]
        [JsonPropertyOrder(5)]
        public string Message
        {
            get => _message ?? string.Empty;
            set => _message = NormalizeSpaces(value);
        }

        [JsonPropertyName("notification_type")]
        [JsonPropertyOrder(6)]
        public string NotificationType
        {
            get => _notificationType ?? string.Empty;
            set => _notificationType = NormalizeSpaces(value);
        }

        [JsonPropertyName("reference_type")]
        [JsonPropertyOrder(7)]
        public string ReferenceType
        {
            get => _referenceType ?? string.Empty;
            set => _referenceType = NormalizeSpaces(value);
        }

        [JsonPropertyName("reference_id")]
        [JsonPropertyOrder(8)]
        public long ReferenceId
        {
            get => _referenceId ?? 0L;
            set => _referenceId = value;
        }

        [JsonPropertyName("is_read")]
        [JsonPropertyOrder(9)]
        public bool IsRead
        {
            get => _isRead ?? false;
            set => _isRead = value;
        }

        [JsonPropertyName("created_at")]
        [JsonPropertyOrder(10)]
        public DateTime CreatedAt
        {
            get => _createdAt ?? DateTime.MinValue;
            set => _createdAt = value;
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(Notification? other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (NotificationId > 0 || other.NotificationId > 0) return NotificationId == other.NotificationId;
            return UserId == other.UserId
                && string.Equals(Title, other.Title, StringComparison.OrdinalIgnoreCase)
                && string.Equals(Message, other.Message, StringComparison.OrdinalIgnoreCase)
                && string.Equals(NotificationType, other.NotificationType, StringComparison.OrdinalIgnoreCase);
        }

        public override bool Equals(object? obj) => Equals(obj as Notification);

        public override int GetHashCode()
        {
            if (NotificationId > 0) return NotificationId.GetHashCode();
            return HashCode.Combine(UserId, Title?.ToLowerInvariant(), Message?.ToLowerInvariant(), NotificationType?.ToLowerInvariant());
        }

}}
