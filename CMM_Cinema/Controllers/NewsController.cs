using CMM_Cinema.Models;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class NewsController : Controller
    {
        [HttpGet("News")]
        public IActionResult Index() => View(NewsData.Stories);

        [HttpGet("News/{slug}")]
        public IActionResult Story(string slug)
        {
            var stories = NewsData.Stories;
            var index = stories.ToList().FindIndex(s => s.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
            if (index < 0) return NotFound();
            return View(new NewsStoryViewModel(stories[index], index, stories.Count));
        }
    }
}
