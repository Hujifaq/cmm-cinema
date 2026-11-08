namespace CMM_Cinema.Models;

// One news story. For now stories are generated from the movies in the database (MockNewsRepository);
// the shape stays the same when real news moves into D1.
// PosterUrl is the portrait movie cover (cropped square for the discs); LandscapeUrl is the wide image the main page uses.
public record NewsStory(string Slug, string Title, string Category, string Date, string Excerpt, string? MovieSlug, string? MovieTitle, string PosterUrl, string? LandscapeUrl = null, string? Body = null)
{
    public string Url => $"/News/{Uri.EscapeDataString(Slug)}";
    // Square, same-origin copy of the movie cover, used for the 3D discs (see NewsController.Art).
    public string ArtUrl => $"/News/art/{Uri.EscapeDataString(Slug)}";
    public string? MovieUrl => MovieSlug is null ? null : $"/Movies/{Uri.EscapeDataString(MovieSlug)}";
}

public record NewsStoryViewModel(NewsStory Story, int Index, int Count);
