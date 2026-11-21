using Microsoft.Net.Http.Headers;

namespace CMM_Cinema.Services;

public static class VersionedAssetCaching
{
    private const string Immutable = "public, max-age=31536000, immutable";

    public static IApplicationBuilder UseVersionedAssetCaching(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            var version = context.Request.Query["v"].ToString();
            if (version.Length > 0 && (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)))
            {
                context.Response.OnStarting(() =>
                {
                    var response = context.Response;
                    if (response.StatusCode is StatusCodes.Status200OK or StatusCodes.Status304NotModified
                        && MatchesETag(version, response.Headers.ETag.ToString()))
                    {
                        response.Headers.CacheControl = Immutable;
                    }
                    return Task.CompletedTask;
                });
            }
            return next(context);
        });

    private static bool MatchesETag(string version, string etag)
    {
        if (!EntityTagHeaderValue.TryParse(etag, out var parsed) || parsed.IsWeak) return false;
        var hash = parsed.Tag.ToString().Trim('"').TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return hash.Length > 0 && string.Equals(hash, version, StringComparison.Ordinal);
    }
}
