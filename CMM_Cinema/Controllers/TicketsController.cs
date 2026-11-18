using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    [Authorize]
    public class TicketsController(IBookingService booking, IMovieRepository movies, TicketQrService qr) : Controller
    {

        [HttpGet("MyTickets")]
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            var now = CinemaTime.Now;
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

        // Download Ticket: the ticket's QR code as a PNG, for the owner only.
        [HttpGet("MyTickets/{code}/ticket-qr.png")]
        public async Task<IActionResult> QrPng(string code, CancellationToken cancellationToken)
        {
            var ticket = (await GetTicketsAsync(cancellationToken))
                .FirstOrDefault(t => string.Equals(t.BookingCode, code, StringComparison.OrdinalIgnoreCase));
            if (ticket?.TicketToken is not { } token) return NotFound();
            return File(qr.Png(qr.TicketUrl(Request, token)), "image/png", $"cmm-ticket-{ticket.BookingCode}.png");
        }

        // Admins have no customer id, so they see no tickets. A VIP pair lists both of its seats.
        // Bookings confirmed before ticket tokens existed are given one here, so every ticket has a working QR code.
        private async Task<List<Ticket>> GetTicketsAsync(CancellationToken cancellationToken)
        {
            var tickets = new List<Ticket>();
            if (AuthClaims.UserId(User) is not { } userId) return tickets;

            foreach (var hold in await booking.GetConfirmedBookingsAsync(userId, cancellationToken))
            {
                if (await booking.GetShowtimeAsync(hold.ShowtimeId, cancellationToken) is not { } showtime) continue;
                if (await movies.GetBySlugAsync(showtime.MovieSlug, cancellationToken) is not { } movie) continue;

                var token = hold.TicketToken ?? await booking.EnsureTicketTokenAsync(userId, hold.Id, cancellationToken);
                tickets.Add(new Ticket(hold.Reference, movie, BookingRules.GetCinema(showtime.CinemaId)?.Name ?? "CMM Cinema",
                    BookingRules.HallFor(showtime), showtime.Date.ToDateTime(showtime.Time), showtime.Format,
                    BookingRules.TicketSeatLabels(hold), token));
            }
            return tickets;
        }
    }
}
