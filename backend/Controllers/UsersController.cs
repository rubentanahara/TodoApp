using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.DTOs;
using NotesApp.Services;
using System.Security.Claims;

namespace NotesApp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUserService userService, ILogger<UsersController> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    /// <summary>
    /// Get all online users
    /// </summary>
    /// <returns>List of online users</returns>
    [HttpGet("online")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<UserDto>>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> GetOnlineUsers()
    {
        try
        {
            var result = await _userService.GetOnlineUsersAsync();
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting online users");
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Update user presence (online/offline)
    /// </summary>
    /// <param name="presenceUpdateDto">Presence update data</param>
    /// <returns>Success confirmation</returns>
    [HttpPut("presence")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> UpdatePresence([FromBody] PresenceUpdateDto presenceUpdateDto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Error = "Invalid input data",
                    Data = ModelState
                });
            }

            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            
            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Error = "User not authenticated"
                });
            }

            var result = await _userService.UpdatePresenceAsync(email, presenceUpdateDto.IsOnline);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating presence");
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }
} 