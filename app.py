from flask import Flask, render_template, request, redirect, url_for, flash, g, jsonify, Response
import sqlite3, csv, io, json, os, shutil, threading, time
from datetime import datetime, date, timedelta
from db import get_db, init_db, DB_PATH

app = Flask(__name__)
app.secret_key = 'moil-primary-it-tracker-2026'

DEVICE_TYPES = ['Student Laptop','Staff Laptop','Teacher Laptop','Desktop PC',
                'New PC Lab PC','Monitor','iPad','Other']
MAKES = ['Dell','Lenovo','Apple','HP','Acer','Samsung','Philips','Microsoft','Other']
STATUSES = ['assigned','available','maintenance','retired']
CONDITIONS = ['New','Excellent','Good','Fair','Poor']
OS_VERSIONS = ['Windows 11','Windows 10','macOS','iOS','iPadOS','Chrome OS','Linux','N/A']
FUNDING = ['NT Government','School Budget','Grant Funded','Donated','Unknown']
LOCATIONS = ['Staff Room','Library','Front Office',"Principal's Office",
             'Business Manager Room','ICT Room','Corner Room','Desert Rose',
             'Student Support','Server Room','Storage',
             'Classroom 1','Classroom 2','Classroom 3','Classroom 4',
             'Classroom 5','Classroom 6','Other']
MAINTENANCE_TYPES = ['Repair','Reimage','Hardware Upgrade','Software Install','Inspection','Other']
LICENCE_TYPES = ['Per Device','Per User','Per Mac','Site Licence','Subscription','One-Time']
VENDORS_LIST = ['Microsoft','Adobe','Apple','Dell','Lenovo','NTG ICT','Other']
ACCESSORY_TYPES = ['HDMI Cable','USB-C Cable','USB-A Cable','DisplayPort Cable',
                   'Power Cable','Charging Adapter','USB-C Charger','Lightning Cable',
                   'Docking Station','USB Hub','Keyboard','Mouse','Webcam',
                   'Headset','Laptop Bag','Tablet Case','Monitor Stand','Other']

INVOICE_CATEGORIES = ['ICT Equipment','Software / Licences','Repairs & Maintenance',
                      'Accessories & Peripherals','Networking','Furniture','Other']
PAYMENT_STATUSES = ['paid','pending','overdue','cancelled']
FURNITURE_CATEGORIES = ['Desk','Chair','Table','Cabinet','Shelving','Whiteboard',
                        'Bookcase','Storage','Display','Other']
FURNITURE_STATUSES = ['active','in storage','disposed','on loan']

WARRANTY_WARN_DAYS = 90
LICENCE_WARN_DAYS = 60
DEVICE_AGE_WARN_YEARS = 5


@app.before_request
def open_db():
    g.db = get_db()


@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db:
        db.close()


def today():
    return date.today().isoformat()


def days_until(date_str):
    if not date_str:
        return None
    try:
        d = datetime.strptime(date_str[:10], '%Y-%m-%d').date()
        return (d - date.today()).days
    except:
        return None


def is_expired(date_str):
    d = days_until(date_str)
    return d is not None and d < 0


def is_expiring_soon(date_str, warn_days):
    d = days_until(date_str)
    return d is not None and 0 <= d <= warn_days


def fmt_date(date_str):
    if not date_str:
        return '—'
    try:
        d = datetime.strptime(date_str[:10], '%Y-%m-%d')
        return d.strftime('%d %b %Y')
    except:
        return date_str


def fmt_currency(val):
    if val is None:
        return '—'
    try:
        return f'${float(val):,.2f}'
    except:
        return str(val)


