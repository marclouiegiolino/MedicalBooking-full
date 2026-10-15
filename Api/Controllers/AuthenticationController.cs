using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.DTOs;
using Medical.Api.Modules.Authorizations;
using Medical.Api.Modules.User;
using Medical.Api.Modules.Patients;
using Medical.Api.Security;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthControllers : ControllerBase
    {
        private readonly IUserRepository _userRepository;
        private readonly IPatientsRepository _patientsRepository;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IWebHostEnvironment _environment;
        private readonly ISessionService _sessionService;
        private readonly ILoginAttemptService _loginAttemptService;

        private static string HashRawForSave(string rawPassword)
        {
            if (string.IsNullOrWhiteSpace(rawPassword))
            {
                throw new System.ArgumentException("Password is required.", nameof(rawPassword));
            }

            return PasswordHasher.Hash(rawPassword);
        }

        public AuthControllers(
            IUserRepository userRepository,
            IPatientsRepository patientsRepository,
            IJwtTokenService jwtTokenService,
            IWebHostEnvironment environment,
            ISessionService sessionService,
            ILoginAttemptService loginAttemptService)
        {
            _userRepository       = userRepository;
            _patientsRepository   = patientsRepository;
            _jwtTokenService      = jwtTokenService;
            _environment          = environment;
            _sessionService       = sessionService;
            _loginAttemptService  = loginAttemptService;
        }

        /// <summary>
        /// Register any account with a specified role. Admin access only.
        /// </summary>
        [HttpPost("register")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Register([FromBody] RegisterRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username) ||
                string.IsNullOrWhiteSpace(dto.Password))
            {
                return BadRequest("Username and password are required.");
            }

            if (dto.RoleId < 1)
            {
                return BadRequest("RoleId is required.");
            }

            var existingUser = await _userRepository.GetByUserNameAsync(dto.Username);
            if (existingUser != null)
            {
                return Conflict("Username already exists.");
            }

            var user = new Medical.Api.Modules.User.User
            {
                UserName = dto.Username,
                UserPass = HashRawForSave(dto.Password),
                UserRoleId = dto.RoleId,
            };

            await _userRepository.AddAsync(user);
            var createdUser = await _userRepository.GetByUserNameAsync(dto.Username);

            if (createdUser != null)
            {
                string token = _jwtTokenService.GenerateToken(createdUser);

                return Ok(new
                {
                    message = "User registered successfully.",
                    token,
                    userId = createdUser.UserId,
                    username = createdUser.UserName,
                    roleId = createdUser.UserRoleId,
                });
            }

            return Ok(new { message = "User registered successfully." });
        }

        /// <summary>
        /// Public self-registration. Always assigns the regular User role (role_id = 3).
        /// </summary>
        [HttpPost("register-user")]
        [AllowAnonymous]
        public async Task<IActionResult> RegisterUser([FromBody] RegisterUserRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username) ||
                string.IsNullOrWhiteSpace(dto.Password))
            {
                return BadRequest("Username and password are required.");
            }

            var existingUser = await _userRepository.GetByUserNameAsync(dto.Username);
            if (existingUser != null)
            {
                return Conflict("Username already exists.");
            }

            var user = new Medical.Api.Modules.User.User
            {
                UserName = dto.Username,
                UserPass = HashRawForSave(dto.Password),
                UserRoleId = AppRoles.User, // Always role 3 — regular user
            };

            await _userRepository.AddAsync(user);
            var createdUser = await _userRepository.GetByUserNameAsync(dto.Username);

            if (createdUser != null)
            {
                // Auto-create patient profile record linked to user_id
                var existingPatient = await _patientsRepository.GetByUserIdAsync(createdUser.UserId);
                if (existingPatient == null)
                {
                    string fname = !string.IsNullOrWhiteSpace(dto.FirstName) ? dto.FirstName.Trim() : createdUser.UserName;
                    string mname = !string.IsNullOrWhiteSpace(dto.MiddleName) ? dto.MiddleName.Trim() : string.Empty;
                    string lname = !string.IsNullOrWhiteSpace(dto.LastName) ? dto.LastName.Trim() : string.Empty;

                    await _patientsRepository.AddAsync(new Patients
                    {
                        UserId = createdUser.UserId,
                        FirstName = fname,
                        MiddleName = mname,
                        LastName = lname,
                    });
                }

                string token = _jwtTokenService.GenerateToken(createdUser);

                return Ok(new
                {
                    message = "Registration successful.",
                    token,
                    userId = createdUser.UserId,
                    username = createdUser.UserName,
                    roleId = createdUser.UserRoleId,
                });
            }

            return Ok(new { message = "Registration successful." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username) ||
                string.IsNullOrWhiteSpace(dto.Password))
            {
                return BadRequest("Username and password are required.");
            }

            string? ip        = HttpContext.Connection.RemoteIpAddress?.ToString();
            string? userAgent = Request.Headers.UserAgent.ToString();

            var user = await _userRepository.GetByUserNameAsync(dto.Username);
            if (user == null)
            {
                // Log failed attempt — user not found
                await _loginAttemptService.LogAsync(null, dto.Username, false, ip, userAgent);
                return Unauthorized("Invalid username or password.");
            }

            bool isValid = PasswordHasher.Verify(user.UserPass, dto.Password);
            if (!isValid)
            {
                // Log failed attempt — wrong password
                await _loginAttemptService.LogAsync(user.UserId, dto.Username, false, ip, userAgent);
                return Unauthorized("Invalid username or password.");
            }

            string token = _jwtTokenService.GenerateToken(user);

            // Record session in login_logs
            _sessionService.MarkUserLoggedIn(user.UserId, user.UserRoleId, token, ip, null);

            // Record successful attempt in login_attempts
            await _loginAttemptService.LogAsync(user.UserId, dto.Username, true, ip, userAgent);

            return Ok(new
            {
                message = "Login successful.",
                token,
                userId = user.UserId,
                username = user.UserName,
                roleId = user.UserRoleId,
            });
        }

        [HttpPost("logout")]
        [Authorize]
        public IActionResult Logout()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out int userId))
            {
                _sessionService.MarkUserLoggedOut(userId);
            }
            return Ok(new { message = "Logged out successfully." });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username))
            {
                return BadRequest("Username is required.");
            }

            string message = "If the account exists, a reset token has been generated.";
            var user = await _userRepository.GetByUserNameAsync(dto.Username);
            if (user == null)
            {
                return Ok(new { message });
            }

            string resetToken = _jwtTokenService.GeneratePasswordResetToken(user.UserId.ToString());
            if (_environment.IsDevelopment())
            {
                return Ok(new { message, resetToken });
            }

            return Ok(new { message });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Token) ||
                string.IsNullOrWhiteSpace(dto.NewPassword))
            {
                return BadRequest("Token and new password are required.");
            }

            if (!_jwtTokenService.TryValidatePasswordResetToken(dto.Token, out string userIdText))
            {
                return BadRequest("Invalid or expired reset token.");
            }

            if (!int.TryParse(userIdText, out var userId))
            {
                return BadRequest("Invalid reset token format.");
            }

            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
            {
                return BadRequest("Invalid or expired reset token.");
            }

            user.UserPass = HashRawForSave(dto.NewPassword);
            await _userRepository.UpdateAsync(user);

            return Ok(new { message = "Password has been reset successfully." });
        }
    }
}