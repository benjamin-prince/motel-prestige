"""Inventory domain service.

Owns store-item stock and requisition business logic so the router stays a
thin HTTP adapter. Two invariants live here:

  * Stock is never written directly — every quantity change goes through
    ``adjust_stock`` so a StockMovement row always explains it.
  * A requisition only ever deducts stock at approval time, atomically for
    all of its lines: if any line exceeds what is in stock, the whole
    approval is refused so the store never goes negative.
"""
import random
import string
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from ..models.inventory import StoreItem, StockMovement, StoreRequisition, StoreRequisitionItem
from ..schemas.inventory import (
    StoreItemCreate, StoreItemUpdate, StockAdjustRequest, RequisitionCreate,
)
from .activity_logger import log_activity


# ── Store items ──────────────────────────────────────────────────────────────

def list_items(db: Session, include_inactive: bool = False) -> List[StoreItem]:
    q = db.query(StoreItem)
    if not include_inactive:
        q = q.filter(StoreItem.is_active == True)
    return q.order_by(StoreItem.category, StoreItem.name_en).all()


def create_item(db: Session, data: StoreItemCreate, posted_by: str) -> StoreItem:
    item = StoreItem(**data.model_dump())
    db.add(item)
    db.flush()
    if Decimal(str(item.quantity)) != 0:
        db.add(StockMovement(
            item_id=item.id, change=item.quantity, reason="initial",
            note="Opening stock", posted_by=posted_by,
        ))
    db.commit()
    db.refresh(item)
    log_activity(db, "store_item_created", entity_type="store_item", entity_id=item.id,
                 name=item.name_en)
    return item


