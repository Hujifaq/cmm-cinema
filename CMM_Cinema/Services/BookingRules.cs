using CMM_Cinema.Models;

namespace CMM_Cinema.Services;


public static class BookingRules
{
    public const int MaxSeatsPerBooking = 8;
    public const int DaysAhead = 7;
    public static readonly TimeSpan HoldLength = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan DraftLength = TimeSpan.FromMinutes(20);
    public const string ShowtimeStartedError = "This screening has already started. Please pick another showtime.";

    private const string Rows = "ABCDEF";
    private const int SeatsPerRow = 16;
    private const int VipPairs = 8;

    public static readonly IReadOnlyList<Cinema> Cinemas = [new(1, "CMM Studio"), new(2, "CMM CB12")];
    public static readonly IReadOnlyList<(string Format, string Language)> Screenings = [("2D", "Thai"), ("IMAX", "Thai")];
    public static readonly IReadOnlyList<int> StartHours = [13, 16, 19];
    public static IReadOnlyList<string> Formats => Screenings.Select(s => s.Format).Distinct().ToArray();
    public static IReadOnlyList<string> Languages => Screenings.Select(s => s.Language).Distinct().ToArray();

    // A few seats start sold so the seat map does not look empty.
    private static readonly HashSet<string> PresoldSeats = new(StringComparer.OrdinalIgnoreCase) { "A3", "B5", "D11", "F14", "VP3" };

    public static Cinema? GetCinema(int cinemaId) => Cinemas.FirstOrDefault(cinema => cinema.Id == cinemaId);

    public static IReadOnlyList<DateOnly> GetDates()
    {
        var today = CinemaTime.Today;
        return Enumerable.Range(0, DaysAhead).Select(today.AddDays).ToArray();
    }

    // Every screening a movie has on one day, in display order. Ids are left at 0 for the caller to assign.
    public static IEnumerable<Showtime> PlanDay(string movieSlug, DateOnly date)
    {
        foreach (var cinema in Cinemas)
        {
            for (var screening = 0; screening < Screenings.Count; screening++)
            {
                foreach (var hour in StartHours)
                {
                    // Roughly one session in seven shows as full.
                    var isAvailable = (date.DayNumber + cinema.Id * 3 + screening * 5 + hour) % 7 != 0;
                    yield return new Showtime(0, movieSlug.ToLowerInvariant(), cinema.Id, date, new TimeOnly(hour, 0),
                        Screenings[screening].Format, Screenings[screening].Language, isAvailable);
                }
            }
        }
    }

    public static int ShowtimesPerDay => Cinemas.Count * Screenings.Count * StartHours.Count;

    public static string HallFor(Showtime showtime) =>
        showtime.Format == "IMAX" ? "IMAX Hall" : $"Hall {Math.Max(0, StartHours.ToList().IndexOf(showtime.Time.Hour)) + 1}";

    public static decimal GetSeatPrice(SeatCategory category) => category switch
    {
        SeatCategory.Premium => 330m,
        SeatCategory.Vip => 900m,
        _ => 300m,
    };

    public static IReadOnlyList<Seat> CreateSeatMap(Func<string, bool> isTaken)
    {
        var singles = from row in Rows
                      from number in Enumerable.Range(1, SeatsPerRow)
                      let id = $"{row}{number}"
                      let category = row <= 'C' ? SeatCategory.Premium : SeatCategory.Normal
                      select new Seat(id, row.ToString(), number, Taken(id) ? SeatState.Sold : SeatState.Available,
                          category, GetSeatPrice(category));
        var pairs = from number in Enumerable.Range(1, VipPairs)
                    let id = $"VP{number}"
                    select new Seat(id, "VP", number, Taken(id) ? SeatState.Sold : SeatState.Available,
                        SeatCategory.Vip, GetSeatPrice(SeatCategory.Vip), 2);
        return singles.Concat(pairs).ToArray();

        bool Taken(string id) => PresoldSeats.Contains(id) || isTaken(id);
    }

    public static IReadOnlyList<Seat> ReleaseSeats(IReadOnlyList<Seat> seatMap, BookingHold booking, int showtimeId)
    {
        if (booking.ShowtimeId != showtimeId) return seatMap;
        var own = booking.Seats.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return seatMap.Select(seat => own.Contains(seat.Id) ? seat with { State = SeatState.Available } : seat).ToArray();
    }

    public const string ChangeShowtimeError = "Pick an upcoming screening of the same movie.";

    // 128 random bits as 22 URL-safe characters, so a ticket URL cannot be guessed from its reference or another ticket.
    public static string NewTicketToken() =>
        System.Buffers.Text.Base64Url.EncodeToString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));

    public static bool IsTicketToken(string? value) =>
        value is { Length: 22 } && value.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    // Ticket seat list: a VIP pair is shown as both of its seats, e.g. "VP2 L", "VP2 R".
    public static IReadOnlyList<string> TicketSeatLabels(BookingHold booking) =>
        booking.SeatItems.SelectMany(seat => seat.Capacity == 2 ? [$"{seat.Id} L", $"{seat.Id} R"] : new[] { seat.Id }).ToArray();

    public static string[] Normalize(IEnumerable<string> seatIds) =>
        seatIds.Select(id => (id ?? "").Trim().ToUpperInvariant()).Distinct().ToArray();

    // Checks a hold request against the seat map; on success returns the seats in display order with their prices.
    public static bool TryValidateSelection(IReadOnlyList<Seat> seatMap, IEnumerable<string> seatIds,
        out IReadOnlyList<BookedSeat> seats, out string error)
    {
        seats = [];
        var requested = Normalize(seatIds);
        var byId = seatMap.ToDictionary(seat => seat.Id, StringComparer.OrdinalIgnoreCase);

        if (requested.Length is < 1 or > MaxSeatsPerBooking)
        {
            error = $"Please select between 1 and {MaxSeatsPerBooking} seats.";
            return false;
        }
        if (!requested.All(byId.ContainsKey))
        {
            error = "The selected seat list is invalid.";
            return false;
        }
        var selected = requested.Select(id => byId[id]).ToArray();
        if (selected.Sum(seat => seat.Capacity) > MaxSeatsPerBooking)
        {
            error = $"Please select up to {MaxSeatsPerBooking} admissions. Each VIP pair counts as 2 seats.";
            return false;
        }
        if (selected.Any(seat => seat.State == SeatState.Sold))
        {
            error = "One or more seats are no longer available. Please choose again.";
            return false;
        }

        seats = selected.OrderBy(seat => seat.Category).ThenByDescending(seat => seat.Row, StringComparer.Ordinal)
            .ThenBy(seat => seat.Number)
            .Select(seat => new BookedSeat(seat.Id, seat.Category, seat.Price, seat.Capacity)).ToArray();
        error = "";
        return true;
    }

    // Draft picks keep only seats that are still free, within the admission limit; nothing is rejected outright.
    public static IReadOnlyList<string> CleanDraftSeats(IReadOnlyList<Seat> seatMap, IEnumerable<string> seatIds)
    {
        var byId = seatMap.ToDictionary(seat => seat.Id, StringComparer.OrdinalIgnoreCase);
        var kept = new List<string>();
        var admissions = 0;
        foreach (var id in Normalize(seatIds))
        {
            if (!byId.TryGetValue(id, out var seat) || seat.State == SeatState.Sold
                || admissions + seat.Capacity > MaxSeatsPerBooking) continue;
            kept.Add(seat.Id);
            admissions += seat.Capacity;
        }
        return kept.AsReadOnly();
    }
}
