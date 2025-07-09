using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.DTOs;
using NotesApp.Services;
using System.Security.Claims;

namespace NotesApp.Controllers;

[ApiController]
[Route("api/workspaces/{workspaceId}/[controller]")]
[Authorize]
[Produces("application/json")]
public class CursorsController : ControllerBase
{
    private readonly IUserCursorService _userCursorService;
    private readonly ILogger<CursorsController> _logger;

    public CursorsController(IUserCursorService userCursorService, ILogger<CursorsController> logger)
    {
        _userCursorService = userCursorService;
        _logger = logger;
    }

    /// <summary>
    /// Get all active cursor positions in a workspace
    /// </summary>
    /// <param name="workspaceId">Workspace identifier</param>
    /// <returns>List of active cursors</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<UserCursorDto>>), 200)]
    public async Task<IActionResult> GetWorkspaceCursors(string workspaceId)
    {
        try
        {
            var result = await _userCursorService.GetWorkspaceCursorsAsync(workspaceId);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            var cursorDtos = result.Data?.Select(cursor => new UserCursorDto
            {
                UserEmail = cursor.UserEmail,
                WorkspaceId = cursor.WorkspaceId,
                X = cursor.X,
                Y = cursor.Y,
                LastUpdated = cursor.LastUpdated
            }) ?? Enumerable.Empty<UserCursorDto>();

            return Ok(new ApiResponse<IEnumerable<UserCursorDto>>
            {
                Data = cursorDtos,
                Success = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting workspace cursors for {WorkspaceId}", workspaceId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Update cursor position (fallback to SignalR)
    /// </summary>
    /// <param name="workspaceId">Workspace identifier</param>
    /// <param name="x">X coordinate</param>
    /// <param name="y">Y coordinate</param>
    /// <returns>Updated cursor information</returns>
    [HttpPut("position")]
    [ProducesResponseType(typeof(ApiResponse<UserCursorDto>), 200)]
    public async Task<IActionResult> UpdateCursorPosition(string workspaceId, [FromQuery] decimal x, [FromQuery] decimal y)
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

            var result = await _userCursorService.UpdateCursorAsync(email, workspaceId, x, y);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            var cursorDto = new UserCursorDto
            {
                UserEmail = result.Data.UserEmail,
                WorkspaceId = result.Data.WorkspaceId,
                X = result.Data.X,
                Y = result.Data.Y,
                LastUpdated = result.Data.LastUpdated
            };

            return Ok(new ApiResponse<UserCursorDto>
            {
                Data = cursorDto,
                Success = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating cursor position for workspace {WorkspaceId}", workspaceId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }
} 