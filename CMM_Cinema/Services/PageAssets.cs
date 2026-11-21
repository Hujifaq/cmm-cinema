namespace CMM_Cinema.Services;

public static class PageAssets
{
    private const string Prefix = "page-asset:";

    public static void RequireAssets(this HttpContext context, params string[] names)
    {
        foreach (var name in names) context.Items[Prefix + name] = true;
    }

    public static bool RequiresAsset(this HttpContext context, string name) =>
        context.Items.ContainsKey(Prefix + name);
}
