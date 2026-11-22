using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

public sealed class TicketBuilder(IBookingService booking, IMovieRepository movies)
{
    public async Task<Ticket?> BuildAsync(BookingHold hold, CancellationToken cancellationToken = default)
    {
        if (await booking.GetShowtimeAsync(hold.ShowtimeId, cancellationToken) is not { } showtime) return null;
        if (await movies.GetBySlugIncludingArchivedAsync(showtime.MovieSlug, cancellationToken) is not { } movie) return null;

        var token = hold.TicketToken ?? await booking.EnsureTicketTokenAsync(hold.OwnerId, hold.Id, cancellationToken);
        return new Ticket(hold.Reference, movie, BookingRules.GetCinema(showtime.CinemaId)?.Name ?? "CMM Cinema",
            BookingRules.HallFor(showtime), showtime.StartsAt, showtime.Format,
            BookingRules.TicketSeatLabels(hold), token, hold.Id);
    }

    public async Task<List<Ticket>> BuildAllAsync(IEnumerable<BookingHold> holds, CancellationToken cancellationToken = default)
    {
        var tickets = new List<Ticket>();
        foreach (var hold in holds)
            if (await BuildAsync(hold, cancellationToken) is { } ticket) tickets.Add(ticket);
        return tickets;
    }
}
