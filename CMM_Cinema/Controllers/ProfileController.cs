using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    [Authorize]
    public class ProfileController(UserRepository users) : Controller
    {
        [HttpGet]
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            // The account behind the cookie can disappear (deleted in D1); treat that as signed out.
            if (AuthClaims.UserId(User) is not { } userId || await users.FindByIdAsync(userId, cancellationToken) is not { } user)
            {
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return RedirectToAction("Index", "LoginRegister");
            }

            Response.Headers.CacheControl = "no-store";
            return View(new ProfileViewModel(user, await users.GetLoginProvidersAsync(user.Id, cancellationToken)));
        }
    }
}
