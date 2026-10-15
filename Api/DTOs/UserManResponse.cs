namespace Medical.Api.DTOs
{
    public class UserResponse
    {
        public int UserId { get; set; }
        public string Guid { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public int UserRoleId { get; set; }
        public string ProfilePicturePath { get; set; } = string.Empty;
    }

    public class UsermanResponse : UserResponse
    {
    }
}