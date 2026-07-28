"""
Orbita Lock System bridge.

Runs on the front-desk Windows PC where the USB card encoder is plugged in.
Wraps CLock.dll (32-bit, __stdcall — see ../docs/ORBITA C Locking System SDK5.6.pdf)
and exposes its dv_* functions as a small JSON/HTTP API that the PMS backend's
OrbitaProvider (backend/app/services/keycard_service.py) talks to over the network.

Requirements: 32-bit Python on Windows (CLock.dll is a 32-bit DLL and will not
load under 64-bit Python), plus `pip install flask`.

Endpoints (all POST, JSON body in/out):
  /connect      {}                                                  -> {"error_code": 0}
  /disconnect   {}                                                  -> {"error_code": 0}
  /write        {building, room, commdoors, arrival, departure,
                 suspendnum, mode, data11}                          -> {"error_code": 0, "card_id": "..."}
  /read         {}                                                  -> {"error_code": 0, "card_no": ..., ...}
  /delete       {"card_uid": "..."} or {"room": "0101"}             -> {"error_code": 0}

On failure every endpoint returns {"error_code": <negative int>, "message": "..."}
using the error list documented in the SDK PDF.
"""
import ctypes
import functools
import os
import threading

from flask import Flask, jsonify, request

DLL_PATH = os.environ.get("ORBITA_DLL_PATH", os.path.join(os.path.dirname(__file__), "CLock.dll"))
BRIDGE_API_KEY = os.environ.get("ORBITA_BRIDGE_API_KEY", "")
BRIDGE_PORT = int(os.environ.get("ORBITA_BRIDGE_PORT", "8765"))

ERROR_MESSAGES = {
    -1: "Interface error",
    -2: "Connect encoder failed",
    -3: "Register encoder failed",
    -4: "Buzzer mute",
    -5: "Not supported card type",
    -6: "Wrong card password",
    -7: "Wrong supplier password",
    -8: "Wrong card type",
    -9: "Wrong authorization code",
    -10: "Find card request failed",
    -11: "Find card failed",
    -12: "Load card password failed",
    -13: "Read device information failed",
    -14: "Read card failed",
    -15: "Write card failed",
    -16: "Reauthorization required",
}

app = Flask(__name__)
_lock = threading.Lock()       # the encoder is one physical USB device — serialize all access to it
_dll = None
_uid_to_room = {}              # card_uid -> room, recorded on /write so /delete can resolve a bare uid


def _load_dll():
    global _dll
    if _dll is None:
        dll_dir = os.path.dirname(os.path.abspath(DLL_PATH))
        # CLock.dll depends on dcrf32.dll (the card-reader driver). Put its
        # folder on the DLL search path so Windows resolves the dependency,
        # and fail early with a clear message if the driver is missing.
        try:
            if hasattr(os, "add_dll_directory"):
                os.add_dll_directory(dll_dir)
        except OSError:
            pass
        if not os.path.exists(os.path.join(dll_dir, "dcrf32.dll")):
            raise RuntimeError(
                f"dcrf32.dll missing in {dll_dir}. CLock.dll needs the card-reader "
                "driver 'dcrf32.dll' next to it — copy it from the Orbita SDK folder."
            )
        try:
            dll = ctypes.WinDLL(DLL_PATH)
        except OSError as exc:
            raise RuntimeError(
                f"Could not load CLock.dll ({exc}). Check that you are on 32-bit "
                f"Python and that dcrf32.dll is present in {dll_dir}."
            ) from exc
        dll.dv_connect.argtypes = [ctypes.c_int16]
        dll.dv_connect.restype = ctypes.c_int16
        dll.dv_disconnect.argtypes = []
        dll.dv_disconnect.restype = ctypes.c_int16
        dll.dv_read_card.argtypes = [ctypes.c_char_p] * 8
        dll.dv_read_card.restype = ctypes.c_int16
        dll.dv_write_card.argtypes = [
            ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p,   # building, room, commdoors
            ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p,   # arrival, departure, suspendnum
            ctypes.c_int16, ctypes.c_char_p, ctypes.c_char_p,    # mode, data11, cardID(out)
        ]
        dll.dv_write_card.restype = ctypes.c_int16
        dll.dv_delete_card.argtypes = [ctypes.c_char_p]
        dll.dv_delete_card.restype = ctypes.c_int16
        _dll = dll
    return _dll


def _inbuf(text, size):
    """Fixed-size input buffer matching the SDK's documented field widths."""
    return ctypes.create_string_buffer((text or "").encode("ascii", "ignore"), size)


def _outbuf(size):
    return ctypes.create_string_buffer(size)


def _str(buf):
    return buf.value.decode("ascii", "ignore").strip()


def _error(code):
    return {"error_code": code, "message": ERROR_MESSAGES.get(code, "Unknown encoder error")}


