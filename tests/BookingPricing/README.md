These checks use a fresh `DemoBookingService` per case. They do not start a web server or connect to a database/payment provider.

Run from the repository root, keeping build artifacts separate from a running `dotnet watch`:

```sh
dotnet run --project tests/BookingPricing --artifacts-path /private/tmp/cmm-booking-pricing-tests
```
