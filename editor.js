// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let C={}, projects=[], currentPage='global', currentProjectId=null, dirty=false;
let openBlocks = new Set();
let dirtyFiles = new Set(); // tracks which files actually need saving

// Undo/redo history
let history=[], historyIdx=-1;
const MAX_HISTORY=50;

function snapshot(label){
  // Trim any future states if we branched
  history=history.slice(0,historyIdx+1);
  history.push({label, C:JSON.parse(JSON.stringify(C)), projects:JSON.parse(JSON.stringify(projects))});
  if(history.length>MAX_HISTORY) history.shift();
  historyIdx=history.length-1;
  updateUndoBar();
}

function undo(){
  if(historyIdx<=0) return;
  historyIdx--;
  const s=history[historyIdx];
  C=JSON.parse(JSON.stringify(s.C));
  projects=JSON.parse(JSON.stringify(s.projects));
  rebuildAfterHistoryChange();
}

function redo(){
  if(historyIdx>=history.length-1) return;
  historyIdx++;
  const s=history[historyIdx];
  C=JSON.parse(JSON.stringify(s.C));
  projects=JSON.parse(JSON.stringify(s.projects));
  rebuildAfterHistoryChange();
}

function rebuildAfterHistoryChange(){
  applyEditorTheme();
  rendered.clear(); // all pages need re-render after undo/redo
  buildNav();
  // Re-render currently visible page immediately
  if(currentPage==='global') renderGlobal();
  else if(currentPage==='about') renderAbout();
  else if(currentPage==='contact') renderContact();
  else if(currentPage==='project'&&currentProjectId){
    const p=projects.find(x=>x.id===currentProjectId);
    if(p) renderProject(currentProjectId);
    else { currentProjectId=null; showPage('global'); }
  }
  rendered.add(currentPage);
  markDirty();
  updateUndoBar();
}

function updateUndoBar(){
  const bar=document.getElementById('undo-bar');
  const undoBtn=document.getElementById('undo-btn');
  const redoBtn=document.getElementById('redo-btn');
  const label=document.getElementById('undo-label');
  const canUndo=historyIdx>0;
  const canRedo=historyIdx<history.length-1;
  undoBtn.disabled=!canUndo;
  redoBtn.disabled=!canRedo;
  label.textContent=canUndo ? '('+history[historyIdx].label+')' : '';
  bar.classList.toggle('show', canUndo||canRedo);
}

// ─────────────────────────────────────────
// DATA LOADING & NAV
// ─────────────────────────────────────────
const rendered = new Set(); // tracks which pages have been rendered at least once

function markPageStale(name){ rendered.delete(name); }

function showPage(name){
  ['global','about','contact','media','project'].forEach(n=>{
    document.getElementById('page-'+n).style.display='none';
    const el=document.getElementById('nav-'+n); if(el)el.classList.remove('active');
  });
  projects.forEach(p=>{ const el=document.getElementById('nav-proj-'+p.id); if(el)el.classList.remove('active'); });
  document.getElementById('page-'+name).style.display='';
  const navEl=document.getElementById('nav-'+name); if(navEl)navEl.classList.add('active');
  currentPage=name;
  if(name!=='project') currentProjectId=null;
  // Only re-render if stale
  if(!rendered.has(name)){
    if(name==='global') renderGlobal();
    else if(name==='about') renderAbout();
    else if(name==='contact') renderContact();
    else if(name==='media') renderMediaPage();
    rendered.add(name);
  }
  sendPreviewNav();
}

function showProject(id){
  showPage('project');
  currentProjectId=id;
  const el=document.getElementById('nav-proj-'+id); if(el)el.classList.add('active');
  renderProject(id);
  sendPreviewNav();
}

async function loadAll(){
  try{
    C=await fetch('content.json?v='+Date.now()).then(r=>r.json());
    projects=await Promise.all(C.projects.map(id=>fetch('projects/'+id+'.json?v='+Date.now()).then(r=>r.json())));
    applyEditorTheme();
    buildNav();
    renderGlobal(); renderAbout(); renderContact(); renderMediaPage();
    rendered.add('global'); rendered.add('about'); rendered.add('contact'); rendered.add('media');
    initPreview();
    snapshot('initial');
  }catch(e){ toast('Error loading files: '+e.message,true); }
  setDeployStatus('idle');
}

function buildNav(){
  document.getElementById('sb-name').textContent=C.name;
  document.getElementById('project-nav').innerHTML=projects.map(p=>`
    <button class="ni" id="nav-proj-${p.id}" draggable="true"
      ondragstart="navDragStart(event,'${p.id}')"
      ondragover="navDragOver(event)"
      ondragend="navDragEnd(event)"
      ondrop="navDrop(event,'${p.id}')"
      ondragleave="navDragLeave(event)">
      <span style="color:var(--muted);font-size:.7rem;margin-right:.2rem;cursor:grab">&#9776;</span>
      <div class="dot"></div>
      <span onclick="showProject('${p.id}')" style="flex:1;text-align:left">${p.title}</span>
      <span class="badge">${p.type}</span>
    </button>`).join('');
}

// Keyboard shortcuts
document.addEventListener('keydown', e=>{
  if((e.metaKey||e.ctrlKey) && e.key==='z' && !e.shiftKey){ e.preventDefault(); undo(); }
  if((e.metaKey||e.ctrlKey) && (e.key==='y' || (e.key==='z' && e.shiftKey))){ e.preventDefault(); redo(); }
});

function showProject(id){
  showPage('project');
  currentProjectId=id;
  const el=document.getElementById('nav-proj-'+id); if(el)el.classList.add('active');
  renderProject(id);
  sendPreviewNav();
}

