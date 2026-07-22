# Deployment — motel + VPS

```
┌─ MOTEL (source of truth) ──────────┐      ┌─ VPS (admin console) ─────────┐
│ mini-PC + UPS, docker compose up   │      │ deploy/vps, HTTPS via Caddy   │
│ backend :8000 / frontend :3000     │ sync │ READ_ONLY_MODE=true           │
│ reception desktop apps (LAN)       │ ───→ │ reports & dashboards          │
│ ALL business operations            │ ←─── │ super-admin: users & roles    │
└────────────────────────────────────┘      └───────────────────────────────┘
```

- **Motel**: the existing `docker-compose.yml` at the repo root. Reception
  desktop apps point at the motel server's LAN IP. Internet down → everything
  still works (reservations, 2h stays, folios, key cards).
- **VPS**: read-only mirror for admin & reports. Business writes are refused
  by the backend (`READ_ONLY_MODE`) and a banner says operations happen at
  reception. Exception: **user & role management is done here** and synced
  down to the motel.

## VPS setup

```bash
# on the VPS (with docker + a domain's A record pointing at it)
git clone <repo> && cd motel-prestige/deploy/vps
cp .env.example .env        # set PMS_DOMAIN, DB_PASSWORD, JWT_SECRET, TZ
docker compose up -d --build
```

Caddy obtains the TLS certificate automatically. The app is then at
`https://<PMS_DOMAIN>` (frontend talks to `/api` on the same domain).

**Firewall**: allow 80/443 to everyone; restrict **5432** to the motel's
public IP only (it exists solely for the sync).

## Sync (runs on the motel server)

```bash
crontab -e
*/5 * * * * VPS_DATABASE_URL=postgresql://postgres:DB_PASSWORD@<vps-host>:5432/motel_prestige /path/to/repo/deploy/sync-to-vps.sh >> /var/log/motel-sync.log 2>&1
```

Every 5 minutes, atomically:
1. business tables → VPS (reservations, folios, payments, rooms, …)
2. `users` + `roles` ← VPS (accounts managed in the online console)

Outage mid-sync leaves the target untouched; the next run catches up.
Keep backend versions identical on both sides (the schema must match).

## Conventions this relies on

- Manage **users & roles only in the online console** — motel-side edits to
  them are overwritten by the next sync. Everything else is motel-owned and
  overwritten on the VPS.
- Auth: both sides must share the same `JWT_SECRET_KEY` only if you want
  tokens to work across both — not required; users simply log in on each.
