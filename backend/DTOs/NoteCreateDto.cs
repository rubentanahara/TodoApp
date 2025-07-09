using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

public class NoteCreateDto
{
    [Required]
    [MaxLength(10000)]
    public string Content { get; set; } = string.Empty;
    
    [Required]
    [Range(0, 5000)]
    public decimal X { get; set; }
    
    [Required]
    [Range(0, 5000)]
    public decimal Y { get; set; }
} 