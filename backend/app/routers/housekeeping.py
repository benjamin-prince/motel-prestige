from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.hk_task import HKTask
from ..models.lost_found import LostFoundItem
from ..models.room import Room
from ..models.user import User
from ..schemas.housekeeping import (
    HKTaskCreate, HKTaskUpdate, HKTaskResponse,
    RoomHKStatusUpdate,
    LostFoundCreate, LostFoundUpdate, LostFoundResponse,
)
from ..services.activity_logger import log_activity
from ..services.crud import get_or_404, apply_updates

router = APIRouter(prefix="/housekeeping", tags=["Housekeeping"])

VALID_HK_STATUSES = {"dirty", "cleaning", "clean", "inspected", "do_not_disturb", "out_of_order"}


# ── Rooms with HK status ──────────────────────────────────────────────────────

@router.get("/rooms", dependencies=[Depends(require("hk.room_status", "hk.assignment", "fo.rooms.status"))])
def list_rooms_hk(floor: Optional[int] = None, hk_status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Room)
    if floor is not None:
        q = q.filter(Room.floor == floor)
    if hk_status:
        q = q.filter(Room.hk_status == hk_status)
    rooms = q.order_by(Room.floor, Room.room_number).all()
    return [
        {
            "id": r.id,
            "room_number": r.room_number,
            "room_type": r.room_type,
            "floor": r.floor,
            "status": r.status,
            "hk_status": r.hk_status,
        }
        for r in rooms
    ]


@router.patch("/rooms/{room_id}/hk-status", dependencies=[Depends(require("hk.room_status"))])
def update_room_hk_status(room_id: int, data: RoomHKStatusUpdate, db: Session = Depends(get_db)):
    if data.hk_status not in VALID_HK_STATUSES:
        raise HTTPException(400, f"Invalid hk_status. Must be one of: {', '.join(VALID_HK_STATUSES)}")
    room = get_or_404(db, Room, id=room_id)
    old = room.hk_status
    room.hk_status = data.hk_status
    db.commit()
    db.refresh(room)
    log_activity(db, "room_hk_status_updated", entity_type="room", entity_id=room_id,
                 room=room.room_number, from_status=old, to_status=data.hk_status)
    return {"id": room.id, "room_number": room.room_number, "hk_status": room.hk_status}


# ── HK Tasks ──────────────────────────────────────────────────────────────────

def _enrich_task(task: HKTask) -> dict:
    d = {
        "id": task.id,
        "room_id": task.room_id,
        "assigned_to": task.assigned_to,
        "task_type": task.task_type,
        "priority": task.priority,
        "status": task.status,
        "scheduled_date": task.scheduled_date,
        "notes": task.notes,
        "started_at": task.started_at,
        "completed_at": task.completed_at,
        "created_at": task.created_at,
        "room_number": task.room.room_number if task.room else None,
        "room_type": task.room.room_type if task.room else None,
        "floor": task.room.floor if task.room else None,
        "assignee_name": task.assignee.full_name if task.assignee else None,
    }
    return d


