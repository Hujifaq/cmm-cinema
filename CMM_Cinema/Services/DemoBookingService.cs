using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

public sealed class DemoBookingService : IBookingService
{
    private const string Rows = "ABCDEFGHIJ";
    private const int SeatsPerRow = 16;
    private const int MaxSeatsPerBooking = 8;
    private const int DaysAhead = 7;
    private static readonly TimeSpan HoldLength = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan BangkokOffset = TimeSpan.FromHours(7);

    private static readonly Cinema[] Cinemas = [new(1, "CMM Central Mall"), new(2, "CMM CB12")];
    private static readonly (string Format, string Language)[] Screenings =
        [("2D", "English"), ("2D", "Thai (Sub)"), ("3D", "English"), ("IMAX", "English")];
    private static readonly int[] StartHours = [13, 16, 19];
    
    private static readonly HashSet<string> PresoldSeats = new(StringComparer.OrdinalIgnoreCase) { "A3", "B5", "D11", "F14", "H7", "J2" };

    private readonly Lock gate = new();
    private readonly Dictionary<int, Showtime> showtimesById = [];
    private readonly Dictionary<(string Slug, DateOnly Date), Showtime[]> showtimesByDay = [];
    private readonly Dictionary<Guid, BookingHold> bookings = [];
    private readonly Dictionary<int, HashSet<string>> soldSeats = [];

    public IReadOnlyList<string> Formats { get; } = ["2D", "3D", "IMAX"];
    public IReadOnlyList<string> Languages { get; } = ["English", "Thai (Sub)"];

    public IReadOnlyList<Cinema> GetCinemas() => Cinemas;

    public Cinema? GetCinema(int cinemaId) => Cinemas.FirstOrDefault(cinema => cinema.Id == cinemaId);

