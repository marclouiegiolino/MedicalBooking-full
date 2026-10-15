using System.ComponentModel.DataAnnotations;

namespace Medical.Api.DTOs
{
    public class RegisterUserRequest
    {
        [Required(ErrorMessage = "Username is required")]
        [StringLength(12, MinimumLength = 6, ErrorMessage = "Username must be between 6 and 12 characters")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [StringLength(12, MinimumLength = 5, ErrorMessage = "Password must be between 5 and 12 characters")]
        public string Password { get; set; } = string.Empty;

        public string? FirstName { get; set; }
        public string? MiddleName { get; set; }
        public string? LastName { get; set; }
    }
}