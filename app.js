'use strict';

if (typeof jsQR === 'undefined') {
  document.body.innerHTML = '<pre style="color:#f87171;padding:30px;font-family:monospace;background:#111">error: jsQR.min.js not loaded</pre>';
  throw new Error('jsQR missing');
}

// ── Utils ──────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.trim().replace('#','');
  const p = s => { const r=parseInt(s.slice(0,2),16),g=parseInt(s.slice(2,4),16),b=parseInt(s.slice(4,6),16); return isNaN(r)?null:{r,g,b}; };
  if (h.length===3) return p(h[0]+h[0]+h[1]+h[1]+h[2]+h[2]);
  if (h.length===6) return p(h);
  return null;
}
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''); }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return; } catch(_){}
  const a=document.createElement('textarea'); a.value=t; a.style.cssText='position:fixed;opacity:0';
  document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove();
}

let _tw=null;
function toast(msg,type='',dur=2200) {
  if(!_tw){_tw=document.createElement('div');_tw.className='toasts';document.body.appendChild(_tw);}
  const el=document.createElement('div'); el.className='toast '+type; el.textContent=msg;
  _tw.appendChild(el); setTimeout(()=>el.remove(),dur);
}

function blurKeys(el) {
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // if picker is open, close it instead of just blurring
      closePicker();
      el.blur();
    }
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
  });
}

// ── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('page-'+t.dataset.tab).classList.add('active');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// COLOR PICKER
// ══════════════════════════════════════════════════════════════════════════
const cpEl    = document.getElementById('colorPicker');
const cpSVCvs = document.getElementById('cpSV');
const cpSVCur = document.getElementById('cpSVCursor');
const cpHCvs  = document.getElementById('cpHue');
const cpHCur  = document.getElementById('cpHueCursor');
const cpACvs  = document.getElementById('cpAlpha');
const cpACur  = document.getElementById('cpAlphaCursor');
const cpPrev  = document.getElementById('cpPreview');
const cpHOut  = document.getElementById('cpHexOut');

let cp = {h:0,s:1,v:1,a:1};
let cpTarget = null;
let cpSvCtx, cpHCtx, cpACtx;

