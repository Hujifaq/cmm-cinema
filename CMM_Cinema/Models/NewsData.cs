namespace CMM_Cinema.Models;

// One news story. For now stories are generated from the movies in the database (MockNewsRepository);
// the shape stays the same when real news moves into D1.
public record NewsStory(string Slug, string Title, string Category, string Date, string Excerpt, string MovieSlug, string MovieTitle, string PosterUrl)
{
    public string Url => $"/News/{Uri.EscapeDataString(Slug)}";
    // Square, same-origin copy of the movie cover, used for the 3D discs (see NewsController.Art).
    public string ArtUrl => $"/News/art/{Uri.EscapeDataString(Slug)}";
    public string MovieUrl => $"/Movies/{Uri.EscapeDataString(MovieSlug)}";
}

public record NewsStoryViewModel(NewsStory Story, int Index, int Count);
