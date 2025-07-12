using System.ComponentModel.DataAnnotations;

namespace NotesApp.DTOs;

public class DeleteImageDto
{
    [Required(ErrorMessage = "Image URL is required")]
    [Url(ErrorMessage = "Invalid image URL format")]
    public string ImageUrl { get; set; } = string.Empty;
} 