using System.ComponentModel.DataAnnotations;

namespace CMM_Cinema.Models;

public sealed class AdminLoginViewModel
{
    [Required, StringLength(254)]
    public string Username { get; set; } = string.Empty;

    [Required, StringLength(128)]
    public string Password { get; set; } = string.Empty;
}
