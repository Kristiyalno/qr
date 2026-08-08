'use strict';

// ── Sanity checks ──────────────────────────────────────────────────────────
if (typeof jsQR === 'undefined') {
  document.body.innerHTML = '<pre style="color:#ef4444;padding:20px;font-family:monospace">error: jsQR.min.js not loaded\nmake sure all files are committed to the repo</pre>';
  throw new Error('jsQR missing');
}

// ── Tab routing ────────────────────────────────────────────────────────────
const tabs  = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.page');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('page-' + tab.dataset.tab).classList.add('active');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// SCANNER
// ══════════════════════════════════════════════════════════════════════════

const sc = {
  dropZone:     document.getElementById('dropZone'),
  fileInput:    document.getElementById('fileInput'),
  cameraInput:  document.getElementById('cameraInput'),
  uploadBtn:    document.getElementById('uploadBtn'),
  cameraBtn:    document.getElementById('cameraBtn'),
  processing:   document.getElementById('processing'),
  processingTxt:document.getElementById('processingText'),
  resultList:   document.getElementById('resultList'),
  resultEmpty:  document.getElementById('resultEmpty'),
  resultLabel:  document.getElementById('resultLabel'),
  copyAll:      document.getElementById('copyAll'),
  clearAll:     document.getElementById('clearAll'),
  historyList:  document.getElementById('historyList'),
  historyCount: document.getElementById('historyCount'),
  previewWrap:  document.getElementById('previewWrap'),
  previewImg:   document.getElementById('previewImg'),
  canvas:       document.getElementById('qrCanvas'),
};
const scCtx = sc.canvas.getContext('2d');
const history = [];

function scToast(msg, type) { toast(msg, type); }

// QR decode
function decodeFile(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1500;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX/w, MAX/h);
        w = Math.round(w*r); h = Math.round(h*r);
      }
      sc.canvas.width = w; sc.canvas.height = h;
      scCtx.drawImage(img, 0, 0, w, h);
      const id = scCtx.getImageData(0, 0, w, h);
      URL.revokeObjectURL(url);
      let code = jsQR(id.data, id.width, id.height, { inversionAttempts: 'dontInvert' });
      if (!code) code = jsQR(id.data, id.width, id.height, { inversionAttempts: 'onlyInvert' });
      img.src = '';
      resolve(code ? code.data : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function detectType(v) {
  try {
    const u = new URL(v);
    if (['http:','https:','mailto:','tel:','sms:','ftp:'].includes(u.protocol)) return 'url';
  } catch(_) {}
  return 'text';
}

function showPreview(file) {
  const url = URL.createObjectURL(file);
  sc.previewImg.onload = () => URL.revokeObjectURL(url);
  sc.previewImg.src = url;
  sc.previewWrap.hidden = false;
}

function makeResBtn(label, onClick) {
  const b = document.createElement('button');
  b.className = 'res-btn'; b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function renderCard(value, type, filename, isError) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const hdr = document.createElement('div');
  hdr.className = 'result-card-header';
  if (filename) {
    const fn = document.createElement('span');
    fn.className = 'result-filename'; fn.textContent = filename; fn.title = filename;
    hdr.appendChild(fn);
  }
  const tag = document.createElement('span');
  tag.className = `result-tag ${isError ? 'error' : type}`;
  tag.textContent = isError ? 'no qr' : type;
  hdr.appendChild(tag);
  card.appendChild(hdr);

  const val = document.createElement('div');
  val.className = 'result-value' + (isError ? ' is-error' : (type === 'text' ? ' is-text' : ''));
  val.textContent = isError ? 'no QR code detected' : value;
  card.appendChild(val);

  if (!isError) {
    const acts = document.createElement('div');
    acts.className = 'result-actions';

    const copyBtn = makeResBtn('[ copy ]', async () => {
      await copyText(value);
      copyBtn.textContent = '[ copied ]'; copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = '[ copy ]'; copyBtn.classList.remove('copied'); }, 1600);
    });
    acts.appendChild(copyBtn);

    if (type === 'url') {
      const open = makeResBtn('[ open ]', () => window.open(value, '_blank', 'noopener,noreferrer'));
      open.classList.add('accent');
      acts.appendChild(open);
    } else {
      const search = makeResBtn('[ search ]', () =>
        window.open('https://www.google.com/search?q=' + encodeURIComponent(value), '_blank', 'noopener,noreferrer'));
      acts.appendChild(search);
    }
    card.appendChild(acts);
  }
  return card;
}

async function processFiles(files) {
  if (!files || !files.length) return;
  const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!imgs.length) { toast('no image files', 'error'); return; }

  showPreview(imgs[0]);
  sc.processing.hidden = false;
  sc.processingTxt.textContent = imgs.length > 1 ? `scanning ${imgs.length}...` : 'scanning...';
  sc.resultList.innerHTML = '';
  sc.resultEmpty.hidden = true;

  const decoded = [];
  for (const f of imgs) {
    const v = await decodeFile(f);
    const isErr = v === null;
    const type = isErr ? 'error' : detectType(v);
    decoded.push({ v, type, filename: f.name, isErr });
    if (!isErr) addHistory(v, type, f.name);
  }

  sc.processing.hidden = true;
  for (const d of decoded) sc.resultList.appendChild(renderCard(d.v, d.type, d.filename, d.isErr));

  const ok = decoded.filter(d => !d.isErr).length;
  sc.resultLabel.textContent = imgs.length === 1
    ? (ok ? 'result' : 'result — nothing found')
    : `result — ${ok}/${imgs.length}`;
  sc.copyAll.hidden = ok === 0;
  sc.clearAll.hidden = false;
  if (!ok) toast('no QR codes found', 'error');
}

function addHistory(value, type, filename) {
  history.unshift({ value, type, filename, time: new Date() });
  if (history.length > 50) history.pop();
  renderHistory();
}

