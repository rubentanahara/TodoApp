using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.DTOs;
using NotesApp.Services;
using System.Security.Claims;

namespace NotesApp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// Login with email address
    /// </summary>
    /// <param name="loginDto">Login credentials</param>
    /// <returns>JWT token and user information</returns>
    [HttpPost("login")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponseDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
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

            var result = await _authService.LoginAsync(loginDto);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            _logger.LogInformation("User {Email} logged in successfully", loginDto.Email);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for user {Email}", loginDto.Email);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Refresh JWT token
    /// </summary>
    /// <returns>New JWT token</returns>
    [HttpPost("refresh")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<AuthResponseDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> RefreshToken()
    {
        try
        {
            var currentToken = Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
            
            if (string.IsNullOrEmpty(currentToken))
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Error = "No token provided"
                });
            }

            var result = await _authService.RefreshTokenAsync(currentToken);
            
            if (!result.Success)
            {
                return Unauthorized(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing token");
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Logout current user
    /// </summary>
    /// <returns>Success confirmation</returns>
    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> Logout()
    {
        try
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            
            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Error = "User not authenticated"
                });
            }

            var result = await _authService.LogoutAsync(email);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            _logger.LogInformation("User {Email} logged out successfully", email);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout");
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Get current user information
    /// </summary>
    /// <returns>Current user details</returns>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> GetCurrentUser()
    {
        try
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            
            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Error = "User not authenticated"
                });
            }

            var result = await _authService.GetCurrentUserAsync(email);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current user");
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }
} 