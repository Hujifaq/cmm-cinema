using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

public sealed class EmptyPromotionRepository : IPromotionRepository
{
    public bool CanEdit => false;

    public Task<IReadOnlyList<Promotion>> GetActiveAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(BuiltInPromotions.All);

    public Task<IReadOnlyList<PromotionAdminRow>> GetAdminRowsAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<PromotionAdminRow>>(BuiltInPromotions.All.Select(p => new PromotionAdminRow(p.Id, p.ImageUrl, p.Alt, true)).ToArray());

    public Task<PromotionForm?> GetFormAsync(int id, CancellationToken cancellationToken = default) => Task.FromResult<PromotionForm?>(null);

    public Task<PromotionSaveResult> CreateAsync(PromotionForm form, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PromotionSaveResult(PromotionSaveStatus.Unavailable));

    public Task<PromotionSaveResult> UpdateAsync(int id, PromotionForm form, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PromotionSaveResult(PromotionSaveStatus.Unavailable));

    public Task<bool> MoveAsync(int id, int direction, CancellationToken cancellationToken = default) => Task.FromResult(false);

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default) => Task.FromResult(false);
}
