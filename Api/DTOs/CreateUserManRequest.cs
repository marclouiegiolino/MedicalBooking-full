using System.ComponentModel.DataAnnotations;

namespace Medical.Api.DTOs
{
    public class CreateUserRequest
    {
        
        [StringLength(100)]
        public string UserName { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        public int UserRoleId { get; set; }

        [StringLength(250)]
        public string? ProfilePicturePath { get; set; }
    }

    public class CreateUserManRequest : CreateUserRequest
    {
    }
}