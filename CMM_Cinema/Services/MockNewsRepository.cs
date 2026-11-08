using System.Globalization;
using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

public sealed class MockNewsRepository(IMovieRepository movies) : INewsRepository
{
    private const int MaxStories = 12;
    private const int DaysBetweenStories = 3;

    public async Task<IReadOnlyList<NewsStory>> GetStoriesAsync(CancellationToken cancellationToken = default)
    {
        var showing = (await movies.GetByStatusAsync(MovieStatus.NowShowing, cancellationToken)).Where(HasCover).ToList();
        var upcoming = (await movies.GetByStatusAsync(MovieStatus.Upcoming, cancellationToken)).Where(HasCover).ToList();

        // Two now-showing stories, then one coming-soon story, so the list reads as a mix.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var stories = new List<NewsStory>();
        int s = 0, u = 0;
        while (stories.Count < MaxStories && (s < showing.Count || u < upcoming.Count))
        {
            for (var k = 0; k < 2 && s < showing.Count && stories.Count < MaxStories; k++) stories.Add(ShowingStory(showing[s], s++, today, stories.Count));
            if (u < upcoming.Count && stories.Count < MaxStories) stories.Add(UpcomingStory(upcoming[u++], today, stories.Count));
        }
        return stories;
    }

    private static bool HasCover(Movie movie) => !string.IsNullOrWhiteSpace(movie.PosterUrl);

    private static string DateFor(DateOnly today, int position) =>
        today.AddDays(-position * DaysBetweenStories).ToString("MMM dd, yyyy", CultureInfo.InvariantCulture);

    private static NewsStory ShowingStory(Movie movie, int order, DateOnly today, int position)
    {
        var snippet = Snippet(movie.Synopsis);
        var (prefix, title, category, excerpt) = (order % 5) switch
        {
            0 => ("now-showing", $"{movie.Title} is now showing", "Now showing", $"Now playing at CMM Cinema. {snippet}"),
            1 => ("behind-the-scenes", $"Behind the scenes of {movie.Title}", "Feature", $"A look at how {movie.Title} came together, from the first script pages to the final cut. {snippet}"),
            2 => ("qa", $"Join the Q&A after {movie.Title}", "Events", $"Stay after the screening of {movie.Title} for a short Q&A with the team. Seats are limited, so members get first pick."),
            3 => ("student-wednesdays", $"Student Wednesdays: {movie.Title} for less", "Promotion", $"Show a valid student card on Wednesdays and see {movie.Title} at a lower price."),
            _ => ("book-now", $"Ready to book {movie.Title}?", "Guide", $"{movie.Genre}, {movie.Runtime}, rated {movie.Rating}. Pick your seats early for evening shows."),
        };
        return new NewsStory($"{prefix}-{movie.Slug}", title, category, DateFor(today, position), excerpt, movie.Slug, movie.Title, movie.PosterUrl!);
    }

    private static NewsStory UpcomingStory(Movie movie, DateOnly today, int position)
    {
        var when = movie.ReleaseDate is { } date ? date.ToString("d MMMM", CultureInfo.InvariantCulture) : null;
        var title = when is null ? $"{movie.Title} is coming soon" : $"{movie.Title} arrives {when}";
        var excerpt = (when is null ? $"{movie.Title} is coming to CMM Cinema." : $"Mark the date: {movie.Title} opens on {when}.") + " " + Snippet(movie.Synopsis);
        return new NewsStory($"coming-soon-{movie.Slug}", title, "Coming soon", DateFor(today, position), excerpt.Trim(), movie.Slug, movie.Title, movie.PosterUrl!);
    }

    // First sentence of the synopsis, trimmed to a readable length at a word boundary.
    private static string Snippet(string text)
    {
        text = (text ?? "").Trim();
        if (text.Length <= 140) return text;
        var cut = text[..140];
        var space = cut.LastIndexOf(' ');
        return (space > 60 ? cut[..space] : cut).TrimEnd(',', ';', ':', '.', ' ') + "…";
    }
}
