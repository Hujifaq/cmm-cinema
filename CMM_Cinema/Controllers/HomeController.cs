using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace CMM_Cinema.Controllers
{
    public class HomeController(IMovieRepository movies) : Controller
    {
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            return View(new MovieListingsViewModel(
                await movies.GetByStatusAsync(MovieStatus.NowShowing, cancellationToken),
                await movies.GetByStatusAsync(MovieStatus.Upcoming, cancellationToken)));
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