// ─────────────────────────────────────────
// PAGE RENDERERS — GLOBAL
// ─────────────────────────────────────────
function renderGlobal(){
  document.getElementById('page-global').innerHTML=`
    <div class="page-title">Site Settings</div>
    <div class="page-sub">Name, role, and demo reel.</div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Identity</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="row2">
          <div class="field"><label>Name</label><input value="${C.name}" oninput="C.name=this.value;document.getElementById('sb-name').textContent=this.value;markDirty()"></div>
          <div class="field"><label>Role</label><input value="${C.role}" oninput="C.role=this.value;markDirty()"></div>
        </div>
        <div class="field"><label>Site Title</label><input value="${C.siteTitle||''}" placeholder="${C.name} — Portfolio" oninput="C.siteTitle=this.value;markDirty()"><p class="hint">Browser tab title. Defaults to your name if left empty.</p></div>
        <div class="field"><label>Favicon</label>
          ${makeDropzone(C.favicon||'', v=>{ C.favicon=v; markDirty(); }, 'media', 'favicon.png', 'favicon_dz')}
          <button class="add-btn" style="margin-top:.35rem" onclick="openMediaLibrary(v=>{ C.favicon=v; markDirty(); },'favicon_dz_p')">&#x1F5C2; Browse Media</button>
          <p class="hint">Recommended: square PNG or ICO, at least 32×32px</p>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Demo Reel</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="field">
          <label>Paste YouTube / Vimeo embed code or URL</label>
          <textarea placeholder="Paste anything — full iframe code, share URL, or embed URL" oninput="parseReelInput(this.value)" style="min-height:60px">${C.reel.url||''}</textarea>
          <span class="hint" id="reel-hint">${reelHint()}</span>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Work Filters</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <p class="hint" style="margin-bottom:.5rem">These appear as filter buttons on the Work panel.</p>
        <div class="block-list" id="filters-list">
          ${(C.filters||[{value:'2d',label:'2D'},{value:'3d',label:'3D'},{value:'motion',label:'Motion'}]).map((f,i)=>`
            <div class="bk">
              <div class="bk-head">
                <span class="bk-type">Filter</span>
                <span class="bk-preview">${f.label} (${f.value})</span>
                <div class="bk-actions">
                  <button class="bk-btn del" onclick="removeFilter(${i})">&#x2715;</button>
                </div>
              </div>
              <div class="bk-body">
                <div class="row2">
                  <div class="field"><label>Label</label><input value="${f.label}" oninput="updateFilter(${i},'label',this.value)"></div>
                  <div class="field"><label>Value (no spaces)</label><input value="${f.value}" oninput="updateFilter(${i},'value',this.value)"></div>
                </div>
              </div>
            </div>`).join('')}
        </div>
        <button class="add-btn" onclick="addFilter()" style="margin-top:.5rem">+ Add Filter</button>
      </div>
    </div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Theme</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <p class="hint" style="margin-bottom:.75rem">Colours cascade through the whole site. Changes preview live.</p>
        <p class="hint" style="margin-bottom:.5rem;letter-spacing:.1em;text-transform:uppercase;font-size:.55rem">Main Site</p>
        <div class="row2">
          ${colorField('Background','ink','#1a1714')}
          ${colorField('Text / Paper','paper','#f2ede4')}
        </div>
        <div class="row2">
          ${colorField('Accent','accent','#5e30eb')}
          ${colorField('Panel Background','panelBg','#f7f3ec')}
        </div>
        <p class="hint" style="margin:.75rem 0 .5rem;letter-spacing:.1em;text-transform:uppercase;font-size:.55rem">Contact Panel</p>
        <div class="row2">
          ${colorField('Contact Accent','ctAccent','#ff4361')}
          ${colorField('Contact Background','ctBg','#080808')}
        </div>
        <div class="row2">
          ${colorField('Contact Text','ctHi','#ffffff')}
          ${colorField('Sensitive Tape','sensitiveColor','#e03030')}
        </div>
        <button class="add-btn" onclick="resetTheme()" style="margin-top:.5rem;border-color:#5a2020;color:#c06060">&#x21BA; Reset to defaults</button>
      </div>
    </div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Project Order</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <p class="hint" style="margin-bottom:.5rem">Drag to reorder. Draft projects are hidden from the site but shown here.</p>
        <div id="order-list" style="display:flex;flex-direction:column;gap:.3rem">
          ${C.projects.map((id,i)=>{
            const p=projects.find(x=>x.id===id);
            const isDraft=p&&p.published===false;
            return`<div draggable="true" data-id="${id}" onmousedown="this.style.cursor='grabbing'" onmouseup="this.style.cursor='grab'" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dropOn(event)" ondragend="dragEnd(event)" style="display:flex;align-items:center;gap:.6rem;padding:.45rem .7rem;background:var(--surface2);border:1px solid var(--border);font-size:.8rem;cursor:grab;user-select:none">
              <span style="color:var(--muted);font-size:.7rem">&#9776;</span>
              <span style="flex:1">${p?p.title:id}</span>
              ${isDraft?`<span style="font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);border:1px solid var(--accent);padding:.1rem .3rem">Draft</span>`:''} 
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────
// PAGE RENDERERS — ABOUT
// ─────────────────────────────────────────
function renderAbout(){
  document.getElementById('page-about').innerHTML=`
    <div class="page-title">About</div>
    <div class="page-sub">Build your about page with blocks.</div>
    <div class="block-list" id="about-blocks"></div>
    <button class="add-block-btn" onclick="toggleBlockMenu('about-menu')">+ Add Block</button>
    <div class="block-menu hidden" id="about-menu">${blockMenuHTML('about')}</div>
    <button class="md-import-btn" onclick="importMarkdown('about')" style="margin-top:.5rem">&#x1F4C4; Import from .md file</button>`;
  renderBlockList('about', C.about);
}

// ─────────────────────────────────────────
// PAGE RENDERERS — CONTACT
// ─────────────────────────────────────────
function getCP(){ return C.contactPanel||(C.contactPanel={}); }
function cpSet(key,val){ getCP()[key]=val; markDirty(); }

function parseContactVideo(raw){
  const val=raw.trim();
  if(!val){ getCP().video={type:'placeholder',url:''}; markDirty(); updateContactVideoHint('No video set'); return; }
  const srcMatch=val.match(/src=["']([^"']+)["']/);
  const url=srcMatch?srcMatch[1]:val;
  const ytEmbed=url.match(/youtube\.com\/embed\/([\w-]+)/);
  const ytShort=url.match(/youtu\.be\/([\w-]+)/);
  const ytWatch=url.match(/youtube\.com\/watch\?v=([\w-]+)/);
  const ytId=(ytEmbed&&ytEmbed[1])||(ytShort&&ytShort[1])||(ytWatch&&ytWatch[1]);
  if(ytId){ getCP().video={type:'youtube',url:`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&rel=0`}; markDirty(); updateContactVideoHint('&#x2713; YouTube detected'); return; }
  const vimeoEmbed=url.match(/player\.vimeo\.com\/video\/([\d]+)/);
  const vimeoWatch=url.match(/vimeo\.com\/([\d]+)/);
  const vimeoId=(vimeoEmbed&&vimeoEmbed[1])||(vimeoWatch&&vimeoWatch[1]);
  if(vimeoId){ getCP().video={type:'vimeo',url:`https://player.vimeo.com/video/${vimeoId}?autoplay=1&loop=1&background=1&muted=1`}; markDirty(); updateContactVideoHint('&#x2713; Vimeo detected'); return; }
  if(url.match(/\.(mp4|webm|ogg)$/i)){ getCP().video={type:'video',url}; markDirty(); updateContactVideoHint('&#x2713; Local video'); return; }
  updateContactVideoHint('Could not detect — paste a Vimeo or YouTube URL');
}
function updateContactVideoHint(msg){ const el=document.getElementById('ct-video-hint'); if(el)el.innerHTML=msg; }

function renderContact(){
  if(!C.contact.links) C.contact.links=[];
  const cp=getCP();
  const tickerTopVal=(cp.tickerTop||['3D Animation','Motion Design','Original Films','Character Animation','In-House Production','2D Animation','Rigging','Compositing','Visual Development','Original Features']).join('\n');
  const tickerMidVal=(cp.tickerMid||['3D Animation','Motion Design','Original Films','Character Animation','In-House Production','2D Animation','Rigging','Compositing','Visual Development','Original Features']).join('\n');

  document.getElementById('page-contact').innerHTML=`
    <div class="page-title">Contact</div>
    <div class="page-sub">Links, resume, and the contact panel content.</div>

    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Email &amp; Resume</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="field"><label>Email Address</label><input value="${C.contact.email||''}" placeholder="you@studio.com" oninput="C.contact.email=this.value;markDirty()"></div>
        <div class="field"><label>Resume PDF Path</label><input value="${C.contact.resume||''}" placeholder="resume/yourfile.pdf" oninput="C.contact.resume=this.value;markDirty()"><p class="hint">Path relative to site root</p></div>
      </div>
    </div>

    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Social Links</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="block-list" id="links-list">
          ${C.contact.links.map((l,i)=>`
            <div class="bk">
              <div class="bk-head">
                <span class="bk-type">Link</span>
                <span class="bk-preview">${l.label||''} — ${l.url||''}</span>
                <div class="bk-actions"><button class="bk-btn del" onclick="removeLink(${i})">&#x2715;</button></div>
              </div>
              <div class="bk-body">
                <div class="field"><label>Label</label><input value="${l.label||''}" oninput="C.contact.links[${i}].label=this.value;markDirty()"></div>
                <div class="field"><label>URL</label><input value="${l.url||''}" placeholder="https:// or mailto:" oninput="C.contact.links[${i}].url=this.value;markDirty()"></div>
              </div>
            </div>`).join('')}
        </div>
        <button class="add-btn" onclick="addLink()" style="margin-top:.5rem">+ Add Link</button>
      </div>
    </div>

    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Panel — Background Video</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="field">
          <label>Vimeo / YouTube URL</label>
          <textarea placeholder="Paste embed URL or share link" oninput="parseContactVideo(this.value)" style="min-height:55px">${(cp.video&&cp.video.url)||''}</textarea>
          <span class="hint" id="ct-video-hint">${(cp.video&&cp.video.type&&cp.video.type!=='placeholder')?'&#x2713; '+cp.video.type+' detected':'Separate from your main reel — leave blank to reuse reel.'}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Panel — Splash Text</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="row2">
          <div class="field"><label>Title Line</label><input value="${cp.title||"Let's"}" oninput="cpSet('title',this.value)" placeholder="Let's"></div>
          <div class="field"><label>Accent Word</label><input value="${cp.titleAccent||'work.'}" oninput="cpSet('titleAccent',this.value)" placeholder="work."></div>
        </div>
        <div class="field"><label>Subheading</label>
          <div class="rt-toolbar">
            <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-ct-sub','b')"><b>B</b></button>
            <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-ct-sub','i')"><i>I</i></button>
            <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-ct-sub','u')"><u>U</u></button>
            <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-ct-sub','rgr')" style="font-size:.58rem;letter-spacing:.06em">RGR</button>
            <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtInsert('rta-ct-sub','&lt;br&gt;')" title="Line break">↵</button>
          </div>
          <textarea id="rta-ct-sub" oninput="cpSet('sub',this.value)">${cp.sub||'Animation, motion, original features — whatever the idea, we\'re built for it. Let\'s talk.'}</textarea>
        </div>
        <div class="field"><label>Scroll Cue</label><input value="${cp.scrollCue||'See how to reach us'}" oninput="cpSet('scrollCue',this.value)"></div>
      </div>
    </div>

    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Panel — Labels</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="row3">
          <div class="field"><label>Email Label</label><input value="${cp.emailLabel||'Drop us a line'}" oninput="cpSet('emailLabel',this.value)"></div>
          <div class="field"><label>Social Label</label><input value="${cp.socialLabel||'Find us'}" oninput="cpSet('socialLabel',this.value)"></div>
          <div class="field"><label>Resume Label</label><input value="${cp.resumeLabel||'Credentials'}" oninput="cpSet('resumeLabel',this.value)"></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Panel — Ticker Tapes</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <p class="hint" style="margin-bottom:.5rem">One item per line. Both tapes scroll the same list by default — edit them independently here.</p>
        <div class="row2">
          <div class="field">
            <label>Top Tape</label>
            <textarea style="min-height:140px;line-height:1.7" oninput="cpSet('tickerTop',this.value.split('\\n').map(s=>s.trim()).filter(Boolean))">${tickerTopVal}</textarea>
          </div>
          <div class="field">
            <label>Mid Tape</label>
            <textarea style="min-height:140px;line-height:1.7" oninput="cpSet('tickerMid',this.value.split('\\n').map(s=>s.trim()).filter(Boolean))">${tickerMidVal}</textarea>
          </div>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────
// PAGE RENDERERS — MEDIA
// ─────────────────────────────────────────
function renderMediaPage(){
  const root = document.getElementById('page-media');
  if(!root) return;
  root.innerHTML = `
    <div class="page-title">Media</div>
    <div class="page-sub">Browse, upload, and remove media files.</div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Media Library</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="media-page-tools">
          <label class="media-upload-trigger">+ Upload File
            <input type="file" id="media-page-upload" accept="image/*,video/*">
          </label>
          <input id="media-page-search" type="text" placeholder="Filter files (name or path)..." oninput="filterMediaPage(this.value)">
        </div>
        <div id="media-page-grid" class="media-page-grid">
          <div class="media-page-empty">Loading...</div>
        </div>
      </div>
    </div>`;

  const uploadInput = document.getElementById('media-page-upload');
  if(uploadInput){
    uploadInput.addEventListener('change', async e=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      try{
        uploadInput.disabled = true;
        toast('Uploading ' + file.name + '...');
          const path = await uploadMedia(file, 'media');
        await refreshMediaViews();
        toast('Uploaded: ' + path);
      }catch(err){
        toast('Upload error: ' + err.message, true);
      }finally{
        uploadInput.value = '';
        uploadInput.disabled = false;
      }
    });
  }

  refreshMediaPage();
}

function renderMediaPageGrid(files){
  const grid = document.getElementById('media-page-grid');
  if(!grid) return;
  if(!files.length){
    grid.innerHTML = '<div class="media-page-empty">No media files found.</div>';
    return;
  }
  const imgExts = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;
  grid.innerHTML = files.map(f=>{
    const encodedPath = encodeURIComponent(f.path || '');
    const safePath = escapeHtml(f.path || '');
    const safeName = escapeHtml(f.name || '');
    const ext = escapeHtml((f.name || '').split('.').pop() || 'FILE');
    const thumb = imgExts.test(f.name)
      ? `<img src="${f.url}" loading="lazy">`
      : `<span class="media-ext">${ext}</span>`;
    return `<div class="media-item" title="${safePath}" onclick="openMediaPreview(decodeURIComponent('${encodedPath}'))">
      <div class="media-thumb">${thumb}</div>
      <div class="media-name">${safeName}</div>
      <div class="media-meta">${formatBytes(f.size)}</div>
      <div class="media-actions">
        <button class="media-del-btn" type="button" onclick="event.stopPropagation();deleteMedia(decodeURIComponent('${encodedPath}')).catch(e=>toast('Delete error: '+e.message,true))">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function filterMediaPage(query){
  const q = (query || '').toLowerCase();
  const filtered = q ? mediaFiles.filter(f=>
    (f.path || '').toLowerCase().includes(q) ||
    (f.name || '').toLowerCase().includes(q)
  ) : mediaFiles;
  renderMediaPageGrid(filtered);
}

async function refreshMediaPage(){
  const grid = document.getElementById('media-page-grid');
  if(!grid) return;
  grid.innerHTML = '<div class="media-page-empty">Loading...</div>';
  mediaFiles = await fetchMediaFiles();
  const q = document.getElementById('media-page-search')?.value?.trim().toLowerCase() || '';
  const filtered = q ? mediaFiles.filter(f=>
    (f.path || '').toLowerCase().includes(q) ||
    (f.name || '').toLowerCase().includes(q)
  ) : mediaFiles;
  renderMediaPageGrid(filtered);
}

async function refreshMediaViews(){
  await refreshMediaGrid();
  await refreshMediaPage();
}

function addLink(){
  if(!C.contact.links) C.contact.links=[];
  C.contact.links.push({label:'',url:''});
  markDirty('add link'); markPageStale('contact'); renderContact(); showPage('contact');
}
function removeLink(i){
  C.contact.links.splice(i,1);
  markDirty('remove link'); markPageStale('contact'); renderContact(); showPage('contact');
}
function renderProject(id){
  const p=projects.find(x=>x.id===id); if(!p)return;
  document.getElementById('page-project').innerHTML=`
    <div class="page-title">${p.title}</div>
    <div class="page-sub">Project info and content blocks.</div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Info</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="row2">
          <div class="field"><label>Title</label><input value="${p.title}" oninput="updateP('${id}','title',this.value);document.querySelector('.page-title').textContent=this.value;document.getElementById('nav-proj-${id}').childNodes[2].textContent=this.value"></div>
          <div class="field"><label>Type</label>
            <select onchange="updateP('${id}','type',this.value);updateP('${id}','typeLabel',(C.filters||[{value:'2d',label:'2D'},{value:'3d',label:'3D'},{value:'motion',label:'Motion'}]).find(f=>f.value===this.value)?.label||this.value)">
              ${(C.filters||[{value:'2d',label:'2D'},{value:'3d',label:'3D'},{value:'motion',label:'Motion'}]).map(f=>`<option value="${f.value}" ${p.type===f.value?'selected':''}>${f.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="row3">
          <div class="field"><label>Year</label><input value="${p.year}" oninput="updateP('${id}','year',this.value)"></div>
          <div class="field"><label>Client</label><input value="${p.client}" oninput="updateP('${id}','client',this.value)"></div>
          <div class="field"><label>Duration</label><input value="${p.duration}" oninput="updateP('${id}','duration',this.value)"></div>
        </div>
        <div class="field"><label>Thumbnail</label>
          ${makeDropzone(p.thumbnail||'', v=>{ updateP(id,'thumbnail',v); }, 'media/projects', 'thumbnail.jpg', 'thdz_'+id)}
          <button class="add-btn" style="margin-top:.35rem" onclick="openMediaLibrary(v=>updateP('${id}','thumbnail',v),'thdz_${id}_p')">&#x1F5C2; Browse Media</button>
        </div>
        <div class="field"><label>Tags (comma separated)</label>
          <input value="${(p.tags||[]).join(', ')}" oninput="updateP('${id}','tags',this.value.split(',').map(t=>t.trim()).filter(Boolean))">
        </div>
        <div class="field"><label>Project Video URL</label>
          <input value="${p.videoUrl||''}" placeholder="Vimeo or YouTube embed URL" oninput="updateP('${id}','videoUrl',this.value)">
        </div>
        <div class="field" style="flex-direction:row;align-items:center;gap:.75rem;padding:.65rem;background:var(--bg);border:1px solid var(--border)">
          <input type="checkbox" id="sensitive-${id}" ${p.sensitive?'checked':''} onchange="updateP('${id}','sensitive',this.checked)" style="width:auto;accent-color:var(--accent)">
          <label for="sensitive-${id}" style="font-size:.72rem;color:var(--text);text-transform:none;letter-spacing:0;cursor:pointer">Mark as sensitive — blurs thumbnail with tape overlay</label>
        </div>
        <div class="field" style="flex-direction:row;align-items:center;gap:.75rem;padding:.65rem;background:var(--bg);border:1px solid var(--border)">
          <input type="checkbox" id="longform-${id}" ${p.longform?'checked':''} onchange="updateP('${id}','longform',this.checked)" style="width:auto;accent-color:var(--accent)">
          <label for="longform-${id}" style="font-size:.72rem;color:var(--text);text-transform:none;letter-spacing:0;cursor:pointer">Open project detail as centered longform panel</label>
        </div>
        <div id="sensitive-opts-${id}" style="display:${p.sensitive?'block':'none'}">
          <div class="row2">
            <div class="field"><label>Tape Label</label>
              <input value="${p.sensitiveLabel||'MATURE'}" placeholder="MATURE" oninput="updateP('${id}','sensitiveLabel',this.value)">
              <p class="hint">Text that repeats across the tape</p>
            </div>
            <div class="field"><label>Tape Color</label>
              <div class="color-row">
                <div class="color-swatch" style="background:${p.sensitiveColor||'#e03030'}">
                  <div class="color-swatch-fill" style="background:${p.sensitiveColor||'#e03030'}" id="sc-fill-${id}"></div>
                  <input type="color" value="${p.sensitiveColor||'#e03030'}" oninput="updateP('${id}','sensitiveColor',this.value);document.getElementById('sc-fill-${id}').style.background=this.value;document.getElementById('sc-fill-${id}').parentElement.style.background=this.value;document.getElementById('sc-hex-${id}').value=this.value;">
                </div>
                <input class="color-hex" id="sc-hex-${id}" value="${p.sensitiveColor||'#e03030'}" maxlength="7"
                  oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value)){updateP('${id}','sensitiveColor',this.value);document.getElementById('sc-fill-${id}').style.background=this.value;document.getElementById('sc-fill-${id}').parentElement.style.background=this.value;}">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Content Blocks</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="block-list" id="proj-blocks-${id}"></div>
        <button class="add-block-btn" onclick="toggleBlockMenu('proj-menu-${id}')">+ Add Block</button>
        <div class="block-menu hidden" id="proj-menu-${id}">${blockMenuHTML('proj-'+id)}</div>
        <button class="md-import-btn" onclick="importMarkdown('proj-${id}')">&#x1F4C4; Import from .md file</button>
      </div>
    </div>
    <div class="danger-zone" style="display:flex;align-items:center;justify-content:space-between">
      <button class="danger-btn" onclick="deleteProject('${id}')">Delete Project</button>
      <button class="preview-btn" style="font-size:.65rem;padding:.4rem .8rem;border:1px solid var(--border);background:none;color:${p.published===false?'var(--accent)':'var(--muted)'};font-family:var(--font)" onclick="togglePublished('${id}')">${p.published===false?'&#x25CF; Draft':'&#x25CB; Published'}</button>
    </div>`;
  renderBlockList('proj-'+id, p.blocks);
}

// ─────────────────────────────────────────
// BLOCK LIST RENDERER
// ─────────────────────────────────────────
function renderBlockList(scope, blocks){
  const listId = scope==='about' ? 'about-blocks' : 'proj-blocks-'+scope.replace('proj-','');
  const el=document.getElementById(listId); if(!el)return;
  if(!blocks||!blocks.length){el.innerHTML='<p style="font-size:.75rem;color:var(--muted);padding:.5rem 0">No blocks yet — add one below.</p>';return;}
  el.innerHTML=blocks.map((b,i)=>blockEditorHTML(scope,b,i,blocks.length)).join('');
}

function blockEditorHTML(scope, b, i, total){
  const preview = blockPreview(b);
  const canUp = i>0, canDown = i<total-1;
  let body='';

  if(b.type==='text-sm'||b.type==='text-md'||b.type==='text-lg'){
    const sizes=[['text-sm','Small'],['text-md','Medium'],['text-lg','Large']];
    body=`
      <div class="size-row">${sizes.map(([v,l])=>`<button class="sz-btn ${b.type===v?'active':''}" onclick="changeBlockType('${scope}','${b.id}','${v}')">${l}</button>`).join('')}</div>
      <div class="rt-toolbar">
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-${b.id}','b')"><b>B</b></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-${b.id}','i')"><i>I</i></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-${b.id}','u')"><u>U</u></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-${b.id}','rgr')" style="font-size:.58rem;letter-spacing:.06em">RGR</button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtInsert('rta-${b.id}','&lt;br&gt;')" title="Line break">↵</button>
      </div>
      <div class="field"><textarea id="rta-${b.id}" oninput="updateBlock('${scope}','${b.id}','content',this.value)">${b.content||''}</textarea></div>
      <div class="field"><label>Alignment</label><div class="align-row">
        ${['left','center','right'].map(a=>`<button class="al-btn ${(b.align||'left')===a?'active':''}" onclick="updateBlock('${scope}','${b.id}','align','${a}');rerenderBlocks('${scope}')">${a[0].toUpperCase()+a.slice(1)}</button>`).join('')}
      </div></div>`;
  } else if(b.type==='image'){
    const dzStableId = 'imdz_'+b.id;
    body=`
      <div class="field"><label>Image</label>
        ${makeDropzone(b.src||'', v=>{ updateBlock(scope,b.id,'src',v); }, 'media', 'image.jpg', dzStableId)}
        <button class="add-btn" style="margin-top:.35rem" onclick="openMediaLibrary(v=>updateBlock('${scope}','${b.id}','src',v),'${dzStableId}_p')">&#x1F5C2; Browse Media</button>
      </div>
      <div class="field"><label>Alt Text</label><input value="${b.alt||''}" oninput="updateBlock('${scope}','${b.id}','alt',this.value)"></div>`;
  } else if(b.type==='twocol'){
    body=`<div class="twocol-editor">
      <div><div class="col-label">Left Column</div>${colBlockEditor(scope,b,'left')}</div>
      <div><div class="col-label">Right Column</div>${colBlockEditor(scope,b,'right')}</div>
    </div>`;
  } else if(b.type==='quote'){
    body=`
      <div class="rt-toolbar">
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-q-${b.id}','b')"><b>B</b></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-q-${b.id}','i')"><i>I</i></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="rtWrap('rta-q-${b.id}','u')"><u>U</u></button>
      </div>
      <div class="field"><textarea id="rta-q-${b.id}" oninput="updateBlock('${scope}','${b.id}','content',this.value)">${b.content||''}</textarea></div>
      <div class="field"><label>Alignment</label><div class="align-row">
        ${['left','center','right'].map(a=>`<button class="al-btn ${(b.align||'left')===a?'active':''}" onclick="updateBlock('${scope}','${b.id}','align','${a}');rerenderBlocks('${scope}')">${a[0].toUpperCase()+a.slice(1)}</button>`).join('')}
      </div></div>`;
  } else if(b.type==='video'){
    body=`<div class="field"><label>Embed URL</label><input value="${b.src||''}" placeholder="Vimeo or YouTube embed URL" oninput="updateBlock('${scope}','${b.id}','src',this.value)"></div>`;
  } else if(b.type==='stats'){
    body=`<div style="display:flex;flex-direction:column;gap:.5rem" id="stats-${b.id}">
      ${(b.items||[]).map((s,si)=>`<div class="stat-item">
        <input value="${s.num}" placeholder="40+" oninput="updateStatItem('${scope}','${b.id}',${si},'num',this.value)">
        <input value="${s.label}" placeholder="Projects" oninput="updateStatItem('${scope}','${b.id}',${si},'label',this.value)">
        <button class="del-btn" onclick="removeStatItem('${scope}','${b.id}',${si})">&#x2715;</button>
      </div>`).join('')}
    </div>
    <button class="add-btn" onclick="addStatItem('${scope}','${b.id}')">+ Add Stat</button>`;
  } else if(b.type==='skills'){
    body=`<div style="display:flex;flex-direction:column;gap:.5rem" id="skills-${b.id}">
      ${(b.items||[]).map((s,si)=>`<div class="skill-item">
        <input value="${s.name}" placeholder="After Effects" oninput="updateSkillItem('${scope}','${b.id}',${si},'name',this.value)">
        <input type="range" min="0" max="100" value="${s.pct}" step="1" oninput="updateSkillItem('${scope}','${b.id}',${si},'pct',+this.value);this.nextElementSibling.textContent=this.value+'%'">
        <span class="skill-pct">${s.pct}%</span>
        <button class="del-btn" onclick="removeSkillItem('${scope}','${b.id}',${si})">&#x2715;</button>
      </div>`).join('')}
    </div>
    <button class="add-btn" onclick="addSkillItem('${scope}','${b.id}')">+ Add Skill</button>`;
  } else if(b.type==='divider'){
    body=`<p style="font-size:.72rem;color:var(--muted)">Horizontal rule divider.</p>`;
  }

  return`<div class="bk" id="bk-${b.id}" draggable="true" data-scope="${scope}" data-bid="${b.id}"
    ondragstart="blockDragStart(event)"
    ondragover="blockDragOver(event)"
    ondrop="blockDrop(event)"
    ondragend="blockDragEnd(event)">
    <div class="bk-head" onclick="toggleBk('${b.id}')">
      <span style="color:var(--muted);font-size:.8rem;cursor:grab;padding-right:.3rem" onmousedown="event.stopPropagation()" title="Drag to reorder">&#9776;</span>
      <span class="bk-type">${b.type}</span>
      <span class="bk-preview">${preview}</span>
      <div class="bk-actions">
        <button class="bk-btn del" onclick="event.stopPropagation();removeBlock('${scope}','${b.id}')" title="Delete">&#x2715;</button>
      </div>
    </div>
    <div class="bk-body hidden" id="bkb-${b.id}">${body}</div>
  </div>`;
}

function colBlockEditor(scope, b, side){
  const col = b[side] || {type:'text-md',content:'',align:'left'};
  const types=[['text-sm','Text S'],['text-md','Text M'],['text-lg','Text L'],['image','Image']];
  return`<div style="display:flex;flex-direction:column;gap:.5rem">
    <select style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:.78rem;padding:.4rem .5rem;outline:none" onchange="updateColType('${scope}','${b.id}','${side}',this.value);rerenderBlocks('${scope}')">
      ${types.map(([v,l])=>`<option value="${v}" ${col.type===v?'selected':''}>${l}</option>`).join('')}
    </select>
    ${col.type==='image'
      ? `<div>
          ${makeDropzone(col.src||'', v=>{ updateColField(scope,b.id,side,'src',v); }, 'media', 'image.jpg', 'imdz_'+b.id+'_'+side)}
          <button class="add-btn" style="margin-top:.35rem" onclick="openMediaLibrary(v=>updateColField('${scope}','${b.id}','${side}','src',v),'imdz_${b.id}_${side}_p')">&#x1F5C2; Browse Media</button>
        </div>`
      : `<textarea style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:.8rem;padding:.45rem .55rem;outline:none;resize:vertical;min-height:60px;width:100%" oninput="updateColField('${scope}','${b.id}','${side}','content',this.value)">${col.content||''}</textarea>`
    }
    <div class="align-row">
      ${['left','center','right'].map(a=>`<button class="al-btn ${(col.align||'left')===a?'active':''}" onclick="updateColField('${scope}','${b.id}','${side}','align','${a}');rerenderBlocks('${scope}')">${a[0].toUpperCase()}</button>`).join('')}
    </div>
  </div>`;
}

function blockPreview(b){
  if(b.type==='divider') return '---';
  if(b.type==='stats') return (b.items||[]).map(s=>s.num).join(' · ');
  if(b.type==='skills') return (b.items||[]).map(s=>s.name).join(', ');
  if(b.type==='image') return b.src||b.alt||'(empty)';
  if(b.type==='twocol') return 'Two columns';
  return (b.content||'').slice(0,60);
}

function blockMenuHTML(scope){
  const types=[
    ['text-md','T','Text'],['image','&#x1F5BC;','Image'],['twocol','&#x25A6;','Two Col'],
    ['quote','"','Quote'],['video','&#x25B6;','Video'],['stats','#','Stats'],
    ['skills','%','Skills'],['divider','&#x2015;','Divider']
  ];
  return types.map(([t,icon,label])=>`<button class="bm-item" onclick="addBlock('${scope}','${t}')"><div class="bm-icon">${icon}</div>${label}</button>`).join('');
}

// ─────────────────────────────────────────
// BLOCK OPERATIONS
// ─────────────────────────────────────────
function getBlocks(scope){
  if(scope==='about') return C.about;
  const id=scope.replace('proj-',''); const p=projects.find(x=>x.id===id); return p?p.blocks:[];
}
function setBlocks(scope,blocks){
  if(scope==='about'){C.about=blocks;}
  else{const id=scope.replace('proj-','');const p=projects.find(x=>x.id===id);if(p)p.blocks=blocks;}
}

function addBlock(scope, type){
  const blocks=getBlocks(scope)||[];
  const id='b'+Date.now();
  const defaults={
    'text-sm':{id,type:'text-sm',content:'',align:'left'},
    'text-md':{id,type:'text-md',content:'',align:'left'},
    'text-lg':{id,type:'text-lg',content:'',align:'left'},
    'image':{id,type:'image',src:'',alt:''},
    'twocol':{id,type:'twocol',left:{type:'image',src:'',alt:''},right:{type:'text-md',content:'',align:'left'}},
    'quote':{id,type:'quote',content:'',align:'left'},
    'video':{id,type:'video',src:''},
    'stats':{id,type:'stats',items:[{num:'',label:''}]},
    'skills':{id,type:'skills',items:[{name:'',pct:80}]},
    'divider':{id,type:'divider'}
  };
  blocks.push(defaults[type]||{id,type,content:''});
  setBlocks(scope,blocks);
  markDirty('add block');
  rerenderBlocks(scope);
  openBlocks.add(id);
  setTimeout(()=>{
    const el=document.getElementById('bkb-'+id);
    if(el) el.classList.remove('hidden');
  }, 20);
  const menuId=scope==='about'?'about-menu':'proj-menu-'+scope.replace('proj-','');
  const menu=document.getElementById(menuId);if(menu)menu.classList.add('hidden');
}

function removeBlock(scope,blockId){
  openBlocks.delete(blockId);
  const blocks=(getBlocks(scope)||[]).filter(b=>b.id!==blockId);
  setBlocks(scope,blocks);markDirty('delete block');rerenderBlocks(scope);
}

function updateBlock(scope,blockId,key,val){
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b){
    b[key]=val;
    if(scope==='about') dirtyFiles.add('content.json');
    else dirtyFiles.add('projects/'+scope.replace('proj-','')+'.json');
    dirty=true;
    document.getElementById('save-btn').textContent='Save All Changes *';
    clearTimeout(previewTimer); previewTimer=setTimeout(pushPreview, 600);
  }
}

function changeBlockType(scope,blockId,newType){
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b){
    // keep the block open after type change
    openBlocks.add(blockId);
    b.type=newType;markDirty();rerenderBlocks(scope);
  }
}

function updateColType(scope,blockId,side,type){
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b){b[side]=b[side]||{};b[side].type=type;markDirty();}
}
function updateColField(scope,blockId,side,key,val){
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b){b[side]=b[side]||{};b[side][key]=val;markDirty();}
}
function updateStatItem(scope,blockId,idx,key,val){
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b&&b.items&&b.items[idx]){b.items[idx][key]=val;markDirty();}
}
function addStatItem(scope,blockId){
  openBlocks.add(blockId);
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b){b.items=b.items||[];b.items.push({num:'',label:''});markDirty();rerenderBlocks(scope);}
}
function removeStatItem(scope,blockId,idx){
  openBlocks.add(blockId);
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b){b.items.splice(idx,1);markDirty();rerenderBlocks(scope);}
}
function updateSkillItem(scope,blockId,idx,key,val){
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b&&b.items&&b.items[idx]){b.items[idx][key]=val;markDirty();}
}
function addSkillItem(scope,blockId){
  openBlocks.add(blockId);
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b){b.items=b.items||[];b.items.push({name:'',pct:80});markDirty();rerenderBlocks(scope);}
}
function removeSkillItem(scope,blockId,idx){
  openBlocks.add(blockId);
  const blocks=getBlocks(scope)||[];
  const b=blocks.find(x=>x.id===blockId);
  if(b){b.items.splice(idx,1);markDirty();rerenderBlocks(scope);}
}

// ─────────────────────────────────────────
// RE-RENDER & TOGGLE (preserves open state)
// ─────────────────────────────────────────
function rerenderBlocks(scope){
  const blocks=getBlocks(scope)||[];
  const listId=scope==='about'?'about-blocks':'proj-blocks-'+scope.replace('proj-','');
  const el=document.getElementById(listId);if(!el)return;
  if(!blocks.length){el.innerHTML='<p style="font-size:.75rem;color:var(--muted);padding:.5rem 0">No blocks yet.</p>';return;}
  el.innerHTML=blocks.map((b,i)=>blockEditorHTML(scope,b,i,blocks.length)).join('');
  // restore which blocks were open before the re-render
  openBlocks.forEach(id=>{
    const bodyEl=document.getElementById('bkb-'+id);
    if(bodyEl) bodyEl.classList.remove('hidden');
  });
}

// tracks open state on toggle
function toggleBk(id){
  const el=document.getElementById('bkb-'+id);
  el.classList.toggle('hidden');
  if(el.classList.contains('hidden')) openBlocks.delete(id);
  else openBlocks.add(id);
}
function toggleBlockMenu(menuId){
  document.getElementById(menuId).classList.toggle('hidden');
}

// ─────────────────────────────────────────
// PROJECT HELPERS
// ─────────────────────────────────────────
function updateP(id,key,val){
  const p=projects.find(x=>x.id===id);if(p){p[key]=val;}
  markProjectDirty(id);
  if(key==='sensitive'){
    const opts=document.getElementById('sensitive-opts-'+id);
    if(opts) opts.style.display=val?'block':'none';
  }
}
function addProject(){
  const title=prompt('Project title:');if(!title)return;
  const id=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const p={id,title,type:'motion',typeLabel:'Motion',year:new Date().getFullYear().toString(),client:'',duration:'',tags:[],thumbnail:'',videoUrl:'',longform:false,blocks:[
    {id:'b1',type:'text-lg',content:title,align:'left'},
    {id:'b2',type:'text-sm',content:'Motion · '+new Date().getFullYear(),align:'left'}
  ]};
  projects.push(p);C.projects.push(id);
  dirtyFiles.add('content.json');
  dirtyFiles.add('projects/'+id+'.json');
  buildNav();markDirty('add project');showProject(id);
}
// ─────────────────────────────────────────
// DRAG REORDER — PROJECTS & BLOCKS
// ─────────────────────────────────────────
let dragId=null;
let blockDragBid=null, blockDragScope=null;

// ── Block drag with insert line indicator
function blockDragStart(e){
  // Don't hijack text selection drags inside textareas/inputs
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
  blockDragBid=e.currentTarget.dataset.bid;
  blockDragScope=e.currentTarget.dataset.scope;
  e.currentTarget.style.opacity='.4';
  e.dataTransfer.effectAllowed='move';
}
function blockDragEnd(e){
  e.currentTarget.style.opacity='1';
  blockDragBid=null; blockDragScope=null;
  // Clear all indicators
  document.querySelectorAll('.bk').forEach(b=>{
    b.classList.remove('drag-over-top','drag-over-bottom');
  });
}
function blockDragOver(e){
  e.preventDefault(); e.dataTransfer.dropEffect='move';
  const bk=e.currentTarget;
  if(!blockDragBid||bk.dataset.bid===blockDragBid) return;
  // Don't show indicator if hovering over an input/textarea
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
  document.querySelectorAll('.bk').forEach(b=>b.classList.remove('drag-over-top','drag-over-bottom'));
  const rect=bk.getBoundingClientRect();
  const mid=rect.top+rect.height/2;
  if(e.clientY<mid) bk.classList.add('drag-over-top');
  else bk.classList.add('drag-over-bottom');
}
function blockDrop(e){
  e.preventDefault();
  document.querySelectorAll('.bk').forEach(b=>b.classList.remove('drag-over-top','drag-over-bottom'));
  const targetBk=e.currentTarget;
  const targetBid=targetBk.dataset.bid;
  const targetScope=targetBk.dataset.scope;
  if(!blockDragBid||blockDragBid===targetBid||blockDragScope!==targetScope) return;
  const blocks=getBlocks(blockDragScope);
  const from=blocks.findIndex(b=>b.id===blockDragBid);
  let to=blocks.findIndex(b=>b.id===targetBid);
  if(from<0||to<0) return;
  // Insert above or below based on indicator
  const rect=targetBk.getBoundingClientRect();
  const insertAfter=e.clientY>rect.top+rect.height/2;
  if(insertAfter && to>=from) to++;
  else if(!insertAfter && to<=from) to--;
  const [moved]=blocks.splice(from,1);
  const finalTo=Math.max(0,Math.min(to,blocks.length));
  blocks.splice(finalTo,0,moved);
  setBlocks(blockDragScope,blocks);
  markDirty('reorder block'); rerenderBlocks(blockDragScope);
}

// ── Sidebar project drag
let navDragId=null;
function navDragStart(e,id){
  navDragId=id; e.currentTarget.style.opacity='.4';
  e.dataTransfer.effectAllowed='move';
}
function navDragEnd(e){
  e.currentTarget.style.opacity='1'; navDragId=null;
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('proj-drag-over'));
}
function navDragOver(e){
  e.preventDefault();
  if(!navDragId) return;
  document.querySelectorAll('.ni[draggable]').forEach(n=>n.classList.remove('proj-drag-over'));
  e.currentTarget.classList.add('proj-drag-over');
}
function navDragLeave(e){ e.currentTarget.classList.remove('proj-drag-over'); }
function navDrop(e,targetId){
  e.preventDefault();
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('proj-drag-over'));
  if(!navDragId||navDragId===targetId) return;
  const from=C.projects.indexOf(navDragId);
  const to=C.projects.indexOf(targetId);
  if(from<0||to<0) return;
  C.projects.splice(from,1);
  C.projects.splice(to,0,navDragId);
  // Also reorder projects array to match
  const pFrom=projects.findIndex(p=>p.id===navDragId);
  const pTo=projects.findIndex(p=>p.id===targetId);
  const [moved]=projects.splice(pFrom,1);
  projects.splice(pTo,0,moved);
  markDirty('reorder project'); buildNav();
  // Restore active state
  if(currentProjectId){
    const el=document.getElementById('nav-proj-'+currentProjectId);
    if(el) el.classList.add('active');
  }
}

// ── Global settings project drag (keep for backward compat)
function dragStart(e){ dragId=e.currentTarget.dataset.id; e.currentTarget.style.opacity='.4'; }
function dragEnd(e){ e.currentTarget.style.opacity='1'; dragId=null; }
function dragOver(e){ e.preventDefault(); }
function dropOn(e){
  e.preventDefault();
  const targetId=e.currentTarget.dataset.id;
  if(!dragId||dragId===targetId) return;
  const from=C.projects.indexOf(dragId);
  const to=C.projects.indexOf(targetId);
  if(from<0||to<0) return;
  C.projects.splice(from,1);
  C.projects.splice(to,0,dragId);
  markDirty('reorder project'); renderGlobal(); showPage('global');
}

function getFilters(){ return C.filters||(C.filters=[{value:'2d',label:'2D'},{value:'3d',label:'3D'},{value:'motion',label:'Motion'}]); }
function addFilter(){
  getFilters().push({value:'new',label:'New'});
  markDirty('add filter'); markPageStale('global'); renderGlobal(); showPage('global');
}
function removeFilter(i){
  getFilters().splice(i,1);
  markDirty('remove filter'); markPageStale('global'); renderGlobal(); showPage('global');
}
function updateFilter(i,key,val){
  getFilters()[i][key]=val; markDirty();
}

function togglePublished(id){
  const p = projects.find(x=>x.id===id);
  if(!p) return;
  p.published = p.published===false ? true : false;
  markDirty(p.published===false?'set draft':'set published');
  markPageStale('global');
  renderProject(id); showProject(id);
}

function deleteProject(id){
  if(!confirm('Delete this project? This cannot be undone.'))return;
  projects=projects.filter(p=>p.id!==id);
  C.projects=C.projects.filter(i=>i!==id);
  buildNav();markDirty('delete project');showPage('global');
  toast('Project deleted — save to apply');
}

// ─────────────────────────────────────────
// SECTION TOGGLE
// ─────────────────────────────────────────
function toggleSection(head){
  head.classList.toggle('collapsed');
  head.nextElementSibling.classList.toggle('hidden');
}

// ─────────────────────────────────────────
// LIVE PREVIEW
// ─────────────────────────────────────────
let previewTimer=null, previewReady=false;

window.addEventListener('message', e=>{
  if(e.data&&e.data.type==='preview-ready'){
    previewReady=true;
    document.getElementById('pb-dot')?.classList.add('live');
    pushPreview();
  }
});

function initPreview(){
  const frame=document.getElementById('preview-frame');
  previewReady=false;
  frame.onload=()=>{
    previewReady=true;
    document.getElementById('pb-dot').classList.add('live');
    pushPreview();
  };
  frame.src='index.html?preview=1';
}

function markDirty(label, projectId){
  if(label) snapshot(label);
  dirty=true;
  // Track which file was touched
  if(projectId) dirtyFiles.add('projects/'+projectId+'.json');
  else dirtyFiles.add('content.json'); // default — most changes touch content.json
  document.getElementById('save-btn').textContent='Save All Changes *';
  document.getElementById('pb-dot').classList.remove('live');
  clearTimeout(previewTimer);
  previewTimer=setTimeout(pushPreview, 600);
}

// Shorthand for marking a specific project dirty
function markProjectDirty(id, label){
  if(label) snapshot(label);
  dirty=true;
  dirtyFiles.add('projects/'+id+'.json');
  document.getElementById('save-btn').textContent='Save All Changes *';
  document.getElementById('pb-dot').classList.remove('live');
  clearTimeout(previewTimer);
  previewTimer=setTimeout(pushPreview, 600);
}

function pushPreview(){
  if(!previewReady) return;
  const frame=document.getElementById('preview-frame');
  try{
    frame.contentWindow.postMessage({
      type:'preview-data',
      content:C,
      projects:projects
    },'*');
    setTimeout(sendPreviewNav, 100);
  }catch(e){}
}

function sendPreviewNav(){
  if(!previewReady) return;
  const frame=document.getElementById('preview-frame');
  try{
    let msg={type:'preview-nav'};
    if(currentPage==='about') msg.panel='about';
    else if(currentPage==='contact') msg.panel='contact';
    else if(currentPage==='project'&&currentProjectId) msg.panel='project', msg.projectId=currentProjectId;
    else msg.panel='home';
    frame.contentWindow.postMessage(msg,'*');
    document.getElementById('pb-dot').classList.add('live');
  }catch(e){}
}

function refreshPreview(){
  previewReady=false;
  document.getElementById('pb-dot').classList.remove('live');
  initPreview();
}

// ─────────────────────────────────────────
// MEDIA UPLOADER
// ─────────────────────────────────────────
async function uploadMedia(file, folder){
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);

  const r = await fetch(MEDIA_URL, getAuthFetchOptions({ method: 'POST', body: form }));

  const data = await r.json().catch(() => ({}));
  if(!r.ok){
    throw new Error(data.error || 'Upload failed');
  }

  return data.path;
}

// ─────────────────────────────────────────
// DROPZONE (path input + local preview fallback)
// ─────────────────────────────────────────
function makeDropzone(currentVal, onUpload, folder, placeholder, stableId){
  const uid = stableId || ('dz' + Math.random().toString(36).slice(2,9));
  const pathId = uid + '_p';
  const dzId = uid + '_z';

  setTimeout(()=>{
    const dzEl = document.getElementById(dzId);
    const pathInput = document.getElementById(pathId);
    if(!dzEl || !pathInput) return;

    const input = dzEl.querySelector('input[type=file]');
    const label = dzEl.querySelector('.dz-label');
    const sub   = dzEl.querySelector('.dz-sub');

    // Typing the path directly always wins
    pathInput.addEventListener('input', e=>{
      onUpload(e.target.value);
      markDirty();
      // show as preview if it looks like an image path
      if(/\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(e.target.value)){
        showPreview(dzEl, e.target.value);
      }
    });

    async function handleFile(file){
      if(!file) return;

      // 1. Immediate local preview regardless of upload outcome
      const objUrl = URL.createObjectURL(file);
      showPreview(dzEl, objUrl);
      const suggested = folder + '/' + file.name;

      // 2. Try GitHub upload
      label.innerHTML = '<span class="dz-uploading">Uploading ' + file.name + '…</span>';
      sub.style.display = 'none';
      try{
        const path = await uploadMedia(file, folder);
        if(path){
          label.textContent = file.name;
          sub.textContent = '✓ Uploaded to ' + folder + '/';
          sub.style.display = '';
          sub.style.opacity = '1';
          pathInput.value = path;
          onUpload(path);
          markDirty();
          toast('Uploaded: ' + path);
        } else {
          // User cancelled overwrite — restore
          label.textContent = currentVal ? currentVal.split('/').pop() : 'Drop image or click to browse';
          sub.style.display = '';
        }
      } catch(err){
        // Upload failed — fall back to object URL for editor preview, flag to user
        label.textContent = file.name + ' (local preview only)';
        sub.textContent = 'Upload failed or not logged in — enter path manually below';
        sub.style.display = '';
        sub.style.opacity = '1';
        pathInput.value = suggested;
        toast('Upload error: ' + err.message, true);
        // Use object URL so the block editor shows the image now
        // but don't call onUpload — wait for user to type/confirm the real path
      }
    }

    function showPreview(container, src){
      let prev = container.querySelector('.dz-preview');
      if(!prev){
        prev = document.createElement('img');
        prev.className = 'dz-preview';
        container.appendChild(prev);
      }
      prev.src = src;
    }

    input.addEventListener('change', e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); });
    dzEl.addEventListener('dragover', e=>{ e.preventDefault(); dzEl.classList.add('drag'); });
    dzEl.addEventListener('dragleave', ()=> dzEl.classList.remove('drag'));
    dzEl.addEventListener('drop', e=>{
      e.preventDefault(); dzEl.classList.remove('drag');
      if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    // Show existing image preview on load
    if(currentVal && /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(currentVal)){
      showPreview(dzEl, currentVal);
    }
  }, 50);

  const name = currentVal ? currentVal.split('/').pop() : null;
// Line 1123–1130 — corrected
  return `<div style="display:flex;flex-direction:column;gap:.35rem">
    <input type="text" id="${pathId}" class="img-path" value="${currentVal||''}" placeholder="${folder}/filename.jpg" title="Type a path or drop a file below">
    <div class="dropzone" id="${dzId}">
      <input type="file" accept="image/*,video/*">
      <span class="dz-label">${name || 'Drop file or click to browse'}</span>
      <span class="dz-sub">Requires GitHub token to upload</span>
    </div>
  </div>`;  // ← backtick was missing here
}

// ─────────────────────────────────────────
// AUTH & API
// ─────────────────────────────────────────
let currentUser = null;
let deployPollTimer = null;

function getSessionToken(){
  return localStorage.getItem('editor_session_token') || '';
}

function getAuthFetchOptions(extra = {}){
  const token = getSessionToken();
  const headers = { ...(extra.headers || {}) };
  if(token) headers.Authorization = `Bearer ${token}`;
  return {
    credentials: 'include',
    ...extra,
    headers
  };
}

/**
 * Initialize auth panel on page load
 */
async function initializeAuth(){
  try {
    const response = await fetch(AUTH_CHECK_URL, getAuthFetchOptions({ method: 'GET' }));
    const data = await response.json();
    
    if(data.authenticated){
      setAuthenticated(data.user);
    } else {
      setUnauthenticated();
    }
  } catch(e){
    console.error('Auth check failed:', e);
    setUnauthenticated();
  }
}

function setAuthenticated(username){
  currentUser = username;
  document.getElementById('login-btn').style.display = 'none';
  document.getElementById('user-status').style.display = 'flex';
  document.getElementById('user-name').textContent = `Logged in as @${username}`;
  document.getElementById('save-btn').disabled = false;
}

function setUnauthenticated(){
  currentUser = null;
  document.getElementById('login-btn').style.display = 'block';
  document.getElementById('user-status').style.display = 'none';
  document.getElementById('save-btn').disabled = true;
}

function login(){
  // Redirect to backend OAuth login
  window.location.href = LOGIN_URL;
}

async function logout(){
  try {
    await fetch(LOGOUT_URL, getAuthFetchOptions({ method: 'POST' }));
    localStorage.removeItem('editor_session_token');
    setUnauthenticated();
    toast('Logged out');
  } catch(e){
    toast('Logout failed: ' + e.message, true);
  }
}

function setDeployStatus(msg, state){
  const el=document.getElementById('deploy-status');
  if(!el) return;
  el.textContent='Deploy: '+msg;
  el.classList.remove('waiting','building','live','error');
  if(state) el.classList.add(state);
}

function startDeployPolling(){
  if(deployPollTimer){ clearInterval(deployPollTimer); deployPollTimer=null; }

  let tries=0;
  const maxTries=24; // ~4 minutes at 10s polling
  const poll=async()=>{
    tries++;
    try{
      const r=await fetch(`https://api.github.com/repos/ymd-ei/Run-Girl-Run-Website/pages/builds/latest`,{
        headers:{Accept:'application/vnd.github.v3+json'}
      });
      if(r.status===404){ 
        setDeployStatus('saved ✓','live');
        clearInterval(deployPollTimer); deployPollTimer=null;
        return;
      }
      if(!r.ok) throw new Error(r.status);
      
      const build=await r.json();
      const st=(build.status||'').toLowerCase();

      if(st==='built'){
        setDeployStatus('live','live');
        clearInterval(deployPollTimer); deployPollTimer=null;
        return;
      }
      if(st==='errored'){
        setDeployStatus('failed','error');
        clearInterval(deployPollTimer); deployPollTimer=null;
        return;
      }

      if(st==='building') setDeployStatus('building…','building');
      else setDeployStatus('queued…','waiting');

      if(tries>=maxTries){
        setDeployStatus('still processing','waiting');
        clearInterval(deployPollTimer); deployPollTimer=null;
      }
    }catch(e){
      setDeployStatus('status unavailable','error');
      clearInterval(deployPollTimer); deployPollTimer=null;
    }
  };

  setDeployStatus('checking…','waiting');
  poll();
  deployPollTimer=setInterval(poll,10000);
}

