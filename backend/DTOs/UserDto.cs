namespace NotesApp.DTOs;

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTime LastSeen { get; set; }
    public bool IsOnline { get; set; }
} 