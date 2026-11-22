namespace CMM_Cinema.Models;

// Showtimes are in Bangkok time whatever time zone the server runs in (Azure runs in UTC).
public static class CinemaTime
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(7);
    public static DateTime Now => DateTimeOffset.UtcNow.ToOffset(Offset).DateTime;
    public static DateOnly Today => DateOnly.FromDateTime(Now);
}

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
    bool IsAvailable)
{
    public DateTime StartsAt => Date.ToDateTime(Time);
    public bool HasStarted => CinemaTime.Now >= StartsAt;
    public bool IsBookable => IsAvailable && !HasStarted;
}

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

// A seat hold or confirmed booking. No real payment is taken.
public record BookingHold(
    Guid Id,
    int OwnerId,
    int ShowtimeId,
    IReadOnlyList<BookedSeat> SeatItems,
    DateTimeOffset ExpiresAt,
    BookingStatus Status,
    string? TicketToken = null)
{
    public IReadOnlyList<string> Seats => SeatItems.Select(seat => seat.Id).ToArray();
    public int TicketCount => SeatItems.Sum(seat => seat.Capacity);
    public decimal Total => SeatItems.Sum(seat => seat.Price);
    public string Reference => Id.ToString("N")[..12].ToUpperInvariant();
}

public record HoldResult(BookingHold? Booking, string Error);

public record ConfirmResult(bool Succeeded, string Error);

// A signed-in user's temporary seat-picking session: it remembers their picks but does not reserve them.
public record BookingDraft(int OwnerId, int ShowtimeId, IReadOnlyList<string> SeatIds, DateTimeOffset ExpiresAt);

public record ShowtimesViewModel(
    Movie Movie,
    IReadOnlyList<Cinema> Cinemas,
    IReadOnlyList<DateOnly> Dates,
    IReadOnlyList<Showtime> Showtimes,
    DateOnly SelectedDate,
    int? CinemaId);

public record SeatSelectionViewModel(
    Movie Movie,
    Cinema Cinema,
    Showtime Showtime,
    IReadOnlyList<Seat> Seats,
    BookingDraft Draft,
    string? Error);

public record BookingDetailsViewModel(BookingHold Booking, Movie Movie, Cinema Cinema, Showtime Showtime);
