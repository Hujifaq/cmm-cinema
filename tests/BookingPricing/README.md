These checks run every case twice: against a fresh `DemoBookingService`, and against `D1BookingService` talking to `FakeD1`, a private in-memory SQLite database loaded with `0006_bookings.sql` that answers in D1's response format. They do not start a web server or connect to the real D1 database or a payment provider.

Run from the repository root, keeping build artifacts separate from a running `dotnet watch`:

```sh
dotnet run --project tests/BookingPricing --artifacts-path /private/tmp/cmm-booking-pricing-tests
```
