using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using NotesApp.DTOs;

namespace NotesApp.Services;

public class AuthService : IAuthService
{
    private readonly IUserService _userService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(IUserService userService, IConfiguration configuration, ILogger<AuthService> logger)
    {
        _userService = userService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto loginDto)
    {
        try
        {
            // Create or update user
            var userResponse = await _userService.CreateOrUpdateUserAsync(loginDto.Email, loginDto.DisplayName);
            
            if (!userResponse.Success)
            {
                return new ApiResponse<AuthResponseDto>
                {
                    Success = false,
                    Error = userResponse.Error
                };
            }

            // Update user presence to online
            await _userService.UpdatePresenceAsync(loginDto.Email, true);

            // Generate JWT token
            var token = GenerateJwtToken(userResponse.Data);
            var expiresAt = DateTime.UtcNow.AddHours(GetTokenExpiryHours());

            var authResponse = new AuthResponseDto
            {
                Token = token,
                User = userResponse.Data,
                ExpiresAt = expiresAt
            };

            _logger.LogInformation("User {Email} logged in successfully", loginDto.Email);
            return new ApiResponse<AuthResponseDto> { Data = authResponse, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for user {Email}", loginDto.Email);
            return new ApiResponse<AuthResponseDto>
            {
                Success = false,
                Error = "An error occurred during login"
            };
        }
    }

    public async Task<ApiResponse<AuthResponseDto>> RefreshTokenAsync(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(GetSecretKey());
            
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = GetIssuer(),
                ValidateAudience = true,
                ValidAudience = GetAudience(),
                ValidateLifetime = false, // Don't validate lifetime for refresh
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out SecurityToken validatedToken);
            var emailClaim = principal.FindFirst(ClaimTypes.Email);
            
            if (emailClaim == null)
            {
                return new ApiResponse<AuthResponseDto>
                {
                    Success = false,
                    Error = "Invalid token"
                };
            }

            var userResponse = await _userService.GetUserAsync(emailClaim.Value);
            
            if (!userResponse.Success)
            {
                return new ApiResponse<AuthResponseDto>
                {
                    Success = false,
                    Error = "User not found"
                };
            }

            // Generate new token
            var newToken = GenerateJwtToken(userResponse.Data);
            var expiresAt = DateTime.UtcNow.AddHours(GetTokenExpiryHours());

            var authResponse = new AuthResponseDto
            {
                Token = newToken,
                User = userResponse.Data,
                ExpiresAt = expiresAt
            };

            _logger.LogInformation("Token refreshed for user {Email}", emailClaim.Value);
            return new ApiResponse<AuthResponseDto> { Data = authResponse, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing token");
            return new ApiResponse<AuthResponseDto>
            {
                Success = false,
                Error = "An error occurred while refreshing token"
            };
        }
    }

    public async Task<ApiResponse<bool>> LogoutAsync(string email)
    {
        try
        {
            // Update user presence to offline
            var result = await _userService.UpdatePresenceAsync(email, false);
            
            if (!result.Success)
            {
                return result;
            }

            _logger.LogInformation("User {Email} logged out successfully", email);
            return new ApiResponse<bool> { Data = true, Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout for user {Email}", email);
            return new ApiResponse<bool>
            {
                Success = false,
                Error = "An error occurred during logout"
            };
        }
    }

    public async Task<ApiResponse<UserDto>> GetCurrentUserAsync(string email)
    {
        try
        {
            var userResponse = await _userService.GetUserAsync(email);
            
            if (!userResponse.Success)
            {
                return userResponse;
            }

            // Update last seen
            await _userService.UpdateLastSeenAsync(email);

            return userResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current user {Email}", email);
            return new ApiResponse<UserDto>
            {
                Success = false,
                Error = "An error occurred while retrieving current user"
            };
        }
    }

    public string GenerateJwtToken(UserDto user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(GetSecretKey());
        
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.DisplayName),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim("user_id", user.Id.ToString())
            }),
            Expires = DateTime.UtcNow.AddHours(GetTokenExpiryHours()),
            Issuer = GetIssuer(),
            Audience = GetAudience(),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    public bool ValidateToken(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(GetSecretKey());
            
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = GetIssuer(),
                ValidateAudience = true,
                ValidAudience = GetAudience(),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };

            tokenHandler.ValidateToken(token, validationParameters, out SecurityToken validatedToken);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private string GetSecretKey()
    {
        return _configuration["JWT:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey is not configured");
    }

    private string GetIssuer()
    {
        return _configuration["JWT:Issuer"] ?? "NotesApp";
    }

    private string GetAudience()
    {
        return _configuration["JWT:Audience"] ?? "NotesApp";
    }

    private int GetTokenExpiryHours()
    {
        if (int.TryParse(_configuration["JWT:ExpiryHours"], out int hours))
        {
            return hours;
        }
        return 24; // Default to 24 hours
    }
} 