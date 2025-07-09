using System.ComponentModel.DataAnnotations;

namespace NotesApp.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;
    
    public DateTime LastSeen { get; set; } = DateTime.UtcNow;
    
    public bool IsOnline { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
} 