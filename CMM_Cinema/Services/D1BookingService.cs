using System.Globalization;
using System.Text;
using System.Text.Json;
using CMM_Cinema.Models;
using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;

// D1 runs one statement per request with no transactions, so a hold inserts all its seats in one statement
// and relies on UNIQUE (showtime_id, seat_id): if any seat is already taken, the booking is deleted again.
public sealed class D1BookingService(D1Client d1, IMemoryCache cache) : IBookingService
{
    private const string ShowtimeColumns = "id, movie_slug, cinema_id, show_date, start_time, format, language, is_available";
    private const string BookingColumns =
        "b.id, b.user_id, b.showtime_id, b.status, b.expires_at, b.ticket_token, s.seat_id, s.category, s.price, s.capacity";
    private static readonly TimeSpan ShowtimeCacheLifetime = TimeSpan.FromHours(1);
    private static readonly TimeSpan PurgeInterval = TimeSpan.FromMinutes(10);
    private static long nextPurgeTicks;

    private readonly Dictionary<int, IReadOnlyList<Seat>> seatMaps = [];

    public async Task<IReadOnlyList<Showtime>> GetShowtimesAsync(string movieSlug, CancellationToken cancellationToken = default)
    {
        var slug = movieSlug.ToLowerInvariant();
        var dates = BookingRules.GetDates();
        var showtimes = await SelectShowtimesAsync(slug, dates, cancellationToken);
        if (showtimes.Count >= dates.Count * BookingRules.ShowtimesPerDay) return showtimes;

        await CreateShowtimesAsync(slug, dates, cancellationToken);
        return await SelectShowtimesAsync(slug, dates, cancellationToken);
    }

    public async Task<Showtime?> GetShowtimeAsync(int showtimeId, CancellationToken cancellationToken = default)
    {
        var key = $"d1:showtime:{showtimeId}";
        if (cache.TryGetValue(key, out Showtime? cached)) return cached;

        var rows = await d1.QueryAsync($"SELECT {ShowtimeColumns} FROM showtimes WHERE id = ?", [showtimeId], cancellationToken);
        if (rows.Count == 0) return null;
        var showtime = MapShowtime(rows[0]);
        cache.Set(key, showtime, ShowtimeCacheLifetime);
        return showtime;
    }

    public async Task<IReadOnlyList<Seat>> GetSeatsAsync(int showtimeId, CancellationToken cancellationToken = default) =>
        await GetShowtimeAsync(showtimeId, cancellationToken) is null ? [] : await SeatMapAsync(showtimeId, cancellationToken);

    public async Task<HoldResult> HoldSeatsAsync(int ownerId, int showtimeId, IEnumerable<string> seatIds, CancellationToken cancellationToken = default)
    {
        if (await GetShowtimeAsync(showtimeId, cancellationToken) is not { IsBookable: true })
            return new HoldResult(null, "This screening is unavailable.");

        await ReleaseExpiredHoldsAsync(showtimeId, cancellationToken);
        seatMaps.Remove(showtimeId);
        if (!BookingRules.TryValidateSelection(await SeatMapAsync(showtimeId, cancellationToken), seatIds, out var seats, out var error))
            return new HoldResult(null, error);

        var now = DateTimeOffset.UtcNow;
        var booking = new BookingHold(Guid.NewGuid(), ownerId, showtimeId, seats, now + BookingRules.HoldLength, BookingStatus.Held);
        await d1.QueryAsync(
            "INSERT INTO bookings (id, user_id, showtime_id, status, expires_at, created_at) VALUES (?, ?, ?, 'held', ?, ?)",
            [Id(booking.Id), ownerId, showtimeId, D1Time.Format(booking.ExpiresAt), D1Time.Format(now)], cancellationToken);

        var values = string.Join(", ", seats.Select(_ => "(?, ?, ?, ?, ?, ?, ?)"));
        var parameters = seats.SelectMany((seat, position) => new object?[]
            { Id(booking.Id), showtimeId, seat.Id, position, seat.Category.ToString(), (int)seat.Price, seat.Capacity }).ToArray();
        var inserted = await d1.QueryAsync(
            $"INSERT INTO booking_seats (booking_id, showtime_id, seat_id, position, category, price, capacity) VALUES {values} " +
            "ON CONFLICT DO NOTHING RETURNING seat_id", parameters, cancellationToken);
        seatMaps.Remove(showtimeId);

        if (inserted.Count == seats.Count) return new HoldResult(booking, "");

        await DeleteBookingAsync("id = ?", [Id(booking.Id)], cancellationToken);
        return new HoldResult(null, "One or more seats are no longer available. Please choose again.");
    }

