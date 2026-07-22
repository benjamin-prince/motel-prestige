from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.maintenance import MaintenanceRequest
from ..models.room import Room
from ..models.user import User
from ..schemas.maintenance import MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse
from ..services.activity_logger import log_activity
from ..services.crud import get_or_404, apply_updates

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


def _enrich(req: MaintenanceRequest) -> dict:
    return {
        "id": req.id,
        "title": req.title,
        "room_id": req.room_id,
        "location_description": req.location_description,
        "category": req.category,
        "priority": req.priority,
        "status": req.status,
        "description": req.description,
        "assigned_to": req.assigned_to,
        "reported_by": req.reported_by,
        "started_at": req.started_at,
        "completed_at": req.completed_at,
        "resolution_notes": req.resolution_notes,
        "created_at": req.created_at,
        "room_number": req.room.room_number if req.room else None,
        "assignee_name": req.assignee.full_name if req.assignee else None,
        "reporter_name": req.reporter.full_name if req.reporter else None,
    }


@router.get("/", response_model=List[MaintenanceResponse], dependencies=[Depends(require("maint.view"))])
def list_requests(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(MaintenanceRequest)
    if status:
        q = q.filter(MaintenanceRequest.status == status)
    if priority:
        q = q.filter(MaintenanceRequest.priority == priority)
    if category:
        q = q.filter(MaintenanceRequest.category == category)
    if assigned_to:
        q = q.filter(MaintenanceRequest.assigned_to == assigned_to)
    reqs = q.order_by(
        MaintenanceRequest.priority.desc(),
        MaintenanceRequest.created_at.desc()
    ).all()
    return [_enrich(r) for r in reqs]


@router.post("/", response_model=MaintenanceResponse, status_code=201, dependencies=[Depends(require("maint.create"))])
def create_request(data: MaintenanceCreate, db: Session = Depends(get_db)):
    if data.room_id:
        get_or_404(db, Room, id=data.room_id)
    req = MaintenanceRequest(**data.model_dump())
    db.add(req)
    db.commit()
    db.refresh(req)
    log_activity(db, "maintenance_created", entity_type="maintenance", entity_id=req.id,
                 title=data.title, priority=data.priority)
    return _enrich(req)


@router.patch("/{req_id}", response_model=MaintenanceResponse, dependencies=[Depends(require("maint.edit", "maint.assign", "maint.close"))])
def update_request(req_id: int, data: MaintenanceUpdate, db: Session = Depends(get_db)):
    req = get_or_404(db, MaintenanceRequest, id=req_id, name="Request")
    apply_updates(req, data.model_dump(exclude_none=True))
    if data.status == "in_progress" and not req.started_at:
        req.started_at = datetime.now()
    if data.status == "done" and not req.completed_at:
        req.completed_at = datetime.now()
    db.commit()
    db.refresh(req)
    log_activity(db, "maintenance_updated", entity_type="maintenance", entity_id=req_id,
                 status=req.status)
    return _enrich(req)


@router.delete("/{req_id}", status_code=204, dependencies=[Depends(require("maint.delete"))])
def delete_request(req_id: int, db: Session = Depends(get_db)):
    req = get_or_404(db, MaintenanceRequest, id=req_id, name="Request")
    db.delete(req)
    db.commit()
