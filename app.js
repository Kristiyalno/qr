'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  history: [],        // { value, type, time, filename }
  historyOpen: false,
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const dropZone      = document.getElementById('dropZone');
const dropOverlay   = document.getElementById('dropOverlay');
const fileInput     = document.getElementById('fileInput');
const cameraInput   = document.getElementById('cameraInput');
const uploadBtn     = document.getElementById('uploadBtn');
const cameraBtn     = document.getElementById('cameraBtn');
const processing    = document.getElementById('processing');
const processingTxt = document.getElementById('processingText');
const results       = document.getElementById('results');
const resultList    = document.getElementById('resultList');
const resultsLabel  = document.getElementById('resultsLabel');
const copyAllBtn    = document.getElementById('copyAll');
const historyToggle = document.getElementById('historyToggle');
const historyBadge  = document.getElementById('historyBadge');
const historyPanel  = document.getElementById('historyPanel');
const historyList   = document.getElementById('historyList');
const historyClose  = document.getElementById('historyClose');
const clearAllBtn   = document.getElementById('clearAll');
const canvas        = document.getElementById('qrCanvas');
const ctx           = canvas.getContext('2d');

// ── Toast ──────────────────────────────────────────────────────────────────
let toastContainer = null;

function toast(msg, type = 'info', duration = 2400) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── QR decode ─────────────────────────────────────────────────────────────
function decodeImageFile(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Scale down large images for speed (max 1500px on longest side)
      const MAX = 1500;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width  = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      URL.revokeObjectURL(url);

      // Try normal scan
      let code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      // Try inverted if first attempt fails (handles dark-bg QR codes)
      if (!code) {
        code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'onlyInvert',
        });
      }

      img.src = '';
      resolve(code ? code.data : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// ── Type detection ─────────────────────────────────────────────────────────
function detectType(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:' ||
        url.protocol === 'mailto:' || url.protocol === 'tel:' ||
        url.protocol === 'sms:' || url.protocol === 'ftp:') {
      return 'url';
    }
  } catch (_) {}
  return 'text';
}

// ── Render results ─────────────────────────────────────────────────────────
function renderResultCard(value, type, filename, isError = false) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const meta = document.createElement('div');
  meta.className = 'result-meta';

  if (filename) {
    const fn = document.createElement('span');
    fn.className = 'result-filename';
    fn.title = filename;
    fn.textContent = filename;
    meta.appendChild(fn);
  }

  const badge = document.createElement('span');
  badge.className = `result-type-badge ${isError ? 'error' : type}`;
  badge.textContent = isError ? 'No QR found' : (type === 'url' ? 'URL' : 'Text');
  meta.appendChild(badge);
  card.appendChild(meta);

  const valueEl = document.createElement('div');
  valueEl.className = `result-value ${isError ? 'error-text' : ''}`;
  valueEl.textContent = isError ? 'No QR code detected in this image.' : value;
  card.appendChild(valueEl);

  if (!isError) {
    const actions = document.createElement('div');
    actions.className = 'result-actions';

    // Copy button
    const copyBtn = makeResultBtn(
      iconCopy(), 'Copy',
      async () => {
        await copyToClipboard(value);
        copyBtn.classList.add('copied');
        copyBtn.querySelector('span').textContent = 'Copied';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.querySelector('span').textContent = 'Copy';
        }, 1800);
      }
    );
    actions.appendChild(copyBtn);

    // Open URL button
    if (type === 'url') {
      const openBtn = makeResultBtn(iconOpen(), 'Open URL', () => {
        window.open(value, '_blank', 'noopener,noreferrer');
      });
      openBtn.classList.add('primary');
      actions.appendChild(openBtn);
    }

    // Search button (for text)
    if (type === 'text') {
      const searchBtn = makeResultBtn(iconSearch(), 'Search', () => {
        const query = encodeURIComponent(value);
        window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
      });
      actions.appendChild(searchBtn);
    }

    card.appendChild(actions);
  }

  return card;
}

function makeResultBtn(icon, label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'result-btn';
  btn.appendChild(icon);
  const sp = document.createElement('span');
  sp.textContent = label;
  btn.appendChild(sp);
  btn.addEventListener('click', onClick);
  return btn;
}

// ── Icons (inline SVG helpers) ─────────────────────────────────────────────
function svgIcon(path, size = 13) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = path;
  return svg;
}

function iconCopy() {
  return svgIcon(`<rect x="4.5" y="4.5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/>
    <path d="M9.5 4.5V3a.5.5 0 0 0-.5-.5H2.5A.5.5 0 0 0 2 3v6.5a.5.5 0 0 0 .5.5H4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`);
}

function iconOpen() {
  return svgIcon(`<path d="M6 2H2.5A.5.5 0 0 0 2 2.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M8 2h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 2L7 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`);
}

function iconSearch() {
  return svgIcon(`<circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.3"/>
    <path d="M9.5 9.5L12 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`);
}

