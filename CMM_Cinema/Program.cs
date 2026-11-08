using CMM_Cinema.Services;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);
builder.Services.AddHsts(options => options.MaxAge = TimeSpan.FromDays(365));

// Add services to the container.
builder.Services.AddControllersWithViews();


builder.Services.Configure<CloudflareD1Options>(builder.Configuration.GetSection("Cloudflare"));
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<D1Client>(client => client.BaseAddress = new Uri("https://api.cloudflare.com/client/v4/"));
if (builder.Configuration.GetSection("Cloudflare").Get<CloudflareD1Options>()?.IsConfigured == true)
{
    builder.Services.AddScoped<IMovieRepository, D1MovieRepository>();
}
else
{
    builder.Services.AddSingleton<IMovieRepository, EmptyMovieRepository>();
}

// News comes from the D1 `news` table, with generated placeholder stories filling any gap.
builder.Services.AddScoped<MockNewsRepository>();
if (builder.Configuration.GetSection("Cloudflare").Get<CloudflareD1Options>()?.IsConfigured == true)
    builder.Services.AddScoped<INewsRepository, D1NewsRepository>();
else
    builder.Services.AddScoped<INewsRepository>(sp => sp.GetRequiredService<MockNewsRepository>());
builder.Services.AddHttpClient("news-art", client => client.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddSingleton<NewsArtService>();
builder.Services.AddHostedService<NewsArtWarmup>();

// Demo booking flow: showtimes, seat holds and payments are kept in memory until bookings move to D1.
builder.Services.AddSingleton<IBookingService, DemoBookingService>();

builder.Services.AddCinemaAuth(builder.Configuration);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // HSTS stays off in development: browsers would remember it for every localhost port.
    app.UseHsts();
}

app.UseSecurityHeaders(SecurityHeadersSetup.Policies());
app.UseHttpsRedirection();

app.UseRouting();

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();


app.Run();