async function saveAll(){
  if(!currentUser){
    toast('You must be logged in to save', true);
    return;
  }

  const btn=document.getElementById('save-btn');
  btn.disabled=true; btn.textContent='Saving…';

  // Build file list from dirtyFiles — fall back to all if somehow empty
  const toSave = dirtyFiles.size > 0 ? [...dirtyFiles] : [
    'content.json',
    ...projects.map(p=>`projects/${p.id}.json`)
  ];

  // Build data map
  const dataMap = {
    'content.json': JSON.stringify(C,null,2),
    ...Object.fromEntries(projects.map(p=>[`projects/${p.id}.json`, JSON.stringify(p,null,2)]))
  };

  try{
    const filesToCommit = Object.fromEntries(toSave.filter(path=>!!dataMap[path]).map(path=>[path, dataMap[path]]));
    const changedPaths = Object.keys(filesToCommit);
    
    if(changedPaths.length===0){
      btn.disabled=false;
      btn.textContent='Save All Changes';
      toast('No changes to save');
      return;
    }

    // Call backend API
    const response = await fetch(SAVE_URL, getAuthFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: filesToCommit,
        message: `Editor: update ${changedPaths.length} file(s)`
      })
    }));

    const result = await response.json();

    if(!response.ok || !result.success){
      throw new Error(result.error || 'Save failed');
    }

    dirty=false;
    dirtyFiles.clear();
    btn.disabled=false;
    btn.textContent='Save All Changes';
    toast(`Saved ${changedPaths.length} file${changedPaths.length!==1?'s':''} ✓`);
    startDeployPolling();
  }catch(e){
    btn.disabled=false;
    btn.textContent='Save All Changes *';
    if(e.message.includes('Unauthorized')){
      setUnauthenticated();
      toast('Session expired, please log in again', true);
    } else {
      toast('Error: '+e.message, true);
    }
  }
}

