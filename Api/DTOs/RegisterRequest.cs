using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Medical.Api.DTOs
{
    public class RegisterRequest
    {
        [Required]
        [StringLength(100)]
        [JsonPropertyName("username")]
        public string Username { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        [JsonPropertyName("password")]
        public string Password { get; set; } = string.Empty;

        [Required]
        [Range(1, int.MaxValue)]
        [JsonPropertyName("role_id")]
        public int RoleId { get; set; }
    }
}