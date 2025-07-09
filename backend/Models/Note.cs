using System.ComponentModel.DataAnnotations;

namespace NotesApp.Models;

public class Note
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    [MaxLength(10000)]
    public string Content { get; set; } = string.Empty;
    
    [Required]
    [EmailAddress]
    public string AuthorEmail { get; set; } = string.Empty;
    
    [Required]
    [Range(0, 5000)]
    public decimal X { get; set; }
    
    [Required]
    [Range(0, 5000)]
    public decimal Y { get; set; }
    
    [Required]
    public string WorkspaceId { get; set; } = "demo-workspace";
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    [ConcurrencyCheck]
    public int Version { get; set; } = 1;
} 