-- Reference only: worker.js creates these tables automatically on the first upload.
CREATE TABLE IF NOT EXISTS totals (id INTEGER PRIMARY KEY, stored INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS cycle_usage (cycle TEXT PRIMARY KEY, normal_used INTEGER NOT NULL DEFAULT 0, normal_reserved INTEGER NOT NULL DEFAULT 0, overflow_used INTEGER NOT NULL DEFAULT 0, overflow_reserved INTEGER NOT NULL DEFAULT 0, files INTEGER NOT NULL DEFAULT 0, started_at INTEGER);
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, uid TEXT NOT NULL, cycle TEXT NOT NULL, kind TEXT NOT NULL, bytes INTEGER NOT NULL, bucket TEXT NOT NULL, state TEXT NOT NULL, r2_key TEXT, day TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS uploads_state ON uploads (state, expires_at);
CREATE TABLE IF NOT EXISTS daily_video (uid TEXT NOT NULL, day TEXT NOT NULL, upload_id TEXT NOT NULL, state TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY (uid, day));
CREATE TABLE IF NOT EXISTS blocked_users (cycle TEXT NOT NULL, uid TEXT NOT NULL, first_at INTEGER NOT NULL, PRIMARY KEY (cycle, uid));
CREATE TABLE IF NOT EXISTS verified_continue (cycle TEXT NOT NULL, uid TEXT NOT NULL, PRIMARY KEY (cycle, uid));
CREATE TABLE IF NOT EXISTS stored_files (key TEXT PRIMARY KEY, uid TEXT, bytes INTEGER NOT NULL, uploaded_at INTEGER NOT NULL);
