// ─────────────────────────────────────────
// STATE & CURSOR
// ─────────────────────────────────────────
let C={},projects=[],bgPlayer=null;

const cur=document.getElementById('cur');
document.addEventListener('mousemove',e=>{cur.style.left=e.clientX+'px';cur.style.top=e.clientY+'px'},{passive:true});
const hs='a,button,.wc,.bp,.fb,.cl,.backbtn,#watch-reel,#lb-close,.ct-icon-btn,.ct-email-link,.ct-resume-link,#ct-close';
document.addEventListener('mouseover',e=>{if(e.target.closest(hs))document.body.classList.add('ch')});
document.addEventListener('mouseout',e=>{if(e.target.closest(hs))document.body.classList.remove('ch')});

// ─────────────────────────────────────────
// THUMBNAIL & BLOCK RENDERING
// ─────────────────────────────────────────
function thumb(type){
  const accentColor = C.theme?.accent || '#71904c';
  const bgColor = C.theme?.paper || '#e8e3da';
  const svg = generateThumbSVG(type, accentColor, bgColor);
  return`<div class="tph">${svg}</div>`;
}

function renderBlock(b){
  const al=b.align==='center'?'ac':b.align==='right'?'ar':'';
  switch(b.type){
    case 'text-sm': return`<p class="bl-text-sm ${al}">${b.content}</p>`;
    case 'text-md': return`<p class="bl-text-md ${al}">${b.content}</p>`;
    case 'text-lg': return`<p class="bl-text-lg ${al}">${b.content}</p>`;
    case 'image':
      if(b.src) return`<div class="bl-image"><img src="${b.src}" alt="${b.alt||''}"></div>`;
      return`<div class="bl-image empty">${b.alt||'Image'}</div>`;
    case 'twocol':
      return`<div class="bl-twocol"><div>${renderBlock(b.left)}</div><div>${renderBlock(b.right)}</div></div>`;
    case 'quote':
      return`<div class="bl-quote ${al}"><p>${b.content}</p></div>`;
    case 'video':
      if(b.src) return`<div class="bl-video"><iframe src="${b.src}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
      return`<div class="bl-video empty">Video embed</div>`;
    case 'stats':
      const cols=b.items.length;
      return`<div class="bl-stats" style="grid-template-columns:repeat(${cols},1fr)">${b.items.map(s=>`<div class="sc"><div class="sn" data-target="${s.num}">${s.num}</div><div class="sl">${s.label}</div></div>`).join('')}</div>`;
    case 'skills':
      return`<div class="bl-skills" id="skl">${b.items.map(s=>`<div class="skr"><div class="skn"><span>${s.name}</span><span>${s.pct}%</span></div><div class="skb"><div class="skf" style="--pct:${s.pct/100}"></div></div></div>`).join('')}</div>`;
    case 'divider':
      return`<div class="bl-divider"></div>`;
    default: return'';
  }
}

function renderBlocks(blocks){
  return`<div class="block-canvas">${blocks.map(renderBlock).join('')}</div>`;
}

// ─────────────────────────────────────────
// DATA LOADING & PREVIEW BRIDGE
// ─────────────────────────────────────────
async function load(){
  C=await fetch('content.json?v='+Date.now()).then(r=>r.json());
  projects=await Promise.all(C.projects.map(id=>fetch('projects/'+id+'.json?v='+Date.now()).then(r=>r.json())));
  render();
}

window.addEventListener('message', e=>{
  if(e.data.type==='preview-data'){
    C=e.data.content;
    projects=e.data.projects;
    render();
  }
  if(e.data.type==='preview-nav'){
    const panel=e.data.panel;
    if(panel==='home') closeToRoot();
    else if(panel==='about') openPanel('about');
    else if(panel==='contact') openPanel('contact');
    else if(panel==='project'&&e.data.projectId) {
      document.getElementById('panel-work').classList.add('open');
      document.getElementById('bd').classList.add('open');
      openProject(e.data.projectId);
    }
  }
});

// ─────────────────────────────────────────
// COUNT UP & ANIMATIONS
// ─────────────────────────────────────────
function countUp(el){
  const raw = el.dataset.target;
  const stripped = raw.replace(/,/g,'');
  const match = stripped.match(/^([\d.]+)([^\d.]*)$/);
  if(!match){ el.textContent=raw; return; }
  const end = parseFloat(match[1]);
  const suffix = match[2]||'';
  const useCommas = /,/.test(raw);
  const duration = 1800;
  const steps = 60;
  const interval = duration / steps;
  let step = 0;
  el.textContent = '0' + suffix;
  const timer = setInterval(()=>{
    step++;
    const progress = step/steps;
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(end * ease);
    const formatted = useCommas ? current.toLocaleString() : current;
    el.textContent = formatted + suffix;
    if(step >= steps){ el.textContent = raw; clearInterval(timer); }
  }, interval);
}

function initCountUps(){
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.querySelectorAll('.sn[data-target]').forEach(el => countUp(el));
        obs.unobserve(e.target);
      }
    });
  }, {threshold: 0.5});
  document.querySelectorAll('.bl-stats').forEach(el => obs.observe(el));
}

function scrambleHero(role, line1, line2){
  const roleEl = document.getElementById('hero-role');
  const nameEl = document.getElementById('hero-name');

  roleEl.innerHTML = role.split('').map(ch =>
    ch===' ' ? `<span class="sc-char" data-ch=" " style="opacity:0">&nbsp;</span>`
              : `<span class="sc-char" data-ch="${ch}" style="opacity:0">${ch}</span>`
  ).join('');

  nameEl.innerHTML =
    line1.split('').map(ch =>
      `<span class="sc-char" data-ch="${ch}" style="opacity:0">${ch}</span>`
    ).join('') +
    (line2 ? '<br>' + line2.split('').map(ch =>
      `<span class="sc-char sc-em" data-ch="${ch}" style="opacity:0;color:var(--accent);font-style:italic;">${ch}</span>`
    ).join('') : '');

  function animateSpans(spans, startDelay, charDelay, cycleMs, cycles){
    spans.forEach((span, i) => {
      const ch = span.dataset.ch;
      const isSpace = ch === ' ';
      const delay = startDelay + i * charDelay;
      const p = isSpace ? [' '] : pool(ch);
      let tick = 0;
      setTimeout(() => {
        span.style.opacity = '1';
        if(isSpace){ span.innerHTML = '&nbsp;'; return; }
        function cycle(){
          if(tick < cycles){
            const overshoot = Math.max(0, tick - (cycles - 4));
            const speed = cycleMs * (1 + overshoot * 1.4);
            span.textContent = p[tick % p.length];
            tick++;
            setTimeout(cycle, speed);
          } else {
            span.textContent = ch;
          }
        }
        cycle();
      }, delay);
    });
  }

  const START = 600;
  const roleSpans  = Array.from(roleEl.querySelectorAll('.sc-char'));
  const nameSpans  = Array.from(nameEl.querySelectorAll('.sc-char:not(.sc-em)'));
  const emSpans    = Array.from(nameEl.querySelectorAll('.sc-em'));

  const roleDuration = roleSpans.length * 60;
  animateSpans(roleSpans, START, 60, 90, 7);

  const nameLine1Start = START + roleDuration * 0.55;
  animateSpans(nameSpans, nameLine1Start, 90, 100, 8);

  const nameLine2Start = nameLine1Start + nameSpans.length * 90 * 0.4;
  animateSpans(emSpans, nameLine2Start, 90, 100, 8);

  scheduleIdle([roleSpans, nameSpans, emSpans]);
}

// ─────────────────────────────────────────
// LOG PANEL
// ─────────────────────────────────────────
async function loadLog(){
  try{
    const entries = await fetch('log.json?v='+Date.now()).then(r=>r.json());
    const el = document.getElementById('log-body');
    if(!entries.length){
      el.innerHTML='<p class="log-empty">Nothing here yet.</p>';
    } else {
      el.innerHTML='<div class="log-entries">'+
        [...entries].reverse().map(e=>
          `<div class="log-entry"><span class="log-date">${e.date}</span><span class="log-text">${e.text}</span></div>`
        ).join('')+
      '</div>';
    }

    const inner = document.getElementById('ls-inner');
    const SHOW = 8;
    let rotateIdx = entries.length - 1;
    const recent = entries.slice(-SHOW);
    const logSpanGroups = [];

    function buildEntry(text, opacity){
      const span = document.createElement('span');
      span.className = 'ls-entry';
      span.dataset.opacity = opacity;
      span.innerHTML = text.split('').map(ch =>
        ch === ' '
          ? `<span class="sc-char" data-ch=" " style="opacity:0">&nbsp;</span>`
          : `<span class="sc-char" data-ch="${ch}" style="opacity:0">${ch}</span>`
      ).join('');
      return span;
    }

    function scrambleEntry(entry, delay){
      const spans = Array.from(entry.querySelectorAll('.sc-char'));
      logSpanGroups.push(spans);

      const revealWindowMs = 550;
      const revealableChars = spans.filter(span => span.dataset.ch !== ' ').length;
      const perCharDelay = revealableChars > 1 ? revealWindowMs / (revealableChars - 1) : 0;
      let revealIndex = 0;

      spans.forEach(span => {
        const ch = span.dataset.ch;
        const isSpace = ch === ' ';
        const p = isSpace ? [' '] : pool(ch);
        let tick = 0; const cycles = 6;
        const staggerDelay = isSpace ? revealIndex * perCharDelay : revealIndex++ * perCharDelay;
        setTimeout(() => {
          span.style.opacity = '1';
          if(isSpace){ span.innerHTML = '&nbsp;'; return; }
          function cycle(){
            if(tick < cycles){
              const overshoot = Math.max(0, tick-(cycles-3));
              span.textContent = p[tick % p.length];
              tick++;
              setTimeout(cycle, 90*(1+overshoot*1.4));
            } else { span.textContent = ch; }
          }
          cycle();
        }, delay + staggerDelay);
      });
      return spans;
    }

    recent.forEach((e, i) => {
      const opacity = 0.1 + (i / (recent.length - 1 || 1)) * 0.9;
      const entry = buildEntry(e.text, opacity);
      inner.appendChild(entry);
      const delay = 1400 + i * 120;
      setTimeout(() => {
        entry.style.opacity = opacity;
        scrambleEntry(entry, 0);
      }, delay);
    });

    setTimeout(() => {
      const stack = document.getElementById('log-stack');
      const innerEl = document.getElementById('ls-inner');
      runWhenLayoutStable(() => {
        stack.style.height = innerEl.offsetHeight + 'px';
      });
    }, 1400 + recent.length * 120 + 500);

    const logIdleStart = 1400 + recent.length * 120 + 2000;
    setTimeout(() => scheduleIdle(logSpanGroups), logIdleStart);

    if(entries.length > 1){
      function rotateStack(){
        rotateIdx = (rotateIdx + 1) % entries.length;
        const newText = entries[rotateIdx].text;
        const newEntry = buildEntry(newText, 0);
        newEntry.style.opacity = '0';
        inner.appendChild(newEntry);

        runWhenLayoutStable(() => {
          const topEntry = inner.querySelector('.ls-entry');
          const innerStyles = window.getComputedStyle(inner);
          const gap = parseFloat(innerStyles.rowGap || innerStyles.gap || '0') || 0;
          const shiftRaw = topEntry ? topEntry.getBoundingClientRect().height + gap : 18;
          const shift = Math.max(18, Math.round(shiftRaw));

          let finalized = false;
          let cleanupFallback = null;

          const finalizeRotation = () => {
            if(finalized) return;
            finalized = true;
            if(cleanupFallback) clearTimeout(cleanupFallback);

            const top = inner.querySelector('.ls-entry');
            if(top) top.remove();
            inner.style.transition = 'none';
            inner.style.transform = 'translateY(0)';
            requestAnimationFrame(() => {
              inner.style.transition = '';
            });
          };

          const onTransformEnd = event => {
            if(event.target !== inner || event.propertyName !== 'transform') return;
            inner.removeEventListener('transitionend', onTransformEnd);
            finalizeRotation();
          };

          inner.addEventListener('transitionend', onTransformEnd);
          inner.style.transform = `translateY(-${shift}px)`;

          setTimeout(() => {
            newEntry.style.opacity = '1';
            const allEntries = Array.from(inner.querySelectorAll('.ls-entry'));
            const top = allEntries[0];
            if(top) top.style.opacity = '0';

            allEntries.slice(1).forEach((item, i) => {
              item.dataset.opacity = 0.1 + (i / (SHOW - 1)) * 0.9;
              item.style.opacity = item.dataset.opacity;
            });

            const spans = scrambleEntry(newEntry, 0);
            logSpanGroups.push(spans);
            if(logSpanGroups.length > SHOW) logSpanGroups.shift();
          }, 600);

          cleanupFallback = setTimeout(() => {
            inner.removeEventListener('transitionend', onTransformEnd);
            finalizeRotation();
          }, 1500);
        });

        setTimeout(rotateStack, 12000);
      }

      setTimeout(rotateStack, logIdleStart + 12000);
    }

  }catch(e){
    document.getElementById('log-body').innerHTML='<p class="log-empty">Could not load log.</p>';
  }
}

function runWhenLayoutStable(task){
  const run=()=>{
    // Double RAF gives the browser a frame to apply final styles before layout reads.
    requestAnimationFrame(()=>{
      requestAnimationFrame(task);
    });
  };

  if(document.readyState==='complete'){
    run();
    return;
  }

  window.addEventListener('load', run, {once:true});
}

// ─────────────────────────────────────────
// THEME & RENDER
// ─────────────────────────────────────────
function applyTheme(t){
  if(!t) return;
  const el = document.getElementById('theme-vars');
  const vars = [
    t.ink        && `--ink:${t.ink}`,
    t.paper      && `--paper:${t.paper}`,
    t.accent     && `--accent:${t.accent}`,
    t.accent     && `--accent-rgb:${hexToRGB(t.accent)}`,
    t.surface    && `--surface:${t.surface}`,
    t.panelBg    && `--panel-bg:${t.panelBg}`,
    t.ctAccent   && `--ct-accent:${t.ctAccent}`,
    t.ctBg       && `--ct-bg:${t.ctBg}`,
    t.ctHi       && `--ct-hi:${t.ctHi}`,
    t.sensitiveColor && `--sensitive-color:${t.sensitiveColor}`,
  ].filter(Boolean).join(';');
  el.textContent = vars ? `:root{${vars}}` : '';
  updatePatternStyles(t);
}

function updatePatternStyles(t){
  const accentColor = t.accent || '#71904c';
  const accentRgb = hexToRGB(accentColor);
  const patternSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><circle cx='0' cy='0' r='0.75' fill='${accentColor}' fill-opacity='0.2'/><circle cx='6' cy='6' r='0.75' fill='${accentColor}' fill-opacity='0.2'/><circle cx='10' cy='0' r='0.75' fill='${accentColor}' fill-opacity='0.2'/><circle cx='10' cy='10' r='0.75' fill='${accentColor}' fill-opacity='0.2'/><circle cx='0' cy='10' r='0.75' fill='${accentColor}' fill-opacity='0.2'/></svg>`;
  const encoded = encodeURIComponent(patternSvg);
  const dataUri = `url("data:image/svg+xml,${encoded}")`;
  
  let styleEl = document.getElementById('pattern-styles');
  if(!styleEl){
    styleEl = document.createElement('style');
    styleEl.id = 'pattern-styles';
    document.head.appendChild(styleEl);
  }
  
  styleEl.textContent = `#panel-work .pb,#panel-about .pb{background-image:repeating-linear-gradient(-55deg,transparent,transparent 14px,rgba(${accentRgb},0.2) 14px,rgba(${accentRgb},0.2) 15px),${dataUri};background-size:20px 100%,10px 10px}`;
}

function render(){
  applyTheme(C.theme);
  document.getElementById('nav-name').textContent=C.name;
  document.title=C.siteTitle||C.name||'Portfolio';
  if(C.favicon){
    const src=C.favicon+'?v='+Date.now();
    document.getElementById('favicon').href=src;
    document.getElementById('favicon-apple').href=src;
    document.getElementById('favicon-mask').href=src;
  }
  const parts=C.name.split(' ');
  const line1=parts[0];
  const line2=parts.slice(1).join(' ');
  scrambleHero(C.role, line1, line2);

  const reelEl=document.getElementById('reel');
  if(C.reel&&C.reel.url){
    if(C.reel.type==='youtube')reelEl.innerHTML=`<iframe src="${C.reel.url}" allow="autoplay; fullscreen" allowfullscreen></iframe><div id="reel-block"></div>`;
    else if(C.reel.type==='vimeo'){reelEl.innerHTML=`<iframe id="bg-reel-iframe" src="${C.reel.url}" allow="autoplay; fullscreen" allowfullscreen></iframe><div id="reel-block"></div>`;bgPlayer=new Vimeo.Player(document.getElementById('bg-reel-iframe'));}
    else if(C.reel.type==='video')reelEl.innerHTML=`<video autoplay muted loop playsinline src="${C.reel.url}"></video><div id="reel-block"></div>`;
  }else{
    reelEl.innerHTML=`<div id="rp"><div class="pg"></div><div class="pi"><div class="bp"><div class="bpt"></div></div><p class="pl">Demo Reel Goes Here</p></div></div>`;
  }

  const filters = C.filters||[{value:'2d',label:'2D'},{value:'3d',label:'3D'},{value:'motion',label:'Motion'}];
  document.getElementById('work-filters').innerHTML=
    `<button class="fb active" onclick="filterWork(this,'all')">All</button>`+
    filters.map(f=>`<button class="fb" onclick="filterWork(this,'${f.value}')">${f.label}</button>`).join('');

  document.getElementById('wg').innerHTML=projects.filter(p=>p.published!==false).map(p=>{
    const isSensitive = p.sensitive;
    const label = p.sensitiveLabel || 'MATURE';
    const color = p.sensitiveColor || (C.theme&&C.theme.sensitiveColor) || '#e03030';
    const sensitiveOverlay = isSensitive ? `
      <div class="wci-sensitive">
        <div class="wci-tape" id="st-${p.id}" style="--sensitive-color:${color}">
          <div class="wci-tape-track"></div>
        </div>
      </div>` : '';
    return `<div class="wc" data-type="${p.type}" onclick="openProject('${p.id}')">
      <div class="wci ${isSensitive?'wci-blur':''}">
        ${p.thumbnail?`<img src="${p.thumbnail}" alt="${p.title}">`:thumb(p.type)}
        <div class="wco"></div>
        ${sensitiveOverlay}
      </div>
      <div class="wcm"><p class="wct">${p.title}</p><p class="wcty">${p.typeLabel} &middot; ${p.year}</p></div>
    </div>`;
  }).join('');

  projects.filter(p=>p.published!==false&&p.sensitive).forEach(p=>{
    const tape = document.querySelector(`#st-${p.id} .wci-tape-track`);
    if(!tape) return;
    const label = p.sensitiveLabel || 'MATURE';
    const items = Array(12).fill(label);
    tape.innerHTML = items.map(w=>`<span style="display:inline-flex;align-items:center;padding:0 .3rem"><span class="wci-tape-word">${w}</span><span class="wci-tape-dot"></span></span>`).join('');
    const angle = (8 + Math.random() * 10) * (Math.random() > 0.5 ? 1 : -1);
    document.getElementById('st-'+p.id).style.transform = `rotate(${angle}deg)`;
    document.getElementById('st-'+p.id).style.top = '35%';
    startSensitiveTicker(tape, 0.4);
  });

  document.getElementById('about-body').innerHTML=renderBlocks(C.about||[]);
  setTimeout(initCountUps, 100);
  loadLog();

  const cp = C.contactPanel||{};
  const defaultTicker = ['3D Animation','Motion Design','Original Films','Character Animation','In-House Production','2D Animation','Rigging','Compositing','Visual Development','Original Features'];

  const ctTitle  = cp.title||"Let's";
  const ctAccent = cp.titleAccent||'work.';
  const ctSub    = cp.sub||'Animation, motion, original features — whatever the idea, we\'re built for it. Let\'s talk.';
  const ctCue    = cp.scrollCue||'See how to reach us';
  document.querySelector('.ct-hero').innerHTML = ctTitle+'<br><span class="accent-word">'+ctAccent+'</span>';
  document.querySelector('.ct-sub').innerHTML = ctSub;
  document.querySelector('.ct-scroll-cue').innerHTML = '<span class="ct-scroll-line"></span>'+ctCue;

  document.querySelector('.ct-email-label').textContent = cp.emailLabel||'Drop us a line';
  document.querySelector('.ct-social-label').textContent = cp.socialLabel||'Find us';
  const resumeLabelEl = document.querySelector('.ct-resume-block .ct-email-label');
  if(resumeLabelEl) resumeLabelEl.textContent = cp.resumeLabel||'Credentials';

  document.getElementById('ct-location').textContent = (C.name||'') + (C.location ? '\u00a0·\u00a0'+C.location : '');

  const email = C.contact.email||'';
  document.getElementById('ct-email-link').href = email ? 'mailto:'+email : '#';
  document.getElementById('ct-email-text').textContent = email;

  document.getElementById('ct-footer-name').textContent = C.name||'';
  document.getElementById('ct-footer-loc').textContent = C.location||'';

  document.getElementById('ct-icons').innerHTML=(C.contact.links||[]).map(l=>`
    <a href="${l.url}" target="${l.url.startsWith('mailto')?'_self':'_blank'}" rel="noopener" class="ct-icon-btn" title="${l.label}">
      <i class="${phosphorIcon(l.url)}"></i>
    </a>`).join('');

  if(C.contact.resume){
    document.getElementById('ct-resume-wrap').style.display='';
    document.getElementById('ct-resume-link').href=C.contact.resume;
  } else {
    document.getElementById('ct-resume-wrap').style.display='none';
  }

  function makeTickerHTML(items){
    const copies = [...items,...items,...items,...items];
    return copies.map(w=>`<span class="ticker-item"><span class="ticker-word">${w}</span><span class="ticker-dot"></span></span>`).join('');
  }
  const topItems = (cp.tickerTop&&cp.tickerTop.length) ? cp.tickerTop : defaultTicker;
  const midItems = (cp.tickerMid&&cp.tickerMid.length) ? cp.tickerMid : defaultTicker;
  document.querySelector('#ct-ticker-top .ticker-track').innerHTML = makeTickerHTML(topItems);
  document.querySelector('#ct-ticker-mid .ticker-track').innerHTML = makeTickerHTML(midItems);

  const ctVid = document.getElementById('ct-bg-video');
  const vid = (cp.video&&cp.video.url&&cp.video.type!=='placeholder') ? cp.video : C.reel;
  if(vid&&vid.url){
    if(vid.type==='vimeo'||vid.type==='youtube'){
      ctVid.innerHTML=`<iframe src="${vid.url}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    } else if(vid.type==='video'){
      ctVid.innerHTML=`<video autoplay muted loop playsinline src="${vid.url}"></video>`;
    }
  }
}

// ─────────────────────────────────────────
// PANEL & LIGHTBOX CONTROLS
// ─────────────────────────────────────────
function openPanel(name){
  document.getElementById('pp').classList.remove('open');
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('open'));
  document.querySelectorAll('.nls button').forEach(b=>b.classList.remove('active'));
  const btn=[...document.querySelectorAll('.nls button')].find(b=>b.getAttribute('onclick').includes("'"+name+"'"));
  if(btn)btn.classList.add('active');

  if(name==='contact'){
    document.body.classList.add('contact-open');
    document.getElementById('stage').classList.add('contact-open');
    document.getElementById('contact-wrapper').classList.add('open');
    document.getElementById('ct-close').classList.add('open');
    document.getElementById('ct-sliver').classList.add('open');
    document.getElementById('contact-wrapper').scrollTop=0;
    updateCtBg(0);
    jitterTapes();
    setTimeout(()=>{
      startTicker(document.querySelector('#ct-ticker-top .ticker-track'), -0.6);
      startTicker(document.querySelector('#ct-ticker-mid .ticker-track'), 0.5);
    }, 820);
    return;
  }

  document.getElementById('bd').classList.add('open');
  document.getElementById('panel-'+name).classList.add('open');
  if(name==='about')setTimeout(()=>document.querySelectorAll('#skl .skf').forEach(b=>b.classList.add('go')),340);
}

function openProject(id){
  const p=projects.find(x=>x.id===id);if(!p)return;
  document.getElementById('ppb').innerHTML=renderBlocks(p.blocks||[]);
  document.getElementById('ppb').scrollTop=0;
  document.getElementById('pp').classList.add('open');
}

function openLightbox(){
  if(!C.reel||!C.reel.url){alert('Add your reel URL to content.json first!');return;}
  let src=C.reel.url;
  if(C.reel.type==='youtube'){
    src=src.replace('&controls=0','').replace('&mute=1','');
    if(!src.includes('controls=1'))src+='&controls=1';
  } else if(C.reel.type==='vimeo'){
    src=src.replace('background=1','background=0').replace('&muted=1','').replace('autoplay=1','autoplay=0');
    if(!src.includes('autoplay'))src+='&autoplay=1';
  }
  const lbFrame = document.getElementById('lb-frame');
  lbFrame.innerHTML=`<iframe id="lb-iframe" src="${src}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  document.getElementById('lightbox').classList.add('open');
  if(C.reel.type==='vimeo'){
    const lbPlayer = new Vimeo.Player(document.getElementById('lb-iframe'));
    lbPlayer.ready().then(()=>lbPlayer.play().catch(()=>{}));
  }
}

function closeLightbox(){
  document.getElementById('lightbox').classList.remove('open');
  setTimeout(()=>{
    document.getElementById('lb-frame').innerHTML='';
    if(bgPlayer) bgPlayer.play().catch(()=>{});
  },400);
}

function smartClose(){
  if(document.getElementById('pp').classList.contains('open'))closeProject();
  else closeToRoot();
}

function closeProject(){document.getElementById('pp').classList.remove('open')}

function closeToRoot(){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('open'));
  document.getElementById('bd').classList.remove('open');
  document.body.classList.remove('contact-open');
  document.getElementById('stage').classList.remove('contact-open');
  document.getElementById('contact-wrapper').classList.remove('open');
  document.getElementById('ct-close').classList.remove('open');
  document.getElementById('ct-sliver').classList.remove('open');
  document.querySelectorAll('.nls button').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('#skl .skf').forEach(b=>b.classList.remove('go'));
  const top = document.querySelector('#ct-ticker-top .ticker-track');
  const mid = document.querySelector('#ct-ticker-mid .ticker-track');
  if(top) delete top._tickerRunning;
  if(mid) delete mid._tickerRunning;
}

function filterWork(btn,type){
  document.querySelectorAll('.fb').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  document.querySelectorAll('#wg .wc').forEach(c=>{const show=type==='all'||c.dataset.type===type;c.style.opacity=show?'1':'0.15';c.style.pointerEvents=show?'':'none'});
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(document.getElementById('lightbox').classList.contains('open'))closeLightbox();
    else if(document.getElementById('pp').classList.contains('open'))closeProject();
    else closeToRoot();
  }
});

