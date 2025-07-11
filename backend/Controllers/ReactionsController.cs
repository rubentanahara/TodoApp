using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.DTOs;
using NotesApp.Services;
using System.Security.Claims;

namespace NotesApp.Controllers;

[ApiController]
[Route("api/notes/{noteId}/reactions")]
[Authorize]
[Produces("application/json")]
public class ReactionsController : ControllerBase
{
    private readonly INoteReactionService _reactionService;
    private readonly ILogger<ReactionsController> _logger;

    public ReactionsController(INoteReactionService reactionService, ILogger<ReactionsController> logger)
    {
        _reactionService = reactionService;
        _logger = logger;
    }

    /// <summary>
    /// Get all reactions for a note
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <returns>List of reactions</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<NoteReactionDto>>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> GetReactions([FromRoute] Guid noteId)
    {
        try
        {
            var result = await _reactionService.GetNoteReactionsAsync(noteId);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reactions for note {NoteId}", noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Get reaction summary for a note
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <returns>Reaction summary with counts</returns>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<NoteReactionSummaryDto>>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> GetReactionsSummary([FromRoute] Guid noteId)
    {
        try
        {
            var userEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            var result = await _reactionService.GetNoteReactionsSummaryAsync(noteId, userEmail);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reaction summary for note {NoteId}", noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Add or update a reaction to a note
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <param name="reactionCreateDto">Reaction data</param>
    /// <returns>Created or updated reaction</returns>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<NoteReactionDto>), 201)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> AddReaction(
        [FromRoute] Guid noteId,
        [FromBody] NoteReactionCreateDto reactionCreateDto)
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

            // Ensure the noteId in the route matches the DTO
            reactionCreateDto.NoteId = noteId;

            var result = await _reactionService.AddReactionAsync("demo-workspace", reactionCreateDto, userEmail);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return CreatedAtAction(nameof(GetReactions), new { noteId = noteId }, result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding reaction to note {NoteId}", noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Update an existing reaction
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <param name="reactionId">Reaction ID</param>
    /// <param name="reactionUpdateDto">Updated reaction data</param>
    /// <returns>Updated reaction</returns>
    [HttpPut("{reactionId}")]
    [ProducesResponseType(typeof(ApiResponse<NoteReactionDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    public async Task<IActionResult> UpdateReaction(
        [FromRoute] Guid noteId,
        [FromRoute] Guid reactionId,
        [FromBody] NoteReactionUpdateDto reactionUpdateDto)
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

            var result = await _reactionService.UpdateReactionAsync(reactionId, reactionUpdateDto, userEmail);
            
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
            _logger.LogError(ex, "Error updating reaction {ReactionId} for note {NoteId}", reactionId, noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Remove a reaction
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <param name="reactionId">Reaction ID</param>
    /// <returns>Success confirmation</returns>
    [HttpDelete("{reactionId}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    public async Task<IActionResult> RemoveReaction(
        [FromRoute] Guid noteId,
        [FromRoute] Guid reactionId)
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

            var result = await _reactionService.RemoveReactionAsync(reactionId, userEmail);
            
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
            _logger.LogError(ex, "Error removing reaction {ReactionId} for note {NoteId}", reactionId, noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Remove current user's reaction from a note
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <param name="reactionType">Reaction type to remove</param>
    /// <returns>Success confirmation</returns>
    [HttpDelete]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> RemoveUserReaction([FromRoute] Guid noteId, [FromQuery] string reactionType)
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

            if (string.IsNullOrEmpty(reactionType))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Error = "Reaction type is required"
                });
            }

            var result = await _reactionService.RemoveUserReactionFromNoteAsync(noteId, userEmail, reactionType);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing user reaction {ReactionType} for note {NoteId}", reactionType, noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }

    /// <summary>
    /// Get current user's reaction for a note
    /// </summary>
    /// <param name="noteId">Note ID</param>
    /// <returns>User's reaction or null if no reaction</returns>
    [HttpGet("mine")]
    [ProducesResponseType(typeof(ApiResponse<NoteReactionDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 401)]
    public async Task<IActionResult> GetMyReaction([FromRoute] Guid noteId)
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

            var result = await _reactionService.GetUserReactionForNoteAsync(noteId, userEmail);
            
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user reaction for note {NoteId}", noteId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Error = "An internal server error occurred"
            });
        }
    }
} 