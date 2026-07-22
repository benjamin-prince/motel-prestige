from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base, SessionLocal
from . import models  # ensure all models are imported before create_all
from .routers import rooms, guests, reservations, keycards, billing, currency, config
from .routers import auth, housekeeping, maintenance, inventory
from .dependencies import get_current_user
from .migrations import run_schema_patches
from .seeders import run_all_seeders

Base.metadata.create_all(bind=engine)
run_schema_patches(engine)  # add columns missing from pre-existing tables

# Run seeders once at startup
_db = SessionLocal()
try:
    run_all_seeders(_db)
finally:
    _db.close()

app = FastAPI(title="Motel Prestige PMS", version="1.0.0")


# VPS replica mode: admin & reports only. Super-admin tasks (sign-in, user
# and role management) stay writable — those tables are owned by the VPS and
# synced down to the motel. Every business write (reservations, folios,
# billing, …) is refused: main operations happen on the motel desktop, and
# replica-side business writes would be clobbered by the next sync anyway.
_REPLICA_WRITABLE_PREFIXES = (
    "/api/auth/login",
    "/api/auth/me/change-password",
    "/api/auth/users",   # user management
    "/api/config/roles", # role & permission management
)


@app.middleware("http")
async def enforce_read_only(request, call_next):
    from .config import settings
    if (
        settings.read_only_mode
        and request.method in ("POST", "PUT", "PATCH", "DELETE")
        and not request.url.path.startswith(_REPLICA_WRITABLE_PREFIXES)
    ):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=403,
            content={"detail": "Admin console: business operations are done at "
                               "the motel reception. / Console d'administration : "
                               "les opérations se font à la réception du motel."},
        )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    # Reception PCs and the desktop app load the frontend from the server's
    # LAN address, not just localhost — echo back whatever origin called.
    # Auth is a Bearer token (no cookies), so this is safe.
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes — no auth required
app.include_router(auth.router, prefix="/api")

# Protected routes — all require a valid JWT
_auth = [Depends(get_current_user)]
app.include_router(rooms.router,        prefix="/api", dependencies=_auth)
app.include_router(guests.router,       prefix="/api", dependencies=_auth)
app.include_router(reservations.router, prefix="/api", dependencies=_auth)
app.include_router(keycards.router,     prefix="/api", dependencies=_auth)
app.include_router(billing.router,      prefix="/api", dependencies=_auth)
app.include_router(currency.router,     prefix="/api", dependencies=_auth)
app.include_router(config.router,       prefix="/api", dependencies=_auth)
app.include_router(housekeeping.router, prefix="/api", dependencies=_auth)
app.include_router(maintenance.router,  prefix="/api", dependencies=_auth)
app.include_router(inventory.router,    prefix="/api", dependencies=_auth)


@app.get("/api/health")
def health():
    """Liveness + database status — the desktop app's setup wizard shows
    both checks before saving a server address."""
    from sqlalchemy import text as sql_text
    try:
        _db = SessionLocal()
        try:
            _db.execute(sql_text("SELECT 1"))
        finally:
            _db.close()
        database = "ok"
    except Exception:
        database = "error"
    from .config import settings
    return {"status": "ok", "database": database, "app": "Motel Prestige PMS",
            "read_only": settings.read_only_mode}
