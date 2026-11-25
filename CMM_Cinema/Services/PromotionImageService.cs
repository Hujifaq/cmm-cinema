using System.Collections.Concurrent;
using CMM_Cinema.Models;
using Microsoft.Extensions.Caching.Memory;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace CMM_Cinema.Services;

public sealed class PromotionImageService(IHttpClientFactory httpClients, IMemoryCache cache, ILogger<PromotionImageService> logger)
{
    public const string HttpClientName = "promo-art";
    public const double MinRatio = 1.65;
    public const double MaxRatio = 1.9;
    private const int MaxWidth = 1672;
    private const long MaxBytes = 25 * 1024 * 1024;
    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(6);
    private readonly ConcurrentDictionary<string, Task<byte[]?>> inFlight = new();

    public Task<byte[]?> GetAsync(Promotion promotion)
    {
        var key = $"promo-art:{promotion.Id}:{promotion.UpdatedAt.UtcTicks}";
        if (cache.TryGetValue(key, out byte[]? hit)) return Task.FromResult(hit);
        return inFlight.GetOrAdd(key, _ => FetchAndCacheAsync(key, promotion.ImageUrl));
    }

    public async Task<(int Width, int Height)?> MeasureAsync(string url, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return null;
            using var response = await httpClients.CreateClient(HttpClientName).GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > MaxBytes) return null;

            await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
            var info = await Image.IdentifyAsync(source, cancellationToken);
            return (info.Width, info.Height);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UnknownImageFormatException or InvalidImageContentException)
        {
            logger.LogWarning(ex, "Could not measure promotion banner {Url}", url);
            return null;
        }
    }

    private async Task<byte[]?> FetchAndCacheAsync(string key, string url)
    {
        try
        {
            var bytes = await RenderAsync(url);
            cache.Set(key, bytes, bytes is null ? TimeSpan.FromMinutes(1) : Lifetime);
            return bytes;
        }
        finally
        {
            inFlight.TryRemove(key, out _);
        }
    }

    private async Task<byte[]?> RenderAsync(string url)
    {
        try
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return null;
            using var response = await httpClients.CreateClient(HttpClientName).GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > MaxBytes) return null;

            await using var source = await response.Content.ReadAsStreamAsync();
            using var image = await Image.LoadAsync(source);
            if (image.Width > MaxWidth) image.Mutate(x => x.Resize(MaxWidth, 0));
            await using var output = new MemoryStream();
            await image.SaveAsWebpAsync(output, new WebpEncoder { Quality = 90 });
            return output.ToArray();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UnknownImageFormatException or InvalidImageContentException)
        {
            logger.LogWarning(ex, "Could not prepare promotion banner {Url}", url);
            return null;
        }
    }
}
