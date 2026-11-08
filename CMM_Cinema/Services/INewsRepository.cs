using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

public interface INewsRepository
{

    Task<IReadOnlyList<NewsStory>> GetStoriesAsync(CancellationToken cancellationToken = default);
}
