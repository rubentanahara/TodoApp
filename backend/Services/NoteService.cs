using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Ganss.Xss;
using NotesApp.Data;
using NotesApp.DTOs;
using NotesApp.Models;
using System.Collections.Concurrent;
using System.Text.Json;

namespace NotesApp.Services;

public class NoteService : INoteService
{
    private readonly IRepository<Note> _noteRepository;
    private readonly NotesDbContext _dbContext; // Add DbContext for Include operations
    private readonly IMemoryCache _cache;
    private readonly ILogger<NoteService> _logger;
    private readonly HtmlSanitizer _htmlSanitizer;
    private readonly TimeSpan _notesCacheExpiry = TimeSpan.FromMinutes(5);
    
    // Rate limiting for move operations per user per note
    private readonly ConcurrentDictionary<string, DateTime> _lastMoveTime = new();
    private readonly TimeSpan _moveThrottleInterval = TimeSpan.FromMilliseconds(100); // Max 10 moves per second

    public NoteService(IRepository<Note> noteRepository, NotesDbContext dbContext, IMemoryCache cache, ILogger<NoteService> logger)
    {
        _noteRepository = noteRepository;
        _dbContext = dbContext;
        _cache = cache;
        _logger = logger;
        _htmlSanitizer = new HtmlSanitizer();
    }

