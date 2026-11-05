using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace CMM_Cinema.Controllers
{
    public class ResetpasswordController(
        UserRepository users,
        PasswordHasher hasher,
        EmailTokenService tokens,
        IEmailSender email,
        IMemoryCache cache,
        TurnstileValidator turnstile,
        IOptions<AppOptions> app,
        ILogger<ResetpasswordController> logger) : AuthFormController(turnstile, app)
    {
        [HttpGet]
        public async Task<IActionResult> Index(string? token, CancellationToken cancellationToken)
        {
            Response.Headers.CacheControl = "no-store";
            var isValid = await tokens.PeekAsync(token, EmailTokenPurpose.Reset, cancellationToken) is not null;
            return View(new ResetPasswordViewModel { Token = isValid ? token! : string.Empty, IsValid = isValid });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting(AuthRateLimits.Login)]
        public async Task<IActionResult> Index(ResetPasswordViewModel model, CancellationToken cancellationToken)
        {
            Response.Headers.CacheControl = "no-store";
            if (!ModelState.IsValid)
                return FormErrors(() => View(Cleared(model)));

            // Validated before the token is used up, so a typo doesn't burn the link.
            if (await tokens.ConsumeAsync(model.Token, EmailTokenPurpose.Reset, cancellationToken) is not { } userId ||
                await users.FindByIdAsync(userId, cancellationToken) is not { } user)
            {
                ModelState.AddModelError(string.Empty, "This reset link has expired. Please request a new one.");
                return FormErrors(() => View(new ResetPasswordViewModel { IsValid = false }));
            }

            await users.UpdatePasswordHashAsync(user.Id, hasher.Hash(model.Password), signOutEverywhere: true, cancellationToken);
            await users.ResetFailedLoginsAsync(user.Id, cancellationToken);
            // Opening the emailed link proves they own the inbox.
            await users.MarkEmailVerifiedAsync(user.Id, cancellationToken);
            AuthCookieEvents.ForgetStamp(cache, user.Id);

            await email.SendAsync(user.Email, AuthEmails.PasswordChanged(user.Name, Link("/Forgotpassword")), cancellationToken);
            logger.LogInformation("Account {UserId} reset its password", user.Id);

            TempData["AuthNotice"] = "Your password was changed and you were signed out everywhere. Sign in with your new password.";
            return FormSuccess(Url.Action("Index", "LoginRegister"));
        }

        private static ResetPasswordViewModel Cleared(ResetPasswordViewModel model)
        {
            model.Password = model.ConfirmPassword = string.Empty;
            return model;
        }
    }
}
