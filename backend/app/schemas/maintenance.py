from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MaintenanceCreate(BaseModel):
    title: str
    room_id: Optional[int] = None
    location_description: Optional[str] = None
    category: str = "general"
    priority: str = "medium"
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    reported_by: Optional[int] = None


class MaintenanceUpdate(BaseModel):
    title: Optional[str] = None
    room_id: Optional[int] = None
    location_description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None


class MaintenanceResponse(BaseModel):
    id: int
    title: str
    room_id: Optional[int] = None
    location_description: Optional[str] = None
    category: str
    priority: str
    status: str
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    reported_by: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    room_number: Optional[str] = None
    assignee_name: Optional[str] = None
    reporter_name: Optional[str] = None

    model_config = {"from_attributes": True}
