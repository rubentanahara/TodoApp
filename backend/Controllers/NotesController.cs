using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.DTOs;
using NotesApp.Services;
using System.Security.Claims;

namespace NotesApp.Controllers;

[ApiController]
[Route("api/workspaces/{workspaceId}/notes")]
[Authorize]
[Produces("application/json")]
public class NotesController : ControllerBase
{
    private readonly INoteService _noteService;
    private readonly ILogger<NotesController> _logger;

    public NotesController(INoteService noteService, ILogger<NotesController> logger)
    {
        _noteService = noteService;
        _logger = logger;
    }

    /// <summary>
    /// Get notes for a workspace with optional viewport filtering
    /// </summary>
    /// <param name="workspaceId">Workspace ID</param>
    /// <param name="viewportX">Viewport X coordinate (optional)</param>
    /// <param name="viewportY">Viewport Y coordinate (optional)</param>
    /// <param name="viewportWidth">Viewport width (optional)</param>
    /// <param name="viewportHeight">Viewport height (optional)</param>
    /// <returns>List of notes</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<NoteDto>>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> GetNotes(
        [FromRoute] string workspaceId,
        [FromQuery] decimal? viewportX = null,
        [FromQuery] decimal? viewportY = null,
        [FromQuery] decimal? viewportWidth = null,
        [FromQuery] decimal? viewportHeight = null)
    {
        try
        {
            var result = await _noteService.GetNotesAsync(workspaceId, viewportX, viewportY, viewportWidth, viewportHeight);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting notes for workspace {WorkspaceId}", workspaceId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Create a new note
    /// </summary>
    /// <param name="workspaceId">Workspace ID</param>
    /// <param name="noteCreateDto">Note creation data</param>
    /// <returns>Created note</returns>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<NoteDto>), 201)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> CreateNote(
        [FromRoute] string workspaceId,
        [FromBody] NoteCreateDto noteCreateDto)
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

            var result = await _noteService.CreateNoteAsync(workspaceId, noteCreateDto, email);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return CreatedAtAction(nameof(GetNote), new { id = result.Data.Id }, result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating note in workspace {WorkspaceId}", workspaceId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Get a specific note by ID
    /// </summary>
    /// <param name="id">Note ID</param>
    /// <returns>Note details</returns>
    [HttpGet("/api/notes/{id}")]
    [ProducesResponseType(typeof(ApiResponse<NoteDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> GetNote([FromRoute] Guid id)
    {
        try
        {
            var result = await _noteService.GetNoteAsync(id);
            
            if (!result.Success)
            {
                return NotFound(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting note {NoteId}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Update a note
    /// </summary>
    /// <param name="id">Note ID</param>
    /// <param name="noteUpdateDto">Note update data</param>
    /// <returns>Updated note</returns>
    [HttpPut("/api/notes/{id}")]
    [ProducesResponseType(typeof(ApiResponse<NoteDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    public async Task<IActionResult> UpdateNote(
        [FromRoute] Guid id,
        [FromBody] NoteUpdateDto noteUpdateDto)
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

            var result = await _noteService.UpdateNoteAsync(id, noteUpdateDto, email);
            
            if (!result.Success)
            {
                if (result.Error?.Contains("not found") == true)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating note {NoteId}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Delete a note
    /// </summary>
    /// <param name="id">Note ID</param>
    /// <returns>Success confirmation</returns>
    [HttpDelete("/api/notes/{id}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    public async Task<IActionResult> DeleteNote([FromRoute] Guid id)
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

            var result = await _noteService.DeleteNoteAsync(id, email);
            
            if (!result.Success)
            {
                if (result.Error?.Contains("not found") == true)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting note {NoteId}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Move a note to a new position
    /// </summary>
    /// <param name="id">Note ID</param>
    /// <param name="positionUpdateDto">New position data</param>
    /// <returns>Updated note</returns>
    [HttpPatch("/api/notes/{id}/position")]
    [ProducesResponseType(typeof(ApiResponse<NoteDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    public async Task<IActionResult> MoveNote(
        [FromRoute] Guid id,
        [FromBody] NotePositionUpdateDto positionUpdateDto)
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

            var result = await _noteService.MoveNoteAsync(id, positionUpdateDto.X, positionUpdateDto.Y, email);
            
            if (!result.Success)
            {
                if (result.Error?.Contains("not found") == true)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error moving note {NoteId}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }
} 