    public async Task<BookingHold?> GetBookingAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync(
            $"SELECT {BookingColumns} FROM bookings b JOIN booking_seats s ON s.booking_id = b.id " +
            "WHERE b.id = ? AND b.user_id = ? AND (b.status = 'confirmed' OR b.expires_at > ?) ORDER BY s.position",
            [Id(bookingId), ownerId, D1Time.Now()], cancellationToken);
        return MapBookings(rows).FirstOrDefault();
    }

    public async Task<ConfirmResult> ConfirmBookingAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        if (await GetBookingAsync(ownerId, bookingId, cancellationToken) is { Status: BookingStatus.Held } held
            && await GetShowtimeAsync(held.ShowtimeId, cancellationToken) is { HasStarted: true })
            return new ConfirmResult(false, BookingRules.ShowtimeStartedError);

        var now = D1Time.Now();
        var updated = await d1.QueryAsync(
            "UPDATE bookings SET status = 'confirmed', confirmed_at = ?, ticket_token = COALESCE(ticket_token, ?) " +
            "WHERE id = ? AND user_id = ? AND status = 'held' AND expires_at > ? RETURNING id",
            [now, BookingRules.NewTicketToken(), Id(bookingId), ownerId, now], cancellationToken);
        if (updated.Count == 1) return new ConfirmResult(true, "");

        // Repeated confirmation of the same booking is safe and has no extra effect.
        return await GetBookingAsync(ownerId, bookingId, cancellationToken) is { Status: BookingStatus.Confirmed }
            ? new ConfirmResult(true, "")
            : new ConfirmResult(false, "Booking has expired or is unavailable.");
    }

    public async Task CancelHoldAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default) =>
        await DeleteBookingAsync("id = ? AND user_id = ? AND status = 'held'", [Id(bookingId), ownerId], cancellationToken);

    public async Task<IReadOnlyList<BookingHold>> GetConfirmedBookingsAsync(int ownerId, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync(
            $"SELECT {BookingColumns} FROM bookings b JOIN booking_seats s ON s.booking_id = b.id " +
            "WHERE b.user_id = ? AND b.status = 'confirmed' ORDER BY b.created_at, s.position",
            [ownerId], cancellationToken);
        return MapBookings(rows);
    }

    public async Task<BookingHold?> GetBookingByTicketTokenAsync(string ticketToken, CancellationToken cancellationToken = default)
    {
        if (!BookingRules.IsTicketToken(ticketToken)) return null;
        var rows = await d1.QueryAsync(
            $"SELECT {BookingColumns} FROM bookings b JOIN booking_seats s ON s.booking_id = b.id " +
            "WHERE b.ticket_token = ? AND b.status = 'confirmed' ORDER BY s.position",
            [ticketToken], cancellationToken);
        return MapBookings(rows).FirstOrDefault();
    }

    public async Task<string?> EnsureTicketTokenAsync(int ownerId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync(
            "UPDATE bookings SET ticket_token = COALESCE(ticket_token, ?) " +
            "WHERE id = ? AND user_id = ? AND status = 'confirmed' RETURNING ticket_token",
            [BookingRules.NewTicketToken(), Id(bookingId), ownerId], cancellationToken);
        return rows.Count == 0 ? null : Text(rows[0], "ticket_token");
    }

    public async Task<IReadOnlyList<BookingHold>> GetAllConfirmedBookingsAsync(CancellationToken cancellationToken = default) =>
        MapBookings(await d1.QueryAsync(
            $"SELECT {BookingColumns} FROM bookings b JOIN booking_seats s ON s.booking_id = b.id " +
            "WHERE b.status = 'confirmed' ORDER BY b.created_at DESC, s.position",
            cancellationToken: cancellationToken));

    public async Task<BookingHold?> GetConfirmedBookingAsync(Guid bookingId, CancellationToken cancellationToken = default) =>
        MapBookings(await d1.QueryAsync(
            $"SELECT {BookingColumns} FROM bookings b JOIN booking_seats s ON s.booking_id = b.id " +
            "WHERE b.id = ? AND b.status = 'confirmed' ORDER BY s.position",
            [Id(bookingId)], cancellationToken)).FirstOrDefault();

    // New seats go in under a placeholder hold first, so the booking never gives up its seats until the new ones are secured.
    public async Task<HoldResult> ChangeConfirmedBookingAsync(Guid bookingId, int showtimeId, IEnumerable<string> seatIds, CancellationToken cancellationToken = default)
    {
        if (await GetConfirmedBookingAsync(bookingId, cancellationToken) is not { } booking)
            return new HoldResult(null, "This ticket no longer exists.");
        var current = await GetShowtimeAsync(booking.ShowtimeId, cancellationToken);
        if (await GetShowtimeAsync(showtimeId, cancellationToken) is not { IsBookable: true } target
            || current is null || !string.Equals(current.MovieSlug, target.MovieSlug, StringComparison.OrdinalIgnoreCase))
            return new HoldResult(null, BookingRules.ChangeShowtimeError);

        await ReleaseExpiredHoldsAsync(showtimeId, cancellationToken);
        seatMaps.Remove(showtimeId);
        var seatMap = BookingRules.ReleaseSeats(await SeatMapAsync(showtimeId, cancellationToken), booking, showtimeId);
        if (!BookingRules.TryValidateSelection(seatMap, seatIds, out var seats, out var error))
            return new HoldResult(null, error);

        var sameShowtime = booking.ShowtimeId == showtimeId;
        var chosen = seats.Select(seat => seat.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var kept = sameShowtime ? booking.Seats.Where(chosen.Contains).ToHashSet(StringComparer.OrdinalIgnoreCase) : [];
        var added = seats.Where(seat => !kept.Contains(seat.Id)).ToArray();
        var removed = booking.Seats.Where(id => !kept.Contains(id)).ToArray();
        var id = Id(bookingId);

        if (added.Length > 0)
        {
            var placeholder = Id(Guid.NewGuid());
            var now = DateTimeOffset.UtcNow;
            await d1.QueryAsync(
                "INSERT INTO bookings (id, user_id, showtime_id, status, expires_at, created_at) VALUES (?, ?, ?, 'held', ?, ?)",
                [placeholder, booking.OwnerId, showtimeId, D1Time.Format(now + TimeSpan.FromMinutes(1)), D1Time.Format(now)], cancellationToken);
            var values = string.Join(", ", added.Select(_ => "(?, ?, ?, ?, ?, ?, ?)"));
            var parameters = added.SelectMany(seat => new object?[]
                { placeholder, showtimeId, seat.Id, 0, seat.Category.ToString(), (int)seat.Price, seat.Capacity }).ToArray();
            var inserted = await d1.QueryAsync(
                $"INSERT INTO booking_seats (booking_id, showtime_id, seat_id, position, category, price, capacity) VALUES {values} " +
                "ON CONFLICT DO NOTHING RETURNING seat_id", parameters, cancellationToken);
            if (inserted.Count != added.Length)
            {
                await DeleteBookingAsync("id = ?", [placeholder], cancellationToken);
                return new HoldResult(null, "One or more seats are no longer available. Please choose again.");
            }

            await RemoveSeatsAsync(id, removed, cancellationToken);
            await d1.QueryAsync("UPDATE booking_seats SET booking_id = ? WHERE booking_id = ?", [id, placeholder], cancellationToken);
            await d1.QueryAsync("DELETE FROM bookings WHERE id = ?", [placeholder], cancellationToken);
        }
        else
        {
            await RemoveSeatsAsync(id, removed, cancellationToken);
        }

        var order = string.Join(" ", seats.Select(_ => "WHEN ? THEN ?"));
        await d1.QueryAsync(
            $"UPDATE booking_seats SET position = CASE seat_id {order} ELSE position END WHERE booking_id = ?",
            [.. seats.SelectMany((seat, position) => new object?[] { seat.Id, position }), id], cancellationToken);
        await d1.QueryAsync("UPDATE bookings SET showtime_id = ? WHERE id = ?", [showtimeId, id], cancellationToken);
        seatMaps.Clear();

        return new HoldResult(booking with { ShowtimeId = showtimeId, SeatItems = seats }, "");
    }

    public async Task<bool> CancelConfirmedBookingAsync(Guid bookingId, CancellationToken cancellationToken = default)
    {
        if (await GetConfirmedBookingAsync(bookingId, cancellationToken) is null) return false;
        await DeleteBookingAsync("id = ? AND status = 'confirmed'", [Id(bookingId)], cancellationToken);
        return true;
    }

    private async Task RemoveSeatsAsync(string bookingId, IReadOnlyList<string> seatIds, CancellationToken cancellationToken)
    {
        if (seatIds.Count == 0) return;
        await d1.QueryAsync(
            $"DELETE FROM booking_seats WHERE booking_id = ? AND seat_id IN ({string.Join(", ", seatIds.Select(_ => "?"))})",
            [bookingId, .. seatIds], cancellationToken);
    }

    public async Task<BookingDraft?> StartDraftAsync(int ownerId, int showtimeId, CancellationToken cancellationToken = default)
    {
        if (await GetShowtimeAsync(showtimeId, cancellationToken) is not { IsBookable: true }) return null;
        await PurgeExpiredIfDueAsync(cancellationToken);

        // One upsert both starts the session and returns the picks kept from an unexpired session on the same showtime.
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now + BookingRules.DraftLength;
        var rows = await d1.QueryAsync(
            "INSERT INTO booking_drafts (user_id, showtime_id, seat_ids, expires_at) VALUES (?, ?, '', ?) " +
            "ON CONFLICT (user_id) DO UPDATE SET " +
            "seat_ids = CASE WHEN booking_drafts.showtime_id = excluded.showtime_id AND booking_drafts.expires_at > ? " +
            "THEN booking_drafts.seat_ids ELSE '' END, " +
            "showtime_id = excluded.showtime_id, expires_at = excluded.expires_at RETURNING seat_ids",
            [ownerId, showtimeId, D1Time.Format(expiresAt), D1Time.Format(now)], cancellationToken);

        var stored = SplitSeats(rows.Count == 0 ? null : Text(rows[0], "seat_ids"));
        var kept = BookingRules.CleanDraftSeats(await SeatMapAsync(showtimeId, cancellationToken), stored);
        if (kept.Count != stored.Count)
            await WriteDraftAsync(ownerId, showtimeId, kept, expiresAt, cancellationToken);
        return new BookingDraft(ownerId, showtimeId, kept, expiresAt);
    }

    public async Task<BookingDraft?> SaveDraftSeatsAsync(int ownerId, int showtimeId, IEnumerable<string> seatIds, CancellationToken cancellationToken = default)
    {
        if (await GetShowtimeAsync(showtimeId, cancellationToken) is not { IsBookable: true }) return null;
        var kept = BookingRules.CleanDraftSeats(await SeatMapAsync(showtimeId, cancellationToken), seatIds);
        var expiresAt = DateTimeOffset.UtcNow + BookingRules.DraftLength;
        await WriteDraftAsync(ownerId, showtimeId, kept, expiresAt, cancellationToken);
        return new BookingDraft(ownerId, showtimeId, kept, expiresAt);
    }

    public async Task ClearDraftAsync(int ownerId, CancellationToken cancellationToken = default) =>
        await d1.QueryAsync("DELETE FROM booking_drafts WHERE user_id = ?", [ownerId], cancellationToken);

    private async Task<IReadOnlyList<Showtime>> SelectShowtimesAsync(string slug, IReadOnlyList<DateOnly> dates, CancellationToken cancellationToken) =>
        (await d1.QueryAsync(
            $"SELECT {ShowtimeColumns} FROM showtimes WHERE movie_slug = ? AND show_date BETWEEN ? AND ? ORDER BY show_date, id",
            [slug, Date(dates[0]), Date(dates[^1])], cancellationToken))
        .Select(MapShowtime).ToArray();

    // Every value except the slug comes from BookingRules, so the rows are written inline to stay under D1's 100-parameter limit.
    private async Task CreateShowtimesAsync(string slug, IReadOnlyList<DateOnly> dates, CancellationToken cancellationToken)
    {
        var values = new StringBuilder();
        foreach (var showtime in dates.SelectMany(date => BookingRules.PlanDay(slug, date)))
        {
            if (values.Length > 0) values.Append(", ");
            values.Append(CultureInfo.InvariantCulture,
                $"(?1, {showtime.CinemaId}, {Literal(Date(showtime.Date))}, {Literal(Time(showtime.Time))}, " +
                $"{Literal(showtime.Format)}, {Literal(showtime.Language)}, {(showtime.IsAvailable ? 1 : 0)})");
        }
        await d1.QueryAsync(
            $"INSERT INTO showtimes (movie_slug, cinema_id, show_date, start_time, format, language, is_available) VALUES {values} " +
            "ON CONFLICT DO NOTHING", [slug], cancellationToken);
    }

    private async Task<IReadOnlyList<Seat>> SeatMapAsync(int showtimeId, CancellationToken cancellationToken)
    {
        if (seatMaps.TryGetValue(showtimeId, out var map)) return map;
        var taken = (await d1.QueryAsync(
                "SELECT s.seat_id FROM booking_seats s JOIN bookings b ON b.id = s.booking_id " +
                "WHERE s.showtime_id = ? AND (b.status = 'confirmed' OR b.expires_at > ?)",
                [showtimeId, D1Time.Now()], cancellationToken))
            .Select(row => Text(row, "seat_id") ?? "").ToHashSet(StringComparer.OrdinalIgnoreCase);
        map = BookingRules.CreateSeatMap(taken.Contains);
        seatMaps[showtimeId] = map;
        return map;
    }

    private async Task WriteDraftAsync(int ownerId, int showtimeId, IReadOnlyList<string> seatIds, DateTimeOffset expiresAt, CancellationToken cancellationToken) =>
        await d1.QueryAsync(
            "INSERT INTO booking_drafts (user_id, showtime_id, seat_ids, expires_at) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT (user_id) DO UPDATE SET showtime_id = excluded.showtime_id, seat_ids = excluded.seat_ids, expires_at = excluded.expires_at",
            [ownerId, showtimeId, string.Join(',', seatIds), D1Time.Format(expiresAt)], cancellationToken);

    // Expired holds must go before new seats are inserted, or their rows would still trip the UNIQUE seat rule.
    private Task ReleaseExpiredHoldsAsync(int showtimeId, CancellationToken cancellationToken) =>
        DeleteBookingAsync("showtime_id = ? AND status = 'held' AND expires_at <= ?", [showtimeId, D1Time.Now()], cancellationToken);


    private async Task DeleteBookingAsync(string where, object?[] parameters, CancellationToken cancellationToken)
    {
        await d1.QueryAsync($"DELETE FROM booking_seats WHERE booking_id IN (SELECT id FROM bookings WHERE {where})", parameters, cancellationToken);
        await d1.QueryAsync($"DELETE FROM bookings WHERE {where}", parameters, cancellationToken);
        seatMaps.Clear();
    }

    private async Task PurgeExpiredIfDueAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var due = Interlocked.Read(ref nextPurgeTicks);
        if (now.UtcTicks < due || Interlocked.CompareExchange(ref nextPurgeTicks, (now + PurgeInterval).UtcTicks, due) != due) return;

        await DeleteBookingAsync("status = 'held' AND expires_at <= ?", [D1Time.Format(now)], cancellationToken);
        await d1.QueryAsync("DELETE FROM booking_drafts WHERE expires_at <= ?", [D1Time.Format(now)], cancellationToken);
    }

    private static IReadOnlyList<BookingHold> MapBookings(IReadOnlyList<JsonElement> rows) =>
        rows.GroupBy(row => Text(row, "id") ?? "")
            .Select(group =>
            {
                var first = group.First();
                var seats = group.Select(row => new BookedSeat(
                    Text(row, "seat_id") ?? "",
                    Enum.Parse<SeatCategory>(Text(row, "category") ?? nameof(SeatCategory.Normal)),
                    row.GetProperty("price").GetDecimal(),
                    row.GetProperty("capacity").GetInt32())).ToArray();
                return new BookingHold(
                    Guid.Parse(group.Key),
                    first.GetProperty("user_id").GetInt32(),
                    first.GetProperty("showtime_id").GetInt32(),
                    seats,
                    DateTimeOffset.Parse(Text(first, "expires_at") ?? "", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal),
                    Text(first, "status") == "confirmed" ? BookingStatus.Confirmed : BookingStatus.Held,
                    Text(first, "ticket_token"));
            })
            .ToArray();

    private static Showtime MapShowtime(JsonElement row) => new(
        row.GetProperty("id").GetInt32(),
        Text(row, "movie_slug") ?? "",
        row.GetProperty("cinema_id").GetInt32(),
        DateOnly.ParseExact(Text(row, "show_date") ?? "", "yyyy-MM-dd", CultureInfo.InvariantCulture),
        TimeOnly.ParseExact(Text(row, "start_time") ?? "", "HH:mm", CultureInfo.InvariantCulture),
        Text(row, "format") ?? "",
        Text(row, "language") ?? "",
        row.GetProperty("is_available").GetInt32() == 1);

    private static IReadOnlyList<string> SplitSeats(string? seatIds) =>
        string.IsNullOrEmpty(seatIds) ? [] : seatIds.Split(',', StringSplitOptions.RemoveEmptyEntries);

    private static string Id(Guid id) => id.ToString("D");
    private static string Date(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    private static string Time(TimeOnly time) => time.ToString("HH:mm", CultureInfo.InvariantCulture);
    private static string Literal(string value) => $"'{value.Replace("'", "''")}'";

    private static string? Text(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
