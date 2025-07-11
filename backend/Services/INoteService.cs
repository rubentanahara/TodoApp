using NotesApp.DTOs;
using NotesApp.Models;

namespace NotesApp.Services;

public interface INoteService
{
    Task<ApiResponse<NoteDto>> CreateNoteAsync(string workspaceId, NoteCreateDto noteCreateDto, string authorEmail);
    Task<ApiResponse<NoteDto>> GetNoteAsync(Guid id);
    Task<ApiResponse<IEnumerable<NoteDto>>> GetNotesAsync(string workspaceId, decimal? viewportX = null, decimal? viewportY = null, decimal? viewportWidth = null, decimal? viewportHeight = null);
    Task<ApiResponse<NoteDto>> UpdateNoteAsync(Guid id, NoteUpdateDto noteUpdateDto, string authorEmail);
    Task<ApiResponse<bool>> DeleteNoteAsync(Guid id, string authorEmail);
    Task<ApiResponse<NoteDto>> MoveNoteAsync(Guid id, decimal x, decimal y, string authorEmail);
    Task<ApiResponse<bool>> AddImageToNoteAsync(Guid noteId, string imageUrl);
} 