using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using CMM_Cinema.Models;

namespace CMM_Cinema.Services;


public sealed class UserRepository(D1Client d1)
{
    private const string Columns = "id, email, name, password_hash, email_verified, failed_logins, lockout_until, security_stamp";

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public async Task<User?> FindByIdAsync(int id, CancellationToken cancellationToken = default) =>
        Single(await d1.QueryAsync($"SELECT {Columns} FROM users WHERE id = ?", [id], cancellationToken));

    public async Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        Single(await d1.QueryAsync($"SELECT {Columns} FROM users WHERE email = ?", [NormalizeEmail(email)], cancellationToken));

    public async Task<User?> FindByLoginAsync(string provider, string providerKey, CancellationToken cancellationToken = default) =>
        Single(await d1.QueryAsync(
            $"SELECT {Columns} FROM users WHERE id = (SELECT user_id FROM user_logins WHERE provider = ? AND provider_key = ?)",
            [provider, providerKey], cancellationToken));

    // Returns null when the email is already taken, instead of throwing on the UNIQUE constraint.
    public async Task<User?> CreateAsync(string email, string name, string? passwordHash, bool emailVerified, CancellationToken cancellationToken = default)
    {
        var now = Now();
        return Single(await d1.QueryAsync(
            "INSERT INTO users (email, name, password_hash, email_verified, email_verified_at, security_stamp, created_at, updated_at) " +
            $"VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING RETURNING {Columns}",
            [NormalizeEmail(email), name.Trim(), passwordHash, emailVerified ? 1 : 0, emailVerified ? now : null, NewSecurityStamp(), now, now],
            cancellationToken));
    }

    // Returns false when that provider account is already linked to someone.
    public async Task<bool> AddLoginAsync(int userId, string provider, string providerKey, CancellationToken cancellationToken = default) =>
        (await d1.QueryAsync(
            "INSERT INTO user_logins (provider, provider_key, user_id, created_at) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT (provider, provider_key) DO NOTHING RETURNING user_id",
            [provider, providerKey, userId, Now()], cancellationToken)).Count == 1;

    // One atomic UPDATE, so two parallel wrong guesses can't both read the old count.
    public async Task RecordFailedLoginAsync(int id, int maxAttempts, TimeSpan lockoutDuration, CancellationToken cancellationToken = default) =>
        await d1.QueryAsync(
            "UPDATE users SET " +
            "lockout_until = CASE WHEN failed_logins + 1 >= ? THEN ? ELSE lockout_until END, " +
            "failed_logins = CASE WHEN failed_logins + 1 >= ? THEN 0 ELSE failed_logins + 1 END, " +
            "updated_at = ? WHERE id = ?",
            [maxAttempts, Format(DateTimeOffset.UtcNow + lockoutDuration), maxAttempts, Now(), id], cancellationToken);

    public async Task ResetFailedLoginsAsync(int id, CancellationToken cancellationToken = default) =>
        await d1.QueryAsync(
            "UPDATE users SET failed_logins = 0, lockout_until = NULL, updated_at = ? WHERE id = ? AND (failed_logins > 0 OR lockout_until IS NOT NULL)",
            [Now(), id], cancellationToken);

    public async Task MarkEmailVerifiedAsync(int id, CancellationToken cancellationToken = default) =>
        await d1.QueryAsync(
            "UPDATE users SET email_verified = 1, email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?",
            [Now(), Now(), id], cancellationToken);

    // A new security stamp signs out every existing session, so pass true after a password reset.
    public async Task UpdatePasswordHashAsync(int id, string passwordHash, bool signOutEverywhere, CancellationToken cancellationToken = default) =>
        await d1.QueryAsync(
            "UPDATE users SET password_hash = ?, security_stamp = CASE WHEN ? = 1 THEN ? ELSE security_stamp END, updated_at = ? WHERE id = ?",
            [passwordHash, signOutEverywhere ? 1 : 0, NewSecurityStamp(), Now(), id], cancellationToken);

    public async Task RotateSecurityStampAsync(int id, CancellationToken cancellationToken = default) =>
        await d1.QueryAsync("UPDATE users SET security_stamp = ?, updated_at = ? WHERE id = ?", [NewSecurityStamp(), Now(), id], cancellationToken);

    private static User? Single(IReadOnlyList<JsonElement> rows) => rows.Count == 0 ? null : Map(rows[0]);

    private static User Map(JsonElement row) => new(
        row.GetProperty("id").GetInt32(),
        Text(row, "email") ?? "",
        Text(row, "name") ?? "",
        Text(row, "password_hash"),
        row.GetProperty("email_verified").GetInt32() == 1,
        row.GetProperty("failed_logins").GetInt32(),
        DateTimeOffset.TryParse(Text(row, "lockout_until"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var lockout) ? lockout : null,
        Text(row, "security_stamp") ?? "");

    private static string NewSecurityStamp() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

    private static string Now() => D1Time.Now();

    private static string Format(DateTimeOffset value) => D1Time.Format(value);

    private static string? Text(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
