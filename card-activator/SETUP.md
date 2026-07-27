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

## 4. Put the card-reader driver next to the DLL  ⚠️ required
`CLock.dll` (in `hardware\orbita_bridge\`) needs its companion driver
**`dcrf32.dll`** in the **same folder**, or it won't load.
- Copy **`dcrf32.dll`** from the Orbita SDK folder (it sits next to `CLock.dll`,
  ~152 KB) into `C:\motel-prestige\hardware\orbita_bridge\`.
- *(If `dcrf32.dll` is already in that folder in the repo, skip this.)*

## 5. Install the Orbita Lock System software & authorize the encoder
This is a **one-time** step so the encoder will accept commands from our bridge.

1. **Install** `Locksystem5.6.68.exe` (from Orbita) — Next → Install → Finish
   (default path `C:\Program Files (x86)\ORBITA\LockingSystem5.6\`).
2. Make sure the **USB encoder is plugged in**.
3. **Launch** the Lock System, log in:
   - **User Name: `001`   Password: `001`   Language: English** → OK
4. **Register** (first launch only) — a Registration window appears. Enter the
   Orbita registration code and click OK → *"Registration succeed"*:
   - **Registration No.: `84CA-56F8-2AD7-C2D4`**
   *(Without this, "Check Encoder" does nothing and encoding fails.)*
5. Click **Check Encoder** (menu bar) → should say the encoder is connected.
6. **Authorize the interface**: menu bar **Card Setting** → the **Function Cards**
   dialog opens → click **Interface Auth** → **"Auth Succeed"** → OK → **Close**.
7. Close the Lock System. The encoder is now authorized for the bridge.

*(Optional hardware test: the SDK's **`obt.exe`** ("Orbita demo") — click
**Connect** → place a card → **Write / Read** — confirms the encoder works.)*

## 6. Start the bridge
1. Open `C:\motel-prestige\hardware\orbita_bridge\`.
2. Edit **`start-bridge.bat`** → set `ORBITA_BRIDGE_API_KEY` to any secret
   (remember it — the app uses the same value).
3. **Double-click `start-bridge.bat`.** A window opens: *"Orbita bridge running
   on port 8765"*. **Leave it open.**
   *(If it says "dcrf32.dll missing" → redo step 4. If "not a valid Win32
   application" → you installed 64-bit Python; reinstall the 32-bit one.)*

## 7. Start the app
1. Open `C:\motel-prestige\card-activator\`.
2. Edit **`run-local.bat`** → set `ORBITA_BRIDGE_API_KEY` to the **same secret**
   as step 6, and set `APP_PASSWORD` (the staff login).
3. **Double-click `run-local.bat`.** First run installs the dependencies, then
   shows *"running → http://localhost:8080"*. **Leave it open.**

## 8. Test it 🎉
1. Open a browser → **http://localhost:8080**.
2. Log in with your `APP_PASSWORD`.
3. Top-right should say **"Encoder online"** (green).
4. Place a blank card on the encoder, pick a **duration** + a **Room**, click
   **Activate card** → it shows **"Card encoded"** with the card UID. Done.

If it says *"Encoder offline"*: the bridge window (step 6) isn't running, or the
API keys in the two `.bat` files don't match.

## 9. Make it start automatically (optional but recommended)
So staff never have to launch it:
1. Press `Win + R`, type `shell:startup`, press Enter — a folder opens.
2. Create shortcuts to **`start-bridge.bat`** and **`run-local.bat`** inside it.
   Both now launch when the PC logs in.

*(For a hands-off "service" install that runs even with no one logged in, use
NSSM — <https://nssm.cc> — to wrap each `.bat` as a Windows service.)*

---

## Appendix — Tell a lock & energy saver which room they are (e.g. 203)

A card only opens something once each **physical device** has been bound to that
room. Do this **once per lock** and **once per energy saver**, in the Orbita
**Lock System** software (not in this app). Example for room **203**:

1. **Make a "Setup Room" card for 203**
   - Menu bar → **Card Setting** → the **Function Cards** dialog opens.
   - Tick **Setup Room**, click the 🔍 and choose **Room 203** + the **Building**.
   - Tick **Standard Room** (or **Suite Room** for a suite — a suite has several
     doors, set them one by one).
   - Put a blank card on the encoder → click **Setup Card** → *"Encoding Card
     Succeed"*.
2. **Bind the door lock** — carry that card to room 203's door and hold it on the
   lock → the lock accepts it and is now set to **203**. Then present a **Clock
   Card** (Function Cards → **Clock Card**) so the lock's date/time is correct.
3. **Bind the energy saver (ESS-20)** — the **ESS-20 is room-specific**: per its
   spec, *"only a specific-room card gets power; a name-only card cannot."* Hold
   the same 203 Setup Room card on the ESS-20 in room 203 → it's now bound to
   203. From then on **only a card encoded for 203** switches that room's power.
   *(So in the app, the **Room** field is required for a card to work — a card
   with no room powers nothing.)*
4. The **Building** used here **must equal** the *Building* you type in the Card
   Time Activator app when you activate a card.

After this, a card activated for room **203** in the app opens its door **and**
powers its energy saver for the chosen time. *(Repeat once for every room.)*

---

### Hardware
- **Door locks:** Orbita **E3092** (Mifare 1, 13.56 MHz).
- **Energy savers:** Orbita **ESS-20** — **room-specific** (only a card for its
  room powers it; a name-only card does not).
- **Encoder + software:** Orbita USB encoder, Locksystem 5.6, SDK bridge.

### What runs where
- **Bridge** (`:8765`) — drives the physical encoder. Local only.
- **App** (`:8080`) — the UI + its own SQLite database. Local only.
- **Online** `https://book.motel-prestige.com` — the same app for viewing/tracking
  from anywhere; it can't reach this PC's encoder, so encoding happens here.
