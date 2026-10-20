using CMM_Cinema.Models;

namespace CMM_Cinema.Services;

// Placeholder data until the Cloudflare D1 database is connected.
public sealed class DemoMovieRepository : IMovieRepository
{
    private static readonly IReadOnlyList<Movie> Movies =
    [
        new(1, "the-last-horizon", "The Last Horizon", "Action", 138, "PG-13", "ENG",
            "A burned-out pilot has one launch left to outrun the collapse of the last colony.",
            "Captain Mara Quill swore she would never fly again. But when the last colony on the edge of charted space starts to fall apart, she is the only pilot left who knows the route home. With a patched-up ship, a crew of strangers and one launch window, she has to outrun the collapse before the horizon closes for good.",
            MovieStatus.NowShowing, null, null, "ink-orbit", "The Last\nHorizon",
            [new("Ava Linwood", "Mara Quill"), new("Theo Marsh", "Jonah Reyes"), new("Priya Navan", "Dr. Sela Ortiz")]),
        new(2, "neon-harbor", "Neon Harbor", "Thriller", 112, "R", "ENG",
            "A night-shift detective follows a trail of flickering signs into the city's darkest port.",
            "Every night the signs along the harbor flicker in the same strange pattern, and every morning someone is missing. Detective Eli Strand starts reading the lights like a code, and they lead him deeper into a port where nobody wants to be found.",
            MovieStatus.NowShowing, null, null, "sky-arch", null,
            [new("Marcus Hale", "Eli Strand"), new("June Okafor", "Rina Vale"), new("Sam Whitley", "Captain Dorne")]),
        new(3, "paper-moons", "Paper Moons", "Animation", 100, "G", "ENG",
            "Two paper-cut siblings fold their way across the night sky to bring a lost moon home.",
            "When the moon falls out of the sky and lands in their paper town, siblings Pip and Tuck decide to take it back. They fold boats, birds and bridges out of anything they can find on a journey across a night sky full of wind, rain and surprises.",
            MovieStatus.NowShowing, null, null, "sun-eclipse", null,
            [new("Lily Brooks", "Pip (voice)"), new("Noah Kim", "Tuck (voice)"), new("Grace Ellery", "The Moon (voice)")]),
        new(4, "hollow-pines", "Hollow Pines", "Horror", 107, "R", "ENG",
            "A weekend cabin trip turns strange when the forest starts answering back.",
            "Five old friends rent a cabin deep in Hollow Pines for one last weekend together. On the first night they shout into the trees for fun. On the second night, the trees shout back.",
            MovieStatus.NowShowing, null, null, "brick-stripes", null,
            [new("Chloe Barnes", "Tessa"), new("Ryan Doyle", "Mike"), new("Isaac Ford", "The Ranger")]),
        new(5, "midnight-reel", "Midnight Reel", "Comedy", 98, "PG-13", "ENG",
            "A failing projectionist discovers his old reels play scenes from tomorrow.",
            "Gus runs the last single-screen cinema in town and it is about to close. Then he finds a box of unmarked reels that show tomorrow's local news. Saving the cinema should be easy. Keeping the town from noticing is the hard part.",
            MovieStatus.NowShowing, null, null, "ink-eclipse", "Midnight\nReel",
            [new("Oscar Bell", "Gus"), new("Hana Mori", "Frankie"), new("Leo Grant", "Mayor Pratt")]),
        new(6, "glass-lanterns", "Glass Lanterns", "Fantasy", 124, "PG", "ENG",
            "A glassblower's apprentice lights a lantern that leads to a forgotten kingdom.",
            "Nell has spent years sweeping the floor of a glassblower's workshop. The first lantern she makes on her own glows with a light that shows a road nobody else can see, and it leads to a kingdom that was erased from every map.",
            MovieStatus.NowShowing, null, null, "sun-arch", "Glass\nLanterns",
            [new("Ella Shaw", "Nell"), new("Victor Lane", "Master Orrin"), new("Maya Patel", "Queen Ilse")]),
        new(7, "silver-tide", "Silver Tide", "Sci-Fi", 125, "PG", "ENG",
            "When the oceans glow silver, one marine biologist hears a message in the waves.",
            "Overnight, every ocean on Earth starts to glow silver. While the world panics, marine biologist Dr. Iris Kahale notices that the light pulses in a rhythm, and she is the first to realise that something under the water is trying to talk.",
            MovieStatus.Upcoming, new DateOnly(2026, 11, 13), null, "brick-orbit", "Silver\nTide",
            [new("Nina Kahale", "Dr. Iris Kahale"), new("Daniel Cho", "Ben Ashford"), new("Ruth Adler", "Admiral Kane")]),
        new(8, "crimson-garden", "Crimson Garden", "Drama", 118, "PG-13", "ENG",
            "A widowed florist finds a hidden garden that blooms with long-buried family secrets.",
            "After her husband's death, florist Clara Wren finds a key to a walled garden she never knew existed. Each flower that blooms there reveals another secret her family kept buried for three generations.",
            MovieStatus.Upcoming, new DateOnly(2026, 11, 27), null, "sun-arch", "Crimson\nGarden",
            [new("Helen Ward", "Clara Wren"), new("Tom Ellis", "Arthur Wren"), new("Sofia Ruiz", "Lena")]),
        new(9, "echo-valley", "Echo Valley", "Adventure", 104, "PG", "ENG",
            "Three strangers follow a legendary echo into a valley that is on no map.",
            "A guide, a runaway and a retired cartographer all hear the same echo calling from the mountains. Together they follow it into a valley that appears on no map and answers every question they shout into it.",
            MovieStatus.Upcoming, new DateOnly(2026, 12, 4), null, "ink-eclipse", null,
            [new("Jack Moreno", "Wes"), new("Aria Lin", "Kit"), new("George Hart", "Professor Bram")]),
        new(10, "velvet-skies", "Velvet Skies", "Romance", 96, "PG-13", "ENG",
            "Two night-flight attendants trade stories and slowly fall for each other across time zones.",
            "Rosa and Dev work the same overnight route but never on the same flight. They start leaving notes for each other in the galley, and across a year of red-eyes and time zones, the notes turn into something neither of them planned.",
            MovieStatus.Upcoming, new DateOnly(2026, 12, 11), null, "sky-stripes", null,
            [new("Rosa Delgado", "Rosa"), new("Dev Sharma", "Dev"), new("Claire Moss", "Captain Hale")]),
        new(11, "iron-orchard", "Iron Orchard", "Western", 131, "R", "ENG",
            "A retired sheriff defends the last orchard in a town run by a mining baron.",
            "Sheriff Ada Cole hung up her badge years ago and planted apple trees. When a mining baron decides her orchard sits on the richest seam in the territory, she has to decide how much of her old life she is willing to dig back up.",
            MovieStatus.Upcoming, new DateOnly(2026, 12, 18), null, "ink-orbit", "Iron\nOrchard",
            [new("Diane Royce", "Ada Cole"), new("Carl Benton", "Silas Crane"), new("Eli Navarro", "Deputy Ruiz")]),
        new(12, "little-comet", "Little Comet", "Family", 92, "G", "ENG",
            "A girl and a runaway comet race across the galaxy before it burns out.",
            "When a tiny comet crash-lands in her backyard, ten-year-old Juno promises to get it home. Their trip across the galaxy is full of space whales, grumpy moons and one very lost satellite.",
            MovieStatus.Upcoming, new DateOnly(2027, 1, 8), null, "sky-arch", "Little\nComet",
            [new("Zoe Parker", "Juno (voice)"), new("Ben Rhodes", "Comet (voice)"), new("Ivy Chen", "Mom (voice)")]),
    ];

    public Task<IReadOnlyList<Movie>> GetByStatusAsync(MovieStatus status, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Movie>>(Movies.Where(movie => movie.Status == status).ToArray());

    public Task<Movie?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        Task.FromResult(Movies.FirstOrDefault(movie => string.Equals(movie.Slug, slug, StringComparison.OrdinalIgnoreCase)));
}
