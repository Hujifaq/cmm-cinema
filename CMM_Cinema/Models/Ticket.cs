namespace CMM_Cinema.Models;

public record Ticket(
    string BookingCode,
    Movie Movie,
    string Cinema,
    string Hall,
    DateTime Showtime,
    string Format,
    IReadOnlyList<string> Seats,
    string? TicketToken = null)
{
    public bool IsPast => Showtime < CinemaTime.Now;
    public string Url => $"/MyTickets/{BookingCode}/{Movie.Slug}";
}

public enum TicketPassStatus { Upcoming, Today, Ended }

// The public page a ticket's QR code opens. It carries no buyer details and no price.
public record TicketPassViewModel(Ticket Ticket, string Language, int Admissions, TicketPassStatus Status);

public record MyTicketsViewModel(IReadOnlyList<Ticket> Upcoming, IReadOnlyList<Ticket> Past);
