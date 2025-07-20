using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

public class NoteCreateDto
{
    [Required]
    [MinLength(1, ErrorMessage = "Note content cannot be empty")]
    [MaxLength(10000)]
    public string Content { get; set; } = string.Empty;
    
    [Required]
    public string WorkspaceId { get; set; } = string.Empty;
    
    [Required]
    [Range(0, 5000)]
    public decimal X { get; set; }
    
    [Required]
    [Range(0, 5000)]
    public decimal Y { get; set; }
} 