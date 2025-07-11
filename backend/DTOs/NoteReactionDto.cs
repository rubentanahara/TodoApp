namespace NotesApp.DTOs;

public class NoteReactionDto
{
    public Guid Id { get; set; }
    public Guid NoteId { get; set; }
    public string UserEmail { get; set; } = string.Empty;
    public string ReactionType { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class NoteReactionCreateDto
{
    public Guid NoteId { get; set; }
    public string ReactionType { get; set; } = string.Empty;
}

public class NoteReactionUpdateDto
{
    public string ReactionType { get; set; } = string.Empty;
}

public class NoteReactionSummaryDto
{
    public string ReactionType { get; set; } = string.Empty;
    public int Count { get; set; }
    public List<string> Users { get; set; } = new();
    public bool HasCurrentUser { get; set; }
} 