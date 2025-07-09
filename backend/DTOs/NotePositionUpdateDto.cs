using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

public class NotePositionUpdateDto
{
    [Required]
    [Range(0, 5000)]
    public decimal X { get; set; }
    
    [Required]
    [Range(0, 5000)]
    public decimal Y { get; set; }
} 