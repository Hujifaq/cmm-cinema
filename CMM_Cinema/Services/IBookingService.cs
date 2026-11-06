using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Showtimes, seat holds and confirmation. Movies themselves come from IMovieRepository.
public interface IBookingService
{
    IReadOnlyList<string> Formats { get; }
    IReadOnlyList<string> Languages { get; }

    IReadOnlyList<Cinema> GetCinemas();
    Cinema? GetCinema(int cinemaId);
    IReadOnlyList<DateOnly> GetDates();
    IReadOnlyList<Showtime> GetShowtimes(string movieSlug);
    Showtime? GetShowtime(int showtimeId);
    decimal GetSeatPrice(Showtime showtime, SeatCategory category = SeatCategory.Normal);
    IReadOnlyList<Seat> GetSeats(int showtimeId);

    bool TryHoldSeats(int showtimeId, IEnumerable<string> seatIds, out BookingHold? booking, out string error);
    BookingHold? GetBooking(Guid bookingId);
    bool TryConfirmBooking(Guid bookingId, out string error);
    void CancelHold(Guid bookingId);
}
