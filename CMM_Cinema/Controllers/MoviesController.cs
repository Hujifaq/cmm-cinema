using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class MoviesController(IMovieRepository movies) : Controller
    {
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            return View(new MovieListingsViewModel(
                await movies.GetByStatusAsync(MovieStatus.NowShowing, cancellationToken),
                await movies.GetByStatusAsync(MovieStatus.Upcoming, cancellationToken)));
        }

        [HttpGet("Movies/{slug}")]
        public async Task<IActionResult> Details(string slug, CancellationToken cancellationToken)
        {
            var movie = await movies.GetBySlugAsync(slug, cancellationToken);
            return movie is null ? NotFound() : View(movie);
        }
    }
}
