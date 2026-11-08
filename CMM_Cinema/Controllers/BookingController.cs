using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers
{
    // Showtimes -> SeatSelection -> Reserve -> Summary -> Confirm -> Confirmation
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
        public async Task<IActionResult> Showtimes(string? movie, DateOnly? date, int? cinemaId, string? format, string? language,
            CancellationToken cancellationToken)
        {
            var nowShowing = await movies.GetByStatusAsync(MovieStatus.NowShowing, cancellationToken);
            if (nowShowing.Count == 0) return RedirectToAction("Index", "Movies");

            var selectedMovie = nowShowing.FirstOrDefault(m => string.Equals(m.Slug, movie, StringComparison.OrdinalIgnoreCase))
                ?? nowShowing[0];

            // Unknown filter values fall back to "all" instead of returning an error.
            var dates = booking.GetDates();
            var selectedDate = date is { } d && dates.Contains(d) ? d : dates[0];
            var selectedCinema = cinemaId is { } id && booking.GetCinema(id) is not null ? cinemaId : null;
            var selectedFormat = booking.Formats.Contains(format) ? format : null;
            var selectedLanguage = booking.Languages.Contains(language) ? language : null;

            var showtimes = booking.GetShowtimes(selectedMovie.Slug)
                .Where(s => s.Date == selectedDate)
                .Where(s => selectedCinema is null || s.CinemaId == selectedCinema)
                .Where(s => selectedFormat is null || s.Format == selectedFormat)
                .Where(s => selectedLanguage is null || s.Language == selectedLanguage)
                .ToArray();

            return View(new ShowtimesViewModel(selectedMovie, booking.GetCinemas(), dates, showtimes,
                selectedDate, selectedCinema, selectedFormat, selectedLanguage));
        }

        [HttpGet]
        public async Task<IActionResult> SeatSelection(int showtimeId, CancellationToken cancellationToken)
        {
            var showtime = booking.GetShowtime(showtimeId);
            if (showtime is null) return NotFound();
            if (!showtime.IsAvailable) return RedirectToAction(nameof(Showtimes), new { movie = showtime.MovieSlug });

            var movie = await movies.GetBySlugAsync(showtime.MovieSlug, cancellationToken);
            if (movie is null) return NotFound();

            return View(new SeatSelectionViewModel(movie, booking.GetCinema(showtime.CinemaId)!, showtime,
                booking.GetSeats(showtimeId), TempData["SeatError"] as string));
        }

        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult Reserve(int showtimeId, string[]? seatIds)
        {
            if (!booking.TryHoldSeats(UserId, showtimeId, seatIds ?? [], out var hold, out var error))
            {
                TempData["SeatError"] = error;
                return RedirectToAction(nameof(SeatSelection), new { showtimeId });
            }
            return RedirectToAction(nameof(Summary), new { bookingId = hold!.Id });
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
        public IActionResult Confirm(Guid bookingId)
        {
            if (booking.TryConfirmBooking(UserId, bookingId, out var error))
                return RedirectToAction(nameof(Confirmation), new { bookingId });

            if (booking.GetBooking(UserId, bookingId) is null) return RedirectToAction(nameof(Showtimes));
            TempData["BookingError"] = error;
            return RedirectToAction(nameof(Summary), new { bookingId });
        }

        [HttpGet]
        public async Task<IActionResult> Confirmation(Guid bookingId, CancellationToken cancellationToken)
        {
            var details = await FindDetailsAsync(bookingId, cancellationToken);
            return details?.Booking.Status == BookingStatus.Confirmed ? View(details) : NotFound();
        }

        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult Cancel(Guid bookingId)
        {
            var showtime = booking.GetBooking(UserId, bookingId) is { } hold ? booking.GetShowtime(hold.ShowtimeId) : null;
            booking.CancelHold(UserId, bookingId);
            return RedirectToAction(nameof(Showtimes), new { movie = showtime?.MovieSlug });
        }

        private async Task<BookingDetailsViewModel?> FindDetailsAsync(Guid bookingId, CancellationToken cancellationToken)
        {
            if (booking.GetBooking(UserId, bookingId) is not { } hold) return null;
            if (booking.GetShowtime(hold.ShowtimeId) is not { } showtime) return null;
            if (await movies.GetBySlugAsync(showtime.MovieSlug, cancellationToken) is not { } movie) return null;
            return new BookingDetailsViewModel(hold, movie, booking.GetCinema(showtime.CinemaId)!, showtime);
        }
    }
}
