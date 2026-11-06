using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Showtimes, seat holds and payment for the booking pages. Movies themselves come from IMovieRepository.
public interface IBookingService
{
    IReadOnlyList<string> Formats { get; }
    IReadOnlyList<string> Languages { get; }

    IReadOnlyList<Cinema> GetCinemas();
    Cinema? GetCinema(int cinemaId);
    IReadOnlyList<DateOnly> GetDates();
    IReadOnlyList<Showtime> GetShowtimes(string movieSlug);
    Showtime? GetShowtime(int showtimeId);
    decimal GetSeatPrice(Showtime showtime);
    IReadOnlyList<Seat> GetSeats(int showtimeId);

    // Bookings belong to the signed-in user who held them; another user's id behaves as if the booking doesn't exist.
    bool TryHoldSeats(int ownerId, int showtimeId, IEnumerable<string> seatIds, out BookingHold? booking, out string error);
    BookingHold? GetBooking(int ownerId, Guid bookingId);
    bool TryConfirmPayment(int ownerId, Guid bookingId, string paymentMethod, out string error);
    void CancelHold(int ownerId, Guid bookingId);
}
