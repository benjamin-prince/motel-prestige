from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class SpecialInstructionCreate(BaseModel):
    department: str
    description: str


class SpecialInstructionResponse(SpecialInstructionCreate):
    id: int
    model_config = {"from_attributes": True}


class ReservationCreate(BaseModel):
    reservation_number: Optional[str] = None
    guest_id: int
    room_id: int
    check_in_date: date
    check_out_date: date
    release_date: Optional[date] = None
    adults: int = 1
    children: int = 0
    infants: int = 0
    extra_bed: int = 0
    status: str = "confirmed"
    resev_type: Optional[str] = "Confirm Reservation"
    rate_plan: Optional[str] = "OS"  # SS = Short Stay (hourly), OS = Overnight Stay
    stay_starts_at: Optional[datetime] = None  # required for SS — precise window, e.g. 14:00
    stay_ends_at: Optional[datetime] = None    # required for SS — precise window, e.g. 16:00
    guest_type: Optional[str] = "FIT"
    arrival_mode: Optional[str] = None
    arrival_flight: Optional[str] = None
    arrival_time: Optional[datetime] = None
    departure_mode: Optional[str] = None
    departure_flight: Optional[str] = None
    departure_time: Optional[datetime] = None
    source_reference: Optional[str] = None
    purpose: Optional[str] = None
    bill_to: Optional[str] = "Guest"
    payment_type: Optional[str] = "Cash"
    payment_method: Optional[str] = "Cash"
    advance_amount: Optional[Decimal] = 0
    payment_note: Optional[str] = None
    valet_parking: Optional[str] = "no"
    special_requests: Optional[str] = None
    special_instructions: Optional[list[SpecialInstructionCreate]] = []


class ReservationUpdate(BaseModel):
    status: Optional[str] = None
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None
    adults: Optional[int] = None
    children: Optional[int] = None
    extra_bed: Optional[int] = None
    room_id: Optional[int] = None
    payment_type: Optional[str] = None
    payment_method: Optional[str] = None
    advance_amount: Optional[Decimal] = None
    special_requests: Optional[str] = None


class ReservationResponse(BaseModel):
    id: int
    reservation_number: str
    guest_id: int
    room_id: int
    check_in_date: date
    check_out_date: date
    nights: int
    adults: int
    children: int
    infants: int
    extra_bed: int
    status: str
    resev_type: Optional[str] = None
    rate_plan: Optional[str] = None
    stay_starts_at: Optional[datetime] = None
    stay_ends_at: Optional[datetime] = None
    actual_check_in: Optional[datetime] = None
    actual_check_out: Optional[datetime] = None
    guest_type: Optional[str] = None
    arrival_mode: Optional[str] = None
    arrival_flight: Optional[str] = None
    bill_to: Optional[str] = None
    payment_type: Optional[str] = None
    payment_method: Optional[str] = None
    advance_amount: Optional[Decimal] = None
    created_at: Optional[datetime] = None
    special_instructions: list[SpecialInstructionResponse] = []

    model_config = {"from_attributes": True}
