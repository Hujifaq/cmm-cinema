using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    // Showtimes -> SeatSelection (draft session, SaveSeats) -> Reserve -> Summary -> Confirm -> Confirmation
    // Browsing showtimes is public; choosing seats onwards needs an account, and every booking belongs to its owner.
    [Authorize(Policy = AuthSetup.CustomerPolicy)]
    public class BookingController(IMovieRepository movies, IBookingService booking) : Controller
    {
        private int UserId => AuthClaims.UserId(User) ?? throw new InvalidOperationException("Booking actions require a signed-in user.");

        [HttpGet]
        [AllowAnonymous]
        public IActionResult Index(string? movie) => RedirectToAction(nameof(Showtimes), new { movie });

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> Showtimes(string? movie, DateOnly? date, int? cinemaId,
            CancellationToken cancellationToken)
        {
            var nowShowing = await movies.GetByStatusAsync(MovieStatus.NowShowing, cancellationToken);
            if (nowShowing.Count == 0) return RedirectToAction("Index", "Movies");

            var selectedMovie = nowShowing.FirstOrDefault(m => string.Equals(m.Slug, movie, StringComparison.OrdinalIgnoreCase))
                ?? nowShowing[0];

            // Unknown filter values fall back to "all" instead of returning an error.
            var dates = BookingRules.GetDates();
            var selectedDate = date is { } d && dates.Contains(d) ? d : dates[0];
            var selectedCinema = cinemaId is { } id && BookingRules.GetCinema(id) is not null ? cinemaId : null;

            var showtimes = (await booking.GetShowtimesAsync(selectedMovie.Slug, cancellationToken))
                .Where(s => s.Date == selectedDate)
                .Where(s => selectedCinema is null || s.CinemaId == selectedCinema)
                .ToArray();

            return View(new ShowtimesViewModel(selectedMovie, BookingRules.Cinemas, dates, showtimes,
                selectedDate, selectedCinema));
        }

        [HttpGet]
        public async Task<IActionResult> SeatSelection(int showtimeId, CancellationToken cancellationToken)
        {
            var showtime = await booking.GetShowtimeAsync(showtimeId, cancellationToken);
            if (showtime is null) return NotFound();
            if (!showtime.IsAvailable) return RedirectToAction(nameof(Showtimes), new { movie = showtime.MovieSlug });

            var movie = await movies.GetBySlugAsync(showtime.MovieSlug, cancellationToken);
            if (movie is null) return NotFound();

            if (await booking.StartDraftAsync(UserId, showtimeId, cancellationToken) is not { } draft)
                return RedirectToAction(nameof(Showtimes), new { movie = showtime.MovieSlug });

            return View(new SeatSelectionViewModel(movie, BookingRules.GetCinema(showtime.CinemaId)!, showtime,
                await booking.GetSeatsAsync(showtimeId, cancellationToken), draft, TempData["SeatError"] as string));
        }

        [HttpPost, ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveSeats(int showtimeId, string[]? seatIds, CancellationToken cancellationToken)
        {
            if (await booking.SaveDraftSeatsAsync(UserId, showtimeId, seatIds ?? [], cancellationToken) is not { } draft) return NotFound();
            return Json(new { seats = draft.SeatIds, expiresAt = draft.ExpiresAt.ToUnixTimeSeconds() });
        }

        [HttpPost, ValidateAntiForgeryToken]
        public async Task<IActionResult> Reserve(int showtimeId, string[]? seatIds, CancellationToken cancellationToken)
        {
            var result = await booking.HoldSeatsAsync(UserId, showtimeId, seatIds ?? [], cancellationToken);
            if (result.Booking is not { } hold)
            {
                await booking.SaveDraftSeatsAsync(UserId, showtimeId, seatIds ?? [], cancellationToken);
                TempData["SeatError"] = result.Error;
                return RedirectToAction(nameof(SeatSelection), new { showtimeId });
            }
            await booking.ClearDraftAsync(UserId, cancellationToken);
            return RedirectToAction(nameof(Summary), new { bookingId = hold.Id });
        }

        [HttpGet]
        public async Task<IActionResult> Summary(Guid bookingId, CancellationToken cancellationToken)
        {
            var details = await FindDetailsAsync(bookingId, cancellationToken);
            if (details is null) return RedirectToAction(nameof(Showtimes));
            if (details.Booking.Status != BookingStatus.Held) return RedirectToAction(nameof(Confirmation), new { bookingId });
            ViewData["BookingError"] = TempData["BookingError"];
            return View(details);
        }

        [HttpGet]
        public IActionResult Payment(Guid bookingId) => RedirectToAction(nameof(Summary), new { bookingId });

        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult Pay(Guid bookingId) => RedirectToAction(nameof(Summary), new { bookingId });

        [HttpPost, ValidateAntiForgeryToken]
        public async Task<IActionResult> Confirm(Guid bookingId, CancellationToken cancellationToken)
        {
            var result = await booking.ConfirmBookingAsync(UserId, bookingId, cancellationToken);
            if (result.Succeeded)
            {
                TempData["Celebrate"] = true;
                return RedirectToAction(nameof(Confirmation), new { bookingId });
            }

            if (await booking.GetBookingAsync(UserId, bookingId, cancellationToken) is null) return RedirectToAction(nameof(Showtimes));
            TempData["BookingError"] = result.Error;
            return RedirectToAction(nameof(Summary), new { bookingId });
        }

        [HttpGet]
        public async Task<IActionResult> Confirmation(Guid bookingId, CancellationToken cancellationToken)
        {
            var details = await FindDetailsAsync(bookingId, cancellationToken);
            if (details?.Booking.Status != BookingStatus.Confirmed) return NotFound();

            // Arriving from the Confirm loader: play the confetti once, with no page transition in between.
            if (TempData["Celebrate"] is true)
            {
                ViewData["Celebrate"] = true;
                ViewData["NoPageTransition"] = true;
            }
            return View(details);
        }

        [HttpPost, ValidateAntiForgeryToken]
        public async Task<IActionResult> Cancel(Guid bookingId, CancellationToken cancellationToken)
        {
            var showtime = await booking.GetBookingAsync(UserId, bookingId, cancellationToken) is { } hold
                ? await booking.GetShowtimeAsync(hold.ShowtimeId, cancellationToken)
                : null;
            await booking.CancelHoldAsync(UserId, bookingId, cancellationToken);
            await booking.ClearDraftAsync(UserId, cancellationToken);
            return RedirectToAction(nameof(Showtimes), new { movie = showtime?.MovieSlug });
        }

        private async Task<BookingDetailsViewModel?> FindDetailsAsync(Guid bookingId, CancellationToken cancellationToken)
        {
            if (await booking.GetBookingAsync(UserId, bookingId, cancellationToken) is not { } hold) return null;
            if (await booking.GetShowtimeAsync(hold.ShowtimeId, cancellationToken) is not { } showtime) return null;
            if (await movies.GetBySlugAsync(showtime.MovieSlug, cancellationToken) is not { } movie) return null;
            return new BookingDetailsViewModel(hold, movie, BookingRules.GetCinema(showtime.CinemaId)!, showtime);
        }
    }
}
