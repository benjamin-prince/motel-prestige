from decimal import Decimal
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.currency import Currency, Payment
from ..services.activity_logger import log_activity
from ..services.crud import get_or_404, apply_updates
from ..schemas.currency import (
    CurrencyCreate, CurrencyUpdate, CurrencyResponse,
    ConversionRequest, ConversionResponse,
    PaymentCreate, PaymentResponse,
    CaisseEntry, CaisseSummary,
)

router = APIRouter(prefix="/currencies", tags=["Currencies & Payments"])


# ── Seed default currencies on first call ──────────────────────────────────

DEFAULT_CURRENCIES = [
    {"code": "XAF", "name": "Franc CFA BEAC",  "symbol": "FCFA", "xaf_rate": Decimal("1"),        "is_default": True},
    {"code": "USD", "name": "Dollar Américain", "symbol": "$",    "xaf_rate": Decimal("600"),       "is_default": False},
    {"code": "EUR", "name": "Euro",             "symbol": "€",    "xaf_rate": Decimal("655.957"),   "is_default": False},
    {"code": "CNY", "name": "Yuan Chinois",     "symbol": "¥",    "xaf_rate": Decimal("82"),        "is_default": False},
    {"code": "GBP", "name": "Livre Sterling",   "symbol": "£",    "xaf_rate": Decimal("765"),       "is_default": False},
]


def _seed(db: Session):
    if db.query(Currency).count() == 0:
        for c in DEFAULT_CURRENCIES:
            db.add(Currency(**c))
        db.commit()


# ── Currency CRUD ──────────────────────────────────────────────────────────

@router.get("/", response_model=List[CurrencyResponse])
def list_currencies(active_only: bool = False, db: Session = Depends(get_db)):
    _seed(db)
    q = db.query(Currency)
    if active_only:
        q = q.filter(Currency.is_active == True)
    return q.order_by(Currency.is_default.desc(), Currency.code).all()


@router.post("/", response_model=CurrencyResponse, status_code=201, dependencies=[Depends(require("acc.currencies"))])
def create_currency(data: CurrencyCreate, db: Session = Depends(get_db)):
    if db.query(Currency).filter(Currency.code == data.code.upper()).first():
        raise HTTPException(400, f"Currency {data.code.upper()} already exists")
    cur = Currency(**data.model_dump(), code=data.code.upper(), is_default=False)
    db.add(cur)
    db.commit()
    db.refresh(cur)
    return cur


@router.get("/{code}", response_model=CurrencyResponse)
def get_currency(code: str, db: Session = Depends(get_db)):
    return get_or_404(db, Currency, code=code.upper(), name=f"Currency {code.upper()}")


@router.patch("/{code}", response_model=CurrencyResponse, dependencies=[Depends(require("acc.currencies"))])
def update_currency(code: str, data: CurrencyUpdate, db: Session = Depends(get_db)):
    cur = get_or_404(db, Currency, code=code.upper())
    if cur.is_default and data.xaf_rate is not None and data.xaf_rate != Decimal("1"):
        raise HTTPException(400, "Cannot change XAF rate — it is always 1")
    apply_updates(cur, data.model_dump(exclude_none=True))
    cur.updated_at = datetime.now()
    db.commit()
    db.refresh(cur)
    return cur


@router.delete("/{code}", status_code=204, dependencies=[Depends(require("acc.currencies"))])
def delete_currency(code: str, db: Session = Depends(get_db)):
    cur = get_or_404(db, Currency, code=code.upper())
    if cur.is_default:
        raise HTTPException(400, "Cannot delete the default currency (XAF)")
    db.delete(cur)
    db.commit()


# ── Conversion ────────────────────────────────────────────────────────────