app.jinja_env.globals.update(
    fmt_date=fmt_date,
    fmt_currency=fmt_currency,
    days_until=days_until,
    is_expired=is_expired,
    is_expiring_soon=is_expiring_soon,
    today=today,
    WARRANTY_WARN_DAYS=WARRANTY_WARN_DAYS,
    LICENCE_WARN_DAYS=LICENCE_WARN_DAYS,
    DEVICE_TYPES=DEVICE_TYPES,
    MAKES=MAKES,
    STATUSES=STATUSES,
    CONDITIONS=CONDITIONS,
    OS_VERSIONS=OS_VERSIONS,
    FUNDING=FUNDING,
    LOCATIONS=LOCATIONS,
    MAINTENANCE_TYPES=MAINTENANCE_TYPES,
    LICENCE_TYPES=LICENCE_TYPES,
    VENDORS_LIST=VENDORS_LIST,
    ACCESSORY_TYPES=ACCESSORY_TYPES,
    INVOICE_CATEGORIES=INVOICE_CATEGORIES,
    PAYMENT_STATUSES=PAYMENT_STATUSES,
    FURNITURE_CATEGORIES=FURNITURE_CATEGORIES,
    FURNITURE_STATUSES=FURNITURE_STATUSES,
)


# ─── Dashboard ────────────────────────────────────────────────────────────────

@app.route('/')
def dashboard():
    db = g.db
    devices = db.execute("SELECT * FROM devices").fetchall()
    licences = db.execute("SELECT * FROM licences").fetchall()
    maintenance = db.execute(
        "SELECT m.*, d.asset_tag, d.serial_number, d.device_type FROM maintenance m "
        "LEFT JOIN devices d ON m.device_id=d.id ORDER BY m.date DESC LIMIT 8"
    ).fetchall()

    total = len(devices)
    assigned = sum(1 for d in devices if d['status'] == 'assigned')
    available = sum(1 for d in devices if d['status'] == 'available')
    in_maint = sum(1 for d in devices if d['status'] == 'maintenance')
    retired = sum(1 for d in devices if d['status'] == 'retired')

    warranty_expiring = [d for d in devices if is_expiring_soon(d['warranty_expiry'], WARRANTY_WARN_DAYS)]
    warranty_expired = [d for d in devices if is_expired(d['warranty_expiry'])]
    lic_expiring = [l for l in licences if is_expiring_soon(l['renewal_date'], LICENCE_WARN_DAYS)]
    lic_expired = [l for l in licences if is_expired(l['renewal_date'])]

    type_counts = {}
    for t in DEVICE_TYPES:
        type_counts[t] = sum(1 for d in devices if d['device_type'] == t)

    return render_template('dashboard.html',
        total=total, assigned=assigned, available=available,
        in_maint=in_maint, retired=retired,
        warranty_expiring=warranty_expiring, warranty_expired=warranty_expired,
        lic_expiring=lic_expiring, lic_expired=lic_expired,
        type_counts=type_counts,
        recent_maintenance=maintenance,
        licences=licences,
    )


# ─── Devices ──────────────────────────────────────────────────────────────────

@app.route('/devices')
def devices():
    db = g.db
    search = request.args.get('q', '').strip()
    dtype = request.args.get('type', '')
    status = request.args.get('status', '')
    condition = request.args.get('condition', '')

    query = "SELECT * FROM devices WHERE 1=1"
    params = []

    if search:
        query += """ AND (asset_tag LIKE ? OR serial_number LIKE ? OR hostname LIKE ?
                     OR assigned_to LIKE ? OR make LIKE ? OR model LIKE ?)"""
        p = f'%{search}%'
        params.extend([p, p, p, p, p, p])
    if dtype:
        query += " AND device_type=?"
        params.append(dtype)
    if status:
        query += " AND status=?"
        params.append(status)
    if condition:
        query += " AND condition=?"
        params.append(condition)

    query += " ORDER BY device_type, asset_tag"
    rows = db.execute(query, params).fetchall()

    return render_template('devices.html', devices=rows,
        search=search, dtype=dtype, status=status, condition=condition)


