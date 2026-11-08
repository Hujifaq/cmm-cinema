using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Fallback used when the Cloudflare settings are missing, so the site still starts with no movies.
public sealed class EmptyMovieRepository : IMovieRepository
{
    public Task<IReadOnlyList<Movie>> GetByStatusAsync(MovieStatus status, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Movie>>([]);

    public Task<Movie?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        Task.FromResult<Movie?>(null);

    public Task<IReadOnlyList<Movie>> SearchAsync(string query, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Movie>>([]);

    public Task<MovieSaveResult> CreateAsync(MovieForm form, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Movies can't be edited until Cloudflare D1 is configured.");

    public Task<MovieSaveResult> UpdateAsync(int id, MovieForm form, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Movies can't be edited until Cloudflare D1 is configured.");

    public Task<bool> ArchiveAsync(int id, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Movies can't be edited until Cloudflare D1 is configured.");
}
