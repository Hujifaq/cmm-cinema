using System.Text.Json;
using CMM_Cinema.Models;
using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;

// Reads movies and cast from Cloudflare D1. The catalogue is small, so it is loaded once and cached for a minute;
// listing, detail and search all filter that copy instead of calling D1 on every request.
public sealed class D1MovieRepository(D1Client d1, IMemoryCache cache) : IMovieRepository
{
    private const string CacheKey = "d1-movies";
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromSeconds(60);

    public async Task<IReadOnlyList<Movie>> GetByStatusAsync(MovieStatus status, CancellationToken cancellationToken = default) =>
        (await LoadAsync(cancellationToken)).Where(movie => movie.Status == status).ToArray();

    public async Task<Movie?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        (await LoadAsync(cancellationToken)).FirstOrDefault(movie => string.Equals(movie.Slug, slug, StringComparison.OrdinalIgnoreCase));

    public async Task<IReadOnlyList<Movie>> SearchAsync(string query, int limit, CancellationToken cancellationToken = default)
    {
        var term = query.Trim();
        if (term.Length == 0) return [];
        return (await LoadAsync(cancellationToken))
            .Where(movie => movie.SearchText.Contains(term, StringComparison.OrdinalIgnoreCase))
            .OrderBy(movie => movie.Title.StartsWith(term, StringComparison.OrdinalIgnoreCase) ? 0 : movie.Title.Contains(term, StringComparison.OrdinalIgnoreCase) ? 1 : 2)
            .ThenBy(movie => movie.Status)
            .ThenBy(movie => movie.Title)
            .Take(limit)
            .ToArray();
    }

    private async Task<IReadOnlyList<Movie>> LoadAsync(CancellationToken cancellationToken) =>
        (await cache.GetOrCreateAsync(CacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheLifetime;
            return FetchAsync(cancellationToken);
        }))!;

    private async Task<IReadOnlyList<Movie>> FetchAsync(CancellationToken cancellationToken)
    {
        var movieRows = await d1.QueryAsync(
            "SELECT id, slug, title, genre, duration_minutes, rating, language, synopsis, overview, status, release_date, poster_url, poster_theme, poster_title, trailer_url " +
            "FROM movies WHERE is_archived = 0 ORDER BY id", cancellationToken: cancellationToken);
        var castRows = await d1.QueryAsync(
            "SELECT movie_id, name, role, photo_url FROM cast_members ORDER BY movie_id, sort_order, id", cancellationToken: cancellationToken);

        var castByMovie = castRows
            .GroupBy(row => row.GetProperty("movie_id").GetInt32())
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<CastMember>)group.Select(row => new CastMember(Text(row, "name") ?? "", Text(row, "role") ?? "", Text(row, "photo_url"))).ToArray());

        return movieRows.Select(row =>
        {
            var id = row.GetProperty("id").GetInt32();
            return new Movie(
                id,
                Text(row, "slug") ?? "",
                Text(row, "title") ?? "",
                Text(row, "genre") ?? "",
                row.GetProperty("duration_minutes").GetInt32(),
                Text(row, "rating") ?? "",
                Text(row, "language") ?? "",
                Text(row, "synopsis") ?? "",
                Text(row, "overview") ?? "",
                Enum.TryParse<MovieStatus>(Text(row, "status"), out var status) ? status : MovieStatus.NowShowing,
                DateOnly.TryParse(Text(row, "release_date"), out var releaseDate) ? releaseDate : null,
                Text(row, "poster_url"),
                Text(row, "poster_theme") ?? "ink-orbit",
                Text(row, "poster_title"),
                castByMovie.GetValueOrDefault(id, []),
                Text(row, "trailer_url"));
        }).ToArray();
    }

    private static string? Text(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
