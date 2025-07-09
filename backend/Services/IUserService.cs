using NotesApp.DTOs;

namespace NotesApp.Services;

public interface IUserService
{
    Task<ApiResponse<UserDto>> GetUserAsync(string email);
    Task<ApiResponse<UserDto>> CreateOrUpdateUserAsync(string email, string? displayName = null);
    Task<ApiResponse<bool>> UpdatePresenceAsync(string email, bool isOnline);
    Task<ApiResponse<IEnumerable<UserDto>>> GetOnlineUsersAsync();
    Task<ApiResponse<bool>> UpdateLastSeenAsync(string email);
} 