    public async Task<ApiResponse<NoteDto>> CreateNoteAsync(string workspaceId, NoteCreateDto noteCreateDto, string authorEmail)
    {
        try
        {
            _logger.LogInformation("Creating note in workspace {WorkspaceId} by {AuthorEmail}. Original content: '{Content}'", 
                workspaceId, authorEmail, noteCreateDto.Content);

            // Validate content is not empty or whitespace
            if (string.IsNullOrWhiteSpace(noteCreateDto.Content))
            {
                _logger.LogWarning("Note creation failed: empty content for user {AuthorEmail}", authorEmail);
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "Note content cannot be empty"
                };
            }

            // Sanitize content to prevent XSS
            var sanitizedContent = _htmlSanitizer.Sanitize(noteCreateDto.Content).Trim();
            _logger.LogInformation("Content after sanitization: '{SanitizedContent}'", sanitizedContent);

            // Double-check after sanitization
            if (string.IsNullOrWhiteSpace(sanitizedContent))
            {
                _logger.LogWarning("Note creation failed: content empty after sanitization for user {AuthorEmail}", authorEmail);
                return new ApiResponse<NoteDto>
                {
                    Success = false,
                    Error = "Note content cannot be empty after sanitization"
                };
            }

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
            _logger.LogInformation("Successfully created note {NoteId} in workspace {WorkspaceId} by {AuthorEmail} with content: '{Content}'", 
                note.Id, workspaceId, authorEmail, noteDto.Content);
            
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

            // Use DbContext to include reactions
            var note = await _dbContext.Notes
                .Include(n => n.Reactions)
                .FirstOrDefaultAsync(n => n.Id == id);
            
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

            IQueryable<Note> query = _dbContext.Notes.Include(n => n.Reactions);

            if (viewportX.HasValue && viewportY.HasValue && viewportWidth.HasValue && viewportHeight.HasValue)
            {
                // Viewport filtering for performance
                var minX = viewportX.Value;
                var maxX = viewportX.Value + viewportWidth.Value;
                var minY = viewportY.Value;
                var maxY = viewportY.Value + viewportHeight.Value;

                query = query.Where(n => 
                    n.WorkspaceId == workspaceId &&
                    n.X >= minX && n.X <= maxX &&
                    n.Y >= minY && n.Y <= maxY);
            }
            else
            {
                // Get all notes for workspace (with reasonable limit)
                query = query.Where(n => n.WorkspaceId == workspaceId);
            }

            var notes = await query.ToListAsync();
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
                var sanitizedContent = _htmlSanitizer.Sanitize(noteUpdateDto.Content).Trim();
                
                // Validate content is not empty after sanitization
                if (string.IsNullOrWhiteSpace(sanitizedContent))
                {
                    return new ApiResponse<NoteDto>
                    {
                        Success = false,
                        Error = "Note content cannot be empty"
                    };
                }
                
                note.Content = sanitizedContent;
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
            // Rate limiting check
            var rateLimitKey = $"{authorEmail}_{id}";
            var now = DateTime.UtcNow;
            
            if (_lastMoveTime.TryGetValue(rateLimitKey, out var lastMove))
            {
                if (now - lastMove < _moveThrottleInterval)
                {
                    _logger.LogDebug("Rate limit exceeded for note {NoteId} by {AuthorEmail}", id, authorEmail);
                    return new ApiResponse<NoteDto>
                    {
                        Success = false,
                        Error = "Too many move requests. Please slow down."
                    };
                }
            }
            
            _lastMoveTime[rateLimitKey] = now;

            // Retry logic for concurrency conflicts
            const int maxRetries = 3;
            for (int attempt = 0; attempt < maxRetries; attempt++)
            {
                try
                {
                    // Use DbContext to include reactions
                    var note = await _dbContext.Notes
                        .Include(n => n.Reactions)
                        .FirstOrDefaultAsync(n => n.Id == id);
                    
                    if (note == null)
                    {
                        return new ApiResponse<NoteDto>
                        {
                            Success = false,
                            Error = "Note not found"
                        };
                    }

                    // REMOVED: Ownership check - any authenticated user can now move any note
                    // This enables collaborative editing where users can help organize notes

                    // Validate coordinates
                    if (x < 0 || x > 5000 || y < 0 || y > 5000)
                    {
                        return new ApiResponse<NoteDto>
                        {
                            Success = false,
                            Error = "Invalid coordinates. Must be within 0-5000 range."
                        };
                    }

                    // Check if position actually changed (avoid unnecessary updates)
                    if (Math.Abs(note.X - x) < 0.1m && Math.Abs(note.Y - y) < 0.1m)
                    {
                        _logger.LogDebug("Position unchanged for note {NoteId}, skipping update", id);
                        return new ApiResponse<NoteDto> { Data = MapToDto(note), Success = true };
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
                    _logger.LogInformation("Moved note {NoteId} (author: {NoteAuthor}) to ({X}, {Y}) by {MoverEmail}", 
                        id, note.AuthorEmail, x, y, authorEmail);
                    
                    return new ApiResponse<NoteDto> { Data = noteDto, Success = true };
                }
                catch (DbUpdateConcurrencyException) when (attempt < maxRetries - 1)
                {
                    _logger.LogDebug("Concurrency conflict for note {NoteId}, attempt {Attempt}/{MaxRetries}", 
                        id, attempt + 1, maxRetries);
                    
                    // Wait a short time before retry with exponential backoff
                    await Task.Delay(TimeSpan.FromMilliseconds(50 * Math.Pow(2, attempt)));
                    continue;
                }
            }

            // If we get here, all retries failed
            return new ApiResponse<NoteDto>
            {
                Success = false,
                Error = "The note was updated by another user. Please try again."
            };
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

    public async Task<ApiResponse<bool>> AddImageToNoteAsync(Guid noteId, string imageUrl)
    {
        try
        {
            var note = await _noteRepository.GetByIdAsync(noteId);
            if (note == null)
            {
                return new ApiResponse<bool>
                {
                    Success = false,
                    Error = "Note not found"
                };
            }

            // Parse existing image URLs
            var imageUrls = new List<string>();
            if (!string.IsNullOrEmpty(note.ImageUrls))
            {
                try
                {
                    imageUrls = JsonSerializer.Deserialize<List<string>>(note.ImageUrls) ?? new();
                }
                catch
                {
                    imageUrls = new List<string>();
                }
            }

            // Add new image URL
            imageUrls.Add(imageUrl);

            // Update note
            note.ImageUrls = JsonSerializer.Serialize(imageUrls);
            note.UpdatedAt = DateTime.UtcNow;
            note.Version++;

            await _noteRepository.UpdateAsync(note);
            await _noteRepository.SaveChangesAsync();

            // Invalidate cache
            InvalidateNoteCache(noteId);
            InvalidateWorkspaceCache(note.WorkspaceId);

            _logger.LogInformation("Added image to note {NoteId}: {ImageUrl}", noteId, imageUrl);
            return new ApiResponse<bool>
            {
                Success = true,
                Data = true
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding image to note {NoteId}", noteId);
            return new ApiResponse<bool>
            {
                Success = false,
                Error = "Failed to add image to note"
            };
        }
    }

    public async Task<ApiResponse<bool>> RemoveImageFromNoteAsync(Guid noteId, string imageUrl, string authorEmail)
    {
        try
        {
            var note = await _noteRepository.GetByIdAsync(noteId);
            if (note == null)
            {
                return new ApiResponse<bool>
                {
                    Success = false,
                    Error = "Note not found"
                };
            }

            // Check if user is the author (only authors can delete images)
            if (note.AuthorEmail != authorEmail)
            {
                return new ApiResponse<bool>
                {
                    Success = false,
                    Error = "You can only delete images from your own notes"
                };
            }

            // Parse existing image URLs
            var imageUrls = new List<string>();
            if (!string.IsNullOrEmpty(note.ImageUrls))
            {
                try
                {
                    imageUrls = JsonSerializer.Deserialize<List<string>>(note.ImageUrls) ?? new();
                }
                catch
                {
                    imageUrls = new List<string>();
                }
            }

            // Check if image URL exists in the note
            if (!imageUrls.Contains(imageUrl))
            {
                return new ApiResponse<bool>
                {
                    Success = false,
                    Error = "Image not found in this note"
                };
            }

            // Remove the image URL from the list
            imageUrls.Remove(imageUrl);

            // Update note
            note.ImageUrls = JsonSerializer.Serialize(imageUrls);
            note.UpdatedAt = DateTime.UtcNow;
            note.Version++;

            await _noteRepository.UpdateAsync(note);
            await _noteRepository.SaveChangesAsync();

            // Try to delete the physical file
            try
            {
                // Extract filename from URL (assuming format: http://domain/uploads/filename.ext)
                var uri = new Uri(imageUrl);
                var fileName = Path.GetFileName(uri.LocalPath);
                
                if (!string.IsNullOrEmpty(fileName))
                {
                    var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
                    var filePath = Path.Combine(uploadsDir, fileName);
                    
                    if (File.Exists(filePath))
                    {
                        File.Delete(filePath);
                        _logger.LogInformation("Deleted physical file: {FilePath}", filePath);
                    }
                    else
                    {
                        _logger.LogWarning("Physical file not found for deletion: {FilePath}", filePath);
                    }
                }
            }
            catch (Exception fileEx)
            {
                _logger.LogWarning(fileEx, "Failed to delete physical file for image: {ImageUrl}", imageUrl);
                // Don't fail the operation if file deletion fails
            }

            // Invalidate cache
            InvalidateNoteCache(noteId);
            InvalidateWorkspaceCache(note.WorkspaceId);

            _logger.LogInformation("Removed image from note {NoteId} by {AuthorEmail}: {ImageUrl}", noteId, authorEmail, imageUrl);
            return new ApiResponse<bool>
            {
                Success = true,
                Data = true
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing image from note {NoteId} by {AuthorEmail}", noteId, authorEmail);
            return new ApiResponse<bool>
            {
                Success = false,
                Error = "Failed to remove image from note"
            };
        }
    }

    private static NoteDto MapToDto(Note note)
    {
        var imageUrls = new List<string>();
        if (!string.IsNullOrEmpty(note.ImageUrls))
        {
            try
            {
                imageUrls = JsonSerializer.Deserialize<List<string>>(note.ImageUrls) ?? new();
            }
            catch
            {
                // If JSON parsing fails, ignore
            }
        }

        // Convert reactions to summary DTOs
        var reactions = note.Reactions?
            .GroupBy(r => r.ReactionType)
            .Select(g => new NoteReactionSummaryDto
            {
                ReactionType = g.Key,
                Count = g.Count(),
                Users = g.Select(r => r.UserEmail).ToList(),
                HasCurrentUser = false // Will be set by the controller based on current user
            })
            .ToList() ?? new List<NoteReactionSummaryDto>();

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
            Version = note.Version,
            ImageUrls = imageUrls,
            Reactions = reactions
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