// ── Process files ──────────────────────────────────────────────────────────
async function processFiles(files) {
  if (!files || files.length === 0) return;

  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    toast('No image files found.', 'error');
    return;
  }

  // Show processing
  processing.hidden = false;
  processingTxt.textContent = imageFiles.length > 1
    ? `Scanning ${imageFiles.length} images...`
    : 'Scanning...';

  // Clear old results
  resultList.innerHTML = '';

  // Decode all
  const decoded = [];
  for (const file of imageFiles) {
    const value = await decodeImageFile(file);
    const isError = value === null;
    const type = isError ? 'error' : detectType(value);
    decoded.push({ value, type, filename: file.name, isError });

    // Add to history if successful
    if (!isError) {
      addToHistory(value, type, file.name);
    }
  }

  processing.hidden = true;

  // Render
  for (const item of decoded) {
    const card = renderResultCard(item.value, item.type, item.filename, item.isError);
    resultList.appendChild(card);
  }

  const successCount = decoded.filter(d => !d.isError).length;
  const label = imageFiles.length === 1
    ? (successCount === 1 ? '1 result' : 'No QR code found')
    : `${successCount} / ${imageFiles.length} decoded`;
  resultsLabel.textContent = label;

  results.hidden = false;
  clearAllBtn.hidden = false;

  if (successCount === 0 && imageFiles.length > 0) {
    toast('No QR codes found in the image(s).', 'error');
  } else if (successCount > 0 && imageFiles.length > 1) {
    toast(`${successCount} QR code${successCount > 1 ? 's' : ''} decoded.`, 'success');
  }
}

// ── History ────────────────────────────────────────────────────────────────
function addToHistory(value, type, filename) {
  const entry = {
    value,
    type,
    filename,
    time: new Date(),
  };
  state.history.unshift(entry);
  if (state.history.length > 50) state.history.pop();
  updateHistoryBadge();
  if (state.historyOpen) renderHistory();
}

function updateHistoryBadge() {
  const count = state.history.length;
  historyBadge.textContent = count;
  historyBadge.hidden = count === 0;
}

function renderHistory() {
  historyList.innerHTML = '';
  if (state.history.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No scans yet.</p>';
    return;
  }
  for (const entry of state.history) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.title = 'Click to copy';

    const dot = document.createElement('div');
    dot.className = `history-item-type ${entry.type}`;
    item.appendChild(dot);

    const text = document.createElement('div');
    text.className = 'history-item-text';
    text.textContent = entry.value;
    item.appendChild(text);

    const time = document.createElement('div');
    time.className = 'history-item-time';
    time.textContent = formatTime(entry.time);
    item.appendChild(time);

    item.addEventListener('click', async () => {
      await copyToClipboard(entry.value);
      toast('Copied from history.', 'success');
    });

    historyList.appendChild(item);
  }
}

function formatTime(date) {
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Clipboard ──────────────────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}

// ── Copy all ───────────────────────────────────────────────────────────────
copyAllBtn.addEventListener('click', async () => {
  const cards = resultList.querySelectorAll('.result-value:not(.error-text)');
  if (cards.length === 0) return;
  const values = Array.from(cards).map(c => c.textContent).join('\n');
  await copyToClipboard(values);
  toast('All results copied.', 'success');
});

// ── Drag and drop ──────────────────────────────────────────────────────────
let dragCounter = 0;

dropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropZone.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  processFiles(files);
});

// ── Click to upload ────────────────────────────────────────────────────────
uploadBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropZone.addEventListener('click', (e) => {
  // Avoid triggering when buttons inside are clicked
  if (e.target === uploadBtn || e.target === cameraBtn || uploadBtn.contains(e.target) || cameraBtn.contains(e.target)) return;
  fileInput.click();
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    processFiles(fileInput.files);
    fileInput.value = '';
  }
});

// ── Camera ─────────────────────────────────────────────────────────────────
cameraBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  cameraInput.click();
});

cameraInput.addEventListener('change', () => {
  if (cameraInput.files.length > 0) {
    processFiles(cameraInput.files);
    cameraInput.value = '';
  }
});

// ── Paste ──────────────────────────────────────────────────────────────────
document.addEventListener('paste', async (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;

  const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
  if (imageItems.length === 0) return;

  e.preventDefault();
  const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
  // Give them sensible names
  const namedFiles = files.map((file, i) => {
    return new File([file], `pasted-image${files.length > 1 ? `-${i + 1}` : ''}.png`, { type: file.type });
  });
  processFiles(namedFiles);
});

// ── History panel ──────────────────────────────────────────────────────────
historyToggle.addEventListener('click', () => {
  state.historyOpen = !state.historyOpen;
  historyPanel.hidden = !state.historyOpen;
  if (state.historyOpen) renderHistory();
});

historyClose.addEventListener('click', () => {
  state.historyOpen = false;
  historyPanel.hidden = true;
});

// ── Clear all ──────────────────────────────────────────────────────────────
clearAllBtn.addEventListener('click', () => {
  results.hidden = true;
  resultList.innerHTML = '';
  clearAllBtn.hidden = true;
  state.history = [];
  updateHistoryBadge();
  if (state.historyOpen) renderHistory();
  toast('Cleared.', 'info');
});

// ── Init ───────────────────────────────────────────────────────────────────
// Hide camera button on desktop (not useful without capture attribute support)
// On mobile, the camera input with capture="environment" triggers camera
function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
}

if (!isMobileDevice()) {
  cameraBtn.style.display = 'none';
}
