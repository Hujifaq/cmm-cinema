using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace CMM_Cinema.Models;

public sealed class CastForm
{
    [StringLength(100)] public string? Name { get; set; }
    [StringLength(100)] public string? Role { get; set; }
    [HttpsUrl, StringLength(500)] public string? PhotoUrl { get; set; }
}

public sealed class MovieForm
{
    public static readonly string[] PosterThemes =
        ["ink-orbit", "sky-arch", "sun-eclipse", "brick-stripes", "brick-orbit", "sun-arch", "ink-eclipse", "sky-stripes"];

    private static readonly string[] ReservedSlugs = ["new", "delete", "search"];

    [StringLength(120)] public string? Slug { get; set; }
    [Required, StringLength(120)] public string Title { get; set; } = "";
    [Required, StringLength(80)] public string Genre { get; set; } = "";
    [Range(1, 600)] public int DurationMinutes { get; set; } = 90;
    [Required, StringLength(10)] public string Rating { get; set; } = "";
    [Required, StringLength(20)] public string Language { get; set; } = "";
    [Required, StringLength(240)] public string Synopsis { get; set; } = "";
    [Required, StringLength(3000)] public string Overview { get; set; } = "";
    public MovieStatus Status { get; set; } = MovieStatus.NowShowing;
    public DateOnly? ReleaseDate { get; set; }
    [HttpsUrl, StringLength(500)] public string? PosterUrl { get; set; }
    public string PosterTheme { get; set; } = PosterThemes[0];
    [StringLength(120)] public string? PosterTitle { get; set; }
    [StringLength(500)] public string? TrailerUrl { get; set; }
    public List<CastForm> Cast { get; set; } = [];

    [BindNever, ValidateNever]
    public string FinalSlug => Slugify(string.IsNullOrWhiteSpace(Slug) ? Title : Slug);

    [BindNever, ValidateNever]
    public bool IsSlugReserved => ReservedSlugs.Contains(FinalSlug);

    public void Normalize()
    {
        Title = (Title ?? "").Trim();
        Genre = (Genre ?? "").Trim();
        Rating = (Rating ?? "").Trim();
        Language = (Language ?? "").Trim();
        Synopsis = (Synopsis ?? "").Trim();
        Overview = (Overview ?? "").Trim();
        PosterUrl = Blank(PosterUrl);
        PosterTitle = Blank(PosterTitle);
        TrailerUrl = Blank(TrailerUrl);
        if (PosterTheme is null || !PosterThemes.Contains(PosterTheme)) PosterTheme = PosterThemes[0];
        Cast = (Cast ?? []).Where(member => member is not null && !string.IsNullOrWhiteSpace(member.Name))
            .Select(member => new CastForm { Name = member.Name!.Trim(), Role = (member.Role ?? "").Trim(), PhotoUrl = Blank(member.PhotoUrl) })
            .ToList();
    }

    public static MovieForm From(Movie movie) => new()
    {
        Slug = movie.Slug,
        Title = movie.Title,
        Genre = movie.Genre,
        DurationMinutes = movie.DurationMinutes,
        Rating = movie.Rating,
        Language = movie.Language,
        Synopsis = movie.Synopsis,
        Overview = movie.Overview,
        Status = movie.Status,
        ReleaseDate = movie.ReleaseDate,
        PosterUrl = movie.PosterUrl,
        PosterTheme = movie.PosterTheme,
        PosterTitle = movie.PosterTitle,
        TrailerUrl = movie.TrailerUrl,
        Cast = movie.Cast.Select(member => new CastForm { Name = member.Name, Role = member.Role, PhotoUrl = member.PhotoUrl }).ToList()
    };

    public static string Slugify(string text)
    {
        var builder = new StringBuilder();
        var pendingDash = false;
        foreach (var character in (text ?? "").Trim().ToLowerInvariant().Normalize(NormalizationForm.FormC))
        {
            var category = char.GetUnicodeCategory(character);
            var keep = char.IsLetterOrDigit(character)
                || category is UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark;
            if (keep)
            {
                if (pendingDash && builder.Length > 0) builder.Append('-');
                builder.Append(character);
                pendingDash = false;
            }
            else pendingDash = true;
        }
        return builder.ToString();
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class HttpsUrlAttribute : ValidationAttribute
{
    public HttpsUrlAttribute() : base("Use a full https:// link.") { }

    public override bool IsValid(object? value) =>
        value is not string text || string.IsNullOrWhiteSpace(text)
        || (Uri.TryCreate(text.Trim(), UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps);
}

public enum MovieSaveStatus { Saved, SlugTaken, NotFound }

public sealed record MovieSaveResult(MovieSaveStatus Status, string? Slug = null);
