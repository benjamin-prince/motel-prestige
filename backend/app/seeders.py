"""
Seed functions — called once on startup if the table is empty.
Edit these to change default data; they only run when the table has 0 rows.
"""
from decimal import Decimal
from sqlalchemy.orm import Session

from .models.config import MenuItem, FolioParticular, LookupValue, ActivityLog, RoomTypeConfig, SystemSetting, PermissionGroup, Permission, Role
from .models.currency import Currency


def seed_currencies(db: Session):
    if db.query(Currency).count():
        return
    defaults = [
        {"code": "XAF", "name": "Franc CFA BEAC",  "symbol": "FCFA", "xaf_rate": Decimal("1"),        "is_default": True},
        {"code": "USD", "name": "Dollar Américain", "symbol": "$",    "xaf_rate": Decimal("600"),       "is_default": False},
        {"code": "EUR", "name": "Euro",             "symbol": "€",    "xaf_rate": Decimal("655.957"),   "is_default": False},
        {"code": "CNY", "name": "Yuan Chinois",     "symbol": "¥",    "xaf_rate": Decimal("82"),        "is_default": False},
        {"code": "GBP", "name": "Livre Sterling",   "symbol": "£",    "xaf_rate": Decimal("765"),       "is_default": False},
    ]
    for d in defaults:
        db.add(Currency(**d))
    db.commit()


