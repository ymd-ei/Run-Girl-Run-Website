// ─────────────────────────────────────────
// LOCAL PROJECT EDITOR — Offline, file-based
// ─────────────────────────────────────────

// STATE
let projects = [];
let currentProjectId = null;
let dirty = false;
let openBlocks = new Set();

// Minimal stub for filters (used in type dropdowns)
let defaultFilters = [
  {value:'2d',label:'2D'},{value:'3d',label:'3D'},{value:'motion',label:'Motion'},
  {value:'Pipeline',label:'Pipeline'}
];

// Undo/redo
let history = [], historyIdx = -1;
const MAX_HISTORY = 50;

function snapshot(label){
  history = history.slice(0, historyIdx+1);
  history.push({label, projects: JSON.parse(JSON.stringify(projects))});
  if(history.length > MAX_HISTORY) history.shift();
  historyIdx = history.length - 1;
  updateUndoBar();
}
function undo(){
  if(historyIdx <= 0) return;
  historyIdx--;
  const s = history[historyIdx];
  projects = JSON.parse(JSON.stringify(s.projects));
  rebuildAfterHistoryChange();
}
function redo(){
  if(historyIdx >= history.length-1) return;
  historyIdx++;
  const s = history[historyIdx];
  projects = JSON.parse(JSON.stringify(s.projects));
  rebuildAfterHistoryChange();
}
function rebuildAfterHistoryChange(){
  buildNav();
  if(currentProjectId){
    const p = projects.find(x=>x.id===currentProjectId);
    if(p) renderProject(currentProjectId);
    else { currentProjectId=null; showWelcome(); }
  }
  markDirty();
  updateUndoBar();
}
function updateUndoBar(){
  const bar = document.getElementById('undo-bar');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const label = document.getElementById('undo-label');
  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length-1;
  undoBtn.disabled = !canUndo;
  redoBtn.disabled = !canRedo;
  label.textContent = canUndo ? '('+history[historyIdx].label+')' : '';
  bar.classList.toggle('show', canUndo || canRedo);
}

// Keyboard shortcuts
document.addEventListener('keydown', e=>{
  if((e.metaKey||e.ctrlKey) && e.key==='z' && !e.shiftKey){ e.preventDefault(); undo(); }
  if((e.metaKey||e.ctrlKey) && (e.key==='y' || (e.key==='z' && e.shiftKey))){ e.preventDefault(); redo(); }
});

// ─────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────
function showWelcome(){
  document.getElementById('welcome').style.display = '';
  document.getElementById('page-project').style.display = 'none';
  document.getElementById('save-btn').style.display = 'none';
  document.getElementById('export-md-btn').style.display = 'none';
  currentProjectId = null;
  projects.forEach(p=>{
    const el=document.getElementById('nav-proj-'+p.id); if(el) el.classList.remove('active');
  });
  sendPreviewNav();
}

function showProject(id){
  document.getElementById('welcome').style.display = 'none';
  document.getElementById('page-project').style.display = '';
  document.getElementById('save-btn').style.display = '';
  document.getElementById('export-md-btn').style.display = '';
  currentProjectId = id;
  projects.forEach(p=>{
    const el=document.getElementById('nav-proj-'+p.id);
    if(el) el.classList.toggle('active', p.id===id);
  });
  renderProject(id);
  pushPreview();
}

function buildNav(){
  const hint = document.getElementById('sb-hint');
  hint.style.display = projects.length ? 'none' : '';
  document.getElementById('project-nav').innerHTML = projects.map(p=>`
    <button class="ni ${currentProjectId===p.id?'active':''}" id="nav-proj-${p.id}"
      onclick="showProject('${p.id}')">
      <div class="dot"></div>
      <span style="flex:1;text-align:left">${escapeHtml(p.title)}</span>
      <span class="badge">${escapeHtml(p.type||'')}</span>
    </button>`).join('');
}

// ─────────────────────────────────────────
// FILE I/O
// ─────────────────────────────────────────
function openProjectJSON(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.multiple = true;
  input.onchange = e => {
    const files = Array.from(e.target.files);
    if(!files.length) return;
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        try{
          const data = JSON.parse(ev.target.result);
          if(!data.id || !data.blocks){
            toast('Invalid project JSON: missing id or blocks', true);
            return;
          }
          // Replace if already loaded, otherwise add
          const idx = projects.findIndex(p=>p.id===data.id);
          if(idx >= 0) projects[idx] = data;
          else projects.push(data);
          loaded++;
          if(loaded === files.length){
            buildNav();
            snapshot('load project');
            showProject(data.id);
            toast(`Loaded ${loaded} project${loaded>1?'s':''}`);
          }
        }catch(err){
          toast('Parse error: ' + err.message, true);
        }
      };
      reader.readAsText(file);
    });
  };
  input.click();
}

function saveProjectJSON(){
  if(!currentProjectId) return;
  const p = projects.find(x=>x.id===currentProjectId);
  if(!p) return;
  const json = JSON.stringify(p, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = p.id + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  dirty = false;
  toast('Saved ' + p.id + '.json');
}

function newProject(){
  const title = prompt('Project title:');
  if(!title) return;
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(projects.find(p=>p.id===id)){
    toast('A project with that ID already exists', true);
    return;
  }
  const p = {
    id, title, type:'motion', typeLabel:'Motion',
    year: new Date().getFullYear().toString(),
    client:'', duration:'', tags:[], thumbnail:'', videoUrl:'',
    longform:false, published:false,
    blocks:[
      {id:'b1',type:'text-lg',content:title,align:'left'},
      {id:'b2',type:'text-sm',content:'Motion · '+new Date().getFullYear(),align:'left'}
    ]
  };
  projects.push(p);
  buildNav();
  snapshot('new project');
  showProject(id);
  toast('Created: ' + title);
}

// ─────────────────────────────────────────
// MARKDOWN IMPORT / EXPORT
// ─────────────────────────────────────────
function importMD(){
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
      // Derive project title from first heading or filename
      let title = file.name.replace(/\.\w+$/, '').replace(/[-_]/g, ' ');
      const firstHeading = parsed.find(b=>b.type==='text-lg');
      if(firstHeading && firstHeading.content) {
        title = firstHeading.content.replace(/<[^>]+>/g, '').trim() || title;
      }
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

      // Check if project already exists
      const existing = projects.find(p=>p.id===id);
      if(existing){
        const mode = confirm(
          `Project "${title}" already exists.\n\nOK = Replace blocks\nCancel = Append blocks`
        );
        if(mode) existing.blocks = parsed;
        else existing.blocks = [...existing.blocks, ...parsed];
      } else {
        projects.push({
          id, title, type:'motion', typeLabel:'Motion',
          year: new Date().getFullYear().toString(),
          client:'', duration:'', tags:[], thumbnail:'', videoUrl:'',
          longform:false, published:false, blocks: parsed
        });
      }
      buildNav();
      snapshot('import md');
      showProject(id);
      toast(`Imported ${parsed.length} blocks from ${file.name}`);
    };
    reader.readAsText(file);
  };
  input.click();
}

