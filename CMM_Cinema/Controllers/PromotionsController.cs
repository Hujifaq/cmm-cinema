using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class PromotionsController(IPromotionRepository promotions, PromotionImageService images) : Controller
    {
        [HttpGet("Promotions/{id:int}/image")]
        public async Task<IActionResult> Image(int id, CancellationToken cancellationToken)
        {
            var promotion = (await promotions.GetActiveAsync(cancellationToken)).FirstOrDefault(p => p.Id == id && !p.IsLocal);
            if (promotion is null) return NotFound();

            var bytes = await images.GetAsync(promotion);
            if (bytes is null) return NotFound();

            Response.Headers.CacheControl = "public, max-age=86400";
            return File(bytes, "image/webp");
        }
    }
}
