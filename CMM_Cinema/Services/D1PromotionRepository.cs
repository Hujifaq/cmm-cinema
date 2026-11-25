using System.Globalization;
using System.Text.Json;
using CMM_Cinema.Models;
using Microsoft.Extensions.Caching.Memory;

namespace CMM_Cinema.Services;

public sealed class D1PromotionRepository(D1Client d1, IMemoryCache cache, ILogger<D1PromotionRepository> logger) : IPromotionRepository
{
    private const string CacheKey = "d1-promotions";
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromSeconds(60);

    public bool CanEdit => true;

    public Task<IReadOnlyList<Promotion>> GetActiveAsync(CancellationToken cancellationToken = default) =>
        cache.GetOrRefreshAsync(CacheKey, CacheLifetime, TimeSpan.FromDays(1), FetchAsync);

    private async Task<IReadOnlyList<Promotion>> FetchAsync(CancellationToken cancellationToken)
    {
        try
        {
            var rows = await d1.QueryAsync(
                "SELECT id, image_url, image_alt, updated_at FROM promotions WHERE is_active = 1 ORDER BY sort_order, id LIMIT ?",
                [IPromotionRepository.MaxPromotions], cancellationToken);
            return rows.Select(row => new Promotion(
                row.GetProperty("id").GetInt32(),
                Text(row, "image_url") ?? "",
                Text(row, "image_alt") ?? "",
                DateTimeOffset.TryParse(Text(row, "updated_at"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var when) ? when : default)).ToArray();
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Could not read promotions from D1; showing the built-in banners");
            return BuiltInPromotions.All;
        }
    }

    public async Task<IReadOnlyList<PromotionAdminRow>> GetAdminRowsAsync(CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync(
            "SELECT id, image_url, image_alt, is_active FROM promotions ORDER BY sort_order, id LIMIT ?",
            [IPromotionRepository.MaxPromotions * 5], cancellationToken);
        return rows.Select(row => new PromotionAdminRow(
            row.GetProperty("id").GetInt32(), Text(row, "image_url") ?? "", Text(row, "image_alt") ?? "", Flag(row, "is_active"))).ToArray();
    }

    public async Task<PromotionForm?> GetFormAsync(int id, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync("SELECT image_url, image_alt, is_active FROM promotions WHERE id = ?", [id], cancellationToken);
        if (rows.Count == 0) return null;
        return new PromotionForm { ImageUrl = Text(rows[0], "image_url"), Alt = Text(rows[0], "image_alt") ?? "", IsActive = Flag(rows[0], "is_active") };
    }

    public async Task<PromotionSaveResult> CreateAsync(PromotionForm form, CancellationToken cancellationToken = default)
    {
        var count = await d1.QueryAsync("SELECT COUNT(*) AS total FROM promotions", cancellationToken: cancellationToken);
        if (count[0].GetProperty("total").GetInt32() >= IPromotionRepository.MaxPromotions) return new PromotionSaveResult(PromotionSaveStatus.TooMany);

        var now = D1Time.Now();
        await d1.QueryAsync(
            "INSERT INTO promotions (image_url, image_alt, sort_order, is_active, created_at, updated_at) " +
            "VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM promotions), ?, ?, ?) RETURNING id",
            [form.ImageUrl, form.Alt, form.IsActive ? 1 : 0, now, now], cancellationToken);
        cache.Remove(CacheKey);
        return new PromotionSaveResult(PromotionSaveStatus.Saved);
    }

    public async Task<PromotionSaveResult> UpdateAsync(int id, PromotionForm form, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync(
            "UPDATE promotions SET image_url = ?, image_alt = ?, is_active = ?, updated_at = ? WHERE id = ? RETURNING id",
            [form.ImageUrl, form.Alt, form.IsActive ? 1 : 0, D1Time.Now(), id], cancellationToken);
        cache.Remove(CacheKey);
        return new PromotionSaveResult(rows.Count == 0 ? PromotionSaveStatus.NotFound : PromotionSaveStatus.Saved);
    }

    public async Task<bool> MoveAsync(int id, int direction, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync("SELECT id, sort_order FROM promotions ORDER BY sort_order, id", cancellationToken: cancellationToken);
        var ids = rows.Select(row => row.GetProperty("id").GetInt32()).ToList();
        var stored = rows.Select(row => row.GetProperty("sort_order").GetInt32()).ToList();
        var from = ids.IndexOf(id);
        var to = from + Math.Sign(direction);
        if (from < 0 || to < 0 || to >= ids.Count) return false;

        (ids[from], ids[to]) = (ids[to], ids[from]);
        for (var position = 0; position < ids.Count; position++)
        {
            var previous = rows[position].GetProperty("id").GetInt32();
            if (ids[position] == previous && stored[position] == position) continue;
            await d1.QueryAsync("UPDATE promotions SET sort_order = ? WHERE id = ?", [position, ids[position]], cancellationToken);
        }
        cache.Remove(CacheKey);
        return true;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var rows = await d1.QueryAsync("DELETE FROM promotions WHERE id = ? RETURNING id", [id], cancellationToken);
        cache.Remove(CacheKey);
        return rows.Count > 0;
    }

    private static bool Flag(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.Number && value.GetInt32() == 1;

    private static string? Text(JsonElement row, string column) =>
        row.TryGetProperty(column, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