function toast(msg,isError){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.toggle('error',!!isError);
  el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3500);
}

// ─────────────────────────────────────────
// REEL URL PARSER
// ─────────────────────────────────────────
function reelHint(){
  if(!C.reel||!C.reel.url) return 'Supports YouTube iframes, youtu.be links, Vimeo iframes, and vimeo.com links.';
  if(C.reel.type==='youtube') return '&#x2713; YouTube detected';
  if(C.reel.type==='vimeo') return '&#x2713; Vimeo detected';
  if(C.reel.type==='video') return '&#x2713; Local video';
  return '';
}

function parseReelInput(raw){
  const val=raw.trim();
  if(!val){ C.reel={type:'placeholder',url:''};markDirty();updateReelHint('No reel set');return; }

  const srcMatch=val.match(/src=["']([^"']+)["']/);
  const url=srcMatch?srcMatch[1]:val;

  const ytEmbed=url.match(/youtube\.com\/embed\/([\w-]+)/);
  const ytShort=url.match(/youtu\.be\/([\w-]+)/);
  const ytWatch=url.match(/youtube\.com\/watch\?v=([\w-]+)/);
  const ytId=(ytEmbed&&ytEmbed[1])||(ytShort&&ytShort[1])||(ytWatch&&ytWatch[1]);
  if(ytId){
    C.reel={type:'youtube',url:`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&rel=0`};
    markDirty();updateReelHint('&#x2713; YouTube detected — parameters added automatically');return;
  }

  const vimeoEmbed=url.match(/player\.vimeo\.com\/video\/([\d]+)/);
  const vimeoWatch=url.match(/vimeo\.com\/([\d]+)/);
  const vimeoId=(vimeoEmbed&&vimeoEmbed[1])||(vimeoWatch&&vimeoWatch[1]);
  if(vimeoId){
    C.reel={type:'vimeo',url:`https://player.vimeo.com/video/${vimeoId}?autoplay=1&loop=1&background=1&muted=1`};
    markDirty();updateReelHint('&#x2713; Vimeo detected — parameters added automatically');return;
  }

  if(url.match(/\.(mp4|webm|ogg)$/i)){
    C.reel={type:'video',url};
    markDirty();updateReelHint('&#x2713; Local video file');return;
  }

  updateReelHint('Could not detect type — paste a YouTube or Vimeo iframe or URL');
}

