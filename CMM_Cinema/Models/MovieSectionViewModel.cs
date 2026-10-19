namespace CMM_Cinema.Models;

public record MovieCard(string Title, string Poster, string Duration, string Genre, string Rating, string Bg, string Text, string Badge, string Art, string Synopsis);

public record MovieSectionViewModel(string Id, string Title, bool Overlap, IReadOnlyList<MovieCard> Movies);