def require_api_key(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if BRIDGE_API_KEY:
            if request.headers.get("Authorization") != f"Bearer {BRIDGE_API_KEY}":
                return jsonify({"error_code": -1, "message": "Unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper


@app.errorhandler(Exception)
def _on_error(exc):
    # Surface any unexpected error as a clean JSON encoder error (HTTP 200 so the
    # caller reads error_code) instead of a raw 500 HTML page.
    return jsonify({"error_code": -1, "message": str(exc)}), 200


@app.post("/connect")
@require_api_key
def connect():
    dll = _load_dll()
    with _lock:
        code = dll.dv_connect(ctypes.c_int16(1))  # beep=1, confirms the encoder is reachable
    return jsonify({"error_code": 0} if code == 0 else _error(code))


@app.post("/disconnect")
@require_api_key
def disconnect():
    dll = _load_dll()
    with _lock:
        code = dll.dv_disconnect()
    return jsonify({"error_code": 0} if code == 0 else _error(code))


@app.route("/status", methods=["GET", "POST"])
@require_api_key
def status():
    """Silently probe whether the physical encoder actually responds.
    dv_connect(0) = no buzzer beep, so this is safe to poll. error_code 0
    means the USB encoder is really there; anything else = not connected."""
    try:
        dll = _load_dll()
    except Exception as exc:  # DLL/driver missing, wrong Python, etc.
        return jsonify({"encoder_connected": False, "error_code": -1, "message": str(exc)})
    with _lock:
        code = dll.dv_connect(ctypes.c_int16(0))  # beep=0 → silent
        if code == 0:
            try:
                dll.dv_disconnect()
            except Exception:
                pass
    return jsonify({
        "encoder_connected": code == 0,
        "error_code": code,
        "message": "ok" if code == 0 else ERROR_MESSAGES.get(code, "Unknown encoder error"),
    })


@app.post("/write")
@require_api_key
def write_card():
    data = request.get_json(force=True) or {}
    dll = _load_dll()

    building = _inbuf(data.get("building", "01"), 3)        # 2 chars
    room = _inbuf(data.get("room", "0000"), 5)              # 4 chars
    commdoors = _inbuf(data.get("commdoors", "00"), 3)      # 00-FF, 8-bit area mask
    arrival = _inbuf(data.get("arrival", ""), 20)           # yyyy-MM-dd hh:mm:ss (19 chars)
    departure = _inbuf(data.get("departure", ""), 20)
    suspendnum = _inbuf(data.get("suspendnum", "000000"), 7)  # 6 chars
    data11 = _inbuf(data.get("data11", ""), 33)             # custom message, 32 chars
    card_id = _outbuf(9)                                    # UUID, 8 chars — filled by the DLL

    with _lock:
        conn = dll.dv_connect(ctypes.c_int16(0))  # SDK requires a connection before writing
        if conn != 0:
            return jsonify(_error(conn))
        try:
            code = dll.dv_write_card(
                building, room, commdoors, arrival, departure,
                suspendnum, ctypes.c_int16(int(data.get("mode", 0))), data11, card_id,
            )
        finally:
            try:
                dll.dv_disconnect()
            except Exception:
                pass
    if code != 0:
        return jsonify(_error(code))

    uid = _str(card_id)
    _uid_to_room[uid] = data.get("room", "")
    return jsonify({"error_code": 0, "card_id": uid})


@app.post("/read")
@require_api_key
def read_card():
    dll = _load_dll()
    cardno, building, room, commdoors = _outbuf(7), _outbuf(3), _outbuf(5), _outbuf(3)
    arrival, departure = _outbuf(20), _outbuf(20)
    card_id, data11 = _outbuf(9), _outbuf(33)

    with _lock:
        conn = dll.dv_connect(ctypes.c_int16(0))  # connect before reading
        if conn != 0:
            return jsonify(_error(conn))
        try:
            code = dll.dv_read_card(cardno, building, room, commdoors, arrival, departure, card_id, data11)
        finally:
            try:
                dll.dv_disconnect()
            except Exception:
                pass
    if code != 0:
        return jsonify(_error(code))

    return jsonify({
        "error_code": 0,
        "card_no": _str(cardno),
        "building": _str(building),
        "room": _str(room),
        "commdoors": _str(commdoors),
        "arrival": _str(arrival),
        "departure": _str(departure),
        "card_id": _str(card_id),
        "data11": _str(data11),
    })


@app.post("/delete")
@require_api_key
def delete_card():
    data = request.get_json(force=True) or {}
    # dv_delete_card is keyed on room, not card UID — resolve via the map recorded at write time
    room = data.get("room") or _uid_to_room.get(data.get("card_uid", ""))
    if not room:
        return jsonify({"error_code": -1, "message": "Unknown card_uid — no room mapping recorded for it"})

    dll = _load_dll()
    with _lock:
        code = dll.dv_delete_card(_inbuf(room, 5))
    if code != 0:
        return jsonify(_error(code))

    _uid_to_room.pop(data.get("card_uid", ""), None)
    return jsonify({"error_code": 0})


if __name__ == "__main__":
    _load_dll()
    app.run(host="0.0.0.0", port=BRIDGE_PORT)
