from sqlalchemy import Column, Integer, String, Numeric, Boolean, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String(200), nullable=False)
    name_fr = Column(String(200), nullable=False)
    main_category = Column(String(50))                 # "Food" or "Boissons"
    category = Column(String(50), nullable=False)      # level-2: "Alcool", "Non Alcool", "Local", "Breakfast"…
    subcategory = Column(String(50))                   # level-3: "Bière", "Whisky", "Cocktail"…
    price = Column(Numeric(10, 2), nullable=False)
    image_url = Column(Text)
    is_available = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class FolioParticular(Base):
    """Charge types that can be posted to a guest folio."""
    __tablename__ = "folio_particulars"

    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String(100), nullable=False)
    name_fr = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class LookupValue(Base):
    """
    Generic config key-value store for dropdown options.
    group: arrival_mode | payment_method | resev_type | bill_to | guest_type | room_type | menu_category | menu_subcategory
    parent_value_en: for subcategories, the parent's value_en (e.g. "Alcohol" → "Beer", "Wine", "Spirits")
    """
    __tablename__ = "lookup_values"

    id = Column(Integer, primary_key=True, index=True)
    group = Column(String(50), nullable=False, index=True)
    value_en = Column(String(100), nullable=False)
    value_fr = Column(String(100), nullable=False)
    parent_value_en = Column(String(100))   # for subcategories only
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    icon = Column(String(10), nullable=False, default="📋")
    color = Column(String(20), nullable=False, default="#3b5bdb")
    message_en = Column(Text, nullable=False)
    message_fr = Column(Text, nullable=False)
    entity_type = Column(String(50))   # reservation, keycard, room, payment
    entity_id = Column(Integer)
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)


class RoomTypeConfig(Base):
    """Default image URL and display name per room type."""
    __tablename__ = "room_type_configs"

    id = Column(Integer, primary_key=True, index=True)
    type_code = Column(String(50), unique=True, nullable=False, index=True)  # single, double, twin, suite, deluxe
    name_en = Column(String(100), nullable=False)
    name_fr = Column(String(100), nullable=False)
    default_image_url = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)


class SystemSetting(Base):
    """Flat key-value store for all configurable system/hotel settings."""
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)   # e.g. "hotel.name", "policy.check_in_time"
    value = Column(Text, nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class PermissionGroup(Base):
    """Module/section that groups related permissions (e.g. Front Office, Guests)."""
    __tablename__ = "permission_groups"

    key = Column(String(50), primary_key=True)
    label_en = Column(String(100), nullable=False)
    label_fr = Column(String(100), nullable=False)
    color = Column(String(20), nullable=False, default="#3b5bdb")
    icon = Column(String(10), nullable=False, default="📋")
    sort_order = Column(Integer, nullable=False, default=0)


class Permission(Base):
    """Individual permission entry belonging to a group."""
    __tablename__ = "permissions_catalog"

    key = Column(String(100), primary_key=True)
    label_en = Column(String(100), nullable=False)
    label_fr = Column(String(100), nullable=False)
    group_key = Column(String(50), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)


class Role(Base):
    """User role with a set of granted permissions stored as JSON."""
    __tablename__ = "roles"

    id = Column(String(50), primary_key=True)
    name_en = Column(String(100), nullable=False)
    name_fr = Column(String(100), nullable=False)
    color = Column(String(20), nullable=False, default="#3b5bdb")
    is_locked = Column(Boolean, nullable=False, default=False)
    permissions = Column(Text, nullable=True)  # JSON array of permission keys
    created_at = Column(TIMESTAMP, server_default=func.now())


class Property(Base):
    """A site managed by this PMS: hotel, motel, restaurant & bar, night club,
    spa, beauty salon… — or a lodging type combined with facilities."""
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False, default="hotel")  # any property_type lookup value
    address = Column(Text)
    city = Column(String(100))
    country = Column(String(100))
    phone = Column(String(50))
    email = Column(String(150))
    is_active = Column(Boolean, nullable=False, default=True)
    is_default = Column(Boolean, nullable=False, default=False)
    floor_min = Column(Integer, nullable=False, default=0)  # lowest floor (e.g. -1 for basement)
    floor_max = Column(Integer, nullable=False, default=0)  # highest floor (e.g. 4)
    floors = Column(Text, nullable=True)      # JSON array of {floor, label} — building layout
    facilities = Column(Text, nullable=True)  # JSON array of {code, floor} (legacy: array of codes)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
