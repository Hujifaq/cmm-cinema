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
}

public record MovieListingsViewModel(IReadOnlyList<Movie> NowShowing, IReadOnlyList<Movie> Upcoming);
