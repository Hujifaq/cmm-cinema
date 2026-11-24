using System.Security.Claims;
using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace CMM_Cinema.Controllers
{
    public class LoginRegisterController(
        UserRepository users,
        PasswordHasher hasher,
        TurnstileValidator turnstile,
        IAuthenticationSchemeProvider schemes,
        IOptions<AppOptions> app,
        ILogger<LoginRegisterController> logger) : AuthFormController(turnstile, app)
    {
        private const int MaxFailedLogins = 5;
        private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

        [HttpGet]
        public IActionResult Index(string? returnUrl, bool externalError = false)
        {
            if (User.Identity?.IsAuthenticated == true)
                return LocalRedirect(SafeReturnUrl(returnUrl));
            var error = TempData["AuthError"] as string ?? (externalError ? "Google sign-in didn't finish. Please try again." : null);
            return View(new AuthPageViewModel
            {
                Notice = error ?? TempData["AuthNotice"] as string,
                NoticeIsError = error is not null,
                ReturnUrl = returnUrl
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting(AuthRateLimits.Login)]
        public async Task<IActionResult> GoogleLogin(string? returnUrl)
        {
            if (await schemes.GetSchemeAsync(GoogleDefaults.AuthenticationScheme) is null)
                return ExternalFailure("Google sign-in isn't set up yet.", returnUrl);
            var properties = new AuthenticationProperties { RedirectUri = Url.Action(nameof(GoogleCallback), new { returnUrl = SafeReturnUrl(returnUrl) }) };
            return Challenge(properties, GoogleDefaults.AuthenticationScheme);
        }

        [HttpGet]
        public async Task<IActionResult> GoogleCallback(string? returnUrl, CancellationToken cancellationToken)
        {
            var result = await HttpContext.AuthenticateAsync(AuthSetup.ExternalScheme);
            await HttpContext.SignOutAsync(AuthSetup.ExternalScheme);
            var google = result.Principal;
            if (!result.Succeeded || google?.FindFirstValue(ClaimTypes.NameIdentifier) is not { Length: > 0 } googleId)
                return ExternalFailure("Google sign-in didn't finish. Please try again.", returnUrl);

            // Matched by Google's permanent id, never by email: addresses can change hands.
            var user = await users.FindByLoginAsync(AuthClaims.GoogleProvider, googleId, cancellationToken);
            if (user is null)
            {
                var googleEmail = google.FindFirstValue(ClaimTypes.Email);
                var emailVerified = string.Equals(google.FindFirstValue(AuthClaims.GoogleEmailVerified), "true", StringComparison.OrdinalIgnoreCase);
                if (string.IsNullOrEmpty(googleEmail) || !emailVerified)
                    return ExternalFailure("Your Google account's email isn't verified, so it can't be used to sign in.", returnUrl);

                var name = google.FindFirstValue(ClaimTypes.Name) is { Length: > 0 } googleName ? googleName : googleEmail;
                user = await users.CreateAsync(googleEmail, name[..Math.Min(name.Length, 100)], passwordHash: null, emailVerified: true, cancellationToken);

                // Never auto-link to an existing account: someone may have registered this email first with their own password.
                if (user is null || !await users.AddLoginAsync(user.Id, AuthClaims.GoogleProvider, googleId, cancellationToken))
                {
                    logger.LogInformation("Google sign-in refused: email already belongs to an account");
                    return ExternalFailure("An account with this email already exists. Sign in with your email and password instead.", returnUrl);
                }
                logger.LogInformation("Account {UserId} created with Google", user.Id);
            }

            await SignInAsync(user);
            return LocalRedirect(SafeReturnUrl(returnUrl));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting(AuthRateLimits.Login)]
        public async Task<IActionResult> Login(LoginViewModel model, string? returnUrl, CancellationToken cancellationToken)
        {
            if (!ModelState.IsValid || !await PassesTurnstileAsync("login", cancellationToken))
                return LoginForm(model, returnUrl);

            var user = await users.FindByEmailAsync(model.Email, cancellationToken);

            // A locked account answers exactly like a wrong password, so lockouts can't be used to discover accounts.
            if (user?.PasswordHash is not { } passwordHash || user.IsLockedOut(DateTimeOffset.UtcNow))
            {
                hasher.VerifyDummy(model.Password);
                return InvalidLogin(model, returnUrl);
            }

            if (!hasher.Verify(passwordHash, model.Password))
            {
                await users.RecordFailedLoginAsync(user.Id, MaxFailedLogins, LockoutDuration, cancellationToken);
                logger.LogInformation("Failed login for account {UserId}", user.Id);
                return InvalidLogin(model, returnUrl);
            }

            await users.ResetFailedLoginsAsync(user.Id, cancellationToken);

            if (hasher.NeedsRehash(passwordHash))
                await users.UpdatePasswordHashAsync(user.Id, hasher.Hash(model.Password), signOutEverywhere: false, cancellationToken);

            await SignInAsync(user);

            var destination = SafeReturnUrl(returnUrl);
            return WantsJson ? Json(new { redirect = destination }) : LocalRedirect(destination);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            TempData["AuthNotice"] = "You've signed out.";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting(AuthRateLimits.EmailSending)]
        public async Task<IActionResult> Register(RegisterViewModel model, CancellationToken cancellationToken)
        {
            if (!ModelState.IsValid)
                return RegisterForm(model);

            if (!await PassesTurnstileAsync("register", cancellationToken))
                return RegisterForm(model);

            // No email confirmation step: a new account is signed in straight away.
            var passwordHash = hasher.Hash(model.Password);
            var user = await users.CreateAsync(model.Email, model.Name, passwordHash, emailVerified: true, cancellationToken);
            if (user is null)
            {
                logger.LogInformation("Sign-up attempted for an existing account");
                ModelState.AddModelError(nameof(RegisterViewModel.Email), "An account with this email already exists. Sign in instead.");
                return RegisterForm(model);
            }

            logger.LogInformation("Account {UserId} registered", user.Id);
            await SignInAsync(user);
            return WantsJson ? Json(new { redirect = "/" }) : LocalRedirect("/");
        }

        private async Task SignInAsync(Models.User user)
        {
            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                AuthClaims.CreatePrincipal(user),
                new AuthenticationProperties { IsPersistent = true });
            logger.LogInformation("Account {UserId} signed in", user.Id);
        }

        private IActionResult ExternalFailure(string message, string? returnUrl)
        {
            TempData["AuthError"] = message;
            return RedirectToAction(nameof(Index), new { returnUrl });
        }

        private IActionResult InvalidLogin(LoginViewModel model, string? returnUrl)
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
            return LoginForm(model, returnUrl);
        }

        private IActionResult LoginForm(LoginViewModel model, string? returnUrl) => FormErrors(() =>
        {
            model.Password = string.Empty;
            return View(nameof(Index), new AuthPageViewModel { Mode = "login", Login = model, ReturnUrl = returnUrl });
        });

        // Only same-site paths, so a crafted ?returnUrl=https://evil.example can't bounce users off-site after login.
        private string SafeReturnUrl(string? returnUrl) => Url.IsLocalUrl(returnUrl) ? returnUrl : "/";

        private IActionResult RegisterForm(RegisterViewModel model) => FormErrors(() =>
        {
            model.Password = model.ConfirmPassword = string.Empty;
            return View(nameof(Index), new AuthPageViewModel { Mode = "register", Register = model });
        });
    }
}
