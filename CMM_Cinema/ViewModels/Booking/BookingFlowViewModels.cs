namespace CMM_Cinema.ViewModels.Booking;

public sealed record SeatOption(string Id, string Row, int Number, string State);

/// <summary>Ephemeral, demo-only seat hold; no real transaction or account ownership.</summary>
public sealed record BookingDraft(
    Guid Id, int ShowtimeId, IReadOnlyList<string> SeatIds, decimal PricePerSeat,
    DateTimeOffset HoldExpiresAt, string Status, string? PaymentMethod = null)
{
    public decimal Total => SeatIds.Count * PricePerSeat;
}

public sealed class SeatSelectionViewModel
{
    public required MovieOption Movie { get; init; }
    public required CinemaOption Cinema { get; init; }
    public required ShowtimeOption Showtime { get; init; }
    public required IReadOnlyList<SeatOption> Seats { get; init; }
    public decimal PricePerSeat { get; init; }
    public string? Error { get; init; }
}

public sealed class BookingDetailsViewModel
{
    public required BookingDraft Booking { get; init; }
    public required MovieOption Movie { get; init; }
    public required CinemaOption Cinema { get; init; }
    public required ShowtimeOption Showtime { get; init; }
}
