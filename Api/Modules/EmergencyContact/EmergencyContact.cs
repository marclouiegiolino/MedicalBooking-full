using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.EmergencyContact
{
    public sealed class EmergencyContact : IEquatable<EmergencyContact>
    {
        private long?    _contactId;
        private long?    _patientId;
        private string? _firstName;
        private string? _lastName;
        private string? _relationship;
        private string? _phone;

        public EmergencyContact() { }

        public EmergencyContact(long contactId, long patientId, string firstName, string lastName,
                      string relationship, string phone)
        {
            ContactId       = contactId;
            PatientId       = patientId;
            FirstName       = firstName;
            LastName        = lastName;
            Relationship    = relationship;
            Phone           = phone;
        }

        [JsonPropertyName("contact_id")]
        [JsonPropertyOrder(1)]
        public long ContactId
        {
            get => _contactId ?? 0L;
            set => _contactId = value;
        }

        [JsonPropertyName("patient_id")]
        [JsonPropertyOrder(2)]
        public long PatientId
        {
            get => _patientId ?? 0L;
            set => _patientId = value;
        }

        [JsonPropertyName("first_name")]
        [JsonPropertyOrder(3)]
        public string FirstName
        {
            get => _firstName ?? string.Empty;
            set => _firstName = NormalizeSpaces(value);
        }

        [JsonPropertyName("last_name")]
        [JsonPropertyOrder(4)]
        public string LastName
        {
            get => _lastName ?? string.Empty;
            set => _lastName = NormalizeSpaces(value);
        }

        [JsonPropertyName("relationship")]
        [JsonPropertyOrder(5)]
        public string Relationship
        {
            get => _relationship ?? string.Empty;
            set => _relationship = NormalizeSpaces(value);
        }

        [JsonPropertyName("phone")]
        [JsonPropertyOrder(6)]
        public string Phone
        {
            get => _phone ?? string.Empty;
            set => _phone = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(EmergencyContact? other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (ContactId > 0 || other.ContactId > 0) return ContactId == other.ContactId;
            return PatientId == other.PatientId
                && string.Equals(FirstName, other.FirstName, StringComparison.OrdinalIgnoreCase)
                && string.Equals(LastName, other.LastName, StringComparison.OrdinalIgnoreCase)
                && string.Equals(Phone, other.Phone, StringComparison.OrdinalIgnoreCase);
        }

        public override bool Equals(object? obj) => Equals(obj as EmergencyContact);

        public override int GetHashCode()
        {
            if (ContactId > 0) return ContactId.GetHashCode();
            return HashCode.Combine(PatientId, FirstName?.ToLowerInvariant(), LastName?.ToLowerInvariant(), Phone?.ToLowerInvariant());
        }

}}
