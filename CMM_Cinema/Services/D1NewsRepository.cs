using System.Globalization;
using System.Text.Json;
using CMM_Cinema.Models;
using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;


public sealed class D1NewsRepository(D1Client d1, IMemoryCache cache, MockNewsRepository placeholders) : INewsRepository
{
    private const string CacheKey = "d1-news";
    private const int MaxStories = 12;
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromSeconds(60);

    public async Task<IReadOnlyList<NewsStory>> GetStoriesAsync(CancellationToken cancellationToken = default)
    {
        var stored = await LoadAsync(cancellationToken);
        if (stored.Count >= MaxStories) return stored.Take(MaxStories).ToArray();

        
        var covered = stored.Select(story => story.MovieSlug).OfType<string>().ToHashSet(StringComparer.OrdinalIgnoreCase);
        var filler = (await placeholders.GetStoriesAsync(cancellationToken)).Where(story => story.MovieSlug is null || !covered.Contains(story.MovieSlug));
        return stored.Concat(filler).Take(MaxStories).ToArray();
    }

    private async Task<IReadOnlyList<NewsStory>> LoadAsync(CancellationToken cancellationToken) =>
        (await cache.GetOrCreateAsync(CacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheLifetime;
            return FetchAsync(cancellationToken);
        }))!;

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
                published.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture),
                Text(row, "excerpt") ?? "",
                Text(row, "movie_slug"),
                Text(row, "movie_title"),
                Text(row, "poster_url") ?? landscape,
                landscape,
                Text(row, "body"));
        }).ToArray();
    }

    private static string? Text(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
