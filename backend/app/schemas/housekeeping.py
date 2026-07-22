from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class HKTaskCreate(BaseModel):
    room_id: int
    assigned_to: Optional[int] = None
    task_type: str = "cleaning"
    priority: str = "normal"
    scheduled_date: Optional[date] = None
    notes: Optional[str] = None


class HKTaskUpdate(BaseModel):
    assigned_to: Optional[int] = None
    task_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    scheduled_date: Optional[date] = None
    notes: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class HKTaskResponse(BaseModel):
    id: int
    room_id: int
    assigned_to: Optional[int] = None
    task_type: str
    priority: str
    status: str
    scheduled_date: date
    notes: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    room_number: Optional[str] = None
    room_type: Optional[str] = None
    floor: Optional[int] = None
    assignee_name: Optional[str] = None

    model_config = {"from_attributes": True}


class RoomHKStatusUpdate(BaseModel):
    hk_status: str  # dirty, cleaning, clean, inspected, do_not_disturb, out_of_order


class LostFoundCreate(BaseModel):
    item_description: str
    found_location: Optional[str] = None
    found_date: date
    found_by_staff_id: Optional[int] = None
    room_id: Optional[int] = None
    guest_name: Optional[str] = None
    guest_contact: Optional[str] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None


class LostFoundUpdate(BaseModel):
    item_description: Optional[str] = None
    found_location: Optional[str] = None
    found_by_staff_id: Optional[int] = None
    room_id: Optional[int] = None
    guest_name: Optional[str] = None
    guest_contact: Optional[str] = None
    status: Optional[str] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None
    resolved_at: Optional[datetime] = None


class LostFoundResponse(BaseModel):
    id: int
    item_description: str
    found_location: Optional[str] = None
    found_date: date
    found_by_staff_id: Optional[int] = None
    room_id: Optional[int] = None
    guest_name: Optional[str] = None
    guest_contact: Optional[str] = None
    status: str
    storage_location: Optional[str] = None
    notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    room_number: Optional[str] = None
    found_by_name: Optional[str] = None

    model_config = {"from_attributes": True}
