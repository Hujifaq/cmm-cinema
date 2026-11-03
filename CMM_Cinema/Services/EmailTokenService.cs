using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace CMM_Cinema.Services;

public enum EmailTokenPurpose
{
    Verify,
    Reset
}

// The raw token only ever exists in the emailed link; D1 stores its SHA-256 hash.
public sealed class EmailTokenService(D1Client d1)
{
    public async Task<string> CreateAsync(int userId, EmailTokenPurpose purpose, TimeSpan lifetime, CancellationToken cancellationToken = default)
    {
        var token = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        var now = DateTimeOffset.UtcNow;

        // Requesting a new link retires the older ones, so only the latest email works.
        await d1.QueryAsync(
            "UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
            [D1Time.Format(now), userId, Name(purpose)], cancellationToken);
        await d1.QueryAsync(
            "INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
            [userId, Name(purpose), Hash(token), D1Time.Format(now + lifetime), D1Time.Format(now)], cancellationToken);

        return token;
    }

    // Checks without using it up, so the reset page can say "link expired" before the user types a new password.
    public async Task<int?> PeekAsync(string? token, EmailTokenPurpose purpose, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var rows = await d1.QueryAsync(
            "SELECT user_id FROM email_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?",
            [Hash(token), Name(purpose), D1Time.Now()], cancellationToken);
        return rows.Count == 1 ? rows[0].GetProperty("user_id").GetInt32() : null;
    }

    // One atomic UPDATE: if the same link is clicked twice at once, only one click gets the user id.
    public async Task<int?> ConsumeAsync(string? token, EmailTokenPurpose purpose, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var now = D1Time.Now();
        var rows = await d1.QueryAsync(
            "UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id",
            [now, Hash(token), Name(purpose), now], cancellationToken);
        return rows.Count == 1 ? rows[0].GetProperty("user_id").GetInt32() : null;
    }

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Name(EmailTokenPurpose purpose) => purpose == EmailTokenPurpose.Verify ? "verify" : "reset";
}
