using Microsoft.Extensions.Caching.Memory;
using NotesApp.Data;
using NotesApp.DTOs;
using NotesApp.Models;

namespace NotesApp.Services;

public class UserService : IUserService
{
    private readonly IRepository<User> _userRepository;
    private readonly IMemoryCache _cache;
    private readonly ILogger<UserService> _logger;
    private readonly TimeSpan _userCacheExpiry = TimeSpan.FromMinutes(30);

    public UserService(IRepository<User> userRepository, IMemoryCache cache, ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ApiResponse<UserDto>> GetUserAsync(string email)
    {
        try
        {
            var cacheKey = $"user_{email}";
            
            if (_cache.TryGetValue(cacheKey, out UserDto? cachedUser) && cachedUser != null)
            {
                return new ApiResponse<UserDto> { Data = cachedUser, Success = true };
            }

            var user = await _userRepository.FirstOrDefaultAsync(u => u.Email == email);
            
            if (user == null)
            {
                return new ApiResponse<UserDto> 
                { 
                    Success = false, 
                    Error = "User not found" 
                };
            }

            var userDto = MapToDto(user);
            _cache.Set(cacheKey, userDto, _userCacheExpiry);

            return new ApiResponse<UserDto> { Data = userDto, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user {Email}", email);
            return new ApiResponse<UserDto> 
            { 
                Success = false, 
                Error = "An error occurred while retrieving the user" 
            };
        }
    }

    public async Task<ApiResponse<UserDto>> CreateOrUpdateUserAsync(string email, string? displayName = null)
    {
        try
        {
            var existingUser = await _userRepository.FirstOrDefaultAsync(u => u.Email == email);
            
            if (existingUser != null)
            {
                // Update existing user
                if (!string.IsNullOrEmpty(displayName) && existingUser.DisplayName != displayName)
                {
                    existingUser.DisplayName = displayName;
                    await _userRepository.UpdateAsync(existingUser);
                    await _userRepository.SaveChangesAsync();
                }
                
                var userDto = MapToDto(existingUser);
                var cacheKey = $"user_{email}";
                _cache.Set(cacheKey, userDto, _userCacheExpiry);
                
                return new ApiResponse<UserDto> { Data = userDto, Success = true };
            }

            // Create new user
            var newUser = new User
            {
                Email = email,
                DisplayName = displayName ?? GetDisplayNameFromEmail(email),
                IsOnline = false,
                LastSeen = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            await _userRepository.AddAsync(newUser);
            await _userRepository.SaveChangesAsync();

            var newUserDto = MapToDto(newUser);
            var newCacheKey = $"user_{email}";
            _cache.Set(newCacheKey, newUserDto, _userCacheExpiry);

            _logger.LogInformation("Created new user {Email}", email);
            return new ApiResponse<UserDto> { Data = newUserDto, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating or updating user {Email}", email);
            return new ApiResponse<UserDto> 
            { 
                Success = false, 
                Error = "An error occurred while creating or updating the user" 
            };
        }
    }

    public async Task<ApiResponse<bool>> UpdatePresenceAsync(string email, bool isOnline)
    {
        try
        {
            var user = await _userRepository.FirstOrDefaultAsync(u => u.Email == email);
            
            if (user == null)
            {
                return new ApiResponse<bool> 
                { 
                    Success = false, 
                    Error = "User not found" 
                };
            }

            user.IsOnline = isOnline;
            user.LastSeen = DateTime.UtcNow;
            
            await _userRepository.UpdateAsync(user);
            await _userRepository.SaveChangesAsync();

            // Update cache
            var cacheKey = $"user_{email}";
            _cache.Remove(cacheKey);
            
            // Invalidate online users cache
            _cache.Remove("online_users");

            _logger.LogDebug("Updated presence for user {Email} to {IsOnline}", email, isOnline);
            return new ApiResponse<bool> { Data = true, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating presence for user {Email}", email);
            return new ApiResponse<bool> 
            { 
                Success = false, 
                Error = "An error occurred while updating presence" 
            };
        }
    }

    public async Task<ApiResponse<IEnumerable<UserDto>>> GetOnlineUsersAsync()
    {
        try
        {
            const string cacheKey = "online_users";
            
            if (_cache.TryGetValue(cacheKey, out IEnumerable<UserDto>? cachedUsers) && cachedUsers != null)
            {
                return new ApiResponse<IEnumerable<UserDto>> { Data = cachedUsers, Success = true };
            }

            var onlineUsers = await _userRepository.FindAsync(u => u.IsOnline);
            var userDtos = onlineUsers.Select(MapToDto);
            
            _cache.Set(cacheKey, userDtos, TimeSpan.FromMinutes(2));

            return new ApiResponse<IEnumerable<UserDto>> { Data = userDtos, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting online users");
            return new ApiResponse<IEnumerable<UserDto>> 
            { 
                Success = false, 
                Error = "An error occurred while retrieving online users" 
            };
        }
    }

    public async Task<ApiResponse<bool>> UpdateLastSeenAsync(string email)
    {
        try
        {
            var user = await _userRepository.FirstOrDefaultAsync(u => u.Email == email);
            
            if (user == null)
            {
                return new ApiResponse<bool> 
                { 
                    Success = false, 
                    Error = "User not found" 
                };
            }

            user.LastSeen = DateTime.UtcNow;
            
            await _userRepository.UpdateAsync(user);
            await _userRepository.SaveChangesAsync();

            // Update cache
            var cacheKey = $"user_{email}";
            _cache.Remove(cacheKey);

            return new ApiResponse<bool> { Data = true, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating last seen for user {Email}", email);
            return new ApiResponse<bool> 
            { 
                Success = false, 
                Error = "An error occurred while updating last seen" 
            };
        }
    }

    private static UserDto MapToDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            LastSeen = user.LastSeen,
            IsOnline = user.IsOnline
        };
    }

    private static string GetDisplayNameFromEmail(string email)
    {
        var atIndex = email.IndexOf('@');
        if (atIndex > 0)
        {
            return email.Substring(0, atIndex);
        }
        return email;
    }
} 