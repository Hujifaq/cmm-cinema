using CMM_Cinema.Models;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class TicketsController : Controller
    {

        [HttpGet("MyTickets")]
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            var now = DateTime.Now;
            var tickets = await GetTicketsAsync(cancellationToken);

            return View(new MyTicketsViewModel(
                tickets.Where(ticket => ticket.Showtime >= now).OrderBy(ticket => ticket.Showtime).ToArray(),
                tickets.Where(ticket => ticket.Showtime < now).OrderByDescending(ticket => ticket.Showtime).ToArray()));
        }

        [HttpGet("MyTickets/{code}/{slug?}")]
        public async Task<IActionResult> Details(string code, string? slug, CancellationToken cancellationToken)
        {
            var tickets = await GetTicketsAsync(cancellationToken);
            var ticket = tickets.FirstOrDefault(t => string.Equals(t.BookingCode, code, StringComparison.OrdinalIgnoreCase));
            if (ticket is null) return NotFound();

            // The booking code finds the ticket; a missing or outdated movie slug redirects to the canonical URL.
            if (!string.Equals(ticket.Movie.Slug, slug, StringComparison.Ordinal) || ticket.BookingCode != code)
                return RedirectPermanent(ticket.Url);

            return View(ticket);
        }

        // Returns no tickets until bookings are read from the Cloudflare D1 database.
        private static Task<List<Ticket>> GetTicketsAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new List<Ticket>());
    }
}
