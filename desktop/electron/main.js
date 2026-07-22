// Motel Prestige — reception desktop app.
// A hardened shell around the PMS web frontend: the backend, database and
// frontend stay on the server (Docker); this app connects to it over the LAN,
// so every reception PC sees the same live data and updates centrally.
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = () => path.join(app.getPath("userData"), "settings.json");
const SMOKE_TEST = process.argv.includes("--smoke-test");

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE(), "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(next, null, 2));
  return next;
}

/** Possible frontend origins for what the operator typed.
 *  A full URL is used as-is. A bare host tries, in order:
 *    https://host        — VPS behind a reverse proxy (single domain, TLS)
 *    http://host:3000    — LAN / dev docker stack
 *    http://host         — proxy without TLS
 */
function candidateUrls(input) {
  const raw = String(input || "").trim().replace(/\/+$/, "");
  if (!raw) return [];
  if (/^https?:\/\//i.test(raw)) {
    try { return [new URL(raw).origin]; } catch { return []; }
  }
  return [`https://${raw}`, `http://${raw}:3000`, `http://${raw}`];
}

/** Where the backend health endpoint lives for a given frontend origin:
 *  port 3000 (LAN stack) → same host port 8000; otherwise same origin /api. */
function healthUrl(serverUrl) {
  const u = new URL(serverUrl);
  return u.port === "3000"
    ? `${u.protocol}//${u.hostname}:8000/api/health`
    : `${u.origin}/api/health`;
}

/** Health of the PMS behind a frontend origin: API reachable + database ok. */
async function serverStatus(serverUrl) {
  try {
    const res = await fetch(healthUrl(serverUrl), { signal: AbortSignal.timeout(5000) });
    const body = await res.json().catch(() => ({}));
    return {
      api: res.ok && body.status === "ok",
      database: body.database === "ok",
    };
  } catch {
    return { api: false, database: false };
  }
}

async function checkServer(serverUrl) {
  return (await serverStatus(serverUrl)).api;
}

/** First origin among the candidates whose API responds, with its status. */
async function resolveServer(input) {
  for (const url of candidateUrls(input)) {
    const status = await serverStatus(url);
    if (status.api) return { url, ...status };
  }
  return null;
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#1e2532",
    title: "Motel Prestige",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
    if (!SMOKE_TEST) win.maximize();
  });

  // External links (if any) open in the default browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Server went away mid-session (reboot, network drop) → offline screen.
  win.webContents.on("did-fail-load", (_e, code, _desc, failedUrl) => {
    const { serverUrl } = loadSettings();
    if (code !== -3 && serverUrl && failedUrl && failedUrl.startsWith(serverUrl)) {
      win.loadFile(path.join(__dirname, "offline.html"));
    }
  });

  return win;
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "Motel Prestige",
      submenu: [
        {
          label: "Changer de serveur / Change Server…",
          click: () => win && win.loadFile(path.join(__dirname, "setup.html")),
        },
        { type: "separator" },
        { role: "quit", label: "Quitter / Quit" },
      ],
    },
    {
      label: "Affichage / View",
      submenu: [
        { role: "reload", label: "Actualiser / Reload" },
        { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Édition / Edit",
      submenu: [
        { role: "undo" }, { role: "redo" }, { type: "separator" },
        { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
      ],
    },
  ]));
}

async function start() {
  buildMenu();
  createWindow();

  const input = process.env.MOTEL_SERVER_URL || loadSettings().serverUrl;

  if (!input) {
    await win.loadFile(path.join(__dirname, "setup.html"));
    return;
  }
  const resolved = await resolveServer(input);
  if (resolved) {
    await win.loadURL(resolved.url);
  } else {
    await win.loadFile(path.join(__dirname, "offline.html"));
  }
}

// ── IPC: setup & offline screens ─────────────────────────────────────────────
ipcMain.handle("get-server-url", () => loadSettings().serverUrl || "");

ipcMain.handle("test-server", async (_e, input) => {
  const resolved = await resolveServer(input);
  return resolved || { api: false, database: false };
});

ipcMain.handle("save-server", async (_e, input) => {
  const resolved = await resolveServer(input);
  if (!resolved) return { api: false, database: false };
  if (!resolved.database) return resolved; // API up but DB down — don't enter
  saveSettings({ serverUrl: resolved.url });
  win.loadURL(resolved.url);
  return { ...resolved, ok: true };
});

ipcMain.handle("retry-server", async () => {
  const { serverUrl } = loadSettings();
  if (serverUrl && (await checkServer(serverUrl))) {
    win.loadURL(serverUrl);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle("open-setup", () => win.loadFile(path.join(__dirname, "setup.html")));

app.whenReady().then(async () => {
  await start();

  if (SMOKE_TEST) {
    // CI / dev sanity check: report what loaded, then exit.
    const url = win.webContents.getURL();
    console.log(`SMOKE_TEST_LOADED ${url}`);
    setTimeout(() => app.exit(0), 500);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) start();
  });
});

app.on("window-all-closed", () => app.quit());
