using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Controllers depend only on this interface; Program.cs picks D1MovieRepository or the empty fallback.
public interface IMovieRepository
{
    Task<IReadOnlyList<Movie>> GetByStatusAsync(MovieStatus status, CancellationToken cancellationToken = default);
    Task<Movie?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Movie>> SearchAsync(string query, int limit, CancellationToken cancellationToken = default);
}
