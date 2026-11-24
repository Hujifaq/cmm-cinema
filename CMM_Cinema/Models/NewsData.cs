namespace CMM_Cinema.Models;

// One published news story from the D1 `news` table (D1NewsRepository).
// PosterUrl is the portrait movie cover (cropped square for the discs); LandscapeUrl is the wide image the main page uses.
public record NewsStory(string Slug, string Title, string Category, string Date, string Excerpt, string? MovieSlug, string? MovieTitle, string PosterUrl, string? LandscapeUrl = null, string? Body = null)
{
    public string Url => $"/News/{Uri.EscapeDataString(Slug)}";
    // Square, same-origin copy of the movie cover, used for the 3D discs (see NewsController.Art).
    public string ArtUrl => $"/News/art/{Uri.EscapeDataString(Slug)}";
    public string? MovieUrl => MovieSlug is null ? null : $"/Movies/{Uri.EscapeDataString(MovieSlug)}";
}

public record NewsStoryViewModel(NewsStory Story, int Index, int Count, Movie? Movie = null, IReadOnlyList<NewsStory>? More = null);