function exportMD(){
  if(!currentProjectId) return;
  const p = projects.find(x=>x.id===currentProjectId);
  if(!p) return;
  const blocks = p.blocks || [];
  if(!blocks.length){ toast('No blocks to export', true); return; }
  const md = blocksToMarkdown(blocks);
  const blob = new Blob([md], {type:'text/markdown;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = p.id + '.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast('Exported ' + p.id + '.md');
}

// ─────────────────────────────────────────
// PROJECT RENDERER
// ─────────────────────────────────────────
function renderProject(id){
  const p = projects.find(x=>x.id===id);
  if(!p) return;
  const filters = defaultFilters;
  document.getElementById('page-project').innerHTML=`
    <div class="page-title">${escapeHtml(p.title)}</div>
    <div class="page-sub">Project info and content blocks.</div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Info</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="row2">
          <div class="field"><label>Title</label><input value="${escapeHtml(p.title)}" oninput="updateP('${id}','title',this.value);document.querySelector('.page-title').textContent=this.value;buildNav()"></div>
          <div class="field"><label>Type</label>
            <select onchange="updateP('${id}','type',this.value);updateP('${id}','typeLabel',this.options[this.selectedIndex].text);buildNav()">
              ${filters.map(f=>`<option value="${f.value}" ${p.type===f.value?'selected':''}>${f.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="row3">
          <div class="field"><label>Year</label><input value="${escapeHtml(p.year)}" oninput="updateP('${id}','year',this.value)"></div>
          <div class="field"><label>Client</label><input value="${escapeHtml(p.client)}" oninput="updateP('${id}','client',this.value)"></div>
          <div class="field"><label>Duration</label><input value="${escapeHtml(p.duration)}" oninput="updateP('${id}','duration',this.value)"></div>
        </div>
        <div class="field"><label>Thumbnail Path</label><input value="${escapeHtml(p.thumbnail||'')}" oninput="updateP('${id}','thumbnail',this.value)"></div>
        <div class="field"><label>Hero Background Image Path</label><input value="${escapeHtml(p.heroImage||'')}" oninput="updateP('${id}','heroImage',this.value)">
          <p class="hint">Background image for the project hero header. Falls back to thumbnail if empty.</p>
        </div>
        <div class="field"><label>Tags (comma separated)</label>
          <input value="${(p.tags||[]).join(', ')}" oninput="updateP('${id}','tags',this.value.split(',').map(t=>t.trim()).filter(Boolean))">
        </div>
        <div class="field"><label>Share Description</label>
          <input value="${escapeHtml(p.description||'')}" placeholder="Auto-generated from first text block" oninput="updateP('${id}','description',this.value)">
          <p class="hint">Shown when sharing this project's link.</p>
        </div>
        <div class="field"><label>Project Video URL</label>
          <input value="${escapeHtml(p.videoUrl||'')}" placeholder="Embed URL or media/video.mp4" oninput="updateP('${id}','videoUrl',this.value)">
        </div>
        <div class="field" style="flex-direction:row;align-items:center;gap:.75rem;padding:.65rem;background:var(--bg);border:1px solid var(--border)">
          <input type="checkbox" id="sensitive-${id}" ${p.sensitive?'checked':''} onchange="updateP('${id}','sensitive',this.checked)" style="width:auto;accent-color:var(--accent)">
          <label for="sensitive-${id}" style="font-size:.72rem;color:var(--text);text-transform:none;letter-spacing:0;cursor:pointer">Mark as sensitive</label>
        </div>
        <div class="field" style="flex-direction:row;align-items:center;gap:.75rem;padding:.65rem;background:var(--bg);border:1px solid var(--border)">
          <input type="checkbox" id="longform-${id}" ${p.longform?'checked':''} onchange="updateP('${id}','longform',this.checked)" style="width:auto;accent-color:var(--accent)">
          <label for="longform-${id}" style="font-size:.72rem;color:var(--text);text-transform:none;letter-spacing:0;cursor:pointer">Open as centered longform panel</label>
        </div>
        <div class="field" style="flex-direction:row;align-items:center;gap:.75rem;padding:.65rem;background:var(--bg);border:1px solid var(--border)">
          <input type="checkbox" id="published-${id}" ${p.published!==false?'checked':''} onchange="updateP('${id}','published',this.checked)" style="width:auto;accent-color:var(--accent)">
          <label for="published-${id}" style="font-size:.72rem;color:var(--text);text-transform:none;letter-spacing:0;cursor:pointer">Published</label>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="sh" onclick="toggleSection(this)"><h3>Content Blocks</h3><span class="chev">&#x25BE;</span></div>
      <div class="sb">
        <div class="block-list" id="proj-blocks-${id}"></div>
        <button class="add-block-btn" onclick="toggleBlockMenu('proj-menu-${id}')">+ Add Block</button>
        <div class="block-menu hidden" id="proj-menu-${id}">${blockMenuHTML('proj-'+id)}</div>
        <button class="md-import-btn" onclick="importMarkdownToScope('proj-${id}')" style="margin-top:.5rem">&#x1F4C4; Import .md into blocks</button>
        <button class="md-import-btn" onclick="exportScopeMD('proj-${id}')" style="margin-top:.45rem">&#x2B73; Export blocks as .md</button>
      </div>
    </div>
    <div class="danger-zone" style="display:flex;align-items:center;justify-content:space-between">
      <button class="danger-btn" onclick="deleteProject('${id}')">Delete Project</button>
    </div>`;
  renderBlockList('proj-'+id, p.blocks);
}

function importMarkdownToScope(scope){
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
          'OK = Replace all existing blocks\nCancel = Append to the end'
        );
        if(mode) setBlocks(scope, parsed);
        else setBlocks(scope, [...existing, ...parsed]);
      } else {
        setBlocks(scope, parsed);
      }
      markDirty('import md');
      rerenderBlocks(scope);
      toast(`Imported ${parsed.length} blocks from ${file.name}`);
    };
    reader.readAsText(file);
  };
  input.click();
}

function exportScopeMD(scope){
  const blocks = getBlocks(scope) || [];
  if(!blocks.length){ toast('No blocks to export', true); return; }
  const md = blocksToMarkdown(blocks);
  const name = scope.replace('proj-','') + '.md';
  const blob = new Blob([md], {type:'text/markdown;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast('Exported ' + name);
}

// ─────────────────────────────────────────
// BLOCK LIST RENDERER
// ─────────────────────────────────────────
function renderBlockList(scope, blocks){
  const listId = 'proj-blocks-' + scope.replace('proj-','');
  const el = document.getElementById(listId);
  if(!el) return;
  if(!blocks || !blocks.length){
    el.innerHTML='<p style="font-size:.75rem;color:var(--muted);padding:.5rem 0">No blocks yet — add one below.</p>';
    return;
  }
  el.innerHTML = blocks.map((b,i)=>blockEditorHTML(scope,b,i,blocks.length)).join('');
}

function blockEditorHTML(scope, b, i, total){
  const preview = blockPreview(b);
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
    body=`
      <div class="field"><label>Image Path</label><input value="${escapeHtml(b.src||'')}" oninput="updateBlock('${scope}','${b.id}','src',this.value)"></div>
      <div class="field"><label>Alt Text</label><input value="${escapeHtml(b.alt||'')}" oninput="updateBlock('${scope}','${b.id}','alt',this.value)"></div>`;
  } else if(b.type==='alpha-art'){
    const tintPresets = ['#5e30eb','#ff5a1f','#1a1714','#ffffff','#16a085','#f5b700'];
    const scaleValue = Number.isFinite(Number(b.scale)) ? Number(b.scale) : 1;
    body=`
      <div class="field"><label>Alpha Artwork Path</label><input value="${escapeHtml(b.src||'')}" oninput="updateBlock('${scope}','${b.id}','src',this.value)"></div>
      <div class="row2">
        <div class="field"><label>Tint Color</label><input type="color" value="${b.color||'#5e30eb'}" oninput="updateBlock('${scope}','${b.id}','color',this.value)"></div>
        <div class="field"><label>Background</label><input value="${escapeHtml(b.bg||'transparent')}" placeholder="transparent" oninput="updateBlock('${scope}','${b.id}','bg',this.value)"></div>
      </div>
      <div class="field"><label>Tint Presets</label>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          ${tintPresets.map(color=>`<button class="al-btn" title="Use ${color}" style="padding:.2rem .45rem;border-color:var(--border)" onclick="updateBlock('${scope}','${b.id}','color','${color}')"><span style="display:inline-block;width:.8rem;height:.8rem;border-radius:50%;background:${color};border:1px solid rgba(0,0,0,.2)"></span></button>`).join('')}
        </div>
      </div>
      <div class="field"><label>Scale</label>
        <div style="display:flex;align-items:center;gap:.6rem">
          <input type="range" min="0.1" max="2" step="0.05" value="${scaleValue}" style="flex:1" oninput="updateBlock('${scope}','${b.id}','scale',+this.value);this.nextElementSibling.textContent=(+this.value).toFixed(2)+'x'">
          <span style="font-size:.76rem;color:var(--muted);min-width:3.4rem;text-align:right">${scaleValue.toFixed(2)}x</span>
        </div>
      </div>
      <div class="row2">
        <div class="field"><label>Fit</label>
          <select onchange="updateBlock('${scope}','${b.id}','fit',this.value)">
            <option value="contain" ${(b.fit||'contain')==='contain'?'selected':''}>Contain</option>
            <option value="cover" ${(b.fit||'contain')==='cover'?'selected':''}>Cover</option>
          </select>
        </div>
        <div class="field"><label>Aspect Ratio</label><input value="${escapeHtml(b.ratio||'16/9')}" placeholder="16/9" oninput="updateBlock('${scope}','${b.id}','ratio',this.value)"></div>
      </div>
      <div class="field"><label>Alt Text</label><input value="${escapeHtml(b.alt||'')}" oninput="updateBlock('${scope}','${b.id}','alt',this.value)"></div>`;
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
    body=`<div class="field"><label>Video URL</label><input value="${escapeHtml(b.src||'')}" placeholder="Embed URL or media/video.mp4" oninput="updateBlock('${scope}','${b.id}','src',this.value)"></div>`;
  } else if(b.type==='stats'){
    body=`<div style="display:flex;flex-direction:column;gap:.5rem" id="stats-${b.id}">
      ${(b.items||[]).map((s,si)=>`<div class="stat-item">
        <input value="${escapeHtml(s.num)}" placeholder="40+" oninput="updateStatItem('${scope}','${b.id}',${si},'num',this.value)">
        <input value="${escapeHtml(s.label)}" placeholder="Projects" oninput="updateStatItem('${scope}','${b.id}',${si},'label',this.value)">
        <button class="del-btn" onclick="removeStatItem('${scope}','${b.id}',${si})">&#x2715;</button>
      </div>`).join('')}
    </div>
    <button class="add-btn" onclick="addStatItem('${scope}','${b.id}')">+ Add Stat</button>`;
  } else if(b.type==='skills'){
    body=`<div style="display:flex;flex-direction:column;gap:.5rem" id="skills-${b.id}">
      ${(b.items||[]).map((s,si)=>`<div class="skill-item">
        <input value="${escapeHtml(s.name)}" placeholder="After Effects" oninput="updateSkillItem('${scope}','${b.id}',${si},'name',this.value)">
        <input type="range" min="0" max="100" value="${s.pct}" step="1" oninput="updateSkillItem('${scope}','${b.id}',${si},'pct',+this.value);this.nextElementSibling.textContent=this.value+'%'">
        <span class="skill-pct">${s.pct}%</span>
        <button class="del-btn" onclick="removeSkillItem('${scope}','${b.id}',${si})">&#x2715;</button>
      </div>`).join('')}
    </div>
    <button class="add-btn" onclick="addSkillItem('${scope}','${b.id}')">+ Add Skill</button>`;
  } else if(b.type==='divider'){
    body=`<p style="font-size:.72rem;color:var(--muted)">Horizontal rule divider.</p>`;
  } else if(b.type==='callout'){
    body=`
      <div class="field"><label>Tone</label>
        <select onchange="updateBlock('${scope}','${b.id}','tone',this.value)">
          ${['note','highlight','warning'].map(t=>`<option value="${t}" ${(b.tone||'note')===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Title</label><input value="${escapeHtml(b.title||'')}" oninput="updateBlock('${scope}','${b.id}','title',this.value)"></div>
      <div class="field"><label>Body</label><textarea oninput="updateBlock('${scope}','${b.id}','content',this.value)">${b.content||''}</textarea></div>`;
  } else if(b.type==='cta'){
    body=`
      <div class="field"><label>Headline</label><input value="${escapeHtml(b.headline||'')}" placeholder="Start the conversation" oninput="updateBlock('${scope}','${b.id}','headline',this.value)"></div>
      <div class="field"><label>Body</label><textarea placeholder="Short supporting copy" oninput="updateBlock('${scope}','${b.id}','body',this.value)">${b.body||''}</textarea></div>
      <div class="row2">
        <div class="field"><label>Button Label</label><input value="${escapeHtml(b.buttonLabel||'')}" placeholder="Get in touch" oninput="updateBlock('${scope}','${b.id}','buttonLabel',this.value)"></div>
        <div class="field"><label>Button URL</label><input value="${escapeHtml(b.buttonUrl||'')}" placeholder="mailto:hello@example.com" oninput="updateBlock('${scope}','${b.id}','buttonUrl',this.value)"></div>
      </div>`;
  } else if(b.type==='beforeafter'){
    body=`
      <div class="field"><label>Before Image Path</label><input value="${escapeHtml(b.beforeSrc||'')}" oninput="updateBlock('${scope}','${b.id}','beforeSrc',this.value)"></div>
      <div class="field"><label>Before Alt</label><input value="${escapeHtml(b.beforeAlt||'')}" oninput="updateBlock('${scope}','${b.id}','beforeAlt',this.value)"></div>
      <div class="field"><label>After Image Path</label><input value="${escapeHtml(b.afterSrc||'')}" oninput="updateBlock('${scope}','${b.id}','afterSrc',this.value)"></div>
      <div class="field"><label>After Alt</label><input value="${escapeHtml(b.afterAlt||'')}" oninput="updateBlock('${scope}','${b.id}','afterAlt',this.value)"></div>
      <div class="field"><label>Caption</label><input value="${escapeHtml(b.caption||'')}" oninput="updateBlock('${scope}','${b.id}','caption',this.value)"></div>`;
  } else if(b.type==='faq'){
    body=`<div style="display:flex;flex-direction:column;gap:.6rem" id="faq-${b.id}">
      ${(b.items||[]).map((item,fi)=>`<div class="bk" style="border:1px solid var(--border)">
        <div class="bk-body" style="display:flex;gap:.55rem;flex-direction:column">
          <div class="row2">
            <div class="field"><label>Question</label><input value="${escapeHtml(item.question||'')}" oninput="updateFaqItem('${scope}','${b.id}',${fi},'question',this.value)"></div>
            <div class="field"><label>Open By Default</label><select onchange="updateFaqItem('${scope}','${b.id}',${fi},'open',this.value==='true')"><option value="false" ${item.open?'':'selected'}>Collapsed</option><option value="true" ${item.open?'selected':''}>Open</option></select></div>
          </div>
          <div class="field"><label>Answer</label><textarea oninput="updateFaqItem('${scope}','${b.id}',${fi},'answer',this.value)">${item.answer||''}</textarea></div>
          <button class="del-btn" onclick="removeFaqItem('${scope}','${b.id}',${fi})" style="align-self:flex-end">&#x2715;</button>
        </div>
      </div>`).join('')}
    </div>
    <button class="add-btn" onclick="addFaqItem('${scope}','${b.id}')">+ Add FAQ Item</button>`;
  } else if(b.type==='process'){
    body=`<div style="display:flex;flex-direction:column;gap:.6rem" id="proc-${b.id}">
      ${(b.steps||[]).map((s,si)=>`<div class="bk" style="border:1px solid var(--border)">
        <div class="bk-body" style="display:flex;gap:.5rem;flex-direction:column">
          <div class="field"><label>Date (optional)</label><input value="${escapeHtml(s.date||'')}" placeholder="Jan 2026" oninput="updateProcessStep('${scope}','${b.id}',${si},'date',this.value)"></div>
          <div class="field"><label>Step ${si+1} Title</label><input value="${escapeHtml(s.title||'')}" oninput="updateProcessStep('${scope}','${b.id}',${si},'title',this.value)"></div>
          <div class="field"><label>Description</label><textarea oninput="updateProcessStep('${scope}','${b.id}',${si},'content',this.value)">${s.content||''}</textarea></div>
          <div class="field"><label>Image Path (optional)</label><input value="${escapeHtml(s.image||'')}" oninput="updateProcessStep('${scope}','${b.id}',${si},'image',this.value)"></div>
          <div class="field"><label>Image Alt (optional)</label><input value="${escapeHtml(s.imageAlt||'')}" oninput="updateProcessStep('${scope}','${b.id}',${si},'imageAlt',this.value)"></div>
          <button class="del-btn" onclick="removeProcessStep('${scope}','${b.id}',${si})" style="align-self:flex-end">&#x2715;</button>
        </div>
      </div>`).join('')}
    </div>
    <button class="add-btn" onclick="addProcessStep('${scope}','${b.id}')">+ Add Step</button>`;
  } else if(b.type==='gallery'){
    body=`
      <div class="field"><label>Columns</label>
        <select onchange="updateBlock('${scope}','${b.id}','columns',parseInt(this.value,10))">
          <option value="2" ${(b.columns||2)===2?'selected':''}>2</option>
          <option value="3" ${(b.columns||2)===3?'selected':''}>3</option>
        </select>
      </div>
      <div style="display:flex;flex-direction:column;gap:.6rem" id="gal-${b.id}">
        ${(b.items||[]).map((it,gi)=>`<div class="bk" style="border:1px solid var(--border)">
          <div class="bk-body" style="display:flex;gap:.5rem;flex-direction:column">
            <div class="field"><label>Image Path</label><input value="${escapeHtml(it.src||'')}" oninput="updateGalleryItem('${scope}','${b.id}',${gi},'src',this.value)"></div>
            <div class="field"><label>Alt Text</label><input value="${escapeHtml(it.alt||'')}" oninput="updateGalleryItem('${scope}','${b.id}',${gi},'alt',this.value)"></div>
            <div class="field"><label>Caption</label><input value="${escapeHtml(it.caption||'')}" oninput="updateGalleryItem('${scope}','${b.id}',${gi},'caption',this.value)"></div>
            <button class="del-btn" onclick="removeGalleryItem('${scope}','${b.id}',${gi})" style="align-self:flex-end">&#x2715;</button>
          </div>
        </div>`).join('')}
      </div>
      <button class="add-btn" onclick="addGalleryItem('${scope}','${b.id}')">+ Add Image</button>`;
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
      ? `<div class="field"><label>Image Path</label><input value="${escapeHtml(col.src||'')}" oninput="updateColField('${scope}','${b.id}','${side}','src',this.value)"></div>`
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
  if(b.type==='callout') return (b.title||'Callout') + ' · ' + (b.tone||'note');
  if(b.type==='cta') return b.headline || b.buttonLabel || 'CTA banner';
  if(b.type==='beforeafter') return `Before/After · ${b.caption||'comparison'}`;
  if(b.type==='faq') return `${(b.items||[]).length} question${(b.items||[]).length===1?'':'s'}`;
  if(b.type==='process') return `${(b.steps||[]).length} step${(b.steps||[]).length===1?'':'s'}`;
  if(b.type==='gallery') return `${(b.items||[]).length} image${(b.items||[]).length===1?'':'s'} · ${(b.columns||2)} cols`;
  if(b.type==='image') return b.src||b.alt||'(empty)';
  if(b.type==='alpha-art') return `Alpha Art · ${b.src||'(empty)'}`;
  if(b.type==='twocol') return 'Two columns';
  return (b.content||'').slice(0,60);
}

function blockMenuTypes(){
  return [
    ['text-md','T','Text'],['image','&#x1F5BC;','Image'],['alpha-art','&#x25D0;','Alpha Art'],['twocol','&#x25A6;','Two Col'],
    ['quote','"','Quote'],['video','&#x25B6;','Video'],['stats','#','Stats'],
    ['skills','%','Skills'],['callout','!','Callout'],['gallery','&#x1F5BC;','Gallery'],
    ['process','1.','Process'],['cta','&#x2192;','CTA'],['beforeafter','&#x21C4;','Before/After'],
    ['faq','?','FAQ'],['divider','&#x2015;','Divider']
  ];
}

function blockMenuHTML(scope){
  return blockMenuTypes().map(([t,icon,label])=>`<button class="bm-item" onclick="addBlock('${scope}','${t}')"><div class="bm-icon">${icon}</div>${label}</button>`).join('');
}

// ─────────────────────────────────────────
// BLOCK OPERATIONS
// ─────────────────────────────────────────
function getBlocks(scope){
  const id = scope.replace('proj-','');
  const p = projects.find(x=>x.id===id);
  return p ? p.blocks : [];
}
function setBlocks(scope, blocks){
  const id = scope.replace('proj-','');
  const p = projects.find(x=>x.id===id);
  if(p) p.blocks = blocks;
}

function uid(){ return 'b'+Date.now()+Math.random().toString(36).slice(2,6); }

function getBlockDefaults(id){
  return {
    'text-sm':{id,type:'text-sm',content:'',align:'left'},
    'text-md':{id,type:'text-md',content:'',align:'left'},
    'text-lg':{id,type:'text-lg',content:'',align:'left'},
    'image':{id,type:'image',src:'',alt:''},
    'alpha-art':{id,type:'alpha-art',src:'',alt:'',color:'#5e30eb',bg:'transparent',scale:1,fit:'contain',ratio:'16/9'},
    'twocol':{id,type:'twocol',left:{type:'image',src:'',alt:''},right:{type:'text-md',content:'',align:'left'}},
    'quote':{id,type:'quote',content:'',align:'left'},
    'video':{id,type:'video',src:''},
    'stats':{id,type:'stats',items:[{num:'',label:''}]},
    'skills':{id,type:'skills',items:[{name:'',pct:80}]},
    'callout':{id,type:'callout',tone:'note',title:'',content:''},
    'gallery':{id,type:'gallery',columns:2,items:[{src:'',alt:'',caption:''}]},
    'process':{id,type:'process',steps:[{title:'',date:'',content:'',image:'',imageAlt:''}]},
    'cta':{id,type:'cta',headline:'',body:'',buttonLabel:'',buttonUrl:'',tone:'default'},
    'beforeafter':{id,type:'beforeafter',beforeSrc:'',beforeAlt:'',afterSrc:'',afterAlt:'',caption:'',position:67},
    'faq':{id,type:'faq',items:[{question:'',answer:'',open:true}]},
    'divider':{id,type:'divider'}
  };
}

function addBlock(scope, type){
  const blocks = getBlocks(scope) || [];
  const id = uid();
  const defaults = getBlockDefaults(id);
  blocks.push(defaults[type] || {id, type, content:''});
  setBlocks(scope, blocks);
  markDirty('add block');
  rerenderBlocks(scope);
  openBlocks.add(id);
  setTimeout(()=>{
    const el = document.getElementById('bkb-'+id);
    if(el) el.classList.remove('hidden');
  }, 20);
  const menuId = 'proj-menu-'+scope.replace('proj-','');
  const menu = document.getElementById(menuId);
  if(menu) menu.classList.add('hidden');
}

function removeBlock(scope, blockId){
  openBlocks.delete(blockId);
  const blocks = (getBlocks(scope)||[]).filter(b=>b.id!==blockId);
  setBlocks(scope, blocks);
  markDirty('delete block');
  rerenderBlocks(scope);
}

function updateBlock(scope, blockId, key, val){
  const blocks = getBlocks(scope)||[];
  const b = blocks.find(x=>x.id===blockId);
  if(b){ b[key] = val; markDirty(); }
}

function changeBlockType(scope, blockId, newType){
  const blocks = getBlocks(scope)||[];
  const b = blocks.find(x=>x.id===blockId);
  if(b){
    b.type = newType;
    openBlocks.add(blockId);
    markDirty('change type');
    rerenderBlocks(scope);
  }
}

function updateColType(scope, blockId, side, type){
  const blocks = getBlocks(scope)||[];
  const b = blocks.find(x=>x.id===blockId);
  if(b){ b[side] = b[side]||{}; b[side].type = type; markDirty(); }
}
function updateColField(scope, blockId, side, key, val){
  const blocks = getBlocks(scope)||[];
  const b = blocks.find(x=>x.id===blockId);
  if(b){ b[side] = b[side]||{}; b[side][key] = val; markDirty(); }
}

function updateStatItem(scope,blockId,idx,key,val){
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b&&b.items&&b.items[idx]){ b.items[idx][key]=val; markDirty(); }
}
function addStatItem(scope,blockId){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){ b.items=b.items||[]; b.items.push({num:'',label:''}); markDirty('add stat'); rerenderBlocks(scope); }
}
function removeStatItem(scope,blockId,idx){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){ b.items.splice(idx,1); markDirty('remove stat'); rerenderBlocks(scope); }
}

function updateSkillItem(scope,blockId,idx,key,val){
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b&&b.items&&b.items[idx]){ b.items[idx][key]=val; markDirty(); }
}
function addSkillItem(scope,blockId){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){ b.items=b.items||[]; b.items.push({name:'',pct:80}); markDirty('add skill'); rerenderBlocks(scope); }
}
function removeSkillItem(scope,blockId,idx){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){ b.items.splice(idx,1); markDirty('remove skill'); rerenderBlocks(scope); }
}

