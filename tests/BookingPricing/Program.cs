using System.Security.Claims;
using CMM_Cinema.Controllers;
using CMM_Cinema.Models;
using CMM_Cinema.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.Extensions.Caching.Memory;

const int Alice = 1, Bob = 2;
var passed = 0;
var failures = new List<string>();

var backends = new (string Name, Func<IBookingService> Create)[]
{
    ("memory", () => new DemoBookingService()),
    ("d1", () => new D1BookingService(new FakeD1(Alice, Bob).Client(), new MemoryCache(new MemoryCacheOptions()))),
};

foreach (var (backend, create) in backends)
{
    async Task<(IBookingService Service, Showtime Show)> Setup()
    {
        var service = create();
        return (service, (await service.GetShowtimesAsync("test-movie")).First(show => show.IsAvailable));
    }

    async Task Run(string name, Func<Task> test)
    {
        try { await test(); passed++; Console.WriteLine($"PASS [{backend}] {name}"); }
        catch (Exception ex) { failures.Add($"[{backend}] {name}: {ex.Message}"); Console.WriteLine($"FAIL [{backend}] {name}: {ex.Message}"); }
    }

    await Run("only Thai-dubbed 2D and IMAX are offered across every cinema and date, with stable ids", async () =>
    {
        var service = create();
        Check(BookingRules.Formats.SequenceEqual(["2D", "IMAX"]), "Supported formats");
        Check(BookingRules.Languages.SequenceEqual(["Thai"]), "Only Thai dubbing is offered");
        var showtimes = await service.GetShowtimesAsync("test-movie");
        Check(showtimes.Count == BookingRules.DaysAhead * BookingRules.ShowtimesPerDay, $"Full week of showtimes (got {showtimes.Count})");
        foreach (var cinema in BookingRules.Cinemas)
        foreach (var date in BookingRules.GetDates())
        {
            var sessions = showtimes.Where(show => show.CinemaId == cinema.Id && show.Date == date).ToArray();
            Check(sessions.Any(show => show.Format == "2D" && show.Language == "Thai"), "2D Thai dubbing remains");
            Check(sessions.Any(show => show.Format == "IMAX" && show.Language == "Thai"), "IMAX Thai dubbing remains");
        }
        var again = await service.GetShowtimesAsync("TEST-MOVIE");
        Check(again.Select(s => s.Id).SequenceEqual(showtimes.Select(s => s.Id)), "Showtime ids stay the same");
        Check(await service.GetShowtimeAsync(showtimes[5].Id) == showtimes[5], "Lookup by id returns the same showtime");
    });

    await Run("seat inventory matches Normal F–D, Premium C–A and eight atomic VIP pairs", async () =>
    {
        var (service, show) = await Setup();
        var seats = await service.GetSeatsAsync(show.Id);
        Check(seats.Count == 104 && seats.Select(s => s.Id).Distinct().Count() == 104, "Unique inventory");
        Check(seats.Count(s => s.Category == SeatCategory.Normal) == 48, "Normal count");
        Check(seats.Count(s => s.Category == SeatCategory.Premium) == 48, "Premium count");
        Check(seats.Count(s => s.Category == SeatCategory.Vip && s.Capacity == 2) == 8, "VIP pairs");
        Check(seats.Sum(s => s.Capacity) == 112, "Admission capacity");
        Check(seats.All(s => s.Price == (s.Category == SeatCategory.Normal ? 300 : s.Category == SeatCategory.Premium ? 330 : 900)), "Authoritative prices");
    });

    await Run("mixed-category hold snapshots prices and charges VIP once per pair", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D1", "C1", "VP1"]));
        Check(hold.Total == 1530 && hold.TicketCount == 4 && hold.Seats.Count == 3, "Mixed sum / admissions");
        Check(hold.SeatItems.Single(s => s.Id == "VP1").Price == 900, "Pair price");
        var stored = (await service.GetBookingAsync(Alice, hold.Id))!;
        Check(stored.Total == 1530 && stored.Seats.SequenceEqual(hold.Seats), "Stored total and seat order");
        Check(await service.GetBookingAsync(Bob, hold.Id) is null, "Another user cannot see the booking");
    });

    await Run("duplicate and lowercase IDs cannot double-charge a selection", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, [" d1 ", "D1", "vp1"]));
        Check(hold.Total == 1200 && hold.TicketCount == 3 && hold.Seats.Count == 2, "Normalized units");
    });

    await Run("VIP cannot be split, held twice, or booked when sold; cancellation releases it", async () =>
    {
        var (service, show) = await Setup();
        Check((await service.HoldSeatsAsync(Alice, show.Id, ["VP1A"])).Booking is null, "No half-pair ID");
        Check((await service.HoldSeatsAsync(Alice, show.Id, ["VP3"])).Booking is null, "Presold VIP blocked");
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["VP1"]));
        Check((await service.HoldSeatsAsync(Bob, show.Id, ["VP1"])).Booking is null, "Held pair blocked");
        await service.CancelHoldAsync(Bob, hold.Id);
        Check((await service.HoldSeatsAsync(Bob, show.Id, ["VP1"])).Booking is null, "Another user cannot cancel the hold");
        await service.CancelHoldAsync(Alice, hold.Id);
        var second = Held(await service.HoldSeatsAsync(Bob, show.Id, ["VP1"]));
        Check((await service.ConfirmBookingAsync(Bob, second.Id)).Succeeded, "Confirmation");
        Check((await service.GetBookingAsync(Bob, second.Id))!.Status == BookingStatus.Confirmed, "Confirmed status");
        Check((await service.GetSeatsAsync(show.Id)).Single(s => s.Id == "VP1").State == SeatState.Sold, "Confirmed pair unavailable");
        Check((await service.HoldSeatsAsync(Alice, show.Id, ["VP1"])).Booking is null, "Sold pair blocked");
    });

    await Run("a hold that clashes on one seat keeps none of its seats", async () =>
    {
        var (service, show) = await Setup();
        Held(await service.HoldSeatsAsync(Alice, show.Id, ["E5"]));
        var clash = await service.HoldSeatsAsync(Bob, show.Id, ["E4", "E5", "E6"]);
        Check(clash.Booking is null && clash.Error.Contains("no longer available"), "Clash rejected");
        Held(await service.HoldSeatsAsync(Bob, show.Id, ["E4", "E6"]));
    });

    await Run("eight-admission limit counts VIP pairs as two and accepts exactly four pairs", async () =>
    {
        var (service, show) = await Setup();
        Check((await service.HoldSeatsAsync(Alice, show.Id, ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "VP1"])).Booking is null, "Nine admissions rejected");
        Check((await service.HoldSeatsAsync(Alice, show.Id, ["VP1", "VP2", "VP4", "VP5", "VP6"])).Booking is null, "Five pairs rejected");
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["VP1", "VP2", "VP4", "VP5"]));
        Check(hold.TicketCount == 8 && hold.Total == 3600, "Four pairs total");
    });

    await Run("unknown rows, out-of-range seat IDs and empty requests are rejected", async () =>
    {
        foreach (var id in new[] { "G1", "A17", "VP0", "VP9", "fake" })
        {
            var (service, show) = await Setup();
            Check((await service.HoldSeatsAsync(Alice, show.Id, [id])).Booking is null, $"Rejected {id}");
        }
        var (s, t) = await Setup();
        Check((await s.HoldSeatsAsync(Alice, t.Id, [])).Booking is null, "Empty rejected");
        Check((await s.HoldSeatsAsync(Alice, 999_999, ["D1"])).Booking is null, "Unknown showtime rejected");
    });

    await Run("Summary confirms directly without a payment method, and repeating it is safe", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D1", "VP1"]));
        var controller = Booking(service, Alice);
        var result = await controller.Confirm(hold.Id, default) as RedirectToActionResult;
        Check(result?.ActionName == nameof(BookingController.Confirmation), "Direct confirmation redirect");
        Check((Guid)result!.RouteValues!["bookingId"]! == hold.Id, "Same booking ID");
        Check((await service.GetBookingAsync(Alice, hold.Id))!.Total == 1200, "Total remains authoritative");
        Check((await service.ConfirmBookingAsync(Alice, hold.Id)).Succeeded, "Repeated confirmation succeeds");
        await service.CancelHoldAsync(Alice, hold.Id);
        Check((await service.GetBookingAsync(Alice, hold.Id))!.Status == BookingStatus.Confirmed, "Confirmed booking cannot be cancelled as a hold");
        Check((await service.GetSeatsAsync(show.Id)).Where(s => hold.Seats.Contains(s.Id)).All(s => s.State == SeatState.Sold), "Seats remain unavailable");
        var confirm = typeof(BookingController).GetMethod(nameof(BookingController.Confirm))!;
        Check(Attribute.IsDefined(confirm, typeof(HttpPostAttribute)), "Confirmation requires POST");
        Check(Attribute.IsDefined(confirm, typeof(ValidateAntiForgeryTokenAttribute)), "Confirmation retains anti-forgery validation");
    });

    await Run("legacy payment routes return to Summary without confirming a hold", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D1"]));
        var controller = Booking(service, Alice);
        Check((controller.Payment(hold.Id) as RedirectToActionResult)?.ActionName == nameof(BookingController.Summary), "Legacy GET redirect");
        Check((controller.Pay(hold.Id) as RedirectToActionResult)?.ActionName == nameof(BookingController.Summary), "Legacy POST redirect");
        Check((await service.GetBookingAsync(Alice, hold.Id))!.Status == BookingStatus.Held, "Legacy routes cannot confirm");
    });

    await Run("confirmation rejects released, unknown or someone else's holds", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D1"]));
        Check(!(await service.ConfirmBookingAsync(Bob, hold.Id)).Succeeded, "Other user's hold rejected");
        await service.CancelHoldAsync(Alice, hold.Id);
        Check(!(await service.ConfirmBookingAsync(Alice, hold.Id)).Succeeded, "Released hold rejected");
        Check(!(await service.ConfirmBookingAsync(Alice, Guid.NewGuid())).Succeeded, "Unknown booking rejected");
        var result = await Booking(service, Alice).Confirm(hold.Id, default) as RedirectToActionResult;
        Check(result?.ActionName == nameof(BookingController.Showtimes), "Unavailable booking restarts flow");
    });

    await Run("seat-picking session: starts empty, keeps valid picks, restores, and is per user", async () =>
    {
        var (service, show) = await Setup();
        var other = (await service.GetShowtimesAsync("test-movie")).Where(s => s.IsAvailable).Skip(1).First();
        var draft = (await service.StartDraftAsync(Alice, show.Id))!;
        Check(draft.SeatIds.Count == 0 && draft.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(19), "New session starts empty for ~20 min");
        draft = (await service.SaveDraftSeatsAsync(Alice, show.Id, [" d1 ", "D1", "c2", "A3", "ZZ9", "VP1"]))!;
        Check(draft.SeatIds.SequenceEqual(["D1", "C2", "VP1"]), $"Saves valid seats only (got {string.Join(",", draft.SeatIds)})");
        Check((await service.StartDraftAsync(Alice, show.Id))!.SeatIds.SequenceEqual(["D1", "C2", "VP1"]), "Returning restores picks");
        Check((await service.StartDraftAsync(Bob, show.Id))!.SeatIds.Count == 0, "Another user gets their own session");
        Held(await service.HoldSeatsAsync(Bob, show.Id, ["D1"]));
        Check((await service.StartDraftAsync(Alice, show.Id))!.SeatIds.SequenceEqual(["C2", "VP1"]), "Seat taken by someone else drops out");
        draft = (await service.SaveDraftSeatsAsync(Alice, show.Id, ["VP2", "VP4", "VP5", "VP6", "VP7"]))!;
        Check(draft.SeatIds.Count == 4, $"Session never exceeds 8 admissions (got {string.Join(",", draft.SeatIds)})");
        Check((await service.StartDraftAsync(Alice, other.Id))!.SeatIds.Count == 0, "Switching showtime starts fresh");
        Check((await service.StartDraftAsync(Alice, show.Id))!.SeatIds.Count == 0, "...and replaces the old session");
        Check(await service.SaveDraftSeatsAsync(Alice, 999_999, ["D1"]) is null, "Unknown showtime rejected");
    });

    await Run("Reserve clears the session; a failed Reserve keeps free picks; Cancel clears it", async () =>
    {
        var (service, show) = await Setup();
        var controller = Booking(service, Alice);
        Check(await controller.SaveSeats(show.Id, ["E5"], default) is JsonResult, "SaveSeats returns JSON");
        Check(await controller.SaveSeats(999_999, ["E5"], default) is NotFoundResult, "SaveSeats 404 for unknown showtime");
        var reserved = await controller.Reserve(show.Id, ["E5", "E6"], default) as RedirectToActionResult;
        Check(reserved?.ActionName == "Summary", "Reserve moves on");
        Check((await service.StartDraftAsync(Alice, show.Id))!.SeatIds.Count == 0, "Reserve cleared the session");
        var bookingId = (Guid)reserved!.RouteValues!["bookingId"]!;
        var summary = (await controller.Summary(bookingId, default) as ViewResult)!;
        Check(summary.ViewData["Celebrate"] is null && summary.ViewData["NoPageTransition"] is null, "Summary keeps its normal arrival");
        Check((await controller.Confirm(bookingId, default) as RedirectToActionResult)?.ActionName == "Confirmation", "Confirm moves on");
        var confirmed = (await controller.Confirmation(bookingId, default) as ViewResult)!;
        Check(confirmed.ViewData["Celebrate"] is true && confirmed.ViewData["NoPageTransition"] is true, "Confirmation celebrates the arrival without a page transition");
        var revisited = (await Booking(service, Alice).Confirmation(bookingId, default) as ViewResult)!;
        Check(revisited.ViewData["Celebrate"] is null && revisited.ViewData["NoPageTransition"] is null, "A later Confirmation visit has no confetti and keeps transitions");

        Held(await service.HoldSeatsAsync(Bob, show.Id, ["F2"]));
        var failed = await controller.Reserve(show.Id, ["F1", "F2"], default) as RedirectToActionResult;
        Check(failed?.ActionName == "SeatSelection", "Clash returns to seats");
        Check((await service.StartDraftAsync(Alice, show.Id))!.SeatIds.SequenceEqual(["F1"]), "Failed Reserve keeps still-free picks");

        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["F3"]));
        await controller.Cancel(hold.Id, default);
        Check((await service.StartDraftAsync(Alice, show.Id))!.SeatIds.Count == 0, "Cancel cleared the session");
        Check((await service.HoldSeatsAsync(Bob, show.Id, ["F3"])).Booking is not null, "Cancel released the held seat");
    });

    await Run("My Tickets lists only the user's confirmed bookings, with both seats of a VIP pair", async () =>
    {
        var (service, show) = await Setup();
        var mine = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D4", "VP2"]));
        await service.ConfirmBookingAsync(Alice, mine.Id);
        Held(await service.HoldSeatsAsync(Alice, show.Id, ["D6"]));
        var bobs = Held(await service.HoldSeatsAsync(Bob, show.Id, ["D8"]));
        await service.ConfirmBookingAsync(Bob, bobs.Id);

        var confirmed = await service.GetConfirmedBookingsAsync(Alice);
        Check(confirmed.Count == 1 && confirmed[0].Id == mine.Id, "Only Alice's confirmed booking");

        var tickets = new TicketsController(service, new OneMovie("test-movie"), MakeQr()) { ControllerContext = Context(Alice) };
        var view = (await tickets.Index(default) as ViewResult)?.Model as MyTicketsViewModel;
        var ticket = view!.Upcoming.Concat(view.Past).Single();
        Check(ticket.BookingCode == mine.Reference && ticket.Seats.SequenceEqual(["D4", "VP2 L", "VP2 R"]), $"Ticket seats (got {string.Join(",", ticket.Seats)})");
        Check(ticket.Cinema == BookingRules.GetCinema(show.CinemaId)!.Name && ticket.Showtime == show.Date.ToDateTime(show.Time), "Ticket screening details");
        Check(await tickets.Details(mine.Reference, "test-movie", default) is ViewResult, "Ticket details page opens");
    });

    await Run("Quick Book's movie, cinema and date open Showtimes filtered to exactly that", async () =>
    {
        var (service, _) = await Setup();
        var dates = BookingRules.GetDates();
        var cinema = BookingRules.Cinemas[1];
        var controller = Booking(service, Alice);

        var view = (await controller.Showtimes("test-movie", dates[2], cinema.Id, default) as ViewResult)?.Model as ShowtimesViewModel;
        Check(view is not null && view.Movie.Slug == "test-movie", "The chosen movie opens");
        Check(view!.SelectedDate == dates[2] && view.CinemaId == cinema.Id, "Date and cinema are applied");
        Check(view.Showtimes.Count == 6 && view.Showtimes.All(s => s.Date == dates[2] && s.CinemaId == cinema.Id), $"Only that cinema's sessions on that day are listed (got {view.Showtimes.Count})");

        var fallback = (await controller.Showtimes("test-movie", new DateOnly(2000, 1, 1), 999, default) as ViewResult)?.Model as ShowtimesViewModel;
        Check(fallback!.SelectedDate == dates[0] && fallback.CinemaId is null, "A stale date or unknown cinema falls back instead of failing");

        foreach (var option in BookingRules.Cinemas) Check(int.TryParse(option.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), out _), "Cinema ids are plain numbers");
        Check(dates.Count == BookingRules.DaysAhead && dates[0] == CinemaTime.Today, "Quick Book's dates are the next seven Bangkok days");
    });

    await Run("confirming gives the ticket one unguessable QR token that never changes", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D4"]));
        Check(hold.TicketToken is null && (await service.GetBookingAsync(Alice, hold.Id))!.TicketToken is null, "A held booking has no ticket token");
        await service.ConfirmBookingAsync(Alice, hold.Id);
        var token = (await service.GetBookingAsync(Alice, hold.Id))!.TicketToken;
        Check(BookingRules.IsTicketToken(token), $"Token is 22 URL-safe characters (got {token})");
        Check(!token!.Contains(hold.Reference, StringComparison.OrdinalIgnoreCase), "Token is not derived from the booking reference");
        await service.ConfirmBookingAsync(Alice, hold.Id);
        Check((await service.GetBookingAsync(Alice, hold.Id))!.TicketToken == token, "Confirming again keeps the same token");
        Check(await service.EnsureTicketTokenAsync(Alice, hold.Id) == token, "Ensure returns the existing token");
        Check(await service.EnsureTicketTokenAsync(Bob, hold.Id) is null, "Another user cannot read or set the token");

        var other = Held(await service.HoldSeatsAsync(Bob, show.Id, ["D5"]));
        await service.ConfirmBookingAsync(Bob, other.Id);
        Check((await service.GetBookingAsync(Bob, other.Id))!.TicketToken != token, "Each booking gets its own token");
    });

    await Run("a ticket token finds its confirmed booking for anyone, and nothing else", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D4", "VP2"]));
        await service.ConfirmBookingAsync(Alice, hold.Id);
        var token = (await service.GetBookingAsync(Alice, hold.Id))!.TicketToken!;
        var found = await service.GetBookingByTicketTokenAsync(token);
        Check(found?.Id == hold.Id && found.Seats.SequenceEqual(["D4", "VP2"]), "Token finds the booking without knowing its owner");
        Check(await service.GetBookingByTicketTokenAsync(BookingRules.NewTicketToken()) is null, "An unknown token finds nothing");
        Check(await service.GetBookingByTicketTokenAsync("not-a-token") is null, "A malformed token finds nothing");
        Check(await service.GetBookingByTicketTokenAsync(token.ToLowerInvariant() == token ? token.ToUpperInvariant() : token.ToLowerInvariant()) is null, "Tokens are case-sensitive");
        var held = Held(await service.HoldSeatsAsync(Bob, show.Id, ["D6"]));
        Check(held.TicketToken is null, "Unconfirmed bookings have no token to scan");
    });

    await Run("scanning opens the public ticket page with the seats, status and no buyer details", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D4", "VP2"]));
        await service.ConfirmBookingAsync(Alice, hold.Id);
        var token = (await service.GetBookingAsync(Alice, hold.Id))!.TicketToken!;

        var page = new TicketPassController(service, new OneMovie("test-movie")) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
        var view = await page.Show(token, default) as ViewResult;
        var model = view?.Model as TicketPassViewModel;
        Check(model is not null && model.Ticket.BookingCode == hold.Reference, "Anonymous visitor sees the ticket");
        Check(model!.Ticket.Seats.SequenceEqual(["D4", "VP2 L", "VP2 R"]) && model.Admissions == 3, "Seats and admissions");
        Check(model.Ticket.Showtime == show.Date.ToDateTime(show.Time) && model.Language == show.Language, "Screening details");
        var expected = show.Date.ToDateTime(show.Time).AddMinutes(120) <= CinemaTime.Now ? TicketPassStatus.Ended
            : show.Date == CinemaTime.Today ? TicketPassStatus.Today : TicketPassStatus.Upcoming;
        Check(model.Status == expected, $"Status {model.Status} matches the showtime");
        Check(typeof(TicketPassViewModel).GetProperties().All(p => p.Name is not ("Total" or "OwnerId" or "Email" or "Name"))
            && typeof(Ticket).GetProperties().All(p => p.Name is not ("Total" or "OwnerId" or "Email")), "The page model carries no price or buyer");
        Check(page.Response.Headers["X-Robots-Tag"].ToString().Contains("noindex"), "Kept out of search engines");

        var missing = new TicketPassController(service, new OneMovie("test-movie")) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
        var notFound = await missing.Show(BookingRules.NewTicketToken(), default) as ViewResult;
        Check(notFound?.ViewName == "NotFound" && missing.Response.StatusCode == 404, "Unknown token shows Ticket not found with a 404");
        Check(typeof(TicketPassController).GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute), true).Length == 1, "No sign-in is needed");
        Check(typeof(TicketPassController).GetCustomAttributes(typeof(Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute), true).Length == 1, "Lookups are rate-limited");
    });

    await Run("the ticket QR code scans back to that ticket's page, and only its owner can download it", async () =>
    {
        var (service, show) = await Setup();
        var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["E7"]));
        await service.ConfirmBookingAsync(Alice, hold.Id);
        var token = (await service.GetBookingAsync(Alice, hold.Id))!.TicketToken!;
        var qr = MakeQr("https://cinema.example/");

        var mine = new TicketsController(service, new OneMovie("test-movie"), qr) { ControllerContext = Context(Alice) };
        var file = await mine.QrPng(hold.Reference, default) as FileContentResult;
        Check(file is not null && file.ContentType == "image/png" && file.FileDownloadName == $"cmm-ticket-{hold.Reference}.png", "Owner downloads a PNG");
        Check(DecodeQr(file!.FileContents) == $"https://cinema.example/t/{token}", $"PNG scans to the ticket page (got {DecodeQr(file.FileContents)})");
        var svg = qr.Svg(qr.TicketUrl(new DefaultHttpContext().Request, token), "size-40", "QR code");
        Check(svg.StartsWith("<svg class=\"size-40\" role=\"img\" aria-label=\"QR code\"") && svg.Contains("viewBox"), "SVG is labelled and scales by viewBox");

        // The CMM "C" emblem sits in the middle of every code, yet the code still scans.
        Check(svg.Contains("<image href=\"data:image/png;base64,") && svg.Contains("fill=\"#ffffff\""), "SVG carries the logo on a white knockout");
        var vb = System.Text.RegularExpressions.Regex.Match(svg, "viewBox=\"0 0 (\\d+) (\\d+)\"");
        var img = System.Text.RegularExpressions.Regex.Match(svg, "<image [^>]*x=\"([\\d.]+)\" y=\"([\\d.]+)\" width=\"([\\d.]+)\" height=\"([\\d.]+)\"");
        var rect = System.Text.RegularExpressions.Regex.Match(svg, "<rect x=\"([\\d.]+)\" y=\"([\\d.]+)\" width=\"([\\d.]+)\"");
        var span = double.Parse(vb.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
        double D(System.Text.RegularExpressions.Match m, int g) => double.Parse(m.Groups[g].Value, System.Globalization.CultureInfo.InvariantCulture);
        Check(vb.Success && img.Success && rect.Success, "SVG has a viewBox, a logo image and a knockout");
        Check(Math.Abs(D(img, 1) * 2 + D(img, 3) - span) < 0.01 && Math.Abs(D(img, 2) * 2 + D(img, 4) - span) < 0.01, "The logo is centred inside the viewBox (it was once drawn off-canvas)");
        Check(D(rect, 1) >= 0 && D(rect, 1) + D(rect, 3) <= span && D(img, 3) < D(rect, 3), "The knockout lies inside the code and is larger than the logo");
        var url = qr.TicketUrl(new DefaultHttpContext().Request, token);
        var plainQr = new TicketQrService(Microsoft.Extensions.Options.Options.Create(new AppOptions { BaseUrl = "https://cinema.example/" }), new TestEnv(Path.Combine(AppContext.BaseDirectory, "missing-webroot")));
        Check(!plainQr.Svg(url, "x", "QR").Contains("<image") && DecodeQr(plainQr.Png(url)) == url, "Without the logo file it falls back to a plain code that still scans");
        var withLogoPng = qr.Png(url);
        Check(DecodeQr(withLogoPng) == url, "PNG with the logo scans back to the ticket page");
        Check(!withLogoPng.AsSpan().SequenceEqual(plainQr.Png(url)), "The logo is really drawn into the PNG");
        Check(HasTeal(withLogoPng), "The emblem's teal reaches the middle of the PNG");
        foreach (var size in new[] { 29, 33, 37, 41, 45, 53 })
        {
            var (knock, emblem) = TicketQrService.LogoBoxes(size);
            Check(knock.Offset * 2 + knock.Size == size && emblem.Offset * 2 + emblem.Size == size, $"Logo is centred on the module grid for {size} modules");
            Check((double)(knock.Size * knock.Size) / (size * size) <= 0.085, $"Logo hides under 8.5% of a {size}-module code (got {(double)(knock.Size * knock.Size) / (size * size):P1})");
        }

        var someoneElse = new TicketsController(service, new OneMovie("test-movie"), qr) { ControllerContext = Context(Bob) };
        Check(await someoneElse.QrPng(hold.Reference, default) is NotFoundResult, "Another user cannot download it");
    });
}

