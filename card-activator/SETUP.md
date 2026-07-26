# Front-desk PC setup — from a fresh OS to encoding cards

Complete install for the **card-encoding station**: the Orbita **bridge**
(talks to the USB encoder) + the **Card Time Activator** app (the UI you use to
activate a card for 1 hour … 1 month).

> **The PC must run Windows** — `CLock.dll` (the encoder driver) is a 32-bit
> Windows DLL and only works on Windows. macOS/Linux cannot drive the encoder.

---

## 0. Before you start
- A Windows PC (10 or 11).
- The **Orbita USB card encoder** and a few blank Orbita cards.
- Admin rights on the PC (to install Python).

## 1. Plug in the encoder
Plug the USB card encoder into the PC. Let Windows finish installing it.

## 2. Install Python **3.12 — 32-bit**
1. Go to <https://www.python.org/downloads/release/python-3129/>.
2. Download **"Windows installer (32-bit)"** (file name ends in **`x86`**, *not*
   the 64-bit `amd64`). Both matter: **32-bit** (the DLL is 32-bit) and **3.12**
   (the bundled dependency wheels are built for 3.12).
3. Run it → **tick "Add python.exe to PATH"** → *Install Now*.
4. Verify: open **Command Prompt** and run `python --version` → `Python 3.12.x`.

> **No internet needed for the install** — every Python dependency is already
> bundled in the `vendor\` folders next to the two `.bat` files, so the scripts
> install everything offline.

## 3. Get the project files onto the PC
Pick whichever is easier:

**A. Copy from the motel server (simplest)** — copy the whole `motel-prestige`
folder to the PC via USB stick / network share, e.g. to `C:\motel-prestige`.

**B. Download with Git** — install *Git for Windows*
(<https://git-scm.com/download/win>), then in Command Prompt:
```
cd C:\
git clone https://github.com/benjamin-prince/motel-prestige.git
```
(It will ask for your GitHub login the first time.)

After this you have `C:\motel-prestige\hardware\orbita_bridge\` and
`C:\motel-prestige\card-activator\`.

## 4. One-time Orbita authorization
Open the **Orbita lock-system software** that came with the encoder and complete
its **authorization** step once (see the SDK PDF in
`hardware\orbita_bridge\docs\`). The encoder won't write cards until this is done.

## 5. Start the bridge
1. Open `C:\motel-prestige\hardware\orbita_bridge\`.
2. Edit **`start-bridge.bat`** → set `ORBITA_BRIDGE_API_KEY` to any secret
   (remember it — the app uses the same value).
3. **Double-click `start-bridge.bat`.** A window opens: *"Orbita bridge running
   on port 8765"*. **Leave it open.**

## 6. Start the app
1. Open `C:\motel-prestige\card-activator\`.
2. Edit **`run-local.bat`** → set `ORBITA_BRIDGE_API_KEY` to the **same secret**
   as step 5, and set `APP_PASSWORD` (the staff login).
3. **Double-click `run-local.bat`.** First run installs the dependencies, then
   shows *"running → http://localhost:8080"*. **Leave it open.**

## 7. Test it 🎉
1. Open a browser → **http://localhost:8080**.
2. Log in with your `APP_PASSWORD`.
3. Top-right should say **"Encoder online"** (green).
4. Place a blank card on the encoder, pick a **duration** + a **Room**, click
   **Activate card** → it shows **"Card encoded"** with the card UID. Done.

If it says *"Encoder offline"*: the bridge window (step 5) isn't running, or the
API keys in the two `.bat` files don't match.

## 8. Make it start automatically (optional but recommended)
So staff never have to launch it:
1. Press `Win + R`, type `shell:startup`, press Enter — a folder opens.
2. Create shortcuts to **`start-bridge.bat`** and **`run-local.bat`** inside it.
   Both now launch when the PC logs in.

*(For a hands-off "service" install that runs even with no one logged in, use
NSSM — <https://nssm.cc> — to wrap each `.bat` as a Windows service.)*

---

### What runs where
- **Bridge** (`:8765`) — drives the physical encoder. Local only.
- **App** (`:8080`) — the UI + its own SQLite database. Local only.
- **Online** `https://book.motel-prestige.com` — the same app for viewing/tracking
  from anywhere; it can't reach this PC's encoder, so encoding happens here.
