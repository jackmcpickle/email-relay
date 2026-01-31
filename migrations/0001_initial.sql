-- ============================================
-- ALIASES TABLE
-- Stores all generated email aliases
-- ============================================
CREATE TABLE IF NOT EXISTS aliases (
  id TEXT PRIMARY KEY,
  alias TEXT UNIQUE NOT NULL,
  domain_used_for TEXT NOT NULL,
  label TEXT,
  destination TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_email_at TEXT
);

-- ============================================
-- EMAIL LOGS TABLE
-- Tracks all emails received per alias
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  received_at TEXT DEFAULT CURRENT_TIMESTAMP,
  size_bytes INTEGER,
  forwarded INTEGER DEFAULT 1,
  blocked_reason TEXT,
  FOREIGN KEY (alias_id) REFERENCES aliases(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_aliases_alias ON aliases(alias);
CREATE INDEX IF NOT EXISTS idx_aliases_enabled ON aliases(enabled);
CREATE INDEX IF NOT EXISTS idx_aliases_domain ON aliases(domain_used_for);
CREATE INDEX IF NOT EXISTS idx_logs_alias_id ON email_logs(alias_id);
CREATE INDEX IF NOT EXISTS idx_logs_received ON email_logs(received_at);