function renderHistory() {
  sc.historyCount.textContent = `history — ${history.length} scan${history.length !== 1 ? 's' : ''}`;
  if (!history.length) {
    sc.historyList.innerHTML = '<div class="empty-row">no scans yet</div>';
    return;
  }
  sc.historyList.innerHTML = '';
  for (const e of history) {
    const row = document.createElement('div');
    row.className = 'history-row'; row.title = 'click to copy';
    const dot = document.createElement('div');
    dot.className = `history-dot ${e.type}`;
    const val = document.createElement('div');
    val.className = 'history-val'; val.textContent = e.value;
    const t = document.createElement('div');
    t.className = 'history-time'; t.textContent = relTime(e.time);
    row.append(dot, val, t);
    row.addEventListener('click', async () => { await copyText(e.value); toast('copied', 'success'); });
    sc.historyList.appendChild(row);
  }
}

function relTime(d) {
  const s = (Date.now() - d) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s/60) + 'm';
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

// Scanner events
let dragN = 0;
sc.dropZone.addEventListener('dragenter', e => { e.preventDefault(); dragN++; sc.dropZone.classList.add('drag-over'); });
sc.dropZone.addEventListener('dragleave', e => { e.preventDefault(); if (--dragN <= 0) { dragN = 0; sc.dropZone.classList.remove('drag-over'); } });
sc.dropZone.addEventListener('dragover', e => e.preventDefault());
sc.dropZone.addEventListener('drop', e => {
  e.preventDefault(); dragN = 0; sc.dropZone.classList.remove('drag-over');
  processFiles(e.dataTransfer.files);
});
sc.uploadBtn.addEventListener('click', e => { e.stopPropagation(); sc.fileInput.click(); });
sc.dropZone.addEventListener('click', e => {
  if (sc.uploadBtn.contains(e.target) || sc.cameraBtn.contains(e.target)) return;
  sc.fileInput.click();
});
sc.dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sc.fileInput.click(); } });
sc.fileInput.addEventListener('change', () => { if (sc.fileInput.files.length) { processFiles(sc.fileInput.files); sc.fileInput.value = ''; } });
sc.cameraBtn.addEventListener('click', e => { e.stopPropagation(); sc.cameraInput.click(); });
sc.cameraInput.addEventListener('change', () => { if (sc.cameraInput.files.length) { processFiles(sc.cameraInput.files); sc.cameraInput.value = ''; } });

document.addEventListener('paste', async e => {
  if (!document.getElementById('page-scanner').classList.contains('active')) return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  const imgs = Array.from(items).filter(i => i.type.startsWith('image/'));
  if (!imgs.length) return;
  e.preventDefault();
  const files = imgs.map((i, idx) => { const f = i.getAsFile(); return f ? new File([f], `pasted${imgs.length > 1 ? idx+1 : ''}.png`, { type: f.type }) : null; }).filter(Boolean);
  processFiles(files);
});

sc.copyAll.addEventListener('click', async () => {
  const vals = sc.resultList.querySelectorAll('.result-value:not(.is-error)');
  if (!vals.length) return;
  await copyText(Array.from(vals).map(v => v.textContent).join('\n'));
  toast('all copied', 'success');
});

sc.clearAll.addEventListener('click', () => {
  sc.resultList.innerHTML = '';
  sc.resultEmpty.hidden = false;
  sc.resultLabel.textContent = 'result';
  sc.copyAll.hidden = true;
  sc.clearAll.hidden = true;
  sc.previewWrap.hidden = true;
  sc.previewImg.src = '';
  history.length = 0;
  renderHistory();
  toast('cleared', 'info');
});

// Hide camera button on desktop
if (!/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && window.innerWidth < 900)) {
  sc.cameraBtn.style.display = 'none';
}

renderHistory();


// ══════════════════════════════════════════════════════════════════════════
// GENERATOR
// ══════════════════════════════════════════════════════════════════════════

const gn = {
  typeSelect: document.getElementById('genType'),
  fieldGroup: document.getElementById('fieldGroup'),
  fgHex: document.getElementById('fgHex'),
  fgR:   document.getElementById('fgR'),
  fgG:   document.getElementById('fgG'),
  fgB:   document.getElementById('fgB'),
  fgSwatch: document.getElementById('fgSwatch'),
  bgHex: document.getElementById('bgHex'),
  bgR:   document.getElementById('bgR'),
  bgG:   document.getElementById('bgG'),
  bgB:   document.getElementById('bgB'),
  bgSwatch: document.getElementById('bgSwatch'),
  ecc:         document.getElementById('genEcc'),
  size:        document.getElementById('genSize'),
  margin:      document.getElementById('genMargin'),
  radius:      document.getElementById('genRadius'),
  moduleStyle: document.getElementById('genModuleStyle'),
  addLabel:    document.getElementById('addLabel'),
  labelList:   document.getElementById('labelList'),
  canvas:      document.getElementById('genCanvas'),
  status:      document.getElementById('genStatus'),
  empty:       document.getElementById('genEmpty'),
  exportPNG:   document.getElementById('exportPNG'),
  exportSVG:   document.getElementById('exportSVG'),
  exportWEBP:  document.getElementById('exportWEBP'),
  exportJPEG:  document.getElementById('exportJPEG'),
  exportBMP:   document.getElementById('exportBMP'),
  copyQR:      document.getElementById('copyQR'),
};

