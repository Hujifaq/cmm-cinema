-- Apply after 0007_ticket_tokens.sql: npx wrangler d1 execute <database-name> --remote --file=Data/migrations/0008_admin_booking_accounts.sql

ALTER TABLE admins ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
