namespace CMM_Cinema.Models;

public record Ticket(
    string BookingCode,
    Movie Movie,
    string Cinema,
    string Hall,
    DateTime Showtime,
    string Format,
    IReadOnlyList<string> Seats)
{
    public bool IsPast => Showtime < DateTime.Now;
    public string Url => $"/MyTickets/{BookingCode}/{Movie.Slug}";
}

public record MyTicketsViewModel(IReadOnlyList<Ticket> Upcoming, IReadOnlyList<Ticket> Past);
