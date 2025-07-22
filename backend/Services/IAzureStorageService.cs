namespace NotesApp.Services;

public interface IAzureStorageService
{
    Task<string> UploadFileAsync(IFormFile file);
    Task DeleteFileAsync(string fileUrl);
} 