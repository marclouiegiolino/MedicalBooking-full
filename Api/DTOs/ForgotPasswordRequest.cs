using System.ComponentModel.DataAnnotations;

namespace Medical.Api.DTOs
{
    public class ForgotPasswordRequest
    {
        [Required]
        public string Username { get; set; } = string.Empty;
    }
}