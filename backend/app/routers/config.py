from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from decimal import Decimal
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.config import MenuItem, FolioParticular, LookupValue, ActivityLog, RoomTypeConfig, SystemSetting, Property, PermissionGroup, Permission, Role
from ..services.activity_logger import list_actions
from ..services.crud import get_or_404, apply_updates

router = APIRouter(prefix="/config", tags=["Configuration & Seed Data"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class MenuItemResponse(BaseModel):
    id: int; name_en: str; name_fr: str
    main_category: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    price: Decimal; image_url: Optional[str] = None; is_available: bool
    model_config = {"from_attributes": True}

class MenuItemCreate(BaseModel):
    name_en: str; name_fr: str
    main_category: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    price: Decimal; image_url: Optional[str] = None; is_available: bool = True

class FolioParticularResponse(BaseModel):
    id: int; name_en: str; name_fr: str; is_active: bool
    model_config = {"from_attributes": True}

class LookupResponse(BaseModel):
    id: int; group: str; value_en: str; value_fr: str
    parent_value_en: Optional[str] = None
    sort_order: int; is_active: bool
    model_config = {"from_attributes": True}

class ActivityLogResponse(BaseModel):
    id: int; icon: str; color: str; message_en: str; message_fr: str
    entity_type: Optional[str] = None; entity_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class RoomTypeConfigResponse(BaseModel):
    id: int; type_code: str; name_en: str; name_fr: str
    default_image_url: Optional[str]; is_active: bool
    model_config = {"from_attributes": True}


# ── Menu Items ────────────────────────────────────────────────────────────────

@router.get("/menu-items", response_model=List[MenuItemResponse])
def list_menu_items(
    main_category: Optional[str] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(MenuItem)
    if main_category:
        q = q.filter(MenuItem.main_category == main_category)
    if category:
        q = q.filter(MenuItem.category == category)
    if subcategory:
        q = q.filter(MenuItem.subcategory == subcategory)
    return q.order_by(MenuItem.main_category, MenuItem.category, MenuItem.subcategory, MenuItem.name_en).all()


@router.get("/menu-main-categories")
def list_main_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(LookupValue)
        .filter(LookupValue.group == "menu_main_category", LookupValue.is_active == True)
        .order_by(LookupValue.sort_order)
        .all()
    )
    return [{"value_en": r.value_en, "value_fr": r.value_fr, "sort_order": r.sort_order} for r in rows]


@router.get("/menu-subcategories")
def list_menu_subcategories(parent: Optional[str] = None, db: Session = Depends(get_db)):
    """Return subcategories for a given parent category (or all if no parent given)."""
    q = db.query(LookupValue).filter(
        LookupValue.group == "menu_subcategory",
        LookupValue.is_active == True,
    )
    if parent:
        q = q.filter(LookupValue.parent_value_en == parent)
    return [
        {"value_en": r.value_en, "value_fr": r.value_fr, "parent_value_en": r.parent_value_en, "sort_order": r.sort_order}
        for r in q.order_by(LookupValue.parent_value_en, LookupValue.sort_order).all()
    ]


@router.post("/menu-items", response_model=MenuItemResponse, status_code=201, dependencies=[Depends(require("fnb.menu.create"))])
def create_menu_item(data: MenuItemCreate, db: Session = Depends(get_db)):
    item = MenuItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/menu-items/{item_id}", response_model=MenuItemResponse, dependencies=[Depends(require("fnb.menu.edit", "fnb.menu.toggle"))])
def update_menu_item(item_id: int, data: dict, db: Session = Depends(get_db)):
    item = get_or_404(db, MenuItem, id=item_id, name="Item")
    apply_updates(item, data)
    db.commit()
    db.refresh(item)
    return item


@router.get("/menu-categories")
def list_menu_categories(parent: Optional[str] = None, db: Session = Depends(get_db)):
    """Returns bilingual level-2 category objects, optionally filtered by main category."""
    q = db.query(LookupValue).filter(LookupValue.group == "menu_category", LookupValue.is_active == True)
    if parent:
        q = q.filter(LookupValue.parent_value_en == parent)
    rows = q.order_by(LookupValue.sort_order).all()
    if rows:
        return [{"value_en": r.value_en, "value_fr": r.value_fr, "parent_value_en": r.parent_value_en, "sort_order": r.sort_order} for r in rows]
    cats = db.query(MenuItem.category).distinct().order_by(MenuItem.category).all()
    return [{"value_en": c[0], "value_fr": c[0], "parent_value_en": None, "sort_order": 99} for c in cats]


# ── Folio Particulars ─────────────────────────────────────────────────────────

class FolioParticularCreate(BaseModel):
    name_en: str
    name_fr: str

class FolioParticularUpdate(BaseModel):
    name_en: Optional[str] = None
    name_fr: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/folio-particulars", response_model=List[FolioParticularResponse])
def list_particulars(all: bool = False, db: Session = Depends(get_db)):
    q = db.query(FolioParticular)
    if not all:
        q = q.filter(FolioParticular.is_active == True)
    return q.order_by(FolioParticular.name_en).all()

@router.post("/folio-particulars", response_model=FolioParticularResponse, status_code=201, dependencies=[Depends(require("fo.reference", "fo.configuration"))])
def create_particular(data: FolioParticularCreate, db: Session = Depends(get_db)):
    item = FolioParticular(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.patch("/folio-particulars/{item_id}", response_model=FolioParticularResponse, dependencies=[Depends(require("fo.reference", "fo.configuration"))])
def update_particular(item_id: int, data: FolioParticularUpdate, db: Session = Depends(get_db)):
    item = get_or_404(db, FolioParticular, id=item_id, name="Item")
    apply_updates(item, data.model_dump(exclude_none=True))
    db.commit()
    db.refresh(item)
    return item


# ── Lookup Values ─────────────────────────────────────────────────────────────

class LookupCreate(BaseModel):
    group: str
    value_en: str
    value_fr: str
    sort_order: int = 99
    parent_value_en: Optional[str] = None

class LookupUpdate(BaseModel):
    value_en: Optional[str] = None
    value_fr: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

@router.get("/lookup/{group}", response_model=List[LookupResponse])
def lookup(group: str, all: bool = False, db: Session = Depends(get_db)):
    q = db.query(LookupValue).filter(LookupValue.group == group)
    if not all:
        q = q.filter(LookupValue.is_active == True)
    return q.order_by(LookupValue.sort_order).all()

@router.get("/lookup", response_model=List[LookupResponse])
def all_lookups(all: bool = False, db: Session = Depends(get_db)):
    q = db.query(LookupValue)
    if not all:
        q = q.filter(LookupValue.is_active == True)
    return q.order_by(LookupValue.group, LookupValue.sort_order).all()

@router.post("/lookup", response_model=LookupResponse, status_code=201, dependencies=[Depends(require("fo.reference", "fo.configuration", "admin.settings"))])
def create_lookup(data: LookupCreate, db: Session = Depends(get_db)):
    item = LookupValue(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.patch("/lookup/{item_id}", response_model=LookupResponse, dependencies=[Depends(require("fo.reference", "fo.configuration", "admin.settings"))])
def update_lookup(item_id: int, data: LookupUpdate, db: Session = Depends(get_db)):
    item = get_or_404(db, LookupValue, id=item_id, name="Item")
    apply_updates(item, data.model_dump(exclude_none=True))
    db.commit()
    db.refresh(item)
    return item


# ── Activity Log ──────────────────────────────────────────────────────────────

@router.get("/activity", response_model=List[ActivityLogResponse])
def activity_log(
    limit: int = 50,
    skip: int = 0,
    entity_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ActivityLog)
    if entity_type:
        q = q.filter(ActivityLog.entity_type == entity_type)
    if search:
        term = f"%{search}%"
        q = q.filter(
            ActivityLog.message_en.ilike(term) | ActivityLog.message_fr.ilike(term)
        )
    return q.order_by(ActivityLog.created_at.desc()).offset(skip).limit(limit).all()


class ActivityLogCreate(BaseModel):
    icon: str = "📋"
    color: str = "#3b5bdb"
    message_en: str
    message_fr: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None


@router.post("/activity", response_model=ActivityLogResponse, status_code=201,
             dependencies=[Depends(require("admin.audit_log"))])
def log_activity(data: ActivityLogCreate, db: Session = Depends(get_db)):
    # Only whitelisted fields — id and created_at are server-owned so an entry
    # cannot be backdated or spoofed onto another record.
    entry = ActivityLog(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ── Room Type Configs ─────────────────────────────────────────────────────────

class RoomTypeUpdate(BaseModel):
    name_en: Optional[str] = None
    name_fr: Optional[str] = None
    default_image_url: Optional[str] = None

@router.get("/room-types", response_model=List[RoomTypeConfigResponse])
def list_room_types(db: Session = Depends(get_db)):
    return db.query(RoomTypeConfig).order_by(RoomTypeConfig.type_code).all()

@router.patch("/room-types/{item_id}", response_model=RoomTypeConfigResponse, dependencies=[Depends(require("fo.configuration", "admin.settings"))])
def update_room_type(item_id: int, data: RoomTypeUpdate, db: Session = Depends(get_db)):
    item = get_or_404(db, RoomTypeConfig, id=item_id, name="Item")
    apply_updates(item, data.model_dump(exclude_none=True))
    db.commit()
    db.refresh(item)
    return item


@router.get("/actions")
def get_action_templates():
    """List all available activity log action keys and their bilingual templates."""
    return list_actions()


# ── System Settings ───────────────────────────────────────────────────────────


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)) -> dict:
    rows = db.query(SystemSetting).all()
    return {r.key: r.value for r in rows}

@router.put("/settings", dependencies=[Depends(require("admin.settings"))])
def save_settings(data: dict, db: Session = Depends(get_db)) -> dict:
    for key, value in data.items():
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(SystemSetting(key=key, value=value))
    db.commit()
    rows = db.query(SystemSetting).all()
    return {r.key: r.value for r in rows}


# ── Properties ────────────────────────────────────────────────────────────────

class PropertyCreate(BaseModel):
    name: str
    type: str = "hotel"
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    floor_min: int = 0
    floor_max: int = 0
    floors: Optional[str] = None      # JSON array of {floor, label}
    facilities: Optional[str] = None  # JSON array of {code, floor}

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    floor_min: Optional[int] = None
    floor_max: Optional[int] = None
    floors: Optional[str] = None      # JSON array of {floor, label}
    facilities: Optional[str] = None  # JSON array of {code, floor}

@router.get("/properties")
def list_properties(db: Session = Depends(get_db)):
    return db.query(Property).order_by(Property.is_default.desc(), Property.name).all()

@router.post("/properties", status_code=201, dependencies=[Depends(require("admin.settings"))])
def create_property(data: PropertyCreate, db: Session = Depends(get_db)):
    if data.is_default:
        db.query(Property).update({"is_default": False})
    prop = Property(**data.model_dump())
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop

@router.patch("/properties/{prop_id}", dependencies=[Depends(require("admin.settings"))])
def update_property(prop_id: int, data: PropertyUpdate, db: Session = Depends(get_db)):
    prop = get_or_404(db, Property, id=prop_id)
    if data.is_default:
        db.query(Property).filter(Property.id != prop_id).update({"is_default": False})
    apply_updates(prop, data.model_dump(exclude_none=True))
    db.commit()
    db.refresh(prop)
    return prop

@router.delete("/properties/{prop_id}", status_code=204, dependencies=[Depends(require("admin.settings"))])
def delete_property(prop_id: int, db: Session = Depends(get_db)):
    prop = get_or_404(db, Property, id=prop_id)
    if prop.is_default:
        raise HTTPException(400, "Cannot delete the default property")
    db.delete(prop)
    db.commit()


# ── Permission Groups & Permissions ───────────────────────────────────────────

@router.get("/permission-groups", dependencies=[Depends(require("admin.roles"))])
def list_permission_groups(db: Session = Depends(get_db)):
    groups = (db.query(PermissionGroup).order_by(PermissionGroup.sort_order).all())
    perms_all = (db.query(Permission).order_by(Permission.group_key, Permission.sort_order).all())
    perms_by_group: dict = {}
    for p in perms_all:
        perms_by_group.setdefault(p.group_key, []).append({
            "key": p.key, "label_en": p.label_en, "label_fr": p.label_fr, "sort_order": p.sort_order,
        })
    return [
        {
            "key": g.key, "label_en": g.label_en, "label_fr": g.label_fr,
            "color": g.color, "icon": g.icon, "sort_order": g.sort_order,
            "permissions": perms_by_group.get(g.key, []),
        }
        for g in groups
    ]


# ── Roles ─────────────────────────────────────────────────────────────────────

import json as _json

class RoleCreate(BaseModel):
    id: str
    name_en: str
    name_fr: str
    color: str = "#3b5bdb"
    permissions: List[str] = []

class RoleUpdate(BaseModel):
    name_en: Optional[str] = None
    name_fr: Optional[str] = None
    color: Optional[str] = None
    permissions: Optional[List[str]] = None

def _role_dict(role: Role) -> dict:
    return {
        "id": role.id, "name_en": role.name_en, "name_fr": role.name_fr,
        "color": role.color, "is_locked": role.is_locked,
        "permissions": _json.loads(role.permissions) if role.permissions else [],
    }

@router.get("/roles", dependencies=[Depends(require("admin.roles", "admin.users.view"))])
def list_roles(db: Session = Depends(get_db)):
    roles = db.query(Role).order_by(Role.is_locked.desc(), Role.name_en).all()
    return [_role_dict(r) for r in roles]

@router.post("/roles", status_code=201, dependencies=[Depends(require("admin.roles"))])
def create_role(data: RoleCreate, db: Session = Depends(get_db)):
    if db.query(Role).filter(Role.id == data.id).first():
        raise HTTPException(400, f"Role '{data.id}' already exists")
    role = Role(id=data.id, name_en=data.name_en, name_fr=data.name_fr,
                color=data.color, is_locked=False,
                permissions=_json.dumps(data.permissions))
    db.add(role)
    db.commit()
    db.refresh(role)
    return _role_dict(role)

@router.patch("/roles/{role_id}", dependencies=[Depends(require("admin.roles"))])
def update_role(role_id: str, data: RoleUpdate, db: Session = Depends(get_db)):
    role = get_or_404(db, Role, id=role_id)
    if role.is_locked:
        raise HTTPException(400, "Cannot modify a locked role")
    if data.name_en is not None:
        role.name_en = data.name_en
    if data.name_fr is not None:
        role.name_fr = data.name_fr
    if data.color is not None:
        role.color = data.color
    if data.permissions is not None:
        role.permissions = _json.dumps(data.permissions)
    db.commit()
    return _role_dict(role)

@router.delete("/roles/{role_id}", status_code=204, dependencies=[Depends(require("admin.roles"))])
def delete_role(role_id: str, db: Session = Depends(get_db)):
    role = get_or_404(db, Role, id=role_id)
    if role.is_locked:
        raise HTTPException(400, "Cannot delete a locked role")
    db.delete(role)
    db.commit()
