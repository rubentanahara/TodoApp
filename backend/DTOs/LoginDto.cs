using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

public class LoginDto
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    
    [MaxLength(100)]
    public string? DisplayName { get; set; }
} 