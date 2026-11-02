using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class LoginRegisterController : Controller
    {
        [HttpGet]
        public IActionResult Index() => View();
    }
}
