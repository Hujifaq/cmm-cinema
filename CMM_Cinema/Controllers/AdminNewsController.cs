using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    [Authorize(Roles = AuthClaims.AdminRole)]
    public class AdminNewsController(INewsRepository news, IMovieRepository movies, NewsArtService art) : Controller
    {
        private const double MinCoverRatio = 1.4;

        [HttpGet("Admin/News")]
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            Response.Headers.CacheControl = "no-store";
            ViewData["CanEdit"] = news.CanEdit;
            return View(await news.GetAdminRowsAsync(cancellationToken));
        }

        [HttpGet("Admin/News/New")]
        public async Task<IActionResult> Create(CancellationToken cancellationToken) =>
            news.CanEdit ? await FormAsync(new NewsForm { PublishedOn = CinemaTime.Today }, true, cancellationToken) : RedirectToAction(nameof(Index));

        [HttpPost("Admin/News/New"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(NewsForm form, CancellationToken cancellationToken)
        {
            if (!news.CanEdit) return RedirectToAction(nameof(Index));
            if (!await ValidateAsync(form, null, cancellationToken)) return await FormAsync(form, true, cancellationToken);

            var result = await news.CreateAsync(form, cancellationToken);
            if (result.Status == NewsSaveStatus.SlugTaken)
            {
                ModelState.AddModelError(nameof(NewsForm.Slug), "Another story already uses this web address. Change the title or the address.");
                return await FormAsync(form, true, cancellationToken);
            }

            TempData["AdminNotice"] = $"Added {form.Title}.";
            return RedirectToAction(nameof(Index));
        }

        [HttpGet("Admin/News/{id:int}/Edit")]
        public async Task<IActionResult> Edit(int id, CancellationToken cancellationToken) =>
            await news.GetFormAsync(id, cancellationToken) is { } form ? await FormAsync(form, false, cancellationToken) : NotFound();

        [HttpPost("Admin/News/{id:int}/Edit"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, NewsForm form, CancellationToken cancellationToken)
        {
            if (await news.GetFormAsync(id, cancellationToken) is not { } existing) return NotFound();
            if (!await ValidateAsync(form, existing, cancellationToken)) return await FormAsync(form, false, cancellationToken);

            var result = await news.UpdateAsync(id, form, cancellationToken);
            if (result.Status == NewsSaveStatus.NotFound) return NotFound();
            if (result.Status == NewsSaveStatus.SlugTaken)
            {
                ModelState.AddModelError(nameof(NewsForm.Slug), "Another story already uses this web address. Change the title or the address.");
                return await FormAsync(form, false, cancellationToken);
            }

            art.Forget(existing.FinalSlug);
            art.Forget(result.Slug!);
            TempData["AdminNotice"] = $"Saved {form.Title}.";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost("Admin/News/Delete"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
        {
            var slug = (await news.GetFormAsync(id, cancellationToken))?.FinalSlug;
            TempData["AdminNotice"] = news.CanEdit && await news.DeleteAsync(id, cancellationToken) ? "Story deleted." : "That story was already gone.";
            if (slug is not null) art.Forget(slug);
            return RedirectToAction(nameof(Index));
        }

        private async Task<IActionResult> FormAsync(NewsForm form, bool isNew, CancellationToken cancellationToken)
        {
            var choices = await MovieChoicesAsync(cancellationToken);
            return View("Edit", new NewsFormViewModel(form, isNew, choices));
        }

        private async Task<IReadOnlyList<MovieChoice>> MovieChoicesAsync(CancellationToken cancellationToken) =>
            (await movies.GetByStatusAsync(MovieStatus.NowShowing, cancellationToken))
                .Concat(await movies.GetByStatusAsync(MovieStatus.Upcoming, cancellationToken))
                .Select(movie => new MovieChoice(movie.Id, movie.Title))
                .ToArray();

        private async Task<bool> ValidateAsync(NewsForm form, NewsForm? existing, CancellationToken cancellationToken)
        {
            form.Normalize();
            if (form.Title.Length > 0 && form.FinalSlug.Length == 0)
                ModelState.AddModelError(nameof(NewsForm.Slug), "The web address needs at least one letter or number.");
            if (form.MovieId is { } movieId && (await MovieChoicesAsync(cancellationToken)).All(choice => choice.Id != movieId))
                ModelState.AddModelError(nameof(NewsForm.MovieId), "Pick a movie from the list, or leave it empty.");

            if (ModelState.IsValid && form.LandscapeUrl is not null && !string.Equals(form.LandscapeUrl, existing?.LandscapeUrl, StringComparison.Ordinal)
                && await art.MeasureAsync(form.LandscapeUrl, cancellationToken) is var (width, height) && width < height * MinCoverRatio)
            {
                ModelState.AddModelError(nameof(NewsForm.LandscapeUrl),
                    $"That image is {width}×{height}. News covers need a landscape (16:9) image, like a movie landscape poster or still.");
            }
            return ModelState.IsValid;
        }
    }
}
