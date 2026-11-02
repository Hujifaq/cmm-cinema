using CMM_Cinema.Models;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class ForgotpasswordController : Controller
    {
        [HttpGet]
        public IActionResult Index() => View(new ForgotPasswordViewModel());

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Index(ForgotPasswordViewModel model)
        {
            if (!ModelState.IsValid)
                return View(model);

            ViewData["ResetUnavailable"] = true;
            return View(model);
        }
    }
}
