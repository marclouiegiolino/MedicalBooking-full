using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Staff
{
    public sealed class Staff : IEquatable<Staff>
    {
        private long?    _staffId;
        private string?  _guid;
        private long?    _userId;
        private long?   _accessId;
        private long?    _roleId;
        private long?    _departmentId;
        private string? _employeeNumber;
        private string?  _firstName;
        private string?  _middleName;
        private string?  _lastName;
        private string?  _createdAt;
        private string?  _updatedAt;

        public Staff() { }

        public Staff(long staffId, long userId, string guid, long? departmentId, 
                      long accessId, long roleId, string employeeNumber,
                      string firstName, string middleName, string lastName, string createdAt, string updatedAt)
        {
            StaffId         = staffId;
            UserId          = userId;
            Guid            = guid;
            DepartmentId    = departmentId;
            AccessId        = accessId;
            RoleId       = roleId;
            EmployeeNumber  = employeeNumber;
            FirstName       = firstName;
            MiddleName      = middleName;
            LastName        = lastName;
            CreatedAt       = createdAt;
            UpdatedAt       = updatedAt;
        }

        [JsonPropertyName("staff_id")]
        [JsonPropertyOrder(1)]
        public long StaffId
        {
            get => _staffId ?? 0L;
            set => _staffId = value;
        }

        [JsonPropertyName("user_id")]
        [JsonPropertyOrder(2)]
        public long UserId
        {
            get => _userId ?? 0L;
            set => _userId = value;
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
        public long? DepartmentId
        {
            get => _departmentId;
            set => _departmentId = value;
        }

        [JsonPropertyName("access_id")]
        [JsonPropertyOrder(5)]
        public long AccessId
        {
            get => _accessId ?? 0L;
            set => _accessId = value;
        }

        [JsonPropertyName("role_id")]
        [JsonPropertyOrder(6)]
        public long RoleId
        {
            get => _roleId ?? 0L;
            set => _roleId = value;
        }

        [JsonPropertyName("employee_no")]
        [JsonPropertyOrder(7)]
        public string EmployeeNumber
        {
            get => _employeeNumber ?? string.Empty;
            set => _employeeNumber = NormalizeSpaces(value);
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

        [JsonPropertyName("created_at")]
        [JsonPropertyOrder(11)]
        public string CreatedAt
        {
            get => _createdAt ?? string.Empty;
            set => _createdAt = value;
        }

        [JsonPropertyName("updated_at")]
        [JsonPropertyOrder(12)]
        public string UpdatedAt
        {
            get => _updatedAt ?? string.Empty;
            set => _updatedAt = value;
        }

        private string? _profilePicturePath;

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

        public bool Equals(Staff? other)
        {
            if (other is null) return false;
            return StaffId == other.StaffId;
        }

        public override bool Equals(object? obj) => Equals(obj as Staff);

        public override int GetHashCode() => StaffId.GetHashCode();
    }
}