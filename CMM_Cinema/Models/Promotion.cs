using System.ComponentModel.DataAnnotations;

namespace CMM_Cinema.Models;

public enum PromotionSaveStatus { Saved, NotFound, TooMany, Unavailable }

public sealed record PromotionSaveResult(PromotionSaveStatus Status);

public sealed record Promotion(int Id, string ImageUrl, string Alt, DateTimeOffset UpdatedAt)
{
    public bool IsLocal => ImageUrl.StartsWith('/');
    public string ProxyUrl => $"/Promotions/{Id}/image?v={UpdatedAt.UtcTicks}";
}

public sealed record PromotionAdminRow(int Id, string ImageUrl, string Alt, bool IsActive);

public sealed record PromotionFormViewModel(PromotionForm Form, bool IsNew);

public sealed class PromotionForm
{
    public const string LocalPrefix = "/images/promos/";

    [Required(ErrorMessage = "Add a banner image link."), StringLength(500)] public string? ImageUrl { get; set; }
    [Required(ErrorMessage = "Describe the banner for screen readers."), StringLength(300)] public string Alt { get; set; } = "";
    public bool IsActive { get; set; } = true;

    public bool IsLocal => ImageUrl?.StartsWith(LocalPrefix, StringComparison.Ordinal) == true;

    public void Normalize()
    {
        ImageUrl = string.IsNullOrWhiteSpace(ImageUrl) ? null : ImageUrl.Trim();
        Alt = (Alt ?? "").Trim();
    }
}
