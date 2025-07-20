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
    private readonly INoteReactionService _reactionService;

    public CollaborationHub(ILogger<CollaborationHub> logger, INoteService noteService, IUserService userService, INoteReactionService reactionService)
    {
        _logger = logger;
        _noteService = noteService;
        _userService = userService;
        _reactionService = reactionService;
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

        // Notify other users that this user joined (excluding the user who just joined)
        await Clients.GroupExcept(workspaceId, Context.ConnectionId).SendAsync("UserJoined", email);
        
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
    
    public async Task CreateNote(string workspaceId, NoteCreateDto noteData)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;

        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        _logger.LogInformation("SignalR CreateNote called by {Email} in workspace {WorkspaceId}. Content: '{Content}', Position: ({X}, {Y})",
            email, workspaceId, noteData.Content, noteData.X, noteData.Y);

        try
        {
            var result = await _noteService.CreateNoteAsync(workspaceId, noteData, email);

            if (result.Success)
            {
                _logger.LogInformation("Broadcasting NoteCreated to workspace {WorkspaceId}. Note ID: {NoteId}, Content: '{Content}'",
                    workspaceId, result.Data.Id, result.Data.Content);

                await Clients.Group(workspaceId).SendAsync("NoteCreated", result.Data);

                _logger.LogInformation("Note created via SignalR by {Email} in workspace {WorkspaceId} - broadcast completed",
                    email, workspaceId);
            }
            else
            {
                _logger.LogWarning("Note creation failed via SignalR for {Email}: {Error}", email, result.Error);
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating note via SignalR for user {Email} in workspace {WorkspaceId}",
                email, workspaceId);
            await Clients.Caller.SendAsync("Error", "Failed to create note");
        }
    }

    public async Task UpdateNote(string noteId, NoteUpdateDto noteData)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        // Parse string to Guid
        if (!Guid.TryParse(noteId, out var noteGuid))
        {
            await Clients.Caller.SendAsync("Error", "Invalid note ID format");
            return;
        }

        try
        {
            var result = await _noteService.UpdateNoteAsync(noteGuid, noteData, email);
            
            if (result.Success)
            {
                // Send to all users in the workspace
                var workspaceId = result.Data.WorkspaceId;
                await Clients.Group(workspaceId).SendAsync("NoteUpdated", result.Data);
                
                _logger.LogInformation("Note {NoteId} updated via SignalR by {Email}", noteGuid, email);
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

    public async Task MoveNote(string noteId, decimal x, decimal y)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        // Parse string to Guid
        if (!Guid.TryParse(noteId, out var noteGuid))
        {
            await Clients.Caller.SendAsync("Error", "Invalid note ID format");
            return;
        }

        try
        {
            var result = await _noteService.MoveNoteAsync(noteGuid, x, y, email);
            
            if (result.Success)
            {
                // Send to all users in the workspace
                var workspaceId = result.Data.WorkspaceId;
                
                await Clients.Group(workspaceId).SendAsync("NoteMoved", result.Data);
                
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", "Failed to move note " + ex.Message);
        }
    }

    public async Task DeleteNote(string noteId)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        // Parse string to Guid
        if (!Guid.TryParse(noteId, out var noteGuid))
        {
            await Clients.Caller.SendAsync("Error", "Invalid note ID format");
            return;
        }

        try
        {
            // Get the note first to determine the workspace
            var noteResult = await _noteService.GetNoteAsync(noteGuid);
            if (!noteResult.Success)
            {
                await Clients.Caller.SendAsync("Error", "Note not found");
                return;
            }

            var workspaceId = noteResult.Data.WorkspaceId;
            var deleteResult = await _noteService.DeleteNoteAsync(noteGuid, email);
            
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

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (!string.IsNullOrEmpty(email))
        {
            // Update user presence to offline
            await _userService.UpdatePresenceAsync(email, false);
            
            try
            {   
                // Notify other users that this user left (broadcast to all workspaces)
                await Clients.All.SendAsync("UserLeft", email);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not remove cursors for disconnected user {Email}", email);
            }
        }

        _logger.LogInformation("User {Email} disconnected from SignalR", email ?? "Unknown");
        await base.OnDisconnectedAsync(exception);
    }

    public async Task AddReaction(string workspaceId, NoteReactionCreateDto reactionData)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        try
        {
            var result = await _reactionService.AddReactionAsync(workspaceId, reactionData, email);
            
            if (result.Success)
            {
                // Send to all users in the workspace
                await Clients.Group(workspaceId).SendAsync("ReactionAdded", result.Data);
                
                _logger.LogInformation("Reaction added via SignalR by {Email} to note {NoteId}", 
                    email, reactionData.NoteId);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding reaction via SignalR");
            await Clients.Caller.SendAsync("Error", "Failed to add reaction");
        }
    }

    public async Task RemoveReaction(string workspaceId, Guid reactionId)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        try
        {
            var result = await _reactionService.RemoveReactionAsync(reactionId, email);
            
            if (result.Success)
            {
                // Send to all users in the workspace
                await Clients.Group(workspaceId).SendAsync("ReactionRemoved", reactionId);
                
                _logger.LogInformation("Reaction removed via SignalR by {Email}", email);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing reaction via SignalR");
            await Clients.Caller.SendAsync("Error", "Failed to remove reaction");
        }
    }

    public async Task RemoveUserReaction(string workspaceId, Guid noteId, string reactionType)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        try
        {
            var result = await _reactionService.RemoveUserReactionFromNoteAsync(noteId, email, reactionType);
            
            if (result.Success)
            {
                // Send to all users in the workspace
                await Clients.Group(workspaceId).SendAsync("UserReactionRemoved", noteId, email, reactionType);
                
                _logger.LogInformation("User reaction {ReactionType} removed via SignalR by {Email} from note {NoteId}", 
                    reactionType, email, noteId);
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing user reaction via SignalR");
            await Clients.Caller.SendAsync("Error", "Failed to remove user reaction");
        }
    }

    public async Task DeleteImage(string workspaceId, string noteId, string imageUrl)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            await Clients.Caller.SendAsync("Error", "User not authenticated");
            return;
        }

        // Parse string to Guid
        if (!Guid.TryParse(noteId, out var noteGuid))
        {
            await Clients.Caller.SendAsync("Error", "Invalid note ID format");
            return;
        }

        try
        {
            var result = await _noteService.RemoveImageFromNoteAsync(noteGuid, imageUrl, email);
            
            if (result.Success)
            {
                // Get the updated note to broadcast the changes
                var updatedNote = await _noteService.GetNoteAsync(noteGuid);
                if (updatedNote.Success)
                {
                    // Send to all users in the workspace
                    await Clients.Group(workspaceId).SendAsync("NoteUpdated", updatedNote.Data);
                    
                    _logger.LogInformation("Image deleted via SignalR by {Email} from note {NoteId} in workspace {WorkspaceId}", 
                        email, noteId, workspaceId);
                }
                else
                {
                    await Clients.Caller.SendAsync("Error", "Failed to retrieve updated note");
                }
            }
            else
            {
                await Clients.Caller.SendAsync("Error", result.Error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting image via SignalR");
            await Clients.Caller.SendAsync("Error", "Failed to delete image");
        }
    }

    public async Task SignOut(string workspaceId)
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            return;
        }

        try
        {
            // Update user presence to offline
            await _userService.UpdatePresenceAsync(email, false);
            
            // Remove from group
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, workspaceId);
            
            // Notify other users that this user signed out (should remove completely)
            await Clients.Group(workspaceId).SendAsync("UserSignedOut", email);
            
            _logger.LogInformation("User {Email} signed out from workspace {WorkspaceId}", email, workspaceId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error during sign out for user {Email} from workspace {WorkspaceId}", 
                email, workspaceId);
        }
    }
} 