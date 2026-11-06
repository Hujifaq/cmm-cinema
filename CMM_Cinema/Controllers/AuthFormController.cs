using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace CMM_Cinema.Controllers
{
    public abstract class AuthFormController(TurnstileValidator turnstile, IOptions<AppOptions> app) : Controller
    {
        protected static readonly TimeSpan EmailWindow = TimeSpan.FromHours(1);
        protected const int EmailsPerWindow = 3;

        protected async Task<bool> PassesTurnstileAsync(string action, CancellationToken cancellationToken)
        {
            if (await turnstile.ValidateAsync(Request.Form[TurnstileValidator.FormField], HttpContext.Connection.RemoteIpAddress?.ToString(), action, cancellationToken))
                return true;
            ModelState.AddModelError(string.Empty, "Please complete the security check and try again.");
            return false;
        }

        // ajax-form.js submits with fetch so a failed attempt updates in place instead of navigating (and playing the page transition).
        protected bool WantsJson => Request.Headers.Accept.ToString().Contains("application/json", StringComparison.OrdinalIgnoreCase);

        protected IActionResult FormErrors(Func<IActionResult> page) => WantsJson
            ? BadRequest(new { errors = ModelState.Values.SelectMany(entry => entry.Errors).Select(error => error.ErrorMessage).Distinct() })
            : page();

        protected IActionResult FormSuccess(string? url) => WantsJson ? Json(new { redirect = url }) : Redirect(url ?? "/");

        protected string Link(string pathAndQuery) => app.Value.BaseUrl.TrimEnd('/') + pathAndQuery;
    }
}
