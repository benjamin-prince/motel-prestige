"""
Key card encoding abstraction layer.
Swap SimulatedProvider for a real hardware driver (VingCard, Dormakaba, Salto)
by implementing KeyCardProvider and updating get_provider().
"""
import json
import urllib.request
import urllib.error
import uuid
import random
import string
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from ..config import settings


class KeyCardProvider(ABC):
    @abstractmethod
    def encode_card(self, card_uid: str, room_number: str, valid_from: datetime, valid_until: datetime) -> dict:
        """Write access permissions to the physical card. Returns encoded_data dict."""

    @abstractmethod
    def revoke_card(self, card_uid: str) -> bool:
        """Deactivate a card at the lock controller."""

    @abstractmethod
    def generate_uid(self) -> str:
        """Generate a unique card UID."""


class SimulatedProvider(KeyCardProvider):
    """Development/demo provider — no hardware required."""

    def encode_card(self, card_uid: str, room_number: str, valid_from: datetime, valid_until: datetime) -> dict:
        return {
            "provider": "simulated",
            "card_uid": card_uid,
            "room": room_number,
            "valid_from": valid_from.isoformat(),
            "valid_until": valid_until.isoformat(),
            "encoded_at": datetime.now().isoformat(),
            "permissions": ["room_door", "elevator", "pool", "gym"],
        }

    def revoke_card(self, card_uid: str) -> bool:
        return True

    def generate_uid(self) -> str:
        return str(uuid.uuid4()).replace("-", "").upper()[:16]


class VingCardProvider(KeyCardProvider):
    """Stub for Assa Abloy VingCard Vision integration."""

    def __init__(self, host: str, port: int, api_key: str):
        self.host = host
        self.port = port
        self.api_key = api_key

    def encode_card(self, card_uid: str, room_number: str, valid_from: datetime, valid_until: datetime) -> dict:
        raise NotImplementedError("VingCard hardware integration not configured")

    def revoke_card(self, card_uid: str) -> bool:
        raise NotImplementedError("VingCard hardware integration not configured")

    def generate_uid(self) -> str:
        raise NotImplementedError("VingCard hardware integration not configured")


class OrbitaProvider(KeyCardProvider):
    """
    Orbita C Locking System integration (CLock.dll v5.6, dv_* functions).

    CLock.dll is a 32-bit Windows DLL bound to a USB card encoder — it cannot be
    loaded in-process by this backend. Instead this talks over HTTP to a small
    bridge service (see hardware/orbita_bridge/) that runs on the front-desk
    Windows PC where the encoder is plugged in, and wraps:
      dv_connect / dv_write_card / dv_read_card / dv_delete_card / dv_disconnect

    Orbita assigns the card UID itself when dv_write_card runs (it returns the
    card's UUID as an output parameter) — generate_uid() here only produces a
    placeholder that encode_card()'s response will override with the real UID.
    """

    TIME_FORMAT = "%Y-%m-%d %H:%M:%S"

    def __init__(self, base_url: str, api_key: str = "", building: str = "01"):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.building = building

    def _request(self, path: str, payload: dict) -> dict:
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        req = urllib.request.Request(f"{self.base_url}{path}", data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                result = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Orbita bridge unreachable at {self.base_url}: {exc}") from exc

        error_code = result.get("error_code", 0)
        if error_code != 0:
            raise RuntimeError(f"Orbita encoder error {error_code}: {result.get('message', 'unknown error')}")
        return result

    def encode_card(self, card_uid: str, room_number: str, valid_from: datetime, valid_until: datetime) -> dict:
        result = self._request("/write", {
            "building": self.building,
            "room": room_number.zfill(4)[-4:],
            "commdoors": "00",
            "arrival": valid_from.strftime(self.TIME_FORMAT),
            "departure": valid_until.strftime(self.TIME_FORMAT),
            "suspendnum": "000000",
            "mode": 0,
            "data11": "",
        })
        return {
            "provider": "orbita",
            "card_uid": result.get("card_id") or card_uid,
            "building": self.building,
            "room": room_number,
            "valid_from": valid_from.isoformat(),
            "valid_until": valid_until.isoformat(),
            "encoded_at": datetime.now().isoformat(),
        }

    def revoke_card(self, card_uid: str) -> bool:
        # Orbita's dv_delete_card is keyed on room number, not card UID; the
        # bridge keeps a uid->room map (recorded at write time) so it can
        # resolve which room's lock entry to clear from a bare card_uid.
        self._request("/delete", {"card_uid": card_uid})
        return True

    def generate_uid(self) -> str:
        return "PENDING-" + str(uuid.uuid4()).replace("-", "").upper()[:8]


def get_provider() -> KeyCardProvider:
    if settings.keycard_provider == "orbita":
        return OrbitaProvider(
            base_url=settings.orbita_bridge_url,
            api_key=settings.orbita_bridge_api_key,
            building=settings.orbita_building,
        )
    return SimulatedProvider()


def generate_card_number() -> str:
    prefix = "KC"
    digits = "".join(random.choices(string.digits, k=10))
    return f"{prefix}{digits}"
