#!/usr/bin/env bash
# Motel ⇄ VPS data sync — run on the MOTEL server (cron it every 5 minutes):
#   */5 * * * * VPS_DATABASE_URL=postgresql://postgres:PASS@vps-host:5432/motel_prestige /path/to/sync-to-vps.sh >> /var/log/motel-sync.log 2>&1
#
# Table ownership keeps the sync conflict-free:
#   - business tables (reservations, folios, …): MOTEL → VPS
#     The motel is the source of truth; the VPS is the read-only admin console.
#   - users & roles: VPS → MOTEL
#     Super-admin manages accounts online; the motel pulls them down.
#
# Both directions are atomic (--single-transaction): an outage mid-sync leaves
# the target untouched, and the next run simply catches up.
set -euo pipefail

VPS_DB_URL="${VPS_DATABASE_URL:?Set VPS_DATABASE_URL, e.g. postgresql://postgres:PASS@vps-host:5432/motel_prestige}"
LOCAL_CONTAINER="${LOCAL_DB_CONTAINER:-motel-prestige-postgres-1}"
PG_IMAGE="postgres:16-alpine"

# Never run two syncs at once (mkdir lock — works on Linux and macOS).
LOCKDIR=/tmp/motel-prestige-sync.lock
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "$(date '+%F %T') sync already running, skipped"
  exit 0
fi
trap 'rmdir "$LOCKDIR"' EXIT

ADMIN_TABLES="users roles"
BUSINESS_TABLES=$(docker exec "$LOCAL_CONTAINER" psql -U postgres -d motel_prestige -tAc \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('users','roles')")

# ── 1. Push business data: motel → VPS ───────────────────────────────────────
{
  echo "SET session_replication_role = replica;"
  for t in $BUSINESS_TABLES; do echo "DELETE FROM \"$t\";"; done
  docker exec "$LOCAL_CONTAINER" pg_dump -U postgres --data-only \
    $(for t in $BUSINESS_TABLES; do printf -- '--table=%s ' "$t"; done) motel_prestige
} | docker run -i --rm "$PG_IMAGE" psql "$VPS_DB_URL" -q -v ON_ERROR_STOP=1 --single-transaction

# ── 2. Pull admin accounts: VPS → motel ──────────────────────────────────────
{
  echo "SET session_replication_role = replica;"
  for t in $ADMIN_TABLES; do echo "DELETE FROM \"$t\";"; done
  docker run -i --rm "$PG_IMAGE" pg_dump --data-only \
    $(for t in $ADMIN_TABLES; do printf -- '--table=%s ' "$t"; done) "$VPS_DB_URL"
} | docker exec -i "$LOCAL_CONTAINER" psql -U postgres -d motel_prestige -q -v ON_ERROR_STOP=1 --single-transaction

echo "$(date '+%F %T') sync ok — $(echo "$BUSINESS_TABLES" | wc -w | tr -d ' ') business tables pushed, users/roles pulled"
