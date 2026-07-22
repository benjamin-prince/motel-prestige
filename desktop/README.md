# Motel Prestige — Desktop App (Windows)

A desktop shell for the PMS. The backend, database and frontend keep running on
the server (Docker, as today); this app connects to it over the network, so
every reception PC sees the same live data and updates happen centrally.

## Install on a reception PC

1. Copy `dist/Motel Prestige Setup 1.0.0.exe` to the PC and run it
   (or use `Motel Prestige 1.0.0.exe`, the portable version — no install).
2. On first launch, enter the server address (e.g. `192.168.1.10`).
   The app checks the server is reachable before saving.
3. Log in as usual. The address is remembered; change it any time via the
   menu **Motel Prestige → Changer de serveur**.

If the server becomes unreachable, the app shows an offline screen and
reconnects automatically when the server comes back.

## Install on a Mac (Apple Silicon)

Open `dist/Motel Prestige-1.0.0-arm64.dmg` and drag the app to Applications.
The app is unsigned: on first launch, right-click the app → **Open** (or run
`xattr -dr com.apple.quarantine "/Applications/Motel Prestige.app"`).

## Build

```bash
cd desktop
npm install
npm run dist:win   # → dist/Motel Prestige Setup 1.0.0.exe (+ portable)
npm run dist:mac   # → dist/Motel Prestige-1.0.0-arm64.dmg (+ zip)
```

The installer is unsigned — Windows SmartScreen may warn on first run
("More info → Run anyway"). To remove the warning, add a code-signing
certificate to the electron-builder config.

## Server requirements

- `docker compose up -d` on the server (backend :8000, frontend :3000).
- The PCs must reach the server on ports 3000 and 8000 (firewall).
- The frontend derives the API address from the host it is loaded from,
  and the backend accepts any origin (Bearer-token auth, no cookies).
