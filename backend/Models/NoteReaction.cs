using System.ComponentModel.DataAnnotations;

namespace NotesApp.Models;

public class NoteReaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid NoteId { get; set; }
    
    [Required]
    [EmailAddress]
    public string UserEmail { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(10)] // Emoji can be up to 4 bytes in UTF-8, but we'll allow some room
    public string ReactionType { get; set; } = string.Empty;
    
    [Required]
    public string WorkspaceId { get; set; } = "demo-workspace";
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public Note Note { get; set; } = null!;
} 