from sqlalchemy import Column, Integer, String, Numeric, Text, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class FnbOrder(Base):
    """A restaurant or bar order (POS ticket). Can be settled directly (cash /
    mobile money) or charged to a checked-in guest's room folio."""
    __tablename__ = "fnb_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(20), nullable=False, unique=True, index=True)
    outlet = Column(String(20), nullable=False, default="restaurant")  # restaurant | bar
    # Where it's served: a table label, or a room when charged to a stay
    table_label = Column(String(30))
    room_number = Column(String(10))
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)

    status = Column(String(20), nullable=False, default="open", index=True)
    # open | charged (posted to folio) | paid (settled directly) | cancelled
    payment_method = Column(String(30))  # set when settled directly
    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    notes = Column(Text)
    created_by = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    items = relationship("FnbOrderItem", back_populates="order",
                         cascade="all, delete-orphan", lazy="selectin")


class FnbOrderItem(Base):
    __tablename__ = "fnb_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("fnb_orders.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=True)
    name = Column(String(200), nullable=False)      # snapshot of the menu label
    unit_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    line_total = Column(Numeric(10, 2), nullable=False, default=0)

    order = relationship("FnbOrder", back_populates="items")
