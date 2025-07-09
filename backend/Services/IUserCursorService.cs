using NotesApp.DTOs;
using NotesApp.Models;

namespace NotesApp.Services;

public interface IUserCursorService
{
    Task<ApiResponse<UserCursor>> UpdateCursorAsync(string userEmail, string workspaceId, decimal x, decimal y);
    Task<ApiResponse<IEnumerable<UserCursor>>> GetWorkspaceCursorsAsync(string workspaceId);
    Task<ApiResponse<UserCursor?>> GetUserCursorAsync(string userEmail, string workspaceId);
    Task<ApiResponse<bool>> RemoveCursorAsync(string userEmail, string workspaceId);
} 