using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.JobRoles
{
    public sealed class JobRoles
    {
        private long? _roleId;
        private string? _roleName = string.Empty;

        public JobRoles() { }

        public JobRoles(long roleId, string roleName)
        {
            RoleId = roleId;
            RoleName = roleName;
        }

        [JsonPropertyName("role_id")]
        [JsonPropertyOrder(1)]
        public long RoleId
        {
            get => _roleId ?? 0L;
            set => _roleId = value;
        }

        [JsonPropertyName("role_name")]
        [JsonPropertyOrder(2)]
        public string RoleName
        {
            get => _roleName ?? string.Empty;
            set => _roleName = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            return System.Text.RegularExpressions.Regex.Replace(input.Trim(), @"\s+", " ");
        }
    }
}