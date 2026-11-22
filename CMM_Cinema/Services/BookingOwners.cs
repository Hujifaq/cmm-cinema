using System.Security.Claims;
using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;

public sealed class BookingOwners(AdminRepository admins, UserRepository users, IMemoryCache cache)
{
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromHours(1);

    // .invalid is a reserved domain, so this account can never receive mail or sign in.
    public static string AdminAccountEmail(int adminId) => $"admin-{adminId}@cmm-cinema.invalid";

    public async Task<int?> ResolveAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default)
    {
        if (AuthClaims.UserId(principal) is { } userId) return userId;
        if (AuthClaims.AdminId(principal) is not { } adminId) return null;

        var key = $"admin-booking-user:{adminId}";
        if (cache.TryGetValue(key, out int cached)) return cached;

        var linked = await admins.GetBookingUserIdAsync(adminId, cancellationToken)
            ?? await CreateAccountAsync(adminId, cancellationToken);
        if (linked is { } id) cache.Set(key, id, CacheLifetime);
        return linked;
    }

    private async Task<int?> CreateAccountAsync(int adminId, CancellationToken cancellationToken)
    {
        if (await admins.FindByIdAsync(adminId, cancellationToken) is not { } admin) return null;

        var email = AdminAccountEmail(adminId);
        var user = await users.CreateAsync(email, $"{admin.Username} (admin)", passwordHash: null, emailVerified: true, cancellationToken)
            ?? await users.FindByEmailAsync(email, cancellationToken);
        if (user is null) return null;

        await admins.SetBookingUserIdAsync(adminId, user.Id, cancellationToken);
        return user.Id;
    }
}
