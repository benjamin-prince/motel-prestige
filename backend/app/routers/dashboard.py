from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..services import analytics_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview", dependencies=[Depends(require("fo.dashboard"))])
def overview(days: int = 7, db: Session = Depends(get_db)):
    """Executive KPIs: occupancy, ADR, RevPAR, revenue (today / MTD) and a
    daily trend for the sparkline. `days` clamps the trend window."""
    return analytics_service.get_overview(db, trend_days=max(1, min(days, 31)))
