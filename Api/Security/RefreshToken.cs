using System.Collections.Concurrent;

namespace Medical.Api.Security
{
    public interface IRefreshTokenStore
    {
        string GenerateRefreshToken(int userId, TimeSpan expiry);
        bool ValidateRefreshToken(int userId, string refreshToken, out DateTime expiry);
        void RevokeRefreshToken(int userId);
        void RevokeAll();
    }

    public class InMemoryRefreshTokenStore : IRefreshTokenStore
    {
        private record RefreshEntry(string Token, DateTime ExpiresAt);

        private readonly ConcurrentDictionary<int, RefreshEntry> _store = new();

        public string GenerateRefreshToken(int userId, TimeSpan expiry)
        {
            var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
            _store[userId] = new RefreshEntry(token, DateTime.UtcNow.Add(expiry));
            return token;
        }

        public bool ValidateRefreshToken(int userId, string refreshToken, out DateTime expiry)
        {
            expiry = DateTime.MinValue;
            if (!_store.TryGetValue(userId, out var entry))
                return false;

            if (entry.Token != refreshToken || entry.ExpiresAt <= DateTime.UtcNow)
            {
                _store.TryRemove(userId, out _);
                return false;
            }

            expiry = entry.ExpiresAt;
            return true;
        }

        public void RevokeRefreshToken(int userId)
        {
            _store.TryRemove(userId, out _);
        }

        public void RevokeAll()
        {
            _store.Clear();
        }
    }
}