@app.route('/devices/new', methods=['GET', 'POST'])
def device_new():
    if request.method == 'POST':
        _save_device(None)
        flash('Device added successfully.', 'success')
        return redirect(url_for('devices'))
    return render_template('device_form.html', device=None, title='Add Device')


@app.route('/devices/<int:id>')
def device_detail(id):
    db = g.db
    device = db.execute("SELECT * FROM devices WHERE id=?", (id,)).fetchone()
    if not device:
        flash('Device not found.', 'error')
        return redirect(url_for('devices'))
    maint = db.execute(
        "SELECT * FROM maintenance WHERE device_id=? ORDER BY date DESC", (id,)
    ).fetchall()
    checkouts = db.execute(
        "SELECT * FROM checkout WHERE device_id=? ORDER BY checked_out_at DESC LIMIT 10", (id,)
    ).fetchall()
    accessories = db.execute(
        "SELECT * FROM accessories WHERE device_id=?", (id,)
    ).fetchall()
    return render_template('device_detail.html', device=device,
                           maintenance=maint, checkouts=checkouts, accessories=accessories)


@app.route('/devices/<int:id>/edit', methods=['GET', 'POST'])
def device_edit(id):
    db = g.db
    device = db.execute("SELECT * FROM devices WHERE id=?", (id,)).fetchone()
    if not device:
        return redirect(url_for('devices'))
    if request.method == 'POST':
        _save_device(id)
        flash('Device updated.', 'success')
        return redirect(url_for('device_detail', id=id))
    return render_template('device_form.html', device=device, title='Edit Device')


@app.route('/devices/<int:id>/delete', methods=['POST'])
def device_delete(id):
    g.db.execute("DELETE FROM devices WHERE id=?", (id,))
    g.db.commit()
    flash('Device deleted.', 'info')
    return redirect(url_for('devices'))


