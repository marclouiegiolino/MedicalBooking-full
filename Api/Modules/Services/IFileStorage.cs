using Microsoft.AspNetCore.Http;

namespace Medical.Api.Services
{
    public interface IFileStorageService
    {
        Task<string> SaveProfilePictureAsync(IFormFile file, int userId);
        Task DeleteFileAsync(string? relativePath);
    }
}