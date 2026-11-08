using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class NewsController(INewsRepository news, NewsArtService art) : Controller
    {
        [HttpGet("News")]
        public async Task<IActionResult> Index(CancellationToken cancellationToken) =>
            View(await news.GetStoriesAsync(cancellationToken));

        [HttpGet("News/{slug}")]
        public async Task<IActionResult> Story(string slug, CancellationToken cancellationToken)
        {
            var stories = await news.GetStoriesAsync(cancellationToken);
            var index = stories.ToList().FindIndex(s => s.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
            if (index < 0) return NotFound();
            return View(new NewsStoryViewModel(stories[index], index, stories.Count));
        }

        // Square, same-origin copy of a story's movie cover (the disc texture); see NewsArtService.
        [HttpGet("News/art/{slug}")]
        public async Task<IActionResult> Art(string slug, CancellationToken cancellationToken)
        {
            var story = (await news.GetStoriesAsync(cancellationToken)).FirstOrDefault(s => s.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
            if (story is null) return NotFound();

            var bytes = await art.GetAsync(story);
            if (bytes is null) return NotFound();

            Response.Headers.CacheControl = "public, max-age=3600";
            return File(bytes, "image/jpeg");
        }
    }
}
