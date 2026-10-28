using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.ViewEngines;
using Microsoft.AspNetCore.Mvc.ViewFeatures;

namespace CMM_Cinema.Controllers
{
    public class MoviesController(IMovieRepository movies, ICompositeViewEngine viewEngine) : Controller
    {
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            return View(new MovieListingsViewModel(
                await movies.GetByStatusAsync(MovieStatus.NowShowing, cancellationToken),
                await movies.GetByStatusAsync(MovieStatus.Upcoming, cancellationToken)));
        }

        [HttpGet("api/movies/search")]
        public async Task<IActionResult> Search(string? q, CancellationToken cancellationToken)
        {
            var results = await movies.SearchAsync(q ?? "", 24, cancellationToken);
            var payload = new List<MovieSearchResult>(results.Count);
            foreach (var movie in results) payload.Add(MovieSearchResult.From(movie, await RenderPosterAsync(movie)));
            return Json(payload);
        }

        // The Spotlight cursor preview reuses the drawn poster from the movie cards.
        private async Task<string> RenderPosterAsync(Movie movie)
        {
            var view = viewEngine.FindView(ControllerContext, "_MoviePoster", isMainPage: false).View
                ?? throw new InvalidOperationException("_MoviePoster partial not found.");
            await using var writer = new StringWriter();
            var viewData = new ViewDataDictionary<Movie>(ViewData, movie);
            await view.RenderAsync(new ViewContext(ControllerContext, view, viewData, TempData, writer, new HtmlHelperOptions()));
            return writer.ToString();
        }

        [HttpGet("Movies/{slug}")]
        public async Task<IActionResult> Details(string slug, CancellationToken cancellationToken)
        {
            var movie = await movies.GetBySlugAsync(slug, cancellationToken);
            return movie is null ? NotFound() : View(movie);
        }
    }
}
