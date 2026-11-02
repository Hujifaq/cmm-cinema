using System.ComponentModel.DataAnnotations;

namespace CMM_Cinema.Models
{
    public class ForgotPasswordViewModel
    {
        [Required(ErrorMessage = "Please enter your email address.")]
        [EmailAddress(ErrorMessage = "Please enter a valid email address.")]
        [StringLength(254, ErrorMessage = "Email address must be 254 characters or fewer.")]
        public string Email { get; set; } = string.Empty;
    }
}