@router.get("/tasks", response_model=List[HKTaskResponse], dependencies=[Depends(require("hk.tasks.view"))])
def list_tasks(
    scheduled_date: Optional[date] = None,
    status: Optional[str] = None,
    assigned_to: Optional[int] = None,
    floor: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(HKTask).join(Room, HKTask.room_id == Room.id)
    if scheduled_date:
        q = q.filter(HKTask.scheduled_date == scheduled_date)
    if status:
        q = q.filter(HKTask.status == status)
    if assigned_to:
        q = q.filter(HKTask.assigned_to == assigned_to)
    if floor is not None:
        q = q.filter(Room.floor == floor)
    tasks = q.order_by(HKTask.priority.desc(), Room.floor, Room.room_number).all()
    return [_enrich_task(t) for t in tasks]


@router.post("/tasks", response_model=HKTaskResponse, status_code=201, dependencies=[Depends(require("hk.tasks.assign", "hk.assignment"))])
def create_task(data: HKTaskCreate, db: Session = Depends(get_db)):
    room = get_or_404(db, Room, id=data.room_id)
    task = HKTask(
        room_id=data.room_id,
        assigned_to=data.assigned_to,
        task_type=data.task_type,
        priority=data.priority,
        scheduled_date=data.scheduled_date or date.today(),
        notes=data.notes,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    log_activity(db, "hk_task_created", entity_type="hk_task", entity_id=task.id,
                 room=room.room_number, type=data.task_type)
    return _enrich_task(task)


@router.patch("/tasks/{task_id}", response_model=HKTaskResponse, dependencies=[Depends(require("hk.tasks.complete", "hk.tasks.assign"))])
def update_task(task_id: int, data: HKTaskUpdate, db: Session = Depends(get_db)):
    task = get_or_404(db, HKTask, id=task_id, name="Task")
    apply_updates(task, data.model_dump(exclude_none=True))
    if data.status == "in_progress" and not task.started_at:
        task.started_at = datetime.now()
    if data.status == "done" and not task.completed_at:
        task.completed_at = datetime.now()
    db.commit()
    db.refresh(task)
    log_activity(db, "hk_task_updated", entity_type="hk_task", entity_id=task_id,
                 status=task.status)
    return _enrich_task(task)


@router.delete("/tasks/{task_id}", status_code=204, dependencies=[Depends(require("hk.tasks.assign"))])
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = get_or_404(db, HKTask, id=task_id, name="Task")
    db.delete(task)
    db.commit()


# ── Lost & Found ──────────────────────────────────────────────────────────────

def _enrich_lf(item: LostFoundItem) -> dict:
    return {
        "id": item.id,
        "item_description": item.item_description,
        "found_location": item.found_location,
        "found_date": item.found_date,
        "found_by_staff_id": item.found_by_staff_id,
        "room_id": item.room_id,
        "guest_name": item.guest_name,
        "guest_contact": item.guest_contact,
        "status": item.status,
        "storage_location": item.storage_location,
        "notes": item.notes,
        "resolved_at": item.resolved_at,
        "created_at": item.created_at,
        "room_number": item.room.room_number if item.room else None,
        "found_by_name": item.found_by.full_name if item.found_by else None,
    }


@router.get("/lost-found", response_model=List[LostFoundResponse], dependencies=[Depends(require("hk.lost_found"))])
def list_lost_found(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(LostFoundItem)
    if status:
        q = q.filter(LostFoundItem.status == status)
    items = q.order_by(LostFoundItem.created_at.desc()).all()
    return [_enrich_lf(i) for i in items]


@router.post("/lost-found", response_model=LostFoundResponse, status_code=201, dependencies=[Depends(require("hk.lost_found"))])
def create_lost_found(data: LostFoundCreate, db: Session = Depends(get_db)):
    item = LostFoundItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    log_activity(db, "lost_found_created", entity_type="lost_found", entity_id=item.id,
                 description=data.item_description)
    return _enrich_lf(item)


@router.patch("/lost-found/{item_id}", response_model=LostFoundResponse, dependencies=[Depends(require("hk.lost_found"))])
def update_lost_found(item_id: int, data: LostFoundUpdate, db: Session = Depends(get_db)):
    item = get_or_404(db, LostFoundItem, id=item_id, name="Item")
    apply_updates(item, data.model_dump(exclude_none=True))
    if data.status in ("claimed", "donated", "discarded") and not item.resolved_at:
        item.resolved_at = datetime.now()
    db.commit()
    db.refresh(item)
    log_activity(db, "lost_found_updated", entity_type="lost_found", entity_id=item_id,
                 status=item.status)
    return _enrich_lf(item)


@router.delete("/lost-found/{item_id}", status_code=204, dependencies=[Depends(require("hk.lost_found"))])
def delete_lost_found(item_id: int, db: Session = Depends(get_db)):
    item = get_or_404(db, LostFoundItem, id=item_id, name="Item")
    db.delete(item)
    db.commit()
