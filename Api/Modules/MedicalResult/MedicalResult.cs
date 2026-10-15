using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.MedicalResult
{
    public sealed class MedicalResult : IEquatable<MedicalResult>
    {
        private long?     _resultId;
        private string?   _guid;
        private long?     _requestId;
        private string?   _resultNotes;
        private string?   _resultFilePath;
        private long?     _uploadedByUserId;
        private string?   _uploadedAt;

        public MedicalResult() { }

        public MedicalResult(long resultId, string guid, long requestId,
                              string? resultNotes, string? resultFilePath,
                              long uploadedByUserId, string? uploadedAt)
        {
            ResultId         = resultId;
            Guid             = guid;
            RequestId        = requestId;
            ResultNotes      = resultNotes;
            ResultFilePath   = resultFilePath;
            UploadedByUserId = uploadedByUserId;
            UploadedAt       = uploadedAt;
        }

        [JsonPropertyName("result_id")]
        [JsonPropertyOrder(1)]
        public long ResultId
        {
            get => _resultId ?? 0L;
            set => _resultId = value;
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

        [JsonPropertyName("result_notes")]
        [JsonPropertyOrder(4)]
        public string? ResultNotes
        {
            get => _resultNotes;
            set => _resultNotes = NormalizeSpaces(value);
        }

        [JsonPropertyName("result_file_path")]
        [JsonPropertyOrder(5)]
        public string? ResultFilePath
        {
            get => _resultFilePath;
            set => _resultFilePath = NormalizeSpaces(value);
        }

        /// <summary>The user_id of the Lab/Radiology staff who uploaded this result.</summary>
        [JsonPropertyName("uploaded_by_user_id")]
        [JsonPropertyOrder(6)]
        public long UploadedByUserId
        {
            get => _uploadedByUserId ?? 0L;
            set => _uploadedByUserId = value;
        }

        [JsonPropertyName("uploaded_at")]
        [JsonPropertyOrder(7)]
        public string? UploadedAt
        {
            get => _uploadedAt;
            set => _uploadedAt = value;
        }

        private static string? NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return null;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(MedicalResult? other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (ResultId > 0 || other.ResultId > 0) return ResultId == other.ResultId;
            return RequestId == other.RequestId
                && string.Equals(ResultNotes,    other.ResultNotes,    StringComparison.OrdinalIgnoreCase)
                && string.Equals(ResultFilePath, other.ResultFilePath, StringComparison.OrdinalIgnoreCase)
                && string.Equals(UploadedAt,     other.UploadedAt,     StringComparison.OrdinalIgnoreCase);
        }

        public override bool Equals(object? obj) => Equals(obj as MedicalResult);

        public override int GetHashCode()
        {
            if (ResultId > 0) return ResultId.GetHashCode();
            return HashCode.Combine(RequestId,
                ResultNotes?.ToLowerInvariant(),
                ResultFilePath?.ToLowerInvariant(),
                UploadedAt?.ToLowerInvariant());
        }
    }
}
