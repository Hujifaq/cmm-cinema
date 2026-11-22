using System.ComponentModel.DataAnnotations;

namespace CMM_Cinema.Models;

public enum NewsSaveStatus { Saved, SlugTaken, NotFound, Unavailable }

public sealed record NewsSaveResult(NewsSaveStatus Status, string? Slug = null);

public enum NewsState { Published, Scheduled, Draft }

public sealed record NewsAdminRow(int Id, string Slug, string Title, string Category, string LandscapeUrl, string? MovieTitle, DateTimeOffset PublishedAt, bool IsPublished)
{
    public NewsState StateAt(DateTimeOffset now) => !IsPublished ? NewsState.Draft : PublishedAt > now ? NewsState.Scheduled : NewsState.Published;
    public string Date => PublishedAt.ToOffset(CinemaTime.Offset).ToString("MMM dd, yyyy", System.Globalization.CultureInfo.InvariantCulture);
    public string Url => $"/News/{Uri.EscapeDataString(Slug)}";
}

public sealed record MovieChoice(int Id, string Title);

public sealed record NewsFormViewModel(NewsForm Form, bool IsNew, IReadOnlyList<MovieChoice> Movies);

public sealed class NewsForm
{
    public static readonly string[] Categories = ["Now showing", "Coming soon", "Feature", "Events", "Promotion", "Guide"];

    [StringLength(120)] public string? Slug { get; set; }
    [Required, StringLength(160)] public string Title { get; set; } = "";
    [Required, StringLength(40)] public string Category { get; set; } = "";
    [Required, StringLength(300)] public string Excerpt { get; set; } = "";
    [StringLength(10000)] public string? Body { get; set; }
    public int? MovieId { get; set; }
    [Required(ErrorMessage = "Add a landscape cover image link."), HttpsUrl, StringLength(500)] public string? LandscapeUrl { get; set; }
    public DateOnly? PublishedOn { get; set; }
    public bool IsPublished { get; set; } = true;

    public string FinalSlug => MovieForm.Slugify(string.IsNullOrWhiteSpace(Slug) ? Title : Slug);

    public void Normalize()
    {
        Title = (Title ?? "").Trim();
        Category = (Category ?? "").Trim();
        Excerpt = (Excerpt ?? "").Trim();
        Body = string.IsNullOrWhiteSpace(Body) ? null : Body.Trim();
        LandscapeUrl = string.IsNullOrWhiteSpace(LandscapeUrl) ? null : LandscapeUrl.Trim();
        PublishedOn ??= CinemaTime.Today;
    }
}
