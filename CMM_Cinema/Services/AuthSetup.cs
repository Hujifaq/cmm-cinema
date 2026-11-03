using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Resend;

namespace CMM_Cinema.Services;

public static class AuthSetup
{
    public const string ExternalScheme = "External";

    public static IServiceCollection AddCinemaAuth(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AppOptions>(configuration.GetSection("App"));
        services.Configure<ResendOptions>(configuration.GetSection("Resend"));
        services.Configure<TurnstileOptions>(configuration.GetSection("Turnstile"));

        services.AddSingleton<PasswordHasher>();
        services.AddScoped<UserRepository>();
        services.AddScoped<EmailTokenService>();
        services.AddScoped<AuthCookieEvents>();
        services.AddResend(options => options.ApiToken = configuration["Resend:ApiKey"] ?? "");
        services.AddScoped<IEmailSender, ResendEmailSender>();
        services.AddHttpClient<TurnstileValidator>();
        services.AddHttpClient<BreachedPasswordChecker>();
        services.AddAuthRateLimits();

        // Keys encrypt the auth cookie. Without a fixed folder in production, a restart or redeploy signs everyone out.
        var dataProtection = services.AddDataProtection().SetApplicationName("CMM_Cinema");
        if (configuration["DataProtection:KeysPath"] is { Length: > 0 } keysPath)
            dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keysPath));

        var auth = services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                // __Host- makes the browser refuse the cookie unless it is Secure, host-only and Path=/.
                options.Cookie.Name = "__Host-cmm-auth";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.ExpireTimeSpan = TimeSpan.FromHours(12);
                options.SlidingExpiration = true;
                options.LoginPath = "/LoginRegister";
                options.LogoutPath = "/LoginRegister/Logout";
                options.EventsType = typeof(AuthCookieEvents);
            })
            // Holds Google's answer for a few minutes, until the callback decides which local account it belongs to.
            .AddCookie(ExternalScheme, options =>
            {
                options.Cookie.Name = "__Host-cmm-external";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.ExpireTimeSpan = TimeSpan.FromMinutes(5);
            });

        var google = configuration.GetSection("Authentication:Google");
        if (!string.IsNullOrEmpty(google["ClientId"]) && !string.IsNullOrEmpty(google["ClientSecret"]))
        {
            auth.AddGoogle(options =>
            {
                options.ClientId = google["ClientId"]!;
                options.ClientSecret = google["ClientSecret"]!;
                options.SignInScheme = ExternalScheme;
                options.AccessDeniedPath = "/LoginRegister";
                options.Events.OnRemoteFailure = context =>
                {
                    context.Response.Redirect("/LoginRegister?externalError=1");
                    context.HandleResponse();
                    return Task.CompletedTask;
                };
            });
        }

        return services;
    }
}
