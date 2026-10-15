using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Patients
{
    public sealed class Patients
    {
        private long? _patientId;
        private string? _guid;
        private long? _userId;
        private string? _firstName;
        private string? _middleName;
        private string? _lastName;
        private string? _birthDate;
        private string? _gender;
        private string? _address;
        private string? _bloodType;

        public Patients() { }

        public Patients(long patientId,string guid,long userId, string firstName, string middleName, string lastName, string birthDate, string gender, string address, string bloodType)
        {
            _patientId = patientId;
            _guid = guid;
            _userId = userId;
            _firstName = firstName;
            _middleName = middleName;
            _lastName = lastName;
            _birthDate = birthDate;
            _gender = gender;
            _address = address;
            _bloodType = bloodType;
        }

        [JsonPropertyName("patient_id")]
        [JsonPropertyOrder(1)]
        public long PatientId
        {
            get => _patientId ?? 0L;
            set => _patientId = value;
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


        [JsonPropertyName("first_name")]
        [JsonPropertyOrder(4)]
        public string FirstName
        {
            get => _firstName ?? string.Empty;
            set => _firstName = NormalizeSpaces(value);
        }

        [JsonPropertyName("middle_name")]
        [JsonPropertyOrder(5)]
        public string MiddleName
        {
            get => _middleName ?? string.Empty;
            set => _middleName = NormalizeSpaces(value);
        }

        [JsonPropertyName("last_name")]
        [JsonPropertyOrder(6)]
        public string LastName
        {
            get => _lastName ?? string.Empty;
            set => _lastName = NormalizeSpaces(value);
        }

        [JsonPropertyName("birth_date")]
        [JsonPropertyOrder(7)]
        public string BirthDate
        {
            get => _birthDate ?? string.Empty;
            set => _birthDate = NormalizeSpaces(value);
        }

        [JsonPropertyName("gender")]
        [JsonPropertyOrder(8)]
        public string Gender
        {
            get => _gender ?? string.Empty;
            set => _gender = NormalizeSpaces(value);
        }

        [JsonPropertyName("address")]
        [JsonPropertyOrder(9)]
        public string Address
        {
            get => _address ?? string.Empty;
            set => _address = NormalizeSpaces(value);
        }

        [JsonPropertyName("blood_type")]
        [JsonPropertyOrder(10)]
        public string BloodType
        {
            get => _bloodType ?? string.Empty;
            set => _bloodType = NormalizeSpaces(value);
        }

        private string? _profilePicturePath;

        [JsonPropertyName("profile_picture_path")]
        [JsonPropertyOrder(11)]
        public string? ProfilePicturePath
        {
            get => _profilePicturePath;
            set => _profilePicturePath = value;
        }

        private static string NormalizeSpaces(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            return System.Text.RegularExpressions.Regex.Replace(input.Trim(), @"\s+", " ");
        }
    }
}