// ── Content type schemas ───────────────────────────────────────────────────
const TYPES = {
  url:    { label: 'URL', fields: [{ id: 'url', label: 'URL', placeholder: 'https://example.com', type: 'text' }],
            build: f => f.url || '' },

  text:   { label: 'Text', fields: [{ id: 'text', label: 'Text', placeholder: 'Any text content', type: 'textarea' }],
            build: f => f.text || '' },

  email:  { label: 'Email', fields: [
              { id: 'to',      label: 'To',      placeholder: 'user@example.com', type: 'text' },
              { id: 'subject', label: 'Subject',  placeholder: 'Hello', type: 'text' },
              { id: 'body',    label: 'Body',     placeholder: 'Message...', type: 'textarea' },
            ], build: f => {
              if (!f.to) return '';
              let s = 'mailto:' + f.to;
              const p = [];
              if (f.subject) p.push('subject=' + encodeURIComponent(f.subject));
              if (f.body)    p.push('body='    + encodeURIComponent(f.body));
              return p.length ? s + '?' + p.join('&') : s;
            }},

  phone:  { label: 'Phone', fields: [{ id: 'phone', label: 'Phone number', placeholder: '+1234567890', type: 'text' }],
            build: f => f.phone ? 'tel:' + f.phone : '' },

  sms:    { label: 'SMS', fields: [
              { id: 'phone',   label: 'Phone number', placeholder: '+1234567890', type: 'text' },
              { id: 'message', label: 'Message',      placeholder: 'Text here', type: 'textarea' },
            ], build: f => {
              if (!f.phone) return '';
              return f.message ? `SMSTO:${f.phone}:${f.message}` : 'sms:' + f.phone;
            }},

  wifi:   { label: 'WiFi', fields: [
              { id: 'ssid', label: 'SSID (network name)', placeholder: 'MyNetwork', type: 'text' },
              { id: 'pass', label: 'Password', placeholder: 'password123', type: 'text' },
              { id: 'enc',  label: 'Encryption', type: 'select', options: ['WPA','WEP','nopass'] },
              { id: 'hidden', label: 'Hidden network', type: 'checkbox' },
            ], build: f => {
              if (!f.ssid) return '';
              const esc = s => s.replace(/([\\";,:])/g, '\\$1');
              return `WIFI:T:${f.enc||'WPA'};S:${esc(f.ssid)};P:${esc(f.pass||'')};${f.hidden==='true'?'H:true;':''};`;
            }},

  vcard:  { label: 'vCard', fields: [
              { id: 'name',    label: 'Full name',   placeholder: 'John Doe',           type: 'text' },
              { id: 'org',     label: 'Organization',placeholder: 'ACME Corp',           type: 'text' },
              { id: 'title',   label: 'Title',       placeholder: 'Engineer',            type: 'text' },
              { id: 'phone',   label: 'Phone',       placeholder: '+1234567890',          type: 'text' },
              { id: 'email',   label: 'Email',       placeholder: 'john@example.com',    type: 'text' },
              { id: 'url',     label: 'Website',     placeholder: 'https://example.com', type: 'text' },
              { id: 'address', label: 'Address',     placeholder: '123 Main St, City',   type: 'text' },
              { id: 'note',    label: 'Note',        placeholder: '...',                 type: 'textarea' },
            ], build: f => {
              if (!f.name) return '';
              const lines = ['BEGIN:VCARD','VERSION:3.0'];
              lines.push('FN:' + f.name);
              if (f.org)     lines.push('ORG:' + f.org);
              if (f.title)   lines.push('TITLE:' + f.title);
              if (f.phone)   lines.push('TEL:' + f.phone);
              if (f.email)   lines.push('EMAIL:' + f.email);
              if (f.url)     lines.push('URL:' + f.url);
              if (f.address) lines.push('ADR:;;' + f.address + ';;;;');
              if (f.note)    lines.push('NOTE:' + f.note);
              lines.push('END:VCARD');
              return lines.join('\n');
            }},

  geo:    { label: 'Geo location', fields: [
              { id: 'lat', label: 'Latitude',  placeholder: '48.8566', type: 'text' },
              { id: 'lng', label: 'Longitude', placeholder: '2.3522',  type: 'text' },
              { id: 'query', label: 'Label (optional)', placeholder: 'Eiffel Tower', type: 'text' },
            ], build: f => {
              if (!f.lat || !f.lng) return '';
              return f.query ? `geo:${f.lat},${f.lng}?q=${encodeURIComponent(f.query)}` : `geo:${f.lat},${f.lng}`;
            }},

  event:  { label: 'Calendar event', fields: [
              { id: 'summary',  label: 'Title',      placeholder: 'Meeting',               type: 'text' },
              { id: 'location', label: 'Location',   placeholder: 'Conference room',       type: 'text' },
              { id: 'dtstart',  label: 'Start',      placeholder: '',                      type: 'datetime-local' },
              { id: 'dtend',    label: 'End',        placeholder: '',                      type: 'datetime-local' },
              { id: 'desc',     label: 'Description',placeholder: '...',                   type: 'textarea' },
            ], build: f => {
              if (!f.summary) return '';
              const fmt = s => s ? s.replace(/[-:T]/g,'').slice(0,15) + 'Z' : '';
              const lines = ['BEGIN:VEVENT'];
              lines.push('SUMMARY:' + f.summary);
              if (f.location) lines.push('LOCATION:' + f.location);
              if (f.dtstart)  lines.push('DTSTART:' + fmt(f.dtstart));
              if (f.dtend)    lines.push('DTEND:'   + fmt(f.dtend));
              if (f.desc)     lines.push('DESCRIPTION:' + f.desc);
              lines.push('END:VEVENT');
              return lines.join('\n');
            }},

  crypto: { label: 'Crypto address', fields: [
              { id: 'coin',    label: 'Coin', type: 'select', options: ['bitcoin','ethereum','litecoin','monero','other'] },
              { id: 'address', label: 'Address', placeholder: '1A1zP1eP5...', type: 'text' },
              { id: 'amount',  label: 'Amount (optional)', placeholder: '0.01', type: 'text' },
              { id: 'label',   label: 'Label (optional)',  placeholder: 'Donation', type: 'text' },
            ], build: f => {
              if (!f.address) return '';
              const coin = f.coin === 'other' ? '' : (f.coin || 'bitcoin');
              if (!coin) return f.address;
              let uri = `${coin}:${f.address}`;
              const p = [];
              if (f.amount) p.push('amount=' + f.amount);
              if (f.label)  p.push('label='  + encodeURIComponent(f.label));
              return p.length ? uri + '?' + p.join('&') : uri;
            }},
};

// ── Build field UI ─────────────────────────────────────────────────────────
// Store field values per type so switching tabs doesn't wipe state
const fieldState = {};

function buildFields(typeName) {
  const schema = TYPES[typeName];
  if (!schema) return;
  if (!fieldState[typeName]) fieldState[typeName] = {};
  const state = fieldState[typeName];

  gn.fieldGroup.innerHTML = '';

  for (const field of schema.fields) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = field.label;
    lbl.htmlFor = 'gf_' + field.id;
    row.appendChild(lbl);

    let el;
    if (field.type === 'textarea') {
      el = document.createElement('textarea');
      el.className = 'inp';
      el.rows = 3;
    } else if (field.type === 'select') {
      el = document.createElement('select');
      el.className = 'sel';
      for (const opt of field.options) {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        el.appendChild(o);
      }
    } else if (field.type === 'checkbox') {
      el = document.createElement('input');
      el.type = 'checkbox';
      // restore
      if (state[field.id] === 'true') el.checked = true;
      el.addEventListener('change', () => {
        state[field.id] = String(el.checked);
        generateQR();
      });
      row.appendChild(el);
      gn.fieldGroup.appendChild(row);
      continue;
    } else {
      el = document.createElement('input');
      el.className = 'inp';
      el.type = field.type || 'text';
      if (field.placeholder) el.placeholder = field.placeholder;
    }

    el.id = 'gf_' + field.id;
    // Restore saved value
    if (state[field.id] !== undefined) el.value = state[field.id];

    el.addEventListener('input', () => { state[field.id] = el.value; generateQR(); });
    if (el.tagName === 'SELECT') el.addEventListener('change', () => { state[field.id] = el.value; generateQR(); });
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && el.tagName !== 'TEXTAREA') { e.preventDefault(); el.blur(); } if (e.key === 'Escape') { e.preventDefault(); el.blur(); } });
    }

    row.appendChild(el);
    gn.fieldGroup.appendChild(row);
  }

  generateQR();
}

