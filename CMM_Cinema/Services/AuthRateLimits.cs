using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace CMM_Cinema.Services;

public static class AuthRateLimits
{
    public const string Login = "auth-login";
    public const string EmailSending = "auth-email";

    public static IServiceCollection AddAuthRateLimits(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(Login, context => PerIp(context, permits: 10, TimeSpan.FromMinutes(1)));
            options.AddPolicy(EmailSending, context => PerIp(context, permits: 5, TimeSpan.FromMinutes(15)));
            options.OnRejected = async (context, cancellationToken) =>
            {
                var response = context.HttpContext.Response;
                response.ContentType = "text/plain; charset=utf-8";
                await response.WriteAsync("Too many attempts. Please wait a few minutes and try again.", cancellationToken);
            };
        });

    // Sliding windows stop the burst a fixed window allows at its boundary (10 at 0:59 and 10 more at 1:00).
    private static RateLimitPartition<string> PerIp(HttpContext context, int permits, TimeSpan window) =>
        RateLimitPartition.GetSlidingWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = permits,
                Window = window,
                SegmentsPerWindow = 6,
                QueueLimit = 0
            });
}
