using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Used when Cloudflare D1 is not configured. Everything lives in memory, so a restart clears every booking.
// Nothing here charges money. Registered as a singleton, so all state sits behind one lock.
public sealed class DemoBookingService : IBookingService
{
    private readonly Lock gate = new();
    private readonly Dictionary<int, Showtime> showtimesById = [];
    private readonly Dictionary<(string Slug, DateOnly Date), Showtime[]> showtimesByDay = [];
    private readonly Dictionary<Guid, BookingHold> bookings = [];
    private readonly Dictionary<int, BookingDraft> drafts = [];

    public Task<IReadOnlyList<Showtime>> GetShowtimesAsync(string movieSlug, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            IReadOnlyList<Showtime> showtimes = BookingRules.GetDates().SelectMany(date => GetOrCreateDay(movieSlug, date)).ToArray();
            return Task.FromResult(showtimes);
        }
    }

    public Task<Showtime?> GetShowtimeAsync(int showtimeId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            return Task.FromResult(showtimesById.GetValueOrDefault(showtimeId));
        }
    }

    public Task<IReadOnlyList<Seat>> GetSeatsAsync(int showtimeId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            RemoveExpired();
            return Task.FromResult(showtimesById.ContainsKey(showtimeId) ? SeatMap(showtimeId) : []);
        }
    }

    public Task<HoldResult> HoldSeatsAsync(int ownerId, int showtimeId, IEnumerable<string> seatIds, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            RemoveExpired();
            if (!showtimesById.TryGetValue(showtimeId, out var showtime) || !showtime.IsAvailable)
                return Task.FromResult(new HoldResult(null, "This screening is unavailable."));
            if (!BookingRules.TryValidateSelection(SeatMap(showtimeId), seatIds, out var seats, out var error))
                return Task.FromResult(new HoldResult(null, error));

            var booking = new BookingHold(Guid.NewGuid(), ownerId, showtimeId, seats,
                DateTimeOffset.UtcNow + BookingRules.HoldLength, BookingStatus.Held);
            bookings.Add(booking.Id, booking);
            return Task.FromResult(new HoldResult(booking, ""));
        }
    }

    public Task<BookingHold?> GetBookingAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            RemoveExpired();
            return Task.FromResult(FindOwned(ownerId, bookingId));
        }
    }

    public Task<ConfirmResult> ConfirmBookingAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            RemoveExpired();
            if (FindOwned(ownerId, bookingId) is not { } booking)
                return Task.FromResult(new ConfirmResult(false, "Booking has expired or is unavailable."));

            // Held seats are already blocked for everyone else, so confirming only changes the status. Repeating it is safe.
            bookings[bookingId] = booking with { Status = BookingStatus.Confirmed, TicketToken = booking.TicketToken ?? BookingRules.NewTicketToken() };
            return Task.FromResult(new ConfirmResult(true, ""));
        }
    }

    public Task CancelHoldAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            if (FindOwned(ownerId, bookingId) is { Status: BookingStatus.Held })
                bookings.Remove(bookingId);
        }
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<BookingHold>> GetConfirmedBookingsAsync(int ownerId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            IReadOnlyList<BookingHold> confirmed = bookings.Values
                .Where(booking => booking.OwnerId == ownerId && booking.Status == BookingStatus.Confirmed).ToArray();
            return Task.FromResult(confirmed);
        }
    }

    public Task<BookingHold?> GetBookingByTicketTokenAsync(string ticketToken, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            return Task.FromResult(BookingRules.IsTicketToken(ticketToken)
                ? bookings.Values.FirstOrDefault(b => b.Status == BookingStatus.Confirmed && b.TicketToken == ticketToken)
                : null);
        }
    }

    public Task<string?> EnsureTicketTokenAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            if (FindOwned(ownerId, bookingId) is not { Status: BookingStatus.Confirmed } booking) return Task.FromResult<string?>(null);
            if (booking.TicketToken is null)
            {
                booking = booking with { TicketToken = BookingRules.NewTicketToken() };
                bookings[bookingId] = booking;
            }
            return Task.FromResult<string?>(booking.TicketToken);
        }
    }

    public Task<BookingDraft?> StartDraftAsync(int ownerId, int showtimeId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            RemoveExpired();
            var kept = drafts.TryGetValue(ownerId, out var existing) && existing.ShowtimeId == showtimeId ? existing.SeatIds : [];
            return Task.FromResult(StoreDraft(ownerId, showtimeId, kept));
        }
    }

    public Task<BookingDraft?> SaveDraftSeatsAsync(int ownerId, int showtimeId, IEnumerable<string> seatIds, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            RemoveExpired();
            return Task.FromResult(StoreDraft(ownerId, showtimeId, seatIds));
        }
    }

    public Task ClearDraftAsync(int ownerId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            drafts.Remove(ownerId);
        }
        return Task.CompletedTask;
    }

    private BookingDraft? StoreDraft(int ownerId, int showtimeId, IEnumerable<string> seatIds)
    {
        if (!showtimesById.TryGetValue(showtimeId, out var showtime) || !showtime.IsAvailable) return null;
        var draft = new BookingDraft(ownerId, showtimeId, BookingRules.CleanDraftSeats(SeatMap(showtimeId), seatIds),
            DateTimeOffset.UtcNow + BookingRules.DraftLength);
        drafts[ownerId] = draft;
        return draft;
    }

    private IReadOnlyList<Seat> SeatMap(int showtimeId)
    {
        var taken = bookings.Values.Where(booking => booking.ShowtimeId == showtimeId)
            .SelectMany(booking => booking.Seats).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return BookingRules.CreateSeatMap(taken.Contains);
    }

    private BookingHold? FindOwned(int ownerId, Guid bookingId) =>
        bookings.TryGetValue(bookingId, out var booking) && booking.OwnerId == ownerId ? booking : null;

    // Showtimes are created the first time a movie and day are asked for, then kept so their ids stay stable.
    private Showtime[] GetOrCreateDay(string movieSlug, DateOnly date)
    {
        var key = (movieSlug.ToLowerInvariant(), date);
        if (showtimesByDay.TryGetValue(key, out var day)) return day;

        var created = new List<Showtime>();
        foreach (var planned in BookingRules.PlanDay(movieSlug, date))
        {
            var showtime = planned with { Id = showtimesById.Count + 1 };
            showtimesById.Add(showtime.Id, showtime);
            created.Add(showtime);
        }
        day = created.ToArray();
        showtimesByDay.Add(key, day);
        return day;
    }

    private void RemoveExpired()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var id in bookings.Values.Where(b => b.Status == BookingStatus.Held && b.ExpiresAt <= now).Select(b => b.Id).ToArray())
            bookings.Remove(id);
        foreach (var owner in drafts.Where(d => d.Value.ExpiresAt <= now).Select(d => d.Key).ToArray())
            drafts.Remove(owner);
    }
}