// ─────────────────────────────────────────
// CONTACT PANEL HELPERS
// ─────────────────────────────────────────
function jitterTapes(){
  const topAngle = 17 + Math.random()*6;
  const midAngle = -5 + Math.random()*5;
  const top = document.querySelector('.ct-ticker.tape-top');
  const mid = document.querySelector('.ct-ticker.tape-mid');
  if(top) top.style.transform=`rotate(${topAngle}deg)`;
  if(mid) mid.style.transform=`rotate(${midAngle}deg)`;
}

function updateCtBg(scrollY){
  const progress=Math.min(scrollY/window.innerHeight,1);
  const vid=document.getElementById('ct-bg-video');
  const dark=document.getElementById('ct-bg-dark');
  if(vid) vid.style.filter=`saturate(0.55) brightness(0.9) blur(${progress*16}px)`;
  if(dark) dark.style.background=`rgba(8,8,8,${progress*0.68})`;
}

document.getElementById('contact-wrapper').addEventListener('scroll',()=>updateCtBg(document.getElementById('contact-wrapper').scrollTop),{passive:true});

// ─────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────
(function(){
  if(new URLSearchParams(location.search).has('preview')){
    const l=document.getElementById('loader');
    if(l){ l.style.display='none'; }
    return;
  }

  document.body.classList.add('page-loading');

  const nameEl = document.getElementById('loader-name');
  const bar    = document.getElementById('loader-bar');
  const loader = document.getElementById('loader');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nameText = 'RUN GIRL RUN';

  function runLoaderName(){
    nameEl.innerHTML = nameText.split('').map(ch =>
      ch === ' '
        ? `<span style="width:.4em;display:inline-block"> </span>`
        : `<span style="opacity:0">${ch}</span>`
    ).join('');
    const allSpans  = [...nameEl.querySelectorAll('span:not([style*="width"])')];
    const finalChars = nameText.split('').filter(c => c !== ' ');

    setTimeout(()=>{
      allSpans.forEach(sp => {
        sp.style.opacity = '1';
        sp.textContent = chars[Math.floor(Math.random()*chars.length)];
      });

      const noiseTimer = setInterval(()=>{
        allSpans.forEach(sp => {
          if(!sp.dataset.settled)
            sp.textContent = chars[Math.floor(Math.random()*chars.length)];
        });
      }, 55);

      allSpans.forEach((sp, i) => {
        setTimeout(()=>{
          sp.dataset.settled = '1';
          sp.textContent = finalChars[i];
          if(i === allSpans.length - 1) clearInterval(noiseTimer);
        }, i * 80);
      });
    }, 80);
  }

  runLoaderName();

  const numStops = 2 + Math.floor(Math.random() * 2);
  const stops = [];
  let cursor = 0;
  for(let i = 0; i < numStops; i++){
    cursor += 15 + Math.random() * 35;
    if(cursor < 90) stops.push(Math.round(cursor));
  }
  stops.push(100);

  let stopIdx = 0;
  function animateBar(){
    if(stopIdx >= stops.length) return;
    const target = stops[stopIdx];
    const prev   = stopIdx === 0 ? 0 : stops[stopIdx - 1];
    const range  = target - prev;
    const duration = 280 + Math.random() * 340;
    const startTime = performance.now();

    function step(now){
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      bar.style.width = (prev + range * eased) + '%';
      if(t < 1){ requestAnimationFrame(step); }
      else {
        bar.style.width = target + '%';
        stopIdx++;
        if(target < 100){
          const pause = 180 + Math.random() * 420;
          setTimeout(animateBar, pause);
        } else {
          setTimeout(dismiss, 260);
        }
      }
    }
    requestAnimationFrame(step);
  }

  setTimeout(animateBar, 120);

  function dismiss(){
    loader.classList.add('done');
    document.body.classList.remove('page-loading');
  }

  setTimeout(()=>{ if(!loader.classList.contains('done')) dismiss(); }, 4000);
})();

load();
