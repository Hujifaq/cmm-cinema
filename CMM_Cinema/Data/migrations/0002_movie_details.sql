

ALTER TABLE movies ADD COLUMN trailer_url  TEXT;                                   -- YouTube/Vimeo link
ALTER TABLE movies ADD COLUMN backdrop_url TEXT;                                   -- wide image for the detail page
ALTER TABLE movies ADD COLUMN director     TEXT;
ALTER TABLE movies ADD COLUMN is_archived  INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)); -- hide instead of delete once bookings exist
ALTER TABLE movies ADD COLUMN created_at   TEXT;                                   -- ISO timestamp, set by the app
ALTER TABLE movies ADD COLUMN updated_at   TEXT;

CREATE INDEX IF NOT EXISTS idx_movies_archived ON movies(is_archived, status);