function getFieldValues(typeName) {
  return fieldState[typeName] || {};
}

// ── Text label management ──────────────────────────────────────────────────
let labelId = 0;
const labels = []; // { id, text, side, align, fontSize, offsetX, offsetY, hex, r, g, b }

function addLabelRow(initData) {
  const id = ++labelId;
  const data = initData || {
    id, text: '', side: 'bottom', align: 'center',
    fontSize: 24, offsetX: 0, offsetY: 0, hex: '#000000', r: 0, g: 0, b: 0
  };
  data.id = id;
  labels.push(data);

  const row = document.createElement('div');
  row.className = 'label-row';
  row.dataset.id = id;

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'label-row-header';
  const title = document.createElement('span');
  title.className = 'label-row-title';
  title.textContent = `label ${id}`;
  const rmBtn = document.createElement('button');
  rmBtn.className = 'btn danger';
  rmBtn.textContent = '[ remove ]';
  rmBtn.addEventListener('click', () => {
    const idx = labels.findIndex(l => l.id === id);
    if (idx !== -1) labels.splice(idx, 1);
    row.remove();
    generateQR();
  });
  hdr.append(title, rmBtn);
  row.appendChild(hdr);

  // Text input
  const textRow = document.createElement('div');
  textRow.className = 'field-row';
  const textLbl = document.createElement('label');
  textLbl.className = 'field-label';
  textLbl.textContent = 'text';
  const textInp = document.createElement('input');
  textInp.className = 'inp';
  textInp.type = 'text';
  textInp.placeholder = 'Label text...';
  textInp.value = data.text || '';
  textInp.addEventListener('input', () => { data.text = textInp.value; generateQR(); });
  textInp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); textInp.blur(); } });
  textRow.append(textLbl, textInp);
  row.appendChild(textRow);

  // Grid: side, align, font size
  const grid = document.createElement('div');
  grid.className = 'label-grid';

  function makeOpt(labelTxt, tag) {
    const f = document.createElement('div');
    f.className = 'opt-field';
    const l = document.createElement('span');
    l.className = 'field-label';
    l.textContent = labelTxt;
    f.append(l, tag);
    return f;
  }

  const sideEl = document.createElement('select');
  sideEl.className = 'sel';
  ['top','bottom','left','right'].forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === data.side) o.selected = true;
    sideEl.appendChild(o);
  });
  sideEl.addEventListener('change', () => { data.side = sideEl.value; generateQR(); });

  const alignEl = document.createElement('select');
  alignEl.className = 'sel';
  ['left','center','right'].forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === data.align) o.selected = true;
    alignEl.appendChild(o);
  });
  alignEl.addEventListener('change', () => { data.align = alignEl.value; generateQR(); });

  const sizeEl = document.createElement('input');
  sizeEl.className = 'inp'; sizeEl.type = 'number';
  sizeEl.value = data.fontSize; sizeEl.min = 6; sizeEl.max = 200; sizeEl.step = 1;
  sizeEl.addEventListener('input', () => { data.fontSize = parseInt(sizeEl.value)||16; generateQR(); });
  sizeEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); sizeEl.blur(); } });

  const oxEl = document.createElement('input');
  oxEl.className = 'inp'; oxEl.type = 'number';
  oxEl.value = data.offsetX; oxEl.min = -500; oxEl.max = 500;
  oxEl.addEventListener('input', () => { data.offsetX = parseInt(oxEl.value)||0; generateQR(); });
  oxEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); oxEl.blur(); } });

  const oyEl = document.createElement('input');
  oyEl.className = 'inp'; oyEl.type = 'number';
  oyEl.value = data.offsetY; oyEl.min = -500; oyEl.max = 500;
  oyEl.addEventListener('input', () => { data.offsetY = parseInt(oyEl.value)||0; generateQR(); });
  oyEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); oyEl.blur(); } });

  grid.append(
    makeOpt('side', sideEl),
    makeOpt('align', alignEl),
    makeOpt('font size (px)', sizeEl),
    makeOpt('offset X', oxEl),
    makeOpt('offset Y', oyEl),
  );
  row.appendChild(grid);

  // Color
  const colorDiv = document.createElement('div');
  colorDiv.className = 'label-color-row';
  const swatchEl = document.createElement('div');
  swatchEl.className = 'color-swatch';
  swatchEl.style.background = data.hex;
  const hexEl = document.createElement('input');
  hexEl.className = 'inp color-hex';
  hexEl.value = data.hex; hexEl.maxLength = 9; hexEl.spellcheck = false;

  swatchEl.addEventListener('click', e => {
    e.stopPropagation();
    openColorPicker(hexEl, swatchEl, () => {
      const rgb = hexToRgb(hexEl.value) || {r:0,g:0,b:0};
      data.hex = hexEl.value; data.r = rgb.r; data.g = rgb.g; data.b = rgb.b;
      generateQR();
    });
  });

  hexEl.addEventListener('input', () => {
    const rgb = hexToRgb(hexEl.value);
    if (!rgb) return;
    data.hex = hexEl.value; data.r = rgb.r; data.g = rgb.g; data.b = rgb.b;
    swatchEl.style.background = hexEl.value;
    generateQR();
  });
  hexEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); hexEl.blur(); } });

  const cLbl = document.createElement('span');
  cLbl.className = 'field-label'; cLbl.textContent = 'color';
  colorDiv.append(cLbl, swatchEl, hexEl);
  row.appendChild(colorDiv);

  gn.labelList.appendChild(row);
  generateQR();
}

