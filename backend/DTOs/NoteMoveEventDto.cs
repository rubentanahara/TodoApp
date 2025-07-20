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
    public NoteDto Note { get; set; } = null!;

    /// <summary>
    /// Email of the user who moved the note
    /// </summary>
    public string MovedBy { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the note was moved
    /// </summary>
    public DateTime MovedAt { get; set; }
} 