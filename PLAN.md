# Email Relay Service - Project Plan

> A Firefox Relay / Apple Hide My Email alternative built on Cloudflare's edge infrastructure

## Overview

Build a privacy-focused email forwarding service that allows quick creation of unique email aliases via browser extension, forwards all mail to a single verified destination, and tracks email activity per alias.

**Core Value Proposition:**
- Generate unique emails instantly when signing up for services
- Know exactly which service leaked/sold your email (by alias)
- Disable aliases that receive spam
- Full visibility into email history per alias

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         YOUR DOMAIN (relay.yourdomain.com)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Email Routing (Catch-All)                 │
│                         → Routes ALL mail to Email Worker               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EMAIL WORKER (email-handler)                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 1. Extract alias from message.to (e.g., "a1b2c3d4")             │   │
│  │ 2. Query D1: Is alias valid & enabled?                          │   │
│  │ 3. If valid: Log metadata → Forward to destination              │   │
│  │ 4. If invalid: Reject with "Unknown address"                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌──────────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│    D1 Database       │  │   Your Inbox    │  │  X-* Headers Added      │
│  - aliases           │  │   (verified)    │  │  - X-Original-To        │
│  - email_logs        │  │                 │  │  - X-Alias-Domain       │
└──────────────────────┘  └─────────────────┘  └─────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        BROWSER EXTENSION                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Content Script: Detect email input fields, inject generate btn  │   │
│  │ Popup: List aliases, view stats, manage (enable/disable/delete) │   │
│  │ Background: API communication, auth token storage               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API WORKER (email-relay-api)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ POST   /api/aliases           - Create new alias                │   │
│  │ GET    /api/aliases           - List all aliases                │   │
│  │ GET    /api/aliases/:id       - Get alias details               │   │
│  │ PATCH  /api/aliases/:id       - Update alias (enable/disable)   │   │
│  │ DELETE /api/aliases/:id       - Delete alias                    │   │
│  │ GET    /api/aliases/:id/logs  - Get email history for alias     │   │
│  │ GET    /api/stats             - Dashboard statistics            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Email Processing | Cloudflare Email Workers | Handles all incoming mail via catch-all |
| API Backend | Cloudflare Workers + Hono | Lightweight, fast routing framework |
| Database | Cloudflare D1 (SQLite) | Serverless SQL, perfect for this use case |
| Browser Extension | Manifest V3 | Chrome/Firefox compatible |
| Authentication | API Key | Simple, stored in extension |
| Alias Generation | nanoid | Short, URL-safe unique IDs |

---

## Database Schema

```sql
-- ============================================
-- ALIASES TABLE
-- Stores all generated email aliases
-- ============================================
CREATE TABLE aliases (
  id TEXT PRIMARY KEY,                    -- UUID for internal reference
  alias TEXT UNIQUE NOT NULL,             -- The prefix (e.g., "a1b2c3d4")
  domain_used_for TEXT NOT NULL,          -- Domain where alias was created (e.g., "netflix.com")
  label TEXT,                             -- Optional user-friendly label
  destination TEXT NOT NULL,              -- Forward destination (your real email)
  enabled INTEGER DEFAULT 1,              -- 1 = active, 0 = disabled
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_email_at TEXT                      -- Updated when email received
);

-- ============================================
-- EMAIL LOGS TABLE
-- Tracks all emails received per alias
-- ============================================
CREATE TABLE email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,               -- Full alias email
  subject TEXT,
  received_at TEXT DEFAULT CURRENT_TIMESTAMP,
  size_bytes INTEGER,
  forwarded INTEGER DEFAULT 1,            -- 1 = forwarded, 0 = blocked
  blocked_reason TEXT,                    -- If blocked, why
  FOREIGN KEY (alias_id) REFERENCES aliases(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_aliases_alias ON aliases(alias);
CREATE INDEX idx_aliases_enabled ON aliases(enabled);
CREATE INDEX idx_aliases_domain ON aliases(domain_used_for);
CREATE INDEX idx_logs_alias_id ON email_logs(alias_id);
CREATE INDEX idx_logs_received ON email_logs(received_at);
```

