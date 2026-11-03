using CMM_Cinema.ViewModels.Booking;

namespace CMM_Cinema.Services.Booking;

/// <summary>
/// DEMONSTRATION ONLY. In-memory sample showtimes, holds and simulated payments.
/// No authentication, database, payment gateway, or real tickets.
/// A restart discards every booking. Not suitable for deployment to real customers.
/// </summary>
public sealed class DemoBookingService : IBookingService
{
    private readonly object gate = new();
    private readonly Dictionary<Guid, BookingDraft> bookings = new();
    private readonly Dictionary<int, HashSet<string>> sold = new();
    private static readonly HashSet<string> SeedSold = new(StringComparer.OrdinalIgnoreCase)
        { "A3", "B5", "D11", "F14", "H7", "J2" };
    private readonly MovieOption[] movies =
    [
        new(1, "The Last Horizon", "Action", 138, "PG-13", "A team ventures beyond to find what lies on the other side of tomorrow."),
        new(2, "A Little Movie Magic", "Adventure", 112, "PG", "An unexpected friendship turns an ordinary evening into an extraordinary adventure.")
    ];
    private readonly CinemaOption[] cinemas = [new(1, "CMM Central Mall"), new(2, "CMM CB12")];
    private readonly DateOnly[] dates;
    private readonly ShowtimeOption[] showtimes;

    public DemoBookingService()
    {
        var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).DateTime);
        dates = Enumerable.Range(0, 7).Select(today.AddDays).ToArray();
        var items = new List<ShowtimeOption>();
        foreach (var movie in movies)
        foreach (var date in dates)
        foreach (var cinema in cinemas)
        foreach (var screening in new[] { ("2D", "English"), ("2D", "Thai (Sub)"), ("3D", "English"), ("IMAX", "English") })
        foreach (var hour in new[] { 13, 16, 19 })
        {
            var id = items.Count + 1;
            items.Add(new(id, movie.Id, cinema.Id, date, new TimeOnly(hour, 0),
                screening.Item1, screening.Item2, id % 7 != 0));
        }
        showtimes = items.ToArray();
    }

    public IReadOnlyList<MovieOption> GetMovies() => Array.AsReadOnly(movies);
    public IReadOnlyList<CinemaOption> GetCinemas() => Array.AsReadOnly(cinemas);
    public IReadOnlyList<DateOnly> GetDates() => Array.AsReadOnly(dates);
    public IReadOnlyList<ShowtimeOption> GetShowtimes() => Array.AsReadOnly(showtimes);
    public ShowtimeOption? GetShowtime(int showtimeId) => showtimes.FirstOrDefault(x => x.Id == showtimeId);
    public decimal GetSeatPrice(ShowtimeOption showtime) => showtime.Format switch
    {
        "IMAX" => 400m, "3D" => 300m, _ => 250m
    };

    private void RemoveExpiredHolds()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var id in bookings.Where(b => b.Value.Status == "Held" && b.Value.HoldExpiresAt <= now)
                     .Select(b => b.Key).ToArray())
            bookings.Remove(id);
    }

    private string SeatStatus(int showtimeId, string id)
    {
        if (sold.GetValueOrDefault(showtimeId)?.Contains(id) == true) return "Sold";
        if (SeedSold.Contains(id)) return "Sold";
        if (bookings.Values.Any(b => b.ShowtimeId == showtimeId && b.Status == "Held" && b.SeatIds.Contains(id))) return "Sold";
        return "Available";
    }

    public IReadOnlyList<SeatOption> GetSeats(int showtimeId)
    {
        lock (gate)
        {
            RemoveExpiredHolds();
            if (GetShowtime(showtimeId) is null) return Array.Empty<SeatOption>();
            return (from row in "ABCDEFGHIJ"
                    from num in Enumerable.Range(1, 16)
                    let seat = $"{row}{num}"
                    select new SeatOption(seat, row.ToString(), num, SeatStatus(showtimeId, seat))).ToArray();
        }
    }

    public bool TryHoldSeats(int showtimeId, IEnumerable<string> seats, out BookingDraft? booking, out string error)
    {
        lock (gate)
        {
            RemoveExpiredHolds();
            booking = null;
            error = "";
            var showtime = GetShowtime(showtimeId);
            if (showtime is null || !showtime.IsAvailable) { error = "This screening is unavailable."; return false; }
            var selected = seats.Select(s => (s ?? "").Trim().ToUpperInvariant()).Distinct().ToArray();
            if (selected.Length is < 1 or > 8) { error = "Please select between 1 and 8 seats."; return false; }
            if (selected.Any(s => s.Length < 2 || s.Length > 3 || s[0] < 'A' || s[0] > 'J'
                || !int.TryParse(s[1..], out var n) || n is < 1 or > 16))
            { error = "The selected seat list is invalid."; return false; }
            if (selected.Any(s => SeatStatus(showtimeId, s) != "Available"))
            { error = "One or more seats are no longer available. Please choose again."; return false; }
            booking = new BookingDraft(Guid.NewGuid(), showtimeId, selected.OrderBy(s => s[0]).ThenBy(s => int.Parse(s[1..])).ToArray(),
                GetSeatPrice(showtime), DateTimeOffset.UtcNow.AddMinutes(10), "Held");
            bookings.Add(booking.Id, booking);
            return true;
        }
    }

    public BookingDraft? GetBooking(Guid bookingId)
    {
        lock (gate) { RemoveExpiredHolds(); return bookings.GetValueOrDefault(bookingId); }
    }

    public bool TryCompleteDemoPayment(Guid bookingId, string paymentMethod, out BookingDraft? booking, out string error)
    {
        lock (gate)
        {
            RemoveExpiredHolds();
            booking = bookings.GetValueOrDefault(bookingId);
            error = "";
            if (paymentMethod is not ("card" or "promptpay")) { error = "Choose a payment method."; return false; }
            if (booking is null || booking.Status != "Held") { error = "Booking has expired or is already complete."; return false; }
            // The out parameter 'booking' cannot be captured inside a lambda (CS1628).
            // Use an ordinary local variable when checking and updating this booking.
            var currentBooking = booking;
            if (currentBooking.SeatIds.Any(s => sold.GetValueOrDefault(currentBooking.ShowtimeId)?.Contains(s) == true))
            { error = "One of the selected seats is already sold."; return false; }
            if (!sold.TryGetValue(currentBooking.ShowtimeId, out var set))
                sold[currentBooking.ShowtimeId] = set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var id in currentBooking.SeatIds) set.Add(id);
            booking = currentBooking with { Status = "DemoConfirmed", PaymentMethod = paymentMethod };
            bookings[booking.Id] = booking;
            return true;
        }
    }

    public void CancelHold(Guid bookingId)
    {
        lock (gate)
        {
            if (bookings.TryGetValue(bookingId, out var booking) && booking.Status == "Held")
                bookings.Remove(bookingId);
        }
    }
}
