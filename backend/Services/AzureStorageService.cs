using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace NotesApp.Services;

public class AzureStorageService : IAzureStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly string _containerName;
    private readonly ILogger<AzureStorageService> _logger;

    public AzureStorageService(IConfiguration configuration, ILogger<AzureStorageService> logger)
    {
        var connectionString = configuration["Azure:StorageConnectionString"];
        _containerName = configuration["Azure:StorageContainerName"] ?? "uploads";
        _blobServiceClient = new BlobServiceClient(connectionString);
        _logger = logger;
    }

    public async Task<string> UploadFileAsync(IFormFile file)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob);
        
        var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
        var blobClient = containerClient.GetBlobClient(fileName);

        await blobClient.UploadAsync(file.OpenReadStream(), new BlobHttpHeaders 
        { 
            ContentType = file.ContentType 
        });

        _logger.LogInformation("File uploaded to Azure Storage: {FileName}", fileName);
        return blobClient.Uri.ToString();
    }

    public async Task DeleteFileAsync(string fileUrl)
    {
        try
        {
            var uri = new Uri(fileUrl);
            var fileName = Path.GetFileName(uri.LocalPath);
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobClient = containerClient.GetBlobClient(fileName);
            await blobClient.DeleteIfExistsAsync();
            _logger.LogInformation("File deleted from Azure Storage: {FileName}", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete file from Azure Storage: {FileUrl}", fileUrl);
        }
    }
} 