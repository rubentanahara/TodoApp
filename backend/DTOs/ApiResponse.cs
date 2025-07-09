namespace NotesApp.DTOs;

public class ApiResponse<T>
{
    public T Data { get; set; } = default!;
    public bool Success { get; set; } = true;
    public string? Error { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
} 