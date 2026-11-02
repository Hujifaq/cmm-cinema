using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace CMM_Cinema.Services;

public sealed class D1Client(HttpClient http, IOptions<CloudflareD1Options> options)
{
    public async Task<IReadOnlyList<JsonElement>> QueryAsync(string sql, object[]? parameters = null, CancellationToken cancellationToken = default)
    {
        var settings = options.Value;
        using var request = new HttpRequestMessage(HttpMethod.Post, $"accounts/{settings.AccountId}/d1/database/{settings.DatabaseId}/query");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiToken);
        request.Content = JsonContent.Create(new { sql, @params = parameters ?? [] });

        using var response = await http.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"D1 query failed ({(int)response.StatusCode}): {body}");

        using var document = JsonDocument.Parse(body);
        var results = document.RootElement.GetProperty("result")[0].GetProperty("results");
        return results.EnumerateArray().Select(row => row.Clone()).ToList();
    }
}
