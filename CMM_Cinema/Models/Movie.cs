namespace CMM_Cinema.Models;

public enum MovieStatus { NowShowing, Upcoming }


public record CastMember(string Name, string Role, string? PhotoUrl = null);

public record Movie(
    int Id,
    string Slug,
    string Title,
    string Genre,
    int DurationMinutes,
    string Rating,
    string Language,
    string Synopsis,
    string Overview,
    MovieStatus Status,
    DateOnly? ReleaseDate,
    string? PosterUrl,
    string PosterTheme,
    string? PosterTitle,
    IReadOnlyList<CastMember> Cast)
{
    public string Runtime => $"{DurationMinutes / 60}h {DurationMinutes % 60:00}m";
    public string Url => $"/Movies/{Slug}";
    // Category words let the Spotlight shortcuts ("movies", "now showing", "coming soon") match like any typed query.
    public string SearchText => string.Join(' ', Title, Genre, Rating, Language, Synopsis, "movies",
        Status == MovieStatus.NowShowing ? "now showing" : "coming soon upcoming");
}

// Spotlight search payload: keywords mirror the fields the repository searches; PosterHtml is the rendered _MoviePoster.
public record MovieSearchResult(string Title, string Url, string Description, string Keywords, string PosterHtml)
{
    public static MovieSearchResult From(Movie movie, string posterHtml) => new(
        movie.Title,
        movie.Url,
        string.Join(" · ", movie.Status == MovieStatus.Upcoming && movie.ReleaseDate is { } date ? "Coming " + date.ToString("d MMM yyyy", System.Globalization.CultureInfo.InvariantCulture) : "Now showing", movie.Genre, movie.Rating, movie.Runtime),
        movie.SearchText.ToLowerInvariant(),
        posterHtml);
}

public record MovieListingsViewModel(IReadOnlyList<Movie> NowShowing, IReadOnlyList<Movie> Upcoming);
