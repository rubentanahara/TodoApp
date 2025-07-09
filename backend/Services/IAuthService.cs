using NotesApp.DTOs;

namespace NotesApp.Services;

public interface IAuthService
{
    Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto loginDto);
    Task<ApiResponse<AuthResponseDto>> RefreshTokenAsync(string token);
    Task<ApiResponse<bool>> LogoutAsync(string email);
    Task<ApiResponse<UserDto>> GetCurrentUserAsync(string email);
    string GenerateJwtToken(UserDto user);
    bool ValidateToken(string token);
} 