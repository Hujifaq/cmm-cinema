namespace CMM_Cinema.ViewModels.Booking;

public sealed record MovieOption(int Id, string Title, string Genre, int DurationMinutes,
    string Rating, string Synopsis);
public sealed record CinemaOption(int Id, string Name);
public sealed record ShowtimeOption(int Id, int MovieId, int CinemaId, DateOnly Date,
    TimeOnly Time, string Format, string Language, bool IsAvailable);

public sealed class ShowtimesViewModel
{
    public required IReadOnlyList<MovieOption> Movies { get; init; }
    public required MovieOption Movie { get; init; }
    public required IReadOnlyList<CinemaOption> Cinemas { get; init; }
    public required IReadOnlyList<DateOnly> Dates { get; init; }
    public required IReadOnlyList<ShowtimeOption> Showtimes { get; init; }
    public DateOnly SelectedDate { get; init; }
    public int? CinemaId { get; init; }
    public string? Format { get; init; }
    public string? Language { get; init; }
}

public sealed record SeatSelectionPlaceholderViewModel(MovieOption Movie,
    CinemaOption Cinema, ShowtimeOption Showtime);
