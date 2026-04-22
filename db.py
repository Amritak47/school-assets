import sqlite3, json, os
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
"""


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()

    # Only seed if empty
    row = conn.execute("SELECT COUNT(*) as c FROM devices").fetchone()
    if row['c'] == 0:
        _seed(conn)
    conn.close()


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
