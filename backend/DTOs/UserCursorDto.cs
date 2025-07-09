using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

public class UserCursorDto
{
    [Required]
    [EmailAddress]
    public string UserEmail { get; set; } = string.Empty;
    
    [Required]
    public string WorkspaceId { get; set; } = string.Empty;
    
    [Required]
    [Range(0, 5000)]
    public decimal X { get; set; }
    
    [Required]
    [Range(0, 5000)]
    public decimal Y { get; set; }
    
    public DateTime LastUpdated { get; set; }
} 