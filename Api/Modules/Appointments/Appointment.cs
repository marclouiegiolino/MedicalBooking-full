using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Appointments
{
    public sealed class Appointment : IEquatable<Appointment>
    {
        private long?    _appointmentId;
        private long?    _patientId;
        private long?    _doctorId;
        private long?    _appointmentTypeId;
        private string?  _appointmentDate;
        private string?  _appointmentTime;
        private long?    _statusId;
        private string?  _remarks;
        private string?  _createdAt;
        private string?  _updatedAt;
        private bool?    _isDeleted;
        private string?  _deletedAt;


        public Appointment() { }

        public Appointment(long appointmentId, long patientId, long doctorId, long appointmentTypeId,
                      string appointmentDate, string appointmentTime, long statusId, string remarks,
                      string createdAt, string updatedAt, bool isDeleted, string deletedAt)
        {
            AppointmentId     = appointmentId;
            PatientId         = patientId;
            DoctorId          = doctorId;
            AppointmentTypeId = appointmentTypeId;
            AppointmentDate   = appointmentDate;
            AppointmentTime   = appointmentTime;
            StatusId          = statusId;
            Remarks           = remarks;
            CreatedAt         = createdAt;
            UpdatedAt         = updatedAt;
            IsDeleted         = isDeleted;
            DeletedAt         = deletedAt;
        }

        [JsonPropertyName("appointment_id")]
        [JsonPropertyOrder(1)]
        public long AppointmentId
        {
            get => _appointmentId ?? 0L;
            set => _appointmentId = value;
        }

        [JsonPropertyName("patient_id")]
        [JsonPropertyOrder(2)]
        public long PatientId
        {
            get => _patientId ?? 0L;
            set => _patientId = value;
        }

        [JsonPropertyName("doctor_id")]
        [JsonPropertyOrder(3)]
        public long DoctorId
        {
            get => _doctorId ?? 0L;
            set => _doctorId = value;
        }

        [JsonPropertyName("appointment_type_id")]
        [JsonPropertyOrder(4)]
        public long AppointmentTypeId
        {
            get => _appointmentTypeId ?? 0L;
            set => _appointmentTypeId = value;
        }

        [JsonPropertyName("appointment_date")]
        [JsonPropertyOrder(5)]
        public string AppointmentDate
        {
            get => _appointmentDate ?? string.Empty;
            set => _appointmentDate = NormalizeSpaces(value);
        }

        [JsonPropertyName("appointment_time")]
        [JsonPropertyOrder(6)]
        public string AppointmentTime
        {
            get => _appointmentTime ?? string.Empty;
            set => _appointmentTime = NormalizeSpaces(value);
        }

        [JsonPropertyName("status_id")]
        [JsonPropertyOrder(7)]
        public long StatusId
        {
            get => _statusId ?? 0L;
            set => _statusId = value;
        }

        [JsonPropertyName("status")]
        [JsonPropertyOrder(8)]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("remarks")]
        [JsonPropertyOrder(8)]
        public string Remarks
        {
            get => _remarks ?? string.Empty;
            set => _remarks = NormalizeSpaces(value);
        }

        [JsonPropertyName("created_at")]
        [JsonPropertyOrder(9)]
        public string CreatedAt
        {
            get => _createdAt ?? string.Empty;
            set => _createdAt = NormalizeSpaces(value);
        }

        [JsonPropertyName("updated_at")]
        [JsonPropertyOrder(10)]
        public string UpdatedAt
        {
            get => _updatedAt ?? string.Empty;
            set => _updatedAt = NormalizeSpaces(value);
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
        public string DeletedAt
        {
            get => _deletedAt ?? string.Empty;
            set => _deletedAt = NormalizeSpaces(value);
        }


        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(Appointment? other)
        {
            if (other is null) return false;
            return AppointmentId == other.AppointmentId;
        }

        public override bool Equals(object? obj) => Equals(obj as Appointment);

        public override int GetHashCode() => AppointmentId.GetHashCode();
    }
}