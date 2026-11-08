using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CMM_Cinema.Controllers
{
    public class AdminController(AdminRepository admins, PasswordHasher hasher, ILogger<AdminController> logger) : Controller
    {
        private const int MaxFailedLogins = 5;
        private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

        [HttpGet]
        public IActionResult Index() =>
            User.Identity?.IsAuthenticated == true ? Redirect("/") : View(new AdminLoginViewModel());

        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting(AuthRateLimits.Login)]
        public async Task<IActionResult> Index(AdminLoginViewModel model, CancellationToken cancellationToken)
        {
            if (!ModelState.IsValid)
                return Invalid(model);

            var admin = await admins.FindByUsernameAsync(model.Username, cancellationToken);

            // A locked account answers exactly like a wrong password, so lockouts can't be used to discover usernames.
            if (admin is null || admin.IsLockedOut(DateTimeOffset.UtcNow))
            {
                hasher.VerifyDummy(model.Password);
                return Invalid(model);
            }

            if (!hasher.Verify(admin.PasswordHash, model.Password))
            {
                await admins.RecordFailedLoginAsync(admin.Id, MaxFailedLogins, LockoutDuration, cancellationToken);
                logger.LogInformation("Failed login for admin {AdminId}", admin.Id);
                return Invalid(model);
            }

            await admins.ResetFailedLoginsAsync(admin.Id, cancellationToken);
            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                AuthClaims.CreateAdminPrincipal(admin),
                new AuthenticationProperties { IsPersistent = true });
            logger.LogInformation("Admin {AdminId} signed in", admin.Id);
            return Redirect("/");
        }

        private IActionResult Invalid(AdminLoginViewModel model)
        {
            ModelState.AddModelError(string.Empty, "Invalid username or password.");
            model.Password = string.Empty;
            return View(model);
        }
    }
}
