# Email Relay

> Firefox Relay / Apple Hide My Email alternative built on Cloudflare's edge infrastructure

Generate unique email aliases instantly when signing up for services. Know exactly which service leaked your email. Disable aliases that receive spam.

## Features

- **Instant alias generation** via browser extension
- **Email forwarding** through Cloudflare Email Workers
- **Per-alias tracking** - see which services email you
- **Enable/disable aliases** - block spam without deleting
- **Full email history** per alias

## Architecture

```
Browser Extension → API Worker → D1 Database
                                      ↑
Incoming Email → Email Worker ────────┘
                      ↓
               Your Inbox (with X-* headers)
```

## Prerequisites

- Domain with Cloudflare DNS
- Cloudflare account with Workers enabled
- Node.js 18+ and pnpm

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/jackmcpickle/email-relay.git
cd email-relay
pnpm install
```

### 2. Create D1 Database

```bash
wrangler d1 create email-relay-db
```

Copy the `database_id` from the output and update both:
- `packages/email-handler/wrangler.toml`
- `packages/api/wrangler.toml`

### 3. Run Database Migration

```bash
pnpm db:migrate
```

### 4. Deploy Email Worker

```bash
cd packages/email-handler

# Set your forwarding destination
wrangler secret put DESTINATION_EMAIL
# Enter: your-email@example.com

pnpm deploy
```

### 5. Deploy API Worker

```bash
cd packages/api

# Generate and set a secure API key
wrangler secret put API_KEY
# Enter: your-secure-api-key

pnpm deploy
```

Note the deployed URL (e.g., `https://email-relay-api.<your-subdomain>.workers.dev`)

### 6. Configure Cloudflare Email Routing

1. Go to Cloudflare Dashboard → Your Domain → Email → Email Routing
2. Enable Email Routing (auto-configures MX records)
3. Add your destination email and verify it
4. Go to Routes → Enable "Catch-all address"
5. Action: "Send to a Worker" → Select `email-relay-handler`

### 7. Load Browser Extension

**Chrome:**
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `packages/extension` folder

**Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `packages/extension/manifest.json`

### 8. Configure Extension

1. Click extension icon → Settings (gear icon)
2. Enter API URL: `https://email-relay-api.<your-subdomain>.workers.dev`
3. Enter API Key (same as step 5)
4. Click "Test Connection" to verify
5. Save

## Usage

### Browser Extension

- **Generate alias:** Click the envelope button next to any email input field
- **View aliases:** Click the extension icon to see all aliases
- **Toggle alias:** Click the toggle to enable/disable forwarding
- **Copy email:** Click any alias email to copy to clipboard

### API Endpoints

All endpoints require `X-API-Key` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth) |
| POST | `/api/aliases` | Create alias |
| GET | `/api/aliases` | List aliases |
| GET | `/api/aliases/:id` | Get alias details |
| PATCH | `/api/aliases/:id` | Update alias |
| DELETE | `/api/aliases/:id` | Delete alias |
| GET | `/api/aliases/:id/logs` | Get email logs |
| GET | `/api/stats` | Dashboard stats |

#### Create Alias

```bash
curl -X POST https://your-api.workers.dev/api/aliases \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"domain": "example.com", "label": "Example Site"}'
```

#### List Aliases

```bash
curl https://your-api.workers.dev/api/aliases \
  -H "X-API-Key: your-key"
```

## Project Structure

```
email-relay/
├── migrations/
│   └── 0001_initial.sql      # D1 schema
├── packages/
│   ├── email-handler/        # Email Worker
│   ├── api/                  # API Worker (Hono)
│   └── extension/            # Browser Extension (MV3)
├── package.json
└── pnpm-workspace.yaml
```

## Development

```bash
# Typecheck all packages
pnpm typecheck

# Run API locally
cd packages/api && pnpm dev

# Run email handler locally (limited - email events can't be simulated)
cd packages/email-handler && pnpm dev
```

## Customization

### Change Relay Domain

Update `RELAY_DOMAIN` in both `wrangler.toml` files.

### Change Default Destination

Modify the hardcoded destination in `packages/api/src/routes/aliases.ts` or make it configurable via environment variable.

## Limitations

- **25 MiB email size limit** (Cloudflare limitation)
- **Single destination** - all aliases forward to one email
- **No reply masking** - replies come from your real email
- **X-* headers only** - can't modify standard email headers

## License

MIT
