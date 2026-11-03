namespace CMM_Cinema.Models;

public enum SeatState { Available, Sold }

public enum BookingStatus { Held, Confirmed }

public record Cinema(int Id, string Name);

public record Showtime(
    int Id,
    string MovieSlug,
    int CinemaId,
    DateOnly Date,
    TimeOnly Time,
    string Format,
    string Language,
    bool IsAvailable);

public record Seat(string Id, char Row, int Number, SeatState State);

// A seat hold lives in memory only: it is demo data, not a real ticket or payment.
public record BookingHold(
    Guid Id,
    int ShowtimeId,
    IReadOnlyList<string> Seats,
    decimal PricePerSeat,
    DateTimeOffset ExpiresAt,
    BookingStatus Status,
    string? PaymentMethod = null)
{
    public decimal Total => Seats.Count * PricePerSeat;
    public string Reference => Id.ToString("N")[..12].ToUpperInvariant();
}

public record ShowtimesViewModel(
    Movie Movie,
    IReadOnlyList<Cinema> Cinemas,
    IReadOnlyList<DateOnly> Dates,
    IReadOnlyList<Showtime> Showtimes,
    DateOnly SelectedDate,
    int? CinemaId,
    string? Format,
    string? Language);

public record SeatSelectionViewModel(
    Movie Movie,
    Cinema Cinema,
    Showtime Showtime,
    IReadOnlyList<Seat> Seats,
    decimal PricePerSeat,
    string? Error);

public record BookingDetailsViewModel(BookingHold Booking, Movie Movie, Cinema Cinema, Showtime Showtime);
