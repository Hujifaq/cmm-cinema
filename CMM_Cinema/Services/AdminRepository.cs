using System.Globalization;
using System.Text.Json;
using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

public sealed class AdminRepository(D1Client d1)
{
    private const string Columns = "id, username, password_hash, failed_logins, lockout_until, security_stamp";

    public async Task<Admin?> FindByIdAsync(int id, CancellationToken cancellationToken = default) =>
        Single(await d1.QueryAsync($"SELECT {Columns} FROM admins WHERE id = ?", [id], cancellationToken));

    public async Task<Admin?> FindByUsernameAsync(string username, CancellationToken cancellationToken = default) =>
        Single(await d1.QueryAsync($"SELECT {Columns} FROM admins WHERE username = ?", [username.Trim()], cancellationToken));

    public async Task RecordFailedLoginAsync(int id, int maxAttempts, TimeSpan lockoutDuration, CancellationToken cancellationToken = default) =>
        await d1.QueryAsync(
            "UPDATE admins SET " +
            "lockout_until = CASE WHEN failed_logins + 1 >= ? THEN ? ELSE lockout_until END, " +
            "failed_logins = CASE WHEN failed_logins + 1 >= ? THEN 0 ELSE failed_logins + 1 END, " +
            "updated_at = ? WHERE id = ?",
            [maxAttempts, D1Time.Format(DateTimeOffset.UtcNow + lockoutDuration), maxAttempts, D1Time.Now(), id], cancellationToken);

    public async Task ResetFailedLoginsAsync(int id, CancellationToken cancellationToken = default) =>
        await d1.QueryAsync(
            "UPDATE admins SET failed_logins = 0, lockout_until = NULL, updated_at = ? WHERE id = ? AND (failed_logins > 0 OR lockout_until IS NOT NULL)",
            [D1Time.Now(), id], cancellationToken);

    private static Admin? Single(IReadOnlyList<JsonElement> rows) => rows.Count == 0 ? null : Map(rows[0]);

    private static Admin Map(JsonElement row) => new(
        row.GetProperty("id").GetInt32(),
        Text(row, "username") ?? "",
        Text(row, "password_hash") ?? "",
        row.GetProperty("failed_logins").GetInt32(),
        DateTimeOffset.TryParse(Text(row, "lockout_until"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var lockout) ? lockout : null,
        Text(row, "security_stamp") ?? "");

    private static string? Text(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
