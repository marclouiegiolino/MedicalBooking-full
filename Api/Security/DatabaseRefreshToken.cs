using System.Security.Cryptography;
using Medical.Api.Main;

namespace Medical.Api.Security
{
    /// <summary>
    /// Persists refresh tokens to the <c>token_refresh</c> table.
    /// Timestamps are stored as Unix epoch integers (INTEGER affinity) per the DDL.
    /// </summary>
    public class DatabaseRefreshTokenStore : IRefreshTokenStore
    {
        private readonly MyCon _db;

        public DatabaseRefreshTokenStore(MyCon db) => _db = db;

        // ── Generate ────────────────────────────────────────────────────────

        public string GenerateRefreshToken(int userId, TimeSpan expiry)
        {
            var token      = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            string now      = DateTime.Now.ToString("yyyy-MM-dd HH:mm:sS");
            string expiresAt = DateTime.Now.Add(expiry).ToString("yyyy-MM-dd HH:mm:sS");

            const string sql = """
                INSERT INTO token_refresh (user_id, token, expires_at, created_at, is_revoked)
                VALUES (@userId, @token, @expiresAt, @createdAt, 0)
                """;

            using var conn = _db.GetConnection();
            conn.Open();
            using var cmd = _db.CreateCommand(conn, sql);
            cmd.Parameters.Add(P(cmd, "@userId",    userId));
            cmd.Parameters.Add(P(cmd, "@token",     token));
            cmd.Parameters.Add(P(cmd, "@expiresAt", expiresAt));
            cmd.Parameters.Add(P(cmd, "@createdAt", now));
            cmd.ExecuteNonQuery();

            return token;
        }

        // ── Validate ────────────────────────────────────────────────────────

        public bool ValidateRefreshToken(int userId, string refreshToken, out DateTime expiry)
        {
            expiry = DateTime.MinValue;
            string nowStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm:sS");

            const string sql = """
                SELECT expires_at
                FROM token_refresh
                WHERE user_id  = @userId
                  AND token    = @token
                  AND is_revoked = 0
                  AND expires_at > @now
                LIMIT 1
                """;

            using var conn = _db.GetConnection();
            conn.Open();
            using var cmd = _db.CreateCommand(conn, sql);
            cmd.Parameters.Add(P(cmd, "@userId", userId));
            cmd.Parameters.Add(P(cmd, "@token",  refreshToken));
            cmd.Parameters.Add(P(cmd, "@now",    nowStr));

            var result = cmd.ExecuteScalar();
            if (result == null || result == DBNull.Value)
                return false;

            // Parse the stored datetime string back to DateTime
            expiry = DateTime.Parse(result.ToString()!, System.Globalization.CultureInfo.InvariantCulture);
            return true;
        }

        // ── Revoke ──────────────────────────────────────────────────────────

        public void RevokeRefreshToken(int userId)
        {
            const string sql = """
                UPDATE token_refresh
                SET is_revoked = 1
                WHERE user_id = @userId AND is_revoked = 0
                """;

            using var conn = _db.GetConnection();
            conn.Open();
            using var cmd = _db.CreateCommand(conn, sql);
            cmd.Parameters.Add(P(cmd, "@userId", userId));
            cmd.ExecuteNonQuery();
        }

        public void RevokeAll()
        {
            const string sql = "UPDATE token_refresh SET is_revoked = 1 WHERE is_revoked = 0";
            using var conn = _db.GetConnection();
            conn.Open();
            using var cmd = _db.CreateCommand(conn, sql);
            cmd.ExecuteNonQuery();
        }

        // ── Helper ──────────────────────────────────────────────────────────

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
