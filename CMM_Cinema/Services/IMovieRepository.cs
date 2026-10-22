using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Controllers depend only on this interface. Swap DemoMovieRepository for a
// Cloudflare D1-backed implementation in Program.cs when the database is ready.
public interface IMovieRepository
{
    Task<IReadOnlyList<Movie>> GetByStatusAsync(MovieStatus status, CancellationToken cancellationToken = default);
    Task<Movie?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
}
