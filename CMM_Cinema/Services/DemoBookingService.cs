using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Demo only: showtimes are generated, and bookings live in memory, so a restart clears every booking.
// Nothing here charges money or issues a real ticket. Registered as a singleton, so all state sits behind one lock.
public sealed class DemoBookingService : IBookingService
{
    private const string Rows = "ABCDEF";
    private const int SeatsPerRow = 16;
    private const int VipPairs = 8;
    private const int MaxSeatsPerBooking = 8;
    private const int DaysAhead = 7;
    private static readonly TimeSpan HoldLength = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan BangkokOffset = TimeSpan.FromHours(7);

    private static readonly Cinema[] Cinemas = [new(1, "CMM Central Mall"), new(2, "CMM CB12")];
    private static readonly (string Format, string Language)[] Screenings =
        [("2D", "English"), ("2D", "Thai (Sub)"), ("3D", "English"), ("IMAX", "English")];
    private static readonly int[] StartHours = [13, 16, 19];
    // A few seats start sold so the seat map does not look empty.
    private static readonly HashSet<string> PresoldSeats = new(StringComparer.OrdinalIgnoreCase) { "A3", "B5", "D11", "F14", "VP3" };

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

    public decimal GetSeatPrice(Showtime showtime, SeatCategory category = SeatCategory.Normal) => category switch
    {
        SeatCategory.Premium => 330m,
        SeatCategory.Vip => 900m,
        _ => 300m,
    };

    public IReadOnlyList<Seat> GetSeats(int showtimeId)
    {
        lock (gate)
        {
            RemoveExpiredHolds();
            return showtimesById.TryGetValue(showtimeId, out var showtime) ? CreateSeatMap(showtime) : [];
        }
    }

    private Seat[] CreateSeatMap(Showtime showtime)
    {
        var singles = from row in Rows
                      from number in Enumerable.Range(1, SeatsPerRow)
                      let id = $"{row}{number}"
                      let category = row <= 'C' ? SeatCategory.Premium : SeatCategory.Normal
                      select new Seat(id, row.ToString(), number, IsTaken(showtime.Id, id) ? SeatState.Sold : SeatState.Available,
                          category, GetSeatPrice(showtime, category));
        var pairs = from number in Enumerable.Range(1, VipPairs)
                    let id = $"VP{number}"
                    select new Seat(id, "VP", number, IsTaken(showtime.Id, id) ? SeatState.Sold : SeatState.Available,
                        SeatCategory.Vip, GetSeatPrice(showtime, SeatCategory.Vip), 2);
        return singles.Concat(pairs).ToArray();
    }

    public bool TryHoldSeats(int ownerId, int showtimeId, IEnumerable<string> seatIds, out BookingHold? booking, out string error)
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
            var seatMap = CreateSeatMap(showtime).ToDictionary(seat => seat.Id, StringComparer.OrdinalIgnoreCase);
            if (!seats.All(seatMap.ContainsKey))
            {
                error = "The selected seat list is invalid.";
                return false;
            }
            var selected = seats.Select(id => seatMap[id]).ToArray();
            if (selected.Sum(seat => seat.Capacity) > MaxSeatsPerBooking)
            {
                error = "Please select up to 8 admissions. Each VIP pair counts as 2 seats.";
                return false;
            }
            if (selected.Any(seat => seat.State == SeatState.Sold))
            {
                error = "One or more seats are no longer available. Please choose again.";
                return false;
            }

            var ordered = selected.OrderBy(seat => seat.Category).ThenByDescending(seat => seat.Row, StringComparer.Ordinal)
                .ThenBy(seat => seat.Number)
                .Select(seat => new BookedSeat(seat.Id, seat.Category, seat.Price, seat.Capacity)).ToArray();
            booking = new BookingHold(Guid.NewGuid(), ownerId, showtimeId, Array.AsReadOnly(ordered),
                DateTimeOffset.UtcNow + HoldLength, BookingStatus.Held);
            bookings.Add(booking.Id, booking);
            error = "";
            return true;
        }
    }

    public BookingHold? GetBooking(int ownerId, Guid bookingId)
    {
        lock (gate)
        {
            RemoveExpiredHolds();
            return FindOwned(ownerId, bookingId);
        }
    }

    public bool TryConfirmBooking(int ownerId, Guid bookingId, out string error)
    {
        lock (gate)
        {
            RemoveExpiredHolds();

            if (FindOwned(ownerId, bookingId) is not { } booking)
            {
                error = "Booking has expired or is unavailable.";
                return false;
            }
            // Repeated confirmation of the same booking is safe and has no extra effect.
            if (booking.Status == BookingStatus.Confirmed)
            {
                error = "";
                return true;
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
            bookings[bookingId] = booking with { Status = BookingStatus.Confirmed };
            error = "";
            return true;
        }
    }

    public void CancelHold(int ownerId, Guid bookingId)
    {
        lock (gate)
        {
            if (FindOwned(ownerId, bookingId) is { Status: BookingStatus.Held })
                bookings.Remove(bookingId);
        }
    }

    private BookingHold? FindOwned(int ownerId, Guid bookingId) =>
        bookings.TryGetValue(bookingId, out var booking) && booking.OwnerId == ownerId ? booking : null;

    // Showtimes are created the first time a movie and day are asked for, then kept so their ids stay stable.
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
                    // Roughly one session in seven shows as full.
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
            && booking.SeatItems.Any(seat => string.Equals(seat.Id, seatId, StringComparison.OrdinalIgnoreCase)));

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
