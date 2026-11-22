using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

public interface INewsRepository
{
    bool CanEdit { get; }
    Task<IReadOnlyList<NewsStory>> GetStoriesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<NewsAdminRow>> GetAdminRowsAsync(CancellationToken cancellationToken = default);
    Task<NewsForm?> GetFormAsync(int id, CancellationToken cancellationToken = default);
    Task<NewsSaveResult> CreateAsync(NewsForm form, CancellationToken cancellationToken = default);
    Task<NewsSaveResult> UpdateAsync(int id, NewsForm form, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}
