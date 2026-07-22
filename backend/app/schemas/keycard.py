from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class KeyCardIssue(BaseModel):
    """Issue a guest card — requires reservation."""
    reservation_id: int
    guest_id: int
    room_id: int
    card_type: str = "guest"
    valid_from: Optional[datetime] = None
    expires_at: datetime


class KeyCardIssueOperational(BaseModel):
    """Issue a staff/housekeeping/maintenance/master card — no reservation needed."""
    card_type: str  # staff, housekeeping, maintenance, master, guest
    room_id: Optional[int] = None
    staff_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    valid_from: Optional[datetime] = None
    expires_at: datetime
    access_zones: Optional[list] = None   # ["floor_1", "pool", "all"] for zone-based cards
    card_uid: Optional[str] = None        # physical RFID UID — auto-generated if omitted
    notes: Optional[str] = None


class KeyCardUpdate(BaseModel):
    status: Optional[str] = None


class KeyCardExtend(BaseModel):
    expires_at: datetime


class KeyCardResponse(BaseModel):
    id: int
    card_number: str
    card_uid: Optional[str] = None
    reservation_id: Optional[int] = None
    guest_id: Optional[int] = None
    room_id: Optional[int] = None
    staff_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    card_type: str
    status: str
    issued_at: datetime
    valid_from: datetime
    expires_at: datetime
    deactivated_at: Optional[datetime] = None
    access_count: int
    access_zones: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class AccessLogResponse(BaseModel):
    id: int
    card_id: int
    door_location: str
    room_id: Optional[int] = None
    accessed_at: datetime
    access_granted: bool
    denial_reason: Optional[str] = None
    reader_id: Optional[str] = None

    model_config = {"from_attributes": True}
