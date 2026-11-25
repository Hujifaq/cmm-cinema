using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

public interface IPromotionRepository
{
    const int MaxPromotions = 10;

    bool CanEdit { get; }
    Task<IReadOnlyList<Promotion>> GetActiveAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PromotionAdminRow>> GetAdminRowsAsync(CancellationToken cancellationToken = default);
    Task<PromotionForm?> GetFormAsync(int id, CancellationToken cancellationToken = default);
    Task<PromotionSaveResult> CreateAsync(PromotionForm form, CancellationToken cancellationToken = default);
    Task<PromotionSaveResult> UpdateAsync(int id, PromotionForm form, CancellationToken cancellationToken = default);
    Task<bool> MoveAsync(int id, int direction, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}

public static class BuiltInPromotions
{
    public static readonly IReadOnlyList<Promotion> All =
    [
        new(1, "/images/promos/student-privilege-promo.webp", "Student privilege: 50 baht off for KMUTT students at the CMM branch", default),
        new(2, "/images/promos/iphone-duo-promo.webp", "Lucky draw: win an iPhone Duo from CMM Cinema", default),
        new(3, "/images/promos/sale-12-12-promo.webp", "12.12 sale: movie ticket prices reduced", default),
        new(4, "/images/promos/movie-combo-promo.webp", "Movie combo: large popcorn, a 32 oz drink and a ticket for 199 baht", default),
    ];
}