gn.addLabel.addEventListener('click', () => addLabelRow());

// ── QR generation ──────────────────────────────────────────────────────────
let lastGoodContent = null;
let lastQRObj = null; // store qr object for SVG export

function drawRoundedRect(ctx, x, y, w, h, r) {
  if (r <= 0) { ctx.fillRect(x, y, w, h); return; }
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  ctx.closePath();
  ctx.fill();
}

function drawModule(ctx, x, y, w, h, style, radius) {
  if (style === 'dots') {
    ctx.beginPath();
    const cx = x + w/2, cy = y + h/2, rd = Math.min(w, h) * 0.45;
    ctx.arc(cx, cy, rd, 0, Math.PI*2);
    ctx.fill();
  } else if (style === 'round') {
    drawRoundedRect(ctx, x, y, w, h, radius);
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

function generateQR() {
  if (typeof qrcode === 'undefined') return;

  const typeName = gn.typeSelect.value;
  const schema = TYPES[typeName];
  const content = schema.build(getFieldValues(typeName));

  if (!content.trim()) {
    gn.canvas.style.display = 'none';
    gn.empty.style.display  = 'flex';
    gn.status.textContent    = '—';
    lastGoodContent = null; lastQRObj = null;
    return;
  }

  const eccChar = gn.ecc.value;

  try {
    const qr = qrcode(0, eccChar);
    qr.addData(content, 'Byte');
    qr.make();
    lastQRObj = qr;

    const size        = Math.max(64, Math.min(4096, parseInt(gn.size.value) || 512));
    const marginMods  = Math.max(0,  Math.min(20,   parseInt(gn.margin.value) || 4));
    const radiusPct   = Math.max(0, Math.min(100, parseFloat(gn.radius.value) || 0));
    const moduleStyle = gn.moduleStyle.value;
    const mods        = qr.getModuleCount();
    const total       = mods + marginMods * 2;
    const cell        = size / total;
    const radius      = cell * (radiusPct / 100);

    const fg = hexToRgb(gn.fgHex.value) || { r:0,   g:0,   b:0   };
    const bg = hexToRgb(gn.bgHex.value) || { r:255, g:255, b:255 };

    // Calculate extra padding needed for text labels
    const pad = { top:0, bottom:0, left:0, right:0 };
    for (const lbl of labels) {
      if (!lbl.text) continue;
      const fs = lbl.fontSize || 24;
      const gap = fs * 0.3 + Math.abs(lbl.offsetY || 0);
      const lineH = fs * 1.4;
      if (lbl.side === 'top')    pad.top    = Math.max(pad.top,    lineH + gap);
      if (lbl.side === 'bottom') pad.bottom = Math.max(pad.bottom, lineH + gap);
      if (lbl.side === 'left')   pad.left   = Math.max(pad.left,   lineH + gap);
      if (lbl.side === 'right')  pad.right  = Math.max(pad.right,  lineH + gap);
    }

    const totalW = size + pad.left + pad.right;
    const totalH = size + pad.top  + pad.bottom;

    const cvs = gn.canvas;
    cvs.width  = totalW;
    cvs.height = totalH;
    const ctx  = cvs.getContext('2d');

    // Background (full canvas including label area)
    ctx.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`;
    ctx.fillRect(0, 0, totalW, totalH);

    // Draw QR modules offset by padding
    ctx.fillStyle = `rgb(${fg.r},${fg.g},${fg.b})`;
    const qrOriginX = pad.left;
    const qrOriginY = pad.top;

    for (let r = 0; r < mods; r++) {
      for (let c = 0; c < mods; c++) {
        if (qr.isDark(r, c)) {
          const x = qrOriginX + Math.round((c + marginMods) * cell);
          const y = qrOriginY + Math.round((r + marginMods) * cell);
          const w = Math.round((c + marginMods + 1) * cell) - (x - qrOriginX);
          const h = Math.round((r + marginMods + 1) * cell) - (y - qrOriginY);
          drawModule(ctx, x, y, w, h, moduleStyle, radius);
        }
      }
    }

    // Draw text labels
    for (const lbl of labels) {
      if (!lbl.text) continue;
      const fs = lbl.fontSize || 24;
      ctx.font = `${fs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = lbl.hex || '#000000';
      ctx.textBaseline = 'middle';

      const ox = lbl.offsetX || 0;
      const oy = lbl.offsetY || 0;
      const gap = fs * 0.3;

      let tx, ty;
      switch (lbl.side) {
        case 'top':
          ty = pad.top - gap - fs/2 + oy;
          tx = qrOriginX + size/2 + ox;
          break;
        case 'bottom':
          ty = qrOriginY + size + gap + fs/2 + oy;
          tx = qrOriginX + size/2 + ox;
          break;
        case 'left':
          // Rotated: save/restore ctx
          ctx.save();
          tx = pad.left - gap - fs/2 + oy;
          ty = qrOriginY + size/2 + ox;
          ctx.translate(tx, ty);
          ctx.rotate(-Math.PI/2);
          ctx.textAlign = lbl.align || 'center';
          ctx.fillText(lbl.text, 0, 0);
          ctx.restore();
          continue;
        case 'right':
          ctx.save();
          tx = qrOriginX + size + pad.right - gap + oy;
          ty = qrOriginY + size/2 + ox;
          ctx.translate(tx, ty);
          ctx.rotate(Math.PI/2);
          ctx.textAlign = lbl.align || 'center';
          ctx.fillText(lbl.text, 0, 0);
          ctx.restore();
          continue;
      }

      switch (lbl.align || 'center') {
        case 'left':   ctx.textAlign = 'left';   tx = qrOriginX + ox; break;
        case 'right':  ctx.textAlign = 'right';  tx = qrOriginX + size + ox; break;
        default:       ctx.textAlign = 'center';
      }

      ctx.fillText(lbl.text, tx, ty);
    }

    cvs.style.display      = 'block';
    gn.empty.style.display = 'none';
    gn.status.textContent  = `${mods}×${mods} — ${content.length} chars`;
    lastGoodContent = content;

  } catch(e) {
    gn.canvas.style.display = 'none';
    gn.empty.style.display  = 'flex';
    gn.status.textContent    = 'error: ' + (e.message || 'content too long');
    lastGoodContent = null; lastQRObj = null;
  }
}

// ── Color handling ─────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const m = hex.trim().replace('#','');
  if (m.length === 3) {
    const r = parseInt(m[0]+m[0],16), g = parseInt(m[1]+m[1],16), b = parseInt(m[2]+m[2],16);
    if (isNaN(r)||isNaN(g)||isNaN(b)) return null;
    return {r,g,b};
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0,2),16), g = parseInt(m.slice(2,4),16), b = parseInt(m.slice(4,6),16);
    if (isNaN(r)||isNaN(g)||isNaN(b)) return null;
    return {r,g,b};
  }
  return null;
}

