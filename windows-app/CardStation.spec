# PyInstaller spec — Card Station (Windows, 32-bit).
#
# 32-bit is not a preference: CLock.dll (the Orbita encoder driver) is a 32-bit
# DLL, so the interpreter that loads it — and therefore this executable — must
# be 32-bit too. Build with a 32-bit Python 3.12.
#
#   pyinstaller --clean --noconfirm windows-app/CardStation.spec
import os

ROOT      = os.path.abspath(os.getcwd())
APP_SRC   = os.path.join(ROOT, "card-activator")
BRIDGE_SRC = os.path.join(ROOT, "hardware", "orbita_bridge")

a = Analysis(
    [os.path.join(ROOT, "windows-app", "card_station.py")],
    pathex=[APP_SRC, BRIDGE_SRC],
    binaries=[
        # Both DLLs must sit in the same folder: CLock.dll loads dcrf32.dll by
        # name, and bridge.py adds that folder with os.add_dll_directory.
        (os.path.join(BRIDGE_SRC, "CLock.dll"), "."),
        (os.path.join(BRIDGE_SRC, "dcrf32.dll"), "."),
    ],
    datas=[
        (os.path.join(APP_SRC, "static"), "static"),
        (os.path.join(APP_SRC, "app.py"), "."),
        (os.path.join(BRIDGE_SRC, "bridge.py"), "."),
    ],
    hiddenimports=[
        # uvicorn resolves these by string at runtime, so PyInstaller's static
        # analysis cannot see them.
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "pytest"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="CardStation",
    debug=False,
    strip=False,
    upx=False,          # UPX trips antivirus heuristics far more than it saves
    console=False,      # no black window; the tray icon is the visible part
    icon=None,
    version=None,
)