function updateProcessStep(scope,blockId,idx,key,val){
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b&&b.steps&&b.steps[idx]){ b.steps[idx][key]=val; markDirty(); }
}
function addProcessStep(scope,blockId){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){ b.steps=b.steps||[]; b.steps.push({title:'',date:'',content:'',image:'',imageAlt:''}); markDirty('add step'); rerenderBlocks(scope); }
}
function removeProcessStep(scope,blockId,idx){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){ b.steps.splice(idx,1); markDirty('remove step'); rerenderBlocks(scope); }
}

function updateGalleryItem(scope,blockId,idx,key,val){
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b&&b.items&&b.items[idx]){ b.items[idx][key]=val; markDirty(); }
}
function addGalleryItem(scope,blockId){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){ b.items=b.items||[]; b.items.push({src:'',alt:'',caption:''}); markDirty('add gallery item'); rerenderBlocks(scope); }
}
function removeGalleryItem(scope,blockId,idx){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){ b.items.splice(idx,1); markDirty('remove gallery item'); rerenderBlocks(scope); }
}

function updateFaqItem(scope,blockId,idx,key,val){
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(!b||!b.items||!b.items[idx]) return;
  if(key==='open' && val){
    b.items.forEach((item,i)=>{ item.open = i===idx; });
  } else {
    b.items[idx][key] = val;
  }
  markDirty();
  if(key==='open') rerenderBlocks(scope);
}
function addFaqItem(scope,blockId){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){
    (b.items||[]).forEach(item=>{ item.open=false; });
    b.items=b.items||[]; b.items.push({question:'',answer:'',open:true});
    markDirty('add faq'); rerenderBlocks(scope);
  }
}
function removeFaqItem(scope,blockId,idx){
  openBlocks.add(blockId);
  const b=(getBlocks(scope)||[]).find(x=>x.id===blockId);
  if(b){
    b.items.splice(idx,1);
    if(b.items[0] && !b.items.some(item=>item.open)) b.items[0].open = true;
    markDirty('remove faq'); rerenderBlocks(scope);
  }
}

