using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Medical.Api.Modules.UserRoles
{
    public sealed class UserRole : IEquatable<UserRole>
    {
        public const int USER_ROLE_MAX_LENGTH = 100;

        private int? _userRoleId;
        private string? _roleName;

        public UserRole() { }

        public UserRole(string roleName)
        {
            this.RoleName = roleName;
        }

        /// <summary>
        /// Gets or sets the UserRoleId.
        /// </summary>
        public int UserRoleId
        {
            get => _userRoleId ?? 0;
            set
            {
                _userRoleId = value;
            }
        }

        /// <summary>
        /// Gets or sets the RoleName.
        /// Maximum length: 100 characters.
        /// </summary>
        [StringLength(USER_ROLE_MAX_LENGTH)]
        public string RoleName
        {
            get => _roleName ?? string.Empty;
            set
            {
                var __s = NormalizeSpaces(value);
                if (__s.Length > USER_ROLE_MAX_LENGTH)
                    throw new ArgumentException($"RoleName exceeds USER_ROLE_MAX_LENGTH characters (got {__s.Length}).");
                _roleName = __s;
            }
        }

        /// <summary>
        /// Validate using DataAnnotations and semantic rules; returns errors (empty list means valid).
        /// </summary>
        public IReadOnlyList<ValidationResult> Validate()
        {
            var ctx = new ValidationContext(this);
            var results = new List<ValidationResult>();
            Validator.TryValidateObject(this, ctx, results, validateAllProperties: true);
            return results;
        }

        public override string ToString() => "UserRole[" + string.Join(", ", new[]
        {
            "UserRoleId=" + UserRoleId,
            "RoleName=" + RoleName
        }) + "]";

        public bool Equals(UserRole? other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (UserRoleId > 0 || other.UserRoleId > 0) return UserRoleId == other.UserRoleId;
            return string.Equals(ToString(), other.ToString(), StringComparison.OrdinalIgnoreCase);
        }

        public override bool Equals(object? obj) => Equals(obj as UserRole);
        
        public override int GetHashCode()
        {
            if (UserRoleId > 0) return UserRoleId.GetHashCode();
            return StringComparer.OrdinalIgnoreCase.GetHashCode(ToString());
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }
    }
}