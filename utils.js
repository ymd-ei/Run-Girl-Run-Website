// ─────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────

function hexToRGB(hex){
  const result=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1],16)},${parseInt(result[2],16)},${parseInt(result[3],16)}` : null;
}

const nearby = {
  'a':'sqerz','b':'vdnp','c':'xzvo','d':'efbs','e':'wadr','f':'tgde','g':'tfhy','h':'jgyn',
  'i':'lkuo','j':'iukh','k':'ljix','l':'kpio','m':'nwkb','n':'mbhv','o':'iplc','p':'oqbl',
  'q':'wpa','r':'etdf','s':'azxe','t':'ryfg','u':'yhio','v':'bcfx','w':'qase','x':'czv',
  'y':'uhtg','z':'xsa',
  'A':'SQERZ','B':'VDNP','C':'XZVO','D':'EFBS','E':'WADR','F':'TGDE','G':'TFHY','H':'JGYN',
  'I':'LKUO','J':'IUKH','K':'LJIX','L':'KPIO','M':'NWKB','N':'MBHV','O':'IPLC','P':'OQBL',
  'Q':'WPA','R':'ETDF','S':'AZXE','T':'RYFG','U':'YHIO','V':'BCFX','W':'QASE','X':'CZV',
  'Y':'UHTG','Z':'XSA',' ':' '
};

function pool(ch){
  const p = nearby[ch] || nearby[ch.toLowerCase()] || 'abcdefghijklmnopqrstuvwxyz';
  return (p + ch).split('');
}

function phosphorIcon(url){
  if(url.startsWith('mailto:')) return 'ph-fill ph-envelope';
  if(url.includes('linkedin.com')) return 'ph-fill ph-linkedin-logo';
  if(url.includes('instagram.com')) return 'ph-fill ph-instagram-logo';
  if(url.includes('vimeo.com')) return 'ph-fill ph-vimeo-logo';
  if(url.includes('youtube.com')||url.includes('youtu.be')) return 'ph-fill ph-youtube-logo';
  if(url.includes('twitter.com')||url.includes('x.com')) return 'ph-fill ph-x-logo';
  if(url.includes('github.com')) return 'ph-fill ph-github-logo';
  if(url.includes('behance.net')) return 'ph-fill ph-behance-logo';
  if(url.includes('dribbble.com')) return 'ph-fill ph-dribbble-logo';
  if(url.includes('tiktok.com')) return 'ph-fill ph-tiktok-logo';
  return 'ph-fill ph-link';
}

function rescrambleSpan(span){
  const ch = span.dataset.ch;
  if(ch === ' ') return;
  const p = pool(ch);
  const cycles = 6;
  let tick = 0;
  function cycle(){
    if(tick < cycles){
      const overshoot = Math.max(0, tick - (cycles - 3));
      const speed = 110 * (1 + overshoot * 1.6);
      span.textContent = p[tick % p.length];
      tick++;
      setTimeout(cycle, speed);
    } else {
      span.textContent = ch;
    }
  }
  cycle();
}

function scheduleIdle(allSpanGroups){
  function runIdle(){
    const group = allSpanGroups[Math.floor(Math.random() * allSpanGroups.length)];
    const nonSpace = group.filter(s => s.dataset.ch !== ' ');
    if(!nonSpace.length){ setTimeout(runIdle, 4000); return; }
    const runLen = Math.min(nonSpace.length, 2 + Math.floor(Math.random() * 4));
    const startIdx = Math.floor(Math.random() * (nonSpace.length - runLen + 1));
    const run = nonSpace.slice(startIdx, startIdx + runLen);
    run.forEach((span, i) => setTimeout(() => rescrambleSpan(span), i * 80));
    const next = 4000 + Math.random() * 5000;
    setTimeout(runIdle, next);
  }
  setTimeout(runIdle, 5500);
}

function generateThumbSVG(type, accentColor, bgColor){
  accentColor = accentColor || '#71904c';
  bgColor = bgColor || '#e8e3da';
  const inkColor = '#1a1714';
  
  const svgs = {
    '2d': `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="${bgColor}"/><circle cx="200" cy="145" r="70" fill="none" stroke="${accentColor}" stroke-width="1.5"/><circle cx="200" cy="145" r="38" fill="${accentColor}" opacity="0.08"/><line x1="200" y1="75" x2="200" y2="215" stroke="${accentColor}" stroke-width="0.8" opacity="0.3"/><line x1="130" y1="145" x2="270" y2="145" stroke="${accentColor}" stroke-width="0.8" opacity="0.3"/><circle cx="200" cy="87" r="5" fill="${accentColor}"/></svg>`,
    '3d': `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="${bgColor}"/><polygon points="200,55 305,148 200,178 95,148" fill="none" stroke="${accentColor}" stroke-width="1.5"/><polygon points="200,178 305,148 305,222 200,252" fill="${accentColor}" opacity="0.06" stroke="${accentColor}" stroke-width="0.8"/><polygon points="200,178 95,148 95,222 200,252" fill="${inkColor}" opacity="0.03" stroke="${inkColor}" stroke-width="0.5"/><circle cx="200" cy="55" r="4" fill="${accentColor}"/></svg>`,
    'motion': `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="${bgColor}"/><rect x="80" y="115" width="240" height="2.5" fill="${accentColor}" rx="1"/><rect x="80" y="128" width="180" height="2" fill="${inkColor}" opacity="0.18" rx="1"/><rect x="80" y="141" width="210" height="2" fill="${inkColor}" opacity="0.12" rx="1"/><rect x="80" y="75" width="55" height="20" rx="2" fill="${accentColor}"/></svg>`
  };
  
  return svgs[type] || svgs.motion;
}

function startTicker(track, speed){
  if(!track) return;
  if(track._tickerRunning) return;
  track._tickerRunning = true;

  const trackW = track.scrollWidth;
  const absSpeed = Math.abs(speed);
  const movingLeft = speed > 0;
  const loopPoint = trackW / 4;
  let offset = movingLeft ? 0 : -loopPoint;
  let raf;

  function tick(){
    offset += movingLeft ? -absSpeed : absSpeed;
    if(movingLeft && offset < -loopPoint) offset = 0;
    if(!movingLeft && offset > 0) offset = -loopPoint;
    track.style.transform = `translateX(${offset}px)`;
    raf = requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ cancelAnimationFrame(raf); }
    else { raf = requestAnimationFrame(tick); }
  });

  raf = requestAnimationFrame(tick);
}

function startSensitiveTicker(track, speed){
  if(!track||track._tickerRunning) return;
  track._tickerRunning = true;
  const trackW = track.scrollWidth;
  const loopPoint = trackW / 4;
  let offset = 0;
  let raf;
  function tick(){
    offset -= speed;
    if(offset < -loopPoint) offset = 0;
    track.style.transform = `translateX(${offset}px)`;
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
}