// ─────────────────────────────────────────
// RE-RENDER & TOGGLE
// ─────────────────────────────────────────
function rerenderBlocks(scope){
  const blocks = getBlocks(scope) || [];
  const listId = 'proj-blocks-' + scope.replace('proj-','');
  const el = document.getElementById(listId);
  if(!el) return;
  if(!blocks.length){ el.innerHTML='<p style="font-size:.75rem;color:var(--muted);padding:.5rem 0">No blocks yet.</p>'; return; }
  el.innerHTML = blocks.map((b,i)=>blockEditorHTML(scope,b,i,blocks.length)).join('');
  openBlocks.forEach(id=>{
    const bodyEl = document.getElementById('bkb-'+id);
    if(bodyEl) bodyEl.classList.remove('hidden');
  });
}

function toggleBk(id){
  const el = document.getElementById('bkb-'+id);
  el.classList.toggle('hidden');
  if(el.classList.contains('hidden')) openBlocks.delete(id);
  else openBlocks.add(id);
}
function toggleBlockMenu(menuId){
  document.getElementById(menuId).classList.toggle('hidden');
}
function toggleSection(head){
  head.classList.toggle('collapsed');
  head.nextElementSibling.classList.toggle('hidden');
}

// ─────────────────────────────────────────
// PROJECT HELPERS
// ─────────────────────────────────────────
function updateP(id, key, val){
  const p = projects.find(x=>x.id===id);
  if(p) p[key] = val;
  markDirty();
}

