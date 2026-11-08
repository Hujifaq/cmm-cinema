CREATE TABLE IF NOT EXISTS admins (
    id             INTEGER PRIMARY KEY,
    username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash  TEXT    NOT NULL,
    failed_logins  INTEGER NOT NULL DEFAULT 0,
    lockout_until  TEXT,
    security_stamp TEXT    NOT NULL,
    created_at     TEXT    NOT NULL,
    updated_at     TEXT    NOT NULL
);
