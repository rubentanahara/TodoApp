using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NotesApp.Data;
using NotesApp.DTOs;
using NotesApp.Models;

namespace NotesApp.Services;

public class NoteReactionService : INoteReactionService
{
    private readonly IRepository<NoteReaction> _reactionRepository;
    private readonly IRepository<Note> _noteRepository;
    private readonly IMemoryCache _cache;
    private readonly ILogger<NoteReactionService> _logger;
    private readonly TimeSpan _reactionsCacheExpiry = TimeSpan.FromMinutes(5);

    // Define available reaction types
    private readonly HashSet<string> _allowedReactionTypes = new()
    {
        "👍", "❤️", "😂", "😮", "😢", "😡"
    };

    public NoteReactionService(IRepository<NoteReaction> reactionRepository, IRepository<Note> noteRepository, 
        IMemoryCache cache, ILogger<NoteReactionService> logger)
    {
        _reactionRepository = reactionRepository;
        _noteRepository = noteRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ApiResponse<NoteReactionDto>> AddReactionAsync(string workspaceId, NoteReactionCreateDto reactionCreateDto, string userEmail)
    {
        try
        {
            // Validate reaction type
            if (!_allowedReactionTypes.Contains(reactionCreateDto.ReactionType))
            {
                return new ApiResponse<NoteReactionDto>
                {
                    Success = false,
                    Error = "Invalid reaction type"
                };
            }

            // Check if note exists
            var note = await _noteRepository.GetByIdAsync(reactionCreateDto.NoteId);
            if (note == null)
            {
                return new ApiResponse<NoteReactionDto>
                {
                    Success = false,
                    Error = "Note not found"
                };
            }

            // Check if user already has a reaction for this note
            var existingReaction = await _reactionRepository.FindAsync(r => 
                r.NoteId == reactionCreateDto.NoteId && r.UserEmail == userEmail);

            if (existingReaction.Any())
            {
                // Update existing reaction instead of creating new one
                var existing = existingReaction.First();
                existing.ReactionType = reactionCreateDto.ReactionType;
                existing.UpdatedAt = DateTime.UtcNow;

                await _reactionRepository.UpdateAsync(existing);
                await _reactionRepository.SaveChangesAsync();

                // Invalidate cache
                InvalidateNoteReactionsCache(reactionCreateDto.NoteId);

                var updatedDto = MapToDto(existing);
                _logger.LogInformation("Updated reaction {ReactionId} for note {NoteId} by {UserEmail}", 
                    existing.Id, reactionCreateDto.NoteId, userEmail);
                
                return new ApiResponse<NoteReactionDto> { Data = updatedDto, Success = true };
            }

            // Create new reaction
            var reaction = new NoteReaction
            {
                NoteId = reactionCreateDto.NoteId,
                UserEmail = userEmail,
                ReactionType = reactionCreateDto.ReactionType,
                WorkspaceId = workspaceId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _reactionRepository.AddAsync(reaction);
            await _reactionRepository.SaveChangesAsync();

            // Invalidate cache
            InvalidateNoteReactionsCache(reactionCreateDto.NoteId);

            var reactionDto = MapToDto(reaction);
            _logger.LogInformation("Added reaction {ReactionId} for note {NoteId} by {UserEmail}", 
                reaction.Id, reactionCreateDto.NoteId, userEmail);
            
            return new ApiResponse<NoteReactionDto> { Data = reactionDto, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding reaction to note {NoteId} by {UserEmail}", 
                reactionCreateDto.NoteId, userEmail);
            return new ApiResponse<NoteReactionDto>
            {
                Success = false,
                Error = "An error occurred while adding the reaction"
            };
        }
    }

    public async Task<ApiResponse<NoteReactionDto>> UpdateReactionAsync(Guid reactionId, NoteReactionUpdateDto reactionUpdateDto, string userEmail)
    {
        try
        {
            // Validate reaction type
            if (!_allowedReactionTypes.Contains(reactionUpdateDto.ReactionType))
            {
                return new ApiResponse<NoteReactionDto>
                {
                    Success = false,
                    Error = "Invalid reaction type"
                };
            }

            var reaction = await _reactionRepository.GetByIdAsync(reactionId);
            if (reaction == null)
            {
                return new ApiResponse<NoteReactionDto>
                {
                    Success = false,
                    Error = "Reaction not found"
                };
            }

            // Check if user owns this reaction
            if (reaction.UserEmail != userEmail)
            {
                return new ApiResponse<NoteReactionDto>
                {
                    Success = false,
                    Error = "You can only update your own reactions"
                };
            }

            reaction.ReactionType = reactionUpdateDto.ReactionType;
            reaction.UpdatedAt = DateTime.UtcNow;

            await _reactionRepository.UpdateAsync(reaction);
            await _reactionRepository.SaveChangesAsync();

            // Invalidate cache
            InvalidateNoteReactionsCache(reaction.NoteId);

            var reactionDto = MapToDto(reaction);
            _logger.LogInformation("Updated reaction {ReactionId} by {UserEmail}", reactionId, userEmail);
            
            return new ApiResponse<NoteReactionDto> { Data = reactionDto, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating reaction {ReactionId} by {UserEmail}", reactionId, userEmail);
            return new ApiResponse<NoteReactionDto>
            {
                Success = false,
                Error = "An error occurred while updating the reaction"
            };
        }
    }

    public async Task<ApiResponse<bool>> RemoveReactionAsync(Guid reactionId, string userEmail)
    {
        try
        {
            var reaction = await _reactionRepository.GetByIdAsync(reactionId);
            if (reaction == null)
            {
                return new ApiResponse<bool>
                {
                    Success = false,
                    Error = "Reaction not found"
                };
            }

            // Check if user owns this reaction
            if (reaction.UserEmail != userEmail)
            {
                return new ApiResponse<bool>
                {
                    Success = false,
                    Error = "You can only remove your own reactions"
                };
            }

            var noteId = reaction.NoteId;
            await _reactionRepository.DeleteAsync(reaction);
            await _reactionRepository.SaveChangesAsync();

            // Invalidate cache
            InvalidateNoteReactionsCache(noteId);

            _logger.LogInformation("Removed reaction {ReactionId} by {UserEmail}", reactionId, userEmail);
            return new ApiResponse<bool> { Data = true, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing reaction {ReactionId} by {UserEmail}", reactionId, userEmail);
            return new ApiResponse<bool>
            {
                Success = false,
                Error = "An error occurred while removing the reaction"
            };
        }
    }

    public async Task<ApiResponse<bool>> RemoveUserReactionFromNoteAsync(Guid noteId, string userEmail, string reactionType)
    {
        try
        {
            var reaction = await _reactionRepository.FirstOrDefaultAsync(r => 
                r.NoteId == noteId && r.UserEmail == userEmail && r.ReactionType == reactionType);

            if (reaction == null)
            {
                return new ApiResponse<bool> { Data = true, Success = true };
            }

            await _reactionRepository.DeleteAsync(reaction);
            await _reactionRepository.SaveChangesAsync();

            // Invalidate cache
            InvalidateNoteReactionsCache(noteId);

            _logger.LogInformation("Removed user reaction {ReactionType} for note {NoteId} by {UserEmail}", reactionType, noteId, userEmail);
            return new ApiResponse<bool> { Data = true, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing user reaction {ReactionType} for note {NoteId} by {UserEmail}", reactionType, noteId, userEmail);
            return new ApiResponse<bool>
            {
                Success = false,
                Error = "An error occurred while removing reaction"
            };
        }
    }

    public async Task<ApiResponse<IEnumerable<NoteReactionDto>>> GetNoteReactionsAsync(Guid noteId)
    {
        try
        {
            var cacheKey = $"note_reactions_{noteId}";
            
            if (_cache.TryGetValue(cacheKey, out IEnumerable<NoteReactionDto>? cachedReactions) && cachedReactions != null)
            {
                return new ApiResponse<IEnumerable<NoteReactionDto>> { Data = cachedReactions, Success = true };
            }

            var reactions = await _reactionRepository.FindAsync(r => r.NoteId == noteId);
            var reactionDtos = reactions.Select(MapToDto);
            
            _cache.Set(cacheKey, reactionDtos, _reactionsCacheExpiry);

            return new ApiResponse<IEnumerable<NoteReactionDto>> { Data = reactionDtos, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reactions for note {NoteId}", noteId);
            return new ApiResponse<IEnumerable<NoteReactionDto>>
            {
                Success = false,
                Error = "An error occurred while retrieving reactions"
            };
        }
    }

    public async Task<ApiResponse<IEnumerable<NoteReactionSummaryDto>>> GetNoteReactionsSummaryAsync(Guid noteId, string? currentUserEmail = null)
    {
        try
        {
            var cacheKey = $"note_reactions_summary_{noteId}_{currentUserEmail ?? "anonymous"}";
            
            if (_cache.TryGetValue(cacheKey, out IEnumerable<NoteReactionSummaryDto>? cachedSummary) && cachedSummary != null)
            {
                return new ApiResponse<IEnumerable<NoteReactionSummaryDto>> { Data = cachedSummary, Success = true };
            }

            var reactions = await _reactionRepository.FindAsync(r => r.NoteId == noteId);
            
            var summaryDtos = reactions
                .GroupBy(r => r.ReactionType)
                .Select(group => new NoteReactionSummaryDto
                {
                    ReactionType = group.Key,
                    Count = group.Count(),
                    Users = group.Select(r => r.UserEmail).ToList(),
                    HasCurrentUser = currentUserEmail != null && group.Any(r => r.UserEmail == currentUserEmail)
                })
                .OrderBy(s => s.ReactionType);
            
            _cache.Set(cacheKey, summaryDtos, _reactionsCacheExpiry);

            return new ApiResponse<IEnumerable<NoteReactionSummaryDto>> { Data = summaryDtos, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reaction summary for note {NoteId}", noteId);
            return new ApiResponse<IEnumerable<NoteReactionSummaryDto>>
            {
                Success = false,
                Error = "An error occurred while retrieving reaction summary"
            };
        }
    }

    public async Task<ApiResponse<NoteReactionDto?>> GetUserReactionForNoteAsync(Guid noteId, string userEmail)
    {
        try
        {
            var reactions = await _reactionRepository.FindAsync(r => 
                r.NoteId == noteId && r.UserEmail == userEmail);

            var reaction = reactions.FirstOrDefault();
            var reactionDto = reaction != null ? MapToDto(reaction) : null;

            return new ApiResponse<NoteReactionDto?> { Data = reactionDto, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user reaction for note {NoteId} by {UserEmail}", noteId, userEmail);
            return new ApiResponse<NoteReactionDto?>
            {
                Success = false,
                Error = "An error occurred while retrieving user reaction"
            };
        }
    }

    private static NoteReactionDto MapToDto(NoteReaction reaction)
    {
        return new NoteReactionDto
        {
            Id = reaction.Id,
            NoteId = reaction.NoteId,
            UserEmail = reaction.UserEmail,
            ReactionType = reaction.ReactionType,
            WorkspaceId = reaction.WorkspaceId,
            CreatedAt = reaction.CreatedAt,
            UpdatedAt = reaction.UpdatedAt
        };
    }

    private void InvalidateNoteReactionsCache(Guid noteId)
    {
        var keysToRemove = new List<string>();
        
        // Remove all cached reaction data for this note
        keysToRemove.Add($"note_reactions_{noteId}");
        
        // We can't easily enumerate all cache keys, so we'll just remove the specific ones we know about
        foreach (var key in keysToRemove)
        {
            _cache.Remove(key);
        }
        
        // Also remove summary cache keys (we can't enumerate all possible user emails, so we'll let these expire naturally)
        _logger.LogDebug("Invalidated reaction cache for note {NoteId}", noteId);
    }
} 