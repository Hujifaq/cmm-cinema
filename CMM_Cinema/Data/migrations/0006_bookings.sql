-- Booking flow storage: showtimes, seat holds and confirmed bookings, and each user's seat-picking session.
-- Apply with: npx wrangler d1 execute <database-name> --remote --file=Data/migrations/0006_bookings.sql

-- The app creates the next 7 days of showtimes for a movie the first time they are asked for.
-- Ids never change afterwards, so bookings keep pointing at the right screening.
CREATE TABLE IF NOT EXISTS showtimes (
    id           INTEGER PRIMARY KEY,
    movie_slug   TEXT    NOT NULL,                             -- lowercase movie slug
    cinema_id    INTEGER NOT NULL,                             -- cinemas are fixed in code (BookingRules.Cinemas)
    show_date    TEXT    NOT NULL,                             -- yyyy-MM-dd, Bangkok time
    start_time   TEXT    NOT NULL,                             -- HH:mm, Bangkok time
    format       TEXT    NOT NULL,
    language     TEXT    NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
    UNIQUE (movie_slug, cinema_id, show_date, start_time, format, language)
);

CREATE INDEX IF NOT EXISTS showtimes_by_movie_date ON showtimes (movie_slug, show_date);

-- A held booking keeps its seats until expires_at; a confirmed one keeps them for good.
CREATE TABLE IF NOT EXISTS bookings (
    id           TEXT    PRIMARY KEY,                          -- GUID
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    showtime_id  INTEGER NOT NULL REFERENCES showtimes(id),
    status       TEXT    NOT NULL CHECK (status IN ('held', 'confirmed')),
    expires_at   TEXT    NOT NULL,                             -- end of the hold; ignored once confirmed
    created_at   TEXT    NOT NULL,
    confirmed_at TEXT
);

CREATE INDEX IF NOT EXISTS bookings_by_user ON bookings (user_id, status);
CREATE INDEX IF NOT EXISTS bookings_by_expiry ON bookings (status, expires_at);

-- The UNIQUE (showtime_id, seat_id) rule is what stops two people holding or buying the same seat.
CREATE TABLE IF NOT EXISTS booking_seats (
    booking_id  TEXT    NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    showtime_id INTEGER NOT NULL REFERENCES showtimes(id),
    seat_id     TEXT    NOT NULL,                              -- e.g. 'D4', or 'VP1' for a VIP pair
    position    INTEGER NOT NULL,                              -- display order within the booking
    category    TEXT    NOT NULL CHECK (category IN ('Normal', 'Premium', 'Vip')),
    price       INTEGER NOT NULL,                              -- baht, copied at hold time
    capacity    INTEGER NOT NULL DEFAULT 1 CHECK (capacity IN (1, 2)),
    PRIMARY KEY (booking_id, seat_id),
    UNIQUE (showtime_id, seat_id)
);

-- One temporary seat-picking session per user. It remembers picks but does not reserve them.
CREATE TABLE IF NOT EXISTS booking_drafts (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    showtime_id INTEGER NOT NULL REFERENCES showtimes(id),
    seat_ids    TEXT    NOT NULL DEFAULT '',                   -- comma-separated, e.g. 'D4,D5,VP1'
    expires_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS booking_drafts_by_expiry ON booking_drafts (expires_at);
