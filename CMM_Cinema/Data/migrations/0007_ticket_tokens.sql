-- Ticket QR codes: each confirmed booking gets a random, unguessable token. Its QR code opens /t/{token},
-- a public page showing that ticket's details and status, for both customers and cinema staff.
-- Apply after 0006_bookings.sql: npx wrangler d1 execute <database-name> --remote --file=Data/migrations/0007_ticket_tokens.sql

ALTER TABLE bookings ADD COLUMN ticket_token TEXT;   -- NULL until the booking is confirmed

-- A partial UNIQUE index, because SQLite cannot add a UNIQUE column; NULL tokens are not compared.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_by_ticket_token ON bookings (ticket_token) WHERE ticket_token IS NOT NULL;