---

## API Specification

### Authentication
All API requests require header: `X-API-Key: <your-api-key>`

### Endpoints

#### Create Alias
```
POST /api/aliases
Content-Type: application/json

Request:
{
  "domain": "netflix.com",     // Required: domain where alias will be used
  "label": "Netflix Account"   // Optional: friendly name
}

Response: 201 Created
{
  "id": "uuid-here",
  "alias": "a1b2c3d4",
  "email": "a1b2c3d4@relay.yourdomain.com",
  "domain_used_for": "netflix.com",
  "label": "Netflix Account",
  "enabled": true,
  "created_at": "2025-01-31T10:00:00Z"
}
```

#### List Aliases
```
GET /api/aliases
GET /api/aliases?enabled=true
GET /api/aliases?domain=netflix.com
GET /api/aliases?search=netflix

Response: 200 OK
{
  "aliases": [...],
  "total": 42
}
```

#### Get Alias Details
```
GET /api/aliases/:id

Response: 200 OK
{
  "id": "uuid-here",
  "alias": "a1b2c3d4",
  "email": "a1b2c3d4@relay.yourdomain.com",
  "domain_used_for": "netflix.com",
  "label": "Netflix Account",
  "enabled": true,
  "created_at": "2025-01-31T10:00:00Z",
  "last_email_at": "2025-01-31T15:30:00Z",
  "email_count": 12
}
```

#### Update Alias
```
PATCH /api/aliases/:id
Content-Type: application/json

Request:
{
  "enabled": false,           // Optional: enable/disable forwarding
  "label": "Old Netflix"      // Optional: update label
}

Response: 200 OK
{ ...updated alias object }
```

#### Delete Alias
```
DELETE /api/aliases/:id

Response: 204 No Content
```

#### Get Alias Email Logs
```
GET /api/aliases/:id/logs
GET /api/aliases/:id/logs?limit=50&offset=0

Response: 200 OK
{
  "logs": [
    {
      "id": 1,
      "from_address": "noreply@netflix.com",
      "subject": "Your Netflix password was changed",
      "received_at": "2025-01-31T15:30:00Z",
      "size_bytes": 15234,
      "forwarded": true
    }
  ],
  "total": 12
}
```

#### Get Stats
```
GET /api/stats

Response: 200 OK
{
  "total_aliases": 42,
  "active_aliases": 38,
  "disabled_aliases": 4,
  "total_emails_received": 1523,
  "emails_last_7_days": 87,
  "top_domains": [
    { "domain": "netflix.com", "count": 45 },
    { "domain": "amazon.com", "count": 32 }
  ]
}
```

---

## Email Worker Logic

```javascript
// email-handler/src/index.js

export default {
  async email(message, env, ctx) {
    const toAddress = message.to;
    const alias = toAddress.split('@')[0].toLowerCase();
    
    // 1. Look up alias in database
    const aliasRecord = await env.DB.prepare(
      'SELECT * FROM aliases WHERE alias = ?'
    ).bind(alias).first();
    
    // 2. Reject unknown aliases
    if (!aliasRecord) {
      message.setReject('Address not found');
      return;
    }
    
    // 3. Check if alias is enabled
    if (!aliasRecord.enabled) {
      // Log but don't forward
      await logEmail(env.DB, aliasRecord.id, message, false, 'Alias disabled');
      message.setReject('Address no longer active');
      return;
    }
    
    // 4. Log the email
    await logEmail(env.DB, aliasRecord.id, message, true, null);
    
    // 5. Update last_email_at
    await env.DB.prepare(
      'UPDATE aliases SET last_email_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), aliasRecord.id).run();
    
    // 6. Forward with tracking headers
    await message.forward(env.DESTINATION_EMAIL, new Headers({
      'X-Original-To': toAddress,
      'X-Alias-ID': aliasRecord.id,
      'X-Alias-Domain': aliasRecord.domain_used_for,
      'X-Alias-Label': aliasRecord.label || ''
    }));
  }
};

async function logEmail(db, aliasId, message, forwarded, blockedReason) {
  await db.prepare(`
    INSERT INTO email_logs (alias_id, from_address, to_address, subject, size_bytes, forwarded, blocked_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    aliasId,
    message.from,
    message.to,
    message.headers.get('subject') || '(no subject)',
    message.rawSize,
    forwarded ? 1 : 0,
    blockedReason
  ).run();
}
```

---

## Browser Extension Structure

```
extension/
├── manifest.json           # Extension manifest (V3)
├── popup/
│   ├── popup.html         # Main popup UI
│   ├── popup.css          # Styles
│   └── popup.js           # Popup logic (list/manage aliases)
├── content/
│   └── content.js         # Injected into pages, detects email fields
├── background/
│   └── background.js      # Service worker, handles API calls
├── options/
│   ├── options.html       # Settings page
│   └── options.js         # API key config, destination email
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── lib/
    └── api.js             # Shared API client
