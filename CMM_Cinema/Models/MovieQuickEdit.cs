using System.ComponentModel.DataAnnotations;

namespace CMM_Cinema.Models;

// What the inline editor on the movie page sends. Everything else (cast, slug, poster style) is kept as it was.
public sealed class MovieQuickEdit
{
    [Required, StringLength(120)] public string? Title { get; set; }
    [Required, StringLength(80)] public string? Genre { get; set; }
    [Range(1, 600)] public int DurationMinutes { get; set; }
    [Required, StringLength(10)] public string? Rating { get; set; }
    [Required, StringLength(20)] public string? Language { get; set; }
    [Required, StringLength(240)] public string? Synopsis { get; set; }
    [Required, StringLength(3000)] public string? Overview { get; set; }
    public string? Status { get; set; }
    public DateOnly? ReleaseDate { get; set; }
    [HttpsUrl, StringLength(500)] public string? PosterUrl { get; set; }
    [StringLength(500)] public string? TrailerUrl { get; set; }
}
