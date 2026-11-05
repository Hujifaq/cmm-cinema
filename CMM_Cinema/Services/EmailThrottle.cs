using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;


public sealed class EmailThrottle(IMemoryCache cache)
{
    private static readonly Lock Gate = new();

    public bool TryAcquire(string purpose, string email, int maxPerWindow, TimeSpan window)
    {
        var key = $"email-throttle:{purpose}:{UserRepository.NormalizeEmail(email)}";
        lock (Gate)
        {
            var entry = cache.TryGetValue(key, out Window? current) && current is not null
                ? current
                : new Window(0, DateTimeOffset.UtcNow + window);
            if (entry.Count >= maxPerWindow) return false;
            cache.Set(key, entry with { Count = entry.Count + 1 }, entry.ExpiresAt);
            return true;
        }
    }

    private sealed record Window(int Count, DateTimeOffset ExpiresAt);
}
