using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CMM_Cinema.Controllers
{
    // The page a ticket's QR code opens. Customers and cinema staff see the same thing; holding the
    // unguessable token is the only access check, so the page shows no buyer details or price.
    [AllowAnonymous]
    [EnableRateLimiting(AuthRateLimits.TicketLookup)]
    public class TicketPassController(IBookingService booking, IMovieRepository movies) : Controller
    {
        [HttpGet("t/{token}")]
        public async Task<IActionResult> Show(string token, CancellationToken cancellationToken)
        {
            Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            Response.Headers.CacheControl = "no-store";

            if (await booking.GetBookingByTicketTokenAsync(token, cancellationToken) is not { } hold
                || await booking.GetShowtimeAsync(hold.ShowtimeId, cancellationToken) is not { } showtime
                || await movies.GetBySlugIncludingArchivedAsync(showtime.MovieSlug, cancellationToken) is not { } movie)
            {
                Response.StatusCode = StatusCodes.Status404NotFound;
                return View("NotFound");
            }

            var starts = showtime.Date.ToDateTime(showtime.Time);
            var status = CinemaTime.Now >= starts.AddMinutes(Math.Max(movie.DurationMinutes, 0)) ? TicketPassStatus.Ended
                : showtime.Date == CinemaTime.Today ? TicketPassStatus.Today
                : TicketPassStatus.Upcoming;

            var ticket = new Ticket(hold.Reference, movie, BookingRules.GetCinema(showtime.CinemaId)?.Name ?? "CMM Cinema",
                BookingRules.HallFor(showtime), starts, showtime.Format, BookingRules.TicketSeatLabels(hold), hold.TicketToken);
            return View(new TicketPassViewModel(ticket, showtime.Language, hold.TicketCount, status));
        }
    }
}
