using CMM_Cinema.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Movies come from Cloudflare D1 once Cloudflare:AccountId, DatabaseId and ApiToken are set (user-secrets);
// until then the site runs with no movies instead of crashing.
builder.Services.Configure<CloudflareD1Options>(builder.Configuration.GetSection("Cloudflare"));
builder.Services.AddMemoryCache();
if (builder.Configuration.GetSection("Cloudflare").Get<CloudflareD1Options>()?.IsConfigured == true)
{
    builder.Services.AddHttpClient<D1Client>(client => client.BaseAddress = new Uri("https://api.cloudflare.com/client/v4/"));
    builder.Services.AddScoped<IMovieRepository, D1MovieRepository>();
}
else
{
    builder.Services.AddSingleton<IMovieRepository, EmptyMovieRepository>();
}

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();


app.Run();
