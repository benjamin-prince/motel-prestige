from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class FnbOrderItemCreate(BaseModel):
    menu_item_id: Optional[int] = None
    name: str
    unit_price: Decimal = Field(ge=0)
    quantity: int = Field(gt=0)


class FnbOrderItemResponse(FnbOrderItemCreate):
    id: int
    line_total: Decimal
    model_config = {"from_attributes": True}


class FnbOrderCreate(BaseModel):
    outlet: str = "restaurant"          # restaurant | bar
    table_label: Optional[str] = None
    room_number: Optional[str] = None
    reservation_id: Optional[int] = None
    notes: Optional[str] = None
    items: List[FnbOrderItemCreate] = Field(min_length=1)


class FnbOrderUpdate(BaseModel):
    table_label: Optional[str] = None
    room_number: Optional[str] = None
    reservation_id: Optional[int] = None
    notes: Optional[str] = None
    items: Optional[List[FnbOrderItemCreate]] = None


class FnbSettleRequest(BaseModel):
    payment_method: str = "Cash"


class FnbChargeRoomRequest(BaseModel):
    reservation_id: int


class FnbOrderResponse(BaseModel):
    id: int
    order_number: str
    outlet: str
    table_label: Optional[str] = None
    room_number: Optional[str] = None
    reservation_id: Optional[int] = None
    status: str
    payment_method: Optional[str] = None
    subtotal: Decimal
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[FnbOrderItemResponse] = []
    model_config = {"from_attributes": True}
