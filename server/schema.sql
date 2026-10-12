-- Swavy Fix database (SQLite). Created automatically on first run.
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('customer','artisan')),
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL,
  city TEXT, area TEXT,
  pass_salt TEXT NOT NULL, pass_hash TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_admin INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL
);
-- Artisan profile (one per artisan user).
CREATE TABLE IF NOT EXISTS artisans (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  areas TEXT NOT NULL DEFAULT '[]',          -- JSON list of areas they cover
  start_price INTEGER NOT NULL DEFAULT 0,    -- "from" price in naira
  response_mins INTEGER NOT NULL DEFAULT 30,
  years INTEGER NOT NULL DEFAULT 1,
  verified INTEGER NOT NULL DEFAULT 0,       -- set by admin
  verified_at INTEGER,
  jobs_done INTEGER NOT NULL DEFAULT 0,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  portfolio TEXT NOT NULL DEFAULT '[]'       -- JSON list of {url, caption}
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  artisan_id INTEGER NOT NULL REFERENCES users(id),
  service TEXT NOT NULL,
  problem TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL, area TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
  when_text TEXT NOT NULL DEFAULT 'As soon as possible',
  status TEXT NOT NULL CHECK (status IN ('requested','quoted','accepted','on_way','working','done','cancelled')),
  code TEXT NOT NULL,                        -- 4-digit completion code (customer only)
  locked_total INTEGER,                      -- price agreed and locked
  cancel_reason TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS jobs_artisan ON jobs(artisan_id);
-- Quotes: version 1 is the first price; later versions are change requests the customer must approve.
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  labour INTEGER NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',          -- JSON list of {name, qty, price}
  total INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  is_change INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected','replaced')),
  created_at INTEGER NOT NULL, decided_at INTEGER
);
CREATE TABLE IF NOT EXISTS job_photos (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('problem','before','after')),
  url TEXT NOT NULL, by_user INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS job_events (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  text TEXT NOT NULL, at INTEGER NOT NULL
);
-- Only completed (code-confirmed) jobs can be reviewed, once each.
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  artisan_id INTEGER NOT NULL, customer_id INTEGER NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
-- Price guide: SAMPLE typical ranges. Edit from the admin page or directly in this table.
CREATE TABLE IF NOT EXISTS price_guide (
  id INTEGER PRIMARY KEY,
  service TEXT NOT NULL, job TEXT NOT NULL,
  low INTEGER NOT NULL, high INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
