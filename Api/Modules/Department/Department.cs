using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Department
{
    public sealed class Department
    {
        private long?   _departmentId;
        private string? _departmentName;

        public Department() { }

        public Department(long departmentId, string departmentName)
        {
            DepartmentId   = departmentId;
            DepartmentName = departmentName;
        }

        [JsonPropertyName("department_id")]
        [JsonPropertyOrder(1)]
        public long DepartmentId
        {
            get => _departmentId ?? 0L;
            set => _departmentId = value;
        }

        [JsonPropertyName("department_name")]
        [JsonPropertyOrder(2)]
        public string DepartmentName
        {
            get => _departmentName ?? string.Empty;
            set => _departmentName = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            return System.Text.RegularExpressions.Regex.Replace(input.Trim(), @"\s+", " ");
        }
    }
}