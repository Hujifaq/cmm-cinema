using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace CMM_Cinema.Services;

public sealed class TurnstileOptions
{
    public string SiteKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
}

public sealed class TurnstileValidator(
    HttpClient http,
    IOptions<TurnstileOptions> turnstile,
    IOptions<AppOptions> app,
    ILogger<TurnstileValidator> logger)
{
    public const string FormField = "cf-turnstile-response";
    private const int MaxTokenLength = 2048;

    public async Task<bool> ValidateAsync(string? token, string? remoteIp, string expectedAction, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > MaxTokenLength) return false;

        var form = new Dictionary<string, string> { ["secret"] = turnstile.Value.SecretKey, ["response"] = token };
        if (!string.IsNullOrEmpty(remoteIp)) form["remoteip"] = remoteIp;

        SiteVerifyResponse? result;
        try
        {
            using var response = await http.PostAsync("https://challenges.cloudflare.com/turnstile/v0/siteverify", new FormUrlEncodedContent(form), cancellationToken);
            result = await response.Content.ReadFromJsonAsync<SiteVerifyResponse>(cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning(ex, "Turnstile check could not reach Cloudflare");
            return false;
        }

        if (result is not { Success: true })
        {
            logger.LogInformation("Turnstile rejected a {Action} submission: {Errors}", expectedAction, string.Join(",", result?.ErrorCodes ?? []));
            return false;
        }

        if (result.Metadata?.ResultWithTestingKey == true) return true;

        if (!string.Equals(result.Hostname, app.Value.Hostname, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(result.Action, expectedAction, StringComparison.Ordinal))
        {
            logger.LogWarning("Turnstile token for {Hostname}/{Action} used on {Expected}", result.Hostname, result.Action, expectedAction);
            return false;
        }

        return true;
    }

    private sealed record SiteVerifyResponse(
        [property: JsonPropertyName("success")] bool Success,
        [property: JsonPropertyName("hostname")] string? Hostname,
        [property: JsonPropertyName("action")] string? Action,
        [property: JsonPropertyName("error-codes")] string[]? ErrorCodes,
        [property: JsonPropertyName("metadata")] SiteVerifyMetadata? Metadata);

    private sealed record SiteVerifyMetadata(
        [property: JsonPropertyName("result_with_testing_key")] bool ResultWithTestingKey);
}