function hsvToRgb(h,s,v) {
  let r,g,b; const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
  switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;
    case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;default:r=v;g=p;b=q;}
  return {r:Math.round(r*255),g:Math.round(g*255),b:Math.round(b*255)};
}
function rgbToHsv(r,g,b) {
  r/=255;g/=255;b/=255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
  let h=0,s=mx===0?0:d/mx,vv=mx;
  if(d){switch(mx){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h/=6;}
  return {h,s,v:vv};
}

function cpDrawSV() {
  if(!cpSvCtx) cpSvCtx=cpSVCvs.getContext('2d');
  const ctx=cpSvCtx,w=220,h=160,hc=hsvToRgb(cp.h,1,1);
  const gH=ctx.createLinearGradient(0,0,w,0); gH.addColorStop(0,'#fff'); gH.addColorStop(1,`rgb(${hc.r},${hc.g},${hc.b})`);
  ctx.fillStyle=gH; ctx.fillRect(0,0,w,h);
  const gV=ctx.createLinearGradient(0,0,0,h); gV.addColorStop(0,'rgba(0,0,0,0)'); gV.addColorStop(1,'#000');
  ctx.fillStyle=gV; ctx.fillRect(0,0,w,h);
  cpSVCur.style.left=cp.s*w+'px'; cpSVCur.style.top=(1-cp.v)*h+'px';
}
function cpDrawHue() {
  if(!cpHCtx) cpHCtx=cpHCvs.getContext('2d');
  const ctx=cpHCtx,w=220,h=16,g=ctx.createLinearGradient(0,0,w,0);
  for(let i=0;i<=360;i+=60) g.addColorStop(i/360,`hsl(${i},100%,50%)`);
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  cpHCur.style.marginLeft=(cp.h*w-5)+'px';
}
function cpDrawAlpha() {
  if(!cpACtx) cpACtx=cpACvs.getContext('2d');
  const ctx=cpACtx,w=220,h=16;
  for(let x=0;x<w;x+=8) for(let y=0;y<h;y+=8){ctx.fillStyle=((x/8+y/8)%2===0)?'#999':'#fff';ctx.fillRect(x,y,8,8);}
  const rgb=hsvToRgb(cp.h,cp.s,cp.v);
  const ga=ctx.createLinearGradient(0,0,w,0);
  ga.addColorStop(0,`rgba(${rgb.r},${rgb.g},${rgb.b},0)`); ga.addColorStop(1,`rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
  ctx.fillStyle=ga; ctx.fillRect(0,0,w,h);
  cpACur.style.marginLeft=(cp.a*w-5)+'px';
}
function cpRefresh() {
  cpDrawSV(); cpDrawHue(); cpDrawAlpha();
  const rgb=hsvToRgb(cp.h,cp.s,cp.v), hex=rgbToHex(rgb.r,rgb.g,rgb.b);
  cpPrev.style.background=`rgba(${rgb.r},${rgb.g},${rgb.b},${cp.a})`;
  cpHOut.textContent=hex;
  if(!cpTarget) return;
  cpTarget.hexEl.value=hex; cpTarget.swatchEl.style.background=hex;
  const wrap=cpTarget.hexEl.closest('.color-inputs')||cpTarget.hexEl.closest('.label-color-row');
  if(wrap){ const n=wrap.querySelectorAll('.num'); if(n.length>=3){n[0].value=rgb.r;n[1].value=rgb.g;n[2].value=rgb.b;} }
  cpTarget.cb();
}

const cpOverlay = document.getElementById('cpOverlay');
let _pickerJustOpened = false;

function closePicker() {
  cpEl.classList.remove('open');
  cpOverlay.classList.remove('open');
  cpTarget = null;
}

function openPicker(hexEl, swatchEl, cb) {
  cpTarget = {hexEl, swatchEl, cb};
  const rgb = hexToRgb(hexEl.value) || {r:0,g:0,b:0};
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  cp.h = hsv.h; cp.s = hsv.s; cp.v = hsv.v; cp.a = 1;
  const rect = swatchEl.getBoundingClientRect();
  const pickerW = 242, pickerH = 310;
  let top = rect.bottom + 8, left = rect.left;
  if (top + pickerH > window.innerHeight) top = rect.top - pickerH - 8;
  if (left + pickerW > window.innerWidth) left = window.innerWidth - pickerW - 8;
  top = Math.max(8, top); left = Math.max(8, left);
  cpEl.style.top = top + 'px'; cpEl.style.left = left + 'px';
  cpEl.classList.add('open');
  cpOverlay.classList.add('open');
  _pickerJustOpened = true;
  // clear flag after this event loop tick so the opening click doesn't self-close
  setTimeout(() => { _pickerJustOpened = false; }, 0);
  cpRefresh();
}

// overlay click: close (covers all browsers/platforms)
cpOverlay.addEventListener('click', closePicker);
cpOverlay.addEventListener('touchend', e => { e.preventDefault(); closePicker(); });

// ALSO handle direct document mousedown as backup for Chrome on Windows
// where fixed overlays can sometimes be skipped due to stacking context issues
document.addEventListener('mousedown', e => {
  if (!cpEl.classList.contains('open')) return;
  if (_pickerJustOpened) return;
  if (cpEl.contains(e.target)) return;
  if (e.target.closest && e.target.closest('.swatch')) return;
  closePicker();
}, true);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && cpEl.classList.contains('open')) {
    e.stopPropagation();
    closePicker();
  }
}, true);

function cpDrag(cvs,onPos) {
  let down=false;
  function handle(e){ const r=cvs.getBoundingClientRect(),cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY; onPos(clamp((cx-r.left)/r.width,0,1),clamp((cy-r.top)/r.height,0,1)); cpRefresh(); }
  cvs.addEventListener('mousedown',e=>{down=true;handle(e);});
  cvs.addEventListener('touchstart',e=>{e.preventDefault();handle(e);},{passive:false});
  window.addEventListener('mousemove',e=>{if(down)handle(e);});
  window.addEventListener('touchmove',e=>{if(down){e.preventDefault();handle(e);}},{passive:false});
  window.addEventListener('mouseup',()=>down=false);
  window.addEventListener('touchend',()=>down=false);
}
cpDrag(cpSVCvs,(x,y)=>{cp.s=x;cp.v=1-y;});
cpDrag(cpHCvs, x=>{cp.h=x;cpDrawSV();cpDrawAlpha();});
cpDrag(cpACvs, x=>{cp.a=x;});

// ══════════════════════════════════════════════════════════════════════════
// SCANNER
// ══════════════════════════════════════════════════════════════════════════
const dropZone   =document.getElementById('dropZone');
const fileInput  =document.getElementById('fileInput');
const camInput   =document.getElementById('cameraInput');
const uploadBtn  =document.getElementById('uploadBtn');
const pasteBtn   =document.getElementById('pasteBtn');
const cameraBtn  =document.getElementById('cameraBtn');
const resultList =document.getElementById('resultList');
const resultEmpty=document.getElementById('resultEmpty');
const resultLabel=document.getElementById('resultLabel');
const copyAllBtn =document.getElementById('copyAll');
const clearAllBtn=document.getElementById('clearAll');
const histList   =document.getElementById('historyList');
const histLabel  =document.getElementById('historyLabel');
const prevWrap   =document.getElementById('previewWrap');
const prevImg    =document.getElementById('previewImg');
const qrCvs      =document.getElementById('qrCanvas');
const qrCtx      =qrCvs.getContext('2d');
const history    =[];

function decodeFile(file) {
  return new Promise(resolve => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }

      // helper: run jsQR on imageData with both inversion modes
      function tryDecode(id) {
        return jsQR(id.data, id.width, id.height, { inversionAttempts: 'attemptBoth' });
      }

      // helper: draw image to canvas at given scale and optional contrast
      function render(sw, sh, contrast = 1, brightness = 0) {
        qrCvs.width = sw; qrCvs.height = sh;
        qrCtx.filter = contrast !== 1 || brightness !== 0
          ? `contrast(${contrast}) brightness(${brightness})`
          : 'none';
        qrCtx.drawImage(img, 0, 0, sw, sh);
        qrCtx.filter = 'none';
        return qrCtx.getImageData(0, 0, sw, sh);
      }

      // attempt 1: normal size
      let code = tryDecode(render(w, h));
      if (code) { img.src = ''; return resolve(code.data); }

      // attempt 2: inverted colors (dark bg QR)
      code = tryDecode(render(w, h));
      if (code) { img.src = ''; return resolve(code.data); }

      // attempt 3: high contrast
      code = tryDecode(render(w, h, 2.5, 1.1));
      if (code) { img.src = ''; return resolve(code.data); }

      // attempt 4: lower contrast (washed out)
      code = tryDecode(render(w, h, 0.6, 1.3));
      if (code) { img.src = ''; return resolve(code.data); }

      // attempt 5: smaller — sometimes helps with noise
      const sw2 = Math.round(w * 0.6), sh2 = Math.round(h * 0.6);
      code = tryDecode(render(sw2, sh2, 1.8));
      if (code) { img.src = ''; return resolve(code.data); }

      // attempt 6: grayscale via canvas filter
      code = tryDecode(render(w, h, 1.5, 1));
      if (code) { img.src = ''; return resolve(code.data); }

      img.src = '';
      resolve(null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function detectType(v){
  try{const u=new URL(v);if(['http:','https:','mailto:','tel:','sms:','ftp:'].includes(u.protocol))return 'url';}catch(_){}
  return 'text';
}

function renderCard(value,type,filename,isError){
  const card=document.createElement('div'); card.className='result-card';
  const meta=document.createElement('div'); meta.className='result-card-meta';
  if(filename){
    const fn=document.createElement('span'); fn.className='r-filename'; fn.textContent=filename; fn.title=filename;
    meta.appendChild(fn);
  }
  const tag=document.createElement('span'); tag.className='r-tag '+(isError?'error':type);
  tag.textContent=isError?'no qr':type; meta.appendChild(tag); card.appendChild(meta);

  const val=document.createElement('div');
  val.className='r-val'+(isError?' is-error':type==='text'?' is-text':'');
  val.textContent=isError?'No QR code detected in this image.':value; card.appendChild(val);

  if(!isError){
    const acts=document.createElement('div'); acts.className='r-actions';
    const cpBtn=document.createElement('button'); cpBtn.className='r-btn'; cpBtn.textContent='Copy';
    cpBtn.addEventListener('click',async()=>{await copyText(value);cpBtn.textContent='Copied!';cpBtn.classList.add('copied');setTimeout(()=>{cpBtn.textContent='Copy';cpBtn.classList.remove('copied');},1600);});
    acts.appendChild(cpBtn);
    if(type==='url'){
      const ob=document.createElement('button'); ob.className='r-btn primary'; ob.textContent='Open URL';
      ob.addEventListener('click',()=>window.open(value,'_blank','noopener,noreferrer')); acts.appendChild(ob);
    } else {
      const sb=document.createElement('button'); sb.className='r-btn'; sb.textContent='Search';
      sb.addEventListener('click',()=>window.open('https://www.google.com/search?q='+encodeURIComponent(value),'_blank','noopener,noreferrer')); acts.appendChild(sb);
    }
    card.appendChild(acts);
  }
  return card;
}

async function processFiles(files){
  const imgs=Array.from(files||[]).filter(f=>f.type.startsWith('image/'));
  if(!imgs.length){toast('No image files found','bad');return;}
  prevImg.src=URL.createObjectURL(imgs[0]);
  prevImg.onload=()=>URL.revokeObjectURL(prevImg.src);
  prevWrap.hidden=false;
  resultList.innerHTML=''; resultEmpty.hidden=true;
  const decoded=[];
  for(const f of imgs){
    const v=await decodeFile(f); const isErr=v===null; const type=isErr?'error':detectType(v);
    decoded.push({v,type,name:f.name,isErr}); if(!isErr)addHistory(v,type);
  }
  decoded.forEach(d=>resultList.appendChild(renderCard(d.v,d.type,d.name,d.isErr)));
  const ok=decoded.filter(d=>!d.isErr).length;
  resultLabel.textContent=imgs.length===1?(ok?'Result':'Result — nothing found'):`Result — ${ok}/${imgs.length}`;
  copyAllBtn.hidden=!ok; clearAllBtn.hidden=false;
  if(!ok) toast('No QR codes found','bad');
}

function addHistory(value,type){
  history.unshift({value,type,time:new Date()});
  if(history.length>50)history.pop();
  renderHistory();
}

function renderHistory(){
  const n=history.length;
  histLabel.textContent=n?`History (${n})`:'History';
  if(!n){histList.innerHTML='<div class="placeholder">No scans yet</div>';return;}
  histList.innerHTML='';
  for(const e of history){
    const item=document.createElement('div'); item.className='history-item'; item.title='Click to copy';
    const dot=document.createElement('div'); dot.className='h-dot '+e.type;
    const val=document.createElement('div'); val.className='h-val'; val.textContent=e.value;
    const t=document.createElement('div'); t.className='h-time'; t.textContent=relTime(e.time);
    item.append(dot,val,t);
    item.addEventListener('click',async()=>{await copyText(e.value);toast('Copied','ok');});
    histList.appendChild(item);
  }
}
function relTime(d){const s=(Date.now()-d)/1000;if(s<60)return 'now';if(s<3600)return Math.floor(s/60)+'m';return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}

let dragN=0;
dropZone.addEventListener('dragenter',e=>{e.preventDefault();dragN++;dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',e=>{e.preventDefault();if(--dragN<=0){dragN=0;dropZone.classList.remove('drag-over');}});
dropZone.addEventListener('dragover', e=>e.preventDefault());
dropZone.addEventListener('drop',e=>{e.preventDefault();dragN=0;dropZone.classList.remove('drag-over');processFiles(e.dataTransfer.files);});
uploadBtn.addEventListener('click',e=>{e.stopPropagation();fileInput.click();});
pasteBtn.addEventListener('click', async e => {
  e.stopPropagation();
  try {
    const items = await navigator.clipboard.read();
    const files = [];
    for (const item of items) {
      const imgType = item.types.find(t => t.startsWith('image/'));
      if (imgType) { const blob = await item.getType(imgType); files.push(new File([blob], 'pasted.png', {type: imgType})); }
    }
    if (files.length) processFiles(files);
    else toast('No image in clipboard', 'bad');
  } catch(_) { toast('Paste an image with Ctrl+V instead', 'bad'); }
});
cameraBtn.addEventListener('click',e=>{e.stopPropagation();camInput.click();});
dropZone.addEventListener('click',e=>{if(uploadBtn.contains(e.target)||cameraBtn.contains(e.target))return;fileInput.click();});
dropZone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click();}});
fileInput.addEventListener('change',()=>{if(fileInput.files.length){processFiles(fileInput.files);fileInput.value='';}});
camInput.addEventListener('change',()=>{if(camInput.files.length){processFiles(camInput.files);camInput.value='';}});

document.addEventListener('paste',async e=>{
  if(!document.getElementById('page-scanner').classList.contains('active'))return;
  const items=e.clipboardData&&e.clipboardData.items; if(!items)return;
  const imgs=Array.from(items).filter(i=>i.type.startsWith('image/')); if(!imgs.length)return;
  e.preventDefault();
  processFiles(imgs.map((i,idx)=>{const f=i.getAsFile();return f?new File([f],`pasted${imgs.length>1?idx+1:''}.png`,{type:f.type}):null;}).filter(Boolean));
});

copyAllBtn.addEventListener('click',async()=>{
  const vals=resultList.querySelectorAll('.r-val:not(.is-error)'); if(!vals.length)return;
  await copyText(Array.from(vals).map(v=>v.textContent).join('\n')); toast('All results copied','ok');
});
clearAllBtn.addEventListener('click',()=>{
  resultList.innerHTML=''; resultEmpty.hidden=false; resultLabel.textContent='Result';
  copyAllBtn.hidden=true; clearAllBtn.hidden=true; prevWrap.hidden=true; prevImg.src='';
  history.length=0; renderHistory();
});

if(!/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) cameraBtn.style.display='none';
renderHistory();

// ══════════════════════════════════════════════════════════════════════════
// GENERATOR
// ══════════════════════════════════════════════════════════════════════════
const genType   =document.getElementById('genType');
const fieldGroup=document.getElementById('fieldGroup');
const fgHex=document.getElementById('fgHex'),fgR=document.getElementById('fgR'),fgG=document.getElementById('fgG'),fgB=document.getElementById('fgB'),fgSwatch=document.getElementById('fgSwatch');
const bgHex=document.getElementById('bgHex'),bgR=document.getElementById('bgR'),bgG=document.getElementById('bgG'),bgB=document.getElementById('bgB'),bgSwatch=document.getElementById('bgSwatch');
const genEcc    =document.getElementById('genEcc');
const genSize   =document.getElementById('genSize');
const genMargin =document.getElementById('genMargin');
const genRadius =document.getElementById('genRadius');
const genMStyle =document.getElementById('genModuleStyle');
const addLblBtn =document.getElementById('addLabel');
const labelList =document.getElementById('labelList');
const genCvs    =document.getElementById('genCanvas');
const genStatus =document.getElementById('genStatus');
const genEmpty  =document.getElementById('genEmpty');

const TYPES={
  url:   {fields:[{id:'url',label:'URL',placeholder:'https://example.com',type:'text'}],build:f=>f.url||''},
  text:  {fields:[{id:'text',label:'Text',placeholder:'Any text...',type:'textarea'}],build:f=>f.text||''},
  email: {fields:[{id:'to',label:'To',placeholder:'user@example.com',type:'text'},{id:'subject',label:'Subject',placeholder:'Hello',type:'text'},{id:'body',label:'Body',placeholder:'Message...',type:'textarea'}],build:f=>{if(!f.to)return'';let s='mailto:'+f.to,p=[];if(f.subject)p.push('subject='+encodeURIComponent(f.subject));if(f.body)p.push('body='+encodeURIComponent(f.body));return p.length?s+'?'+p.join('&'):s;}},
  phone: {fields:[{id:'phone',label:'Phone number',placeholder:'+1234567890',type:'text'}],build:f=>f.phone?'tel:'+f.phone:''},
  sms:   {fields:[{id:'phone',label:'Phone number',placeholder:'+1234567890',type:'text'},{id:'message',label:'Message',placeholder:'Text here...',type:'textarea'}],build:f=>{if(!f.phone)return'';return f.message?`SMSTO:${f.phone}:${f.message}`:'sms:'+f.phone;}},
  wifi:  {fields:[{id:'ssid',label:'Network name (SSID)',placeholder:'MyNetwork',type:'text'},{id:'pass',label:'Password',placeholder:'password123',type:'text'},{id:'enc',label:'Encryption',type:'select',options:['WPA','WEP','nopass']},{id:'hidden',label:'Hidden network',type:'checkbox'}],build:f=>{if(!f.ssid)return'';const e=s=>s.replace(/([\\";,:])/g,'\\$1');return`WIFI:T:${f.enc||'WPA'};S:${e(f.ssid)};P:${e(f.pass||'')};${f.hidden==='true'?'H:true;':''};`;}},
  vcard: {fields:[{id:'name',label:'Full name',placeholder:'John Doe',type:'text'},{id:'org',label:'Organization',placeholder:'ACME Corp',type:'text'},{id:'title',label:'Job title',placeholder:'Engineer',type:'text'},{id:'phone',label:'Phone',placeholder:'+1234567890',type:'text'},{id:'email',label:'Email',placeholder:'john@example.com',type:'text'},{id:'url',label:'Website',placeholder:'https://example.com',type:'text'},{id:'address',label:'Address',placeholder:'123 Main St, City',type:'text'},{id:'note',label:'Note',placeholder:'...',type:'textarea'}],build:f=>{if(!f.name)return'';const l=['BEGIN:VCARD','VERSION:3.0','FN:'+f.name];if(f.org)l.push('ORG:'+f.org);if(f.title)l.push('TITLE:'+f.title);if(f.phone)l.push('TEL:'+f.phone);if(f.email)l.push('EMAIL:'+f.email);if(f.url)l.push('URL:'+f.url);if(f.address)l.push('ADR:;;'+f.address+';;;;');if(f.note)l.push('NOTE:'+f.note);l.push('END:VCARD');return l.join('\n');}},
  geo:   {fields:[{id:'lat',label:'Latitude',placeholder:'48.8566',type:'text'},{id:'lng',label:'Longitude',placeholder:'2.3522',type:'text'},{id:'query',label:'Label (optional)',placeholder:'Eiffel Tower',type:'text'}],build:f=>{if(!f.lat||!f.lng)return'';return f.query?`geo:${f.lat},${f.lng}?q=${encodeURIComponent(f.query)}`:`geo:${f.lat},${f.lng}`;}},
  event: {fields:[{id:'summary',label:'Event title',placeholder:'Meeting',type:'text'},{id:'location',label:'Location',placeholder:'Conference room',type:'text'},{id:'dtstart',label:'Start',type:'datetime-local'},{id:'dtend',label:'End',type:'datetime-local'},{id:'desc',label:'Description',placeholder:'...',type:'textarea'}],build:f=>{if(!f.summary)return'';const fmt=s=>s?s.replace(/[-:T]/g,'').slice(0,15)+'Z':'';const l=['BEGIN:VEVENT','SUMMARY:'+f.summary];if(f.location)l.push('LOCATION:'+f.location);if(f.dtstart)l.push('DTSTART:'+fmt(f.dtstart));if(f.dtend)l.push('DTEND:'+fmt(f.dtend));if(f.desc)l.push('DESCRIPTION:'+f.desc);l.push('END:VEVENT');return l.join('\n');}},
  crypto:{fields:[{id:'coin',label:'Coin',type:'select',options:['bitcoin','ethereum','litecoin','monero','other']},{id:'address',label:'Address',placeholder:'1A1zP1eP5...',type:'text'},{id:'amount',label:'Amount (optional)',placeholder:'0.01',type:'text'},{id:'label',label:'Label (optional)',placeholder:'Donation',type:'text'}],build:f=>{if(!f.address)return'';const coin=f.coin==='other'?'':(f.coin||'bitcoin');let uri=coin?`${coin}:${f.address}`:f.address,p=[];if(f.amount)p.push('amount='+f.amount);if(f.label)p.push('label='+encodeURIComponent(f.label));return p.length?uri+'?'+p.join('&'):uri;}},
};

const fldState={};
function buildFields(type){
  const s=TYPES[type]; if(!s)return;
  if(!fldState[type])fldState[type]={};
  const st=fldState[type]; fieldGroup.innerHTML='';
  for(const f of s.fields){
    const row=document.createElement('div'); row.className='field-row';
    const lbl=document.createElement('label'); lbl.className='lbl'; lbl.textContent=f.label; lbl.htmlFor='gf_'+f.id;
    row.appendChild(lbl);
    let el;
    if(f.type==='textarea'){el=document.createElement('textarea');el.className='inp';el.rows=3;}
    else if(f.type==='select'){el=document.createElement('select');el.className='sel';for(const o of f.options){const op=document.createElement('option');op.value=o;op.textContent=o;el.appendChild(op);}}
    else if(f.type==='checkbox'){
      el=document.createElement('input');el.type='checkbox';
      if(st[f.id]==='true')el.checked=true;
      el.addEventListener('change',()=>{st[f.id]=String(el.checked);generateQR();});
      row.appendChild(el);fieldGroup.appendChild(row);continue;
    } else {el=document.createElement('input');el.className='inp';el.type=f.type||'text';if(f.placeholder)el.placeholder=f.placeholder;}
    el.id='gf_'+f.id; if(st[f.id]!==undefined)el.value=st[f.id];
    el.addEventListener('input',()=>{st[f.id]=el.value;generateQR();});
    if(el.tagName==='SELECT')el.addEventListener('change',()=>{st[f.id]=el.value;generateQR();});
    if(el.tagName==='INPUT'||el.tagName==='TEXTAREA')blurKeys(el);
    row.appendChild(el); fieldGroup.appendChild(row);
  }
  generateQR();
}
function getFlds(t){return fldState[t]||{};}

function wireColor(hexEl,rEl,gEl,bEl,sw,cb){
  hexEl.addEventListener('input',()=>{const rgb=hexToRgb(hexEl.value);if(!rgb)return;rEl.value=rgb.r;gEl.value=rgb.g;bEl.value=rgb.b;sw.style.background=hexEl.value;cb();});
  [rEl,gEl,bEl].forEach(el=>el.addEventListener('input',()=>{const r=clamp(parseInt(rEl.value)||0,0,255),g=clamp(parseInt(gEl.value)||0,0,255),b=clamp(parseInt(bEl.value)||0,0,255),hex=rgbToHex(r,g,b);hexEl.value=hex;sw.style.background=hex;cb();}));
  [hexEl,rEl,gEl,bEl].forEach(el=>blurKeys(el));
  sw.addEventListener('click',()=>openPicker(hexEl,sw,cb));
}
wireColor(fgHex,fgR,fgG,fgB,fgSwatch,generateQR);
wireColor(bgHex,bgR,bgG,bgB,bgSwatch,generateQR);

function makeDraft(el,cb){
  let committed=el.value;
  el.addEventListener('input',()=>el.classList.toggle('draft',el.value!==committed));
  el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();committed=el.value;el.classList.remove('draft');el.blur();cb();}if(e.key==='Escape'){e.preventDefault();el.value=committed;el.classList.remove('draft');el.blur();}});
  el.addEventListener('blur',()=>{if(el.classList.contains('draft')){committed=el.value;el.classList.remove('draft');cb();}});
}
makeDraft(genRadius,generateQR); makeDraft(genSize,generateQR); makeDraft(genMargin,generateQR);

// Text labels
let lblIdN=0; const lblData=[];
function addLabel(init){
  const id=++lblIdN;
  const d=init||{id,text:'',side:'bottom',align:'center',fontSize:24,offsetX:0,offsetY:0,hex:'#000000'};
  d.id=id; lblData.push(d);
  const card=document.createElement('div'); card.className='label-card';
  const hdr=document.createElement('div'); hdr.className='label-card-hdr';
  const ttl=document.createElement('span'); ttl.className='label-card-title'; ttl.textContent='Label '+id;
  const rm=document.createElement('button'); rm.className='text-btn danger'; rm.textContent='Remove';
  rm.addEventListener('click',()=>{lblData.splice(lblData.findIndex(l=>l.id===id),1);card.remove();generateQR();});
  hdr.append(ttl,rm); card.appendChild(hdr);

  const tr=document.createElement('div'); tr.className='field-row';
  const tl=document.createElement('label'); tl.className='lbl'; tl.textContent='Text';
  const ti=document.createElement('input'); ti.className='inp'; ti.placeholder='Label text...'; ti.value=d.text||'';
  ti.addEventListener('input',()=>{d.text=ti.value;generateQR();}); blurKeys(ti);
  tr.append(tl,ti); card.appendChild(tr);

  const grid=document.createElement('div'); grid.className='label-grid';
  function opt(labelTxt,el){const f=document.createElement('div');f.className='opt-field';const l=document.createElement('label');l.className='lbl';l.textContent=labelTxt;f.append(l,el);return f;}
  function mkSel(opts,val,cb){const s=document.createElement('select');s.className='sel';opts.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;if(o===val)op.selected=true;s.appendChild(op);});s.addEventListener('change',()=>cb(s.value));return s;}
  function mkNum(val,min,max,cb){const i=document.createElement('input');i.className='inp';i.type='number';i.value=val;i.min=min;i.max=max;i.addEventListener('input',()=>cb(i.value));blurKeys(i);return i;}
  grid.append(
    opt('Side',mkSel(['top','bottom','left','right'],d.side,v=>{d.side=v;generateQR();})),
    opt('Align',mkSel(['left','center','right'],d.align,v=>{d.align=v;generateQR();})),
    opt('Font size',mkNum(d.fontSize,6,200,v=>{d.fontSize=parseInt(v)||16;generateQR();})),
    opt('Offset X',mkNum(d.offsetX,-500,500,v=>{d.offsetX=parseInt(v)||0;generateQR();})),
    opt('Offset Y',mkNum(d.offsetY,-500,500,v=>{d.offsetY=parseInt(v)||0;generateQR();})),
  );
  card.appendChild(grid);

  const cr=document.createElement('div'); cr.className='label-color-row';
  const sw=document.createElement('div'); sw.className='swatch'; sw.style.background=d.hex;
  const hx=document.createElement('input'); hx.className='inp mono'; hx.value=d.hex; hx.maxLength=9; hx.spellcheck=false;
  hx.addEventListener('input',()=>{if(!hexToRgb(hx.value))return;d.hex=hx.value;sw.style.background=hx.value;generateQR();}); blurKeys(hx);
  sw.addEventListener('click',()=>openPicker(hx,sw,()=>{d.hex=hx.value;generateQR();}));
  const cl=document.createElement('label'); cl.className='lbl'; cl.textContent='Color';
  cr.append(cl,sw,hx); card.appendChild(cr);
  labelList.appendChild(card); generateQR();
}
addLblBtn.addEventListener('click',()=>addLabel());

// QR DRAW
let lastContent=null,lastQR=null;

// rounded rect path helper
function rrPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y, x+w,y+h, r);
  ctx.arcTo(x+w,y+h, x,y+h, r);
  ctx.arcTo(x,y+h, x,y, r);
  ctx.arcTo(x,y, x+w,y, r);
  ctx.closePath();
}

function drawModule(ctx,x,y,w,h,style,r){
  if(style==='dots'){
    ctx.beginPath();ctx.arc(x+w/2,y+h/2,Math.min(w,h)*0.44,0,Math.PI*2);ctx.fill();
  } else if(style==='round'&&r>0){
    rrPath(ctx,x,y,w,h,Math.min(r,w/2,h/2)); ctx.fill();
  } else {
    ctx.fillRect(x,y,w,h);
  }
}

function generateQR(){
  if(typeof qrcode==='undefined')return;
  const type=genType.value,schema=TYPES[type],content=schema.build(getFlds(type));
  if(!content.trim()){genCvs.style.display='none';genEmpty.style.display='flex';genStatus.textContent='—';lastContent=null;lastQR=null;return;}
  try{
    const qr=qrcode(0,genEcc.value); qr.addData(content,'Byte'); qr.make(); lastQR=qr;
    const size=Math.max(64,Math.min(4096,parseFloat(genSize.value)||512));
    const mm=Math.max(0,Math.min(20,parseFloat(genMargin.value)||4));
    // image corner radius: % of image min dimension
    const radPct=Math.max(0,Math.min(50,parseFloat(genRadius.value)||0));
    const mStyle=genMStyle.value;
    const mods=qr.getModuleCount(),total=mods+mm*2,cell=size/total;
    // per-module radius for round style: fraction of cell
    const modRad=cell*0.35;
    const fg=hexToRgb(fgHex.value)||{r:0,g:0,b:0};
    const bg=hexToRgb(bgHex.value)||{r:255,g:255,b:255};

    // label padding
    const pad={top:0,bottom:0,left:0,right:0};
    for(const lbl of lblData){if(!lbl.text)continue;const fs=lbl.fontSize||24,gap=fs*0.3+Math.abs(lbl.offsetY||0),lh=fs*1.4;if(lbl.side==='top')pad.top=Math.max(pad.top,lh+gap);else if(lbl.side==='bottom')pad.bottom=Math.max(pad.bottom,lh+gap);else if(lbl.side==='left')pad.left=Math.max(pad.left,lh+gap);else if(lbl.side==='right')pad.right=Math.max(pad.right,lh+gap);}
    const W=size+pad.left+pad.right,H=size+pad.top+pad.bottom;
    genCvs.width=W; genCvs.height=H;
    const ctx=genCvs.getContext('2d');

    const cornerR=radPct>0?(size*radPct/100):0;
    const qx=pad.left,qy=pad.top;

    // 1. Fill entire canvas with BG
    ctx.fillStyle=`rgb(${bg.r},${bg.g},${bg.b})`;
    ctx.fillRect(0,0,W,H);

    // 2. Clip to rounded QR area, then fill BG inside clip, then draw modules
    ctx.save();
    if(cornerR>0){ rrPath(ctx,qx,qy,size,size,cornerR); ctx.clip(); }
    // fill BG again inside clip (covers the corners)
    ctx.fillStyle=`rgb(${bg.r},${bg.g},${bg.b})`; ctx.fillRect(qx,qy,size,size);
    // draw modules inside clip
    ctx.fillStyle=`rgb(${fg.r},${fg.g},${fg.b})`;
    for(let r=0;r<mods;r++) for(let c=0;c<mods;c++) if(qr.isDark(r,c)){
      const x=qx+Math.round((c+mm)*cell), y=qy+Math.round((r+mm)*cell);
      const w=Math.round((c+mm+1)*cell)-(x-qx), h=Math.round((r+mm+1)*cell)-(y-qy);
      drawModule(ctx,x,y,w,h,mStyle,modRad);
    }
    ctx.restore();

    // 3. Draw text labels outside clip
    for(const lbl of lblData){
      if(!lbl.text)continue;
      const fs=lbl.fontSize||24,ox=lbl.offsetX||0,oy=lbl.offsetY||0,gap=fs*0.3;
      ctx.font=`${fs}px Inter,-apple-system,sans-serif`; ctx.fillStyle=lbl.hex||'#000'; ctx.textBaseline='middle';
      if(lbl.side==='left'||lbl.side==='right'){
        ctx.save();
        const tx=lbl.side==='left'?qx-gap-fs/2+oy:qx+size+gap+fs/2+oy,ty=qy+size/2+ox;
        ctx.translate(tx,ty); ctx.rotate(lbl.side==='left'?-Math.PI/2:Math.PI/2);
        ctx.textAlign=lbl.align==='left'?'start':lbl.align==='right'?'end':'center';
        ctx.fillText(lbl.text,0,0); ctx.restore();
      } else {
        const ty=lbl.side==='top'?qy-gap-fs/2+oy:qy+size+gap+fs/2+oy;
        ctx.textAlign=lbl.align==='left'?'left':lbl.align==='right'?'right':'center';
        ctx.fillText(lbl.text,lbl.align==='left'?qx+ox:lbl.align==='right'?qx+size+ox:qx+size/2+ox,ty);
      }
    }

    genCvs.style.display='block'; genEmpty.style.display='none';
    genStatus.textContent=`${mods}×${mods} · ${content.length} chars`;
    lastContent=content;
    updateIOSSave();
  } catch(e){
    genCvs.style.display='none'; genEmpty.style.display='flex';
    genStatus.textContent='Error: '+(e.message||'content too long');
    lastContent=null; lastQR=null;
    updateIOSSave();
  }
}

// EXPORTS
function dlCvs(ext,type,q){if(genCvs.style.display==='none'){toast('Generate a QR code first','bad');return;}const a=document.createElement('a');a.href=genCvs.toDataURL(type,q);a.download='qr.'+ext;a.click();}

function dlSVG(){
  if(!lastContent||!lastQR){toast('Generate a QR code first','bad');return;}
  const qr=lastQR,mods=qr.getModuleCount(),mm=Math.max(0,parseFloat(genMargin.value)||4);
  const radPct=Math.max(0,Math.min(50,parseFloat(genRadius.value)||0));
  const mStyle=genMStyle.value;
  const fg=hexToRgb(fgHex.value)||{r:0,g:0,b:0},bg=hexToRgb(bgHex.value)||{r:255,g:255,b:255};
  const cell=1,qSz=mods+mm*2,cornerR=radPct>0?qSz*radPct/100:0,modRad=cell*0.35;
  const refSz=parseFloat(genSize.value)||512,sc=qSz/refSz;
  const pad={top:0,bottom:0,left:0,right:0};
  for(const lbl of lblData){if(!lbl.text)continue;const fs=(lbl.fontSize||24)*sc,gap=fs*0.3+Math.abs(lbl.offsetY||0)*sc,lh=fs*1.4;if(lbl.side==='top')pad.top=Math.max(pad.top,lh+gap);else if(lbl.side==='bottom')pad.bottom=Math.max(pad.bottom,lh+gap);else if(lbl.side==='left')pad.left=Math.max(pad.left,lh+gap);else if(lbl.side==='right')pad.right=Math.max(pad.right,lh+gap);}
  const W=qSz+pad.left+pad.right,H=qSz+pad.top+pad.bottom;
  const fgStr=`rgb(${fg.r},${fg.g},${fg.b})`,bgStr=`rgb(${bg.r},${bg.g},${bg.b})`;
  function svgMod(c,r){const x=pad.left+(c+mm)*cell,y=pad.top+(r+mm)*cell,w=cell,h=cell;if(mStyle==='dots')return`<circle cx="${x+w/2}" cy="${y+h/2}" r="${Math.min(w,h)*0.44}"/>`;if(mStyle==='round'&&modRad>0){const rr=Math.min(modRad,w/2,h/2);return`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" ry="${rr}"/>`;}return`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;}
  let mods2='';for(let r=0;r<mods;r++)for(let c=0;c<mods;c++)if(qr.isDark(r,c))mods2+=svgMod(c,r);
  const clipId='qrc';
  const defs=cornerR>0?`<defs><clipPath id="${clipId}"><rect x="${pad.left}" y="${pad.top}" width="${qSz}" height="${qSz}" rx="${cornerR}" ry="${cornerR}"/></clipPath></defs>`:'';
  const clipAttr=cornerR>0?` clip-path="url(#${clipId})"`:' ';
  let texts='';for(const lbl of lblData){if(!lbl.text)continue;const fs=(lbl.fontSize||24)*sc,gap=fs*0.3,ox=(lbl.offsetX||0)*sc,oy=(lbl.offsetY||0)*sc,color=lbl.hex||'#000',qx=pad.left,qy=pad.top,am={left:'start',center:'middle',right:'end'},a=am[lbl.align||'center']||'middle';let tx,ty,tr='';if(lbl.side==='left'){tx=qx-gap-fs/2+oy;ty=qy+qSz/2+ox;tr=`transform="rotate(-90,${tx},${ty})"`;}else if(lbl.side==='right'){tx=qx+qSz+gap+fs/2+oy;ty=qy+qSz/2+ox;tr=`transform="rotate(90,${tx},${ty})"`;}else{ty=lbl.side==='top'?qy-gap-fs/2+oy:qy+qSz+gap+fs/2+oy;tx=lbl.align==='left'?qx+ox:lbl.align==='right'?qx+qSz+ox:qx+qSz/2+ox;}texts+=`<text x="${tx}" y="${ty}" font-size="${fs}" fill="${color}" text-anchor="${a}" dominant-baseline="middle" font-family="Inter,system-ui,sans-serif" ${tr}>${lbl.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`;}
  const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n${defs}\n<rect width="${W}" height="${H}" fill="${bgStr}"/>\n<g fill="${fgStr}"${clipAttr}>${mods2}</g>\n${texts}\n</svg>`;
  const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='qr.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function dlBMP(){
  if(genCvs.style.display==='none'){toast('Generate a QR code first','bad');return;}
  const w=genCvs.width,h=genCvs.height,id=genCvs.getContext('2d').getImageData(0,0,w,h);
  const rs=Math.ceil(w*3/4)*4,ps=rs*h,fs=54+ps,buf=new ArrayBuffer(fs),dv=new DataView(buf);
  dv.setUint8(0,0x42);dv.setUint8(1,0x4D);dv.setUint32(2,fs,true);dv.setUint32(6,0,true);dv.setUint32(10,54,true);
  dv.setUint32(14,40,true);dv.setInt32(18,w,true);dv.setInt32(22,-h,true);dv.setUint16(26,1,true);dv.setUint16(28,24,true);
  dv.setUint32(30,0,true);dv.setUint32(34,ps,true);dv.setInt32(38,2835,true);dv.setInt32(42,2835,true);dv.setUint32(46,0,true);dv.setUint32(50,0,true);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,bi=54+y*rs+x*3;dv.setUint8(bi,id.data[i+2]);dv.setUint8(bi+1,id.data[i+1]);dv.setUint8(bi+2,id.data[i]);}
  const blob=new Blob([buf],{type:'image/bmp'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='qr.bmp';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// ── Export ─────────────────────────────────────────────────────────────────
const exportFormat = document.getElementById('exportFormat');
const downloadBtn  = document.getElementById('downloadBtn');
const iosSaveWrap  = document.getElementById('iosSaveWrap');
const iosSaveImg   = document.getElementById('iosSaveImg');
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

function updateIOSSave() {
  if (!isIOS) return;
  if (genCvs.style.display === 'none') { iosSaveWrap.hidden = true; return; }
  const fmt = exportFormat.value;
  if (fmt === 'svg' || fmt === 'bmp') { iosSaveWrap.hidden = true; return; }
  const mimeMap = { png:'image/png', webp:'image/webp', jpeg:'image/jpeg' };
  const q = fmt === 'jpeg' ? 0.95 : undefined;
  iosSaveImg.src = genCvs.toDataURL(mimeMap[fmt] || 'image/png', q);
  iosSaveWrap.hidden = false;
}

exportFormat.addEventListener('change', updateIOSSave);

downloadBtn.addEventListener('click', () => {
  if (genCvs.style.display === 'none') { toast('Generate a QR code first', 'bad'); return; }
  const fmt = exportFormat.value;
  if (fmt === 'svg') { dlSVG(); return; }
  if (fmt === 'bmp') { dlBMP(); return; }
  const mimeMap = { png:'image/png', webp:'image/webp', jpeg:'image/jpeg' };
  const q = fmt === 'jpeg' ? 0.95 : undefined;
  const a = document.createElement('a');
  a.href = genCvs.toDataURL(mimeMap[fmt] || 'image/png', q);
  a.download = 'qr.' + fmt;
  a.click();
});

document.getElementById('copyQR').addEventListener('click', () => {
  if (genCvs.style.display === 'none') { toast('Generate a QR code first', 'bad'); return; }
  genCvs.toBlob(async blob => {
    try { await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]); toast('Image copied', 'ok'); }
    catch(e) { toast('Copy not supported in this browser', 'bad'); }
  }, 'image/png');
});

// update iOS save whenever QR changes — called from inside generateQR
genType.addEventListener('change',()=>buildFields(genType.value));
genEcc.addEventListener('change',generateQR);
genMStyle.addEventListener('change',generateQR);
buildFields(genType.value);
