from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime


class GuestBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    id_expiry_date: Optional[date] = None
    nationality: Optional[str] = None
    country_of_residence: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    referred_by: Optional[str] = None
    notes: Optional[str] = None
    # CRM / loyalty
    vip: bool = False
    loyalty_tier: str = "standard"
    loyalty_points: int = 0
    tags: Optional[str] = None
    marketing_opt_in: bool = False
    preferred_room_type: Optional[str] = None
    bed_preference: Optional[str] = None
    smoking_preference: Optional[str] = None
    dietary: Optional[str] = None
    preferences: Optional[str] = None


class GuestCreate(GuestBase):
    pass


class GuestUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    id_expiry_date: Optional[date] = None
    nationality: Optional[str] = None
    country_of_residence: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    referred_by: Optional[str] = None
    notes: Optional[str] = None
    vip: Optional[bool] = None
    loyalty_tier: Optional[str] = None
    loyalty_points: Optional[int] = None
    tags: Optional[str] = None
    marketing_opt_in: Optional[bool] = None
    preferred_room_type: Optional[str] = None
    bed_preference: Optional[str] = None
    smoking_preference: Optional[str] = None
    dietary: Optional[str] = None
    preferences: Optional[str] = None


class GuestResponse(GuestBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
