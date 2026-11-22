-- Apply after 0008_admin_booking_accounts.sql: npx wrangler d1 execute <database-name> --remote --file=Data/migrations/0009_user_profiles.sql

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone           TEXT,
    notify_releases INTEGER NOT NULL DEFAULT 1 CHECK (notify_releases IN (0, 1)),
    notify_offers   INTEGER NOT NULL DEFAULT 1 CHECK (notify_offers IN (0, 1)),
    notify_bookings INTEGER NOT NULL DEFAULT 1 CHECK (notify_bookings IN (0, 1)),
    notify_news     INTEGER NOT NULL DEFAULT 0 CHECK (notify_news IN (0, 1)),
    updated_at      TEXT    NOT NULL
);
