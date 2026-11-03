using CMM_Cinema.ViewModels.Booking;

namespace CMM_Cinema.Services.Booking;

public interface IBookingService
{
    IReadOnlyList<MovieOption> GetMovies();
    IReadOnlyList<CinemaOption> GetCinemas();
    IReadOnlyList<DateOnly> GetDates();
    IReadOnlyList<ShowtimeOption> GetShowtimes();
    ShowtimeOption? GetShowtime(int showtimeId);
    decimal GetSeatPrice(ShowtimeOption showtime);
    IReadOnlyList<SeatOption> GetSeats(int showtimeId);
    bool TryHoldSeats(int showtimeId, IEnumerable<string> seats, out BookingDraft? booking, out string error);
    BookingDraft? GetBooking(Guid bookingId);
    bool TryCompleteDemoPayment(Guid bookingId, string paymentMethod, out BookingDraft? booking, out string error);
    void CancelHold(Guid bookingId);
}
