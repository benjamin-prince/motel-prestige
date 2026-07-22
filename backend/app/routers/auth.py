from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require
from ..models.user import User
from ..models.config import SystemSetting
from ..schemas.user import UserLogin, Token, UserResponse, UserCreate, UserUpdate
from ..services.auth_service import verify_password, create_access_token, hash_password

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/app-info")
def app_info(db: Session = Depends(get_db)) -> dict:
    """Public — returns the minimal brand info needed on the login page."""
    keys = ["hotel.name", "hotel.logo_url"]
    rows = db.query(SystemSetting).filter(SystemSetting.key.in_(keys)).all()
    data = {r.key: r.value for r in rows}
    return {
        "name":     data.get("hotel.name") or "Hotel PMS",
        "logo_url": data.get("hotel.logo_url") or "",
    }


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import json
    from ..models.config import Role

    resp = UserResponse.model_validate(current_user)
    role = db.query(Role).filter(Role.id == current_user.role).first()
    if role and role.permissions:
        resp.permissions = json.loads(role.permissions)
    elif current_user.role == "superadmin":
        resp.permissions = ["*"]
    return resp


@router.post("/me/change-password")
def change_own_password(data: dict, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    new_pw = data.get("password", "").strip()
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    current_user.password_hash = hash_password(new_pw)
    current_user.must_change_password = False
    db.commit()
    return {"ok": True}


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db),
                current_user: User = Depends(require("admin.users.manage"))):
    existing = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")
    fields = data.model_dump(exclude={"email", "password"})
    user = User(
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        **fields,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db),
               current_user: User = Depends(require("admin.users.view"))):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/users/basic")
def list_users_basic(db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    """Minimal staff directory (names only) for assignment dropdowns —
    available to any signed-in user, unlike the full /users listing."""
    users = db.query(User).filter(User.is_active == True).order_by(User.full_name).all()
    return [{"id": u.id, "full_name": u.full_name, "role": u.role} for u in users]


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(require("admin.users.manage"))):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "superadmin":
        active_admins = db.query(User).filter(User.role == "superadmin", User.is_active == True).count()
        if active_admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last superadmin")
    db.delete(user)
    db.commit()


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db),
                current_user: User = Depends(require("admin.users.manage"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent removing the last active superadmin
    if data.is_active is False and user.role == "superadmin":
        active_admins = db.query(User).filter(User.role == "superadmin", User.is_active == True).count()
        if active_admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot deactivate the last superadmin")
    if data.password:
        user.password_hash = hash_password(data.password)
        user.must_change_password = False
    for field, value in data.model_dump(exclude={"password"}, exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
