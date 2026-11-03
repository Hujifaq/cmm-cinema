using CMM_Cinema.Services.Booking;
using CMM_Cinema.ViewModels.Booking;
using Microsoft.AspNetCore.Mvc;

namespace CMM_Cinema.Controllers;

public sealed class BookingController(IBookingService bookingService) : Controller
{
    [HttpGet]
    public IActionResult Showtimes(int movieId = 1, DateOnly? date = null,
        int? cinemaId = null, string? format = null, string? language = null)
    {
        var movies = bookingService.GetMovies();
        if (movies.Count == 0) return Problem("No movies available.");
        var movie = movies.FirstOrDefault(x => x.Id == movieId) ?? movies[0];

        var cinemas = bookingService.GetCinemas();
        var safeCinemaId = cinemaId.HasValue && cinemas.Any(x => x.Id == cinemaId.Value)
            ? cinemaId
            : null;

        var dates = bookingService.GetDates();
        if (dates.Count == 0) return Problem("No available schedule dates.");
        var selectedDate = date.HasValue && dates.Contains(date.Value)
            ? date.Value
            : dates[0];

        var safeFormat = format is "2D" or "3D" or "IMAX" ? format : null;
        var safeLanguage = language is "English" or "Thai (Sub)" ? language : null;

        return View(new ShowtimesViewModel
        {
            Movies = movies, Movie = movie,
            Cinemas = cinemas, Dates = dates, SelectedDate = selectedDate,
            CinemaId = safeCinemaId, Format = safeFormat, Language = safeLanguage,
            Showtimes = bookingService.GetShowtimes().Where(x => x.MovieId == movie.Id
                && x.Date == selectedDate && (!safeCinemaId.HasValue || x.CinemaId == safeCinemaId)
                && (safeFormat is null || x.Format == safeFormat)
                && (safeLanguage is null || x.Language == safeLanguage)).ToArray()
        });
    }

    [HttpGet]
    public IActionResult SeatSelection(int showtimeId)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var showtime = bookingService.GetShowtime(showtimeId);
        if (showtime is null) return NotFound();
        if (!showtime.IsAvailable) return BadRequest("This screening is unavailable.");
        return View(new SeatSelectionViewModel
        {
            Movie = bookingService.GetMovies().Single(x => x.Id == showtime.MovieId),
            Cinema = bookingService.GetCinemas().Single(x => x.Id == showtime.CinemaId),
            Showtime = showtime, Seats = bookingService.GetSeats(showtimeId),
            PricePerSeat = bookingService.GetSeatPrice(showtime),
            Error = TempData["SeatError"] as string
        });
    }

    [HttpGet]
    public IActionResult BackToShowtimes(int showtimeId)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var showtime = bookingService.GetShowtime(showtimeId);
        if (showtime is null) return RedirectToAction(nameof(Showtimes));
        return RedirectToAction(nameof(Showtimes), new
        {
            movieId = showtime.MovieId
        });
    }

    [HttpPost, ValidateAntiForgeryToken]
    public IActionResult Reserve(int showtimeId, string[]? seatIds)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        if (!bookingService.TryHoldSeats(showtimeId, seatIds ?? Array.Empty<string>(), out var booking, out var error))
        {
            TempData["SeatError"] = error;
            return RedirectToAction(nameof(SeatSelection), new { showtimeId });
        }
        return RedirectToAction(nameof(Summary), new { bookingId = booking!.Id });
    }

    private BookingDetailsViewModel? FindDetails(Guid bookingId)
    {
        var draft = bookingService.GetBooking(bookingId);
        if (draft is null) return null;
        var show = bookingService.GetShowtime(draft.ShowtimeId);
        if (show is null) return null;
        return new BookingDetailsViewModel
        {
            Booking = draft, Showtime = show,
            Movie = bookingService.GetMovies().Single(m => m.Id == show.MovieId),
            Cinema = bookingService.GetCinemas().Single(c => c.Id == show.CinemaId)
        };
    }

    [HttpGet]
    public IActionResult Summary(Guid bookingId)
    {
        var details = FindDetails(bookingId);
        if (details is null) return RedirectToAction(nameof(Showtimes));
        if (details.Booking.Status != "Held") return RedirectToAction(nameof(Confirmation), new { bookingId });
        return View(details);
    }

    [HttpGet]
    public IActionResult Payment(Guid bookingId)
    {
        var details = FindDetails(bookingId);
        if (details is null) return RedirectToAction(nameof(Showtimes));
        if (details.Booking.Status != "Held") return RedirectToAction(nameof(Confirmation), new { bookingId });
        ViewData["PaymentError"] = TempData["PaymentError"];
        return View(details);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public IActionResult DemoPay(Guid bookingId, string paymentMethod)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        if (!bookingService.TryCompleteDemoPayment(bookingId, paymentMethod, out _, out var error))
        {
            TempData["PaymentError"] = error;
            if (bookingService.GetBooking(bookingId) is null)
                return RedirectToAction(nameof(Showtimes));
            return RedirectToAction(nameof(Payment), new { bookingId });
        }
        return RedirectToAction(nameof(Confirmation), new { bookingId });
    }

    [HttpGet]
    public IActionResult Confirmation(Guid bookingId)
    {
        var details = FindDetails(bookingId);
        if (details is null || details.Booking.Status != "DemoConfirmed") return NotFound();
        return View(details);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public IActionResult Cancel(Guid bookingId)
    {
        var details = FindDetails(bookingId);
        bookingService.CancelHold(bookingId);
        return RedirectToAction(nameof(Showtimes), new { movieId = details?.Movie.Id ?? 1 });
    }
}