function updateReelHint(msg){
  const el=document.getElementById('reel-hint');
  if(el) el.innerHTML=msg;
}

// ─────────────────────────────────────────
// MARKDOWN IMPORT
// ─────────────────────────────────────────
function importMarkdown(scope){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.txt,.markdown';
  input.onchange = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const md = ev.target.result;
      const parsed = parseMarkdownToBlocks(md);
      const existing = getBlocks(scope)||[];
      if(existing.length > 0){
        const mode = confirm(
          `Found ${parsed.length} blocks in "${file.name}".\n\n` +
          'OK = Replace all existing blocks\n' +
          'Cancel = Append to the end'
        );

        if(mode){
          setBlocks(scope, parsed);
        } else {
          setBlocks(scope, [...existing, ...parsed]);
        }
      } else {
        setBlocks(scope, parsed);
      }
      markDirty();
      rerenderBlocks(scope);
      toast(`Imported ${parsed.length} blocks from ${file.name}`);
    };
    reader.readAsText(file);
  };
  input.click();
}

function uid(){ return 'b'+Date.now()+Math.random().toString(36).slice(2,6); }

function parseMarkdownToBlocks(md){
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;

  function inlineFormat(text){
    // Convert **bold** → <b>, *italic* → <i>, `code` → <b>
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/`([^`]+)`/g, '<b>$1</b>');
  }

  while(i < lines.length){
    const raw = lines[i];
    const line = raw.trimEnd();

    // Skip blank lines
    if(!line.trim()){ i++; continue; }

    // H1 → text-lg (accent large heading)
    if(/^# /.test(line)){
      blocks.push({id:uid(), type:'text-lg', content:inlineFormat(line.slice(2).trim()), align:'left'});
      i++; continue;
    }

    // H2 → text-md bold
    if(/^## /.test(line)){
      blocks.push({id:uid(), type:'text-md', content:'<b>'+inlineFormat(line.slice(3).trim())+'</b>', align:'left'});
      i++; continue;
    }

    // H3+ → text-sm uppercase label
    if(/^#{3,} /.test(line)){
      blocks.push({id:uid(), type:'text-sm', content:inlineFormat(line.replace(/^#+\s/,'')).toUpperCase(), align:'left'});
      i++; continue;
    }

    // Blockquote — collect consecutive lines
    if(/^> /.test(line)){
      const quoteLines = [];
      while(i < lines.length && /^> /.test(lines[i])){
        quoteLines.push(lines[i].slice(2).trim());
        i++;
      }
      blocks.push({id:uid(), type:'quote', content:inlineFormat(quoteLines.join(' ')), align:'left'});
      continue;
    }

    // Divider
    if(/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())){
      blocks.push({id:uid(), type:'divider'});
      i++; continue;
    }

    // Image: ![alt](src)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if(imgMatch){
      blocks.push({id:uid(), type:'image', src:imgMatch[2], alt:imgMatch[1]});
      i++; continue;
    }

    // Stats shorthand: lines like "148,000 | Combined Views"
    const statMatch = line.match(/^([\d,]+\+?)\s*\|\s*(.+)$/);
    if(statMatch){
      // Collect consecutive stat lines into one stats block
      const items = [];
      while(i < lines.length){
        const sm = lines[i].match(/^([\d,]+[^|]*?)\s*\|\s*(.+)$/);
        if(!sm) break;
        items.push({num: sm[1].trim(), label: sm[2].trim()});
        i++;
      }
      blocks.push({id:uid(), type:'stats', items});
      continue;
    }

    // Regular paragraph — collect until blank line or block-level marker
    const paraLines = [];
    while(i < lines.length){
      const l = lines[i];
      if(!l.trim()) break; // blank line ends paragraph
      if(/^[#>!]/.test(l)) break; // block marker
      if(/^---+$/.test(l.trim()) || /^\*\*\*+$/.test(l.trim())) break;
      paraLines.push(l.trim());
      i++;
    }
    if(paraLines.length){
      const content = inlineFormat(paraLines.join(' '));
      blocks.push({id:uid(), type:'text-md', content, align:'left'});
    }
  }

  return blocks;
}

// ─────────────────────────────────────────
// THEME
// ─────────────────────────────────────────
const THEME_DEFAULTS = {
  ink:'#1a1714', paper:'#f2ede4', accent:'#5e30eb', panelBg:'#f7f3ec',
  ctAccent:'#ff4361', ctBg:'#080808', ctHi:'#ffffff', sensitiveColor:'#e03030'
};

function getTheme(){ return C.theme||(C.theme={}); }

function hexToRgbCsv(hex){
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if(!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r},${g},${b}`;
}