function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Wire up hex/rgb inputs for fg and bg
function wireColorInputs(hexEl, rEl, gEl, bEl, swatchEl, onUpdate) {
  hexEl.addEventListener('input', () => {
    const rgb = hexToRgb(hexEl.value);
    if (!rgb) return;
    rEl.value = rgb.r; gEl.value = rgb.g; bEl.value = rgb.b;
    swatchEl.style.background = hexEl.value;
    onUpdate();
  });
  [rEl, gEl, bEl].forEach(el => {
    el.addEventListener('input', () => {
      const r = clamp(parseInt(rEl.value)||0, 0, 255);
      const g = clamp(parseInt(gEl.value)||0, 0, 255);
      const b = clamp(parseInt(bEl.value)||0, 0, 255);
      const hex = rgbToHex(r, g, b);
      hexEl.value = hex;
      swatchEl.style.background = hex;
      onUpdate();
    });
  });
  [hexEl, rEl, gEl, bEl].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); el.blur(); } });
  });
  swatchEl.addEventListener('click', e => {
    e.stopPropagation();
    openColorPicker(hexEl, swatchEl, onUpdate);
  });
}

wireColorInputs(gn.fgHex, gn.fgR, gn.fgG, gn.fgB, gn.fgSwatch, generateQR);
wireColorInputs(gn.bgHex, gn.bgR, gn.bgG, gn.bgB, gn.bgSwatch, generateQR);

// ── Color picker ───────────────────────────────────────────────────────────
const cp = {
  el:        document.getElementById('colorPicker'),
  svCanvas:  document.getElementById('cpSV'),
  svCursor:  document.getElementById('cpSVCursor'),
  hueCanvas: document.getElementById('cpHue'),
  hueCursor: document.getElementById('cpHueCursor'),
  alphaCanvas: document.getElementById('cpAlpha'),
  alphaCursor: document.getElementById('cpAlphaCursor'),
  preview:   document.getElementById('cpPreview'),
  hexOut:    document.getElementById('cpHexOut'),
};

let cpState = { h: 0, s: 1, v: 0, a: 1 };
let cpTarget = null; // { hexEl, swatchEl, onUpdate }
let cpSvCtx, cpHueCtx, cpAlphaCtx;

function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
  switch(i%6) {
    case 0: r=v;g=t;b=p; break; case 1: r=q;g=v;b=p; break;
    case 2: r=p;g=v;b=t; break; case 3: r=p;g=q;b=v; break;
    case 4: r=t;g=p;b=v; break; case 5: r=v;g=p;b=q; break;
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
}

function rgbToHsv(r, g, b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0, s=max===0?0:d/max, v=max;
  if(d!==0){
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return {h,s,v};
}

function drawSV() {
  const w = cp.svCanvas.width, h = cp.svCanvas.height;
  if (!cpSvCtx) cpSvCtx = cp.svCanvas.getContext('2d');
  const ctx = cpSvCtx;
  const hueColor = hsvToRgb(cpState.h, 1, 1);
  const hueStr = `rgb(${hueColor.r},${hueColor.g},${hueColor.b})`;
  const gH = ctx.createLinearGradient(0,0,w,0);
  gH.addColorStop(0,'#fff'); gH.addColorStop(1,hueStr);
  ctx.fillStyle = gH; ctx.fillRect(0,0,w,h);
  const gV = ctx.createLinearGradient(0,0,0,h);
  gV.addColorStop(0,'rgba(0,0,0,0)'); gV.addColorStop(1,'#000');
  ctx.fillStyle = gV; ctx.fillRect(0,0,w,h);
  // Position cursor
  const cx = cpState.s * w, cy = (1-cpState.v) * h;
  cp.svCursor.style.left = cx + 'px';
  cp.svCursor.style.top  = cy + 'px';
}

function drawHue() {
  const w = cp.hueCanvas.width, h = cp.hueCanvas.height;
  if (!cpHueCtx) cpHueCtx = cp.hueCanvas.getContext('2d');
  const ctx = cpHueCtx;
  const g = ctx.createLinearGradient(0,0,w,0);
  for (let i=0; i<=360; i+=60) g.addColorStop(i/360, `hsl(${i},100%,50%)`);
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  cp.hueCursor.style.marginLeft = (cpState.h * w - 4) + 'px';
}

function drawAlpha() {
  const w = cp.alphaCanvas.width, h = cp.alphaCanvas.height;
  if (!cpAlphaCtx) cpAlphaCtx = cp.alphaCanvas.getContext('2d');
  const ctx = cpAlphaCtx;
  // Checkerboard
  for (let x=0; x<w; x+=8) for (let y=0; y<h; y+=8) {
    ctx.fillStyle = ((x/8 + y/8) % 2 === 0) ? '#ccc' : '#fff';
    ctx.fillRect(x, y, 8, 8);
  }
  const rgb = hsvToRgb(cpState.h, cpState.s, cpState.v);
  const g = ctx.createLinearGradient(0,0,w,0);
  g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
  g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  cp.alphaCursor.style.marginLeft = (cpState.a * w - 4) + 'px';
}

function updateCpPreview() {
  const rgb = hsvToRgb(cpState.h, cpState.s, cpState.v);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hexA = cpState.a < 1 ? hex + Math.round(cpState.a*255).toString(16).padStart(2,'0') : hex;
  cp.preview.style.background = `rgba(${rgb.r},${rgb.g},${rgb.b},${cpState.a})`;
  cp.hexOut.textContent = hexA;

  if (cpTarget) {
    cpTarget.hexEl.value = hex;
    cpTarget.swatchEl.style.background = hex;
    // Update RGB fields
    const container = cpTarget.hexEl.closest('.color-inputs');
    if (container) {
      const nums = container.querySelectorAll('.color-num');
      if (nums.length >= 3) { nums[0].value = rgb.r; nums[1].value = rgb.g; nums[2].value = rgb.b; }
    }
    cpTarget.onUpdate();
  }
}

function refreshCp() {
  drawSV(); drawHue(); drawAlpha(); updateCpPreview();
}

function openColorPicker(hexEl, swatchEl, onUpdate) {
  cpTarget = { hexEl, swatchEl, onUpdate };
  // Init state from current hex
  const rgb = hexToRgb(hexEl.value) || {r:0,g:0,b:0};
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  cpState.h = hsv.h; cpState.s = hsv.s; cpState.v = hsv.v; cpState.a = 1;

  // Position near swatch
  const rect = swatchEl.getBoundingClientRect();
  cp.el.hidden = false;
  // Prefer below, but flip up if too close to bottom
  let top = rect.bottom + 4, left = rect.left;
  if (top + 280 > window.innerHeight) top = rect.top - 280 - 4;
  if (left + 222 > window.innerWidth) left = window.innerWidth - 226;
  cp.el.style.top  = Math.max(4, top)  + 'px';
  cp.el.style.left = Math.max(4, left) + 'px';

  refreshCp();
}

function closeCp() { cp.el.hidden = true; cpTarget = null; }

// Mouse/touch handling for color picker canvases
function makeDrag(canvas, onPos) {
  function handle(e) {
    const rect = canvas.getBoundingClientRect();
    const cl = e.touches ? e.touches[0].clientX : e.clientX;
    const ct = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clamp((cl - rect.left) / rect.width,  0, 1);
    const y = clamp((ct - rect.top)  / rect.height, 0, 1);
    onPos(x, y);
    refreshCp();
  }
  let down = false;
  canvas.addEventListener('mousedown',  e => { down = true; handle(e); });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); handle(e); }, { passive: false });
  window.addEventListener('mousemove',  e => { if (down) handle(e); });
  window.addEventListener('touchmove',  e => { if (down) { e.preventDefault(); handle(e); } }, { passive: false });
  window.addEventListener('mouseup',    () => down = false);
  window.addEventListener('touchend',   () => down = false);
}

