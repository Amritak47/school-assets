const Modal = {
  _onSave: null,

  show(title, bodyHTML, onSave, saveLabel = 'Save') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-save').textContent = saveLabel;
    document.getElementById('modal-overlay').classList.remove('hidden');
    this._onSave = onSave;
    document.getElementById('modal-body').querySelector('input,select,textarea')?.focus();
  },

  hide() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
    this._onSave = null;
  },

  confirm() { if (this._onSave) this._onSave(); }
};

const Confirm = {
  _onYes: null,
  show(title, msg, onYes, yesLabel = 'Delete') {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-yes').textContent = yesLabel;
    document.getElementById('confirm-overlay').classList.remove('hidden');
    this._onYes = onYes;
  },
  hide() {
    document.getElementById('confirm-overlay').classList.add('hidden');
    this._onYes = null;
  },
  confirm() { if (this._onYes) this._onYes(); }
};

const Toast = {
  show(msg, type = 'success') {
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icons[type] || ''}<span>${H.escape(msg)}</span>`;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => {
      el.style.animation = 'slideOut 0.2s ease forwards';
      setTimeout(() => el.remove(), 200);
    }, 3000);
  }
};

function getFormData(formEl) {
  const data = {};
  formEl.querySelectorAll('[name]').forEach(el => {
    if (el.type === 'checkbox') data[el.name] = el.checked;
    else data[el.name] = el.value.trim();
  });
  return data;
}

function buildForm(fields) {
  return '<div class="form-grid">' + fields.map(f => {
    if (f.type === 'section') return `<div class="form-section${f.span2 !== false ? '' : ''}">${H.escape(f.label)}</div>`;
    if (f.type === 'spacer') return '<div></div>';
    const cls = f.span2 ? ' span-2' : '';
    const id = `f_${f.name}`;
    let input = '';
    if (f.type === 'select') {
      input = `<select name="${f.name}" id="${id}">${H.opts(f.options || [], f.value || '')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea name="${f.name}" id="${id}" rows="3">${H.escape(f.value || '')}</textarea>`;
    } else if (f.type === 'checkbox') {
      input = `<input type="checkbox" name="${f.name}" id="${id}" ${f.value ? 'checked' : ''}>`;
    } else {
      input = `<input type="${f.type || 'text'}" name="${f.name}" id="${id}" value="${H.escape(f.value || '')}" placeholder="${H.escape(f.placeholder || '')}">`;
    }
    return `<div class="form-group${cls}"><label for="${id}">${H.escape(f.label)}</label>${input}</div>`;
  }).join('') + '</div>';
}

function renderComingSoon(title, desc) {
  return `<div class="coming-soon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
    <h3>${H.escape(title)}</h3>
    <p>${H.escape(desc)}</p>
  </div>`;
}

function initModalEvents() {
  document.getElementById('modal-close').onclick = () => Modal.hide();
  document.getElementById('modal-cancel').onclick = () => Modal.hide();
  document.getElementById('modal-save').onclick = () => Modal.confirm();
  document.getElementById('modal-overlay').onclick = e => { if (e.target === document.getElementById('modal-overlay')) Modal.hide(); };
  document.getElementById('confirm-no').onclick = () => Confirm.hide();
  document.getElementById('confirm-yes').onclick = () => { Confirm.confirm(); Confirm.hide(); };
  document.getElementById('confirm-overlay').onclick = e => { if (e.target === document.getElementById('confirm-overlay')) Confirm.hide(); };
}
