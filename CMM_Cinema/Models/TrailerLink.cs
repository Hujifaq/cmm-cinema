using System.Text.RegularExpressions;
using System.Web;

namespace CMM_Cinema.Models;


public static partial class TrailerLink
{
    public static string? ToEmbedUrl(string? link)
    {
        if (!Uri.TryCreate(link?.Trim(), UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http")) return null;
        var host = uri.Host.ToLowerInvariant();
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);

        string? youtubeId = host switch
        {
            "youtu.be" => segments.FirstOrDefault(),
            "youtube.com" or "www.youtube.com" or "m.youtube.com" => segments switch
            {
                ["watch"] => HttpUtility.ParseQueryString(uri.Query)["v"],
                ["embed" or "shorts" or "live" or "v", var id, ..] => id,
                _ => null,
            },
            _ => null,
        };
        if (youtubeId is not null && YouTubeId().IsMatch(youtubeId))
            return $"https://www.youtube-nocookie.com/embed/{youtubeId}";

        if (host is "vimeo.com" or "www.vimeo.com" or "player.vimeo.com")
        {
            var vimeoId = segments.FirstOrDefault(segment => VimeoId().IsMatch(segment));
            if (vimeoId is not null) return $"https://player.vimeo.com/video/{vimeoId}";
        }

        return null;
    }

    [GeneratedRegex("^[A-Za-z0-9_-]{11}$")]
    private static partial Regex YouTubeId();

    [GeneratedRegex("^[0-9]+$")]
    private static partial Regex VimeoId();
}
