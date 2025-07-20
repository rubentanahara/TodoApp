using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

/// <summary>
/// Data transfer object for note move events broadcasted via SignalR
/// </summary>
public class NoteMoveEventDto
{
    /// <summary>
    /// The updated note after the move
    /// </summary>
    [Required]
    public required NoteDto Note { get; set; }

    /// <summary>
    /// Email of the user who moved the note
    /// </summary>
    [Required]
    public required string MovedBy { get; set; }

    /// <summary>
    /// UTC timestamp when the note was moved
    /// </summary>
    [Required]
    public required DateTime MovedAt { get; set; }
} 