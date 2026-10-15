using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Insurance
{
    public sealed class Insurance : IEquatable<Insurance>
    {
        private long?   _insuranceId;
        private string? _guid;
        private long?   _patientId;
        private string? _providerName;
        private string? _policyNumber;
        private string? _coverageType;
        private string? _validUntil;
        private bool? _isPrimary;
        private string? _createdAt;
        private string? _updatedAt;

        public Insurance() { }

        public Insurance(long insuranceId, string guid, long patientId, string providerName, string policyNumber, string coverageType, string validUntil, bool isPrimary, string createdAt, string updatedAt)
        {
            InsuranceId       = insuranceId;
            Guid              = guid;
            PatientId         = patientId;
            ProviderName      = providerName;
            PolicyNumber      = policyNumber;
            CoverageType      = coverageType;
            ValidUntil        = validUntil;
            IsPrimary         = isPrimary;
            CreatedAt         = createdAt;
            UpdatedAt         = updatedAt;
        }

        [JsonPropertyName("insurance_id")]
        [JsonPropertyOrder(1)]
        public long InsuranceId
        {
            get => _insuranceId ?? 0L;
            set => _insuranceId = value;
        }

        [JsonPropertyName("guid")]
        [JsonPropertyOrder(2)]
        public string? Guid
        {
            get => _guid;
            set => _guid = value;
        }

        [JsonPropertyName("patient_id")]
        [JsonPropertyOrder(3)]
        public long PatientId
        {
            get => _patientId ?? 0L;
            set => _patientId = value;
        }

        [JsonPropertyName("provider_name")] 
        [JsonPropertyOrder(3)]
        public string ProviderName
        {
            get => _providerName ?? string.Empty;
            set => _providerName = NormalizeSpaces(value);
        }

        [JsonPropertyName("policy_number")]
        [JsonPropertyOrder(4)]
        public string PolicyNumber
        {
            get => _policyNumber ?? string.Empty;
            set => _policyNumber = NormalizeSpaces(value);
        }

        [JsonPropertyName("coverage_type")]
        [JsonPropertyOrder(5)]
        public string CoverageType
        {
            get => _coverageType ?? string.Empty;
            set => _coverageType = NormalizeSpaces(value);
        }

        [JsonPropertyName("valid_until")]
        [JsonPropertyOrder(6)]
        public string ValidUntil
        {
            get => _validUntil ?? string.Empty;
            set => _validUntil = NormalizeSpaces(value);
        }

        [JsonPropertyName("is_primary")]
        [JsonPropertyOrder(7)]
        public bool IsPrimary
        {
            get => _isPrimary ?? false;
            set => _isPrimary = value;
        }

        [JsonPropertyName("created_at")]
        [JsonPropertyOrder(8)]
        public string CreatedAt
        {
            get => _createdAt ?? string.Empty;
            set => _createdAt = NormalizeSpaces(value);
        }

        [JsonPropertyName("updated_at")]
        [JsonPropertyOrder(9)]
        public string UpdatedAt
        {
            get => _updatedAt ?? string.Empty;
            set => _updatedAt = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(Insurance? other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (InsuranceId > 0 || other.InsuranceId > 0) return InsuranceId == other.InsuranceId;
            return PatientId == other.PatientId
                && string.Equals(PolicyNumber, other.PolicyNumber, StringComparison.OrdinalIgnoreCase);
        }

        public override bool Equals(object? obj) => Equals(obj as Insurance);

        public override int GetHashCode()
        {
            if (InsuranceId > 0) return InsuranceId.GetHashCode();
            return HashCode.Combine(PatientId, PolicyNumber?.ToLowerInvariant());
        }

    }

}