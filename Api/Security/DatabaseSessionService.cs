using Medical.Api.Main;

namespace Medical.Api.Security
{
    public class DatabaseSessionService : ISessionService
    {
        private readonly MyCon _db;

        public DatabaseSessionService(MyCon db) => _db = db;

        // ── Login / Logout ───────────────────────────────────────────────────

        public void MarkUserLoggedIn(int userId, string token)
            => MarkUserLoggedIn(userId, 0, token, null, null, false);

        public void MarkUserLoggedIn(int userId, int roleId, string token,
                                     string? ipAddress, string? deviceId,
                                     bool trustDevice = true)
        {
            // Close any open sessions first (re-login replaces previous session)
            CloseOpenSessions(userId);

            const string sql = """
                INSERT INTO login_logs (user_id, login_time)
                VALUES (@userId, @loginTime)
                """;

            using var conn = _db.GetConnection();
            conn.Open();
            using var cmd = _db.CreateCommand(conn, sql);
            cmd.Parameters.Add(P(cmd, "@userId",    userId));
            cmd.Parameters.Add(P(cmd, "@loginTime", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")));
            cmd.ExecuteNonQuery();
        }

        public void MarkUserLoggedOut(int userId)
        {
            CloseOpenSessions(userId);
        }

        // ── Session Checks ───────────────────────────────────────────────────

        /// <summary>
        /// Returns true if the user has an open session row (logout_time IS NULL).
        /// Token expiry is enforced by the JWT middleware separately.
        /// </summary>
        public bool IsUserLoggedIn(int userId)
        {
            const string sql = """
                SELECT COUNT(*)
                FROM login_logs
                WHERE user_id    = @userId
                  AND logout_time IS NULL
                """;

            using var conn = _db.GetConnection();
            conn.Open();
            using var cmd = _db.CreateCommand(conn, sql);
            cmd.Parameters.Add(P(cmd, "@userId", userId));
            var result = cmd.ExecuteScalar();
            return Convert.ToInt32(result) > 0;
        }

        public bool IsDeviceTrustedForUser(int userId, string deviceId)
            => IsUserLoggedIn(userId);

        // ── Token helpers ────────────────────────────────────────────────────

        /// <summary>
        /// Token strings are not stored in login_logs. Returns null; JWT middleware
        /// is the source of truth for token validity.
        /// </summary>
        public string? GetUserToken(int userId) => null;

        /// <summary>
        /// Checks for an open session row. Full token signature validation is done
        /// by the JWT middleware — this is a lightweight liveness check only.
        /// </summary>
        public bool IsTokenValid(int userId, string token)
            => IsUserLoggedIn(userId);

        // ── Device helpers (no device column — no-ops) ───────────────────────

        public bool IsDeviceLoggedIn(string deviceId)   => false;
        public void MarkDeviceLoggedIn(string deviceId, int userId) { }
        public void MarkDeviceLoggedOut(string deviceId) { }

        // ── Cleanup ──────────────────────────────────────────────────────────

        /// <summary>
        /// Closes login_log rows whose login_time is older than the JWT expiry window
        /// (default 24 h safety buffer) and still have no logout_time.
        /// </summary>
        public Task<int> PurgeExpiredSessionsAsync(CancellationToken ct = default)
        {
            // Close sessions open longer than 24 hours with no logout.
            string cutoff = DateTime.Now.AddHours(-24).ToString("yyyy-MM-dd HH:mm:ss");

            const string sql = """
                UPDATE login_logs
                SET logout_time = @now
                WHERE logout_time IS NULL
                  AND login_time < @cutoff
                """;

            using var conn = _db.GetConnection();
            conn.Open();
            using var cmd = _db.CreateCommand(conn, sql);
            cmd.Parameters.Add(P(cmd, "@now",    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")));
            cmd.Parameters.Add(P(cmd, "@cutoff", cutoff));
            int rows = cmd.ExecuteNonQuery();
            return Task.FromResult(rows);
        }

        // ── Private helpers ───────────────────────────────────────────────────

        private void CloseOpenSessions(int userId)
        {
            const string sql = """
                UPDATE login_logs
                SET logout_time = @now
                WHERE user_id    = @userId
                  AND logout_time IS NULL
                """;

            using var conn = _db.GetConnection();
            conn.Open();
            using var cmd = _db.CreateCommand(conn, sql);
            cmd.Parameters.Add(P(cmd, "@now",    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")));
            cmd.Parameters.Add(P(cmd, "@userId", userId));
            cmd.ExecuteNonQuery();
        }

        private static System.Data.Common.DbParameter P(
            System.Data.Common.DbCommand cmd, string name, object? value)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value ?? DBNull.Value;
            return p;
        }
    }
}
