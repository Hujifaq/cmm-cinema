using System.ComponentModel.DataAnnotations;

namespace CMM_Cinema.Models
{
    public record ProfileViewModel(
        bool IsAdmin,
        string Name,
        string IdentifierLabel,
        string Identifier,
        IReadOnlyList<string> Methods,
        bool HasPassword,
        UserProfile Profile);

    public sealed record UserProfile(string? Phone, bool Releases, bool Offers, bool Bookings, bool News)
    {
        public static readonly UserProfile Default = new(null, true, true, true, false);
    }

    public class ProfileDetailsForm
    {
        [Required(ErrorMessage = "Please enter your name.")]
        [StringLength(100, ErrorMessage = "Name must be 100 characters or fewer.")]
        public string Name { get; set; } = string.Empty;

        [StringLength(20, ErrorMessage = "Phone number must be 20 characters or fewer.")]
        [RegularExpression(@"^\+?[0-9 ()-]{7,20}$", ErrorMessage = "Please enter a valid phone number.")]
        public string? Phone { get; set; }
    }

    public class ChangePasswordForm
    {
        [Required(ErrorMessage = "Please enter your current password.")]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "Please enter a new password.")]
        [StringLength(128, MinimumLength = 8, ErrorMessage = "Password must be 8 to 128 characters.")]
        public string NewPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "Please confirm your new password.")]
        [Compare(nameof(NewPassword), ErrorMessage = "Your new passwords do not match.")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    public class NotificationForm
    {
        public bool Releases { get; set; }
        public bool Offers { get; set; }
        public bool Bookings { get; set; }
        public bool News { get; set; }
    }
}
