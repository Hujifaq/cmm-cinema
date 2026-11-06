using System.ComponentModel.DataAnnotations;

namespace CMM_Cinema.Models
{
    public class ResetPasswordViewModel
    {
        public string Token { get; set; } = string.Empty;

        public bool IsValid { get; set; } = true;

        [Required(ErrorMessage = "Please enter a new password.")]
        [StringLength(128, MinimumLength = 8, ErrorMessage = "Password must be 8 to 128 characters.")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Please confirm your new password.")]
        [Compare(nameof(Password), ErrorMessage = "Your passwords do not match.")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }
}
