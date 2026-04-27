import sqlite3, json, os, shutil
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'tracker.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_tag TEXT,
    serial_number TEXT,
    device_type TEXT NOT NULL,
    make TEXT,
    model TEXT,
    assigned_to TEXT,
    location TEXT,
    status TEXT DEFAULT 'available',
    condition TEXT DEFAULT 'Good',
    os_version TEXT,
    storage TEXT,
    purchase_date TEXT,
    purchase_price REAL,
    warranty_expiry TEXT,
    funding_source TEXT,
    supplier TEXT,
    po_number TEXT,
    invoice_number TEXT,
    hostname TEXT,
    domain_joined INTEGER DEFAULT 0,
    bitlocker_enabled INTEGER DEFAULT 0,
    mdm_enrolled INTEGER DEFAULT 0,
    last_reimaged TEXT,
    charger_type TEXT,
    charger_included INTEGER DEFAULT 0,
    case_loan INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS licences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    software TEXT NOT NULL,
    vendor TEXT,
    licence_type TEXT,
    seats INTEGER,
    cost_per_unit REAL,
    total_cost REAL,
    billing_year INTEGER,
    renewal_date TEXT,
    status TEXT DEFAULT 'active',
    assigned_to TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER REFERENCES devices(id),
    date TEXT,
    type TEXT,
    technician TEXT,
    cost REAL,
    status_after TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checkout (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER REFERENCES devices(id),
    borrower_name TEXT,
    borrower_class TEXT,
    checked_out_at TEXT,
    expected_return TEXT,
    returned_at TEXT,
    status TEXT DEFAULT 'out',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    categories TEXT,
    account_number TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accessories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auto_id TEXT,
    type TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    device_id INTEGER REFERENCES devices(id),
    condition TEXT DEFAULT 'Good',
    purchase_date TEXT,
    purchase_price REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    checked_data TEXT DEFAULT '{}',
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    vendor TEXT,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'ICT Equipment',
    amount REAL NOT NULL,
    gst REAL,
    po_number TEXT,
    invoice_number TEXT,
    payment_status TEXT DEFAULT 'paid',
    notes TEXT,
    file_path TEXT,
    location TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budget_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL UNIQUE,
    target REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS furniture (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    quantity INTEGER DEFAULT 1,
    location TEXT,
    condition TEXT DEFAULT 'Good',
    purchase_date TEXT,
    purchase_price REAL,
    supplier TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
"""


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    _migrate(conn)
    conn.commit()

    row = conn.execute("SELECT COUNT(*) as c FROM devices").fetchone()
    if row['c'] == 0:
        _seed(conn)

    inv_row = conn.execute("SELECT COUNT(*) as c FROM invoices").fetchone()
    if inv_row['c'] == 0:
        _seed_invoices(conn)

    tgt_row = conn.execute("SELECT COUNT(*) as c FROM budget_targets").fetchone()
    if tgt_row['c'] == 0:
        _seed_budget_targets(conn)

    conn.close()


def _migrate(conn):
    """Apply schema migrations for columns added after initial release."""
    migrations = [
        "ALTER TABLE invoices ADD COLUMN file_path TEXT",
        "ALTER TABLE invoices ADD COLUMN location TEXT",
        "ALTER TABLE devices ADD COLUMN invoice_number TEXT",
    ]
    for sql in migrations:
        try:
            conn.execute(sql)
            conn.commit()
        except Exception:
            pass

    # Clean up literal "None" strings written by early Python str() coercion
    none_cols = ['asset_tag', 'serial_number', 'hostname', 'assigned_to',
                 'supplier', 'po_number', 'invoice_number', 'model',
                 'funding_source', 'storage', 'charger_type', 'notes']
    for col in none_cols:
        try:
            conn.execute(f"UPDATE devices SET {col}=NULL WHERE {col}='None'")
        except Exception:
            pass
    conn.commit()


def _seed(conn):
    seed_file = os.path.join(os.path.dirname(__file__), 'seed_data.json')
    if not os.path.exists(seed_file):
        return

    with open(seed_file) as f:
        data = json.load(f)

    now = datetime.now().isoformat()
    devices = []

    for m in data.get('monitors', []):
        devices.append((
            None, m['serial'], 'Monitor', 'Lenovo', m['model'],
            m['assigned_to'], m['location'],
            'assigned' if m['assigned_to'] else 'available',
            m['condition'] or 'Good', None, None,
            m['purchase_date'], None, None, None, None, None, None,
            0, 0, 0, None, None, 0, 0, m['notes'], now, now
        ))

    for p in data.get('pcs', []):
        devices.append((
            None, p['serial'], 'Desktop PC', 'Dell', p['model'],
            p['assigned_to'], p['location'],
            'assigned' if p['assigned_to'] else 'available',
            p['condition'] or 'Good', 'Windows 11', None,
            p['purchase_date'], None, None, None, None, None, None,
            1, 0, 0, None, None, 0, 0, p['notes'], now, now
        ))

    for t in data.get('teachers', []):
        devices.append((
            t['asset_tag'], t['serial'], 'Teacher Laptop', 'Lenovo', t['model'],
            t['assigned_to'], 'Staff Room',
            'assigned' if t['assigned_to'] else 'available',
            'Good', 'Windows 11', None,
            t['purchase_date'], None, None, None, None, None, None,
            1, 1, 0, None, None, 0, 0, t['notes'], now, now
        ))

    for p in data.get('pclab', []):
        devices.append((
            p['asset_tag'], p['serial'], 'New PC Lab PC', 'Lenovo', p['model'],
            None, p['location'],
            'available',
            p['condition'] or 'New', 'Windows 11', None,
            p['purchase_date'], None, None, None, None, None, None,
            1, 0, 0, None, None, 0, 0, None, now, now
        ))

    for s in data.get('staff', []):
        devices.append((
            s['asset_tag'], s['serial'], 'Staff Laptop', s['make'], s['model'],
            s['assigned_to'], None,
            'assigned' if s['assigned_to'] else 'available',
            'Good', 'Windows 11', None,
            s['purchase_date'], None, s['warranty_expiry'], None, None, None, None,
            1, 1, 0, None, None, 0, 0, s['notes'], now, now
        ))

    for st in data.get('students', []):
        devices.append((
            st['asset_tag'], st['serial'], 'Student Laptop', 'Dell', st['model'],
            None, st['location'],
            'available', 'Good', 'Windows 10', None,
            st['purchase_date'], None, st['warranty_expiry'], None, None, None, None,
            0, 0, 0, None, None, 0, 0, st['notes'], now, now
        ))

    for i in data.get('ipads', []):
        devices.append((
            i['asset_tag'], i['serial'], 'iPad', 'Apple', i['model'],
            None, None,
            'available', 'Good', 'iPadOS', None,
            i['purchase_date'], None, None, None, None, None, None,
            0, 0, 1, None, None, 0, 0, i['notes'], now, now
        ))

    conn.executemany("""
        INSERT INTO devices
        (asset_tag, serial_number, device_type, make, model, assigned_to, location,
         status, condition, os_version, storage, purchase_date, purchase_price,
         warranty_expiry, funding_source, supplier, po_number, hostname,
         domain_joined, bitlocker_enabled, mdm_enrolled, last_reimaged,
         charger_type, charger_included, case_loan, notes, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, devices)

    # Seed licences
    conn.executemany("""
        INSERT INTO licences (software, vendor, licence_type, seats, cost_per_unit, total_cost,
            billing_year, renewal_date, status, assigned_to, notes, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, [
        ('Microsoft Windows', 'Microsoft', 'Per Device', 143, 30, 4290,
         2026, '2026-12-31', 'active', 'All Windows Devices',
         'Based on Windows devices connected to NT Schools network Jan 2026', now, now),
        ('Adobe Creative Cloud', 'Adobe', 'Per User', 12, 7, 84,
         2026, '2026-12-31', 'active', 'Staff',
         'CCE All Apps for K-12 - 80GB. Currently 12 of 12 assigned.', now, now),
        ('Apple JAMF', 'Apple', 'Per Device', 36, 13, 498,
         2025, '2025-12-31', 'active', 'All Apple Devices',
         '36 Apple devices @ $13 + 1 Mac @ $30 = $498. Data from 12 Feb 2025.', now, now),
    ])

    # Seed vendors
    conn.executemany("""
        INSERT INTO vendors (name, contact, phone, email, website, categories, notes, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, [
        ('Dell Australia', 'Sales Team', '1800 812 393', 'au_sales@dell.com',
         'dell.com/au', 'Laptops, Desktops, Monitors', 'Main hardware supplier', now),
        ('Lenovo Australia', 'Education Team', '1800 041 495', '',
         'lenovo.com/au', 'Laptops, Desktops', 'ThinkPad and ThinkCentre supplier', now),
        ('Apple Australia', 'Education', '', '',
         'apple.com/au/education', 'iPads, MDM', 'iPad and JAMF licensing', now),
        ('NTG ICT', 'IT Support', '08 8999 0000', '',
         'nt.gov.au/ict', 'Support, Licensing', 'NT Government ICT services', now),
    ])

    conn.execute("INSERT INTO settings (key, value) VALUES ('seeded', 'true')")
    conn.commit()
    print(f"Seeded {len(devices)} devices from Excel data.")


def _copy_doc(src_name, dst_name):
    """Copy a repo-root invoice PDF into the uploads folder."""
    base = os.path.dirname(__file__)
    src = os.path.join(base, src_name)
    uploads = os.path.join(base, 'static', 'uploads', 'invoices')
    os.makedirs(uploads, exist_ok=True)
    dst = os.path.join(uploads, dst_name)
    if os.path.exists(src) and not os.path.exists(dst):
        shutil.copy2(src, dst)
    return dst_name if os.path.exists(dst) else None


def _seed_invoices(conn):
    """Seed real invoice data extracted from uploaded purchase orders and invoices."""
    now = datetime.now().isoformat()

    # Copy repo PDFs into the uploads folder so they're serveable
    docs = {
        'PO - Integral Digital 15500143.pdf':               'seed_PO15500143_Integral_Digital.pdf',
        'PO15500158  - Territory Technology Solutions.pdf': 'seed_PO15500158_Territory_Tech.pdf',
        'Purchase Order PO15500150.pdf':                    'seed_PO15500150_Territory_Tech.pdf',
        'Purchase Order PO15500151.pdf':                    'seed_PO15500151_Territory_Tech.pdf',
        'Purchase Order PO15500171.pdf':                    'seed_PO15500171_Territory_Tech.pdf',
        'Officeworks Invoice 624729245.pdf':                'seed_INV624729245_Officeworks.pdf',
        'order-document.pdf':                               'seed_AMZ_249_ipad_cases.pdf',
        'order-document (1).pdf':                           'seed_AMZ_250_hdmi_accessories.pdf',
        'Quote 10206414.pdf':                               'seed_QT10206414_Integral_Digital.pdf',
        'Quote_64804v1.pdf':                                'seed_QT64804_ASI_iPads.pdf',
    }
    copied = {orig: _copy_doc(orig, dst) for orig, dst in docs.items()}

    invoices = [
        # ── 2025 ──────────────────────────────────────────────────────────────
        ('2025-01-23', 'Integral Digital',
         '15× Dell Latitude 3140 Student Laptops (Pentium, 8 GB RAM, 256 GB SSD, 4-yr warranty)',
         'ICT Equipment', 15903.36, None,
         'PO15500143', 'PO15500143', 'paid',
         'Dell Latitude 3140 Non-Touch @ $1,060.22 each. 15 student laptops.',
         copied.get('PO - Integral Digital 15500143.pdf'),
         'ICT Room'),

        ('2025-07-07', 'Territory Technology Solutions',
         '2× Lenovo ThinkVision E24-3024" 24-inch Monitors',
         'ICT Equipment', 387.10, None,
         'PO15500150', 'PO15500150', 'paid',
         '2× 24" monitors @ $193.55 each.',
         copied.get('Purchase Order PO15500150.pdf'),
         'Staff Room'),

        ('2025-08-25', 'Territory Technology Solutions',
         'Replacement Desktop PC + All-in-One Touch Desktop',
         'ICT Equipment', 3331.36, None,
         'PO15500151', 'PO15500151', 'paid',
         'Standard Desktop Microtower + All-in-One Desktop (Touch screen) for admin.',
         copied.get('Purchase Order PO15500151.pdf'),
         "Principal's Office"),

        ('2025-10-30', 'Officeworks',
         'Apple Lightning Digital AV Adapter (APMW2P3AMA)',
         'Accessories & Peripherals', 83.00, 7.55,
         '1018169282', '624729245', 'paid',
         'Single Apple Lightning to HDMI Digital AV Adapter.',
         copied.get('Officeworks Invoice 624729245.pdf'),
         'Staff Room'),

        ('2025-11-04', 'Amazon',
         'iPad Cases & Screen Protectors (JETech / ProCase) — Order #249-6083467-8835850',
         'Accessories & Peripherals', 488.33, None,
         '', '249-6083467-8835850', 'paid',
         '1× JETech detachable case (iPad 9/8/7), 10× JETech smart covers 9.7" Deep Navy, '
         '10× JETech smart covers 9.7" Matcha Green, 5× JETech smart covers 9.7" Purple.',
         copied.get('order-document.pdf'),
         'Classrooms'),

        ('2025-12-12', 'Territory Technology Solutions',
         '27× Computer Lab Desktop Mini PCs + 27× 22-inch Monitors (Computer Lab Upgrade)',
         'ICT Equipment', 45219.33, None,
         'PO15500158', 'PO15500158', 'paid',
         '27× Standard Desktop Mini @ $1,500.00 + 27× 22" Monitor @ $174.79. Full PC lab refresh.',
         copied.get('PO15500158  - Territory Technology Solutions.pdf'),
         'ICT Room'),

        # ── 2026 ──────────────────────────────────────────────────────────────
        ('2026-02-17', 'Amazon',
         'HDMI Cables, Phone Tripod & iPad Screen Protectors — Order #250-0142269-7284662',
         'Accessories & Peripherals', 345.25, None,
         '', '250-0142269-7284662', 'paid',
         '5× HDMI 2 M cables, 1× 62" phone tripod, screen protectors for iPads 9.7" and 11".',
         copied.get('order-document (1).pdf'),
         'Classrooms'),

        ('2026-02-20', 'Territory Technology Solutions',
         'ThinkPad P16s Gen 3 Laptop — ICT Officer (Power User Config)',
         'ICT Equipment', 2974.40, None,
         'PO15500171', 'PO15500171', 'paid',
         'Lenovo ThinkPad P16s Gen 3 21KTCTO1WW. Enhanced/Power User configuration.',
         copied.get('Purchase Order PO15500171.pdf'),
         'ICT Room'),

        # ── Quotes (pending / not yet ordered) ───────────────────────────────
        ('2024-10-02', 'Integral Digital',
         'QUOTE: Dell Latitude 5350 Touch Ultra5 WiFi 16 GB 256 GB SSD 3-yr',
         'ICT Equipment', 2017.76, 183.43,
         '', 'QT-10206414', 'pending',
         'Quote #10206414 — valid subject to DoE Computer Supply Catalogue. Not yet ordered.',
         copied.get('Quote 10206414.pdf'),
         ''),

        ('2025-11-01', 'ASI Solutions',
         'QUOTE: 7× Apple iPad 11-inch Wi-Fi 128 GB Silver + DUX PLUS Cases',
         'ICT Equipment', 3903.90, 354.90,
         '', 'QT-064804', 'pending',
         'Quote #064804 v1 — Apple Education promotion. '
         '7× iPad @ $471 + 7× DUX PLUS case @ $36 (ex GST). Not yet ordered.',
         copied.get('Quote_64804v1.pdf'),
         'Classrooms'),
    ]

    conn.executemany("""
        INSERT INTO invoices
          (date, vendor, description, category, amount, gst,
           po_number, invoice_number, payment_status, notes,
           file_path, location, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, [(*inv, now) for inv in invoices])

    conn.commit()
    print(f"Seeded {len(invoices)} invoices from real PDF data.")


def _seed_budget_targets(conn):
    now = datetime.now().isoformat()
    targets = [
        (2024, 5000.00,  'Minor accessories and ad-hoc purchases only.', now),
        (2025, 75000.00, 'Major year: student laptop rollout + full PC lab refresh.', now),
        (2026, 40000.00, 'Ongoing refresh: iPad rollout + ICT officer laptop.', now),
    ]
    conn.executemany(
        "INSERT INTO budget_targets (year, target, notes, created_at) VALUES (?,?,?,?)",
        targets
    )
    conn.commit()
    print("Seeded budget targets.")
