using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using NotesApp.DTOs;
using NotesApp.Services;
using NotesApp.Hubs;
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
    private readonly IHubContext<CollaborationHub> _hubContext;

    public NotesController(INoteService noteService, ILogger<NotesController> logger, IHubContext<CollaborationHub> hubContext)
    {
        _noteService = noteService;
        _logger = logger;
        _hubContext = hubContext;
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

    /// <summary>
    /// Upload an image to a note
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <param name="file">Image file to upload</param>
    /// <returns>Success confirmation with image URL</returns>
    [HttpPost("/api/notes/{noteId}/images")]
    [ProducesResponseType(typeof(ApiResponse<string>), 201)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> UploadImage(
        [FromRoute] Guid noteId,
        [FromForm] IFormFile file)
    {
        try
        {
            var userEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Error = "User not authenticated"
                });
            }

            // Get the note
            var note = await _noteService.GetNoteAsync(noteId);
            if (!note.Success)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Error = "Note not found"
                });
            }

            if (note.Data.AuthorEmail != userEmail)
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Error = "Only the note author can upload images"
                });
            }

            // Validate file
            if (file == null || file.Length == 0)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Error = "No file provided"
                });
            }

            if (file.Length > 5 * 1024 * 1024) // 5MB limit
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Error = "File too large (max 5MB)"
                });
            }

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Error = "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."
                });
            }

            // Create uploads directory if it doesn't exist
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            Directory.CreateDirectory(uploadsDir);

            // Save file with unique name
            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Create absolute URL for the image
            var request = HttpContext.Request;
            var baseUrl = $"{request.Scheme}://{request.Host}";
            var imageUrl = $"{baseUrl}/uploads/{fileName}";
            
            // Update note with image URL
            var result = await _noteService.AddImageToNoteAsync(noteId, imageUrl);
            
            if (!result.Success)
            {
                // Clean up uploaded file if database update fails
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
                return BadRequest(result);
            }

            // Broadcast the updated note to all users in the workspace
            try
            {
                var updatedNote = await _noteService.GetNoteAsync(noteId);
                if (updatedNote.Success)
                {
                    await _hubContext.Clients.Group(updatedNote.Data.WorkspaceId).SendAsync("NoteUpdated", updatedNote.Data);
                    _logger.LogInformation("Broadcasted image upload for note {NoteId} to workspace {WorkspaceId}", 
                        noteId, updatedNote.Data.WorkspaceId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast image upload for note {NoteId}", noteId);
                // Don't fail the request if broadcast fails
            }

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Data = imageUrl
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading image for note {NoteId}", noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Delete an image from a note
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <param name="deleteImageDto">Image deletion data</param>
    /// <returns>Success confirmation</returns>
    [HttpDelete("/api/notes/{noteId}/images")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    public async Task<IActionResult> DeleteImage(
        [FromRoute] Guid noteId,
        [FromBody] DeleteImageDto deleteImageDto)
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

            var userEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Error = "User not authenticated"
                });
            }

            var result = await _noteService.RemoveImageFromNoteAsync(noteId, deleteImageDto.ImageUrl, userEmail);
            
            if (!result.Success)
            {
                if (result.Error?.Contains("not found") == true)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            // Broadcast the updated note to all users in the workspace
            try
            {
                var updatedNote = await _noteService.GetNoteAsync(noteId);
                if (updatedNote.Success)
                {
                    await _hubContext.Clients.Group(updatedNote.Data.WorkspaceId).SendAsync("NoteUpdated", updatedNote.Data);
                    _logger.LogInformation("Broadcasted image deletion for note {NoteId} to workspace {WorkspaceId}", 
                        noteId, updatedNote.Data.WorkspaceId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast image deletion for note {NoteId}", noteId);
                // Don't fail the request if broadcast fails
            }

            return Ok(new ApiResponse<bool>
            {
                Success = true,
                Data = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting image from note {NoteId}", noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }
} 