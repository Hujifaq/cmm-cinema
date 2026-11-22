using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Showtimes, seat holds, confirmation and seat-picking sessions. Movies themselves come from IMovieRepository.
// Cinemas, dates, prices and seat rules are fixed in BookingRules.
public interface IBookingService
{
    Task<IReadOnlyList<Showtime>> GetShowtimesAsync(string movieSlug, CancellationToken cancellationToken = default);
    Task<Showtime?> GetShowtimeAsync(int showtimeId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Seat>> GetSeatsAsync(int showtimeId, CancellationToken cancellationToken = default);

    // Bookings belong to the signed-in user who held them; another user's id behaves as if the booking doesn't exist.
    Task<HoldResult> HoldSeatsAsync(int ownerId, int showtimeId, IEnumerable<string> seatIds, CancellationToken cancellationToken = default);
    Task<BookingHold?> GetBookingAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default);
    Task<ConfirmResult> ConfirmBookingAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default);
    Task CancelHoldAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<BookingHold>> GetConfirmedBookingsAsync(int ownerId, CancellationToken cancellationToken = default);

    // A confirmed booking's ticket token is what its QR code carries. Anyone holding the token can view that ticket,
    // so the lookup ignores the owner. Confirming sets the token once; Ensure gives older confirmed bookings one.
    Task<BookingHold?> GetBookingByTicketTokenAsync(string ticketToken, CancellationToken cancellationToken = default);
    Task<string?> EnsureTicketTokenAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<BookingHold>> GetAllConfirmedBookingsAsync(CancellationToken cancellationToken = default);
    Task<BookingHold?> GetConfirmedBookingAsync(Guid bookingId, CancellationToken cancellationToken = default);
    Task<HoldResult> ChangeConfirmedBookingAsync(Guid bookingId, int showtimeId, IEnumerable<string> seatIds, CancellationToken cancellationToken = default);
    Task<bool> CancelConfirmedBookingAsync(Guid bookingId, CancellationToken cancellationToken = default);

    // One draft per user. Returns null when the showtime is unknown or unavailable.
    Task<BookingDraft?> StartDraftAsync(int ownerId, int showtimeId, CancellationToken cancellationToken = default);
    Task<BookingDraft?> SaveDraftSeatsAsync(int ownerId, int showtimeId, IEnumerable<string> seatIds, CancellationToken cancellationToken = default);
    Task ClearDraftAsync(int ownerId, CancellationToken cancellationToken = default);
}
