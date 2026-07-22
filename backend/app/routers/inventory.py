from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.user import User
from ..schemas.inventory import (
    StoreItemCreate, StoreItemUpdate, StoreItemResponse, StockAdjustRequest,
    StockMovementResponse, RequisitionCreate, RequisitionDecision, RequisitionResponse,
)
from ..services import inventory_service

router = APIRouter(prefix="/inventory", tags=["Inventory"])


# ── Store items / stock ──────────────────────────────────────────────────────

@router.get("/items", response_model=List[StoreItemResponse],
            dependencies=[Depends(require("fo.stock", "fo.store_req"))])
def list_items(include_inactive: bool = False, db: Session = Depends(get_db)):
    return inventory_service.list_items(db, include_inactive)


@router.post("/items", response_model=StoreItemResponse, status_code=201)
def create_item(data: StoreItemCreate, db: Session = Depends(get_db),
                user: User = Depends(require("fo.stock"))):
    return inventory_service.create_item(db, data, posted_by=user.full_name or user.email)


@router.patch("/items/{item_id}", response_model=StoreItemResponse,
              dependencies=[Depends(require("fo.stock"))])
def update_item(item_id: int, data: StoreItemUpdate, db: Session = Depends(get_db)):
    return inventory_service.update_item(db, item_id, data)


@router.post("/items/{item_id}/adjust", response_model=StoreItemResponse)
def adjust_stock(item_id: int, data: StockAdjustRequest, db: Session = Depends(get_db),
                 user: User = Depends(require("fo.stock"))):
    return inventory_service.adjust_stock(db, item_id, data,
                                          posted_by=user.full_name or user.email)


@router.get("/movements", response_model=List[StockMovementResponse],
            dependencies=[Depends(require("fo.stock"))])
def list_movements(item_id: Optional[int] = None, limit: int = 100,
                   db: Session = Depends(get_db)):
    return inventory_service.list_movements(db, item_id, limit)


# ── Requisitions ─────────────────────────────────────────────────────────────

@router.get("/requisitions", response_model=List[RequisitionResponse],
            dependencies=[Depends(require("fo.store_req", "fo.store_req.approve"))])
def list_requisitions(status: Optional[str] = None, db: Session = Depends(get_db)):
    return inventory_service.list_requisitions(db, status)


@router.post("/requisitions", response_model=RequisitionResponse, status_code=201)
def create_requisition(data: RequisitionCreate, db: Session = Depends(get_db),
                       user: User = Depends(require("fo.store_req"))):
    return inventory_service.create_requisition(db, data,
                                                requested_by=user.full_name or user.email)


@router.post("/requisitions/{req_id}/approve", response_model=RequisitionResponse)
def approve_requisition(req_id: int, data: RequisitionDecision = None,
                        db: Session = Depends(get_db),
                        user: User = Depends(require("fo.store_req.approve"))):
    return inventory_service.approve_requisition(
        db, req_id, decided_by=user.full_name or user.email,
        note=data.note if data else None)


@router.post("/requisitions/{req_id}/reject", response_model=RequisitionResponse)
def reject_requisition(req_id: int, data: RequisitionDecision = None,
                       db: Session = Depends(get_db),
                       user: User = Depends(require("fo.store_req.approve"))):
    return inventory_service.reject_requisition(
        db, req_id, decided_by=user.full_name or user.email,
        note=data.note if data else None)
