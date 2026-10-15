using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.Notification;
using Medical.Api.Modules.Authorizations;
using Medical.Api.Modules.User;

namespace Medical.Api.Controllers
{
    /// <summary>
    /// Notification management.
    ///
    /// OWNERSHIP RULE: Every user (including Admin) sees/manages only their OWN notifications.
    /// Notifications are created internally by domain modules (appointments, lab results, etc.)
    /// via <see cref="INotificationService"/>, NOT through a public POST endpoint.
    ///
    /// The single exception is POST /api/notification/broadcast — Admin-only deliberate announcements.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly INotificationRepository _repository;
        private readonly INotificationService    _notificationService;
        private readonly IUserRepository         _userRepository;

        public NotificationController(
            INotificationRepository repository,
            INotificationService    notificationService,
            IUserRepository         userRepository)
        {
            _repository          = repository;
            _notificationService = notificationService;
            _userRepository      = userRepository;
        }

        // ── Helpers ────────────────────────────────────────────────────────────

        private bool TryGetUserIdClaim(out long userId)
        {
            var claim = User.FindFirst("user_id")?.Value
                     ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out userId);
        }

        private bool TryGetRoleIdClaim(out int roleId)
        {
            var claim = User.FindFirst("user_role_id")?.Value;
            return int.TryParse(claim, out roleId);
        }

        private bool IsAdmin() =>
            TryGetRoleIdClaim(out int roleId) && roleId == AppRoles.Admin;

        // ── GET my notifications ───────────────────────────────────────────────

        /// <summary>
        /// Returns all notifications for the currently authenticated user, newest first.
        /// </summary>
        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<Notification>>> GetMyNotifications()
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var notifications = await _repository.GetByUserIdAsync(userId);
            return Ok(notifications);
        }

        // ── GET unread count (badge) ───────────────────────────────────────────

        /// <summary>
        /// Returns the count of unread notifications for the current user.
        /// Useful for the notification bell badge on the frontend.
        /// </summary>
        [HttpGet("my/unread-count")]
        public async Task<ActionResult<object>> GetUnreadCount()
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            int count = await _repository.GetUnreadCountAsync(userId);
            return Ok(new { unread_count = count });
        }

        // ── GET single notification ────────────────────────────────────────────

        /// <summary>
        /// Get a single notification by ID. The caller must own the notification.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult<Notification>> GetById(long id)
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var notification = await _repository.GetByIdAsync(id);
            if (notification is null)
                return NotFound();

            // Own-only — no Admin exception
            if (notification.UserId != userId)
                return Forbid();

            return Ok(notification);
        }

        // ── PATCH mark single as read ──────────────────────────────────────────

        /// <summary>
        /// Mark a specific notification as read.
        /// The caller must own the notification.
        /// </summary>
        [HttpPatch("{id:long}/read")]
        public async Task<IActionResult> MarkAsRead(long id)
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var notification = await _repository.GetByIdAsync(id);
            if (notification is null)
                return NotFound();

            if (notification.UserId != userId)
                return Forbid();

            await _repository.MarkAsReadAsync(id);
            return NoContent();
        }

        // ── PATCH mark all as read ─────────────────────────────────────────────

        /// <summary>
        /// Mark ALL of the current user's notifications as read at once.
        /// </summary>
        [HttpPatch("my/read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var notifications = await _repository.GetByUserIdAsync(userId);

            foreach (var n in notifications.Where(n => !n.IsRead))
                await _repository.MarkAsReadAsync(n.NotificationId);

            return NoContent();
        }

        // ── DELETE dismiss notification ────────────────────────────────────────

        /// <summary>
        /// Dismiss / delete a notification. The caller must own the notification.
        /// </summary>
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Dismiss(long id)
        {
            if (!TryGetUserIdClaim(out long userId))
                return Unauthorized();

            var notification = await _repository.GetByIdAsync(id);
            if (notification is null)
                return NotFound();

            if (notification.UserId != userId)
                return Forbid();

            await _repository.DeleteAsync(id);
            return NoContent();
        }

        // ── POST broadcast (Admin only) ────────────────────────────────────────

        /// <summary>
        /// Admin-only: broadcast a manual announcement (e.g. "clinic closed tomorrow").
        ///
        /// Provide either:
        ///   - <c>user_ids</c>: an explicit list of recipients, OR
        ///   - <c>send_to_all: true</c>: sends to every registered user.
        ///
        /// This is the ONLY endpoint that creates notifications through the HTTP layer.
        /// All other notification creation happens internally (domain events).
        /// </summary>
        [HttpPost("broadcast")]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<IActionResult> Broadcast([FromBody] BroadcastRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest(new { message = "title is required." });

            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { message = "message is required." });

            IEnumerable<long> targetIds;

            if (request.UserIds is { Count: > 0 })
            {
                targetIds = request.UserIds;
            }
            else if (request.SendToAll)
            {
                var allUsers = await _userRepository.GetAllAsync();
                targetIds = allUsers.Select(u => (long)u.UserId);
            }
            else
            {
                return BadRequest(new { message = "Provide either user_ids or set send_to_all to true." });
            }

            int sent = await _notificationService.BroadcastAsync(targetIds, request.Title, request.Message);

            return Ok(new { message = $"Broadcast sent to {sent} user(s).", recipients = sent });
        }
    }
}

