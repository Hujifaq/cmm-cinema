namespace CMM_Cinema.Models;

public record MovieSectionViewModel(
    string Id,
    string Title,
    bool Overlap,
    IReadOnlyList<Movie> Movies);