function applyEditorTheme(){
  const t = { ...THEME_DEFAULTS, ...getTheme() };
  const root = document.documentElement;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-rgb', hexToRgbCsv(t.accent) || '94,48,235');
  // Keep status/toast accents aligned with the active accent.
  root.style.setProperty('--green', t.accent);
}

function colorField(label, key, defaultVal){
  const current = getTheme()[key] || defaultVal;
  const uid = 'cf_'+key;
  return `<div class="color-field">
    <label>${label}</label>
    <div class="color-row">
      <div class="color-swatch" style="background:${current}">
        <div class="color-swatch-fill" style="background:${current}" id="${uid}_fill"></div>
        <input type="color" value="${current}" oninput="setThemeColor('${key}',this.value,'${uid}')">
      </div>
      <input class="color-hex" id="${uid}_hex" value="${current}" maxlength="7"
        oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))setThemeColor('${key}',this.value,'${uid}')">
    </div>
  </div>`;
}

function setThemeColor(key, val, uid){
  getTheme()[key] = val;
  applyEditorTheme();
  markDirty();
  const fill = document.getElementById(uid+'_fill');
  const hex  = document.getElementById(uid+'_hex');
  if(fill){ fill.style.background = val; fill.parentElement.style.background = val; }
  if(hex && document.activeElement !== hex) hex.value = val;
}

