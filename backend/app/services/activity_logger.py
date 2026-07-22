"""
Auto-translating activity logger.
Every known action has bilingual EN/FR templates with placeholders.
Call log_activity(db, action, **context) anywhere in the app.
"""
from typing import Optional
from sqlalchemy.orm import Session

from ..models.config import ActivityLog

# ── Bilingual templates per action ───────────────────────────────────────────
# Placeholders: {room}, {res_no}, {guest}, {card}, {amount}, {currency}, {invoice}

TEMPLATES: dict[str, dict] = {
    # Reservations
    "reservation_created": {
        "icon": "📋", "color": "#3b5bdb",
        "en": "Reservation #{res_no} created for {guest}",
        "fr": "Réservation n°{res_no} créée pour {guest}",
    },
    "reservation_cancelled": {
        "icon": "❌", "color": "#dc2626",
        "en": "Reservation #{res_no} cancelled",
        "fr": "Réservation n°{res_no} annulée",
    },
    "guest_checked_in": {
        "icon": "📥", "color": "#3b5bdb",
        "en": "{guest} checked in — Room {room}",
        "fr": "{guest} a effectué son arrivée — Chambre {room}",
    },
    "guest_checked_out": {
        "icon": "📤", "color": "#d97706",
        "en": "{guest} checked out — Room {room}",
        "fr": "{guest} a effectué son départ — Chambre {room}",
    },
    # Key cards
    "keycard_issued": {
        "icon": "🔑", "color": "#7c3aed",
        "en": "Key card {card} issued for Room {room}",
        "fr": "Carte clé {card} émise pour la Chambre {room}",
    },
    "keycard_revoked": {
        "icon": "🔒", "color": "#dc2626",
        "en": "Key card {card} revoked (Room {room})",
        "fr": "Carte clé {card} révoquée (Chambre {room})",
    },
    "keycard_lost": {
        "icon": "🚨", "color": "#dc2626",
        "en": "Key card {card} reported lost",
        "fr": "Carte clé {card} déclarée perdue",
    },
    # Rooms
    "room_status_changed": {
        "icon": "🛏️", "color": "#0891b2",
        "en": "Room {room} status changed to {status}",
        "fr": "Statut de la Chambre {room} changé en {status}",
    },
    "room_cleaned": {
        "icon": "🧹", "color": "#059669",
        "en": "Room {room} marked as clean",
        "fr": "Chambre {room} marquée comme propre",
    },
    # Payments
    "payment_received": {
        "icon": "💳", "color": "#059669",
        "en": "Payment of {amount} {currency} received (Res. #{res_no})",
        "fr": "Paiement de {amount} {currency} reçu (Rés. n°{res_no})",
    },
    "invoice_paid": {
        "icon": "✅", "color": "#059669",
        "en": "Invoice {invoice} paid — {amount} {currency}",
        "fr": "Facture {invoice} réglée — {amount} {currency}",
    },
    "folio_charge_added": {
        "icon": "📝", "color": "#d97706",
        "en": "Charge posted to folio: {amount} FCFA ({particular})",
        "fr": "Frais posté au folio : {amount} FCFA ({particular})",
    },
    "folio_charge_voided": {
        "icon": "↩️", "color": "#6b7280",
        "en": "Folio charge #{ref} voided",
        "fr": "Frais n°{ref} du folio annulé",
    },
    # Night audit
    "night_audit_run": {
        "icon": "🌙", "color": "#7c3aed",
        "en": "Night audit completed — room charges posted for {count} reservation(s)",
        "fr": "Audit de nuit effectué — frais postés pour {count} réservation(s)",
    },
    # Guests
    "guest_created": {
        "icon": "👤", "color": "#3b5bdb",
        "en": "New guest profile created: {guest}",
        "fr": "Nouveau profil client créé : {guest}",
    },
    # Currencies
    "currency_rate_updated": {
        "icon": "💱", "color": "#0891b2",
        "en": "Exchange rate updated: 1 {currency} = {rate} XAF",
        "fr": "Taux de change mis à jour : 1 {currency} = {rate} XAF",
    },
    "currency_added": {
        "icon": "💱", "color": "#0891b2",
        "en": "New currency added: {currency}",
        "fr": "Nouvelle devise ajoutée : {currency}",
    },
    # Inventory / store
    "store_item_created": {
        "icon": "📦", "color": "#0891b2",
        "en": "Store item added: {name}",
        "fr": "Article de stock ajouté : {name}",
    },
    "requisition_created": {
        "icon": "📝", "color": "#3b5bdb",
        "en": "Requisition {req_number} created — {department}",
        "fr": "Réquisition {req_number} créée — {department}",
    },
    "requisition_approved": {
        "icon": "✅", "color": "#059669",
        "en": "Requisition {req_number} approved — stock deducted",
        "fr": "Réquisition {req_number} approuvée — stock déduit",
    },
    "requisition_rejected": {
        "icon": "❌", "color": "#dc2626",
        "en": "Requisition {req_number} rejected",
        "fr": "Réquisition {req_number} rejetée",
    },
}


def log_activity(
    db: Session,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    **context,
) -> Optional[ActivityLog]:
    """
    Log a bilingual activity entry.

    Example:
        log_activity(db, "guest_checked_in", entity_type="reservation", entity_id=42,
                     guest="John Smith", room="204")
    """
    tpl = TEMPLATES.get(action)
    if not tpl:
        return None

    def render(template: str) -> str:
        try:
            return template.format(**context)
        except KeyError:
            return template

    entry = ActivityLog(
        icon=tpl["icon"],
        color=tpl["color"],
        message_en=render(tpl["en"]),
        message_fr=render(tpl["fr"]),
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_actions() -> list[dict]:
    """Return all available action keys with their templates (for docs/admin)."""
    return [
        {
            "action": key,
            "icon": tpl["icon"],
            "en": tpl["en"],
            "fr": tpl["fr"],
        }
        for key, tpl in TEMPLATES.items()
    ]
