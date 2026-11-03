using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;

public sealed class AuthCookieEvents(UserRepository users, IMemoryCache cache) : CookieAuthenticationEvents
{
    // Caching the stamp for a minute saves a D1 round trip on every page; "sign out everywhere" lands within that minute.
    private static readonly TimeSpan StampCacheLifetime = TimeSpan.FromMinutes(1);

    public static void ForgetStamp(IMemoryCache cache, int userId) => cache.Remove(CacheKey(userId));

    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        var principal = context.Principal;
        var cookieStamp = principal?.FindFirst(AuthClaims.SecurityStamp)?.Value;
        if (principal is null || AuthClaims.UserId(principal) is not { } userId || cookieStamp is null)
        {
            await RejectAsync(context);
            return;
        }

        var currentStamp = await cache.GetOrCreateAsync(CacheKey(userId), async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = StampCacheLifetime;
            return (await users.FindByIdAsync(userId, context.HttpContext.RequestAborted))?.SecurityStamp;
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
}
