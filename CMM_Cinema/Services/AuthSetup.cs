using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Resend;

namespace CMM_Cinema.Services;

public static class AuthSetup
{
    public const string ExternalScheme = "External";
    public const string CustomerPolicy = "Customer";

    public static IServiceCollection AddCinemaAuth(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AppOptions>(configuration.GetSection("App"));
        services.Configure<ResendOptions>(configuration.GetSection("Resend"));
        services.Configure<TurnstileOptions>(configuration.GetSection("Turnstile"));

        services.AddSingleton<PasswordHasher>();
        services.AddScoped<UserRepository>();
        services.AddScoped<AdminRepository>();
        services.AddScoped<EmailTokenService>();
        services.AddSingleton<EmailThrottle>();
        services.AddScoped<AuthCookieEvents>();
        services.AddResend(options => options.ApiToken = configuration["Resend:ApiKey"] ?? "");
        services.AddScoped<IEmailSender, ResendEmailSender>();
        services.AddHttpClient<TurnstileValidator>();
        services.AddAuthRateLimits();

       
        var dataProtection = services.AddDataProtection().SetApplicationName("CMM_Cinema");
        if (configuration["DataProtection:KeysPath"] is { Length: > 0 } keysPath)
            dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keysPath));

        services.AddAuthorizationBuilder().AddPolicy(CustomerPolicy, policy => policy
            .RequireAuthenticatedUser()
            .RequireAssertion(context => !AuthClaims.IsAdmin(context.User)));

        var auth = services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
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
                options.ClaimActions.MapJsonKey(AuthClaims.GoogleEmailVerified, "email_verified");
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