function deleteProject(id){
  if(!confirm('Delete this project from the editor? (The file on disk is not affected.)')) return;
  projects = projects.filter(p=>p.id!==id);
  buildNav();
  markDirty('delete project');
  showWelcome();
  toast('Project removed from editor');
}

function markDirty(label){
  if(label) snapshot(label);
  dirty = true;
  document.getElementById('pb-dot')?.classList.remove('live');
  clearTimeout(previewTimer);
  previewTimer = setTimeout(pushPreview, 600);
}

// ─────────────────────────────────────────
// BLOCK DRAG REORDER
// ─────────────────────────────────────────
let blockDragBid = null, blockDragScope = null;

function blockDragStart(e){
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
  blockDragBid = e.currentTarget.dataset.bid;
  blockDragScope = e.currentTarget.dataset.scope;
  e.currentTarget.style.opacity = '.4';
  e.dataTransfer.effectAllowed = 'move';
}
function blockDragEnd(e){
  e.currentTarget.style.opacity = '1';
  blockDragBid = null; blockDragScope = null;
  document.querySelectorAll('.bk').forEach(b=>{
    b.classList.remove('drag-over-top','drag-over-bottom');
  });
}
function blockDragOver(e){
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const bk = e.currentTarget;
  if(!blockDragBid || bk.dataset.bid===blockDragBid) return;
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
  document.querySelectorAll('.bk').forEach(b=>b.classList.remove('drag-over-top','drag-over-bottom'));
  const rect = bk.getBoundingClientRect();
  const mid = rect.top + rect.height/2;
  if(e.clientY < mid) bk.classList.add('drag-over-top');
  else bk.classList.add('drag-over-bottom');
}
function blockDrop(e){
  e.preventDefault();
  document.querySelectorAll('.bk').forEach(b=>b.classList.remove('drag-over-top','drag-over-bottom'));
  const targetBk = e.currentTarget;
  const targetBid = targetBk.dataset.bid;
  const targetScope = targetBk.dataset.scope;
  if(!blockDragBid || blockDragBid===targetBid || blockDragScope!==targetScope) return;
  const blocks = getBlocks(blockDragScope);
  const from = blocks.findIndex(b=>b.id===blockDragBid);
  let to = blocks.findIndex(b=>b.id===targetBid);
  if(from<0 || to<0) return;
  const rect = targetBk.getBoundingClientRect();
  const insertAfter = e.clientY > rect.top + rect.height/2;
  if(insertAfter && to>=from) to++;
  else if(!insertAfter && to<=from) to--;
  const [moved] = blocks.splice(from,1);
  const finalTo = Math.max(0, Math.min(to, blocks.length));
  blocks.splice(finalTo, 0, moved);
  setBlocks(blockDragScope, blocks);
  markDirty('reorder block');
  rerenderBlocks(blockDragScope);
}

