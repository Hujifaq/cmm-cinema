using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.ViewEngines;
using Microsoft.AspNetCore.Mvc.ViewFeatures;

namespace CMM_Cinema.Controllers
{
    public class MoviesController(IMovieRepository movies, ICompositeViewEngine viewEngine) : Controller
    {
        public async Task<IActionResult> Index(string? show, CancellationToken cancellationToken)
        {
            // ?show=upcoming opens the Upcoming list; anything else shows what is playing now.
            ViewData["Show"] = string.Equals(show, "upcoming", StringComparison.OrdinalIgnoreCase) ? "upcoming" : "now-showing";
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

        [HttpGet("Movies/New")]
        [Authorize(Roles = AuthClaims.AdminRole)]
        public IActionResult Create() => View("Edit", new MovieForm());

        [HttpPost("Movies/New")]
        [Authorize(Roles = AuthClaims.AdminRole)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(MovieForm form, CancellationToken cancellationToken)
        {
            if (!Validate(form)) return View("Edit", form);

            var result = await movies.CreateAsync(form, cancellationToken);
            if (result.Status == MovieSaveStatus.SlugTaken)
            {
                ModelState.AddModelError(nameof(MovieForm.Slug), "Another movie already uses this web address. Change the title or the address.");
                return View("Edit", form);
            }
            TempData["AdminNotice"] = $"Added {form.Title}.";
            return Redirect($"/Movies/{Uri.EscapeDataString(result.Slug!)}");
        }

        [HttpGet("Movies/{slug}/Edit")]
        [Authorize(Roles = AuthClaims.AdminRole)]
        public async Task<IActionResult> Edit(string slug, CancellationToken cancellationToken) =>
            await movies.GetBySlugAsync(slug, cancellationToken) is { } movie ? View(MovieForm.From(movie)) : NotFound();

        [HttpPost("Movies/{slug}/Edit")]
        [Authorize(Roles = AuthClaims.AdminRole)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit([FromRoute] string slug, MovieForm form, CancellationToken cancellationToken)
        {
            if (await movies.GetBySlugAsync(slug, cancellationToken) is not { } movie) return NotFound();
            ViewData["OriginalSlug"] = movie.Slug;
            if (!Validate(form)) return View(form);

            var result = await movies.UpdateAsync(movie.Id, form, cancellationToken);
            if (result.Status == MovieSaveStatus.NotFound) return NotFound();
            if (result.Status == MovieSaveStatus.SlugTaken)
            {
                ModelState.AddModelError(nameof(MovieForm.Slug), "Another movie already uses this web address. Change the title or the address.");
                return View(form);
            }
            TempData["AdminNotice"] = $"Saved {form.Title}.";
            return Redirect($"/Movies/{Uri.EscapeDataString(result.Slug!)}");
        }

        [HttpPost("Movies/{slug}/QuickSave")]
        [Authorize(Roles = AuthClaims.AdminRole)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> QuickSave([FromRoute] string slug, [FromBody] MovieQuickEdit edit, CancellationToken cancellationToken)
        {
            if (await movies.GetBySlugAsync(slug, cancellationToken) is not { } movie) return NotFound();

            var form = MovieForm.From(movie);
            form.Title = edit.Title ?? "";
            form.Genre = edit.Genre ?? "";
            form.DurationMinutes = edit.DurationMinutes;
            form.Rating = edit.Rating ?? "";
            form.Language = edit.Language ?? "";
            form.Synopsis = edit.Synopsis ?? "";
            form.Overview = edit.Overview ?? "";
            form.Status = Enum.TryParse<MovieStatus>(edit.Status, out var status) ? status : movie.Status;
            form.ReleaseDate = edit.ReleaseDate;
            form.PosterUrl = edit.PosterUrl;
            form.TrailerUrl = edit.TrailerUrl;

            if (!Validate(form))
                return BadRequest(new { errors = ModelState.Values.SelectMany(entry => entry.Errors).Select(error => error.ErrorMessage).Distinct() });

            // The web address stays as it was, so links to this movie keep working after a rename.
            var result = await movies.UpdateAsync(movie.Id, form, cancellationToken);
            if (result.Status == MovieSaveStatus.NotFound) return NotFound();
            TempData["AdminNotice"] = $"Saved {form.Title}.";
            return Json(new { ok = true });
        }

        [HttpPost("Movies/Delete")]
        [Authorize(Roles = AuthClaims.AdminRole)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
        {
            TempData["AdminNotice"] = await movies.ArchiveAsync(id, cancellationToken) ? "Movie deleted." : "That movie was already gone.";
            return RedirectToAction(nameof(Index));
        }

        private bool Validate(MovieForm form)
        {
            form.Normalize();
            if (form.Title.Length > 0 && form.FinalSlug.Length == 0)
                ModelState.AddModelError(nameof(MovieForm.Slug), "The web address needs at least one letter or number.");
            else if (form.IsSlugReserved)
                ModelState.AddModelError(nameof(MovieForm.Slug), "That web address is reserved. Pick another.");
            if (form.TrailerUrl is not null && TrailerLink.ToEmbedUrl(form.TrailerUrl) is null)
                ModelState.AddModelError(nameof(MovieForm.TrailerUrl), "Use a YouTube or Vimeo link.");
            if (form.Status == MovieStatus.Upcoming && form.ReleaseDate is null)
                ModelState.AddModelError(nameof(MovieForm.ReleaseDate), "Upcoming movies need a release date.");
            return ModelState.IsValid;
        }
    }
}
