CREATE TABLE IF NOT EXISTS news (
    id                  INTEGER PRIMARY KEY,
    slug                TEXT    NOT NULL UNIQUE COLLATE NOCASE,  -- the page address: /News/{slug}
    title               TEXT    NOT NULL,
    category            TEXT    NOT NULL,                        -- e.g. 'Feature', 'Events', 'Promotion', 'Coming soon'
    excerpt             TEXT    NOT NULL,                        -- one or two sentences: the home section, the discs, link previews
    body                TEXT,                                    -- full article; a blank line starts a new paragraph
    movie_id            INTEGER REFERENCES movies(id) ON DELETE SET NULL, -- the movie this story is about (optional)
    image_landscape_url TEXT    NOT NULL,                        -- wide (16:9) movie poster or still: home section and story page
    image_alt           TEXT,                                    -- describes the image for screen readers
    published_at        TEXT    NOT NULL,                        -- ISO date/time; newest first. A future time keeps it hidden until then
    is_published        INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)), -- 0 = draft or hidden, without deleting it
    created_at          TEXT    NOT NULL,                        -- ISO timestamp, set by the app
    updated_at          TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_movie ON news(movie_id);
