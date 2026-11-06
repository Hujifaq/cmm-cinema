namespace CMM_Cinema.Services;

public sealed class AppOptions
{
    public string BaseUrl { get; set; } = "";

    public string Hostname => Uri.TryCreate(BaseUrl, UriKind.Absolute, out var uri) ? uri.Host : "";
}
