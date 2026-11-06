namespace CMM_Cinema.Models;

public record NewsStory(string Slug, string Title, string Category, string Date, string Excerpt)
{
    public string Url => $"/News/{Slug}";
}

public static class NewsData
{
    public static IReadOnlyList<NewsStory> Stories { get; } =
    [
        new("last-horizon", "Behind the scenes of The Last Horizon", "Feature", "Oct 12, 2026", "A week on set with the crew: desert night shoots and a hand-built spaceship cockpit."),
        new("paper-moons", "Paper Moons wins the audience award", "Awards", "Oct 08, 2026", "The quiet coming-of-age drama opens next Friday with a director's introduction."),
        new("horror-marathon", "Midnight horror marathon returns", "Events", "Oct 03, 2026", "Five films, one night, unlimited popcorn. Survive until sunrise and breakfast is on us."),
        new("hall-3-recliners", "New recliner seats arrive in Hall 3", "Cinema", "Sep 27, 2026", "Fully reclining seats, wider aisles and a brighter laser projector."),
        new("director-qa", "Director Q&A night", "Events", "Sep 20, 2026", "A screening followed by a live Q&A with the director and cast."),
        new("double-points", "Double points on weekdays", "Membership", "Sep 14, 2026", "Monday to Thursday screenings now earn double member points."),
        new("student-wednesdays", "Student Wednesdays", "Promotion", "Sep 05, 2026", "Show a valid student card and every Wednesday screening is one low price."),
        new("4k-revivals", "A month of 4K revivals", "Programme", "Aug 29, 2026", "Newly restored classics in 4K, each paired with a short talk."),
        new("family-mornings", "Family mornings every Saturday", "Events", "Aug 22, 2026", "Gentle sound, lights half up and a smaller price for little ones."),
        new("gift-cards", "New cinema gift cards", "Promotion", "Aug 15, 2026", "Pick an amount, add a note and send it straight to someone’s phone."),
        new("short-film-night", "Local short film night", "Programme", "Aug 08, 2026", "Eight short films by local makers, followed by drinks in the lobby."),
        new("new-snack-bar", "The snack bar gets a makeover", "Cinema", "Aug 01, 2026", "Fresh popcorn flavours, a faster counter and seats while you wait."),
    ];

    public static string Art(int index) => $"/images/news/story-{index + 1}.svg";
}

public record NewsStoryViewModel(NewsStory Story, int Index, int Count);
