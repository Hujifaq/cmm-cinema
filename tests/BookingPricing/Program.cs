using CMM_Cinema.Models;
using CMM_Cinema.Services;
using CMM_Cinema.Controllers;
using Microsoft.AspNetCore.Mvc;

// Isolated in-memory regression checks. No web host, movie repository, D1 or real payment service.
var passed = 0;
void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
void Run(string name, Action test) { test(); passed++; Console.WriteLine($"PASS: {name}"); }
(DemoBookingService Service, Showtime Show) Setup()
{
    var service = new DemoBookingService();
    return (service, service.GetShowtimes("test-movie").First(show => show.IsAvailable));
}
Run("seat inventory matches Normal F–D, Premium C–A and eight atomic VIP pairs", () => {
    var (service, show) = Setup();
    var seats = service.GetSeats(show.Id);
    Check(seats.Count == 104 && seats.Select(s => s.Id).Distinct().Count() == 104, "Unique inventory");
    Check(seats.Count(s => s.Category == SeatCategory.Normal) == 48, "Normal count");
    Check(seats.Count(s => s.Category == SeatCategory.Premium) == 48, "Premium count");
    Check(seats.Count(s => s.Category == SeatCategory.Vip && s.Capacity == 2) == 8, "VIP pairs");
    Check(seats.Sum(s => s.Capacity) == 112, "Admission capacity");
    Check(seats.All(s => s.Price == (s.Category == SeatCategory.Normal ? 300 : s.Category == SeatCategory.Premium ? 330 : 900)), "Authoritative prices");
});
Run("mixed-category hold snapshots prices and charges VIP once per pair", () => {
    var (service, show) = Setup();
    Check(service.TryHoldSeats(show.Id, ["D1", "C1", "VP1"], out var hold, out var error), error);
    Check(hold!.Total == 1530 && hold.TicketCount == 4 && hold.Seats.Count == 3, "Mixed sum / admissions");
    Check(hold.SeatItems.Single(s => s.Id == "VP1").Price == 900, "Pair price");
    Check(service.GetBooking(hold.Id)!.Total == 1530, "Stored total");
});
Run("duplicate and lowercase IDs cannot double-charge a selection", () => {
    var (service, show) = Setup();
    Check(service.TryHoldSeats(show.Id, [" d1 ", "D1", "vp1"], out var hold, out var error), error);
    Check(hold!.Total == 1200 && hold.TicketCount == 3 && hold.Seats.Count == 2, "Normalized units");
});
Run("VIP cannot be split, held twice, or booked when sold; cancellation releases it", () => {
    var (service, show) = Setup();
    Check(!service.TryHoldSeats(show.Id, ["VP1A"], out _, out _), "No half-pair ID");
    Check(!service.TryHoldSeats(show.Id, ["VP3"], out _, out _), "Presold VIP blocked");
    Check(service.TryHoldSeats(show.Id, ["VP1"], out var hold, out var error), error);
    Check(!service.TryHoldSeats(show.Id, ["VP1"], out _, out _), "Held pair blocked");
    service.CancelHold(hold!.Id);
    Check(service.TryHoldSeats(show.Id, ["VP1"], out var second, out error), error);
    Check(service.TryConfirmBooking(second!.Id, out error), error);
    Check(service.GetBooking(second.Id)!.Status == BookingStatus.Confirmed, "Demo confirmation");
    Check(service.GetSeats(show.Id).Single(s => s.Id == "VP1").State == SeatState.Sold, "Confirmed pair unavailable");
    Check(!service.TryHoldSeats(show.Id, ["VP1"], out _, out _), "Sold pair blocked");
});
Run("eight-admission limit counts VIP pairs as two and accepts exactly four pairs", () => {
    var (service, show) = Setup();
    Check(!service.TryHoldSeats(show.Id, ["D1","D2","D3","D4","D5","D6","D7","VP1"], out _, out _), "Nine admissions rejected");
    Check(!service.TryHoldSeats(show.Id, ["VP1","VP2","VP4","VP5","VP6"], out _, out _), "Five pairs rejected");
    Check(service.TryHoldSeats(show.Id, ["VP1","VP2","VP4","VP5"], out var hold, out var error), error);
    Check(hold!.TicketCount == 8 && hold.Total == 3600, "Four pairs total");
});
Run("unknown rows, out-of-range seat IDs and empty requests are rejected", () => {
    foreach (var id in new[] { "G1", "A17", "VP0", "VP9", "fake" }) {
        var (service, show) = Setup();
        Check(!service.TryHoldSeats(show.Id, [id], out _, out _), $"Rejected {id}");
    }
    var (s, t) = Setup();
    Check(!s.TryHoldSeats(t.Id, [], out _, out _), "Empty rejected");
});
Run("Summary confirms directly without a payment method, and repeating it is safe", () => {
    var (service, show) = Setup();
    Check(service.TryHoldSeats(show.Id, ["D1", "VP1"], out var hold, out var error), error);
    var controller = new BookingController(new EmptyMovieRepository(), service);
    var result = controller.Confirm(hold!.Id) as RedirectToActionResult;
    Check(result?.ActionName == nameof(BookingController.Confirmation), "Direct confirmation redirect");
    Check((Guid)result!.RouteValues!["bookingId"]! == hold.Id, "Same booking ID");
    Check(service.GetBooking(hold.Id)!.Status == BookingStatus.Confirmed, "Confirmed status");
    Check(service.GetBooking(hold.Id)!.Total == 1200, "Total remains authoritative");
    Check(service.TryConfirmBooking(hold.Id, out error), error);
    service.CancelHold(hold.Id);
    Check(service.GetBooking(hold.Id)!.Status == BookingStatus.Confirmed, "Confirmed booking cannot be cancelled as a hold");
    Check(service.GetSeats(show.Id).Where(s => hold.Seats.Contains(s.Id)).All(s => s.State == SeatState.Sold), "Seats remain unavailable after repeated confirmation");
    var confirm = typeof(BookingController).GetMethod(nameof(BookingController.Confirm))!;
    Check(Attribute.IsDefined(confirm, typeof(HttpPostAttribute)), "Confirmation requires POST");
    Check(Attribute.IsDefined(confirm, typeof(ValidateAntiForgeryTokenAttribute)), "Confirmation retains anti-forgery validation");
});
Run("legacy payment routes return to Summary without confirming a hold", () => {
    var (service, show) = Setup();
    Check(service.TryHoldSeats(show.Id, ["D1"], out var hold, out var error), error);
    var controller = new BookingController(new EmptyMovieRepository(), service);
    Check((controller.Payment(hold!.Id) as RedirectToActionResult)?.ActionName == nameof(BookingController.Summary), "Legacy GET redirect");
    Check((controller.Pay(hold.Id) as RedirectToActionResult)?.ActionName == nameof(BookingController.Summary), "Legacy POST redirect");
    Check(service.GetBooking(hold.Id)!.Status == BookingStatus.Held, "Legacy routes cannot confirm");
});
Run("confirmation rejects unavailable or released holds", () => {
    var (service, show) = Setup();
    Check(service.TryHoldSeats(show.Id, ["D1"], out var hold, out var error), error);
    service.CancelHold(hold!.Id);
    Check(!service.TryConfirmBooking(hold.Id, out _), "Released hold rejected");
    Check(!service.TryConfirmBooking(Guid.NewGuid(), out _), "Unknown booking rejected");
    var controller = new BookingController(new EmptyMovieRepository(), service);
    Check((controller.Confirm(hold.Id) as RedirectToActionResult)?.ActionName == nameof(BookingController.Showtimes), "Unavailable booking restarts flow");
});
Console.WriteLine($"{passed} booking pricing and flow checks passed.");