def update_item(db: Session, item_id: int, data: StoreItemUpdate) -> StoreItem:
    item = db.query(StoreItem).filter(StoreItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Store item not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


def adjust_stock(db: Session, item_id: int, data: StockAdjustRequest,
                 posted_by: str, ref: Optional[str] = None,
                 commit: bool = True) -> StoreItem:
    """Apply a stock change and record the movement that explains it."""
    item = db.query(StoreItem).filter(StoreItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Store item not found")
    change = Decimal(str(data.change))
    if change == 0:
        raise HTTPException(400, "Stock change cannot be zero")
    new_qty = Decimal(str(item.quantity)) + change
    if new_qty < 0:
        raise HTTPException(
            400,
            f"Insufficient stock for '{item.name_en}': {item.quantity} {item.unit} available, "
            f"cannot remove {abs(change)}.",
        )
    item.quantity = new_qty
    db.add(StockMovement(
        item_id=item.id, change=change, reason=data.reason,
        ref=ref, note=data.note, posted_by=posted_by,
    ))
    if commit:
        db.commit()
        db.refresh(item)
    return item


def list_movements(db: Session, item_id: Optional[int] = None, limit: int = 100) -> List[dict]:
    q = db.query(StockMovement).options(joinedload(StockMovement.item))
    if item_id:
        q = q.filter(StockMovement.item_id == item_id)
    movements = q.order_by(StockMovement.created_at.desc(), StockMovement.id.desc()).limit(limit).all()
    return [
        {
            "id": m.id, "item_id": m.item_id, "change": m.change, "reason": m.reason,
            "ref": m.ref, "note": m.note, "posted_by": m.posted_by, "created_at": m.created_at,
            "item_name_en": m.item.name_en if m.item else None,
            "item_name_fr": m.item.name_fr if m.item else None,
        }
        for m in movements
    ]


# ── Requisitions ─────────────────────────────────────────────────────────────

def _unique_req_number(db: Session) -> str:
    while True:
        number = "REQ" + "".join(random.choices(string.digits, k=6))
        if not db.query(StoreRequisition).filter(StoreRequisition.req_number == number).first():
            return number


def _enrich_requisition(req: StoreRequisition) -> dict:
    return {
        "id": req.id, "req_number": req.req_number, "department": req.department,
        "status": req.status, "note": req.note, "requested_by": req.requested_by,
        "decided_by": req.decided_by, "decision_note": req.decision_note,
        "decided_at": req.decided_at, "created_at": req.created_at,
        "items": [
            {
                "id": line.id, "item_id": line.item_id, "quantity": line.quantity,
                "name_en": line.item.name_en if line.item else None,
                "name_fr": line.item.name_fr if line.item else None,
                "unit": line.item.unit if line.item else None,
                "in_stock": line.item.quantity if line.item else None,
            }
            for line in req.items
        ],
    }


def list_requisitions(db: Session, status: Optional[str] = None) -> List[dict]:
    q = db.query(StoreRequisition).options(
        joinedload(StoreRequisition.items).joinedload(StoreRequisitionItem.item)
    )
    if status:
        q = q.filter(StoreRequisition.status == status)
    return [_enrich_requisition(r) for r in q.order_by(StoreRequisition.created_at.desc()).all()]


def create_requisition(db: Session, data: RequisitionCreate, requested_by: str) -> dict:
    item_ids = [line.item_id for line in data.items]
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(400, "Duplicate items in requisition — merge the quantities into one line")
    found = db.query(StoreItem).filter(StoreItem.id.in_(item_ids), StoreItem.is_active == True).all()
    missing = set(item_ids) - {i.id for i in found}
    if missing:
        raise HTTPException(404, f"Store item(s) not found: {sorted(missing)}")

    req = StoreRequisition(
        req_number=_unique_req_number(db),
        department=data.department,
        note=data.note,
        requested_by=requested_by,
    )
    db.add(req)
    db.flush()
    for line in data.items:
        db.add(StoreRequisitionItem(requisition_id=req.id, item_id=line.item_id, quantity=line.quantity))
    db.commit()
    db.refresh(req)
    log_activity(db, "requisition_created", entity_type="requisition", entity_id=req.id,
                 req_number=req.req_number, department=req.department)
    return _enrich_requisition(req)


def _get_pending(db: Session, req_id: int) -> StoreRequisition:
    req = (
        db.query(StoreRequisition)
        .options(joinedload(StoreRequisition.items).joinedload(StoreRequisitionItem.item))
        .filter(StoreRequisition.id == req_id)
        .first()
    )
    if not req:
        raise HTTPException(404, "Requisition not found")
    if req.status != "pending":
        raise HTTPException(400, f"Requisition is already {req.status}")
    return req


def approve_requisition(db: Session, req_id: int, decided_by: str,
                        note: Optional[str] = None) -> dict:
    """Approve and deduct stock — all lines or none."""
    req = _get_pending(db, req_id)

    short = [
        f"{line.item.name_en} (requested {line.quantity}, in stock {line.item.quantity})"
        for line in req.items
        if Decimal(str(line.item.quantity)) < Decimal(str(line.quantity))
    ]
    if short:
        raise HTTPException(400, "Insufficient stock: " + "; ".join(short))

    for line in req.items:
        adjust_stock(
            db, line.item_id,
            StockAdjustRequest(change=-Decimal(str(line.quantity)), reason="requisition",
                               note=f"Requisition {req.req_number} — {req.department}"),
            posted_by=decided_by, ref=req.req_number, commit=False,
        )
    req.status = "approved"
    req.decided_by = decided_by
    req.decision_note = note
    req.decided_at = datetime.now()
    db.commit()
    db.refresh(req)
    log_activity(db, "requisition_approved", entity_type="requisition", entity_id=req.id,
                 req_number=req.req_number)
    return _enrich_requisition(req)


def reject_requisition(db: Session, req_id: int, decided_by: str,
                       note: Optional[str] = None) -> dict:
    req = _get_pending(db, req_id)
    req.status = "rejected"
    req.decided_by = decided_by
    req.decision_note = note
    req.decided_at = datetime.now()
    db.commit()
    db.refresh(req)
    log_activity(db, "requisition_rejected", entity_type="requisition", entity_id=req.id,
                 req_number=req.req_number)
    return _enrich_requisition(req)
