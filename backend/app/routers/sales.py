from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.sales import RatePackage, SalesAccount
from ..schemas.sales import (
    RatePackageCreate, RatePackageUpdate, RatePackageResponse,
    SalesAccountCreate, SalesAccountUpdate, SalesAccountResponse,
)

router = APIRouter(prefix="/sales", tags=["Sales"])


# ── Rate Packages ─────────────────────────────────────────────────────────────
@router.get("/packages", response_model=List[RatePackageResponse],
            dependencies=[Depends(require("sales.packages.view", "sales.packages.manage", "fo.res.create"))])
def list_packages(active_only: bool = False, db: Session = Depends(get_db)):
    q = db.query(RatePackage)
    if active_only:
        q = q.filter(RatePackage.is_active == True)  # noqa: E712
    return q.order_by(RatePackage.name_en).all()


@router.post("/packages", response_model=RatePackageResponse, status_code=201,
             dependencies=[Depends(require("sales.packages.manage"))])
def create_package(data: RatePackageCreate, db: Session = Depends(get_db)):
    if db.query(RatePackage).filter(RatePackage.code == data.code).first():
        raise HTTPException(409, "A package with this code already exists")
    pkg = RatePackage(**data.model_dump())
    db.add(pkg)
    db.commit()
    db.refresh(pkg)
    return pkg


@router.patch("/packages/{pkg_id}", response_model=RatePackageResponse,
              dependencies=[Depends(require("sales.packages.manage"))])
def update_package(pkg_id: int, data: RatePackageUpdate, db: Session = Depends(get_db)):
    pkg = db.query(RatePackage).filter(RatePackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(pkg, k, v)
    db.commit()
    db.refresh(pkg)
    return pkg


@router.delete("/packages/{pkg_id}", status_code=204,
               dependencies=[Depends(require("sales.packages.manage"))])
def delete_package(pkg_id: int, db: Session = Depends(get_db)):
    pkg = db.query(RatePackage).filter(RatePackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    db.delete(pkg)
    db.commit()


# ── Sales Accounts ────────────────────────────────────────────────────────────
@router.get("/accounts", response_model=List[SalesAccountResponse],
            dependencies=[Depends(require("sales.agents.view", "sales.agents.manage"))])
def list_accounts(account_type: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(SalesAccount)
    if account_type:
        q = q.filter(SalesAccount.account_type == account_type)
    return q.order_by(SalesAccount.name).all()


@router.post("/accounts", response_model=SalesAccountResponse, status_code=201,
             dependencies=[Depends(require("sales.agents.manage"))])
def create_account(data: SalesAccountCreate, db: Session = Depends(get_db)):
    acc = SalesAccount(**data.model_dump())
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.patch("/accounts/{acc_id}", response_model=SalesAccountResponse,
              dependencies=[Depends(require("sales.agents.manage"))])
def update_account(acc_id: int, data: SalesAccountUpdate, db: Session = Depends(get_db)):
    acc = db.query(SalesAccount).filter(SalesAccount.id == acc_id).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(acc, k, v)
    db.commit()
    db.refresh(acc)
    return acc


@router.delete("/accounts/{acc_id}", status_code=204,
               dependencies=[Depends(require("sales.agents.manage"))])
def delete_account(acc_id: int, db: Session = Depends(get_db)):
    acc = db.query(SalesAccount).filter(SalesAccount.id == acc_id).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    db.delete(acc)
    db.commit()
