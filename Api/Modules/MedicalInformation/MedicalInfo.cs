using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.MedicalInformation
{
    public sealed class MedicalInfo : IEquatable<MedicalInfo>
    {
        private long?    _medicalInfoId;
        private long?    _patientId;
        private string? _allergies;
        private string? _medicalHistory;
        private string? _medications;

        public MedicalInfo() { }

        public MedicalInfo(long medicalInfoId, long patientId, string allergies, string medicalHistory, string medications)
        {
            MedicalInfoId   = medicalInfoId;
            PatientId       = patientId;
            Allergies       = allergies;
            MedicalHistory  = medicalHistory;
            Medications     = medications;
        }

        [JsonPropertyName("medical_info_id")]
        [JsonPropertyOrder(1)]
        public long MedicalInfoId
        {
            get => _medicalInfoId ?? 0L;
            set => _medicalInfoId = value;
        }

        [JsonPropertyName("patient_id")]
        [JsonPropertyOrder(2)]
        public long PatientId
        {
            get => _patientId ?? 0L;
            set => _patientId = value;
        }

        [JsonPropertyName("allergies")]
        [JsonPropertyOrder(3)]
        public string Allergies
        {
            get => _allergies ?? string.Empty;
            set => _allergies = NormalizeSpaces(value);
        }

        [JsonPropertyName("medical_history")]
        [JsonPropertyOrder(4)]
        public string MedicalHistory
        {
            get => _medicalHistory ?? string.Empty;
            set => _medicalHistory = NormalizeSpaces(value);
        }

        [JsonPropertyName("medications")]
        [JsonPropertyOrder(5)]
        public string Medications
        {
            get => _medications ?? string.Empty;
            set => _medications = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(MedicalInfo? other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (MedicalInfoId > 0 || other.MedicalInfoId > 0) return MedicalInfoId == other.MedicalInfoId;
            return PatientId == other.PatientId;
        }

        public override bool Equals(object? obj) => Equals(obj as MedicalInfo);

        public override int GetHashCode()
        {
            if (MedicalInfoId > 0) return MedicalInfoId.GetHashCode();
            return PatientId.GetHashCode();
        }

    }

}