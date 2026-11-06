using System.Globalization;

namespace CMM_Cinema.Services;

// Fixed-width UTC, so timestamps sort and compare correctly as text in SQL.
public static class D1Time
{
    public static string Now() => Format(DateTimeOffset.UtcNow);

    public static string Format(DateTimeOffset value) =>
        value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
}
