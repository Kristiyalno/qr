'use strict';

if (typeof jsQR === 'undefined') {
  document.body.innerHTML = '<pre style="color:#ef4444;padding:20px;font-family:monospace">error: jsQR.min.js not loaded</pre>';
  throw new Error('jsQR missing');
}

// ── Shared utils ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.trim().replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0]+h[0],16), g = parseInt(h[1]+h[1],16), b = parseInt(h[2]+h[2],16);
    return (isNaN(r)||isNaN(g)||isNaN(b)) ? null : {r,g,b};
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return (isNaN(r)||isNaN(g)||isNaN(b)) ? null : {r,g,b};
  }
  return null;
}
function rgbToHex(r,g,b) { return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return; } catch(_){}
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
}

let toastEl = null;
function toast(msg, type='', dur=2000) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className='toasts'; document.body.appendChild(toastEl); }
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  toastEl.appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// blur on Enter/Esc
function blurOnKey(el) {
  el.addEventListener('keydown', e => { if (e.key==='Enter'||e.key==='Escape') { e.preventDefault(); el.blur(); } });
}

// ── Tab routing ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('page-' + tab.dataset.tab).classList.add('active');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// SCANNER
// ══════════════════════════════════════════════════════════════════════════

const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const cameraInput  = document.getElementById('cameraInput');
const uploadBtn    = document.getElementById('uploadBtn');
const cameraBtn    = document.getElementById('cameraBtn');
const processing   = document.getElementById('processing');
const procText     = document.getElementById('processingText');
const resultList   = document.getElementById('resultList');
const resultEmpty  = document.getElementById('resultEmpty');
const resultLabel  = document.getElementById('resultLabel');
const copyAllBtn   = document.getElementById('copyAll');
const clearAllBtn  = document.getElementById('clearAll');
const historyList  = document.getElementById('historyList');
const historyCount = document.getElementById('historyCount');
const previewWrap  = document.getElementById('previewWrap');
const previewImg   = document.getElementById('previewImg');
const qrCanvas     = document.getElementById('qrCanvas');
const qrCtx        = qrCanvas.getContext('2d');

const scanHistory = [];

