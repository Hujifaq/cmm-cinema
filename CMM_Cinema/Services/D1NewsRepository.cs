using System.Globalization;
using System.Text.Json;
using CMM_Cinema.Models;
using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;


// Only published stories from the D1 `news` table reach the site; there is no generated filler.
public sealed class D1NewsRepository(D1Client d1, IMemoryCache cache) : INewsRepository
{
    private const string CacheKey = "d1-news";
    private const int MaxStories = 12;
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromSeconds(60);

    public bool CanEdit => true;

    public Task<IReadOnlyList<NewsStory>> GetStoriesAsync(CancellationToken cancellationToken = default) => LoadAsync(cancellationToken);

    // Refresh-ahead: after the first load no visitor waits on D1; see RefreshAheadCache.
    private Task<IReadOnlyList<NewsStory>> LoadAsync(CancellationToken cancellationToken) =>
        cache.GetOrRefreshAsync(CacheKey, CacheLifetime, TimeSpan.FromDays(1), FetchAsync);

    private async Task<IReadOnlyList<NewsStory>> FetchAsync(CancellationToken cancellationToken)
    {
        var rows = await d1.QueryAsync(
            "SELECT n.slug, n.title, n.category, n.excerpt, n.body, n.image_landscape_url, n.published_at, " +
            "m.slug AS movie_slug, m.title AS movie_title, m.poster_url " +
            "FROM news n LEFT JOIN movies m ON m.id = n.movie_id " +
            "WHERE n.is_published = 1 AND n.published_at <= ? ORDER BY n.published_at DESC LIMIT ?",
            [D1Time.Now(), MaxStories], cancellationToken);

        return rows.Select(row =>
        {
            var landscape = Text(row, "image_landscape_url") ?? "";
            var published = DateTimeOffset.TryParse(Text(row, "published_at"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var when) ? when : DateTimeOffset.UtcNow;
            return new NewsStory(
                Text(row, "slug") ?? "",
                Text(row, "title") ?? "",
                Text(row, "category") ?? "",
                published.ToOffset(CinemaTime.Offset).ToString("MMM dd, yyyy", CultureInfo.InvariantCulture),
                Text(row, "excerpt") ?? "",
                Text(row, "movie_slug"),
                Text(row, "movie_title"),
                Text(row, "poster_url") ?? landscape,
                landscape,
                Text(row, "body"));
        }).ToArray();
    }

    public async Task<IReadOnlyList<NewsAdminRow>> GetAdminRowsAsync(CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync(
            "SELECT n.id, n.slug, n.title, n.category, n.image_landscape_url, n.published_at, n.is_published, m.title AS movie_title " +
            "FROM news n LEFT JOIN movies m ON m.id = n.movie_id ORDER BY n.published_at DESC LIMIT 200",
            cancellationToken: cancellationToken);
        return rows.Select(row => new NewsAdminRow(
            row.GetProperty("id").GetInt32(),
            Text(row, "slug") ?? "",
            Text(row, "title") ?? "",
            Text(row, "category") ?? "",
            Text(row, "image_landscape_url") ?? "",
            Text(row, "movie_title"),
            ParseTime(Text(row, "published_at")) ?? DateTimeOffset.UtcNow,
            Flag(row, "is_published"))).ToArray();
    }

    public async Task<NewsForm?> GetFormAsync(int id, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync(
            "SELECT slug, title, category, excerpt, body, movie_id, image_landscape_url, published_at, is_published FROM news WHERE id = ?",
            [id], cancellationToken);
        if (rows.Count == 0) return null;

        var row = rows[0];
        return new NewsForm
        {
            Slug = Text(row, "slug"),
            Title = Text(row, "title") ?? "",
            Category = Text(row, "category") ?? "",
            Excerpt = Text(row, "excerpt") ?? "",
            Body = Text(row, "body"),
            MovieId = row.TryGetProperty("movie_id", out var movie) && movie.ValueKind == JsonValueKind.Number ? movie.GetInt32() : null,
            LandscapeUrl = Text(row, "image_landscape_url"),
            PublishedOn = ParseTime(Text(row, "published_at")) is { } at ? DateOnly.FromDateTime(at.ToOffset(CinemaTime.Offset).DateTime) : CinemaTime.Today,
            IsPublished = Flag(row, "is_published")
        };
    }

    public async Task<NewsSaveResult> CreateAsync(NewsForm form, CancellationToken cancellationToken = default)
    {
        var slug = form.FinalSlug;
        var now = D1Time.Now();
        var rows = await d1.QueryAsync(
            "INSERT INTO news (slug, title, category, excerpt, body, movie_id, image_landscape_url, published_at, is_published, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (slug) DO NOTHING RETURNING id",
            [slug, form.Title, form.Category, form.Excerpt, form.Body, form.MovieId, form.LandscapeUrl,
                D1Time.Format(PublishedAt(form.PublishedOn!.Value, null)), form.IsPublished ? 1 : 0, now, now],
            cancellationToken);
        if (rows.Count == 0) return new NewsSaveResult(NewsSaveStatus.SlugTaken);

        cache.Remove(CacheKey);
        return new NewsSaveResult(NewsSaveStatus.Saved, slug);
    }

    public async Task<NewsSaveResult> UpdateAsync(int id, NewsForm form, CancellationToken cancellationToken = default)
    {
        var existing = await d1.QueryAsync("SELECT published_at FROM news WHERE id = ?", [id], cancellationToken);
        if (existing.Count == 0) return new NewsSaveResult(NewsSaveStatus.NotFound);

        var slug = form.FinalSlug;
        if ((await d1.QueryAsync("SELECT id FROM news WHERE slug = ? AND id <> ?", [slug, id], cancellationToken)).Count > 0)
            return new NewsSaveResult(NewsSaveStatus.SlugTaken);

        var rows = await d1.QueryAsync(
            "UPDATE news SET slug = ?, title = ?, category = ?, excerpt = ?, body = ?, movie_id = ?, image_landscape_url = ?, " +
            "published_at = ?, is_published = ?, updated_at = ? WHERE id = ? RETURNING id",
            [slug, form.Title, form.Category, form.Excerpt, form.Body, form.MovieId, form.LandscapeUrl,
                D1Time.Format(PublishedAt(form.PublishedOn!.Value, ParseTime(Text(existing[0], "published_at")))), form.IsPublished ? 1 : 0, D1Time.Now(), id],
            cancellationToken);
        if (rows.Count == 0) return new NewsSaveResult(NewsSaveStatus.NotFound);

        cache.Remove(CacheKey);
        return new NewsSaveResult(NewsSaveStatus.Saved, slug);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync("DELETE FROM news WHERE id = ? RETURNING id", [id], cancellationToken);
        cache.Remove(CacheKey);
        return rows.Count > 0;
    }

    // Keeps an unchanged day's original time, publishes today's stories immediately, and releases future ones at Bangkok midnight.
    private static DateTimeOffset PublishedAt(DateOnly day, DateTimeOffset? existing)
    {
        if (existing is { } kept && DateOnly.FromDateTime(kept.ToOffset(CinemaTime.Offset).DateTime) == day) return kept;
        return day == CinemaTime.Today
            ? DateTimeOffset.UtcNow
            : new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), CinemaTime.Offset);
    }

    private static DateTimeOffset? ParseTime(string? text) =>
        DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var when) ? when : null;

    private static bool Flag(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.Number && value.GetInt32() == 1;

    private static string? Text(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
