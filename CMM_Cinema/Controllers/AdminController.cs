using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class AdminController : Controller
    {
        [HttpGet]
        public IActionResult Index() => View();
    }
}
