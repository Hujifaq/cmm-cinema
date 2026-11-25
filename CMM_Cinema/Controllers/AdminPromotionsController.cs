using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    [Authorize(Roles = AuthClaims.AdminRole)]
    public class AdminPromotionsController(IPromotionRepository promotions, PromotionImageService images) : Controller
    {
        [HttpGet("Admin/Promotions")]
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            Response.Headers.CacheControl = "no-store";
            ViewData["CanEdit"] = promotions.CanEdit;
            return View(await promotions.GetAdminRowsAsync(cancellationToken));
        }

        [HttpGet("Admin/Promotions/New")]
        public async Task<IActionResult> Create(CancellationToken cancellationToken) =>
            promotions.CanEdit && !await IsFullAsync(cancellationToken)
                ? View("Edit", new PromotionFormViewModel(new PromotionForm(), true))
                : RedirectToAction(nameof(Index));

        [HttpPost("Admin/Promotions/New"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(PromotionForm form, CancellationToken cancellationToken)
        {
            if (!promotions.CanEdit) return RedirectToAction(nameof(Index));
            if (!await ValidateAsync(form, null, cancellationToken)) return View("Edit", new PromotionFormViewModel(form, true));

            var result = await promotions.CreateAsync(form, cancellationToken);
            TempData["AdminNotice"] = result.Status == PromotionSaveStatus.TooMany
                ? $"The carousel holds {IPromotionRepository.MaxPromotions} banners at most. Delete one before adding another."
                : "Banner added.";
            return RedirectToAction(nameof(Index));
        }

        [HttpGet("Admin/Promotions/{id:int}/Edit")]
        public async Task<IActionResult> Edit(int id, CancellationToken cancellationToken) =>
            await promotions.GetFormAsync(id, cancellationToken) is { } form ? View(new PromotionFormViewModel(form, false)) : NotFound();

        [HttpPost("Admin/Promotions/{id:int}/Edit"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, PromotionForm form, CancellationToken cancellationToken)
        {
            if (await promotions.GetFormAsync(id, cancellationToken) is not { } existing) return NotFound();
            if (!await ValidateAsync(form, existing, cancellationToken)) return View(new PromotionFormViewModel(form, false));

            var result = await promotions.UpdateAsync(id, form, cancellationToken);
            if (result.Status == PromotionSaveStatus.NotFound) return NotFound();

            TempData["AdminNotice"] = "Banner saved.";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost("Admin/Promotions/Move"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Move(int id, int direction, CancellationToken cancellationToken)
        {
            if (promotions.CanEdit) await promotions.MoveAsync(id, direction, cancellationToken);
            return RedirectToAction(nameof(Index));
        }

        [HttpPost("Admin/Promotions/Delete"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
        {
            TempData["AdminNotice"] = promotions.CanEdit && await promotions.DeleteAsync(id, cancellationToken) ? "Banner deleted." : "That banner was already gone.";
            return RedirectToAction(nameof(Index));
        }

        private async Task<bool> IsFullAsync(CancellationToken cancellationToken) =>
            (await promotions.GetAdminRowsAsync(cancellationToken)).Count >= IPromotionRepository.MaxPromotions;

        private async Task<bool> ValidateAsync(PromotionForm form, PromotionForm? existing, CancellationToken cancellationToken)
        {
            form.Normalize();
            if (form.ImageUrl is null || !ModelState.IsValid) return false;

            var unchanged = string.Equals(form.ImageUrl, existing?.ImageUrl, StringComparison.Ordinal);
            if (unchanged) return true;

            if (!Uri.TryCreate(form.ImageUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            {
                ModelState.AddModelError(nameof(PromotionForm.ImageUrl), "Use a full https:// link.");
                return false;
            }

            if (await images.MeasureAsync(form.ImageUrl, cancellationToken) is not var (width, height))
            {
                ModelState.AddModelError(nameof(PromotionForm.ImageUrl), "Couldn't read an image from that link. Check it opens in a browser and is under 25 MB.");
                return false;
            }

            var ratio = (double)width / height;
            if (ratio is < PromotionImageService.MinRatio or > PromotionImageService.MaxRatio)
            {
                ModelState.AddModelError(nameof(PromotionForm.ImageUrl),
                    $"That image is {width}×{height}. Banners need a 16:9 image, so nothing gets cropped.");
                return false;
            }
            return true;
        }
    }
}
