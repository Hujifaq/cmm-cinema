-- Apply after 0009_user_profiles.sql: npx wrangler d1 execute <database-name> --remote --file=Data/migrations/0010_promotions.sql

CREATE TABLE IF NOT EXISTS promotions (
    id         INTEGER PRIMARY KEY,
    image_url  TEXT    NOT NULL,                        -- wide (16:9) banner: a full https:// link, or one of the built-in /images/promos/ files
    image_alt  TEXT    NOT NULL,                        -- describes the banner for screen readers and the site search
    sort_order INTEGER NOT NULL DEFAULT 0,              -- left to right in the carousel; the app keeps it 0, 1, 2...
    is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)), -- 0 = hidden from the site without deleting it
    created_at TEXT    NOT NULL,                        -- ISO timestamp, set by the app
    updated_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_promotions_order ON promotions(is_active, sort_order, id);

-- The four banners the site launched with, added only while the table is empty.
INSERT INTO promotions (image_url, image_alt, sort_order, is_active, created_at, updated_at)
SELECT column1, column2, column3, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
FROM (VALUES
    ('/images/promos/student-privilege-promo.webp', 'Student privilege: 50 baht off for KMUTT students at the CMM branch', 0),
    ('/images/promos/iphone-duo-promo.webp', 'Lucky draw: win an iPhone Duo from CMM Cinema', 1),
    ('/images/promos/sale-12-12-promo.webp', '12.12 sale: movie ticket prices reduced', 2),
    ('/images/promos/movie-combo-promo.webp', 'Movie combo: large popcorn, a 32 oz drink and a ticket for 199 baht', 3)
)
WHERE NOT EXISTS (SELECT 1 FROM promotions);
