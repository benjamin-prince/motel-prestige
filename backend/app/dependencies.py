from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models.user import User
from .services.auth_service import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"})
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_role(*roles: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker


def get_user_permissions(db: Session, user: User) -> set[str]:
    """Permission keys granted by the user's role (see the catalog in seeders.py)."""
    import json
    from .models.config import Role
    if user.role == "superadmin":
        return {"*"}
    role = db.query(Role).filter(Role.id == user.role).first()
    if role and role.permissions:
        return set(json.loads(role.permissions))
    return set()


def require(*keys: str):
    """Endpoint guard: the user's role must hold at least ONE of the given
    permission keys. Superadmin always passes."""
    def checker(current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)) -> User:
        perms = get_user_permissions(db, current_user)
        if "*" in perms or any(k in perms for k in keys):
            return current_user
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return checker
