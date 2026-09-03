"""Card Station — the whole front-desk poste in one Windows executable.

Runs the Orbita bridge and the staff UI inside a single process:

    bridge   127.0.0.1:8765   drives the USB encoder through CLock.dll
    UI       0.0.0.0:8080     what staff open in the browser

Packaging the two together removes the failure modes the .bat setup kept
hitting — no Python to install, no PATH, no 32/64-bit mix-up, and above all no
shared secret to keep in sync: the bridge key is generated in memory at startup
and handed to both halves, so "Encoder offline" can no longer be a typo.

The bridge now listens on loopback only. It used to bind 0.0.0.0, which exposed
card encoding to the whole hotel network; nothing outside this process needs it.
"""
import configparser
import os
import secrets
import socket
import sys
import threading
import time
import webbrowser

APP_NAME    = "Card Station"
UI_PORT     = 8080
BRIDGE_PORT = 8765


def base_dir() -> str:
    """Folder holding the bundled data files (static/, CLock.dll, dcrf32.dll)."""
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


def app_dir() -> str:
    """Folder next to the .exe — where config.ini and the database live.

    Never sys._MEIPASS: that is a temp folder wiped on exit, which would throw
    away every activation on every restart.
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


DEFAULT_CONFIG = """\
; Card Station — reglages du poste. Modifiez, puis relancez l'application.
[station]
; Mot de passe demande au personnel sur http://localhost:8080
password = Prestige2026

; Code batiment Orbita — doit correspondre a votre configuration Lock System.
building = 01

; Ouvrir le navigateur automatiquement au demarrage.
open_browser = yes
"""


def load_config() -> configparser.ConfigParser:
    path = os.path.join(app_dir(), "config.ini")
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(DEFAULT_CONFIG)
    cfg = configparser.ConfigParser()
    cfg.read(path, encoding="utf-8")
    if not cfg.has_section("station"):
        cfg.add_section("station")
    return cfg


def configure_environment(cfg: configparser.ConfigParser) -> None:
    """Both halves read their settings from the environment — fill it in."""
    st = cfg["station"]
    bundled = base_dir()

    # One key, generated per run, shared by the two halves in-process. The two
    # values can never disagree because nobody types them.
    key = secrets.token_hex(16)

    os.environ.setdefault("ORBITA_DLL_PATH", os.path.join(bundled, "CLock.dll"))
    os.environ["ORBITA_BRIDGE_API_KEY"] = key
    os.environ["ORBITA_BRIDGE_PORT"]    = str(BRIDGE_PORT)
    os.environ["ORBITA_BRIDGE_URL"]     = f"http://127.0.0.1:{BRIDGE_PORT}"

    os.environ["APP_PASSWORD"]    = st.get("password", "Prestige2026")
    os.environ["ORBITA_BUILDING"] = st.get("building", "01")
    os.environ["DB_PATH"]         = os.path.join(app_dir(), "activations.db")
    # Sessions stay valid across restarts only within a run; a fresh secret each
    # start simply asks staff to log in again, which is the safer default.
    os.environ.setdefault("SECRET_KEY", secrets.token_hex(32))


def wait_for_port(port: int, host: str = "127.0.0.1", timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket() as s:
            s.settimeout(0.5)
            if s.connect_ex((host, port)) == 0:
                return True
        time.sleep(0.25)
    return False


def start_bridge() -> None:
    """Flask bridge, loopback only — it serves this process and nobody else."""
    import bridge  # noqa: E402  (env must be set first)

    bridge._load_dll()
    bridge.app.run(host="127.0.0.1", port=BRIDGE_PORT,
                   threaded=True, use_reloader=False)


def start_ui() -> None:
    import uvicorn  # noqa: E402
    import app as ui_app  # noqa: E402

    uvicorn.run(ui_app.app, host="0.0.0.0", port=UI_PORT, log_level="warning")


def run_tray(stop: threading.Event) -> bool:
    """System-tray icon. Returns False when pystray is unavailable."""
    try:
        import pystray
        from PIL import Image, ImageDraw
    except Exception:
        return False

    img = Image.new("RGB", (64, 64), "#a17c3f")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((12, 20, 52, 46), radius=5, fill="#fffdf8")
    d.rectangle((36, 30, 46, 36), fill="#a17c3f")

    def open_ui(*_):
        webbrowser.open(f"http://localhost:{UI_PORT}")

    def quit_app(icon, *_):
        icon.visible = False
        icon.stop()
        stop.set()

    icon = pystray.Icon(
        "card_station", img, f"{APP_NAME} — port {UI_PORT}",
        menu=pystray.Menu(
            pystray.MenuItem("Ouvrir l'interface", open_ui, default=True),
            pystray.MenuItem("Quitter", quit_app),
        ),
    )
    icon.run()
    return True


def main() -> int:
    cfg = load_config()
    configure_environment(cfg)

    # Bundled sources sit next to this file inside the package.
    sys.path.insert(0, base_dir())

    threading.Thread(target=start_bridge, daemon=True, name="bridge").start()
    threading.Thread(target=start_ui,     daemon=True, name="ui").start()

    if not wait_for_port(UI_PORT):
        print(f"!! {APP_NAME}: l'interface n'a pas demarre sur le port {UI_PORT}.")
        print("   Le port est peut-etre deja utilise par une autre instance.")
        input("Appuyez sur Entree pour fermer...")
        return 1

    if cfg["station"].getboolean("open_browser", fallback=True):
        webbrowser.open(f"http://localhost:{UI_PORT}")

    stop = threading.Event()
    if not run_tray(stop):
        # No tray available: keep the process alive with a plain console.
        print(f"{APP_NAME} — interface : http://localhost:{UI_PORT}")
        print("Fermez cette fenetre pour arreter.")
        try:
            while not stop.is_set():
                time.sleep(1)
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
