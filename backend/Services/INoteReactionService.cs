using NotesApp.DTOs;
using NotesApp.Models;

namespace NotesApp.Services;

public interface INoteReactionService
{
    Task<ApiResponse<NoteReactionDto>> AddReactionAsync(string workspaceId, NoteReactionCreateDto reactionCreateDto, string userEmail);
    Task<ApiResponse<NoteReactionDto>> UpdateReactionAsync(Guid reactionId, NoteReactionUpdateDto reactionUpdateDto, string userEmail);
    Task<ApiResponse<bool>> RemoveReactionAsync(Guid reactionId, string userEmail);
    Task<ApiResponse<bool>> RemoveUserReactionFromNoteAsync(Guid noteId, string userEmail, string reactionType);
    Task<ApiResponse<IEnumerable<NoteReactionDto>>> GetNoteReactionsAsync(Guid noteId);
    Task<ApiResponse<IEnumerable<NoteReactionSummaryDto>>> GetNoteReactionsSummaryAsync(Guid noteId, string? currentUserEmail = null);
    Task<ApiResponse<NoteReactionDto?>> GetUserReactionForNoteAsync(Guid noteId, string userEmail);
} 