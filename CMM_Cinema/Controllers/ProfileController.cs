using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace CMM_Cinema.Controllers
{
    [Authorize]
    public class ProfileController(
        UserRepository users,
        AdminRepository admins,
        PasswordHasher hasher,
        IEmailSender email,
        IMemoryCache cache,
        TurnstileValidator turnstile,
        IOptions<AppOptions> app,
        ILogger<ProfileController> logger) : AuthFormController(turnstile, app)
    {
        [HttpGet]
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            Response.Headers.CacheControl = "no-store";
            if (AuthClaims.IsAdmin(User))
            {
                if (AuthClaims.AdminId(User) is not { } adminId || await admins.FindByIdAsync(adminId, cancellationToken) is not { } admin)
                {
                    await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                    return RedirectToAction("Index", "Admin");
                }

                return View(new ProfileViewModel(true, admin.Username, "Username", admin.Username, null, ["Username and password"], false, UserProfile.Default));
            }

            if (await CurrentUserAsync(cancellationToken) is not { } user)
                return await SignedOutAsync();

            var providers = await users.GetLoginProvidersAsync(user.Id, cancellationToken);
            var methods = new List<string>();
            if (user.HasPassword) methods.Add("Email and password");
            if (providers.Contains(AuthClaims.GoogleProvider)) methods.Add("Google");
            var profile = await users.GetProfileAsync(user.Id, cancellationToken);
            return View(new ProfileViewModel(false, user.Name, "Email", user.Email, user.EmailVerified, methods, user.HasPassword, profile));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Details(ProfileDetailsForm form, CancellationToken cancellationToken)
        {
            Response.Headers.CacheControl = "no-store";
            if (await CurrentUserAsync(cancellationToken) is not { } user)
                return await SignedOutAsync();
            if (!ModelState.IsValid)
                return Failed();

            var name = form.Name.Trim();
            var phone = string.IsNullOrWhiteSpace(form.Phone) ? null : form.Phone.Trim();
            await users.UpdateDetailsAsync(user.Id, name, phone, cancellationToken);
            if (name != user.Name)
                await SignInAsync(user with { Name = name });

            return Saved("Your details were saved.");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting(AuthRateLimits.Login)]
        public async Task<IActionResult> Password(ChangePasswordForm form, CancellationToken cancellationToken)
        {
            Response.Headers.CacheControl = "no-store";
            if (await CurrentUserAsync(cancellationToken) is not { } user)
                return await SignedOutAsync();
            if (!user.HasPassword)
                ModelState.AddModelError(string.Empty, "You sign in with Google. Use Forgot password on the sign-in page to add a password.");
            else if (ModelState.IsValid && !hasher.Verify(user.PasswordHash!, form.CurrentPassword))
                ModelState.AddModelError(string.Empty, "Your current password is incorrect.");
            if (!ModelState.IsValid)
                return Failed();

            await users.UpdatePasswordHashAsync(user.Id, hasher.Hash(form.NewPassword), signOutEverywhere: true, cancellationToken);
            AuthCookieEvents.ForgetStamp(cache, user.Id);
            if (await users.FindByIdAsync(user.Id, cancellationToken) is { } updated)
                await SignInAsync(updated);

            await email.SendAsync(user.Email, AuthEmails.PasswordChanged(user.Name, Link("/Forgotpassword")), cancellationToken);
            logger.LogInformation("Account {UserId} changed its password", user.Id);
            return Saved("Your password was updated. Other devices were signed out.");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Notifications(NotificationForm form, CancellationToken cancellationToken)
        {
            Response.Headers.CacheControl = "no-store";
            if (await CurrentUserAsync(cancellationToken) is not { } user)
                return await SignedOutAsync();

            await users.UpdateNotificationsAsync(user.Id, form, cancellationToken);
            return Saved("Preferences saved.");
        }

        private async Task<User?> CurrentUserAsync(CancellationToken cancellationToken) =>
            AuthClaims.UserId(User) is { } userId ? await users.FindByIdAsync(userId, cancellationToken) : null;

        private async Task<IActionResult> SignedOutAsync()
        {
            if (AuthClaims.IsAdmin(User))
            {
                ModelState.AddModelError(string.Empty, "Admin accounts can't be edited here.");
                return Failed();
            }
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return FormSuccess(Url.Action("Index", "LoginRegister"));
        }

        private Task SignInAsync(User user) => HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            AuthClaims.CreatePrincipal(user),
            new AuthenticationProperties { IsPersistent = true });

        private IActionResult Failed() => FormErrors(() =>
        {
            TempData["ProfileError"] = string.Join(" ", ModelState.Values.SelectMany(entry => entry.Errors).Select(error => error.ErrorMessage).Distinct());
            return RedirectToAction(nameof(Index));
        });

        private IActionResult Saved(string message)
        {
            if (WantsJson)
                return Json(new { message });
            TempData["ProfileNotice"] = message;
            return RedirectToAction(nameof(Index));
        }
    }
}