```

### Extension Features

**Content Script:**
- Detect `<input type="email">` fields
- Inject small "Generate Alias" button next to field
- On click: call API → create alias → fill field
- Show toast notification with alias info

**Popup UI:**
- List recent aliases with domain icons
- Quick toggle enable/disable
- Search/filter aliases
- Click to copy email address
- View email count per alias

**Options Page:**
- Configure API endpoint URL
- Set API key
- Test connection button

---

## Cloudflare Setup Instructions

### 1. Prerequisites
- Domain with Cloudflare DNS (nameservers pointed to CF)
- Cloudflare account with Workers enabled

### 2. Enable Email Routing
1. Dashboard → Your Domain → Email → Email Routing
2. Enable Email Routing (will configure MX records automatically)
3. Add your real email as a verified destination address
4. Verify via email link

### 3. Create D1 Database
```bash
# Create database
wrangler d1 create email-relay-db

# Note the database_id from output

# Run migrations
wrangler d1 execute email-relay-db --file=./schema.sql
```

### 4. Deploy Email Worker
```bash
cd email-handler
wrangler deploy
```

### 5. Configure Catch-All
1. Dashboard → Email → Email Routing → Routes
2. Enable "Catch-all address"
3. Action: "Send to a Worker"
4. Select your email-handler worker

### 6. Deploy API Worker
```bash
cd api
wrangler deploy
```

### 7. Configure Secrets
```bash
# For email worker
wrangler secret put DESTINATION_EMAIL
# Enter your verified email

# For API worker
wrangler secret put API_KEY
# Enter a secure random string
```

---

## Project Structure

```
email-relay/
├── README.md
├── packages/
│   ├── email-handler/           # Email Worker
│   │   ├── src/
│   │   │   └── index.js
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   ├── api/                     # API Worker
│   │   ├── src/
│   │   │   ├── index.js         # Hono app entry
│   │   │   ├── routes/
│   │   │   │   ├── aliases.js
│   │   │   │   └── stats.js
│   │   │   └── middleware/
│   │   │       └── auth.js
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   └── extension/               # Browser Extension
│       ├── manifest.json
│       ├── popup/
│       ├── content/
│       ├── background/
│       └── options/
│
├── migrations/
│   └── 0001_initial.sql         # D1 schema
│
└── package.json                 # Workspace root
```

---

## Configuration Files

### email-handler/wrangler.toml
```toml
name = "email-relay-handler"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "email-relay-db"
database_id = "<your-database-id>"

[vars]
RELAY_DOMAIN = "relay.yourdomain.com"

# DESTINATION_EMAIL set via `wrangler secret put`
```

### api/wrangler.toml
```toml
name = "email-relay-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "email-relay-db"
database_id = "<your-database-id>"

[vars]
RELAY_DOMAIN = "relay.yourdomain.com"

