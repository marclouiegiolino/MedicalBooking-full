    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;

    namespace Medical.Api.Modules.User
    {
        public sealed class User : IEquatable<User>
        {
            public const int USER_NAME_MAX_LENGTH = 100;
            public const int USER_PASS_MAX_LENGTH = 150;

            private int? _userId;
            private string? _guid;
            private string? _userName;
            private string? _userPass;
            private int? _userRoleId;
            private string? _profilePicturePath;

            public User() { }

            public User(string userName, string userPass, int userRoleId, string profilePicturePath = "")
            {
                this.UserName = userName;
                this.UserPass = userPass;
                this.UserRoleId = userRoleId;
                this.ProfilePicturePath = profilePicturePath;
            }

            /// <summary>
            /// Gets or sets the UserId.
            /// </summary>
            public int UserId
            {
                get => _userId ?? 0;
                set
                {
                    _userId = value;
                }
            }

            /// <summary>
            /// Gets or sets the Guid. Auto-generated for row-level protection.
            /// </summary>
            public string Guid
            {
                get => _guid ?? string.Empty;
                set => _guid = value;
            }

            /// <summary>
            /// Gets or sets the UserName.
            /// Maximum length: 100 characters.
            /// </summary>
            [StringLength(USER_NAME_MAX_LENGTH)]
            public string UserName
            {
                get => _userName ?? string.Empty;
                set
                {
                    var __s = NormalizeSpaces(value);
                    if (__s.Length > USER_NAME_MAX_LENGTH)
                        throw new ArgumentException($"UserName exceeds USER_NAME_MAX_LENGTH characters (got {__s.Length}).");
                    _userName = __s;
                }
            }

            /// <summary>
            /// Gets or sets the UserPass.
            /// Maximum length: 150 characters.
            /// </summary>
            [StringLength(USER_PASS_MAX_LENGTH)]
            public string UserPass
            {
                get => _userPass ?? string.Empty;
                set
                {
                    var __s = NormalizeSpaces(value);
                    if (__s.Length > USER_PASS_MAX_LENGTH)
                        throw new ArgumentException($"UserPass exceeds USER_PASS_MAX_LENGTH characters (got {__s.Length}).");
                    _userPass = __s;
                }
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
            /// Gets or sets the ProfilePicturePath.
            /// Maximum length: 250 characters.
            /// </summary>
            [StringLength(250)]
            public string ProfilePicturePath
            {
                get => _profilePicturePath ?? string.Empty;
                set
                {
                    var __s = NormalizeSpaces(value);
                    if (__s.Length > 250)
                        throw new ArgumentException($"ProfilePicturePath exceeds 250 characters (got {__s.Length}).");
                    _profilePicturePath = __s;
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

            public override string ToString() => "User[" + string.Join(", ", new[]
            {
                "UserId=" + UserId,
                "UserName=" + UserName,
                "UserPass=" + UserPass,
                "UserRoleId=" + UserRoleId,
                "ProfilePicturePath=" + ProfilePicturePath
            }) + "]";

            public bool Equals(User? other)
            {
                if (other is null) return false;
                if (ReferenceEquals(this, other)) return true;
                if (UserId > 0 || other.UserId > 0) return UserId == other.UserId;
                return string.Equals(ToString(), other.ToString(), StringComparison.OrdinalIgnoreCase);
            }

            public override bool Equals(object? obj) => Equals(obj as User);

            public override int GetHashCode()
            {
                if (UserId > 0) return UserId.GetHashCode();
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