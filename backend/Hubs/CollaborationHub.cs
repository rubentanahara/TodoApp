using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NotesApp.DTOs;
using NotesApp.Services;
using System.Security.Claims;

namespace NotesApp.Hubs;

[Authorize]
public class CollaborationHub : Hub
{
    private readonly ILogger<CollaborationHub> _logger;
    private readonly INoteService _noteService;
    private readonly IUserService _userService;

    public CollaborationHub(ILogger<CollaborationHub> logger, INoteService noteService, IUserService userService)
    {
        _logger = logger;
        _noteService = noteService;
        _userService = userService;
    }

    public async Task JoinWorkspace(string workspaceId)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, workspaceId);
        await Clients.Group(workspaceId).SendAsync("UserJoined", email);
        
        _logger.LogInformation("User {Email} joined workspace {WorkspaceId}", email, workspaceId);
    }

    public async Task LeaveWorkspace(string workspaceId)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            return;
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, workspaceId);
        await Clients.Group(workspaceId).SendAsync("UserLeft", email);
        
        _logger.LogInformation("User {Email} left workspace {WorkspaceId}", email, workspaceId);
    }

    public async Task UpdateCursor(string workspaceId, decimal x, decimal y)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            return;
        }

        await Clients.Group(workspaceId).SendAsync("CursorMoved", email, x, y);
        
        _logger.LogDebug("Cursor updated for user {Email} in workspace {WorkspaceId}: ({X}, {Y})", 
            email, workspaceId, x, y);
    }

    public async Task CreateNote(string workspaceId, NoteCreateDto noteData)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        try
        {
            var result = await _noteService.CreateNoteAsync(workspaceId, noteData, email);
            
            if (result.Success)
            {
                await Clients.Group(workspaceId).SendAsync("NoteCreated", result.Data);
                _logger.LogInformation("Note created via SignalR by {Email} in workspace {WorkspaceId}", 
                    email, workspaceId);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating note via SignalR");
            await Clients.Caller.SendAsync("Error", "Failed to create note");
        }
    }

    public async Task UpdateNote(Guid noteId, NoteUpdateDto noteData)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        try
        {
            var result = await _noteService.UpdateNoteAsync(noteId, noteData, email);
            
            if (result.Success)
            {
                // Send to all users in the workspace
                var workspaceId = result.Data.WorkspaceId;
                await Clients.Group(workspaceId).SendAsync("NoteUpdated", result.Data);
                
                _logger.LogInformation("Note {NoteId} updated via SignalR by {Email}", noteId, email);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating note via SignalR");
            await Clients.Caller.SendAsync("Error", "Failed to update note");
        }
    }

    public async Task MoveNote(Guid noteId, decimal x, decimal y)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        try
        {
            var result = await _noteService.MoveNoteAsync(noteId, x, y, email);
            
            if (result.Success)
            {
                // Send to all users in the workspace
                var workspaceId = result.Data.WorkspaceId;
                await Clients.Group(workspaceId).SendAsync("NoteMoved", result.Data);
                
                _logger.LogDebug("Note {NoteId} moved via SignalR by {Email} to ({X}, {Y})", 
                    noteId, email, x, y);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error moving note via SignalR");
            await Clients.Caller.SendAsync("Error", "Failed to move note");
        }
    }

    public async Task DeleteNote(Guid noteId)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        try
        {
            // Get the note first to determine the workspace
            var noteResult = await _noteService.GetNoteAsync(noteId);
            if (!noteResult.Success)
            {
                await Clients.Caller.SendAsync("Error", "Note not found");
                return;
            }

            var workspaceId = noteResult.Data.WorkspaceId;
            var deleteResult = await _noteService.DeleteNoteAsync(noteId, email);
            
            if (deleteResult.Success)
            {
                await Clients.Group(workspaceId).SendAsync("NoteDeleted", noteId);
                _logger.LogInformation("Note {NoteId} deleted via SignalR by {Email}", noteId, email);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", deleteResult.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting note via SignalR");
            await Clients.Caller.SendAsync("Error", "Failed to delete note");
        }
    }

    public override async Task OnConnectedAsync()
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (!string.IsNullOrEmpty(email))
        {
            // Update user presence to online
            await _userService.UpdatePresenceAsync(email, true);
        }

        _logger.LogInformation("User {Email} connected to SignalR", email ?? "Unknown");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (!string.IsNullOrEmpty(email))
        {
            // Update user presence to offline
            await _userService.UpdatePresenceAsync(email, false);
        }

        _logger.LogInformation("User {Email} disconnected from SignalR", email ?? "Unknown");
        await base.OnDisconnectedAsync(exception);
    }
} 