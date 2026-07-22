from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class RoomBase(BaseModel):
    room_number: str
    room_type: str
    floor: int
    price_per_night: Decimal
    price_short_stay: Optional[Decimal] = None  # 2h rate
    stay_offer: str = "OS"  # OS = nuitée only, SS = 2h only, BOTH
    max_occupancy: int = 2
    description: Optional[str] = None
    amenities: Optional[List[str]] = []


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    room_type: Optional[str] = None
    floor: Optional[int] = None
    status: Optional[str] = None
    hk_status: Optional[str] = None
    price_per_night: Optional[Decimal] = None
    price_short_stay: Optional[Decimal] = None
    stay_offer: Optional[str] = None
    max_occupancy: Optional[int] = None
    description: Optional[str] = None
    amenities: Optional[List[str]] = None


class RoomResponse(RoomBase):
    id: int
    status: str
    hk_status: str = "clean"
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