function resetTheme(){
  if(!confirm('Reset all colours to defaults?')) return;
  C.theme = {...THEME_DEFAULTS};
  applyEditorTheme();
  markDirty();
  renderGlobal();
  showPage('global');
}

// ─────────────────────────────────────────
// RICH TEXT HELPERS
// ─────────────────────────────────────────
function rtWrap(textareaId, tag){
  const ta = document.getElementById(textareaId);
  if(!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end);
  const wrapped = `<${tag}>${selected}</${tag}>`;
  ta.value = ta.value.slice(0, start) + wrapped + ta.value.slice(end);
  // Restore cursor after closing tag
  const newPos = start + wrapped.length;
  ta.setSelectionRange(newPos, newPos);
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function rtInsert(textareaId, text){
  const ta = document.getElementById(textareaId);
  if(!ta) return;
  const pos = ta.selectionStart;
  ta.value = ta.value.slice(0, pos) + text + ta.value.slice(pos);
  ta.setSelectionRange(pos + text.length, pos + text.length);
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

// ─────────────────────────────────────────
// MEDIA LIBRARY
// ─────────────────────────────────────────
let mediaCallback = null;
let mediaFiles = [];
let mediaPathInputId = null; // direct reference to the path input to update

function formatBytes(bytes){
  const size = Number(bytes);
  if(!Number.isFinite(size) || size < 0) return '';
  if(size < 1024) return size + ' B';
  const units = ['KB','MB','GB'];
  let value = size / 1024;
  let idx = 0;
  while(value >= 1024 && idx < units.length - 1){
    value /= 1024;
    idx++;
  }
  return value.toFixed(value >= 100 ? 0 : 1) + ' ' + units[idx];
}

function isImageFile(name){
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name || '');
}

function isVideoFile(name){
  return /\.(mp4|webm|ogg|mov)$/i.test(name || '');
}

function escapeHtml(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function collectMediaUsage(value, path, hits){
  if(typeof value === 'string'){
    if(value === path) hits.push(value);
    return;
  }
  if(Array.isArray(value)){
    for(const item of value) collectMediaUsage(item, path, hits);
    return;
  }
  if(value && typeof value === 'object'){
    for(const key in value){
      collectMediaUsage(value[key], path, hits);
    }
  }
}

function getMediaUsageCount(path){
  const hits = [];
  collectMediaUsage(C, path, hits);
  for(const project of projects){
    collectMediaUsage(project, path, hits);
  }
  return hits.length;
}

async function openMediaLibrary(onInsert, pathInputId){
  mediaCallback = onInsert;
  mediaPathInputId = pathInputId || null;
  document.getElementById('media-modal').classList.add('open');
  document.getElementById('media-search').querySelector('input').value = '';
  const grid = document.getElementById('media-grid');
  grid.innerHTML = '<div id="media-empty">Loading…</div>';
  try{
    mediaFiles = await fetchMediaFiles();
    renderMediaGrid(mediaFiles);
  } catch(e){
    grid.innerHTML = `<div id="media-empty">Error: ${e.message}</div>`;
  }
}

function closeMediaLibrary(){
  document.getElementById('media-modal').classList.remove('open');
  mediaCallback = null;
}

async function refreshMediaGrid(){
  const grid = document.getElementById('media-grid');
  if(!grid) return;
  grid.innerHTML = '<div id="media-empty">Loading…</div>';
  mediaFiles = await fetchMediaFiles();
  const q = document.querySelector('#media-search input')?.value?.trim().toLowerCase() || '';
  const filtered = q ? mediaFiles.filter(f=>f.path.toLowerCase().includes(q)) : mediaFiles;
  renderMediaGrid(filtered);
}

async function uploadMediaFromLibrary(file){
  if(!file) return;
  const uploadInput = document.getElementById('media-upload-input');
  try{
    if(uploadInput) uploadInput.disabled = true;
    toast('Uploading ' + file.name + '…');
    const path = await uploadMedia(file, 'media');
    await refreshMediaViews();
    if(uploadInput) uploadInput.value = '';
    toast('Uploaded: ' + path);
  }catch(e){
    if(uploadInput) uploadInput.value = '';
    toast('Upload error: ' + e.message, true);
  }finally{
    if(uploadInput) uploadInput.disabled = false;
  }
}

async function deleteMedia(path){
  if(!path) return;
  const usageCount = getMediaUsageCount(path);
  const warning = usageCount > 0
    ? `This file is currently referenced ${usageCount} time${usageCount===1?'':'s'}. Delete anyway?`
    : 'Delete this media file?';
  if(!confirm(warning)) return;

  const r = await fetch(MEDIA_URL, getAuthFetchOptions({
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  }));
  const data = await r.json().catch(() => ({}));
  if(!r.ok){
    throw new Error(data.error || 'Delete failed');
  }

  await refreshMediaViews();
  toast('Deleted: ' + path);
}

async function fetchMediaFiles(){
  const r = await fetch(MEDIA_URL, getAuthFetchOptions({ method:'GET' }));
  const data = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error(data.error || 'Could not load media folder');
  return data.files || [];
}

function renderMediaGrid(files){
  const grid = document.getElementById('media-grid');
  if(!files.length){ grid.innerHTML = '<div id="media-empty">No media files found.</div>'; return; }
  const imgExts = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;
  grid.innerHTML = files.map(f=>{
    const encodedPath = encodeURIComponent(f.path || '');
    const safeName = escapeHtml(f.name || '');
    const safePath = escapeHtml(f.path || '');
    const ext = escapeHtml((f.name || '').split('.').pop() || 'FILE');
    const thumb = imgExts.test(f.name)
      ? `<img src="${f.url}" loading="lazy">`
      : `<span class="media-ext">${ext}</span>`;
    return `
    <div class="media-item" onclick="insertMedia(decodeURIComponent('${encodedPath}'))">
      <div class="media-thumb">
        ${thumb}
      </div>
      <div class="media-name" title="${safePath}">${safeName}</div>
      <div class="media-meta">${formatBytes(f.size)}</div>
      <div class="media-actions">
        <button class="media-del-btn" type="button" onclick="event.stopPropagation();deleteMedia(decodeURIComponent('${encodedPath}')).catch(e=>toast('Delete error: '+e.message,true))">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function filterMedia(query){
  const q = query.toLowerCase();
  const filtered = q ? mediaFiles.filter(f=>
    (f.path || '').toLowerCase().includes(q) ||
    (f.name || '').toLowerCase().includes(q)
  ) : mediaFiles;
  renderMediaGrid(filtered);
}

function openMediaPreview(path){
  const item = mediaFiles.find(f=>f.path===path);
  if(!item) return;

  const modal = document.getElementById('media-preview-modal');
  const nameEl = document.getElementById('media-preview-name');
  const body = document.getElementById('media-preview-body');
  if(!modal || !nameEl || !body) return;

  nameEl.textContent = item.path;
  if(isImageFile(item.name)){
    body.innerHTML = `<img src="${item.url}" alt="${escapeHtml(item.name)}" loading="lazy">`;
  } else if(isVideoFile(item.name)){
    body.innerHTML = `<video src="${item.url}" controls autoplay muted playsinline></video>`;
  } else {
    body.innerHTML = '<div class="media-preview-empty">Preview not available for this file type.</div>';
  }

  modal.classList.add('open');
}

function closeMediaPreview(){
  const modal = document.getElementById('media-preview-modal');
  const body = document.getElementById('media-preview-body');
  if(!modal || !body) return;
  const vid = body.querySelector('video');
  if(vid){
    vid.pause();
    vid.removeAttribute('src');
    vid.load();
  }
  body.innerHTML = '';
  modal.classList.remove('open');
}

function insertMedia(path){
  if(mediaCallback) mediaCallback(path);
  // Directly update the path input if we have a reference — no re-render needed
  if(mediaPathInputId){
    const input = document.getElementById(mediaPathInputId);
    if(input){ input.value = path; input.dispatchEvent(new Event('input')); }
  }
  if(currentPage==='about') dirtyFiles.add('content.json');
  else if(currentPage==='project'&&currentProjectId) dirtyFiles.add('projects/'+currentProjectId+'.json');
  dirty=true;
  document.getElementById('save-btn').textContent='Save All Changes *';
  closeMediaLibrary();
  toast('Inserted: '+path);
}

// Prevent block drag when user is typing in a field
document.addEventListener('focusin', e=>{
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT'){
    const bk=e.target.closest('.bk');
    if(bk) bk.draggable=false;
  }
});
document.addEventListener('focusout', e=>{
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT'){
    const bk=e.target.closest('.bk');
    if(bk) bk.draggable=true;
  }
});

// Close on backdrop click
document.getElementById('media-modal').addEventListener('click', e=>{
  if(e.target===document.getElementById('media-modal')) closeMediaLibrary();
});

const mediaUploadInput = document.getElementById('media-upload-input');
if(mediaUploadInput){
  mediaUploadInput.addEventListener('change', e=>{
    const file = e.target.files && e.target.files[0];
    uploadMediaFromLibrary(file);
  });
}

const mediaPreviewModal = document.getElementById('media-preview-modal');
if(mediaPreviewModal){
  mediaPreviewModal.addEventListener('click', e=>{
    if(e.target===mediaPreviewModal) closeMediaPreview();
  });
}

loadAll();
initializeAuth();