    public IReadOnlyList<DateOnly> GetDates()
    {
        var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(BangkokOffset).DateTime);
        return Enumerable.Range(0, DaysAhead).Select(today.AddDays).ToArray();
    }

    public IReadOnlyList<Showtime> GetShowtimes(string movieSlug)
    {
        lock (gate)
        {
            return GetDates().SelectMany(date => GetOrCreateDay(movieSlug, date)).ToArray();
        }
    }

    public Showtime? GetShowtime(int showtimeId)
    {
        lock (gate)
        {
            return showtimesById.GetValueOrDefault(showtimeId);
        }
    }

    public decimal GetSeatPrice(Showtime showtime) => showtime.Format switch
    {
        "IMAX" => 400m,
        "3D" => 300m,
        _ => 250m,
    };

    public IReadOnlyList<Seat> GetSeats(int showtimeId)
    {
        lock (gate)
        {
            RemoveExpiredHolds();
            if (!showtimesById.ContainsKey(showtimeId)) return [];

            return (from row in Rows
                    from number in Enumerable.Range(1, SeatsPerRow)
                    let id = $"{row}{number}"
                    select new Seat(id, row, number, IsTaken(showtimeId, id) ? SeatState.Sold : SeatState.Available))
                .ToArray();
        }
    }

    public bool TryHoldSeats(int showtimeId, IEnumerable<string> seatIds, out BookingHold? booking, out string error)
    {
        booking = null;
        var seats = seatIds.Select(id => (id ?? "").Trim().ToUpperInvariant()).Distinct().ToArray();

        lock (gate)
        {
            RemoveExpiredHolds();

            if (!showtimesById.TryGetValue(showtimeId, out var showtime) || !showtime.IsAvailable)
            {
                error = "This screening is unavailable.";
                return false;
            }
            if (seats.Length is < 1 or > MaxSeatsPerBooking)
            {
                error = $"Please select between 1 and {MaxSeatsPerBooking} seats.";
                return false;
            }
            if (!seats.All(IsValidSeatId))
            {
                error = "The selected seat list is invalid.";
                return false;
            }
            if (seats.Any(id => IsTaken(showtimeId, id)))
            {
                error = "One or more seats are no longer available. Please choose again.";
                return false;
            }

            var ordered = seats.OrderBy(id => id[0]).ThenBy(id => int.Parse(id[1..])).ToArray();
            booking = new BookingHold(Guid.NewGuid(), showtimeId, ordered, GetSeatPrice(showtime),
                DateTimeOffset.UtcNow + HoldLength, BookingStatus.Held);
            bookings.Add(booking.Id, booking);
            error = "";
            return true;
        }
    }

    public BookingHold? GetBooking(Guid bookingId)
    {
        lock (gate)
        {
            RemoveExpiredHolds();
            return bookings.GetValueOrDefault(bookingId);
        }
    }

    public bool TryConfirmPayment(Guid bookingId, string paymentMethod, out string error)
    {
        if (paymentMethod is not ("card" or "promptpay"))
        {
            error = "Choose a payment method.";
            return false;
        }

        lock (gate)
        {
            RemoveExpiredHolds();

            if (!bookings.TryGetValue(bookingId, out var booking) || booking.Status != BookingStatus.Held)
            {
                error = "Booking has expired or is already complete.";
                return false;
            }

            if (!soldSeats.TryGetValue(booking.ShowtimeId, out var sold))
            {
                sold = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                soldSeats[booking.ShowtimeId] = sold;
            }
            if (booking.Seats.Any(sold.Contains))
            {
                error = "One of the selected seats is already sold.";
                return false;
            }

            sold.UnionWith(booking.Seats);
            bookings[bookingId] = booking with { Status = BookingStatus.Confirmed, PaymentMethod = paymentMethod };
            error = "";
            return true;
        }
    }

    public void CancelHold(Guid bookingId)
    {
        lock (gate)
        {
            if (bookings.TryGetValue(bookingId, out var booking) && booking.Status == BookingStatus.Held)
                bookings.Remove(bookingId);
        }
    }

   
    private Showtime[] GetOrCreateDay(string movieSlug, DateOnly date)
    {
        var key = (movieSlug.ToLowerInvariant(), date);
        if (showtimesByDay.TryGetValue(key, out var day)) return day;

        var created = new List<Showtime>();
        foreach (var cinema in Cinemas)
        {
            for (var screening = 0; screening < Screenings.Length; screening++)
            {
                foreach (var hour in StartHours)
                {
                    var id = showtimesById.Count + 1;
                   
                    var isAvailable = (date.DayNumber + cinema.Id * 3 + screening * 5 + hour) % 7 != 0;
                    var showtime = new Showtime(id, key.Item1, cinema.Id, date, new TimeOnly(hour, 0),
                        Screenings[screening].Format, Screenings[screening].Language, isAvailable);
                    showtimesById.Add(id, showtime);
                    created.Add(showtime);
                }
            }
        }

        day = created.ToArray();
        showtimesByDay.Add(key, day);
        return day;
    }

    private bool IsTaken(int showtimeId, string seatId) =>
        PresoldSeats.Contains(seatId)
        || soldSeats.GetValueOrDefault(showtimeId)?.Contains(seatId) == true
        || bookings.Values.Any(booking => booking.ShowtimeId == showtimeId
            && booking.Status == BookingStatus.Held
            && booking.Seats.Contains(seatId, StringComparer.OrdinalIgnoreCase));

    private static bool IsValidSeatId(string seatId) =>
        seatId.Length is 2 or 3
        && Rows.Contains(seatId[0])
        && int.TryParse(seatId[1..], out var number)
        && number is >= 1 and <= SeatsPerRow;

    private void RemoveExpiredHolds()
    {
        var now = DateTimeOffset.UtcNow;
        var expired = bookings.Values
            .Where(booking => booking.Status == BookingStatus.Held && booking.ExpiresAt <= now)
            .Select(booking => booking.Id)
            .ToArray();
        foreach (var id in expired) bookings.Remove(id);
    }
}
