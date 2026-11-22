using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    [Authorize(Roles = AuthClaims.AdminRole)]
    public class AdminTicketsController(IBookingService booking, TicketBuilder builder, UserRepository users) : Controller
    {
        [HttpGet("Admin/Tickets/{bookingId:guid}")]
        public async Task<IActionResult> Edit(Guid bookingId, int? showtimeId, CancellationToken cancellationToken)
        {
            var model = await BuildAsync(bookingId, showtimeId, null, null, cancellationToken);
            if (model is null) return NotFound();
            Response.Headers.CacheControl = "no-store";
            return View(model);
        }

        [HttpPost("Admin/Tickets/{bookingId:guid}"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Save(Guid bookingId, int showtimeId, string[]? seatIds, CancellationToken cancellationToken)
        {
            if (await BuildAsync(bookingId, null, null, null, cancellationToken) is { Ticket.Movie.IsArchived: true } archived)
                return View(nameof(Edit), archived with { Error = ArchivedError });

            var result = await booking.ChangeConfirmedBookingAsync(bookingId, showtimeId, seatIds ?? [], cancellationToken);
            if (result.Booking is null)
            {
                var model = await BuildAsync(bookingId, showtimeId, seatIds ?? [], result.Error, cancellationToken);
                return model is null ? NotFound() : View(nameof(Edit), model);
            }

            TempData["AdminNotice"] = $"Saved ticket {result.Booking.Reference}.";
            return Redirect($"/Admin/Tickets/{bookingId:D}");
        }

        [HttpPost("Admin/Tickets/{bookingId:guid}/Cancel"), ValidateAntiForgeryToken]
        public async Task<IActionResult> Cancel(Guid bookingId, CancellationToken cancellationToken)
        {
            var reference = (await booking.GetConfirmedBookingAsync(bookingId, cancellationToken))?.Reference;
            TempData["AdminNotice"] = await booking.CancelConfirmedBookingAsync(bookingId, cancellationToken)
                ? $"Cancelled ticket {reference}. Its seats are free again."
                : "That ticket was already cancelled.";
            return Redirect("/MyTickets");
        }

        private const string ArchivedError = "This movie was deleted, so its tickets can only be cancelled.";

        private async Task<AdminTicketEditViewModel?> BuildAsync(Guid bookingId, int? showtimeId, IEnumerable<string>? postedSeats,
            string? error, CancellationToken cancellationToken)
        {
            if (await booking.GetConfirmedBookingAsync(bookingId, cancellationToken) is not { } hold) return null;
            if (await booking.GetShowtimeAsync(hold.ShowtimeId, cancellationToken) is not { } current) return null;
            if (await builder.BuildAsync(hold, cancellationToken) is not { } ticket) return null;

            var owner = (await users.GetContactsAsync([hold.OwnerId], cancellationToken)).GetValueOrDefault(hold.OwnerId)
                ?? new UserContact("Deleted account", "");
            var upcoming = ticket.Movie.IsArchived ? [] : await booking.GetShowtimesAsync(current.MovieSlug, cancellationToken);
            var showtimes = upcoming
                .Where(showtime => showtime.IsBookable && showtime.Id != current.Id)
                .Append(current)
                .OrderBy(showtime => showtime.StartsAt).ThenBy(showtime => showtime.CinemaId)
                .ToArray();
            var selected = showtimes.FirstOrDefault(showtime => showtime.Id == showtimeId && showtime.IsBookable) ?? current;

            var seats = BookingRules.ReleaseSeats(await booking.GetSeatsAsync(selected.Id, cancellationToken), hold, selected.Id);
            var free = seats.Where(seat => seat.State == SeatState.Available).Select(seat => seat.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var ticked = BookingRules.Normalize(postedSeats ?? hold.Seats).Where(free.Contains).ToHashSet(StringComparer.OrdinalIgnoreCase);

            return new AdminTicketEditViewModel(hold, ticket, owner, current, showtimes, selected, seats, ticked, error);
        }
    }
}