makeDrag(cp.svCanvas, (x, y) => { cpState.s = x; cpState.v = 1 - y; });
makeDrag(cp.hueCanvas, (x) => { cpState.h = x; drawSV(); drawAlpha(); });
makeDrag(cp.alphaCanvas, (x) => { cpState.a = x; });

document.addEventListener('click', e => {
  if (!cp.el.hidden && !cp.el.contains(e.target) && !e.target.classList.contains('color-swatch')) {
    closeCp();
  }
});

// ── Export ─────────────────────────────────────────────────────────────────
function downloadCanvas(ext, type, quality) {
  if (gn.canvas.style.display === 'none') { toast('generate a QR code first', 'error'); return; }
  const url = gn.canvas.toDataURL(type, quality);
  const a = document.createElement('a');
  a.href = url; a.download = 'qr.' + ext;
  a.click();
}

function exportSVG() {
  if (!lastGoodContent || !lastQRObj) { toast('generate a QR code first', 'error'); return; }

  const qr          = lastQRObj;
  const mods        = qr.getModuleCount();
  const marginMods  = Math.max(0, parseInt(gn.margin.value) || 4);
  const radiusPct   = Math.max(0, Math.min(100, parseFloat(gn.radius.value) || 0));
  const moduleStyle = gn.moduleStyle.value;
  const cell        = 1;
  const qrSize      = mods + marginMods * 2;

  const fg = hexToRgb(gn.fgHex.value) || {r:0,g:0,b:0};
  const bg = hexToRgb(gn.bgHex.value) || {r:255,g:255,b:255};
  const fgStr = `rgb(${fg.r},${fg.g},${fg.b})`;
  const bgStr = `rgb(${bg.r},${bg.g},${bg.b})`;

  // Calculate label padding (same logic as canvas)
  const pad = { top:0, bottom:0, left:0, right:0 };
  const fontSize_scale = qrSize / (parseInt(gn.size.value) || 512);
  for (const lbl of labels) {
    if (!lbl.text) continue;
    const fs = (lbl.fontSize || 24) * fontSize_scale;
    const gap = fs * 0.3 + Math.abs(lbl.offsetY || 0) * fontSize_scale;
    const lineH = fs * 1.4;
    if (lbl.side === 'top')    pad.top    = Math.max(pad.top,    lineH + gap);
    if (lbl.side === 'bottom') pad.bottom = Math.max(pad.bottom, lineH + gap);
    if (lbl.side === 'left')   pad.left   = Math.max(pad.left,   lineH + gap);
    if (lbl.side === 'right')  pad.right  = Math.max(pad.right,  lineH + gap);
  }

  const totalW = qrSize + pad.left + pad.right;
  const totalH = qrSize + pad.top  + pad.bottom;
  const r      = cell * (radiusPct / 100);

  function svgModule(c, row) {
    const x = pad.left + (c + marginMods) * cell;
    const y = pad.top  + (row + marginMods) * cell;
    const w = cell, h = cell;
    if (moduleStyle === 'dots') {
      const cx = x + w/2, cy = y + h/2, rd = Math.min(w,h)*0.45;
      return `<circle cx="${cx}" cy="${cy}" r="${rd}"/>`;
    } else if (moduleStyle === 'round' && r > 0) {
      const rr = Math.min(r, w/2, h/2);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" ry="${rr}"/>`;
    } else {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    }
  }

  let modules = '';
  for (let row = 0; row < mods; row++)
    for (let c = 0; c < mods; c++)
      if (qr.isDark(row, c)) modules += svgModule(c, row);

  // Text labels in SVG
  let textEls = '';
  for (const lbl of labels) {
    if (!lbl.text) continue;
    const fs = (lbl.fontSize || 24) * fontSize_scale;
    const gap = fs * 0.3;
    const ox = (lbl.offsetX || 0) * fontSize_scale;
    const oy = (lbl.offsetY || 0) * fontSize_scale;
    const color = lbl.hex || '#000000';
    const qrOriginX = pad.left, qrOriginY = pad.top;
    const alignMap = { left:'start', center:'middle', right:'end' };
    const anchor = alignMap[lbl.align||'center'] || 'middle';

    let tx, ty, transform = '';
    switch (lbl.side) {
      case 'top':
        ty = pad.top - gap - fs/2 + oy;
        tx = qrOriginX + qrSize/2 + ox;
        break;
      case 'bottom':
        ty = qrOriginY + qrSize + gap + fs/2 + oy;
        tx = qrOriginX + qrSize/2 + ox;
        break;
      case 'left':
        tx = pad.left - gap - fs/2 + oy;
        ty = qrOriginY + qrSize/2 + ox;
        transform = `transform="rotate(-90,${tx},${ty})"`;
        break;
      case 'right':
        tx = qrOriginX + qrSize + pad.right - gap + oy;
        ty = qrOriginY + qrSize/2 + ox;
        transform = `transform="rotate(90,${tx},${ty})"`;
        break;
    }
    if (lbl.side === 'top' || lbl.side === 'bottom') {
      if (lbl.align === 'left')  tx = qrOriginX + ox;
      else if (lbl.align === 'right') tx = qrOriginX + qrSize + ox;
    }
    textEls += `<text x="${tx}" y="${ty}" font-size="${fs}" fill="${color}" text-anchor="${anchor}" dominant-baseline="middle" font-family="Inter,system-ui,sans-serif" ${transform}>${lbl.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" shape-rendering="${moduleStyle === 'square' ? 'crispEdges' : 'auto'}">
<rect width="${totalW}" height="${totalH}" fill="${bgStr}"/>
<g fill="${fgStr}">${modules}</g>
${textEls}
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'qr.svg'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportBMP() {
  // Draw onto a fresh canvas and export as BMP via data manipulation
  // BMP isn't natively supported by toDataURL, so we write raw BMP bytes
  if (gn.canvas.style.display === 'none') { toast('generate a QR code first', 'error'); return; }
  const src = gn.canvas;
  const w = src.width, h = src.height;
  const ctx = src.getContext('2d');
  const id  = ctx.getImageData(0, 0, w, h);

  // BMP file structure
  const rowSize = Math.ceil(w * 3 / 4) * 4;
  const pixelArraySize = rowSize * h;
  const fileSize = 54 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  // File header
  view.setUint8(0, 0x42); view.setUint8(1, 0x4D); // 'BM'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true);
  // DIB header
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, -h, true); // negative = top-down
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true); view.setUint32(50, 0, true);

  // Pixel data (BGR, no alpha)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i  = (y * w + x) * 4;
      const bi = 54 + y * rowSize + x * 3;
      view.setUint8(bi,   id.data[i+2]); // B
      view.setUint8(bi+1, id.data[i+1]); // G
      view.setUint8(bi+2, id.data[i]);   // R
    }
  }

  const blob = new Blob([buf], { type: 'image/bmp' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'qr.bmp'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

gn.exportPNG.addEventListener('click',  () => downloadCanvas('png',  'image/png'));
gn.exportWEBP.addEventListener('click', () => downloadCanvas('webp', 'image/webp', 0.95));
gn.exportJPEG.addEventListener('click', () => downloadCanvas('jpg',  'image/jpeg', 0.95));
gn.exportSVG.addEventListener('click',  () => exportSVG());
gn.exportBMP.addEventListener('click',  () => exportBMP());

gn.copyQR.addEventListener('click', async () => {
  if (gn.canvas.style.display === 'none') { toast('generate a QR code first', 'error'); return; }
  try {
    gn.canvas.toBlob(async blob => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('image copied', 'success');
      } catch(e) {
        toast('copy failed (browser may not support image copy)', 'error');
      }
    }, 'image/png');
  } catch(e) {
    toast('copy not supported in this browser', 'error');
  }
});

// ── Draft-input system ─────────────────────────────────────────────────────
// Inputs with class "draft-inp" show a pending state while the user is typing
// and only commit (trigger generateQR) on blur, Enter, or Esc.
// All other generator number inputs also blur on Enter/Esc.

function makeDraftInput(el, onCommit) {
  let committed = el.value;

  el.addEventListener('input', () => {
    if (el.value !== committed) el.classList.add('is-draft');
    else el.classList.remove('is-draft');
  });

  function commit() {
    committed = el.value;
    el.classList.remove('is-draft');
    el.blur();
    onCommit(el.value);
  }

  function revert() {
    el.value = committed;
    el.classList.remove('is-draft');
    el.blur();
  }

  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); revert(); }
  });

  el.addEventListener('blur', () => {
    if (el.classList.contains('is-draft')) commit();
  });
}

// Attach draft behavior to radius
makeDraftInput(gn.radius, val => {
  const n = parseFloat(val);
  if (!isNaN(n)) generateQR();
});

// All other static generator number inputs: just blur on Enter/Esc, regenerate on blur
function makeCommitOnBlur(el) {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); el.blur(); }
  });
  el.addEventListener('blur', generateQR);
  // Remove the live 'input' listener trigger (we regenerate on blur instead)
}

// Re-wire size and margin to commit-on-blur instead of live input
makeCommitOnBlur(gn.size);
makeCommitOnBlur(gn.margin);

// Wire type select + other controls
gn.typeSelect.addEventListener('change', () => buildFields(gn.typeSelect.value));
gn.ecc.addEventListener('change', generateQR);
gn.moduleStyle.addEventListener('change', generateQR);

// Init generator
buildFields(gn.typeSelect.value);


// ══════════════════════════════════════════════════════════════════════════
// SHARED
// ══════════════════════════════════════════════════════════════════════════

let toastCont = null;
function toast(msg, type = 'info', dur = 2000) {
  if (!toastCont) { toastCont = document.createElement('div'); toastCont.className = 'toast-container'; document.body.appendChild(toastCont); }
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg;
  toastCont.appendChild(el);
  setTimeout(() => el.remove(), dur);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch(_) {}
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  return true;
}
