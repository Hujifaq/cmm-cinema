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

    public const string AdminRole = "Admin";

    public static ClaimsPrincipal CreateAdminPrincipal(Admin admin) => new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
            new Claim(ClaimTypes.Name, admin.Username),
            new Claim(ClaimTypes.Role, AdminRole),
            new Claim(SecurityStamp, admin.SecurityStamp)
        ],
        CookieAuthenticationDefaults.AuthenticationScheme));

    public static bool IsAdmin(ClaimsPrincipal principal) => principal.IsInRole(AdminRole);

    // Admin and user ids come from different tables, so an admin's id must never be read as a user id.
    public static int? UserId(ClaimsPrincipal principal) =>
        !IsAdmin(principal) && int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public static int? AdminId(ClaimsPrincipal principal) =>
        IsAdmin(principal) && int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
}
