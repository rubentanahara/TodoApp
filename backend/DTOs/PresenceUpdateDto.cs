using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

public class PresenceUpdateDto
{
    [Required]
    public bool IsOnline { get; set; }
} 