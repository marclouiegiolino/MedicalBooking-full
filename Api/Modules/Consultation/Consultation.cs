using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Consultation
{
    public sealed class Consultation : IEquatable<Consultation>
    {
        private long?   _consultationId;
        private string? _guid;
        private long?   _appointmentId;
        private long?   _doctorId;
        private long?   _patientId;
        private string? _diagnosis;
        private string? _consultationNotes;
        private string? _treatmentPlan;
        private string? _prescription;
        private string? _createdAt;
        private string? _updatedAt;
        private bool?   _isDeleted;
        private string? _deletedAt;
        private string? _completedAt;

        public Consultation() { }

        public Consultation(
            long   consultationId,
            string guid,
            long   appointmentId,
            long   doctorId,
            long   patientId,
            string diagnosis,
            string consultationNotes,
            string treatmentPlan,
            string prescription,
            string createdAt,
            string updatedAt,
            bool   isDeleted,
            string deletedAt,
            string completedAt)
        {
            ConsultationId    = consultationId;
            Guid              = guid;
            AppointmentId     = appointmentId;
            DoctorId          = doctorId;
            PatientId         = patientId;
            Diagnosis         = diagnosis;
            ConsultationNotes = consultationNotes;
            TreatmentPlan     = treatmentPlan;
            Prescription      = prescription;
            CreatedAt         = createdAt;
            UpdatedAt         = updatedAt;
            IsDeleted         = isDeleted;
            DeletedAt         = deletedAt;
            CompletedAt       = completedAt;
        }

        [JsonPropertyName("consultation_id")]
        [JsonPropertyOrder(1)]
        public long ConsultationId
        {
            get => _consultationId ?? 0L;
            set => _consultationId = value;
        }

        [JsonPropertyName("guid")]
        [JsonPropertyOrder(2)]
        public string Guid
        {
            get => _guid ?? string.Empty;
            set => _guid = value?.Trim() ?? string.Empty;
        }

        [JsonPropertyName("appointment_id")]
        [JsonPropertyOrder(3)]
        public long AppointmentId
        {
            get => _appointmentId ?? 0L;
            set => _appointmentId = value;
        }

        [JsonPropertyName("doctor_id")]
        [JsonPropertyOrder(4)]
        public long DoctorId
        {
            get => _doctorId ?? 0L;
            set => _doctorId = value;
        }

        [JsonPropertyName("patient_id")]
        [JsonPropertyOrder(5)]
        public long PatientId
        {
            get => _patientId ?? 0L;
            set => _patientId = value;
        }

        [JsonPropertyName("diagnosis")]
        [JsonPropertyOrder(6)]
        public string Diagnosis
        {
            get => _diagnosis ?? string.Empty;
            set => _diagnosis = NormalizeSpaces(value);
        }

        [JsonPropertyName("consultation_notes")]
        [JsonPropertyOrder(7)]
        public string ConsultationNotes
        {
            get => _consultationNotes ?? string.Empty;
            set => _consultationNotes = NormalizeSpaces(value);
        }

        [JsonPropertyName("treatment_plan")]
        [JsonPropertyOrder(8)]
        public string TreatmentPlan
        {
            get => _treatmentPlan ?? string.Empty;
            set => _treatmentPlan = NormalizeSpaces(value);
        }

        [JsonPropertyName("prescription")]
        [JsonPropertyOrder(9)]
        public string Prescription
        {
            get => _prescription ?? string.Empty;
            set => _prescription = NormalizeSpaces(value);
        }

        [JsonPropertyName("created_at")]
        [JsonPropertyOrder(10)]
        public string CreatedAt
        {
            get => _createdAt ?? string.Empty;
            set => _createdAt = NormalizeSpaces(value);
        }

        [JsonPropertyName("updated_at")]
        [JsonPropertyOrder(11)]
        public string UpdatedAt
        {
            get => _updatedAt ?? string.Empty;
            set => _updatedAt = NormalizeSpaces(value);
        }

        [JsonPropertyName("is_deleted")]
        [JsonPropertyOrder(12)]
        public bool IsDeleted
        {
            get => _isDeleted ?? false;
            set => _isDeleted = value;
        }

        [JsonPropertyName("deleted_at")]
        [JsonPropertyOrder(13)]
        public string DeletedAt
        {
            get => _deletedAt ?? string.Empty;
            set => _deletedAt = NormalizeSpaces(value);
        }
        
        [JsonPropertyName("completed_at")]
        [JsonPropertyOrder(14)]
        public string CompletedAt
        {
            get => _completedAt ?? string.Empty;
            set => _completedAt = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(Consultation? other)
        {
            if (other is null) return false;
            return ConsultationId == other.ConsultationId;
        }

        public override bool Equals(object? obj) => Equals(obj as Consultation);

        public override int GetHashCode() => ConsultationId.GetHashCode();
    }
}