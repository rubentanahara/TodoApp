using System.ComponentModel.DataAnnotations;

namespace NotesApp.Models;

public class UserCursor
{
    [Key]
    public string Id { get; set; } = string.Empty; // Composite key will be configured in DbContext
    
    [Required]
    [EmailAddress]
    public string UserEmail { get; set; } = string.Empty;
    
    [Required]
    public string WorkspaceId { get; set; } = "demo-workspace";
    
    [Required]
    [Range(0, 5000)]
    public decimal X { get; set; }
    
    [Required]
    [Range(0, 5000)]
    public decimal Y { get; set; }
    
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
} 