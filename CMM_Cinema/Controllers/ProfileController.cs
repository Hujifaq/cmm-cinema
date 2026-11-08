using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    [Authorize]
    public class ProfileController(UserRepository users, AdminRepository admins) : Controller
    {
        [HttpGet]
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            if (AuthClaims.IsAdmin(User))
            {
                if (AuthClaims.AdminId(User) is not { } adminId || await admins.FindByIdAsync(adminId, cancellationToken) is not { } admin)
                {
                    await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                    return RedirectToAction("Index", "Admin");
                }

                Response.Headers.CacheControl = "no-store";
                return View(new ProfileViewModel(admin.Username, "Your CMM Cinema admin account", "Username", admin.Username, null, ["Username and password"]));
            }

            // The account behind the cookie can disappear (deleted in D1); treat that as signed out.
            if (AuthClaims.UserId(User) is not { } userId || await users.FindByIdAsync(userId, cancellationToken) is not { } user)
            {
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return RedirectToAction("Index", "LoginRegister");
            }

            Response.Headers.CacheControl = "no-store";
            var providers = await users.GetLoginProvidersAsync(user.Id, cancellationToken);
            var methods = new List<string>();
            if (user.HasPassword) methods.Add("Email and password");
            if (providers.Contains(AuthClaims.GoogleProvider)) methods.Add("Google");
            return View(new ProfileViewModel(user.Name, "Your CMM Cinema account", "Email", user.Email, user.EmailVerified, methods));
        }
    }
}
