namespace NotesApp.DTOs;

public class NoteDto
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string AuthorEmail { get; set; } = string.Empty;
    public decimal X { get; set; }
    public decimal Y { get; set; }
    public string WorkspaceId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int Version { get; set; }
} 