@router.post("/convert", response_model=ConversionResponse)
def convert(req: ConversionRequest, db: Session = Depends(get_db)):
    _seed(db)
    if req.target_currency.upper() == "XAF":
        return ConversionResponse(
            amount_xaf=req.amount_xaf, target_currency="XAF",
            target_amount=req.amount_xaf, xaf_rate=Decimal("1"), symbol="FCFA",
        )
    cur = db.query(Currency).filter(Currency.code == req.target_currency.upper(), Currency.is_active == True).first()
    if not cur:
        raise HTTPException(404, "Target currency not found or inactive")
    target_amount = (req.amount_xaf / cur.xaf_rate).quantize(Decimal("0.01"))
    return ConversionResponse(
        amount_xaf=req.amount_xaf,
        target_currency=cur.code,
        target_amount=target_amount,
        xaf_rate=cur.xaf_rate,
        symbol=cur.symbol,
    )


# ── Payments ──────────────────────────────────────────────────────────────

@router.get("/payments/list", response_model=List[PaymentResponse], dependencies=[Depends(require("acc.payments.view", "fo.folio.view"))])
def list_payments(
    reservation_id: Optional[int] = None,
    currency_code: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Payment)
    if reservation_id:
        q = q.filter(Payment.reservation_id == reservation_id)
    if currency_code:
        q = q.filter(Payment.currency_code == currency_code.upper())
    return q.order_by(Payment.paid_at.desc()).all()


@router.post("/payments", response_model=PaymentResponse, status_code=201,
             dependencies=[Depends(require("acc.payments.create", "fo.folio.settle", "fo.checkin"))])
def create_payment(data: PaymentCreate, db: Session = Depends(get_db)):
    _seed(db)
    code = data.currency_code.upper()
    cur = db.query(Currency).filter(Currency.code == code, Currency.is_active == True).first()
    if not cur:
        raise HTTPException(404, f"Currency {code} not found or inactive")

    xaf_equivalent = (data.amount * cur.xaf_rate).quantize(Decimal("0.01"))

    payment = Payment(
        reservation_id=data.reservation_id,
        invoice_id=data.invoice_id,
        amount=data.amount,
        currency_code=code,
        xaf_equivalent=xaf_equivalent,
        xaf_rate_snapshot=cur.xaf_rate,
        payment_method=data.payment_method,
        reference=data.reference,
        note=data.note,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    # Keep the folio in sync: a payment against a reservation also settles
    # its folio balance.
    if data.reservation_id:
        from ..services.billing_service import post_payment_to_folio
        post_payment_to_folio(db, data.reservation_id, xaf_equivalent, data.payment_method)
    log_activity(db, "payment_received", entity_type="payment", entity_id=payment.id,
                 amount=f"{data.amount:,.0f}", currency=code, res_no=str(data.reservation_id))
    return payment


# ── Caisse (cash register) ─────────────────────────────────────────────────

@router.get("/caisse/summary", response_model=CaisseSummary, dependencies=[Depends(require("acc.caisse"))])
def caisse_summary(db: Session = Depends(get_db)):
    _seed(db)
    rows = (
        db.query(
            Payment.currency_code,
            func.sum(Payment.amount).label("total_amount"),
            func.sum(Payment.xaf_equivalent).label("total_xaf"),
            func.count(Payment.id).label("count"),
        )
        .group_by(Payment.currency_code)
        .all()
    )

    entries = []
    grand_total_xaf = Decimal("0")
    for row in rows:
        cur = db.query(Currency).filter(Currency.code == row.currency_code).first()
        name = cur.name if cur else row.currency_code
        symbol = cur.symbol if cur else row.currency_code
        total_xaf = Decimal(str(row.total_xaf or 0))
        entries.append(CaisseEntry(
            currency_code=row.currency_code,
            currency_name=name,
            symbol=symbol,
            total_amount=Decimal(str(row.total_amount or 0)),
            total_xaf=total_xaf,
            payment_count=row.count,
        ))
        grand_total_xaf += total_xaf

    # Sort: default (XAF) first
    entries.sort(key=lambda e: (0 if e.currency_code == "XAF" else 1, e.currency_code))
    return CaisseSummary(entries=entries, grand_total_xaf=grand_total_xaf)
