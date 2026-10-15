using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Doctor
{
    public sealed class Doctor : IEquatable<Doctor>
    {
        private long?    _doctor_id;
        private long?    _user_id;
        private string?  _guid;
        private long?    _department_id;
        private long?    _specialty_id;
        private decimal? _consultationFee;
        private string?  _licenseNumber;
        private string?  _firstName;
        private string?  _middleName;
        private string?  _lastName;
        private bool?    _isTimedIn;
        private long?    _hospitalId;
        private string?  _profilePicturePath;

        public Doctor() { }

        public Doctor(long    doctorId,
                      long    userId,
                      string  guid,
                      long    departmentId,
                      long    specialtyId,
                      string  licenseNumber,
                      decimal consultationFee,
                      string  firstName,
                      string  middleName,
                      string  lastName,
                      bool    isTimedIn,
                      long    hospitalId,
                      string  profilePicturePath)
        {
            DoctorId        = doctorId;
            UserId          = userId;
            Guid            = guid;
            DepartmentId    = departmentId;
            SpecialtyId     = specialtyId;
            LicenseNumber   = licenseNumber;
            ConsultationFee = consultationFee;
            FirstName       = firstName;
            MiddleName      = middleName;
            LastName        = lastName;
            IsTimedIn       = isTimedIn;
            HospitalId      = hospitalId;
            ProfilePicturePath = profilePicturePath;
        }

        [JsonPropertyName("doctor_id")]
        [JsonPropertyOrder(1)]
        public long DoctorId
        {
            get => _doctor_id ?? 0L;
            set => _doctor_id = value;
        }

        [JsonPropertyName("user_id")]
        [JsonPropertyOrder(2)]
        public long UserId
        {
            get => _user_id ?? 0L;
            set => _user_id = value;
        }

        [JsonPropertyName("guid")]
        [JsonPropertyOrder(3)]
        public string Guid
        {
            get => _guid ?? string.Empty;
            set => _guid = value;
        }

        [JsonPropertyName("department_id")]
        [JsonPropertyOrder(4)]
        public long DepartmentId
        {
            get => _department_id ?? 0L;
            set => _department_id = value;
        }

        [JsonPropertyName("specialty_id")]
        [JsonPropertyOrder(5)]
        public long SpecialtyId
        {
            get => _specialty_id ?? 0L;
            set => _specialty_id = value;
        }

        [JsonPropertyName("license_number")]
        [JsonPropertyOrder(6)]
        public string LicenseNumber
        {
            get => _licenseNumber ?? string.Empty;
            set => _licenseNumber = NormalizeSpaces(value);
        }

        [JsonPropertyName("consultation_fee")]
        [JsonPropertyOrder(7)]
        public decimal ConsultationFee
        {
            get => _consultationFee ?? 0M;
            set => _consultationFee = value;
        }

        [JsonPropertyName("first_name")]
        [JsonPropertyOrder(8)]
        public string FirstName
        {
            get => _firstName ?? string.Empty;
            set => _firstName = NormalizeSpaces(value);
        }

        [JsonPropertyName("middle_name")]
        [JsonPropertyOrder(9)]
        public string MiddleName
        {
            get => _middleName ?? string.Empty;
            set => _middleName = NormalizeSpaces(value);
        }

        [JsonPropertyName("last_name")]
        [JsonPropertyOrder(10)]
        public string LastName
        {
            get => _lastName ?? string.Empty;
            set => _lastName = NormalizeSpaces(value);
        }

        [JsonPropertyName("is_timed_in")]
        [JsonPropertyOrder(11)]
        public bool IsTimedIn
        {
            get => _isTimedIn ?? false;
            set => _isTimedIn = value;
        }

        [JsonPropertyName("hospital_id")]
        [JsonPropertyOrder(12)]
        public long HospitalId
        {
            get => _hospitalId ?? 0L;
            set => _hospitalId = value;
        }

        [JsonPropertyName("profile_picture_path")] 
        [JsonPropertyOrder(13)]
        public string? ProfilePicturePath
        {
            get => _profilePicturePath;
            set => _profilePicturePath = value;
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(Doctor? other)
        {
            if (other is null) return false;
            return DoctorId == other.DoctorId;
        }

        public override bool Equals(object? obj) => Equals(obj as Doctor);

        public override int GetHashCode() => DoctorId.GetHashCode();
    }
}