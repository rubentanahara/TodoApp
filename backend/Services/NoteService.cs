using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Ganss.Xss;
using NotesApp.Data;
using NotesApp.DTOs;
using NotesApp.Models;

namespace NotesApp.Services;

public class NoteService : INoteService
{
    private readonly IRepository<Note> _noteRepository;
    private readonly IMemoryCache _cache;
    private readonly ILogger<NoteService> _logger;
    private readonly HtmlSanitizer _htmlSanitizer;
    private readonly TimeSpan _notesCacheExpiry = TimeSpan.FromMinutes(5);

    public NoteService(IRepository<Note> noteRepository, IMemoryCache cache, ILogger<NoteService> logger)
    {
        _noteRepository = noteRepository;
        _cache = cache;
        _logger = logger;
        _htmlSanitizer = new HtmlSanitizer();
    }

    public async Task<ApiResponse<NoteDto>> CreateNoteAsync(string workspaceId, NoteCreateDto noteCreateDto, string authorEmail)
    {
        try
        {
            // Sanitize content to prevent XSS
            var sanitizedContent = _htmlSanitizer.Sanitize(noteCreateDto.Content);

            var note = new Note
            {
                Content = sanitizedContent,
                AuthorEmail = authorEmail,
                X = noteCreateDto.X,
                Y = noteCreateDto.Y,
                WorkspaceId = workspaceId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Version = 1
            };

            await _noteRepository.AddAsync(note);
            await _noteRepository.SaveChangesAsync();

            // Invalidate cache for this workspace
            InvalidateWorkspaceCache(workspaceId);

            var noteDto = MapToDto(note);
            _logger.LogInformation("Created note {NoteId} in workspace {WorkspaceId} by {AuthorEmail}", 
                note.Id, workspaceId, authorEmail);
            
            return new ApiResponse<NoteDto> { Data = noteDto, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating note in workspace {WorkspaceId} by {AuthorEmail}", 
                workspaceId, authorEmail);
            return new ApiResponse<NoteDto>
            {
                Success = false,
                Error = "An error occurred while creating the note"
            };
        }
    }

    public async Task<ApiResponse<NoteDto>> GetNoteAsync(Guid id)
    {
        try
        {
            var cacheKey = $"note_{id}";
            
            if (_cache.TryGetValue(cacheKey, out NoteDto? cachedNote) && cachedNote != null)
            {
                return new ApiResponse<NoteDto> { Data = cachedNote, Success = true };
            }

            var note = await _noteRepository.GetByIdAsync(id);
            
            if (note == null)
            {
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "Note not found"
                };
            }

            var noteDto = MapToDto(note);
            _cache.Set(cacheKey, noteDto, _notesCacheExpiry);

            return new ApiResponse<NoteDto> { Data = noteDto, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting note {NoteId}", id);
            return new ApiResponse<NoteDto>
            {
                Success = false,
                Error = "An error occurred while retrieving the note"
            };
        }
    }

    public async Task<ApiResponse<IEnumerable<NoteDto>>> GetNotesAsync(string workspaceId, decimal? viewportX = null, 
        decimal? viewportY = null, decimal? viewportWidth = null, decimal? viewportHeight = null)
    {
        try
        {
            var cacheKey = GenerateNotesCacheKey(workspaceId, viewportX, viewportY, viewportWidth, viewportHeight);
            
            if (_cache.TryGetValue(cacheKey, out IEnumerable<NoteDto>? cachedNotes) && cachedNotes != null)
            {
                return new ApiResponse<IEnumerable<NoteDto>> { Data = cachedNotes, Success = true };
            }

            IEnumerable<Note> notes;

            if (viewportX.HasValue && viewportY.HasValue && viewportWidth.HasValue && viewportHeight.HasValue)
            {
                // Viewport filtering for performance
                var minX = viewportX.Value;
                var maxX = viewportX.Value + viewportWidth.Value;
                var minY = viewportY.Value;
                var maxY = viewportY.Value + viewportHeight.Value;

                notes = await _noteRepository.FindAsync(n => 
                    n.WorkspaceId == workspaceId &&
                    n.X >= minX && n.X <= maxX &&
                    n.Y >= minY && n.Y <= maxY);
            }
            else
            {
                // Get all notes for workspace (with reasonable limit)
                notes = await _noteRepository.FindAsync(n => n.WorkspaceId == workspaceId);
            }

            var noteDtos = notes.Select(MapToDto).OrderBy(n => n.CreatedAt);
            
            _cache.Set(cacheKey, noteDtos, _notesCacheExpiry);

            return new ApiResponse<IEnumerable<NoteDto>> { Data = noteDtos, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting notes for workspace {WorkspaceId}", workspaceId);
            return new ApiResponse<IEnumerable<NoteDto>>
            {
                Success = false,
                Error = "An error occurred while retrieving notes"
            };
        }
    }

    public async Task<ApiResponse<NoteDto>> UpdateNoteAsync(Guid id, NoteUpdateDto noteUpdateDto, string authorEmail)
    {
        try
        {
            var note = await _noteRepository.GetByIdAsync(id);
            
            if (note == null)
            {
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "Note not found"
                };
            }

            // Check if user is the author
            if (note.AuthorEmail != authorEmail)
            {
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "You can only edit your own notes"
                };
            }

            // Optimistic concurrency control
            if (note.Version != noteUpdateDto.Version)
            {
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "The note has been modified by another user. Please refresh and try again."
                };
            }

            // Update fields if provided
            if (!string.IsNullOrEmpty(noteUpdateDto.Content))
            {
                note.Content = _htmlSanitizer.Sanitize(noteUpdateDto.Content);
            }
            
