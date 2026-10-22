using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    public class TicketsController(IMovieRepository movies) : Controller
    {

        private static readonly (string Code, string Slug, string Cinema, string Hall, int DaysFromToday, int Hour, string Format, string[] Seats)[] DemoBookings =
        [
            ("CMM-48213", "the-last-horizon", "CMM Central Mall", "Hall 3", 2, 19, "2D English", ["F7", "F8"]),
            ("CMM-47102", "neon-harbor", "CMM Central Mall", "Hall 1", -6, 21, "2D English", ["D4"]),
            ("CMM-46550", "paper-moons", "CMM Riverside", "Hall 2", -14, 14, "2D English", ["H10", "H11", "H12"]),
        ];

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

        private async Task<List<Ticket>> GetTicketsAsync(CancellationToken cancellationToken)
        {
            var tickets = new List<Ticket>();
            foreach (var booking in DemoBookings)
            {
                var movie = await movies.GetBySlugAsync(booking.Slug, cancellationToken);
                if (movie is null) continue;
                var showtime = DateTime.Today.AddDays(booking.DaysFromToday).AddHours(booking.Hour);
                tickets.Add(new Ticket(booking.Code, movie, booking.Cinema, booking.Hall, showtime, booking.Format, booking.Seats));
            }
            return tickets;
        }
    }
}
