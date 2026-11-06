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

public enum SeatCategory { Normal, Premium, Vip }

public static class SeatCategoryLabels
{
    public static string DisplayName(this SeatCategory category) => category switch
    {
        SeatCategory.Premium => "Premium",
        SeatCategory.Vip => "VIP",
        _ => "Normal"
    };
}

// A VIP selection is one indivisible pair: one ID, two admissions and one pair price.
public record Seat(string Id, string Row, int Number, SeatState State, SeatCategory Category, decimal Price, int Capacity = 1);
public record BookedSeat(string Id, SeatCategory Category, decimal Price, int Capacity);

// A seat hold lives in memory only: it is demo data, not a real ticket or payment.
public record BookingHold(
    Guid Id,
    int ShowtimeId,
    IReadOnlyList<BookedSeat> SeatItems,
    DateTimeOffset ExpiresAt,
    BookingStatus Status)
{
    public IReadOnlyList<string> Seats => SeatItems.Select(seat => seat.Id).ToArray();
    public int TicketCount => SeatItems.Sum(seat => seat.Capacity);
    public decimal Total => SeatItems.Sum(seat => seat.Price);
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
    string? Error);

public record BookingDetailsViewModel(BookingHold Booking, Movie Movie, Cinema Cinema, Showtime Showtime);
