using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;

// Stale-while-revalidate on top of IMemoryCache. Every D1 query is an HTTPS round trip to Cloudflare, so a plain
// expiring entry makes one unlucky visitor wait each time it lapses. Here, once a value is older than `freshFor`,
// callers keep getting the last copy while a single background refresh fetches the next one. Only the very first
// load (or the first one after cache.Remove(key)) waits, and concurrent callers share that one fetch.
// cache.Remove(key) still forces the next read to go to the database, so admin edits show up immediately.
public static class RefreshAheadCache
{
    private static readonly TimeSpan RetryAfterFailure = TimeSpan.FromSeconds(15);

    private sealed class Slot
    {
        public Task? Value;
        public DateTimeOffset FreshUntil;
        public bool Refreshing;
    }

    public static Task<T> GetOrRefreshAsync<T>(this IMemoryCache cache, string key, TimeSpan freshFor, TimeSpan keepIdleFor,
        Func<CancellationToken, Task<T>> fetch)
    {
        var slot = cache.GetOrCreate(key, entry =>
        {
            // Entries nobody reads for a while drop out, so per-user keys don't pile up.
            entry.SlidingExpiration = keepIdleFor;
            return new Slot();
        })!;

        lock (slot)
        {
            if (slot.Value is Task<T> { IsCompletedSuccessfully: true } ready)
            {
                if (!slot.Refreshing && DateTimeOffset.UtcNow >= slot.FreshUntil)
                {
                    slot.Refreshing = true;
                    _ = Task.Run(() => RefreshAsync(slot, freshFor, fetch));
                }
                return ready;
            }

            // First load still running: wait for the same fetch instead of starting another.
            if (slot.Value is Task<T> { IsCompleted: false } loading) return loading;

            // Empty, or the last load failed: load now.
            var load = LoadAsync(slot, freshFor, fetch);
            slot.Value = load;
            return load;
        }
    }

    // Not tied to any one request's cancellation: the result is shared by everyone waiting on it.
    private static async Task<T> LoadAsync<T>(Slot slot, TimeSpan freshFor, Func<CancellationToken, Task<T>> fetch)
    {
        await Task.Yield();
        var value = await fetch(CancellationToken.None);
        lock (slot) slot.FreshUntil = DateTimeOffset.UtcNow + freshFor;
        return value;
    }

    private static async Task RefreshAsync<T>(Slot slot, TimeSpan freshFor, Func<CancellationToken, Task<T>> fetch)
    {
        try
        {
            var value = await fetch(CancellationToken.None);
            lock (slot)
            {
                slot.Value = Task.FromResult(value);
                slot.FreshUntil = DateTimeOffset.UtcNow + freshFor;
            }
        }
        catch (Exception)
        {
            // Keep serving the last good copy; try again shortly.
            lock (slot) slot.FreshUntil = DateTimeOffset.UtcNow + RetryAfterFailure;
        }
        finally
        {
            lock (slot) slot.Refreshing = false;
        }
    }
}
