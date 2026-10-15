using Microsoft.AspNetCore.Http;

namespace Medical.Api.Services
{
    public class LocalFileStorageService : IFileStorageService
    {
        private readonly IWebHostEnvironment _environment;

        public LocalFileStorageService(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        public async Task<string> SaveProfilePictureAsync(
            IFormFile file,
            int userId)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("A file is required.");

            const long maxBytes = 5 * 1024 * 1024;

            if (file.Length > maxBytes)
                throw new ArgumentException(
                    "File exceeds the 5 MB limit.");

            var allowedExtensions = new HashSet<string>(
                StringComparer.OrdinalIgnoreCase)
            {
                ".jpg",
                ".jpeg",
                ".png",
                ".webp",
                ".gif"
            };

            var ext = Path.GetExtension(file.FileName);

            if (string.IsNullOrEmpty(ext) ||
                !allowedExtensions.Contains(ext))
            {
                throw new ArgumentException(
                    "Invalid file type. Allowed formats: .jpg, .jpeg, .png, .webp, .gif");
            }

            var webRoot = _environment.WebRootPath;

            if (string.IsNullOrWhiteSpace(webRoot))
            {
                webRoot = Path.Combine(
                    AppContext.BaseDirectory,
                    "wwwroot");
            }

            var uploadsDir = Path.Combine(
                webRoot,
                "uploads",
                "profiles");

            Directory.CreateDirectory(uploadsDir);

            var safeGuid = Guid.NewGuid().ToString("N");

            var diskName =
                $"user_{userId}_{safeGuid}{ext}";

            var diskPath = Path.Combine(
                uploadsDir,
                diskName);

            using (var fs = System.IO.File.Create(diskPath))
            {
                await file.CopyToAsync(fs);
            }

            return $"/uploads/profiles/{diskName}";
        }

        public Task DeleteFileAsync(string? relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath))
                return Task.CompletedTask;

            var webRoot = _environment.WebRootPath;

            if (string.IsNullOrWhiteSpace(webRoot))
            {
                webRoot = Path.Combine(
                    AppContext.BaseDirectory,
                    "wwwroot");
            }

            var cleanPath = relativePath
                .TrimStart('/')
                .Replace('/', Path.DirectorySeparatorChar);

            var fullPath = Path.Combine(
                webRoot,
                cleanPath);

            if (File.Exists(fullPath))
                File.Delete(fullPath);

            return Task.CompletedTask;
        }
    }
}