namespace Medical.Api.Modules.Authorizations
{
    /// <summary>
    /// Central definition of access role IDs corresponding to the <c>access_id</c> column in <c>Access_Roles</c>.
    /// </summary>
    public static class AppRoles
    {
        /// <summary>Full system administrator. Can manage users, roles, and system configuration.</summary>
        public const int Admin = 1;

        /// <summary>Staff member (Doctor, Receptionist, Manager, Technician, etc.).</summary>
        public const int Staff = 2;

        /// <summary>Regular user / client.</summary>
        public const int User  = 3;

        // ── Convenience role groups for policy definitions ────────────────────

        /// <summary>Staff and Admin roles.</summary>
        public static readonly int[] StaffRoles = [Admin, Staff];

        /// <summary>All roles — every authenticated user.</summary>
        public static readonly int[] AllRoles   = [Admin, Staff, User];

        /// <summary>User and Admin roles (excludes Staff/Doctor).</summary>
        public static readonly int[] UserAndAdminRoles = [Admin, User];
    }

    /// <summary>
    /// Definitions for professional job roles corresponding to the <c>role_id</c> column in <c>Job_Roles</c>.
    /// </summary>
}
