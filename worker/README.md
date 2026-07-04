# Brick-Breaker Leaderboard Worker

Cloudflare Worker + KV backing store for top-10 scores.

## Setup

```bash
# Install wrangler if you don't have it globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespaces (one for prod, one for preview/dev)
wrangler kv:namespace create SCORES
wrangler kv:namespace create SCORES --preview

# Copy the IDs into wrangler.toml (replace REPLACE_WITH_KV_ID)

# Set the HMAC secret (must match VITE_HMAC_SECRET in the frontend)
wrangler secret put HMAC_SECRET
# paste a 32-byte hex string from: openssl rand -hex 32

# Deploy
npm run deploy:worker
# or: cd worker && wrangler deploy
```

## Endpoints

- `GET /scores?limit=10` — returns top N scores
- `POST /scores` — submit a score (HMAC-signed)
- `GET /health` — health check

## Local dev

```bash
cd worker
wrangler dev
# runs on http://localhost:8787
```

## Required GitHub secrets

For CI deploy:
- `CF_API_TOKEN` — Cloudflare API token (Workers + Pages edit)
- `CF_ACCOUNT_ID` — Cloudflare account id

Worker secret (set via `wrangler secret put`):
- `HMAC_SECRET` — must match `VITE_HMAC_SECRET` in the frontend
