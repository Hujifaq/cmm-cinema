using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    [Authorize]
    public class TicketsController(IBookingService booking, BookingOwners owners, TicketBuilder builder, UserRepository users, TicketQrService qr) : Controller
    {

        [HttpGet("MyTickets")]
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            var now = CinemaTime.Now;
            var tickets = await GetTicketsAsync(cancellationToken);

            return View(new MyTicketsViewModel(
                tickets.Where(ticket => ticket.Showtime >= now).OrderBy(ticket => ticket.Showtime).ToArray(),
                tickets.Where(ticket => ticket.Showtime < now).OrderByDescending(ticket => ticket.Showtime).ToArray(),
                AuthClaims.IsAdmin(User) ? await GetAllTicketsAsync(now, cancellationToken) : null));
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

        private async Task<List<Ticket>> GetTicketsAsync(CancellationToken cancellationToken) =>
            await owners.ResolveAsync(User, cancellationToken) is { } ownerId
                ? await builder.BuildAllAsync(await booking.GetConfirmedBookingsAsync(ownerId, cancellationToken), cancellationToken)
                : [];

        private async Task<IReadOnlyList<AdminTicketRow>> GetAllTicketsAsync(DateTime now, CancellationToken cancellationToken)
        {
            var holds = await booking.GetAllConfirmedBookingsAsync(cancellationToken);
            var contacts = await users.GetContactsAsync(holds.Select(hold => hold.OwnerId), cancellationToken);
            var ownerByBooking = holds.ToDictionary(hold => hold.Id, hold => contacts.GetValueOrDefault(hold.OwnerId) ?? new UserContact("Deleted account", ""));
            var tickets = await builder.BuildAllAsync(holds, cancellationToken);

            return tickets
                .OrderBy(ticket => ticket.Showtime < now)
                .ThenBy(ticket => ticket.Showtime < now ? -ticket.Showtime.Ticks : ticket.Showtime.Ticks)
                .Select(ticket => new AdminTicketRow(ticket, ownerByBooking[ticket.BookingId!.Value]))
                .ToArray();
        }
    }
}
