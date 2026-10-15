using System.ComponentModel.DataAnnotations;

namespace Medical.Api.DTOs
{
    public class UpdateUserroleRequest
    {
        [Required]
        [StringLength(100)]
        public string UserRole { get; set; } = string.Empty;

    }
}