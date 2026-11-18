using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using CMM_Cinema.Services;
using Microsoft.Extensions.Options;
using SQLitePCL;


sealed class FakeD1 : HttpMessageHandler, IDisposable
{
    private readonly sqlite3 db;
    private readonly Lock gate = new();
    public int Queries { get; private set; }

    static FakeD1() => Batteries_V2.Init();

    public FakeD1(params int[] userIds)
    {
        raw.sqlite3_open(":memory:", out db);
        Exec("PRAGMA foreign_keys = ON;");
        Exec("CREATE TABLE users (id INTEGER PRIMARY KEY);");
        foreach (var id in userIds) Exec($"INSERT INTO users (id) VALUES ({id});");
        Exec(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "0006_bookings.sql")));
        Exec(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "0007_ticket_tokens.sql")));
    }

    public D1Client Client() => new(new HttpClient(this, disposeHandler: false) { BaseAddress = new Uri("https://fake-d1.test/") },
        Options.Create(new CloudflareD1Options { AccountId = "a", DatabaseId = "d", ApiToken = "t" }));

    public long Scalar(string sql)
    {
        lock (gate)
        {
            raw.sqlite3_prepare_v2(db, sql, out var stmt);
            try { return raw.sqlite3_step(stmt) == raw.SQLITE_ROW ? raw.sqlite3_column_int64(stmt, 0) : 0; }
            finally { raw.sqlite3_finalize(stmt); }
        }
    }

    public void Exec(string sql)
    {
        lock (gate)
        {
            if (raw.sqlite3_exec(db, sql) != raw.SQLITE_OK) throw new InvalidOperationException(raw.sqlite3_errmsg(db).utf8_to_string());
        }
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
        var sql = body.RootElement.GetProperty("sql").GetString()!;
        var parameters = body.RootElement.GetProperty("params").EnumerateArray().ToArray();

        lock (gate)
        {
            Queries++;
            if (raw.sqlite3_prepare_v2(db, sql, out var stmt) != raw.SQLITE_OK)
                return Error($"prepare failed: {raw.sqlite3_errmsg(db).utf8_to_string()} in {sql}");
            try
            {
                var count = raw.sqlite3_bind_parameter_count(stmt);
                if (count > 100) return Error("too many SQL variables (D1 allows 100)");
                for (var i = 1; i <= count; i++) Bind(stmt, i, parameters[i - 1]);

                var rows = new JsonArray();
                int step;
                while ((step = raw.sqlite3_step(stmt)) == raw.SQLITE_ROW)
                {
                    var row = new JsonObject();
                    for (var c = 0; c < raw.sqlite3_column_count(stmt); c++)
                    {
                        row[raw.sqlite3_column_name(stmt, c).utf8_to_string()] = raw.sqlite3_column_type(stmt, c) switch
                        {
                            raw.SQLITE_INTEGER => JsonValue.Create(raw.sqlite3_column_int64(stmt, c)),
                            raw.SQLITE_FLOAT => JsonValue.Create(raw.sqlite3_column_double(stmt, c)),
                            raw.SQLITE_NULL => null,
                            _ => JsonValue.Create(raw.sqlite3_column_text(stmt, c).utf8_to_string()),
                        };
                    }
                    rows.Add(row);
                }
                if (step != raw.SQLITE_DONE) return Error($"step failed: {raw.sqlite3_errmsg(db).utf8_to_string()}");

                var result = new JsonObject { ["result"] = new JsonArray(new JsonObject { ["results"] = rows }), ["success"] = true };
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(result.ToJsonString(), Encoding.UTF8, "application/json") };
            }
            finally { raw.sqlite3_finalize(stmt); }
        }
    }

    private static void Bind(sqlite3_stmt stmt, int index, JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Null: raw.sqlite3_bind_null(stmt, index); break;
            case JsonValueKind.Number when value.TryGetInt64(out var whole): raw.sqlite3_bind_int64(stmt, index, whole); break;
            case JsonValueKind.Number: raw.sqlite3_bind_double(stmt, index, value.GetDouble()); break;
            case JsonValueKind.True: raw.sqlite3_bind_int(stmt, index, 1); break;
            case JsonValueKind.False: raw.sqlite3_bind_int(stmt, index, 0); break;
            default: raw.sqlite3_bind_text(stmt, index, value.GetString()); break;
        }
    }

    private static HttpResponseMessage Error(string message) =>
        new(HttpStatusCode.BadRequest) { Content = new StringContent(JsonSerializer.Serialize(new { success = false, errors = new[] { message } })) };

    protected override void Dispose(bool disposing)
    {
        if (disposing) raw.sqlite3_close_v2(db);
        base.Dispose(disposing);
    }
}