async Task RunD1(string name, Func<Task> test)
{
    try { await test(); passed++; Console.WriteLine($"PASS [d1] {name}"); }
    catch (Exception ex) { failures.Add($"[d1] {name}: {ex.Message}"); Console.WriteLine($"FAIL [d1] {name}: {ex.Message}"); }
}

await RunD1("an expired hold frees its seats and an expired session is not restored", async () =>
{
    using var fake = new FakeD1(Alice, Bob);
    var service = new D1BookingService(fake.Client(), new MemoryCache(new MemoryCacheOptions()));
    var show = (await service.GetShowtimesAsync("test-movie")).First(s => s.IsAvailable);
    var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D1", "VP1"]));
    await service.SaveDraftSeatsAsync(Bob, show.Id, ["E1"]);

    fake.Exec("UPDATE bookings SET expires_at = '2000-01-01T00:00:00.000Z'; UPDATE booking_drafts SET expires_at = '2000-01-01T00:00:00.000Z';");

    Check(await service.GetBookingAsync(Alice, hold.Id) is null, "Expired hold is gone for its owner");
    Check(!(await service.ConfirmBookingAsync(Alice, hold.Id)).Succeeded, "Expired hold cannot be confirmed");
    var fresh = new D1BookingService(fake.Client(), new MemoryCache(new MemoryCacheOptions()));
    Check((await fresh.GetSeatsAsync(show.Id)).Where(s => s.Id is "D1" or "VP1").All(s => s.State == SeatState.Available), "Seats show as free");
    Held(await fresh.HoldSeatsAsync(Bob, show.Id, ["D1", "VP1"]));
    Check(fake.Scalar("SELECT COUNT(*) FROM booking_seats WHERE seat_id IN ('D1', 'VP1')") == 2, "Old seat rows were removed, new ones kept");
    Check((await fresh.StartDraftAsync(Bob, show.Id))!.SeatIds.Count == 0, "Expired session is not restored");
});

