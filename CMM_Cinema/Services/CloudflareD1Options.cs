namespace CMM_Cinema.Services;

// Bound from the "Cloudflare" configuration section; keep all three values in user-secrets, never in git.
public sealed class CloudflareD1Options
{
    public string AccountId { get; set; } = "";
    public string DatabaseId { get; set; } = "";
    public string ApiToken { get; set; } = "";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(AccountId) && !string.IsNullOrWhiteSpace(DatabaseId) && !string.IsNullOrWhiteSpace(ApiToken);
}
