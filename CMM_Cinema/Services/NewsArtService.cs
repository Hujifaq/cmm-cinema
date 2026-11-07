using System.Collections.Concurrent;
using CMM_Cinema.Models;
using Microsoft.Extensions.Caching.Memory;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace CMM_Cinema.Services;


public sealed class NewsArtService(IHttpClientFactory httpClients, IMemoryCache cache, ILogger<NewsArtService> logger)
{
    private const int ArtSize = 900;
    private const long MaxCoverBytes = 25 * 1024 * 1024;
    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(6);
    private readonly ConcurrentDictionary<string, Task<byte[]?>> inFlight = new();

    public Task<byte[]?> GetAsync(NewsStory story)
    {
        var key = $"news-art:{story.Slug}";
        if (cache.TryGetValue(key, out byte[]? hit)) return Task.FromResult(hit);
        return inFlight.GetOrAdd(key, _ => FetchAndCacheAsync(key, story.PosterUrl));
    }

    private async Task<byte[]?> FetchAndCacheAsync(string key, string url)
    {
        try
        {
            var bytes = await RenderSquareAsync(url);
            cache.Set(key, bytes, bytes is null ? TimeSpan.FromMinutes(1) : Lifetime);
            return bytes;
        }
        finally
        {
            inFlight.TryRemove(key, out _);
        }
    }

    private async Task<byte[]?> RenderSquareAsync(string url)
    {
        try
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return null;
            using var response = await httpClients.CreateClient("news-art").GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > MaxCoverBytes) return null;

            await using var source = await response.Content.ReadAsStreamAsync();
            using var image = await Image.LoadAsync(source);
            image.Mutate(x => x.BackgroundColor(Color.White).Resize(new ResizeOptions { Size = new Size(ArtSize, ArtSize), Mode = ResizeMode.Crop, Position = AnchorPositionMode.Center }));
            await using var output = new MemoryStream();
            await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = 84 });
            return output.ToArray();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UnknownImageFormatException or InvalidImageContentException)
        {
            logger.LogWarning(ex, "Could not prepare news cover {Url}", url);
            return null;
        }
    }
}

// Prepares every cover shortly after start-up, so the first visitor does not wait for a large poster to download.
public sealed class NewsArtWarmup(IServiceScopeFactory scopes, NewsArtService art, ILogger<NewsArtWarmup> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
            using var scope = scopes.CreateScope();
            var stories = await scope.ServiceProvider.GetRequiredService<INewsRepository>().GetStoriesAsync(stoppingToken);
            foreach (var batch in stories.Chunk(3))
                await Task.WhenAll(batch.Select(story => art.GetAsync(story)));
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "News cover warm-up failed");
        }
    }
}