await RunD1("bookings confirmed before ticket tokens existed get a working QR code on My Tickets", async () =>
{
    using var fake = new FakeD1(Alice);
    var service = new D1BookingService(fake.Client(), new MemoryCache(new MemoryCacheOptions()));
    var show = (await service.GetShowtimesAsync("test-movie")).First(s => s.IsAvailable);
    var hold = Held(await service.HoldSeatsAsync(Alice, show.Id, ["D4"]));
    await service.ConfirmBookingAsync(Alice, hold.Id);
    fake.Exec("UPDATE bookings SET ticket_token = NULL;");

    var tickets = new TicketsController(service, new OneMovie("test-movie"), MakeQr()) { ControllerContext = Context(Alice) };
    var view = (await tickets.Details(hold.Reference, "test-movie", default) as ViewResult)?.Model as Ticket;
    Check(BookingRules.IsTicketToken(view?.TicketToken), "The ticket page gave the old booking a token");
    Check(fake.Scalar("SELECT COUNT(*) FROM bookings WHERE ticket_token IS NOT NULL") == 1, "The token was saved");
    Check((await service.GetBookingByTicketTokenAsync(view!.TicketToken!))?.Id == hold.Id, "Scanning it finds the booking");
});

await RunD1("opening the seat page and saving picks stay within a few D1 round trips", async () =>
{
    using var fake = new FakeD1(Alice);
    var cache = new MemoryCache(new MemoryCacheOptions());
    var show = (await new D1BookingService(fake.Client(), cache).GetShowtimesAsync("test-movie")).First(s => s.IsAvailable);
    await new D1BookingService(fake.Client(), cache).StartDraftAsync(Alice, show.Id);

    var before = fake.Queries;
    var page = new D1BookingService(fake.Client(), cache);
    await page.GetShowtimeAsync(show.Id);
    await page.StartDraftAsync(Alice, show.Id);
    await page.GetSeatsAsync(show.Id);
    Check(fake.Queries - before <= 3, $"Seat page used {fake.Queries - before} queries");

    before = fake.Queries;
    await new D1BookingService(fake.Client(), cache).SaveDraftSeatsAsync(Alice, show.Id, ["D4"]);
    Check(fake.Queries - before <= 2, $"Saving picks used {fake.Queries - before} queries");
});

