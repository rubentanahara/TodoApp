using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

public class NoteUpdateDto
{
    [MaxLength(10000)]
    public string? Content { get; set; }
    
    [Range(0, 5000)]
    public decimal? X { get; set; }
    
    [Range(0, 5000)]
    public decimal? Y { get; set; }
    
    [Required]
    public int Version { get; set; }
    
    public List<string>? ImageUrls { get; set; }
} 