// ─────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────
function escapeHtml(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toast(msg, isError){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 3500);
}

function rtWrap(textareaId, tag){
  const ta = document.getElementById(textareaId);
  if(!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end);
  const wrapped = `<${tag}>${selected}</${tag}>`;
  ta.value = ta.value.slice(0, start) + wrapped + ta.value.slice(end);
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
// MARKDOWN ↔ BLOCKS (same logic as main editor)
// ─────────────────────────────────────────
function markdownInlineFromHtml(text){
  return String(text || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u>(.*?)<\/u>/gi, '$1')
    .replace(/<rgr>(.*?)<\/rgr>/gi, '`$1`')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function blocksToMarkdown(blocks){
  const out = [];
  blocks.forEach(b=>{
    if(b.type==='text-lg'){ out.push(`# ${markdownInlineFromHtml(b.content)}`); return; }
    if(b.type==='text-sm'){ out.push(`### ${markdownInlineFromHtml(b.content)}`); return; }
    if(b.type==='text-md'){ out.push(markdownInlineFromHtml(b.content)); return; }
    if(b.type==='quote'){
      const lines = markdownInlineFromHtml(b.content).split('\n').filter(Boolean);
      out.push(lines.map(l=>`> ${l}`).join('\n')); return;
    }
    if(b.type==='image'){ out.push(`![${b.alt||''}](${b.src||''})`); return; }
    if(b.type==='alpha-art'){
      out.push(':::alpha');
      out.push(`src: ${(b.src||'').trim()}`);
      if((b.alt||'').trim()) out.push(`alt: ${(b.alt||'').trim()}`);
      out.push(`color: ${(b.color||'#5e30eb').trim()}`);
      out.push(`bg: ${(b.bg||'transparent').trim()}`);
      out.push(`scale: ${Number.isFinite(Number(b.scale)) ? Number(b.scale) : 1}`);
      out.push(`fit: ${((b.fit||'contain')==='cover'?'cover':'contain')}`);
      out.push(`ratio: ${(b.ratio||'16/9').trim()}`);
      out.push(':::'); return;
    }
    if(b.type==='video'){ out.push(`!video(${b.src||''})`); return; }
    if(b.type==='stats'){ out.push((b.items||[]).map(s=>`${s.num||''} | ${s.label||''}`).join('\n')); return; }
    if(b.type==='skills'){ out.push((b.items||[]).map(s=>`- ${s.name||''} | ${s.pct||0}%`).join('\n')); return; }
    if(b.type==='callout'){
      out.push(`!!! ${(b.tone||'note')} ${markdownInlineFromHtml(b.title||'').trim()}`.trim());
      if((b.content||'').trim()) out.push(markdownInlineFromHtml(b.content)); return;
    }
    if(b.type==='cta'){
      out.push(':::cta');
      out.push(`${markdownInlineFromHtml(b.headline||'').trim()} | ${markdownInlineFromHtml(b.body||'').trim()} | ${(b.buttonLabel||'').trim()} | ${(b.buttonUrl||'').trim()}`);
      out.push(':::'); return;
    }
    if(b.type==='beforeafter'){
      out.push(':::beforeafter');
      out.push(`before: ![${b.beforeAlt||''}](${b.beforeSrc||''})`);
      out.push(`after: ![${b.afterAlt||''}](${b.afterSrc||''})`);
      if((b.caption||'').trim()) out.push(`caption: ${markdownInlineFromHtml(b.caption).trim()}`);
      out.push(':::'); return;
    }
    if(b.type==='faq'){
      out.push(':::faq');
      (b.items||[]).forEach(item=>{
        out.push(`- ${(item.question||'').trim()} | ${markdownInlineFromHtml(item.answer||'').trim()}${item.open ? ' | open' : ''}`);
      });
      out.push(':::'); return;
    }
    if(b.type==='gallery'){
      out.push(`:::gallery cols=${b.columns||2}`);
      (b.items||[]).forEach(it=>{
        const cap = (it.caption||'').trim();
        out.push(`- ![${it.alt||''}](${it.src||''})${cap ? ' | '+cap : ''}`);
      });
      out.push(':::'); return;
    }
    if(b.type==='process'){
      out.push(':::process');
      (b.steps||[]).forEach((s,idx)=>{
        const date = (s.date||'').trim();
        const title = (s.title||'').trim();
        const content = markdownInlineFromHtml(s.content||'').trim();
        const img = (s.image||'').trim();
        const alt = (s.imageAlt||'').trim();
        const lead = date ? `@${date} :: ${title}` : title;
        if(img) out.push(`${idx+1}. ${lead} | ${content} | ![${alt}](${img})`.trim());
        else out.push(`${idx+1}. ${lead} | ${content}`.trim());
      });
      out.push(':::'); return;
    }
    if(b.type==='divider'){ out.push('---'); }
  });
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function parseMarkdownToBlocks(md){
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;

  function inlineFormat(text){
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/`([^`]+)`/g, '<b>$1</b>');
  }

  while(i < lines.length){
    const raw = lines[i];
    const line = raw.trimEnd();
    if(!line.trim()){ i++; continue; }

    // Gallery
    const galleryStart = line.match(/^:::gallery(?:\s+cols=(2|3))?\s*$/i);
    if(galleryStart){
      const cols = parseInt(galleryStart[1]||'2',10);
      const items = [];
      i++;
      while(i<lines.length && !/^:::\s*$/.test(lines[i].trim())){
        const gm = lines[i].trim().match(/^-\s*!\[([^\]]*)\]\(([^)]+)\)(?:\s*\|\s*(.+))?$/);
        if(gm) items.push({alt:gm[1]||'',src:gm[2]||'',caption:(gm[3]||'').trim()});
        i++;
      }
      if(i<lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push({id:uid(),type:'gallery',columns:(cols===3?3:2),items:items.length?items:[{src:'',alt:'',caption:''}]});
      continue;
    }

    // Alpha art
    if(/^:::alpha\s*$/i.test(line)){
      const block = {id:uid(),type:'alpha-art',src:'',alt:'',color:'#5e30eb',bg:'transparent',scale:1,fit:'contain',ratio:'16/9'};
      i++;
      while(i<lines.length && !/^:::\s*$/.test(lines[i].trim())){
        const pair = lines[i].trim().match(/^([a-z]+)\s*:\s*(.+)$/i);
        if(pair){
          const key=pair[1].toLowerCase(), value=pair[2].trim();
          if(key==='src') block.src=value;
          else if(key==='alt') block.alt=value;
          else if(key==='color') block.color=value;
          else if(key==='bg') block.bg=value;
          else if(key==='scale'){ const p=parseFloat(value); block.scale=Number.isFinite(p)?p:1; }
          else if(key==='fit') block.fit=value.toLowerCase()==='cover'?'cover':'contain';
          else if(key==='ratio') block.ratio=value;
        }
        i++;
      }
      if(i<lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push(block);
      continue;
    }

    // CTA
    if(/^:::cta\s*$/i.test(line)){
      i++;
      const payload = (i<lines.length?lines[i].trim():'');
      const parts = payload.split('|').map(p=>p.trim());
      while(i<lines.length && !/^:::\s*$/.test(lines[i].trim())) i++;
      if(i<lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push({id:uid(),type:'cta',headline:inlineFormat(parts[0]||''),body:inlineFormat(parts[1]||''),buttonLabel:parts[2]||'',buttonUrl:parts[3]||'',tone:'default'});
      continue;
    }

    // Before/After
    if(/^:::beforeafter\s*$/i.test(line)){
      const block = {id:uid(),type:'beforeafter',beforeSrc:'',beforeAlt:'',afterSrc:'',afterAlt:'',caption:'',position:67};
      i++;
      while(i<lines.length && !/^:::\s*$/.test(lines[i].trim())){
        const current = lines[i].trim();
        const bm = current.match(/^before:\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/i);
        const am = current.match(/^after:\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/i);
        const cm = current.match(/^caption:\s*(.+)$/i);
        if(bm){ block.beforeAlt=bm[1]||''; block.beforeSrc=bm[2]||''; }
        else if(am){ block.afterAlt=am[1]||''; block.afterSrc=am[2]||''; }
        else if(cm){ block.caption=inlineFormat((cm[1]||'').trim()); }
        i++;
      }
      if(i<lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push(block);
      continue;
    }

    // FAQ
    if(/^:::faq\s*$/i.test(line)){
      const items=[];
      i++;
      while(i<lines.length && !/^:::\s*$/.test(lines[i].trim())){
        const fm = lines[i].trim().match(/^-\s*(.*?)\s*\|\s*(.*?)(?:\s*\|\s*(open))?\s*$/i);
        if(fm) items.push({question:fm[1]||'',answer:inlineFormat(fm[2]||''),open:Boolean(fm[3])});
        i++;
      }
      if(i<lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      if(items.length && !items.some(item=>item.open)) items[0].open=true;
      blocks.push({id:uid(),type:'faq',items:items.length?items:[{question:'',answer:'',open:true}]});
      continue;
    }

    // Process
    if(/^:::process\s*$/i.test(line)){
      const steps=[];
      i++;
      while(i<lines.length && !/^:::\s*$/.test(lines[i].trim())){
        const pm = lines[i].trim().match(/^\d+\.\s*(.*?)\s*(?:\|\s*(.*?))?\s*(?:\|\s*!\[([^\]]*)\]\(([^)]+)\))?\s*$/);
        if(pm){
          const lead=(pm[1]||'').trim();
          const dl = lead.match(/^@(.+?)\s*::\s*(.+)$/);
          steps.push({title:dl?dl[2].trim():lead, date:dl?dl[1].trim():'', content:inlineFormat((pm[2]||'').trim()), imageAlt:(pm[3]||'').trim(), image:(pm[4]||'').trim()});
        }
        i++;
      }
      if(i<lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push({id:uid(),type:'process',steps:steps.length?steps:[{title:'',date:'',content:'',image:'',imageAlt:''}]});
      continue;
    }

    // Callout
    const calloutMatch = line.match(/^!!!\s*(note|highlight|warning)?\s*(.*)$/i);
    if(calloutMatch){
      const tone=(calloutMatch[1]||'note').toLowerCase();
      const title=inlineFormat((calloutMatch[2]||'').trim());
      i++;
      const bodyLines=[];
      while(i<lines.length&&lines[i].trim()){ bodyLines.push(lines[i].trim()); i++; }
      blocks.push({id:uid(),type:'callout',tone,title,content:inlineFormat(bodyLines.join('<br>'))});
      continue;
    }

    // H1
    if(/^# /.test(line)){ blocks.push({id:uid(),type:'text-lg',content:inlineFormat(line.slice(2).trim()),align:'left'}); i++; continue; }
    // H2
    if(/^## /.test(line)){ blocks.push({id:uid(),type:'text-md',content:'<b>'+inlineFormat(line.slice(3).trim())+'</b>',align:'left'}); i++; continue; }
    // H3+
    if(/^#{3,} /.test(line)){ blocks.push({id:uid(),type:'text-sm',content:inlineFormat(line.replace(/^#+\s/,'')).toUpperCase(),align:'left'}); i++; continue; }

    // Blockquote
    if(/^> /.test(line)){
      const quoteLines=[];
      while(i<lines.length && /^> /.test(lines[i])){ quoteLines.push(lines[i].slice(2).trim()); i++; }
      blocks.push({id:uid(),type:'quote',content:inlineFormat(quoteLines.join(' ')),align:'left'});
      continue;
    }

    // Divider
    if(/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())){ blocks.push({id:uid(),type:'divider'}); i++; continue; }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if(imgMatch){ blocks.push({id:uid(),type:'image',src:imgMatch[2],alt:imgMatch[1]}); i++; continue; }

    // Video
    const videoMatch = line.match(/^!video\(([^)]+)\)$/i);
    if(videoMatch){ blocks.push({id:uid(),type:'video',src:videoMatch[1].trim()}); i++; continue; }

    // Stats
    const statMatch = line.match(/^([\d,]+\+?)\s*\|\s*(.+)$/);
    if(statMatch){
      const items=[];
      while(i<lines.length){
        const sm=lines[i].match(/^([\d,]+[^|]*?)\s*\|\s*(.+)$/);
        if(!sm) break;
        items.push({num:sm[1].trim(),label:sm[2].trim()});
        i++;
      }
      blocks.push({id:uid(),type:'stats',items});
      continue;
    }

    // Paragraph
    const paraLines=[];
    while(i<lines.length){
      const l=lines[i];
      if(!l.trim()) break;
      if(/^[#>!]/.test(l)) break;
      if(/^---+$/.test(l.trim()) || /^\*\*\*+$/.test(l.trim())) break;
      paraLines.push(l.trim());
      i++;
    }
    if(paraLines.length){
      const isList = paraLines.every(x=>/^[-*]\s+/.test(x));
      const content = isList
        ? inlineFormat(paraLines.map(x=>'• '+x.replace(/^[-*]\s+/,'')).join('<br>'))
        : inlineFormat(paraLines.join('<br>'));
      blocks.push({id:uid(),type:'text-md',content,align:'left'});
      continue;
    }

    // Fallback
    blocks.push({id:uid(),type:'text-md',content:inlineFormat(line.trim()),align:'left'});
    i++;
  }
  return blocks;
}

// ─────────────────────────────────────────
// LIVE PREVIEW
// ─────────────────────────────────────────
let previewTimer = null, previewReady = false;

// Build a synthetic content.json object so index.html's preview can render
function buildContentStub(){
  return {
    name: 'RGR Studio',
    role: 'Animator',
    location: '',
    reel: { type:'placeholder', url:'' },
    contact: { email:'', links:[] },
    about: [],
    projects: projects.map(p=>p.id),
    filters: defaultFilters,
    theme: {
      ink:'#1a1714', paper:'#f2ede4', accent:'#5e30eb', panelBg:'#f7f3ec',
      ctAccent:'#ff4361', ctBg:'#080808', ctHi:'#ffffff', sensitiveColor:'#e03030'
    },
    projectCards: projects.map(p=>({
      id:p.id, title:p.title, type:p.type, typeLabel:p.typeLabel||p.type,
      year:p.year, thumbnail:p.thumbnail, published:p.published!==false,
      sensitive:!!p.sensitive, sensitiveLabel:p.sensitiveLabel||'',
      sensitiveColor:p.sensitiveColor||'', longform:!!p.longform
    }))
  };
}

window.addEventListener('message', e=>{
  if(e.data && e.data.type==='preview-ready'){
    previewReady = true;
    document.getElementById('pb-dot')?.classList.add('live');
    pushPreview();
  }
});

function initPreview(){
  const frame = document.getElementById('preview-frame');
  previewReady = false;
  frame.onload = ()=>{
    previewReady = true;
    document.getElementById('pb-dot')?.classList.add('live');
    pushPreview();
  };
  frame.src = 'index.html?preview=1&v=' + Date.now();
}

function pushPreview(){
  if(!previewReady) return;
  const frame = document.getElementById('preview-frame');
  try{
    frame.contentWindow.postMessage({
      type: 'preview-data',
      content: buildContentStub(),
      projects: projects
    }, '*');
    setTimeout(sendPreviewNav, 100);
  }catch(e){}
}

function sendPreviewNav(){
  if(!previewReady) return;
  const frame = document.getElementById('preview-frame');
  try{
    let msg = { type:'preview-nav' };
    if(currentProjectId){
      msg.panel = 'project';
      msg.projectId = currentProjectId;
    } else {
      msg.panel = 'home';
    }
    frame.contentWindow.postMessage(msg, '*');
    document.getElementById('pb-dot')?.classList.add('live');
  }catch(e){}
}

function refreshPreview(){
  previewReady = false;
  document.getElementById('pb-dot')?.classList.remove('live');
  initPreview();
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
showWelcome();
initPreview();