Console.WriteLine(failures.Count == 0
    ? $"{passed} booking checks passed."
    : $"{passed} passed, {failures.Count} failed:{Environment.NewLine}{string.Join(Environment.NewLine, failures)}");
return failures.Count == 0 ? 0 : 1;

static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }

static BookingHold Held(HoldResult result) => result.Booking ?? throw new Exception($"Hold failed: {result.Error}");

static ControllerContext Context(int userId) => new()
{
    HttpContext = new DefaultHttpContext
    {
        User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "test")),
    },
};

static string? DecodeQr(byte[] png)
{
    using var image = SixLabors.ImageSharp.Image.Load<SixLabors.ImageSharp.PixelFormats.Rgba32>(png);
    var pixels = new byte[image.Width * image.Height * 4];
    image.CopyPixelDataTo(pixels);
    var source = new ZXing.RGBLuminanceSource(pixels, image.Width, image.Height, ZXing.RGBLuminanceSource.BitmapFormat.RGBA32);
    var result = new ZXing.QrCode.QRCodeReader().decode(new ZXing.BinaryBitmap(new ZXing.Common.HybridBinarizer(source)));
    return result?.Text;
}

static TicketQrService MakeQr(string? baseUrl = null) =>
    new(Microsoft.Extensions.Options.Options.Create(new AppOptions { BaseUrl = baseUrl ?? "" }), new TestEnv(Path.Combine(AppContext.BaseDirectory, "wwwroot")));

