using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace CMM_Cinema.Controllers
{
    public class ForgotpasswordController(
        UserRepository users,
        EmailTokenService tokens,
        IEmailSender email,
        EmailThrottle emailThrottle,
        TurnstileValidator turnstile,
        IOptions<AppOptions> app,
        ILogger<ForgotpasswordController> logger) : AuthFormController(turnstile, app)
    {
        private static readonly TimeSpan ResetLinkLifetime = TimeSpan.FromMinutes(30);

        [HttpGet]
        public IActionResult Index()
        {
            ViewData["ResetSentTo"] = TempData["ResetSentTo"] as string;
            return View(new ForgotPasswordViewModel());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting(AuthRateLimits.EmailSending)]
        public async Task<IActionResult> Index(ForgotPasswordViewModel model, CancellationToken cancellationToken)
        {
            if (!ModelState.IsValid || !await PassesTurnstileAsync("forgot", cancellationToken))
                return FormErrors(() => View(model));

            var user = await users.FindByEmailAsync(model.Email, cancellationToken);
            if (user is not null && emailThrottle.TryAcquire("reset", user.Email, EmailsPerWindow, EmailWindow))
            {
                if (user.HasPassword)
                {
                    var token = await tokens.CreateAsync(user.Id, EmailTokenPurpose.Reset, ResetLinkLifetime, cancellationToken);
                    await email.SendAsync(user.Email, AuthEmails.ResetPassword(user.Name, Link($"/Resetpassword?token={Uri.EscapeDataString(token)}")), cancellationToken);
                }
                else
                {
                    await email.SendAsync(user.Email, AuthEmails.GoogleOnlyAccount(user.Name, Link("/LoginRegister")), cancellationToken);
                }
                logger.LogInformation("Password reset requested for account {UserId}", user.Id);
            }

            // Same answer whether or not the account exists, so this form can't be used to find accounts.
            var address = UserRepository.NormalizeEmail(model.Email);
            if (WantsJson)
                return Json(new { message = $"If an account exists for {address}, we sent a reset link. It expires in 30 minutes." });
            TempData["ResetSentTo"] = address;
            return RedirectToAction(nameof(Index));
        }
    }
}
