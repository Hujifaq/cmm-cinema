using System.Globalization;
using System.Net;
using Microsoft.Extensions.Options;
using QRCoder;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace CMM_Cinema.Services;

public sealed class TicketQrService(IOptions<AppOptions> app, IWebHostEnvironment environment)
{
    private const string Ink = "#071c1e";
    private const string LogoFile = "images/favicon-192.png";
    private const int SvgModule = 10; // pixels per module for QRCoder's own sizing; the viewBox itself counts modules
    private const int PngModule = 14;
    private const int PngQuietModules = 4;

    // Error correction Q repairs up to 25% of the code, so the centre mark (about 6% of its area) cannot stop it scanning.
    // The next level, H, would add a whole version of modules (33 becomes 41-49), making each one smaller and, for
    // longer addresses, putting the code's centre alignment pattern right under the logo.
    private const QRCodeGenerator.ECCLevel Correction = QRCodeGenerator.ECCLevel.Q;

    private readonly Lazy<byte[]?> logo = new(() =>
    {
        var path = Path.Combine(environment.WebRootPath ?? "", LogoFile);
        return File.Exists(path) ? File.ReadAllBytes(path) : null;
    });

    public string TicketUrl(HttpRequest request, string ticketToken)
    {
        var origin = Uri.TryCreate(app.Value.BaseUrl, UriKind.Absolute, out var baseUrl)
            ? baseUrl.GetLeftPart(UriPartial.Authority)
            : $"{request.Scheme}://{request.Host}";
        return $"{origin}/t/{Uri.EscapeDataString(ticketToken)}";
    }


    public string Svg(string url, string cssClass, string label)
    {
        using var data = Encode(url, out var modules);
        var svg = new SvgQRCode(data).GetGraphic(SvgModule, Ink, "#ffffff", drawQuietZones: false, sizingMode: SvgQRCode.SizingMode.ViewBoxAttribute);
        var start = svg.IndexOf("<svg", StringComparison.Ordinal);
        if (start < 0) return "";
        svg = svg[start..];

        if (logo.Value is { } mark)
        {
            // QRCoder's viewBox counts modules (e.g. 0 0 37 37), so the overlay is positioned in module units too.
            var (box, inner) = LogoBoxes(modules);
            string n(double value) => value.ToString("0.##", CultureInfo.InvariantCulture);
            var overlay =
                $"<rect x=\"{n(box.Offset)}\" y=\"{n(box.Offset)}\" width=\"{n(box.Size)}\" height=\"{n(box.Size)}\" rx=\"{n(box.Size * 0.22)}\" fill=\"#ffffff\"/>" +
                $"<image href=\"data:image/png;base64,{Convert.ToBase64String(mark)}\" x=\"{n(inner.Offset)}\" y=\"{n(inner.Offset)}\" width=\"{n(inner.Size)}\" height=\"{n(inner.Size)}\" preserveAspectRatio=\"xMidYMid meet\"/>";
            var end = svg.LastIndexOf("</svg>", StringComparison.Ordinal);
            if (end >= 0) svg = svg.Insert(end, overlay);
        }

        return svg.Replace("<svg ",
            $"<svg class=\"{WebUtility.HtmlEncode(cssClass)}\" role=\"img\" aria-label=\"{WebUtility.HtmlEncode(label)}\" focusable=\"false\" ",
            StringComparison.Ordinal);
    }

    
    public byte[] Png(string url)
    {
        using var data = Encode(url, out var modules);
        var matrix = data.ModuleMatrix; // includes QRCoder's own 4-module border on every side
        var border = (matrix.Count - modules) / 2;
        var total = modules + 2 * PngQuietModules;

        using var image = new Image<Rgba32>(total * PngModule, total * PngModule, new Rgba32(255, 255, 255, 255));
        var dark = new Rgba32(7, 28, 30, 255);
        image.ProcessPixelRows(rows =>
        {
            for (var y = 0; y < rows.Height; y++)
            {
                var row = rows.GetRowSpan(y);
                var my = y / PngModule - PngQuietModules + border;
                if (my < border || my >= border + modules) continue;
                for (var x = 0; x < row.Length; x++)
                {
                    var mx = x / PngModule - PngQuietModules + border;
                    if (mx >= border && mx < border + modules && matrix[my][mx]) row[x] = dark;
                }
            }
        });

        if (logo.Value is { } mark)
        {
            var (box, inner) = LogoBoxes(modules);
            var boxPx = box.Size * PngModule;
            var boxX = (PngQuietModules + box.Offset) * PngModule;
            var radius = boxPx * 0.22;
            image.ProcessPixelRows(rows =>
            {
                for (var y = 0; y < boxPx; y++)
                {
                    var row = rows.GetRowSpan(boxX + y);
                    for (var x = 0; x < boxPx; x++)
                        if (InsideRounded(x, y, boxPx, radius)) row[boxX + x] = new Rgba32(255, 255, 255, 255);
                }
            });

            using var emblem = Image.Load<Rgba32>(mark);
            var innerPx = inner.Size * PngModule;
            emblem.Mutate(ctx => ctx.Resize(innerPx, innerPx));
            var origin = new Point((PngQuietModules + inner.Offset) * PngModule, (PngQuietModules + inner.Offset) * PngModule);
            image.Mutate(ctx => ctx.DrawImage(emblem, origin, 1f));
        }

        using var stream = new MemoryStream();
        image.SaveAsPng(stream);
        return stream.ToArray();
    }

    // The mark covers about a fifth of the code's width: an odd number of modules, so it sits dead centre on the
    // grid, with a one-module white margin between the knockout and the emblem.
    public static ((int Offset, int Size) Knockout, (int Offset, int Size) Emblem) LogoBoxes(int modules)
    {
        var knockout = (int)Math.Round(modules * 0.22);
        if (knockout % 2 == 0) knockout++;
        if ((modules - knockout) % 2 != 0) knockout--;
        var offset = (modules - knockout) / 2;
        return ((offset, knockout), (offset + 1, knockout - 2));
    }

    private static bool InsideRounded(int x, int y, int size, double radius)
    {
        var cx = x < radius ? radius : x > size - 1 - radius ? size - 1 - radius : x;
        var cy = y < radius ? radius : y > size - 1 - radius ? size - 1 - radius : y;
        var dx = x - cx;
        var dy = y - cy;
        return dx * dx + dy * dy <= radius * radius;
    }

    private static QRCodeData Encode(string url, out int modules)
    {
        using var generator = new QRCodeGenerator();
        var data = generator.CreateQrCode(url, Correction);
        modules = data.ModuleMatrix.Count - 8; // QRCoder adds a 4-module border on every side
        return data;
    }
}
