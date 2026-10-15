using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.MedicalRequest
{
    public sealed class MedicalRequest : IEquatable<MedicalRequest>
    {
        private long?     _requestId;
        private string?   _guid;
        private long?     _consultationId;
        private long?     _patientId;
        private long?     _doctorId;
        private long?     _requestTypeId;
        private long?     _statusId ;
        private string?   _notes;
        private DateTime? _createdAt;
        private DateTime? _updatedAt;
        private bool?     _isDeleted;
        private DateTime? _deletedAt;

        public MedicalRequest() { }

        public MedicalRequest(long requestId, string guid, long consultationId,
                              long patientId, long doctorId, long requestTypeId,
                              long statusId, string notes, DateTime createdAt,
                              DateTime updatedAt, bool isDeleted, DateTime deletedAt)
        {
            RequestId       = requestId;
            Guid            = guid;
            ConsultationId  = consultationId;
            PatientId       = patientId;
            DoctorId        = doctorId;
            RequestTypeId   = requestTypeId;
            StatusId        = statusId;
            Notes           = notes;
            CreatedAt       = createdAt;
            UpdatedAt       = updatedAt;
            IsDeleted       = isDeleted;
            DeletedAt       = deletedAt;
        }

        [JsonPropertyName("request_id")]
        [JsonPropertyOrder(1)]
        public long RequestId
        {
            get => _requestId ?? 0L;
            set => _requestId = value;
        }

        [JsonPropertyName("guid")]
        [JsonPropertyOrder(2)]
        public string Guid
        {
            get => _guid ?? string.Empty;
            set => _guid = value;
        }

        [JsonPropertyName("consultation_id")]
        [JsonPropertyOrder(3)]
        public long ConsultationId
        {
            get => _consultationId ?? 0L;
            set => _consultationId = value;
        }

        [JsonPropertyName("patient_id")]
        [JsonPropertyOrder(4)]
        public long PatientId
        {
            get => _patientId ?? 0L;
            set => _patientId = value;
        }

        [JsonPropertyName("doctor_id")]
        [JsonPropertyOrder(5)]
        public long DoctorId
        {
            get => _doctorId ?? 0L;
            set => _doctorId = value;
        }

        [JsonPropertyName("request_type_id")]
        [JsonPropertyOrder(6)]
        public long RequestTypeId
        {
            get => _requestTypeId ?? 0L;
            set => _requestTypeId = value;
        }

        [JsonPropertyName("status_id")]
        [JsonPropertyOrder(7)]
        public long StatusId
        {
            get => _statusId ?? 0L;
            set => _statusId = value;
        }

        [JsonPropertyName("notes")]
        [JsonPropertyOrder(8)]
        public string? Notes
        {
            get => _notes;
            set => _notes = value;
        }

        [JsonPropertyName("status")]
        [JsonPropertyOrder(9)]
        public string Status => StatusId switch
        {
            1 => "Pending",
            2 => "In Progress",
            3 => "Completed",
            4 => "Rejected",
            _ => "Pending"
        };

        [JsonPropertyName("request_type_name")]
        [JsonPropertyOrder(10)]
        public string? RequestTypeName { get; set; }

        [JsonPropertyName("created_at")]
        [JsonPropertyOrder(9)]
        public DateTime CreatedAt
        {
            get => _createdAt ?? DateTime.MinValue;
            set => _createdAt = value;
        }

        [JsonPropertyName("updated_at")]
        [JsonPropertyOrder(10)]
        public DateTime UpdatedAt
        {
            get => _updatedAt ?? DateTime.MinValue;
            set => _updatedAt = value;
        }

        [JsonPropertyName("is_deleted")]
        [JsonPropertyOrder(11)]
        public bool IsDeleted
        {
            get => _isDeleted ?? false;
            set => _isDeleted = value;
        }

        [JsonPropertyName("deleted_at")]
        [JsonPropertyOrder(12)]
        public DateTime? DeletedAt
        {
            get => _deletedAt;
            set => _deletedAt = value;
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(MedicalRequest? other)
        {
            if (other is null) return false;
            return RequestId == other.RequestId;
        }

        public override bool Equals(object? obj) => Equals(obj as MedicalRequest);

        public override int GetHashCode() => RequestId.GetHashCode();
    }
}