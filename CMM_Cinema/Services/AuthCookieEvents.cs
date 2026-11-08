using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;

public sealed class AuthCookieEvents(UserRepository users, AdminRepository admins, IMemoryCache cache) : CookieAuthenticationEvents
{

    private static readonly TimeSpan StampCacheLifetime = TimeSpan.FromMinutes(1);

    public static void ForgetStamp(IMemoryCache cache, int userId) => cache.Remove(CacheKey(userId));

    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        var principal = context.Principal;
        var cookieStamp = principal?.FindFirst(AuthClaims.SecurityStamp)?.Value;
        var isAdmin = principal is not null && AuthClaims.IsAdmin(principal);
        if (principal is null || (isAdmin ? AuthClaims.AdminId(principal) : AuthClaims.UserId(principal)) is not { } userId || cookieStamp is null)
        {
            await RejectAsync(context);
            return;
        }

        var currentStamp = await cache.GetOrCreateAsync(isAdmin ? AdminCacheKey(userId) : CacheKey(userId), async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = StampCacheLifetime;
            var cancellationToken = context.HttpContext.RequestAborted;
            return isAdmin
                ? (await admins.FindByIdAsync(userId, cancellationToken))?.SecurityStamp
                : (await users.FindByIdAsync(userId, cancellationToken))?.SecurityStamp;
        });

        if (!string.Equals(currentStamp, cookieStamp, StringComparison.Ordinal))
            await RejectAsync(context);
    }

    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }

    private static async Task RejectAsync(CookieValidatePrincipalContext context)
    {
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }

    private static string CacheKey(int userId) => $"auth-stamp:{userId}";

    private static string AdminCacheKey(int adminId) => $"auth-stamp:admin:{adminId}";
}
