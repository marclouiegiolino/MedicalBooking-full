using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.MedicalAttachment
{
    public sealed class MedicalAttachment : IEquatable<MedicalAttachment>
    {
        private long?    _attachmentId;
        private string?  _guid;
        private long?    _requestId;
        private string?  _fileName;
        private string?  _filePath;
        private string?  _uploadedAt;

        public MedicalAttachment() { }

        public MedicalAttachment(long attachmentId, string guid, long requestId, string fileName, string filePath,
                      string uploadedAt)
        {
            AttachmentId = attachmentId;
            Guid         = guid;
            RequestId    = requestId;
            FileName     = fileName;
            FilePath     = filePath;
            UploadedAt   = uploadedAt;
        }

        [JsonPropertyName("attachment_id")]
        [JsonPropertyOrder(1)]
        public long AttachmentId
        {
            get => _attachmentId ?? 0L;
            set => _attachmentId = value;
        }

        [JsonPropertyName("guid")]
        [JsonPropertyOrder(2)]
        public string Guid
        {
            get => _guid ?? string.Empty;
            set => _guid = value;
        }

        [JsonPropertyName("request_id")]
        [JsonPropertyOrder(3)]
        public long RequestId
        {
            get => _requestId ?? 0L;
            set => _requestId = value;
        }

        [JsonPropertyName("file_name")]
        [JsonPropertyOrder(3)]
        public string FileName
        {
            get => _fileName ?? string.Empty;
            set => _fileName = NormalizeSpaces(value);
        }

        [JsonPropertyName("file_path")]
        [JsonPropertyOrder(4)]
        public string FilePath
        {
            get => _filePath ?? string.Empty;
            set => _filePath = NormalizeSpaces(value);
        }

        [JsonPropertyName("uploaded_at")]
        [JsonPropertyOrder(5)]
        public string UploadedAt
        {
            get => _uploadedAt ?? string.Empty;
            set => _uploadedAt = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(MedicalAttachment? other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (AttachmentId > 0 || other.AttachmentId > 0) return AttachmentId == other.AttachmentId;
            return RequestId == other.RequestId
                && string.Equals(FileName, other.FileName, StringComparison.OrdinalIgnoreCase)
                && string.Equals(FilePath, other.FilePath, StringComparison.OrdinalIgnoreCase)
                && string.Equals(UploadedAt, other.UploadedAt, StringComparison.OrdinalIgnoreCase);
        }

        public override bool Equals(object? obj) => Equals(obj as MedicalAttachment);

        public override int GetHashCode()
        {
            if (AttachmentId > 0) return AttachmentId.GetHashCode();
            return HashCode.Combine(RequestId, FileName?.ToLowerInvariant(), FilePath?.ToLowerInvariant(), UploadedAt?.ToLowerInvariant());
        }

}}