            if (noteUpdateDto.X.HasValue)
            {
                note.X = noteUpdateDto.X.Value;
            }
            
            if (noteUpdateDto.Y.HasValue)
            {
                note.Y = noteUpdateDto.Y.Value;
            }

            note.UpdatedAt = DateTime.UtcNow;
            note.Version++;

            await _noteRepository.UpdateAsync(note);
            await _noteRepository.SaveChangesAsync();

            // Invalidate cache
            InvalidateNoteCache(id);
            InvalidateWorkspaceCache(note.WorkspaceId);

            var noteDto = MapToDto(note);
            _logger.LogInformation("Updated note {NoteId} by {AuthorEmail}", id, authorEmail);
            
            return new ApiResponse<NoteDto> { Data = noteDto, Success = true };
        }
        catch (DbUpdateConcurrencyException)
        {
            return new ApiResponse<NoteDto>
            {
                Success = false,
                Error = "The note has been modified by another user. Please refresh and try again."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating note {NoteId} by {AuthorEmail}", id, authorEmail);
            return new ApiResponse<NoteDto>
            {
                Success = false,
                Error = "An error occurred while updating the note"
            };
        }
    }

    public async Task<ApiResponse<bool>> DeleteNoteAsync(Guid id, string authorEmail)
    {
        try
        {
            var note = await _noteRepository.GetByIdAsync(id);
            
            if (note == null)
            {
                return new ApiResponse<bool>
                {
                    Success = false,
                    Error = "Note not found"
                };
            }

            // Check if user is the author
            if (note.AuthorEmail != authorEmail)
            {
                return new ApiResponse<bool>
                {
                    Success = false,
                    Error = "You can only delete your own notes"
                };
            }

            await _noteRepository.DeleteAsync(note);
            await _noteRepository.SaveChangesAsync();

            // Invalidate cache
            InvalidateNoteCache(id);
            InvalidateWorkspaceCache(note.WorkspaceId);

            _logger.LogInformation("Deleted note {NoteId} by {AuthorEmail}", id, authorEmail);
            return new ApiResponse<bool> { Data = true, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting note {NoteId} by {AuthorEmail}", id, authorEmail);
            return new ApiResponse<bool>
            {
                Success = false,
                Error = "An error occurred while deleting the note"
            };
        }
    }

    public async Task<ApiResponse<NoteDto>> MoveNoteAsync(Guid id, decimal x, decimal y, string authorEmail)
    {
        try
        {
            var note = await _noteRepository.GetByIdAsync(id);
            
            if (note == null)
            {
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "Note not found"
                };
            }

            // Check if user is the author
            if (note.AuthorEmail != authorEmail)
            {
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "You can only move your own notes"
                };
            }

            // Validate coordinates
            if (x < 0 || x > 5000 || y < 0 || y > 5000)
            {
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "Invalid coordinates. Must be within 0-5000 range."
                };
            }

            note.X = x;
            note.Y = y;
            note.UpdatedAt = DateTime.UtcNow;
            note.Version++;

            await _noteRepository.UpdateAsync(note);
            await _noteRepository.SaveChangesAsync();

            // Invalidate cache
            InvalidateNoteCache(id);
            InvalidateWorkspaceCache(note.WorkspaceId);

            var noteDto = MapToDto(note);
            _logger.LogDebug("Moved note {NoteId} to ({X}, {Y}) by {AuthorEmail}", id, x, y, authorEmail);
            
            return new ApiResponse<NoteDto> { Data = noteDto, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error moving note {NoteId} by {AuthorEmail}", id, authorEmail);
            return new ApiResponse<NoteDto>
            {
                Success = false,
                Error = "An error occurred while moving the note"
            };
        }
    }

    private static NoteDto MapToDto(Note note)
    {
        return new NoteDto
        {
            Id = note.Id,
            Content = note.Content,
            AuthorEmail = note.AuthorEmail,
            X = note.X,
            Y = note.Y,
            WorkspaceId = note.WorkspaceId,
            CreatedAt = note.CreatedAt,
            UpdatedAt = note.UpdatedAt,
            Version = note.Version
        };
    }

    private void InvalidateNoteCache(Guid noteId)
    {
        _cache.Remove($"note_{noteId}");
    }

    private void InvalidateWorkspaceCache(string workspaceId)
    {
        // Remove all cached notes for this workspace
        // This is a simplified approach - in production, you might want to use cache tagging
        var keysToRemove = new List<string>();
        
        // Since we can't easily iterate over cache keys, we'll use a pattern-based approach
        // For now, we'll just remove the common workspace cache keys
        for (int i = 0; i < 10; i++) // Remove some common viewport combinations
        {
            var cacheKey = $"notes_{workspaceId}_{i}";
            keysToRemove.Add(cacheKey);
        }
        
        // Remove the general workspace cache
        keysToRemove.Add($"notes_{workspaceId}");
        
        foreach (var key in keysToRemove)
        {
            _cache.Remove(key);
        }
    }

    private static string GenerateNotesCacheKey(string workspaceId, decimal? viewportX, decimal? viewportY, 
        decimal? viewportWidth, decimal? viewportHeight)
    {
        if (viewportX.HasValue && viewportY.HasValue && viewportWidth.HasValue && viewportHeight.HasValue)
        {
            return $"notes_{workspaceId}_{viewportX}_{viewportY}_{viewportWidth}_{viewportHeight}";
        }
        
        return $"notes_{workspaceId}";
    }
} 