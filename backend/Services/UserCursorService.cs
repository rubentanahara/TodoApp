using Microsoft.Extensions.Caching.Memory;
using NotesApp.Data;
using NotesApp.DTOs;
using NotesApp.Models;

namespace NotesApp.Services;

public class UserCursorService : IUserCursorService
{
    private readonly IRepository<UserCursor> _cursorRepository;
    private readonly IMemoryCache _cache;
    private readonly ILogger<UserCursorService> _logger;
    private readonly TimeSpan _cursorCacheExpiry = TimeSpan.FromMinutes(5);

    public UserCursorService(IRepository<UserCursor> cursorRepository, IMemoryCache cache, ILogger<UserCursorService> logger)
    {
        _cursorRepository = cursorRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ApiResponse<UserCursor>> UpdateCursorAsync(string userEmail, string workspaceId, decimal x, decimal y)
    {
        try
        {
            _logger.LogDebug("Attempting to update cursor for user {UserEmail} in workspace {WorkspaceId}: ({X}, {Y})", 
                userEmail, workspaceId, x, y);

            // Validate coordinates
            if (x < 0 || x > 5000 || y < 0 || y > 5000)
            {
                _logger.LogWarning("Invalid cursor coordinates for user {UserEmail}: ({X}, {Y})", userEmail, x, y);
                return new ApiResponse<UserCursor>
                {
                    Success = false,
                    Error = "Invalid cursor coordinates. Must be within 0-5000 range."
                };
            }

            // Use simple ID format: email_workspace (remove GUID for consistency)
            var cursorId = $"{userEmail}_{workspaceId}";

            // Find existing cursor
            var existingCursor = await _cursorRepository.FirstOrDefaultAsync(c => 
                c.UserEmail == userEmail && c.WorkspaceId == workspaceId);

            UserCursor cursor;
            
            if (existingCursor != null)
            {
                _logger.LogDebug("Updating existing cursor for user {UserEmail}", userEmail);
                
                // Update existing cursor
                existingCursor.X = x;
                existingCursor.Y = y;
                existingCursor.LastUpdated = DateTime.UtcNow;
                
                await _cursorRepository.UpdateAsync(existingCursor);
                cursor = existingCursor;
            }
            else
            {
                _logger.LogDebug("Creating new cursor for user {UserEmail}", userEmail);
                
                // Create new cursor
                cursor = new UserCursor
                {
                    Id = cursorId,
                    UserEmail = userEmail,
                    WorkspaceId = workspaceId,
                    X = x,
                    Y = y,
                    LastUpdated = DateTime.UtcNow
                };
                
                await _cursorRepository.AddAsync(cursor);
            }

            // Save changes
            await _cursorRepository.SaveChangesAsync();
            _logger.LogDebug("Successfully saved cursor update to database");

            // Update cache
            var cacheKey = $"cursor_{userEmail}_{workspaceId}";
            _cache.Set(cacheKey, cursor, _cursorCacheExpiry);
            
            // Invalidate workspace cursors cache
            _cache.Remove($"workspace_cursors_{workspaceId}");

            _logger.LogInformation("Successfully updated cursor for user {UserEmail} in workspace {WorkspaceId}: ({X}, {Y})", 
                userEmail, workspaceId, x, y);

            return new ApiResponse<UserCursor> { Data = cursor, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating cursor for user {UserEmail} in workspace {WorkspaceId} to ({X}, {Y})", 
                userEmail, workspaceId, x, y);
            return new ApiResponse<UserCursor>
            {
                Success = false,
                Error = "An error occurred while updating cursor position"
            };
        }
    }

    public async Task<ApiResponse<IEnumerable<UserCursor>>> GetWorkspaceCursorsAsync(string workspaceId)
    {
        try
        {
            var cacheKey = $"workspace_cursors_{workspaceId}";
            
            if (_cache.TryGetValue(cacheKey, out IEnumerable<UserCursor>? cachedCursors) && cachedCursors != null)
            {
                return new ApiResponse<IEnumerable<UserCursor>> { Data = cachedCursors, Success = true };
            }

            // Get cursors updated in the last 5 minutes (active users)
            var cutoffTime = DateTime.UtcNow.AddMinutes(-5);
            var cursors = await _cursorRepository.FindAsync(c => 
                c.WorkspaceId == workspaceId && c.LastUpdated >= cutoffTime);

            _cache.Set(cacheKey, cursors, _cursorCacheExpiry);

            _logger.LogDebug("Retrieved {Count} active cursors for workspace {WorkspaceId}", 
                cursors.Count(), workspaceId);

            return new ApiResponse<IEnumerable<UserCursor>> { Data = cursors, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting workspace cursors for {WorkspaceId}", workspaceId);
            return new ApiResponse<IEnumerable<UserCursor>>
            {
                Success = false,
                Error = "An error occurred while retrieving workspace cursors"
            };
        }
    }

    public async Task<ApiResponse<UserCursor?>> GetUserCursorAsync(string userEmail, string workspaceId)
    {
        try
        {
            var cacheKey = $"cursor_{userEmail}_{workspaceId}";
            
            if (_cache.TryGetValue(cacheKey, out UserCursor? cachedCursor) && cachedCursor != null)
            {
                return new ApiResponse<UserCursor?> { Data = cachedCursor, Success = true };
            }

            var cursor = await _cursorRepository.FirstOrDefaultAsync(c => 
                c.UserEmail == userEmail && c.WorkspaceId == workspaceId);

            if (cursor != null)
            {
                _cache.Set(cacheKey, cursor, _cursorCacheExpiry);
            }

            return new ApiResponse<UserCursor?> { Data = cursor, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting cursor for user {UserEmail} in workspace {WorkspaceId}", 
                userEmail, workspaceId);
            return new ApiResponse<UserCursor?>
            {
                Success = false,
                Error = "An error occurred while retrieving user cursor"
            };
        }
    }

    public async Task<ApiResponse<bool>> RemoveCursorAsync(string userEmail, string workspaceId)
    {
        try
        {
            var cursor = await _cursorRepository.FirstOrDefaultAsync(c => 
                c.UserEmail == userEmail && c.WorkspaceId == workspaceId);

            if (cursor != null)
            {
                await _cursorRepository.DeleteAsync(cursor);
                await _cursorRepository.SaveChangesAsync();

                // Remove from cache
                var cacheKey = $"cursor_{userEmail}_{workspaceId}";
                _cache.Remove(cacheKey);
                _cache.Remove($"workspace_cursors_{workspaceId}");

                _logger.LogDebug("Removed cursor for user {UserEmail} in workspace {WorkspaceId}", 
                    userEmail, workspaceId);
            }

            return new ApiResponse<bool> { Data = true, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing cursor for user {UserEmail} in workspace {WorkspaceId}", 
                userEmail, workspaceId);
            return new ApiResponse<bool>
            {
                Success = false,
                Error = "An error occurred while removing cursor"
            };
        }
    }
} 