def seed_menu_items(db: Session):
    if db.query(MenuItem).count():
        return
    # main_category: "Food" or "Boissons"
    # category:      level-2 (Food subtypes or "Alcool"/"Non Alcool")
    # subcategory:   level-3 (Bière, Whisky, Cocktail… / Jus Naturels, Sodas…)
    items = [
        # ── FOOD ─────────────────────────────────────────────────────────────
        # Breakfast
        {"main_category": "Food", "name_en": "Full English Breakfast",  "name_fr": "Petit-déjeuner Anglais",  "category": "Breakfast", "price": Decimal("12000"), "image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80"},
        {"main_category": "Food", "name_en": "Croissant & Coffee",      "name_fr": "Croissant & Café",        "category": "Breakfast", "price": Decimal("3500"),  "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80"},
        # Lunch
        {"main_category": "Food", "name_en": "Caesar Salad",            "name_fr": "Salade César",            "category": "Lunch",     "price": Decimal("12.50"), "image_url": "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&q=80"},
        {"main_category": "Food", "name_en": "Club Sandwich",           "name_fr": "Club Sandwich",           "category": "Lunch",     "price": Decimal("14.00"), "image_url": "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=400&q=80"},
        {"main_category": "Food", "name_en": "Beef Burger",             "name_fr": "Burger au Bœuf",          "category": "Lunch",     "price": Decimal("16.00"), "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80"},
        {"main_category": "Food", "name_en": "Greek Salad",             "name_fr": "Salade Grecque",          "category": "Lunch",     "price": Decimal("11.00"), "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80"},
        # Dinner
        {"main_category": "Food", "name_en": "Grilled Salmon",          "name_fr": "Saumon Grillé",           "category": "Dinner",    "price": Decimal("24.00"), "image_url": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80"},
        {"main_category": "Food", "name_en": "Pasta Carbonara",         "name_fr": "Pâtes Carbonara",         "category": "Dinner",    "price": Decimal("19.00"), "image_url": "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=400&q=80"},
        {"main_category": "Food", "name_en": "Grilled Chicken",         "name_fr": "Poulet Grillé",           "category": "Dinner",    "price": Decimal("21.00"), "image_url": "https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=400&q=80"},
        # Local cuisine
        {"main_category": "Food", "name_en": "Ndolé",                   "name_fr": "Ndolé",                   "category": "Local",     "price": Decimal("15.00"), "image_url": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80"},
        {"main_category": "Food", "name_en": "Poulet DG",               "name_fr": "Poulet DG",               "category": "Local",     "price": Decimal("22.00"), "image_url": "https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=400&q=80"},
        {"main_category": "Food", "name_en": "Eru",                     "name_fr": "Eru",                     "category": "Local",     "price": Decimal("14.00"), "image_url": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80"},
        # International
        {"main_category": "Food", "name_en": "Sushi Platter",           "name_fr": "Plateau Sushis",          "category": "International", "price": Decimal("28.00"), "image_url": "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=400&q=80"},
        {"main_category": "Food", "name_en": "Couscous Royal",          "name_fr": "Couscous Royal",          "category": "International", "price": Decimal("20.00"), "image_url": "https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=400&q=80"},
        # Snacks
        {"main_category": "Food", "name_en": "Spring Rolls",            "name_fr": "Rouleaux de Printemps",   "category": "Snacks",    "price": Decimal("8.00"),  "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80"},
        {"main_category": "Food", "name_en": "Peanuts",                 "name_fr": "Cacahuètes",              "category": "Snacks",    "price": Decimal("3.00"),  "image_url": "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=400&q=80"},
        # Desserts
        {"main_category": "Food", "name_en": "Chocolate Lava Cake",     "name_fr": "Fondant au Chocolat",     "category": "Desserts",  "subcategory": "Gâteaux", "price": Decimal("9.00"),  "image_url": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80"},
        {"main_category": "Food", "name_en": "Cheesecake",              "name_fr": "Cheesecake",              "category": "Desserts",  "subcategory": "Gâteaux", "price": Decimal("8.50"),  "image_url": "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80"},
        {"main_category": "Food", "name_en": "Crème Brûlée",            "name_fr": "Crème Brûlée",            "category": "Desserts",  "subcategory": "Gâteaux", "price": Decimal("8.00"),  "image_url": "https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=400&q=80"},

        # ── BOISSONS — Alcool ─────────────────────────────────────────────
        # Bière
        {"main_category": "Boissons", "name_en": "Heineken Beer",       "name_fr": "Bière Heineken",     "category": "Alcool",     "subcategory": "Bière",    "price": Decimal("5.50"),  "image_url": "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "33 Export Beer",      "name_fr": "Bière 33 Export",    "category": "Alcool",     "subcategory": "Bière",    "price": Decimal("4.50"),  "image_url": "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Castel Beer",         "name_fr": "Bière Castel",       "category": "Alcool",     "subcategory": "Bière",    "price": Decimal("4.50"),  "image_url": "https://images.unsplash.com/photo-1566633806827-5afb96858b98?w=400&q=80"},
        # Whisky
        {"main_category": "Boissons", "name_en": "Whisky (glass)",      "name_fr": "Whisky (verre)",     "category": "Alcool",     "subcategory": "Whisky",   "price": Decimal("12.00"), "image_url": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Cognac (glass)",      "name_fr": "Cognac (verre)",     "category": "Alcool",     "subcategory": "Whisky",   "price": Decimal("14.00"), "image_url": "https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=400&q=80"},
        # Cocktail (alcool)
        {"main_category": "Boissons", "name_en": "Rum Punch",           "name_fr": "Punch au Rhum",      "category": "Alcool",     "subcategory": "Cocktail", "price": Decimal("10.00"), "image_url": "https://images.unsplash.com/photo-1560508179-b2c9a3f8e92b?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Mojito",              "name_fr": "Mojito",             "category": "Alcool",     "subcategory": "Cocktail", "price": Decimal("11.00"), "image_url": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&q=80"},
        # Vin
        {"main_category": "Boissons", "name_en": "Red Wine (glass)",    "name_fr": "Vin Rouge (verre)",  "category": "Alcool",     "subcategory": "Vin",      "price": Decimal("9.00"),  "image_url": "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "White Wine (glass)",  "name_fr": "Vin Blanc (verre)",  "category": "Alcool",     "subcategory": "Vin",      "price": Decimal("9.00"),  "image_url": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80"},
        # Champagne
        {"main_category": "Boissons", "name_en": "Champagne (glass)",   "name_fr": "Champagne (verre)",  "category": "Alcool",     "subcategory": "Champagne","price": Decimal("18.00"), "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"},

        # ── BOISSONS — Non Alcool ─────────────────────────────────────────
        # Jus Naturels
        {"main_category": "Boissons", "name_en": "Fresh Orange Juice",  "name_fr": "Jus d'Orange Frais",    "category": "Non Alcool", "subcategory": "Jus Naturels", "price": Decimal("6.50"),  "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Pineapple Juice",     "name_fr": "Jus d'Ananas",           "category": "Non Alcool", "subcategory": "Jus Naturels", "price": Decimal("6.50"),  "image_url": "https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Mango Juice",         "name_fr": "Jus de Mangue",          "category": "Non Alcool", "subcategory": "Jus Naturels", "price": Decimal("6.50"),  "image_url": "https://images.unsplash.com/photo-1546173159-315724a31696?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Passion Fruit Juice", "name_fr": "Jus de Passion",         "category": "Non Alcool", "subcategory": "Jus Naturels", "price": Decimal("7.00"),  "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"},
        # Café
        {"main_category": "Boissons", "name_en": "Cappuccino",          "name_fr": "Cappuccino",             "category": "Non Alcool", "subcategory": "Café",         "price": Decimal("5.00"),  "image_url": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Espresso",            "name_fr": "Expresso",               "category": "Non Alcool", "subcategory": "Café",         "price": Decimal("3.50"),  "image_url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80"},
        # Sodas
        {"main_category": "Boissons", "name_en": "Coca-Cola",           "name_fr": "Coca-Cola",              "category": "Non Alcool", "subcategory": "Sodas",        "price": Decimal("3.00"),  "image_url": "https://images.unsplash.com/photo-1629203851122-3726b5b08e61?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Fanta",               "name_fr": "Fanta",                  "category": "Non Alcool", "subcategory": "Sodas",        "price": Decimal("3.00"),  "image_url": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80"},
        # Eau
        {"main_category": "Boissons", "name_en": "Mineral Water",       "name_fr": "Eau Minérale",           "category": "Non Alcool", "subcategory": "Eau",          "price": Decimal("2.50"),  "image_url": "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80"},
        # Mocktail
        {"main_category": "Boissons", "name_en": "Virgin Mojito",       "name_fr": "Mojito sans Alcool",     "category": "Non Alcool", "subcategory": "Mocktail",     "price": Decimal("7.00"),  "image_url": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80"},
        {"main_category": "Boissons", "name_en": "Tropical Mocktail",   "name_fr": "Cocktail Tropical",      "category": "Non Alcool", "subcategory": "Mocktail",     "price": Decimal("8.00"),  "image_url": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80"},
    ]
    for item in items:
        db.add(MenuItem(**item))
    db.commit()


def seed_folio_particulars(db: Session):
    if db.query(FolioParticular).count():
        return
    particulars = [
        ("Room Rent",   "Chambre"),
        ("Gym",         "Salle de Sport"),
        ("Min Bar",     "Mini Bar"),
        ("Restaurant",  "Restaurant"),
        ("Laundry",     "Blanchisserie"),
        ("Spa",         "Spa"),
        ("Parking",     "Parking"),
        ("Phone",       "Téléphone"),
        ("Extra Bed",   "Lit Supplémentaire"),
        ("Transfer",    "Transfert"),
    ]
    for en, fr in particulars:
        db.add(FolioParticular(name_en=en, name_fr=fr))
    db.commit()


def seed_lookup_values(db: Session):
    if db.query(LookupValue).count():
        return
    values = [
        # menu_category
        ("menu_category", "All",          "Tous",                  0),
        ("menu_category", "Breakfast",    "Petit-déjeuner",        1),
        ("menu_category", "Lunch",        "Déjeuner",              2),
        ("menu_category", "Dinner",       "Dîner",                 3),
        ("menu_category", "Natural Juice","Jus Naturels",          4),
        ("menu_category", "Beverages",    "Boissons",              5),
        ("menu_category", "Alcohol",      "Alcool",                6),
        ("menu_category", "Desserts",     "Desserts",              7),
        ("menu_category", "Snacks",       "En-cas",                8),
        # menu_subcategory (parent_value_en set separately below)

        # arrival_mode
        ("arrival_mode", "By Air",   "Par Avion",    0),
        ("arrival_mode", "By Road",  "Par Route",    1),
        ("arrival_mode", "By Sea",   "Par Mer",      2),
        # payment_method
        ("payment_method", "Cash",           "Espèces",          0),
        ("payment_method", "Credit Card",    "Carte de Crédit",  1),
        ("payment_method", "Bank Transfer",  "Virement",         2),
        ("payment_method", "Cheque",         "Chèque",           3),
        # resev_type
        ("resev_type", "Confirm Reservation", "Réservation Confirmée", 0),
        ("resev_type", "Tentative",           "Tentative",             1),
        ("resev_type", "Waitlisted",          "Liste d'Attente",       2),
        # bill_to
        ("bill_to", "Guest",   "Client",  0),
        ("bill_to", "Company", "Société", 1),
        ("bill_to", "Agent",   "Agent",   2),
        # guest_type
        ("guest_type", "FIT",       "FIT",         0),
        ("guest_type", "GROUP",     "Groupe",      1),
        ("guest_type", "CORPORATE", "Entreprise",  2),
        ("guest_type", "WALK_IN",   "Sans Réserv.", 3),
        # guest_category
        ("guest_category", "VIP",       "VIP",       0),
        ("guest_category", "Regular",   "Régulier",  1),
        ("guest_category", "Corporate", "Entreprise",2),
        # gender
        ("gender", "Male",   "Masculin",  0),
        ("gender", "Female", "Féminin",   1),
        # id_type
        ("id_type", "Passport",       "Passeport",         0),
        ("id_type", "National ID",    "Carte Nationale",   1),
        ("id_type", "Driver License", "Permis de Conduire",2),
        # title
        ("title", "Mr.",  "M.",   0),
        ("title", "Mrs.", "Mme.", 1),
        ("title", "Ms.",  "Mlle.",2),
        ("title", "Dr.",  "Dr.",  3),
        # room_type
        ("room_type", "single", "Chambre Simple",  0),
        ("room_type", "double", "Chambre Double",  1),
        ("room_type", "twin",   "Chambre Twin",    2),
        ("room_type", "suite",  "Suite",           3),
        ("room_type", "deluxe", "Chambre Deluxe",  4),
        # room_status
        ("room_status", "available",   "Disponible",   0),
        ("room_status", "occupied",    "Occupée",      1),
        ("room_status", "cleaning",    "Nettoyage",    2),
        ("room_status", "maintenance", "Maintenance",  3),
        # card_type
        ("card_type", "guest",       "Client",        0),
        ("card_type", "master",      "Maître",        1),
        ("card_type", "staff",       "Personnel",     2),
        ("card_type", "maintenance", "Maintenance",   3),
        # department
        ("department", "HK",       "Gouvernance",     0),
        ("department", "FO",       "Bureau Principal",1),
        ("department", "F&B",      "Restauration",    2),
        ("department", "Security", "Sécurité",        3),
        ("department", "Admin",    "Administration",  4),
        # property_type
        ("property_type", "hotel",      "Hôtel",       0),
        ("property_type", "motel",      "Motel",       1),
        ("property_type", "hostel",     "Auberge",     2),
        ("property_type", "resort",     "Resort",      3),
        ("property_type", "inn",        "Pension",     4),
        ("property_type", "guesthouse", "Gîte",        5),
        ("property_type", "apartment",  "Appartement", 6),
        # facility
        ("facility", "restaurant",   "Restaurant",      0),
        ("facility", "bar",          "Bar",             1),
        ("facility", "pool",         "Piscine",         2),
        ("facility", "spa",          "Spa",             3),
        ("facility", "gym",          "Salle de sport",  4),
        ("facility", "elevator",     "Ascenseur",       5),
        ("facility", "parking",      "Parking",         6),
        ("facility", "wifi",         "Wi-Fi",           7),
        ("facility", "conference",   "Salle de conf.",  8),
        ("facility", "laundry",      "Blanchisserie",   9),
        ("facility", "room_service", "Room Service",   10),
        ("facility", "airport_shuttle", "Navette aéro.",11),
        ("facility", "garden",       "Jardin",         12),
        ("facility", "terrace",      "Terrasse",       13),
    ]
    for group, en, fr, order in values:
        db.add(LookupValue(group=group, value_en=en, value_fr=fr, sort_order=order))
    db.commit()


def seed_menu_subcategories(db: Session):
    """Seed the full 3-level menu category hierarchy."""
    if db.query(LookupValue).filter(LookupValue.group == "menu_main_category").count():
        return

    # ── Level 1: Main categories ──────────────────────────────────────────
    main_cats = [
        ("Food",      "Nourriture", 0),
        ("Boissons",  "Boissons",   1),
    ]
    for en, fr, order in main_cats:
        db.add(LookupValue(group="menu_main_category", value_en=en, value_fr=fr, sort_order=order))

    # ── Level 2: Categories (child of main) ───────────────────────────────
    level2 = [
        # Under Food
        ("Food", "Local",          "Cuisine Locale",  0),
        ("Food", "International",  "International",   1),
        ("Food", "Breakfast",      "Petit-déjeuner",  2),
        ("Food", "Lunch",          "Déjeuner",        3),
        ("Food", "Dinner",         "Dîner",           4),
        ("Food", "Snacks",         "En-cas",          5),
        ("Food", "Desserts",       "Desserts",        6),
        # Under Boissons
        ("Boissons", "Alcool",     "Alcool",          0),
        ("Boissons", "Non Alcool", "Sans Alcool",     1),
    ]
    for parent, en, fr, order in level2:
        db.add(LookupValue(group="menu_category", value_en=en, value_fr=fr,
                           parent_value_en=parent, sort_order=order))

    # ── Level 3: Subcategories (child of level-2) ─────────────────────────
    level3 = [
        # Under Alcool
        ("Alcool", "Bière",      "Bière",           0),
        ("Alcool", "Whisky",     "Whisky",          1),
        ("Alcool", "Cocktail",   "Cocktail",        2),
        ("Alcool", "Vin",        "Vin",             3),
        ("Alcool", "Champagne",  "Champagne",       4),
        ("Alcool", "Rhum",       "Rhum",            5),
        ("Alcool", "Vodka",      "Vodka",           6),
        ("Alcool", "Gin",        "Gin",             7),
        # Under Non Alcool
        ("Non Alcool", "Jus Naturels",  "Jus Naturels",        0),
        ("Non Alcool", "Sodas",         "Sodas",               1),
        ("Non Alcool", "Eau",           "Eau",                 2),
        ("Non Alcool", "Café",          "Café",                3),
        ("Non Alcool", "Thé",           "Thé",                 4),
        ("Non Alcool", "Mocktail",      "Mocktail sans alcool",5),
        ("Non Alcool", "Lait",          "Lait",                6),
        # Under Desserts (Food)
        ("Desserts", "Gâteaux",  "Gâteaux",   0),
        ("Desserts", "Glaces",   "Glaces",    1),
        ("Desserts", "Fruits",   "Fruits",    2),
    ]
    for parent, en, fr, order in level3:
        db.add(LookupValue(group="menu_subcategory", value_en=en, value_fr=fr,
                           parent_value_en=parent, sort_order=order))

    db.commit()


def seed_room_type_configs(db: Session):
    if db.query(RoomTypeConfig).count():
        return
    configs = [
        ("single", "Single Room",  "Chambre Simple", "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=80"),
        ("double", "Double Room",  "Chambre Double", "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400&q=80"),
        ("twin",   "Twin Room",    "Chambre Twin",   "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=400&q=80"),
        ("suite",  "Suite",        "Suite",          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=80"),
        ("deluxe", "Deluxe Room",  "Chambre Deluxe", "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400&q=80"),
    ]
    for code, en, fr, img in configs:
        db.add(RoomTypeConfig(type_code=code, name_en=en, name_fr=fr, default_image_url=img))
    db.commit()


def seed_activity_log(db: Session):
    if db.query(ActivityLog).count():
        return
    entries = [
        {"icon": "📥", "color": "#3b5bdb", "message_en": "John Smith checked in — Room 204",     "message_fr": "John Smith a effectué son arrivée — Chambre 204",          "entity_type": "reservation"},
        {"icon": "🔑", "color": "#7c3aed", "message_en": "Key card issued for Room 204",          "message_fr": "Carte clé émise pour la Chambre 204",                       "entity_type": "keycard"},
        {"icon": "🧹", "color": "#059669", "message_en": "Room 108 marked as clean",              "message_fr": "Chambre 108 marquée comme propre",                          "entity_type": "room"},
        {"icon": "📤", "color": "#d97706", "message_en": "Sarah Johnson checked out — Room 312",  "message_fr": "Sarah Johnson a effectué son départ — Chambre 312",         "entity_type": "reservation"},
        {"icon": "📋", "color": "#3b5bdb", "message_en": "New reservation #8821934 created",      "message_fr": "Nouvelle réservation n°8821934 créée",                      "entity_type": "reservation"},
        {"icon": "💳", "color": "#059669", "message_en": "Invoice INV00012345 paid — 120 000 FCFA","message_fr": "Facture INV00012345 réglée — 120 000 FCFA",                "entity_type": "payment"},
    ]
    for e in entries:
        db.add(ActivityLog(**e))
    db.commit()


def seed_system_settings(db: Session):
    # Upsert approach: insert only keys that don't exist yet
    # so new keys added here are picked up on restart
    existing = {s.key for s in db.query(SystemSetting.key).all()}

    def _set(key: str, value: str):
        if key not in existing:
            db.add(SystemSetting(key=key, value=value))

    defaults = {
        # ── Hotel Profile ────────────────────────────────────────────────────
        "hotel.name":              "Motel Prestige",
        "hotel.legal_name":        "",
        "hotel.address_line1":     "",
        "hotel.address_line2":     "",
        "hotel.city":              "",
        "hotel.state":             "",
        "hotel.country":           "Cameroon",
        "hotel.zip":               "",
        "hotel.phone":             "",
        "hotel.email":             "",
        "hotel.website":           "",
        "hotel.star_rating":       "3",
        "hotel.logo_url":          "",
        "hotel.timezone":          "Africa/Douala",
        "hotel.currency":          "XAF",
        "hotel.vat_number":        "",
        "hotel.registration_no":   "",
        # ── Policies ─────────────────────────────────────────────────────────
        "policy.check_in_time":          "14:00",
        "policy.check_out_time":         "12:00",
        "policy.late_checkout_fee":      "0",
        "policy.early_checkin_fee":      "0",
        "policy.cancellation_hours":     "24",
        "policy.no_show_charge_pct":     "100",
        "policy.max_stay_days":          "30",
        "policy.min_advance_booking":    "0",
        "policy.allow_overbooking":      "false",
        # ── Billing & Finance ─────────────────────────────────────────────────
        "billing.tax_rate":              "19.25",
        "billing.service_charge":        "10",
        "billing.city_tax_per_person":   "0",
        "billing.invoice_prefix":        "INV-",
        "billing.invoice_start_number":  "1000",
        "billing.invoice_footer":        "",
        "billing.receipt_header":        "",
        "billing.show_tax_breakdown":    "true",
        # ── Housekeeping ──────────────────────────────────────────────────────
        "housekeeping.post_checkout_status":         "dirty",
        "housekeeping.checkout_grace_minutes":        "30",
        "housekeeping.auto_assign_rooms":             "false",
        "housekeeping.inspection_required":           "true",
        "housekeeping.default_task_type":             "cleaning",
        "housekeeping.default_priority":              "normal",
        "housekeeping.deep_clean_interval_days":      "14",
        "housekeeping.allow_skip_inspection":         "false",
        "housekeeping.notify_supervisor_on_complete": "false",
        "housekeeping.turndown_service_enabled":      "false",
        "housekeeping.turndown_start_time":           "18:00",
        "housekeeping.turndown_end_time":             "20:00",
        # ── Maintenance ───────────────────────────────────────────────────────
        "maintenance.sla_low_hours":             "72",
        "maintenance.sla_medium_hours":          "24",
        "maintenance.sla_high_hours":            "4",
        "maintenance.sla_urgent_hours":          "1",
        "maintenance.default_category":          "general",
        "maintenance.default_priority":          "medium",
        "maintenance.default_assignee":          "",
        "maintenance.notify_on_open":            "false",
        "maintenance.notify_assignee_on_assign": "false",
        "maintenance.notify_on_overdue":         "false",
        "maintenance.escalation_enabled":        "false",
        "maintenance.require_resolution_notes":  "false",
        "maintenance.allow_self_assign":         "true",
        # ── F&B ───────────────────────────────────────────────────────────────
        "fnb.tax_rate":                  "0",
        "fnb.service_charge":            "0",
        "fnb.order_prefix":              "ORD-",
        "fnb.prep_time_minutes":         "15",
        "fnb.auto_confirm_orders":       "false",
        "fnb.table_service":             "true",
        "fnb.takeaway":                  "true",
        "fnb.delivery":                  "false",
        "fnb.receipt_auto_print":        "false",
        # ── Sales ─────────────────────────────────────────────────────────────
        "sales.default_commission_pct":       "10",
        "sales.agent_payment_terms_days":     "30",
        "sales.package_min_nights":           "1",
        "sales.quote_validity_days":          "7",
        "sales.allow_package_overbooking":    "false",
        "sales.deposit_required":             "false",
        "sales.deposit_pct":                  "30",
        # ── HRM ───────────────────────────────────────────────────────────────
        "hrm.work_hours_per_day":         "8",
        "hrm.work_days_per_week":         "5",
        "hrm.default_shift_start":        "08:00",
        "hrm.default_shift_end":          "16:00",
        "hrm.overtime_threshold_hours":   "8",
        "hrm.overtime_rate_multiplier":   "1.5",
        "hrm.payroll_cycle":              "monthly",
        "hrm.leave_advance_days":         "7",
        # ── Reservations ──────────────────────────────────────────────────────
        "reservations.require_id_at_checkin":   "true",
        "reservations.confirm_on_create":        "true",
        "reservations.collect_deposit":          "false",
        "reservations.deposit_pct":              "30",
        "reservations.guest_receipt_print":      "false",
        "reservations.default_source":           "direct",
        "reservations.allow_walkin":             "true",
        "reservations.max_advance_days":         "365",
        # ── Key Cards ─────────────────────────────────────────────────────────
        "keycards.provider":      "simulated",
        "keycards.bridge_url":    "http://localhost:8765",
        "keycards.api_key":       "",
        "keycards.building":      "01",
        "keycards.door_prefix":   "ROOM-",
        # ── Notifications ─────────────────────────────────────────────────────
        "notifications.email_from_name":    "Motel Prestige",
        "notifications.email_from_address": "",
        "notifications.smtp_host":          "",
        "notifications.smtp_port":          "587",
        "notifications.smtp_user":          "",
        "notifications.smtp_pass":          "",
        "notifications.smtp_tls":           "true",
        "notifications.checkin_email":      "false",
        "notifications.checkout_email":     "false",
        "notifications.reservation_email":  "false",
    }
    for key, value in defaults.items():
        _set(key, value)
    db.commit()


def seed_super_admin(db: Session):
    import os
    from .models.user import User
    from .services.auth_service import hash_password
    if db.query(User).count():
        return
    email = os.getenv("ADMIN_EMAIL", "admin@motel-prestige.com")
    password = os.getenv("ADMIN_PASSWORD", "Admin@1234")
    full_name = os.getenv("ADMIN_NAME", "Super Admin")
    db.add(User(email=email, full_name=full_name, password_hash=hash_password(password),
                role="superadmin", is_active=True))
    db.commit()
    print(f"[seed] Super admin created: {email}")


def seed_properties(db: Session):
    from .models.config import Property, SystemSetting
    if db.query(Property).first():
        return
    settings = {r.key: r.value for r in db.query(SystemSetting).all()}
    db.add(Property(
        name=settings.get("hotel.name", "Motel Prestige"),
        type="motel",
        address=settings.get("hotel.address_line1", ""),
        city=settings.get("hotel.city", ""),
        country=settings.get("hotel.country", "Cameroon"),
        phone=settings.get("hotel.phone", ""),
        email=settings.get("hotel.email", ""),
        is_active=True,
        is_default=True,
    ))
    db.commit()
    print("[seed] Default property seeded")


def seed_roles(db: Session):
    if db.query(PermissionGroup).first():
        return

    groups = [
        {"key": "fo",    "label_en": "Front Office",     "label_fr": "Bureau Principal",  "color": "#3b5bdb", "icon": "🖥️",  "sort_order": 1},
        {"key": "guests","label_en": "Guests",            "label_fr": "Clients",            "color": "#7c3aed", "icon": "👥",  "sort_order": 2},
        {"key": "kc",    "label_en": "Key Cards",         "label_fr": "Cartes Clés",        "color": "#0891b2", "icon": "🔑",  "sort_order": 3},
        {"key": "fnb",   "label_en": "Food & Beverage",   "label_fr": "Restauration",       "color": "#d97706", "icon": "🍽️", "sort_order": 4},
        {"key": "hk",    "label_en": "Housekeeping",      "label_fr": "Gouvernance",        "color": "#059669", "icon": "🧹",  "sort_order": 5},
        {"key": "maint", "label_en": "Maintenance",       "label_fr": "Maintenance",        "color": "#ea580c", "icon": "🔧",  "sort_order": 6},
        {"key": "sales", "label_en": "Sales",             "label_fr": "Ventes",             "color": "#e11d48", "icon": "📊",  "sort_order": 7},
        {"key": "hrm",   "label_en": "HRM",               "label_fr": "Ressources Humaines","color": "#0284c7", "icon": "👤",  "sort_order": 7},
        {"key": "acc",   "label_en": "Accounts",          "label_fr": "Comptabilité",       "color": "#7c3aed", "icon": "💳",  "sort_order": 8},
        {"key": "admin", "label_en": "Admin & Security",  "label_fr": "Admin & Sécurité",   "color": "#dc2626", "icon": "🔐",  "sort_order": 9},
    ]
    for g in groups:
        db.add(PermissionGroup(**g))

    perms = [
        # Front Office (21)
        {"key": "fo.dashboard",       "label_en": "Dashboard",              "label_fr": "Tableau de Bord",       "group_key": "fo",    "sort_order": 1},
        {"key": "fo.rooms.view",      "label_en": "View Rooms",             "label_fr": "Voir les Chambres",     "group_key": "fo",    "sort_order": 2},
        {"key": "fo.rooms.create",    "label_en": "Add Room",               "label_fr": "Ajouter une Chambre",   "group_key": "fo",    "sort_order": 3},
        {"key": "fo.rooms.edit",      "label_en": "Edit Room",              "label_fr": "Modifier une Chambre",  "group_key": "fo",    "sort_order": 4},
        {"key": "fo.rooms.status",    "label_en": "Room Status Board",      "label_fr": "Tableau des Statuts",   "group_key": "fo",    "sort_order": 5},
        {"key": "fo.configuration",   "label_en": "Configuration",          "label_fr": "Configuration",         "group_key": "fo",    "sort_order": 6},
        {"key": "fo.res.view",        "label_en": "View Reservations",      "label_fr": "Voir les Réservations", "group_key": "fo",    "sort_order": 7},
        {"key": "fo.res.create",      "label_en": "Create Reservation",     "label_fr": "Créer une Réservation", "group_key": "fo",    "sort_order": 8},
        {"key": "fo.res.edit",        "label_en": "Edit Reservation",       "label_fr": "Modifier Réservation",  "group_key": "fo",    "sort_order": 9},
        {"key": "fo.res.delete",      "label_en": "Delete Reservation",     "label_fr": "Supprimer Réservation", "group_key": "fo",    "sort_order": 10},
        {"key": "fo.checkin",         "label_en": "Check In",               "label_fr": "Enregistrement",        "group_key": "fo",    "sort_order": 11},
        {"key": "fo.checkout",        "label_en": "Check Out",              "label_fr": "Départ",                "group_key": "fo",    "sort_order": 12},
        {"key": "fo.folio.view",      "label_en": "View Folio",             "label_fr": "Voir le Folio",         "group_key": "fo",    "sort_order": 13},
        {"key": "fo.folio.charge",    "label_en": "Post Folio Charge",      "label_fr": "Ajouter une Charge",    "group_key": "fo",    "sort_order": 14},
        {"key": "fo.folio.void",      "label_en": "Void Folio Charge",      "label_fr": "Annuler une Charge",    "group_key": "fo",    "sort_order": 15},
        {"key": "fo.folio.settle",    "label_en": "Settle Folio",           "label_fr": "Clôturer le Folio",     "group_key": "fo",    "sort_order": 16},
        {"key": "fo.unsettled",       "label_en": "Unsettled Accounts",     "label_fr": "Comptes Non Soldés",    "group_key": "fo",    "sort_order": 17},
        {"key": "fo.nightly_charges", "label_en": "Post Nightly Charges",   "label_fr": "Facturation Nuitée",    "group_key": "fo",    "sort_order": 18},
        {"key": "fo.night_audit",     "label_en": "Night Audit",            "label_fr": "Audit de Nuit",         "group_key": "fo",    "sort_order": 19},
        {"key": "fo.reference",       "label_en": "Reference Data",         "label_fr": "Données de Référence",  "group_key": "fo",    "sort_order": 20},
        {"key": "fo.report",          "label_en": "Front Office Reports",   "label_fr": "Rapports Front Office", "group_key": "fo",    "sort_order": 21},
        # Guests (4)
        {"key": "guests.view",        "label_en": "View Guests",            "label_fr": "Voir les Clients",      "group_key": "guests","sort_order": 1},
        {"key": "guests.create",      "label_en": "Create Guest",           "label_fr": "Créer un Client",       "group_key": "guests","sort_order": 2},
        {"key": "guests.edit",        "label_en": "Edit Guest",             "label_fr": "Modifier un Client",    "group_key": "guests","sort_order": 3},
        {"key": "guests.delete",      "label_en": "Delete Guest",           "label_fr": "Supprimer un Client",   "group_key": "guests","sort_order": 4},
        # Key Cards (7)
        {"key": "kc.view",            "label_en": "View Key Cards",         "label_fr": "Voir les Cartes",       "group_key": "kc",    "sort_order": 1},
        {"key": "kc.issue",           "label_en": "Issue Card",             "label_fr": "Émettre une Carte",     "group_key": "kc",    "sort_order": 2},
        {"key": "kc.issue.new_booking","label_en": "Issue Card — New Booking","label_fr": "Carte — Nouvelle Résa","group_key": "kc",   "sort_order": 3},
        {"key": "kc.revoke",          "label_en": "Revoke Card",            "label_fr": "Révoquer une Carte",    "group_key": "kc",    "sort_order": 4},
        {"key": "kc.report_lost",     "label_en": "Report Card Lost",       "label_fr": "Déclarer Perte",        "group_key": "kc",    "sort_order": 5},
        {"key": "kc.test_access",     "label_en": "Test / Simulate Access", "label_fr": "Tester l'Accès",        "group_key": "kc",    "sort_order": 6},
        {"key": "kc.access_logs",     "label_en": "View Access Logs",       "label_fr": "Journaux d'Accès",      "group_key": "kc",    "sort_order": 7},
        # Food & Beverage (7)
        {"key": "fnb.menu.view",      "label_en": "View Menu",              "label_fr": "Voir le Menu",          "group_key": "fnb",   "sort_order": 1},
        {"key": "fnb.menu.create",    "label_en": "Add Menu Item",          "label_fr": "Ajouter un Article",    "group_key": "fnb",   "sort_order": 2},
        {"key": "fnb.menu.edit",      "label_en": "Edit Menu Item",         "label_fr": "Modifier un Article",   "group_key": "fnb",   "sort_order": 3},
        {"key": "fnb.menu.toggle",    "label_en": "Toggle Availability",    "label_fr": "Activer/Désactiver",    "group_key": "fnb",   "sort_order": 4},
        {"key": "fnb.orders.view",    "label_en": "View Orders",            "label_fr": "Voir les Commandes",    "group_key": "fnb",   "sort_order": 5},
        {"key": "fnb.orders.manage",  "label_en": "Manage Orders",          "label_fr": "Gérer les Commandes",   "group_key": "fnb",   "sort_order": 6},
        {"key": "fnb.outlets",        "label_en": "Manage Outlets",         "label_fr": "Gérer les Outlets",     "group_key": "fnb",   "sort_order": 7},
        # Housekeeping (6)
        {"key": "hk.assignment",      "label_en": "Room Assignment",        "label_fr": "Affectation Chambres",  "group_key": "hk",    "sort_order": 1},
        {"key": "hk.tasks.view",      "label_en": "View Task List",         "label_fr": "Voir les Tâches",       "group_key": "hk",    "sort_order": 2},
        {"key": "hk.tasks.assign",    "label_en": "Assign Tasks",           "label_fr": "Assigner des Tâches",   "group_key": "hk",    "sort_order": 3},
        {"key": "hk.tasks.complete",  "label_en": "Mark Tasks Complete",    "label_fr": "Marquer Complété",      "group_key": "hk",    "sort_order": 4},
        {"key": "hk.room_status",     "label_en": "Update Room Status",     "label_fr": "Modifier le Statut",    "group_key": "hk",    "sort_order": 5},
        {"key": "hk.lost_found",      "label_en": "Lost & Found",           "label_fr": "Objets Trouvés",        "group_key": "hk",    "sort_order": 6},
        # Sales (5)
        {"key": "sales.packages.view",  "label_en": "View Packages",        "label_fr": "Voir les Forfaits",     "group_key": "sales", "sort_order": 1},
        {"key": "sales.packages.manage","label_en": "Manage Packages",      "label_fr": "Gérer les Forfaits",    "group_key": "sales", "sort_order": 2},
        {"key": "sales.agents.view",    "label_en": "View Agents",          "label_fr": "Voir les Agents",       "group_key": "sales", "sort_order": 3},
        {"key": "sales.agents.manage",  "label_en": "Manage Agents",        "label_fr": "Gérer les Agents",      "group_key": "sales", "sort_order": 4},
        {"key": "sales.reports",        "label_en": "Sales Reports",        "label_fr": "Rapports de Ventes",    "group_key": "sales", "sort_order": 5},
        # HRM (4)
        {"key": "hrm.staff.view",     "label_en": "View Staff",             "label_fr": "Voir le Personnel",     "group_key": "hrm",   "sort_order": 1},
        {"key": "hrm.staff.manage",   "label_en": "Manage Staff",           "label_fr": "Gérer le Personnel",    "group_key": "hrm",   "sort_order": 2},
        {"key": "hrm.schedules",      "label_en": "Manage Schedules",       "label_fr": "Gérer les Horaires",    "group_key": "hrm",   "sort_order": 3},
        {"key": "hrm.payroll",        "label_en": "Manage Payroll",         "label_fr": "Gérer la Paie",         "group_key": "hrm",   "sort_order": 4},
        # Accounts (7)
        {"key": "acc.invoices.view",  "label_en": "View Invoices",          "label_fr": "Voir les Factures",     "group_key": "acc",   "sort_order": 1},
        {"key": "acc.invoices.manage","label_en": "Manage Invoices",        "label_fr": "Gérer les Factures",    "group_key": "acc",   "sort_order": 2},
        {"key": "acc.payments.view",  "label_en": "View Payments",          "label_fr": "Voir les Paiements",    "group_key": "acc",   "sort_order": 3},
        {"key": "acc.payments.create","label_en": "Record Payment",         "label_fr": "Enregistrer un Paiement","group_key":"acc",   "sort_order": 4},
        {"key": "acc.currencies",     "label_en": "Manage Currencies",      "label_fr": "Gérer les Devises",     "group_key": "acc",   "sort_order": 5},
        {"key": "acc.caisse",         "label_en": "Cash Register (Caisse)", "label_fr": "Caisse",                "group_key": "acc",   "sort_order": 6},
        {"key": "acc.ledger",         "label_en": "Ledger",                 "label_fr": "Grand Livre",           "group_key": "acc",   "sort_order": 7},
        # Maintenance (6)
        {"key": "maint.view",         "label_en": "View Work Orders",       "label_fr": "Voir les Ordres",       "group_key": "maint", "sort_order": 1},
        {"key": "maint.create",       "label_en": "Create Work Order",      "label_fr": "Créer un Ordre",        "group_key": "maint", "sort_order": 2},
        {"key": "maint.edit",         "label_en": "Edit Work Order",        "label_fr": "Modifier un Ordre",     "group_key": "maint", "sort_order": 3},
        {"key": "maint.assign",       "label_en": "Assign Work Order",      "label_fr": "Assigner un Ordre",     "group_key": "maint", "sort_order": 4},
        {"key": "maint.close",        "label_en": "Close / Complete Order", "label_fr": "Clôturer un Ordre",     "group_key": "maint", "sort_order": 5},
        {"key": "maint.delete",       "label_en": "Delete Work Order",      "label_fr": "Supprimer un Ordre",    "group_key": "maint", "sort_order": 6},
        # Admin & Security (5)
        {"key": "admin.users.view",   "label_en": "View Users",             "label_fr": "Voir les Utilisateurs", "group_key": "admin", "sort_order": 1},
        {"key": "admin.users.manage", "label_en": "Manage Users",           "label_fr": "Gérer les Utilisateurs","group_key": "admin", "sort_order": 2},
        {"key": "admin.roles",        "label_en": "Manage Roles",           "label_fr": "Gérer les Rôles",       "group_key": "admin", "sort_order": 3},
        {"key": "admin.audit_log",    "label_en": "View Audit Log",         "label_fr": "Journal d'Audit",       "group_key": "admin", "sort_order": 4},
        {"key": "admin.settings",     "label_en": "System Settings",        "label_fr": "Paramètres Système",    "group_key": "admin", "sort_order": 5},
    ]
    for p in perms:
        db.add(Permission(**p))

    all_keys = [p["key"] for p in perms]
    import json

    def fo(*extra):    return [k for k in all_keys if k.startswith("fo.")]    + list(extra)
    def hk(*extra):    return [k for k in all_keys if k.startswith("hk.")]    + list(extra)
    def maint(*extra): return [k for k in all_keys if k.startswith("maint.")] + list(extra)
    def fnb(*extra):   return [k for k in all_keys if k.startswith("fnb.")]   + list(extra)
    def acc(*extra):   return [k for k in all_keys if k.startswith("acc.")]   + list(extra)
    def sales(*extra): return [k for k in all_keys if k.startswith("sales.")] + list(extra)
    def hrm(*extra):   return [k for k in all_keys if k.startswith("hrm.")]   + list(extra)
    def g(*keys): return list(keys)

    roles_data = [
        # ── Locked system roles ──────────────────────────────────────────────
        {
            "id": "superadmin",
            "name_en": "Super Admin",         "name_fr": "Super Admin",
            "color": "#dc2626", "is_locked": True,
            "permissions": all_keys,
        },
        # ── Management ───────────────────────────────────────────────────────
        {
            "id": "general_manager",
            "name_en": "General Manager",     "name_fr": "Directeur Général",
            "color": "#7c3aed", "is_locked": False,
            "permissions": [k for k in all_keys if k != "admin.settings"],
        },
        {
            "id": "front_office_manager",
            "name_en": "Front Office Manager","name_fr": "Chef de Réception",
            "color": "#3b5bdb", "is_locked": False,
            "permissions": fo(*[
                "guests.view","guests.create","guests.edit","guests.delete",
                "kc.view","kc.issue","kc.issue.new_booking","kc.revoke","kc.report_lost","kc.access_logs",
                "acc.invoices.view","acc.payments.view","acc.payments.create",
                "fnb.menu.view","fnb.orders.view","sales.packages.view","sales.reports",
                "admin.audit_log",
            ]),
        },
        # ── Front Office ─────────────────────────────────────────────────────
        {
            "id": "receptionist",
            "name_en": "Receptionist",        "name_fr": "Réceptionniste",
            "color": "#0891b2", "is_locked": False,
            "permissions": g(
                "fo.dashboard","fo.rooms.view","fo.rooms.status",
                "fo.res.view","fo.res.create","fo.res.edit",
                "fo.checkin","fo.checkout",
                "fo.folio.view","fo.folio.charge","fo.folio.settle","fo.unsettled",
                "guests.view","guests.create","guests.edit",
                "kc.view","kc.issue","kc.issue.new_booking","kc.revoke","kc.report_lost","kc.test_access",
                "acc.invoices.view","acc.payments.view","acc.payments.create","acc.caisse",
                "fnb.menu.view","fnb.orders.view","fnb.orders.manage",
            ),
        },
        {
            "id": "night_auditor",
            "name_en": "Night Auditor",       "name_fr": "Auditeur de Nuit",
            "color": "#1e293b", "is_locked": False,
            "permissions": g(
                "fo.dashboard","fo.rooms.view","fo.rooms.status",
                "fo.folio.view","fo.folio.charge","fo.folio.void","fo.folio.settle",
                "fo.unsettled","fo.nightly_charges","fo.night_audit","fo.report",
                "guests.view",
                "acc.invoices.view","acc.payments.view","acc.payments.create","acc.caisse","acc.ledger",
            ),
        },
        # ── Housekeeping ─────────────────────────────────────────────────────
        {
            "id": "hk_supervisor",
            "name_en": "Housekeeping Supervisor","name_fr": "Chef Gouvernante",
            "color": "#059669", "is_locked": False,
            "permissions": hk("guests.view","fo.rooms.view","fo.rooms.status","maint.view","maint.create"),
        },
        {
            "id": "hk_staff",
            "name_en": "Housekeeping Staff",  "name_fr": "Agent de Chambre",
            "color": "#10b981", "is_locked": False,
            "permissions": g("hk.tasks.view","hk.tasks.complete","hk.room_status"),
        },
        # ── Food & Beverage ───────────────────────────────────────────────────
        {
            "id": "fnb_manager",
            "name_en": "F&B Manager",         "name_fr": "Responsable F&B",
            "color": "#d97706", "is_locked": False,
            "permissions": fnb("acc.invoices.view","acc.payments.view","acc.caisse"),
        },
        {
            "id": "fnb_staff",
            "name_en": "F&B Staff",           "name_fr": "Agent F&B",
            "color": "#f59e0b", "is_locked": False,
            "permissions": g("fnb.menu.view","fnb.orders.view","fnb.orders.manage"),
        },
        # ── Accounts ─────────────────────────────────────────────────────────
        {
            "id": "accountant",
            "name_en": "Accountant",          "name_fr": "Comptable",
            "color": "#6d28d9", "is_locked": False,
            "permissions": acc("fo.folio.view","fo.folio.void","fo.unsettled","fo.report","fo.nightly_charges"),
        },
        # ── Sales ─────────────────────────────────────────────────────────────
        {
            "id": "sales_manager",
            "name_en": "Sales Manager",       "name_fr": "Responsable Commercial",
            "color": "#e11d48", "is_locked": False,
            "permissions": sales(
                "fo.res.view","fo.res.create","fo.res.edit","fo.dashboard","fo.report",
                "guests.view","guests.create",
            ),
        },
        # ── Maintenance ───────────────────────────────────────────────────────
        {
            "id": "maintenance_supervisor",
            "name_en": "Maintenance Supervisor", "name_fr": "Chef Technique",
            "color": "#ea580c", "is_locked": False,
            "permissions": maint("fo.rooms.view","fo.rooms.status"),
        },
        {
            "id": "maintenance_tech",
            "name_en": "Maintenance Technician", "name_fr": "Technicien de Maintenance",
            "color": "#f97316", "is_locked": False,
            "permissions": g("maint.view","maint.edit","maint.close"),
        },
        # ── HR ────────────────────────────────────────────────────────────────
        {
            "id": "hr_manager",
            "name_en": "HR Manager",          "name_fr": "DRH",
            "color": "#0284c7", "is_locked": False,
            "permissions": hrm("admin.users.view","admin.users.manage"),
        },
        # ── Security / Audit ─────────────────────────────────────────────────
        {
            "id": "auditor",
            "name_en": "Auditor",             "name_fr": "Auditeur",
            "color": "#475569", "is_locked": False,
            "permissions": g(
                "admin.audit_log","fo.report","sales.reports",
                "acc.invoices.view","acc.payments.view",
            ),
        },
    ]

    for r in roles_data:
        db.add(Role(
            id=r["id"], name_en=r["name_en"], name_fr=r["name_fr"],
            color=r["color"], is_locked=r["is_locked"],
            permissions=json.dumps(r["permissions"]),
        ))

    db.commit()
    print(f"[seed] {len(roles_data)} roles seeded")


def run_all_seeders(db: Session):
    seed_currencies(db)
    seed_menu_items(db)
    seed_folio_particulars(db)
    seed_lookup_values(db)
    seed_menu_subcategories(db)
    seed_room_type_configs(db)
    seed_activity_log(db)
    seed_system_settings(db)
    seed_super_admin(db)
    seed_properties(db)
    seed_roles(db)