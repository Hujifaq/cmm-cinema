using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Used when Cloudflare D1 is not configured: the site shows no news and the admin pages are read-only.
public sealed class EmptyNewsRepository : INewsRepository
{
    public bool CanEdit => false;

    public Task<IReadOnlyList<NewsStory>> GetStoriesAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<NewsStory>>([]);

    public Task<IReadOnlyList<NewsAdminRow>> GetAdminRowsAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<NewsAdminRow>>([]);

    public Task<NewsForm?> GetFormAsync(int id, CancellationToken cancellationToken = default) => Task.FromResult<NewsForm?>(null);

    public Task<NewsSaveResult> CreateAsync(NewsForm form, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NewsSaveResult(NewsSaveStatus.Unavailable));

    public Task<NewsSaveResult> UpdateAsync(int id, NewsForm form, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NewsSaveResult(NewsSaveStatus.Unavailable));

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default) => Task.FromResult(false);
}
