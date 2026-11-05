using System.Security.Claims;
using CMM_Cinema.Models;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace CMM_Cinema.Services;

public static class AuthClaims
{
    public const string SecurityStamp = "cmm:stamp";
    public const string GoogleProvider = "Google";
    public const string GoogleEmailVerified = "cmm:google_email_verified";

    public static ClaimsPrincipal CreatePrincipal(User user) => new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(SecurityStamp, user.SecurityStamp)
        ],
        CookieAuthenticationDefaults.AuthenticationScheme));

    public static int? UserId(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
}
