from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.pricing import PricingRule
from ..schemas.pricing import PricingRuleCreate, PricingRuleUpdate, PricingRuleResponse
from ..services import pricing_service
from ..services.crud import get_or_404, apply_updates

router = APIRouter(prefix="/revenue", tags=["Revenue"])


@router.get("/calendar", dependencies=[Depends(require("revenue.view", "fo.dashboard"))])
def rate_calendar(days: int = 14, db: Session = Depends(get_db)):
    """Effective nightly rate per room type over the next `days`, after applying
    active pricing rules to each day's forecast occupancy."""
    return pricing_service.rate_calendar(db, days=max(1, min(days, 60)))


@router.get("/rules", response_model=List[PricingRuleResponse],
            dependencies=[Depends(require("revenue.view", "fo.dashboard"))])
def list_rules(db: Session = Depends(get_db)):
    return db.query(PricingRule).order_by(PricingRule.priority, PricingRule.id).all()


@router.post("/rules", response_model=PricingRuleResponse, status_code=201,
             dependencies=[Depends(require("revenue.manage", "fo.configuration"))])
def create_rule(data: PricingRuleCreate, db: Session = Depends(get_db)):
    rule = PricingRule(**data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/rules/{rule_id}", response_model=PricingRuleResponse,
              dependencies=[Depends(require("revenue.manage", "fo.configuration"))])
def update_rule(rule_id: int, data: PricingRuleUpdate, db: Session = Depends(get_db)):
    rule = get_or_404(db, PricingRule, id=rule_id)
    apply_updates(rule, data.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=204,
               dependencies=[Depends(require("revenue.manage", "fo.configuration"))])
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = get_or_404(db, PricingRule, id=rule_id)
    db.delete(rule)
    db.commit()