# API_KEY set via `wrangler secret put`
```

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅ (Day 1-2)
- [ ] Set up Cloudflare Email Routing on domain
- [ ] Create D1 database with schema
- [ ] Deploy Email Worker with basic forwarding
- [ ] Test end-to-end email flow

### Phase 2: API Worker (Day 3-4)
- [ ] Scaffold Hono API
- [ ] Implement CRUD endpoints for aliases
- [ ] Add email logs endpoint
- [ ] Add stats endpoint
- [ ] Test all endpoints via curl/Postman

### Phase 3: Browser Extension MVP (Day 5-7)
- [ ] Create manifest.json (V3)
- [ ] Build popup with alias list
- [ ] Implement content script for field detection
- [ ] Add "Generate" button injection
- [ ] Wire up API communication
- [ ] Test in Chrome/Firefox

### Phase 4: Polish & Features (Day 8-10)
- [ ] Add search/filter to popup
- [ ] Implement options page
- [ ] Add copy-to-clipboard functionality
- [ ] Error handling & offline states
- [ ] Extension icon badges (email count)

### Phase 5: Optional Enhancements (Future)
- [ ] Web dashboard (could be part of API worker with static assets)
- [ ] Email notifications for new aliases used
- [ ] Blocklist for known spam senders
- [ ] Rate limiting per alias
- [ ] Reply forwarding (complex - requires outbound email setup)

---

## Known Limitations & Considerations

### Cloudflare Limitations
| Limitation | Impact | Mitigation |
|------------|--------|------------|
| 25 MiB email size limit | Large attachments fail | Acceptable for most use cases |
| Destination must be pre-verified | Can't dynamically add destinations | Single destination is fine for personal use |
| Only X-* custom headers allowed | Can't modify standard headers | Use X-Alias-* headers for tracking |
| Workers CPU limits (10ms free, 50ms paid) | Complex processing may timeout | Keep worker logic simple |

### Operational Considerations
| Concern | Notes |
|---------|-------|
| Gmail spam marking | Cloudflare handles SPF/DKIM, but forwarded mail can still be marked spam. Train "Not Spam" initially. |
| Reply handling | Replies go from your real email, revealing it. Full reply masking requires complex outbound setup. |
| Alias enumeration | Random aliases are not guessable (8 char = 2.8 trillion combinations with nanoid) |
| Database size | D1 free tier: 5GB, 5M rows. More than enough for personal use. |

---

## Security Considerations

1. **API Key Protection**
   - Stored in extension's secure storage
   - Transmitted only over HTTPS
   - Consider adding IP allowlist for extra security

2. **No Sensitive Data in Logs**
   - Only log metadata (from, subject, size)
   - Never store email body content

3. **Alias Generation**
   - Use cryptographically random IDs
   - No PII in alias (no name, no patterns)

4. **CORS Configuration**
   - API should only accept requests from extension origin
   - Or use strict API key validation

---

## Testing Checklist

### Email Worker
- [ ] Valid alias → forwards correctly
- [ ] Invalid alias → rejects with message
- [ ] Disabled alias → rejects, logs blocked
- [ ] Email headers preserved
- [ ] X-* tracking headers added
- [ ] Database logging works

### API Worker
- [ ] Create alias returns full email
- [ ] List aliases returns all
- [ ] Filter by domain works
- [ ] Toggle enabled/disabled works
- [ ] Delete removes from DB
- [ ] Logs endpoint returns history
- [ ] Stats calculations correct
- [ ] Auth rejects invalid keys

### Extension
- [ ] Detects email fields on major sites
- [ ] Generate button appears correctly
- [ ] Alias creation works
- [ ] Auto-fill works
- [ ] Popup lists aliases
- [ ] Copy to clipboard works
- [ ] Enable/disable toggle works

---

## Resources & References

- [Cloudflare Email Workers Docs](https://developers.cloudflare.com/email-routing/email-workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Hono Framework](https://hono.dev/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [nanoid](https://github.com/ai/nanoid)

---

## Notes

_Add implementation notes, decisions, and learnings here as you build._

```
2025-01-31: Initial plan created
```
