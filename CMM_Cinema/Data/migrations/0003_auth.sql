
CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY,
    email             TEXT    NOT NULL UNIQUE COLLATE NOCASE,  -- app stores it trimmed and lowercased
    name              TEXT    NOT NULL,
    password_hash     TEXT,                                    -- Argon2id string; NULL for Google-only accounts
    email_verified    INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
    email_verified_at TEXT,
    failed_logins     INTEGER NOT NULL DEFAULT 0,
    lockout_until     TEXT,                                    -- NULL when the account is not locked
    security_stamp    TEXT    NOT NULL,                        -- random; changing it signs out every session
    created_at        TEXT    NOT NULL,
    updated_at        TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS user_logins (
    provider     TEXT    NOT NULL,                             -- e.g. 'Google'
    provider_key TEXT    NOT NULL,                             -- provider's permanent user id (Google 'sub'), never the email
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT    NOT NULL,
    PRIMARY KEY (provider, provider_key)
);

CREATE TABLE IF NOT EXISTS email_tokens (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    TEXT    NOT NULL CHECK (purpose IN ('verify', 'reset')),
    token_hash TEXT    NOT NULL UNIQUE,                        -- SHA-256 of the emailed token; the raw token is never stored
    expires_at TEXT    NOT NULL,
    used_at    TEXT,                                           -- set once used, so a link works only once
    created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_logins_user ON user_logins(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, purpose);
