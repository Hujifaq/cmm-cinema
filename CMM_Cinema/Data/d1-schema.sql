-- Cloudflare D1 schema matching Models/Movie.cs.
-- Apply with: npx wrangler d1 execute <database-name> --file=Data/d1-schema.sql

CREATE TABLE IF NOT EXISTS movies (
    id               INTEGER PRIMARY KEY,
    slug             TEXT    NOT NULL UNIQUE,      -- used in /Movies/{slug}
    title            TEXT    NOT NULL,
    genre            TEXT    NOT NULL,
    duration_minutes INTEGER NOT NULL,
    rating           TEXT    NOT NULL,             -- e.g. G, PG, PG-13, R
    language         TEXT    NOT NULL,             -- e.g. ENG
    synopsis         TEXT    NOT NULL,             -- one line, shown on cards
    overview         TEXT    NOT NULL,             -- full paragraph, shown on the detail page
    status           TEXT    NOT NULL CHECK (status IN ('NowShowing', 'Upcoming')),
    release_date     TEXT,                         -- ISO date, YYYY-MM-DD
    poster_url       TEXT,                         -- real poster image; overrides poster_theme
    poster_theme     TEXT    NOT NULL DEFAULT 'ink-orbit',
    poster_title     TEXT                          -- optional line breaks for the drawn poster
);

CREATE TABLE IF NOT EXISTS cast_members (
    id         INTEGER PRIMARY KEY,
    movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    role       TEXT    NOT NULL,
    photo_url  TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);
CREATE INDEX IF NOT EXISTS idx_cast_members_movie ON cast_members(movie_id, sort_order);
