using System.Security.Cryptography;
using System.Text;

namespace CMM_Cinema.Services;

// k-anonymity: only the first 5 hex characters of the SHA-1 leave the server; the match happens here.
public sealed class BreachedPasswordChecker(HttpClient http, ILogger<BreachedPasswordChecker> logger)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(3);

    public async Task<bool> IsBreachedAsync(string password, CancellationToken cancellationToken = default)
    {
        var hash = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(password)));
        var prefix = hash[..5];
        var suffix = hash[5..];

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(Timeout);

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.pwnedpasswords.com/range/{prefix}");
            request.Headers.Add("Add-Padding", "true");
            request.Headers.UserAgent.ParseAdd("CMM-Cinema");
            using var response = await http.SendAsync(request, timeout.Token);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadAsStringAsync(timeout.Token);

            foreach (var line in body.AsSpan().EnumerateLines())
            {
                var colon = line.IndexOf(':');
                if (colon == suffix.Length &&
                    line[..colon].Equals(suffix, StringComparison.OrdinalIgnoreCase) &&
                    int.TryParse(line[(colon + 1)..].Trim(), out var count))
                {
                    return count > 0;
                }
            }
            return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            // Fails open: a third-party outage shouldn't block sign-ups, and the length rules still apply.
            logger.LogWarning(ex, "Breached-password check skipped: Have I Been Pwned unavailable");
            return false;
        }
    }
}
