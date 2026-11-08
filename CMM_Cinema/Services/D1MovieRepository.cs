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

    public async Task<MovieSaveResult> CreateAsync(MovieForm form, CancellationToken cancellationToken = default)
    {
        var slug = form.FinalSlug;
        var now = D1Time.Now();
        var rows = await d1.QueryAsync(
            "INSERT INTO movies (slug, title, genre, duration_minutes, rating, language, synopsis, overview, status, release_date, poster_url, poster_theme, poster_title, trailer_url, is_archived, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT (slug) DO NOTHING RETURNING id",
            [slug, form.Title, form.Genre, form.DurationMinutes, form.Rating, form.Language, form.Synopsis, form.Overview, form.Status.ToString(),
                ReleaseDate(form), form.PosterUrl, form.PosterTheme, form.PosterTitle, form.TrailerUrl, now, now],
            cancellationToken);
        if (rows.Count == 0) return new MovieSaveResult(MovieSaveStatus.SlugTaken);

        await ReplaceCastAsync(rows[0].GetProperty("id").GetInt32(), form, cancellationToken);
        cache.Remove(CacheKey);
        return new MovieSaveResult(MovieSaveStatus.Saved, slug);
    }

    public async Task<MovieSaveResult> UpdateAsync(int id, MovieForm form, CancellationToken cancellationToken = default)
    {
        var slug = form.FinalSlug;
        if ((await d1.QueryAsync("SELECT id FROM movies WHERE slug = ? AND id <> ?", [slug, id], cancellationToken)).Count > 0)
            return new MovieSaveResult(MovieSaveStatus.SlugTaken);

        var rows = await d1.QueryAsync(
            "UPDATE movies SET slug = ?, title = ?, genre = ?, duration_minutes = ?, rating = ?, language = ?, synopsis = ?, overview = ?, status = ?, " +
            "release_date = ?, poster_url = ?, poster_theme = ?, poster_title = ?, trailer_url = ?, updated_at = ? WHERE id = ? RETURNING id",
            [slug, form.Title, form.Genre, form.DurationMinutes, form.Rating, form.Language, form.Synopsis, form.Overview, form.Status.ToString(),
                ReleaseDate(form), form.PosterUrl, form.PosterTheme, form.PosterTitle, form.TrailerUrl, D1Time.Now(), id],
            cancellationToken);
        if (rows.Count == 0) return new MovieSaveResult(MovieSaveStatus.NotFound);

        await ReplaceCastAsync(id, form, cancellationToken);
        cache.Remove(CacheKey);
        return new MovieSaveResult(MovieSaveStatus.Saved, slug);
    }

    public async Task<bool> ArchiveAsync(int id, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync("UPDATE movies SET is_archived = 1, updated_at = ? WHERE id = ? AND is_archived = 0 RETURNING id", [D1Time.Now(), id], cancellationToken);
        cache.Remove(CacheKey);
        return rows.Count > 0;
    }

    private async Task ReplaceCastAsync(int movieId, MovieForm form, CancellationToken cancellationToken)
    {
        await d1.QueryAsync("DELETE FROM cast_members WHERE movie_id = ?", [movieId], cancellationToken);
        for (var order = 0; order < form.Cast.Count; order++)
        {
            var member = form.Cast[order];
            await d1.QueryAsync(
                "INSERT INTO cast_members (movie_id, name, role, photo_url, sort_order) VALUES (?, ?, ?, ?, ?)",
                [movieId, member.Name, member.Role, member.PhotoUrl, order], cancellationToken);
        }
    }

    private static string? ReleaseDate(MovieForm form) => form.ReleaseDate?.ToString("yyyy-MM-dd");

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