static bool HasTeal(byte[] png)
{
    using var image = SixLabors.ImageSharp.Image.Load<SixLabors.ImageSharp.PixelFormats.Rgba32>(png);
    for (var y = image.Height * 2 / 5; y < image.Height * 3 / 5; y++)
        for (var x = image.Width * 2 / 5; x < image.Width * 3 / 5; x++)
        {
            var p = image[x, y];
            if (p.R < 80 && p.G > 150 && p.B > 140) return true;
        }
    return false;
}

static BookingController Booking(IBookingService service, int userId)
{
    var controller = new BookingController(new OneMovie("test-movie"), service) { ControllerContext = Context(userId) };
    controller.TempData = new TempDataDictionary(controller.HttpContext, new NoTempData());
    return controller;
}

sealed class NoTempData : ITempDataProvider
{
    public IDictionary<string, object> LoadTempData(HttpContext context) => new Dictionary<string, object>();
    public void SaveTempData(HttpContext context, IDictionary<string, object> values) { }
}

sealed class OneMovie(string slug) : IMovieRepository
{
    private readonly Movie movie = new(1, slug, "Test Movie", "Drama", 120, "PG", "Thai", "", "", MovieStatus.NowShowing,
        null, null, "ink-orbit", null, []);

    public Task<IReadOnlyList<Movie>> GetByStatusAsync(MovieStatus status, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Movie>>(status == MovieStatus.NowShowing ? [movie] : []);
    public Task<Movie?> GetBySlugAsync(string value, CancellationToken cancellationToken = default) =>
        Task.FromResult<Movie?>(string.Equals(value, slug, StringComparison.OrdinalIgnoreCase) ? movie : null);
    public Task<IReadOnlyList<Movie>> SearchAsync(string query, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Movie>>([]);
    public Task<MovieSaveResult> CreateAsync(MovieForm form, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<MovieSaveResult> UpdateAsync(int id, MovieForm form, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<bool> ArchiveAsync(int id, CancellationToken cancellationToken = default) => throw new NotSupportedException();
}

sealed class TestEnv(string webRoot) : Microsoft.AspNetCore.Hosting.IWebHostEnvironment
{
    public string WebRootPath { get; set; } = webRoot;
    public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    public string ApplicationName { get; set; } = "tests";
    public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public string EnvironmentName { get; set; } = "Test";
}
