from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class StoreItem(Base):
    __tablename__ = "store_items"

    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String(150), nullable=False)
    name_fr = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False, default="general")  # linen, toiletries, minibar, cleaning, office, food, general
    unit = Column(String(20), nullable=False, default="pcs")          # pcs, bottle, box, kg, L, roll…
    quantity = Column(Numeric(10, 2), nullable=False, default=0)
    reorder_level = Column(Numeric(10, 2), nullable=False, default=0)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    movements = relationship("StockMovement", back_populates="item")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False, index=True)
    change = Column(Numeric(10, 2), nullable=False)  # positive = stock in, negative = stock out
    reason = Column(String(30), nullable=False, default="adjustment")  # purchase, requisition, adjustment, damage, initial
    ref = Column(String(30))       # e.g. requisition number
    note = Column(Text)
    posted_by = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.now())

    item = relationship("StoreItem", back_populates="movements")


class StoreRequisition(Base):
    __tablename__ = "store_requisitions"

    id = Column(Integer, primary_key=True, index=True)
    req_number = Column(String(20), unique=True, nullable=False, index=True)
    department = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, approved, rejected
    note = Column(Text)
    requested_by = Column(String(100))
    decided_by = Column(String(100))
    decision_note = Column(Text)
    decided_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())

    items = relationship("StoreRequisitionItem", back_populates="requisition", cascade="all, delete-orphan")


class StoreRequisitionItem(Base):
    __tablename__ = "store_requisition_items"

    id = Column(Integer, primary_key=True, index=True)
    requisition_id = Column(Integer, ForeignKey("store_requisitions.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)

    requisition = relationship("StoreRequisition", back_populates="items")
    item = relationship("StoreItem")
