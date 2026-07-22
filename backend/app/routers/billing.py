from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..schemas.billing import (
    FolioChargeCreate, FolioChargeResponse,
    FolioSettleRequest, FolioSummary,
    InvoiceCreate, InvoiceResponse,
)
from ..services import billing_service

router = APIRouter(prefix="/billing", tags=["Billing"])


# --- Folio charges ---

@router.get("/folio/{reservation_id}", response_model=List[FolioChargeResponse], dependencies=[Depends(require("fo.folio.view"))])
def get_folio(
    reservation_id: int,
    hide_void: bool = False,
    hide_unposted: bool = False,
    db: Session = Depends(get_db),
):
    return billing_service.list_folio(db, reservation_id, hide_void, hide_unposted)


@router.post("/folio/charge", response_model=FolioChargeResponse, status_code=201, dependencies=[Depends(require("fo.folio.charge"))])
def add_charge(data: FolioChargeCreate, db: Session = Depends(get_db)):
    return billing_service.add_charge(db, data)


@router.post("/folio/charge/{charge_id}/void", response_model=FolioChargeResponse, dependencies=[Depends(require("fo.folio.void"))])
def void_charge(charge_id: int, db: Session = Depends(get_db)):
    return billing_service.void_charge(db, charge_id)


@router.get("/folio/{reservation_id}/summary", response_model=FolioSummary, dependencies=[Depends(require("fo.folio.view"))])
def folio_summary(reservation_id: int, db: Session = Depends(get_db)):
    return billing_service.get_folio_summary(db, reservation_id)


@router.post("/folio/settle", response_model=FolioChargeResponse, status_code=201, dependencies=[Depends(require("fo.folio.settle"))])
def settle_folio(data: FolioSettleRequest, db: Session = Depends(get_db)):
    return billing_service.settle_folio(db, data)


# --- Night Audit ---

@router.get("/night-audit/pending-checkouts", dependencies=[Depends(require("fo.dashboard", "fo.night_audit", "fo.checkout"))])
def pending_checkouts(audit_date: Optional[date] = None, db: Session = Depends(get_db)):
    return billing_service.list_pending_checkouts(db, audit_date)


@router.post("/night-audit/post-room-charges", dependencies=[Depends(require("fo.nightly_charges"))])
def post_nightly_room_charges(audit_date: Optional[date] = None, db: Session = Depends(get_db)):
    return billing_service.post_nightly_room_charges(db, audit_date)


# --- Invoices ---

@router.get("/invoices/", response_model=List[InvoiceResponse], dependencies=[Depends(require("acc.invoices.view"))])
def list_invoices(reservation_id: Optional[int] = None, db: Session = Depends(get_db)):
    return billing_service.list_invoices(db, reservation_id)


@router.post("/invoices/", response_model=InvoiceResponse, status_code=201, dependencies=[Depends(require("acc.invoices.manage", "fo.checkout", "fo.folio.settle"))])
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db)):
    return billing_service.create_invoice(db, data)