def _save_device(id):
    f = request.form
    db = g.db
    vals = (
        f.get('asset_tag','').strip(), f.get('serial_number','').strip(),
        f.get('device_type',''), f.get('make',''), f.get('model','').strip(),
        f.get('assigned_to','').strip(), f.get('location',''),
        f.get('status','available'), f.get('condition','Good'),
        f.get('os_version',''), f.get('storage',''),
        f.get('purchase_date') or None, f.get('purchase_price') or None,
        f.get('warranty_expiry') or None, f.get('funding_source',''),
        f.get('supplier','').strip(), f.get('po_number','').strip(),
        f.get('hostname','').strip(),
        1 if f.get('domain_joined') else 0,
        1 if f.get('bitlocker_enabled') else 0,
        1 if f.get('mdm_enrolled') else 0,
        f.get('last_reimaged') or None,
        f.get('charger_type',''), 1 if f.get('charger_included') else 0,
        1 if f.get('case_loan') else 0,
        f.get('notes','').strip(),
        datetime.now().isoformat(),
    )
    if id is None:
        db.execute("""INSERT INTO devices
            (asset_tag,serial_number,device_type,make,model,assigned_to,location,
             status,condition,os_version,storage,purchase_date,purchase_price,
             warranty_expiry,funding_source,supplier,po_number,hostname,
             domain_joined,bitlocker_enabled,mdm_enrolled,last_reimaged,
             charger_type,charger_included,case_loan,notes,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", vals)
    else:
        db.execute("""UPDATE devices SET
            asset_tag=?,serial_number=?,device_type=?,make=?,model=?,
            assigned_to=?,location=?,status=?,condition=?,os_version=?,storage=?,
            purchase_date=?,purchase_price=?,warranty_expiry=?,funding_source=?,
            supplier=?,po_number=?,hostname=?,domain_joined=?,bitlocker_enabled=?,
            mdm_enrolled=?,last_reimaged=?,charger_type=?,charger_included=?,
            case_loan=?,notes=?,updated_at=? WHERE id=?""", vals + (id,))
    db.commit()


# ─── Licences ─────────────────────────────────────────────────────────────────

@app.route('/licences')
def licences():
    rows = g.db.execute("SELECT * FROM licences ORDER BY software").fetchall()
    return render_template('licences.html', licences=rows)


@app.route('/licences/new', methods=['GET', 'POST'])
def licence_new():
    if request.method == 'POST':
        _save_licence(None)
        flash('Licence added.', 'success')
        return redirect(url_for('licences'))
    return render_template('licence_form.html', licence=None, title='Add Licence')


@app.route('/licences/<int:id>/edit', methods=['GET', 'POST'])
def licence_edit(id):
    db = g.db
    lic = db.execute("SELECT * FROM licences WHERE id=?", (id,)).fetchone()
    if request.method == 'POST':
        _save_licence(id)
        flash('Licence updated.', 'success')
        return redirect(url_for('licences'))
    return render_template('licence_form.html', licence=lic, title='Edit Licence')


@app.route('/licences/<int:id>/delete', methods=['POST'])
def licence_delete(id):
    g.db.execute("DELETE FROM licences WHERE id=?", (id,))
    g.db.commit()
    flash('Licence deleted.', 'info')
    return redirect(url_for('licences'))


def _save_licence(id):
    f = request.form
    db = g.db
    vals = (
        f.get('software','').strip(), f.get('vendor',''),
        f.get('licence_type',''), f.get('seats') or None,
        f.get('cost_per_unit') or None, f.get('total_cost') or None,
        f.get('billing_year') or None, f.get('renewal_date') or None,
        f.get('status','active'), f.get('assigned_to','').strip(),
        f.get('notes','').strip(), datetime.now().isoformat(),
    )
    if id is None:
        db.execute("""INSERT INTO licences
            (software,vendor,licence_type,seats,cost_per_unit,total_cost,
             billing_year,renewal_date,status,assigned_to,notes,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", vals)
    else:
        db.execute("""UPDATE licences SET
            software=?,vendor=?,licence_type=?,seats=?,cost_per_unit=?,total_cost=?,
            billing_year=?,renewal_date=?,status=?,assigned_to=?,notes=?,updated_at=?
            WHERE id=?""", vals + (id,))
    db.commit()


# ─── Maintenance ──────────────────────────────────────────────────────────────

@app.route('/maintenance')
def maintenance():
    rows = g.db.execute("""
        SELECT m.*, d.asset_tag, d.serial_number, d.device_type, d.model
        FROM maintenance m LEFT JOIN devices d ON m.device_id=d.id
        ORDER BY m.date DESC
    """).fetchall()
    devices = g.db.execute("SELECT id, asset_tag, serial_number, device_type FROM devices ORDER BY device_type, asset_tag").fetchall()
    return render_template('maintenance.html', records=rows, devices=devices)


@app.route('/maintenance/new', methods=['GET', 'POST'])
def maintenance_new():
    if request.method == 'POST':
        f = request.form
        db = g.db
        db.execute("""INSERT INTO maintenance (device_id,date,type,technician,cost,status_after,notes)
            VALUES (?,?,?,?,?,?,?)""", (
            f.get('device_id') or None, f.get('date') or today(),
            f.get('type',''), f.get('technician','').strip(),
            f.get('cost') or None, f.get('status_after',''),
            f.get('notes','').strip()
        ))
        if f.get('status_after') and f.get('device_id'):
            db.execute("UPDATE devices SET status=?,updated_at=? WHERE id=?",
                       (f['status_after'], datetime.now().isoformat(), f['device_id']))
        db.commit()
        flash('Maintenance record added.', 'success')
        return redirect(url_for('maintenance'))
    devices = g.db.execute("SELECT id, asset_tag, serial_number, device_type FROM devices ORDER BY device_type, asset_tag").fetchall()
    pre_device = request.args.get('device_id')
    return render_template('maintenance_form.html', devices=devices, pre_device=pre_device)


@app.route('/maintenance/<int:id>/delete', methods=['POST'])
def maintenance_delete(id):
    g.db.execute("DELETE FROM maintenance WHERE id=?", (id,))
    g.db.commit()
    flash('Record deleted.', 'info')
    return redirect(url_for('maintenance'))


# ─── Checkout ─────────────────────────────────────────────────────────────────

@app.route('/checkout')
def checkout():
    active = g.db.execute("""
        SELECT c.*, d.asset_tag, d.serial_number, d.device_type FROM checkout c
        LEFT JOIN devices d ON c.device_id=d.id WHERE c.status='out' ORDER BY c.checked_out_at DESC
    """).fetchall()
    history = g.db.execute("""
        SELECT c.*, d.asset_tag, d.serial_number, d.device_type FROM checkout c
        LEFT JOIN devices d ON c.device_id=d.id WHERE c.status='returned'
        ORDER BY c.returned_at DESC LIMIT 50
    """).fetchall()
    devices = g.db.execute(
        "SELECT id, asset_tag, serial_number, device_type FROM devices ORDER BY device_type, asset_tag"
    ).fetchall()
    return render_template('checkout.html', active=active, history=history, devices=devices)


@app.route('/checkout/new', methods=['POST'])
def checkout_new():
    f = request.form
    db = g.db
    db.execute("""INSERT INTO checkout (device_id,borrower_name,borrower_class,
        checked_out_at,expected_return,notes,status)
        VALUES (?,?,?,?,?,?,'out')""", (
        f.get('device_id') or None, f.get('borrower_name','').strip(),
        f.get('borrower_class','').strip(), f.get('checked_out_at') or today(),
        f.get('expected_return') or None, f.get('notes','').strip()
    ))
    if f.get('device_id'):
        db.execute("UPDATE devices SET status='assigned', assigned_to=?, updated_at=? WHERE id=?",
                   (f.get('borrower_name',''), datetime.now().isoformat(), f['device_id']))
    db.commit()
    flash(f"Device checked out to {f.get('borrower_name','')}", 'success')
    return redirect(url_for('checkout'))


@app.route('/checkout/<int:id>/return', methods=['POST'])
def checkout_return(id):
    db = g.db
    row = db.execute("SELECT * FROM checkout WHERE id=?", (id,)).fetchone()
    if row:
        db.execute("UPDATE checkout SET status='returned', returned_at=? WHERE id=?",
                   (datetime.now().isoformat(), id))
        if row['device_id']:
            condition = request.form.get('condition', 'Good')
            db.execute("UPDATE devices SET status='available', assigned_to='', condition=?, updated_at=? WHERE id=?",
                       (condition, datetime.now().isoformat(), row['device_id']))
        db.commit()
        flash('Device returned.', 'success')
    return redirect(url_for('checkout'))


# ─── Vendors ──────────────────────────────────────────────────────────────────

@app.route('/vendors')
def vendors():
    rows = g.db.execute("SELECT * FROM vendors ORDER BY name").fetchall()
    return render_template('vendors.html', vendors=rows)


@app.route('/vendors/new', methods=['GET', 'POST'])
def vendor_new():
    if request.method == 'POST':
        _save_vendor(None)
        flash('Vendor added.', 'success')
        return redirect(url_for('vendors'))
    return render_template('vendor_form.html', vendor=None, title='Add Vendor')


@app.route('/vendors/<int:id>/edit', methods=['GET', 'POST'])
def vendor_edit(id):
    v = g.db.execute("SELECT * FROM vendors WHERE id=?", (id,)).fetchone()
    if request.method == 'POST':
        _save_vendor(id)
        flash('Vendor updated.', 'success')
        return redirect(url_for('vendors'))
    return render_template('vendor_form.html', vendor=v, title='Edit Vendor')


@app.route('/vendors/<int:id>/delete', methods=['POST'])
def vendor_delete(id):
    g.db.execute("DELETE FROM vendors WHERE id=?", (id,))
    g.db.commit()
    flash('Vendor deleted.', 'info')
    return redirect(url_for('vendors'))


def _save_vendor(id):
    f = request.form
    db = g.db
    vals = (f.get('name','').strip(), f.get('contact','').strip(), f.get('phone','').strip(),
            f.get('email','').strip(), f.get('website','').strip(),
            f.get('categories','').strip(), f.get('account_number','').strip(),
            f.get('notes','').strip())
    if id is None:
        db.execute("INSERT INTO vendors (name,contact,phone,email,website,categories,account_number,notes) VALUES (?,?,?,?,?,?,?,?)", vals)
    else:
        db.execute("UPDATE vendors SET name=?,contact=?,phone=?,email=?,website=?,categories=?,account_number=?,notes=? WHERE id=?", vals + (id,))
    db.commit()


# ─── Export ───────────────────────────────────────────────────────────────────

@app.route('/export')
def export():
    db = g.db
    dev_count = db.execute("SELECT COUNT(*) as c FROM devices").fetchone()['c']
    lic_count = db.execute("SELECT COUNT(*) as c FROM licences").fetchone()['c']
    mnt_count = db.execute("SELECT COUNT(*) as c FROM maintenance").fetchone()['c']
    row = db.execute("SELECT value FROM settings WHERE key='last_backup'").fetchone()
    last_backup = row['value'] if row else None
    return render_template('export.html', dev_count=dev_count,
                           lic_count=lic_count, mnt_count=mnt_count,
                           last_backup=last_backup)


@app.route('/export/devices.csv')
def export_devices():
    rows = g.db.execute("SELECT * FROM devices ORDER BY device_type, asset_tag").fetchall()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(['Asset Tag','Serial','Device Type','Make','Model','Assigned To',
                'Location','Status','Condition','OS','Purchase Date','Warranty Expiry',
                'Domain','BitLocker','MDM','Notes'])
    for r in rows:
        w.writerow([r['asset_tag'],r['serial_number'],r['device_type'],r['make'],r['model'],
                    r['assigned_to'],r['location'],r['status'],r['condition'],
                    r['os_version'],r['purchase_date'],r['warranty_expiry'],
                    'Yes' if r['domain_joined'] else 'No',
                    'Yes' if r['bitlocker_enabled'] else 'No',
                    'Yes' if r['mdm_enrolled'] else 'No',r['notes']])
    return Response(out.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=devices.csv'})


@app.route('/export/licences.csv')
def export_licences():
    rows = g.db.execute("SELECT * FROM licences ORDER BY software").fetchall()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(['Software','Vendor','Type','Seats','Cost/Unit','Total','Renewal','Status','Notes'])
    for r in rows:
        w.writerow([r['software'],r['vendor'],r['licence_type'],r['seats'],
                    r['cost_per_unit'],r['total_cost'],r['renewal_date'],r['status'],r['notes']])
    return Response(out.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=licences.csv'})


@app.route('/export/maintenance.csv')
def export_maintenance():
    rows = g.db.execute("""
        SELECT m.*, d.asset_tag, d.device_type FROM maintenance m
        LEFT JOIN devices d ON m.device_id=d.id ORDER BY m.date DESC
    """).fetchall()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(['Date','Asset Tag','Device Type','Type','Technician','Cost','Notes'])
    for r in rows:
        w.writerow([r['date'],r['asset_tag'],r['device_type'],r['type'],
                    r['technician'],r['cost'],r['notes']])
    return Response(out.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=maintenance.csv'})


@app.route('/export/backup/download')
def export_backup_download():
    with open(DB_PATH, 'rb') as f:
        data = f.read()
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    return Response(data, mimetype='application/octet-stream',
                    headers={'Content-Disposition': f'attachment; filename=tracker_backup_{ts}.db'})


@app.route('/export/backup/manual', methods=['POST'])
def export_backup_manual():
    _do_backup()
    flash('Backup saved to backups/ folder.', 'success')
    return redirect(url_for('export'))


# ─── Budget / Invoices ────────────────────────────────────────────────────────

@app.route('/budget')
def budget():
    db = g.db
    year = request.args.get('year', date.today().year, type=int)
    invoices = db.execute(
        "SELECT * FROM invoices WHERE strftime('%Y', date)=? ORDER BY date DESC",
        (str(year),)
    ).fetchall()

    years = db.execute(
        "SELECT DISTINCT strftime('%Y', date) as yr FROM invoices ORDER BY yr DESC"
    ).fetchall()
    year_list = [r['yr'] for r in years]
    if str(year) not in year_list:
        year_list.insert(0, str(year))

    total = sum(r['amount'] for r in invoices)
    by_cat = {}
    for r in invoices:
        by_cat[r['category']] = by_cat.get(r['category'], 0) + r['amount']

    return render_template('budget.html', invoices=invoices, year=year,
                           year_list=year_list, total=total, by_cat=by_cat)


@app.route('/budget/new', methods=['GET', 'POST'])
def invoice_new():
    if request.method == 'POST':
        _save_invoice(None)
        flash('Invoice added.', 'success')
        return redirect(url_for('budget'))
    return render_template('invoice_form.html', invoice=None, title='Add Invoice')


@app.route('/budget/<int:id>/edit', methods=['GET', 'POST'])
def invoice_edit(id):
    inv = g.db.execute("SELECT * FROM invoices WHERE id=?", (id,)).fetchone()
    if not inv:
        return redirect(url_for('budget'))
    if request.method == 'POST':
        _save_invoice(id)
        flash('Invoice updated.', 'success')
        return redirect(url_for('budget'))
    return render_template('invoice_form.html', invoice=inv, title='Edit Invoice')


@app.route('/budget/<int:id>/delete', methods=['POST'])
def invoice_delete(id):
    g.db.execute("DELETE FROM invoices WHERE id=?", (id,))
    g.db.commit()
    flash('Invoice deleted.', 'info')
    return redirect(url_for('budget'))


def _save_invoice(id):
    f = request.form
    db = g.db
    amount = f.get('amount') or 0
    gst_raw = f.get('gst') or None
    vals = (
        f.get('date') or date.today().isoformat(),
        f.get('vendor', '').strip(),
        f.get('description', '').strip(),
        f.get('category', 'ICT Equipment'),
        float(amount),
        float(gst_raw) if gst_raw else None,
        f.get('po_number', '').strip(),
        f.get('invoice_number', '').strip(),
        f.get('payment_status', 'paid'),
        f.get('notes', '').strip(),
    )
    if id is None:
        db.execute("""INSERT INTO invoices
            (date,vendor,description,category,amount,gst,po_number,invoice_number,payment_status,notes)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", vals)
    else:
        db.execute("""UPDATE invoices SET
            date=?,vendor=?,description=?,category=?,amount=?,gst=?,
            po_number=?,invoice_number=?,payment_status=?,notes=? WHERE id=?""", vals + (id,))
    db.commit()


# ─── Furniture ────────────────────────────────────────────────────────────────

@app.route('/furniture')
def furniture():
    db = g.db
    search = request.args.get('q', '').strip()
    cat = request.args.get('cat', '')
    status = request.args.get('status', '')
    location = request.args.get('location', '')

    query = "SELECT * FROM furniture WHERE 1=1"
    params = []
    if search:
        query += " AND (name LIKE ? OR supplier LIKE ? OR location LIKE ?)"
        p = f'%{search}%'
        params.extend([p, p, p])
    if cat:
        query += " AND category=?"
        params.append(cat)
    if status:
        query += " AND status=?"
        params.append(status)
    if location:
        query += " AND location LIKE ?"
        params.append(f'%{location}%')
    query += " ORDER BY category, name"
    rows = db.execute(query, params).fetchall()

    total_value = sum((r['purchase_price'] or 0) * (r['quantity'] or 1) for r in rows)
    total_items = sum(r['quantity'] or 1 for r in rows)
    return render_template('furniture.html', items=rows,
                           total_value=total_value, total_items=total_items,
                           search=search, cat=cat, status=status, location=location)


@app.route('/furniture/new', methods=['GET', 'POST'])
def furniture_new():
    if request.method == 'POST':
        _save_furniture(None)
        flash('Furniture item added.', 'success')
        return redirect(url_for('furniture'))
    return render_template('furniture_form.html', item=None, title='Add Furniture')


@app.route('/furniture/<int:id>/edit', methods=['GET', 'POST'])
def furniture_edit(id):
    item = g.db.execute("SELECT * FROM furniture WHERE id=?", (id,)).fetchone()
    if not item:
        return redirect(url_for('furniture'))
    if request.method == 'POST':
        _save_furniture(id)
        flash('Furniture item updated.', 'success')
        return redirect(url_for('furniture'))
    return render_template('furniture_form.html', item=item, title='Edit Furniture')


@app.route('/furniture/<int:id>/delete', methods=['POST'])
def furniture_delete(id):
    g.db.execute("DELETE FROM furniture WHERE id=?", (id,))
    g.db.commit()
    flash('Item deleted.', 'info')
    return redirect(url_for('furniture'))


def _save_furniture(id):
    f = request.form
    db = g.db
    now = datetime.now().isoformat()
    vals = (
        f.get('name', '').strip(),
        f.get('category', 'Other'),
        f.get('quantity') or 1,
        f.get('location', '').strip(),
        f.get('condition', 'Good'),
        f.get('purchase_date') or None,
        f.get('purchase_price') or None,
        f.get('supplier', '').strip(),
        f.get('status', 'active'),
        f.get('notes', '').strip(),
        now,
    )
    if id is None:
        db.execute("""INSERT INTO furniture
            (name,category,quantity,location,condition,purchase_date,purchase_price,
             supplier,status,notes,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""", vals)
    else:
        db.execute("""UPDATE furniture SET
            name=?,category=?,quantity=?,location=?,condition=?,purchase_date=?,
            purchase_price=?,supplier=?,status=?,notes=?,updated_at=? WHERE id=?""",
            vals + (id,))
    db.commit()


# ─── Auto Backup ──────────────────────────────────────────────────────────────

BACKUP_DIR = os.path.join(os.path.dirname(__file__), 'backups')
BACKUP_INTERVAL_DAYS = 7
MAX_BACKUPS = 4


def _do_backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    dst = os.path.join(BACKUP_DIR, f'tracker_{ts}.db')
    shutil.copy2(DB_PATH, dst)

    files = sorted(
        [f for f in os.listdir(BACKUP_DIR) if f.startswith('tracker_') and f.endswith('.db')]
    )
    while len(files) > MAX_BACKUPS:
        os.remove(os.path.join(BACKUP_DIR, files.pop(0)))

    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup', ?)",
                 (datetime.now().isoformat(),))
    conn.commit()
    conn.close()
    print(f'[backup] Saved {dst}')


def _backup_worker():
    time.sleep(10)
    while True:
        try:
            conn = get_db()
            row = conn.execute("SELECT value FROM settings WHERE key='last_backup'").fetchone()
            conn.close()
            last = datetime.fromisoformat(row['value']) if row else None
            if last is None or (datetime.now() - last).days >= BACKUP_INTERVAL_DAYS:
                _do_backup()
        except Exception as e:
            print(f'[backup] Error: {e}')
        time.sleep(3600)


if __name__ == '__main__':
    init_db()
    t = threading.Thread(target=_backup_worker, daemon=True)
    t.start()
    app.run(debug=True, port=5000, host='0.0.0.0')