function decodeFile(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1500;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
      qrCanvas.width = w; qrCanvas.height = h;
      qrCtx.drawImage(img, 0, 0, w, h);
      const id = qrCtx.getImageData(0, 0, w, h);
      URL.revokeObjectURL(url);
      let code = jsQR(id.data, id.width, id.height, { inversionAttempts: 'dontInvert' });
      if (!code) code = jsQR(id.data, id.width, id.height, { inversionAttempts: 'onlyInvert' });
      img.src = ''; resolve(code ? code.data : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function detectType(v) {
  try { const u = new URL(v); if (['http:','https:','mailto:','tel:','sms:','ftp:'].includes(u.protocol)) return 'url'; } catch(_){}
  return 'text';
}

function showPreview(file) {
  const url = URL.createObjectURL(file);
  previewImg.onload = () => URL.revokeObjectURL(url);
  previewImg.src = url; previewWrap.hidden = false;
}

function makeBtn(label, onClick, extraClass='') {
  const b = document.createElement('button');
  b.className = 'r-btn ' + extraClass; b.textContent = label;
  b.addEventListener('click', onClick); return b;
}

function renderCard(value, type, filename, isError) {
  const card = document.createElement('div'); card.className = 'result-card';
  const hdr = document.createElement('div'); hdr.className = 'result-card-hdr';
  if (filename) {
    const fn = document.createElement('span'); fn.className = 'r-filename'; fn.textContent = filename; fn.title = filename;
    hdr.appendChild(fn);
  }
  const tag = document.createElement('span'); tag.className = `r-tag ${isError?'error':type}`;
  tag.textContent = isError ? 'no qr' : type; hdr.appendChild(tag); card.appendChild(hdr);

  const val = document.createElement('div');
  val.className = 'r-val' + (isError?' is-error':type==='text'?' is-text':'');
  val.textContent = isError ? 'no QR code detected' : value; card.appendChild(val);

  if (!isError) {
    const acts = document.createElement('div'); acts.className = 'r-actions';
    const cpBtn = makeBtn('[ copy ]', async () => {
      await copyText(value); cpBtn.textContent='[ copied ]'; cpBtn.classList.add('copied');
      setTimeout(()=>{ cpBtn.textContent='[ copy ]'; cpBtn.classList.remove('copied'); }, 1600);
    });
    acts.appendChild(cpBtn);
    if (type === 'url') {
      acts.appendChild(makeBtn('[ open ]', () => window.open(value,'_blank','noopener,noreferrer'), 'acc'));
    } else {
      acts.appendChild(makeBtn('[ search ]', () => window.open('https://www.google.com/search?q='+encodeURIComponent(value),'_blank','noopener,noreferrer')));
    }
    card.appendChild(acts);
  }
  return card;
}

async function processFiles(files) {
  const imgs = Array.from(files||[]).filter(f=>f.type.startsWith('image/'));
  if (!imgs.length) { toast('no image files', 'bad'); return; }
  showPreview(imgs[0]);
  processing.hidden = false; procText.textContent = imgs.length > 1 ? `scanning ${imgs.length}...` : 'scanning...';
  resultList.innerHTML = ''; resultEmpty.hidden = true;
  const decoded = [];
  for (const f of imgs) {
    const v = await decodeFile(f); const isErr = v===null; const type = isErr?'error':detectType(v);
    decoded.push({v,type,filename:f.name,isErr}); if (!isErr) addHistory(v,type,f.name);
  }
  processing.hidden = true;
  for (const d of decoded) resultList.appendChild(renderCard(d.v,d.type,d.filename,d.isErr));
  const ok = decoded.filter(d=>!d.isErr).length;
  resultLabel.textContent = imgs.length===1 ? (ok?'result':'result — nothing found') : `result — ${ok}/${imgs.length}`;
  copyAllBtn.hidden = !ok; clearAllBtn.hidden = false;
  if (!ok) toast('no QR codes found','bad');
}

function addHistory(value, type, filename) {
  scanHistory.unshift({value,type,filename,time:new Date()});
  if (scanHistory.length>50) scanHistory.pop();
  renderHistory();
}

function renderHistory() {
  historyCount.textContent = `history — ${scanHistory.length} scan${scanHistory.length!==1?'s':''}`;
  if (!scanHistory.length) { historyList.innerHTML='<div class="empty-hint">no scans yet</div>'; return; }
  historyList.innerHTML = '';
  for (const e of scanHistory) {
    const row = document.createElement('div'); row.className='history-row'; row.title='click to copy';
    const dot = document.createElement('div'); dot.className=`h-dot ${e.type}`;
    const val = document.createElement('div'); val.className='h-val'; val.textContent=e.value;
    const t   = document.createElement('div'); t.className='h-time'; t.textContent=relTime(e.time);
    row.append(dot,val,t);
    row.addEventListener('click', async ()=>{ await copyText(e.value); toast('copied','ok'); });
    historyList.appendChild(row);
  }
}

function relTime(d) {
  const s=(Date.now()-d)/1000; if(s<60) return 'now'; if(s<3600) return Math.floor(s/60)+'m';
  return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

// Scanner events
let dragN = 0;
dropZone.addEventListener('dragenter', e=>{ e.preventDefault(); dragN++; dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', e=>{ e.preventDefault(); if(--dragN<=0){dragN=0;dropZone.classList.remove('drag-over');} });
dropZone.addEventListener('dragover',  e=>e.preventDefault());
dropZone.addEventListener('drop', e=>{ e.preventDefault(); dragN=0; dropZone.classList.remove('drag-over'); processFiles(e.dataTransfer.files); });
uploadBtn.addEventListener('click', e=>{ e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', e=>{ if(uploadBtn.contains(e.target)||cameraBtn.contains(e.target)) return; fileInput.click(); });
dropZone.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', ()=>{ if(fileInput.files.length){ processFiles(fileInput.files); fileInput.value=''; } });
cameraBtn.addEventListener('click', e=>{ e.stopPropagation(); cameraInput.click(); });
cameraInput.addEventListener('change', ()=>{ if(cameraInput.files.length){ processFiles(cameraInput.files); cameraInput.value=''; } });

document.addEventListener('paste', async e=>{
  if (!document.getElementById('page-scanner').classList.contains('active')) return;
  const items = e.clipboardData&&e.clipboardData.items; if(!items) return;
  const imgs = Array.from(items).filter(i=>i.type.startsWith('image/')); if(!imgs.length) return;
  e.preventDefault();
  const files = imgs.map((i,idx)=>{ const f=i.getAsFile(); return f?new File([f],`pasted${imgs.length>1?idx+1:''}.png`,{type:f.type}):null; }).filter(Boolean);
  processFiles(files);
});

copyAllBtn.addEventListener('click', async ()=>{
  const vals = resultList.querySelectorAll('.r-val:not(.is-error)'); if(!vals.length) return;
  await copyText(Array.from(vals).map(v=>v.textContent).join('\n')); toast('all copied','ok');
});

clearAllBtn.addEventListener('click', ()=>{
  resultList.innerHTML=''; resultEmpty.hidden=false; resultLabel.textContent='result';
  copyAllBtn.hidden=true; clearAllBtn.hidden=true; previewWrap.hidden=true; previewImg.src='';
  scanHistory.length=0; renderHistory(); toast('cleared');
});

if (!/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) cameraBtn.style.display='none';
renderHistory();


// ══════════════════════════════════════════════════════════════════════════
// COLOR PICKER
// ══════════════════════════════════════════════════════════════════════════

const cpEl     = document.getElementById('colorPicker');
const cpSV     = document.getElementById('cpSV');
const cpSVCur  = document.getElementById('cpSVCursor');
const cpHue    = document.getElementById('cpHue');
const cpHueCur = document.getElementById('cpHueCursor');
const cpAlpha  = document.getElementById('cpAlpha');
const cpAlCur  = document.getElementById('cpAlphaCursor');
const cpPrev   = document.getElementById('cpPreview');
const cpHexOut = document.getElementById('cpHexOut');

let cpState  = {h:0,s:1,v:0,a:1};
let cpTarget = null;
let cpSvCtx, cpHCtx, cpACtx;

function hsvToRgb(h,s,v) {
  let r,g,b; const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
  switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;case 5:r=v;g=p;b=q;break;}
  return {r:Math.round(r*255),g:Math.round(g*255),b:Math.round(b*255)};
}
function rgbToHsv(r,g,b) {
  r/=255;g/=255;b/=255; const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0,s=max===0?0:d/max,vv=max;
  if(d){switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h/=6;}
  return {h,s,v:vv};
}

function cpDrawSV() {
  if(!cpSvCtx) cpSvCtx=cpSV.getContext('2d');
  const w=cpSV.width,h=cpSV.height,ctx=cpSvCtx;
  const hc=hsvToRgb(cpState.h,1,1);
  const gH=ctx.createLinearGradient(0,0,w,0); gH.addColorStop(0,'#fff'); gH.addColorStop(1,`rgb(${hc.r},${hc.g},${hc.b})`);
  ctx.fillStyle=gH; ctx.fillRect(0,0,w,h);
  const gV=ctx.createLinearGradient(0,0,0,h); gV.addColorStop(0,'rgba(0,0,0,0)'); gV.addColorStop(1,'#000');
  ctx.fillStyle=gV; ctx.fillRect(0,0,w,h);
  cpSVCur.style.left=cpState.s*w+'px'; cpSVCur.style.top=(1-cpState.v)*h+'px';
}
function cpDrawHue() {
  if(!cpHCtx) cpHCtx=cpHue.getContext('2d');
  const w=cpHue.width,h=cpHue.height,ctx=cpHCtx;
  const g=ctx.createLinearGradient(0,0,w,0);
  for(let i=0;i<=360;i+=60) g.addColorStop(i/360,`hsl(${i},100%,50%)`);
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  cpHueCur.style.marginLeft=(cpState.h*w-4)+'px';
}
function cpDrawAlpha() {
  if(!cpACtx) cpACtx=cpAlpha.getContext('2d');
  const w=cpAlpha.width,h=cpAlpha.height,ctx=cpACtx;
  for(let x=0;x<w;x+=8) for(let y=0;y<h;y+=8){ctx.fillStyle=((x/8+y/8)%2===0)?'#ccc':'#fff';ctx.fillRect(x,y,8,8);}
  const rgb=hsvToRgb(cpState.h,cpState.s,cpState.v);
  const g=ctx.createLinearGradient(0,0,w,0);
  g.addColorStop(0,`rgba(${rgb.r},${rgb.g},${rgb.b},0)`); g.addColorStop(1,`rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  cpAlCur.style.marginLeft=(cpState.a*w-4)+'px';
}
function cpRefresh() {
  cpDrawSV(); cpDrawHue(); cpDrawAlpha();
  const rgb=hsvToRgb(cpState.h,cpState.s,cpState.v);
  const hex=rgbToHex(rgb.r,rgb.g,rgb.b);
  cpPrev.style.background=`rgba(${rgb.r},${rgb.g},${rgb.b},${cpState.a})`;
  cpHexOut.textContent=hex;
  if(cpTarget) {
    cpTarget.hexEl.value=hex; cpTarget.swatchEl.style.background=hex;
    const ci=cpTarget.hexEl.closest('.color-inputs')||cpTarget.hexEl.closest('.label-color');
    if(ci){ const n=ci.querySelectorAll('.c-num'); if(n.length>=3){n[0].value=rgb.r;n[1].value=rgb.g;n[2].value=rgb.b;} }
    cpTarget.onUpdate();
  }
}

function openColorPicker(hexEl, swatchEl, onUpdate) {
  cpTarget={hexEl,swatchEl,onUpdate};
  const rgb=hexToRgb(hexEl.value)||{r:0,g:0,b:0}; const hsv=rgbToHsv(rgb.r,rgb.g,rgb.b);
  cpState.h=hsv.h; cpState.s=hsv.s; cpState.v=hsv.v; cpState.a=1;
  const rect=swatchEl.getBoundingClientRect();
  cpEl.hidden=false;
  let top=rect.bottom+4,left=rect.left;
  if(top+300>window.innerHeight) top=rect.top-300-4;
  if(left+222>window.innerWidth) left=window.innerWidth-226;
  cpEl.style.top=Math.max(4,top)+'px'; cpEl.style.left=Math.max(4,left)+'px';
  cpRefresh();
}

function cpDrag(canvas, onPos) {
  let down=false;
  function handle(e) {
    const r=canvas.getBoundingClientRect();
    const cx=e.touches?e.touches[0].clientX:e.clientX, cy=e.touches?e.touches[0].clientY:e.clientY;
    onPos(clamp((cx-r.left)/r.width,0,1), clamp((cy-r.top)/r.height,0,1));
    cpRefresh();
  }
  canvas.addEventListener('mousedown', e=>{ down=true; handle(e); });
  canvas.addEventListener('touchstart', e=>{ e.preventDefault(); handle(e); },{passive:false});
  window.addEventListener('mousemove', e=>{ if(down) handle(e); });
  window.addEventListener('touchmove', e=>{ if(down){e.preventDefault();handle(e);} },{passive:false});
  window.addEventListener('mouseup', ()=>down=false);
  window.addEventListener('touchend', ()=>down=false);
}

cpDrag(cpSV,    (x,y)=>{ cpState.s=x; cpState.v=1-y; });
cpDrag(cpHue,   (x)=>{ cpState.h=x; cpDrawSV(); cpDrawAlpha(); });
cpDrag(cpAlpha, (x)=>{ cpState.a=x; });

document.addEventListener('click', e=>{
  if(!cpEl.hidden && !cpEl.contains(e.target) && !e.target.classList.contains('swatch')) cpEl.hidden=true;
});


// ══════════════════════════════════════════════════════════════════════════
// GENERATOR
// ══════════════════════════════════════════════════════════════════════════

const genType    = document.getElementById('genType');
const fieldGroup = document.getElementById('fieldGroup');
const fgHex=document.getElementById('fgHex'), fgR=document.getElementById('fgR'), fgG=document.getElementById('fgG'), fgB=document.getElementById('fgB'), fgSwatch=document.getElementById('fgSwatch');
const bgHex=document.getElementById('bgHex'), bgR=document.getElementById('bgR'), bgG=document.getElementById('bgG'), bgB=document.getElementById('bgB'), bgSwatch=document.getElementById('bgSwatch');
const genEcc     = document.getElementById('genEcc');
const genSize    = document.getElementById('genSize');
const genMargin  = document.getElementById('genMargin');
const genRadius  = document.getElementById('genRadius');
const genMStyle  = document.getElementById('genModuleStyle');
const addLabelBtn= document.getElementById('addLabel');
const labelList  = document.getElementById('labelList');
const genCanvas  = document.getElementById('genCanvas');
const genStatus  = document.getElementById('genStatus');
const genEmpty   = document.getElementById('genEmpty');

// ── Content schemas ────────────────────────────────────────────────────────
const TYPES = {
  url:    { fields:[{id:'url',label:'URL',placeholder:'https://example.com',type:'text'}],
            build:f=>f.url||'' },
  text:   { fields:[{id:'text',label:'Text',placeholder:'Any text content',type:'textarea'}],
            build:f=>f.text||'' },
  email:  { fields:[{id:'to',label:'To',placeholder:'user@example.com',type:'text'},{id:'subject',label:'Subject',placeholder:'Hello',type:'text'},{id:'body',label:'Body',placeholder:'Message...',type:'textarea'}],
            build:f=>{ if(!f.to) return ''; let s='mailto:'+f.to,p=[]; if(f.subject) p.push('subject='+encodeURIComponent(f.subject)); if(f.body) p.push('body='+encodeURIComponent(f.body)); return p.length?s+'?'+p.join('&'):s; }},
  phone:  { fields:[{id:'phone',label:'Phone number',placeholder:'+1234567890',type:'text'}],
            build:f=>f.phone?'tel:'+f.phone:'' },
  sms:    { fields:[{id:'phone',label:'Phone number',placeholder:'+1234567890',type:'text'},{id:'message',label:'Message',placeholder:'Text here',type:'textarea'}],
            build:f=>{ if(!f.phone) return ''; return f.message?`SMSTO:${f.phone}:${f.message}`:'sms:'+f.phone; }},
  wifi:   { fields:[{id:'ssid',label:'SSID',placeholder:'MyNetwork',type:'text'},{id:'pass',label:'Password',placeholder:'password123',type:'text'},{id:'enc',label:'Encryption',type:'select',options:['WPA','WEP','nopass']},{id:'hidden',label:'Hidden network',type:'checkbox'}],
            build:f=>{ if(!f.ssid) return ''; const e=s=>s.replace(/([\\";,:])/g,'\\$1'); return `WIFI:T:${f.enc||'WPA'};S:${e(f.ssid)};P:${e(f.pass||'')};${f.hidden==='true'?'H:true;':''};`; }},
  vcard:  { fields:[{id:'name',label:'Full name',placeholder:'John Doe',type:'text'},{id:'org',label:'Organization',placeholder:'ACME Corp',type:'text'},{id:'title',label:'Title',placeholder:'Engineer',type:'text'},{id:'phone',label:'Phone',placeholder:'+1234567890',type:'text'},{id:'email',label:'Email',placeholder:'john@example.com',type:'text'},{id:'url',label:'Website',placeholder:'https://example.com',type:'text'},{id:'address',label:'Address',placeholder:'123 Main St, City',type:'text'},{id:'note',label:'Note',placeholder:'...',type:'textarea'}],
            build:f=>{ if(!f.name) return ''; const l=['BEGIN:VCARD','VERSION:3.0','FN:'+f.name]; if(f.org)l.push('ORG:'+f.org);if(f.title)l.push('TITLE:'+f.title);if(f.phone)l.push('TEL:'+f.phone);if(f.email)l.push('EMAIL:'+f.email);if(f.url)l.push('URL:'+f.url);if(f.address)l.push('ADR:;;'+f.address+';;;;');if(f.note)l.push('NOTE:'+f.note);l.push('END:VCARD');return l.join('\n'); }},
  geo:    { fields:[{id:'lat',label:'Latitude',placeholder:'48.8566',type:'text'},{id:'lng',label:'Longitude',placeholder:'2.3522',type:'text'},{id:'query',label:'Label (optional)',placeholder:'Eiffel Tower',type:'text'}],
            build:f=>{ if(!f.lat||!f.lng) return ''; return f.query?`geo:${f.lat},${f.lng}?q=${encodeURIComponent(f.query)}`:`geo:${f.lat},${f.lng}`; }},
  event:  { fields:[{id:'summary',label:'Title',placeholder:'Meeting',type:'text'},{id:'location',label:'Location',placeholder:'Conference room',type:'text'},{id:'dtstart',label:'Start',placeholder:'',type:'datetime-local'},{id:'dtend',label:'End',placeholder:'',type:'datetime-local'},{id:'desc',label:'Description',placeholder:'...',type:'textarea'}],
            build:f=>{ if(!f.summary) return ''; const fmt=s=>s?s.replace(/[-:T]/g,'').slice(0,15)+'Z':''; const l=['BEGIN:VEVENT','SUMMARY:'+f.summary]; if(f.location)l.push('LOCATION:'+f.location);if(f.dtstart)l.push('DTSTART:'+fmt(f.dtstart));if(f.dtend)l.push('DTEND:'+fmt(f.dtend));if(f.desc)l.push('DESCRIPTION:'+f.desc);l.push('END:VEVENT');return l.join('\n'); }},
  crypto: { fields:[{id:'coin',label:'Coin',type:'select',options:['bitcoin','ethereum','litecoin','monero','other']},{id:'address',label:'Address',placeholder:'1A1zP1eP5...',type:'text'},{id:'amount',label:'Amount (optional)',placeholder:'0.01',type:'text'},{id:'label',label:'Label (optional)',placeholder:'Donation',type:'text'}],
            build:f=>{ if(!f.address) return ''; const coin=f.coin==='other'?'':(f.coin||'bitcoin'); let uri=coin?`${coin}:${f.address}`:f.address,p=[]; if(f.amount)p.push('amount='+f.amount);if(f.label)p.push('label='+encodeURIComponent(f.label));return p.length?uri+'?'+p.join('&'):uri; }},
};

const fieldState = {};

function buildFields(typeName) {
  const schema = TYPES[typeName]; if(!schema) return;
  if(!fieldState[typeName]) fieldState[typeName]={};
  const state = fieldState[typeName];
  fieldGroup.innerHTML='';
  for(const field of schema.fields) {
    const row=document.createElement('div'); row.className='field-row';
    const lbl=document.createElement('label'); lbl.className='field-label'; lbl.textContent=field.label; lbl.htmlFor='gf_'+field.id;
    row.appendChild(lbl);
    let el;
    if(field.type==='textarea'){ el=document.createElement('textarea'); el.className='inp'; el.rows=3; }
    else if(field.type==='select'){ el=document.createElement('select'); el.className='sel'; for(const o of field.options){const op=document.createElement('option');op.value=o;op.textContent=o;el.appendChild(op);} }
    else if(field.type==='checkbox'){
      el=document.createElement('input'); el.type='checkbox';
      if(state[field.id]==='true') el.checked=true;
      el.addEventListener('change',()=>{ state[field.id]=String(el.checked); generateQR(); });
      row.appendChild(el); fieldGroup.appendChild(row); continue;
    } else { el=document.createElement('input'); el.className='inp'; el.type=field.type||'text'; if(field.placeholder) el.placeholder=field.placeholder; }
    el.id='gf_'+field.id;
    if(state[field.id]!==undefined) el.value=state[field.id];
    el.addEventListener('input',()=>{ state[field.id]=el.value; generateQR(); });
    if(el.tagName==='SELECT') el.addEventListener('change',()=>{ state[field.id]=el.value; generateQR(); });
    if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') blurOnKey(el);
    row.appendChild(el); fieldGroup.appendChild(row);
  }
  generateQR();
}

function getFields(typeName) { return fieldState[typeName]||{}; }

// ── Color input wiring ─────────────────────────────────────────────────────
function wireColor(hexEl, rEl, gEl, bEl, swatchEl, onUpdate) {
  hexEl.addEventListener('input',()=>{ const rgb=hexToRgb(hexEl.value); if(!rgb) return; rEl.value=rgb.r;gEl.value=rgb.g;bEl.value=rgb.b; swatchEl.style.background=hexEl.value; onUpdate(); });
  [rEl,gEl,bEl].forEach(el=>el.addEventListener('input',()=>{ const r=clamp(parseInt(rEl.value)||0,0,255),g=clamp(parseInt(gEl.value)||0,0,255),b=clamp(parseInt(bEl.value)||0,0,255),hex=rgbToHex(r,g,b); hexEl.value=hex; swatchEl.style.background=hex; onUpdate(); }));
  [hexEl,rEl,gEl,bEl].forEach(el=>blurOnKey(el));
  swatchEl.addEventListener('click',e=>{ e.stopPropagation(); openColorPicker(hexEl,swatchEl,onUpdate); });
}
wireColor(fgHex,fgR,fgG,fgB,fgSwatch,generateQR);
wireColor(bgHex,bgR,bgG,bgB,bgSwatch,generateQR);

// ── Draft input (commits on blur) ──────────────────────────────────────────
function makeDraft(el, onCommit) {
  let committed=el.value;
  el.addEventListener('input',()=>{ el.classList.toggle('draft', el.value!==committed); });
  function commit(){ committed=el.value; el.classList.remove('draft'); onCommit(el.value); }
  function revert(){ el.value=committed; el.classList.remove('draft'); }
  el.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();el.blur();} if(e.key==='Escape'){e.preventDefault();revert();el.blur();} });
  el.addEventListener('blur',()=>{ if(el.classList.contains('draft')) commit(); });
}

makeDraft(genRadius, ()=>generateQR());
makeDraft(genSize,   ()=>generateQR());
makeDraft(genMargin, ()=>generateQR());

// ── Text labels ────────────────────────────────────────────────────────────
let labelIdCtr=0;
const labels=[];

function addLabelRow(init) {
  const id=++labelIdCtr;
  const data=init||{id,text:'',side:'bottom',align:'center',fontSize:24,offsetX:0,offsetY:0,hex:'#000000',r:0,g:0,b:0};
  data.id=id; labels.push(data);

  const card=document.createElement('div'); card.className='label-card'; card.dataset.id=id;
  const hdr=document.createElement('div'); hdr.className='label-card-hdr';
  const ttl=document.createElement('span'); ttl.className='label-card-title'; ttl.textContent='label '+id;
  const rm=document.createElement('button'); rm.className='btn err'; rm.textContent='[ remove ]';
  rm.addEventListener('click',()=>{ labels.splice(labels.findIndex(l=>l.id===id),1); card.remove(); generateQR(); });
  hdr.append(ttl,rm); card.appendChild(hdr);

  // Text
  const tr=document.createElement('div'); tr.className='field-row';
  const tl=document.createElement('label'); tl.className='field-label'; tl.textContent='text';
  const ti=document.createElement('input'); ti.className='inp'; ti.type='text'; ti.placeholder='Label text...'; ti.value=data.text||'';
  ti.addEventListener('input',()=>{ data.text=ti.value; generateQR(); }); blurOnKey(ti);
  tr.append(tl,ti); card.appendChild(tr);

  // Grid
  const grid=document.createElement('div'); grid.className='label-grid';
  function optField(labelTxt, el) { const f=document.createElement('div'); f.className='opt-field'; const l=document.createElement('span'); l.className='field-label'; l.textContent=labelTxt; f.append(l,el); return f; }
  function mkSel(opts, val, onChange) { const s=document.createElement('select'); s.className='sel'; opts.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;if(o===val)op.selected=true;s.appendChild(op);}); s.addEventListener('change',()=>onChange(s.value)); return s; }
  function mkNum(val, min, max, onChange) { const i=document.createElement('input'); i.className='inp'; i.type='number'; i.value=val; i.min=min; i.max=max; i.addEventListener('input',()=>onChange(i.value)); blurOnKey(i); return i; }

  grid.append(
    optField('side',   mkSel(['top','bottom','left','right'], data.side, v=>{data.side=v;generateQR();})),
    optField('align',  mkSel(['left','center','right'], data.align, v=>{data.align=v;generateQR();})),
    optField('font size', mkNum(data.fontSize,6,200,v=>{data.fontSize=parseInt(v)||16;generateQR();})),
    optField('offset X',  mkNum(data.offsetX,-500,500,v=>{data.offsetX=parseInt(v)||0;generateQR();})),
    optField('offset Y',  mkNum(data.offsetY,-500,500,v=>{data.offsetY=parseInt(v)||0;generateQR();})),
  );
  card.appendChild(grid);

  // Color
  const cr=document.createElement('div'); cr.className='label-color';
  const sw=document.createElement('div'); sw.className='swatch'; sw.style.background=data.hex;
  const hx=document.createElement('input'); hx.className='inp c-hex'; hx.value=data.hex; hx.maxLength=9; hx.spellcheck=false;
  hx.addEventListener('input',()=>{ const rgb=hexToRgb(hx.value); if(!rgb) return; data.hex=hx.value;data.r=rgb.r;data.g=rgb.g;data.b=rgb.b; sw.style.background=hx.value; generateQR(); });
  blurOnKey(hx);
  sw.addEventListener('click',e=>{ e.stopPropagation(); openColorPicker(hx,sw,()=>{ const rgb=hexToRgb(hx.value)||{r:0,g:0,b:0}; data.hex=hx.value;data.r=rgb.r;data.g=rgb.g;data.b=rgb.b; generateQR(); }); });
  const cl=document.createElement('span'); cl.className='field-label'; cl.textContent='color';
  cr.append(cl,sw,hx); card.appendChild(cr);

  labelList.appendChild(card);
  generateQR();
}

addLabelBtn.addEventListener('click',()=>addLabelRow());

// ── QR drawing helpers ─────────────────────────────────────────────────────
let lastContent=null, lastQR=null;

function drawModule(ctx,x,y,w,h,style,r) {
  if(style==='dots'){
    ctx.beginPath(); ctx.arc(x+w/2,y+h/2,Math.min(w,h)*0.45,0,Math.PI*2); ctx.fill();
  } else if(style==='round'&&r>0){
    const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath(); ctx.fill();
  } else { ctx.fillRect(x,y,w,h); }
}

function generateQR() {
  if(typeof qrcode==='undefined') return;
  const typeName=genType.value, schema=TYPES[typeName], content=schema.build(getFields(typeName));
  if(!content.trim()){ genCanvas.style.display='none'; genEmpty.style.display='flex'; genStatus.textContent='—'; lastContent=null;lastQR=null; return; }

  const eccChar=genEcc.value;
  try {
    const qr=qrcode(0,eccChar); qr.addData(content,'Byte'); qr.make();
    lastQR=qr;
    const size=Math.max(64,Math.min(4096,parseFloat(genSize.value)||512));
    const marginM=Math.max(0,Math.min(20,parseFloat(genMargin.value)||4));
    const radPct=Math.max(0,Math.min(100,parseFloat(genRadius.value)||0));
    const mStyle=genMStyle.value;
    const mods=qr.getModuleCount(), total=mods+marginM*2, cell=size/total, rad=cell*(radPct/100);

    const fg=hexToRgb(fgHex.value)||{r:0,g:0,b:0};
    const bg=hexToRgb(bgHex.value)||{r:255,g:255,b:255};

    // Label padding
    const pad={top:0,bottom:0,left:0,right:0};
    for(const lbl of labels){
      if(!lbl.text) continue;
      const fs=lbl.fontSize||24, gap=fs*0.3+Math.abs(lbl.offsetY||0), lineH=fs*1.4;
      if(lbl.side==='top')    pad.top=   Math.max(pad.top,   lineH+gap);
      if(lbl.side==='bottom') pad.bottom=Math.max(pad.bottom,lineH+gap);
      if(lbl.side==='left')   pad.left=  Math.max(pad.left,  lineH+gap);
      if(lbl.side==='right')  pad.right= Math.max(pad.right, lineH+gap);
    }
    const W=size+pad.left+pad.right, H=size+pad.top+pad.bottom;
    genCanvas.width=W; genCanvas.height=H;
    const ctx=genCanvas.getContext('2d');
    ctx.fillStyle=`rgb(${bg.r},${bg.g},${bg.b})`; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=`rgb(${fg.r},${fg.g},${fg.b})`;

    for(let r=0;r<mods;r++) for(let c=0;c<mods;c++) if(qr.isDark(r,c)){
      const x=pad.left+Math.round((c+marginM)*cell), y=pad.top+Math.round((r+marginM)*cell);
      const w=Math.round((c+marginM+1)*cell)-(x-pad.left), h=Math.round((r+marginM+1)*cell)-(y-pad.top);
      drawModule(ctx,x,y,w,h,mStyle,rad);
    }

    for(const lbl of labels){
      if(!lbl.text) continue;
      const fs=lbl.fontSize||24, ox=lbl.offsetX||0, oy=lbl.offsetY||0, gap=fs*0.3;
      ctx.font=`${fs}px Inter,-apple-system,sans-serif`; ctx.fillStyle=lbl.hex||'#000000'; ctx.textBaseline='middle';
      const qx=pad.left, qy=pad.top;
      let tx,ty;
      if(lbl.side==='left'||lbl.side==='right'){
        ctx.save();
        tx=lbl.side==='left'?qx-gap-fs/2+oy:qx+size+gap+fs/2+oy;
        ty=qy+size/2+ox;
        ctx.translate(tx,ty); ctx.rotate(lbl.side==='left'?-Math.PI/2:Math.PI/2);
        ctx.textAlign=lbl.align==='left'?'start':lbl.align==='right'?'end':'center';
        ctx.fillText(lbl.text,0,0); ctx.restore(); continue;
      }
      ty=lbl.side==='top'?qy-gap-fs/2+oy:qy+size+gap+fs/2+oy;
      ctx.textAlign=lbl.align==='left'?'left':lbl.align==='right'?'right':'center';
      tx=lbl.align==='left'?qx+ox:lbl.align==='right'?qx+size+ox:qx+size/2+ox;
      ctx.fillText(lbl.text,tx,ty);
    }

    genCanvas.style.display='block'; genEmpty.style.display='none';
    genStatus.textContent=`${mods}×${mods} — ${content.length} chars`;
    lastContent=content;
  } catch(e){
    genCanvas.style.display='none'; genEmpty.style.display='flex';
    genStatus.textContent='error: '+(e.message||'content too long');
    lastContent=null; lastQR=null;
  }
}

// ── Exports ────────────────────────────────────────────────────────────────
function dlCanvas(ext,type,q){ if(genCanvas.style.display==='none'){toast('generate a QR code first','bad');return;} const a=document.createElement('a');a.href=genCanvas.toDataURL(type,q);a.download='qr.'+ext;a.click(); }

function dlSVG(){
  if(!lastContent||!lastQR){toast('generate a QR code first','bad');return;}
  const qr=lastQR,mods=qr.getModuleCount(),mm=Math.max(0,parseFloat(genMargin.value)||4);
  const radPct=Math.max(0,Math.min(100,parseFloat(genRadius.value)||0)),mStyle=genMStyle.value;
  const fg=hexToRgb(fgHex.value)||{r:0,g:0,b:0},bg=hexToRgb(bgHex.value)||{r:255,g:255,b:255};
  const fgStr=`rgb(${fg.r},${fg.g},${fg.b})`,bgStr=`rgb(${bg.r},${bg.g},${bg.b})`;
  const cell=1,qSz=mods+mm*2,r=cell*(radPct/100);
  const refSize=parseFloat(genSize.value)||512, scale=qSz/refSize;
  const pad={top:0,bottom:0,left:0,right:0};
  for(const lbl of labels){if(!lbl.text)continue;const fs=(lbl.fontSize||24)*scale,gap=fs*0.3+Math.abs(lbl.offsetY||0)*scale,lineH=fs*1.4;if(lbl.side==='top')pad.top=Math.max(pad.top,lineH+gap);if(lbl.side==='bottom')pad.bottom=Math.max(pad.bottom,lineH+gap);if(lbl.side==='left')pad.left=Math.max(pad.left,lineH+gap);if(lbl.side==='right')pad.right=Math.max(pad.right,lineH+gap);}
  const W=qSz+pad.left+pad.right,H=qSz+pad.top+pad.bottom;
  function svgMod(c,row){const x=pad.left+(c+mm)*cell,y=pad.top+(row+mm)*cell,w=cell,h=cell;if(mStyle==='dots'){const cx=x+w/2,cy=y+h/2,rd=Math.min(w,h)*0.45;return `<circle cx="${cx}" cy="${cy}" r="${rd}"/>`;}if(mStyle==='round'&&r>0){const rr=Math.min(r,w/2,h/2);return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" ry="${rr}"/>`;}return `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;}
  let mods2=''; for(let row=0;row<mods;row++) for(let c=0;c<mods;c++) if(qr.isDark(row,c)) mods2+=svgMod(c,row);
  let texts=''; for(const lbl of labels){if(!lbl.text)continue;const fs=(lbl.fontSize||24)*scale,gap=fs*0.3,ox=(lbl.offsetX||0)*scale,oy=(lbl.offsetY||0)*scale,color=lbl.hex||'#000000',qx=pad.left,qy=pad.top,am={left:'start',center:'middle',right:'end'},anchor=am[lbl.align||'center']||'middle';let tx,ty,tr='';if(lbl.side==='left'){tx=qx-gap-fs/2+oy;ty=qy+qSz/2+ox;tr=`transform="rotate(-90,${tx},${ty})"`;}else if(lbl.side==='right'){tx=qx+qSz+gap+fs/2+oy;ty=qy+qSz/2+ox;tr=`transform="rotate(90,${tx},${ty})"`;}else{ty=lbl.side==='top'?qy-gap-fs/2+oy:qy+qSz+gap+fs/2+oy;tx=lbl.align==='left'?qx+ox:lbl.align==='right'?qx+qSz+ox:qx+qSz/2+ox;}texts+=`<text x="${tx}" y="${ty}" font-size="${fs}" fill="${color}" text-anchor="${anchor}" dominant-baseline="middle" font-family="Inter,system-ui,sans-serif" ${tr}>${lbl.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`;}
  const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="${mStyle==='square'?'crispEdges':'auto'}">\n<rect width="${W}" height="${H}" fill="${bgStr}"/>\n<g fill="${fgStr}">${mods2}</g>\n${texts}\n</svg>`;
  const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='qr.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function dlBMP(){
  if(genCanvas.style.display==='none'){toast('generate a QR code first','bad');return;}
  const src=genCanvas,w=src.width,h=src.height,id=src.getContext('2d').getImageData(0,0,w,h);
  const rowSize=Math.ceil(w*3/4)*4,pxSz=rowSize*h,fSz=54+pxSz,buf=new ArrayBuffer(fSz),dv=new DataView(buf);
  dv.setUint8(0,0x42);dv.setUint8(1,0x4D);dv.setUint32(2,fSz,true);dv.setUint32(6,0,true);dv.setUint32(10,54,true);
  dv.setUint32(14,40,true);dv.setInt32(18,w,true);dv.setInt32(22,-h,true);dv.setUint16(26,1,true);dv.setUint16(28,24,true);
  dv.setUint32(30,0,true);dv.setUint32(34,pxSz,true);dv.setInt32(38,2835,true);dv.setInt32(42,2835,true);dv.setUint32(46,0,true);dv.setUint32(50,0,true);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){const i=(y*w+x)*4,bi=54+y*rowSize+x*3;dv.setUint8(bi,id.data[i+2]);dv.setUint8(bi+1,id.data[i+1]);dv.setUint8(bi+2,id.data[i]);}
  const blob=new Blob([buf],{type:'image/bmp'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='qr.bmp';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

document.getElementById('exportPNG').addEventListener('click',()=>dlCanvas('png','image/png'));
document.getElementById('exportWEBP').addEventListener('click',()=>dlCanvas('webp','image/webp',0.95));
document.getElementById('exportJPEG').addEventListener('click',()=>dlCanvas('jpg','image/jpeg',0.95));
document.getElementById('exportSVG').addEventListener('click',dlSVG);
document.getElementById('exportBMP').addEventListener('click',dlBMP);
document.getElementById('copyQR').addEventListener('click',()=>{
  if(genCanvas.style.display==='none'){toast('generate a QR code first','bad');return;}
  genCanvas.toBlob(async blob=>{ try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('copied','ok');}catch(e){toast('copy not supported here','bad');}}, 'image/png');
});

genType.addEventListener('change',()=>buildFields(genType.value));
genEcc.addEventListener('change',generateQR);
genMStyle.addEventListener('change',generateQR);

buildFields(genType.value);
