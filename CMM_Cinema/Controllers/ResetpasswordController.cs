using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class ResetpasswordController : Controller
    {
        [HttpGet]
        public IActionResult Index() => View();
    }
}
