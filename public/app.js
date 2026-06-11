// ═══════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════
const S = {
  tickets: [],
  projects: [],
  stats: { tickets:{}, by_priority:{}, recent:[], projects:0 },
  view: 'dashboard',
  boardFilter: null,
  showArchived: false,
  editTicket: null,
  editProject: null,
  fromTicketModal: false,
  selectedColor: '#7c3aed',
};

const PROJECT_COLORS = [
  '#7c3aed','#3b82f6','#10b981','#f59e0b',
  '#ef4444','#ec4899','#06b6d4','#f97316',
  '#8b5cf6','#14b8a6',
];

const STATUS_DOT = {
  todo:'#64748b', in_progress:'#3b82f6',
  done:'#10b981', paused:'#f59e0b', cancelled:'#ef4444'
};

const STATUS_CLASS = {
  todo:'sb-todo', in_progress:'sb-progress',
  done:'sb-done', paused:'sb-paused', cancelled:'sb-cancelled'
};

const STATUS_LABEL = {
  todo:'To Do', in_progress:'In Progress',
  done:'Done', paused:'Paused', cancelled:'Cancelled'
};

// ═══════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════
async function api(method, path, body) {
  const r = await fetch('/api' + path, {
    method,
    headers: body ? {'Content-Type':'application/json'} : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json();
}

// ═══════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════
async function fetchAll() {
  try {
    const [tickets, projects, stats] = await Promise.all([
      api('GET','/tickets'), api('GET','/projects'), api('GET','/stats')
    ]);
    S.tickets  = tickets;
    S.projects = projects;
    S.stats    = stats;
    render();
  } catch(e) { console.error('fetch:', e); }
}

// ═══════════════════════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════════════════════
function showView(name) {
  S.view = name;
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === name)
  );
  document.querySelectorAll('.view').forEach(v =>
    v.classList.toggle('active', v.id === `view-${name}`)
  );
  const titles = { dashboard:'Dashboard', board:'Board', projects:'Projects' };
  document.getElementById('page-title').textContent = titles[name] || name;
  render();
}

// ═══════════════════════════════════════════════════════════
// Render dispatcher
// ═══════════════════════════════════════════════════════════
function render() {
  updateAiChip();
  if (S.view === 'dashboard') renderDashboard();
  else if (S.view === 'board')   renderBoard();
  else if (S.view === 'projects') renderProjects();
}

// ═══════════════════════════════════════════════════════════
// AI Status Chip
// ═══════════════════════════════════════════════════════════
function updateAiChip() {
  const chip = document.getElementById('ai-chip');
  const text = document.getElementById('ai-chip-text');
  const active = S.tickets.find(t => t.status === 'in_progress');
  const paused = S.tickets.find(t => t.status === 'paused');
  chip.className = 'ai-chip';
  if (active) {
    chip.classList.add('working');
    text.textContent = `Working on #${active.id}`;
  } else if (paused) {
    chip.classList.add('paused');
    text.textContent = 'Paused (usage limit)';
  } else {
    text.textContent = 'AI Idle';
  }
}

// ═══════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════
function renderDashboard() {
  const st = S.stats;
  const t = st.tickets || {};
  const bp = st.by_priority || {};
  const maxPrio = Math.max(bp.high||0, bp.mid||0, bp.low||0, 1);

  const statCards = [
    { cls:'sc-purple', icon:'📁', val: st.projects||0,    label:'Projects' },
    { cls:'sc-blue',   icon:'📋', val: t.total||0,        label:'Total Tickets' },
    { cls:'sc-amber',  icon:'⚡', val: t.in_progress||0,  label:'In Progress' },
    { cls:'sc-green',  icon:'✓',  val: t.done||0,         label:'Completed' },
  ];

  const statsHtml = statCards.map((c,i) => `
    <div class="stat-card ${c.cls}" style="animation-delay:${i*0.06}s">
      <div class="stat-icon">${c.icon}</div>
      <div class="stat-val">${c.val}</div>
      <div class="stat-label">${c.label}</div>
    </div>
  `).join('');

  const prioHtml = `
    <div class="prio-bar-row">
      ${prioBar('HIGH','high', bp.high||0, maxPrio, '#ef4444')}
      ${prioBar('MID', 'mid',  bp.mid||0,  maxPrio, '#f59e0b')}
      ${prioBar('LOW', 'low',  bp.low||0,  maxPrio, '#10b981')}
    </div>
  `;

  const recentHtml = (st.recent || []).length === 0
    ? '<div class="empty-col" style="padding:16px"><div class="empty-icon">📭</div>No activity yet</div>'
    : (st.recent || []).map(t => `
      <div class="activity-item">
        <span class="activity-dot" style="background:${STATUS_DOT[t.status]||'#64748b'}"></span>
        <span class="activity-title">${esc(t.title)}</span>
        <div class="activity-meta">
          ${t.project_name ? `<span class="proj-badge"><span class="proj-badge-dot" style="background:${t.project_color||'#7c3aed'}"></span>${esc(t.project_name)}</span>` : ''}
          <span class="status-badge ${STATUS_CLASS[t.status]||'sb-todo'}">${STATUS_LABEL[t.status]||t.status}</span>
          <span class="activity-time">${timeAgo(t.updated_at)}</span>
        </div>
      </div>
    `).join('');

  const projectsMiniHtml = S.projects.length === 0
    ? '<div style="color:var(--text4);font-size:12px;text-align:center;padding:16px">No projects yet</div>'
    : S.projects.map(p => `
      <div class="project-mini" onclick="showView('projects')">
        <span class="pmini-dot" style="background:${p.color}"></span>
        <span class="pmini-name">${esc(p.name)}</span>
        ${p.tech_stack ? `<span class="pmini-tech">${esc(p.tech_stack)}</span>` : ''}
        <span class="pmini-counts">${p.active_tickets} active · ${p.total_tickets} total</span>
      </div>
    `).join('');

  document.getElementById('view-dashboard').innerHTML = `
    <div class="dashboard">
      <div class="stats-grid">${statsHtml}</div>
      <div class="dash-row" style="animation-delay:.12s">
        <div class="dash-card">
          <div class="dash-card-title">Priority Distribution</div>
          ${prioHtml}
          ${(t.paused||0) > 0 ? `<div style="margin-top:12px;font-size:11.5px;color:var(--amber);padding:6px 10px;background:var(--amber-s);border-radius:6px">⏸ ${t.paused} ticket${t.paused>1?'s':''} paused (usage limit)</div>` : ''}
        </div>
        <div class="dash-card">
          <div class="dash-card-title">Recent Activity</div>
          <div class="activity-list">${recentHtml}</div>
        </div>
      </div>
      <div class="dash-card" style="animation-delay:.18s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="dash-card-title" style="margin:0">Projects Overview</div>
          <button class="btn-ghost" style="font-size:11.5px;padding:4px 10px" onclick="showView('projects')">View all →</button>
        </div>
        <div class="project-mini-list">${projectsMiniHtml}</div>
      </div>
    </div>
  `;
}

function prioBar(label, cls, val, max, color) {
  const pct = max > 0 ? Math.round((val / max) * 100) : 0;
  return `
    <div class="prio-bar-item">
      <span class="prio-bar-label pbl-${cls}">${label}</span>
      <div class="prio-bar-track">
        <div class="prio-bar-fill pbf-${cls}" style="width:${pct}%"></div>
      </div>
      <span class="prio-bar-n">${val}</span>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// Board
// ═══════════════════════════════════════════════════════════
function renderBoard() {
  let tickets = S.tickets;
  if (S.boardFilter !== null) {
    tickets = tickets.filter(t => t.project_id === S.boardFilter);
  }

  const todo   = tickets.filter(t => t.status === 'todo' || t.status === 'paused');
  const active = tickets.filter(t => t.status === 'in_progress');
  const allDone = tickets.filter(t => t.status === 'done');
  const archivedCount = allDone.filter(t => t.archived).length;
  const done = S.showArchived ? allDone : allDone.filter(t => !t.archived);

  todo.sort((a,b) => {
    if (a.status==='paused' && b.status!=='paused') return -1;
    if (b.status==='paused' && a.status!=='paused') return 1;
    const p={high:0,mid:1,low:2};
    return (p[a.priority]??1)-(p[b.priority]??1);
  });

  const filterChips = `
    <button class="filter-chip${S.boardFilter===null?' active':''}"
      style="${S.boardFilter===null?'background:var(--purple);':''}"
      onclick="setBoardFilter(null)">All</button>
    ${S.projects.map(p => `
      <button class="filter-chip${S.boardFilter===p.id?' active':''}"
        style="${S.boardFilter===p.id?`background:${p.color};`:'border-color:${p.color}26'}"
        onclick="setBoardFilter(${p.id})">
        <span class="filter-dot" style="background:${p.color}"></span>
        ${esc(p.name)}
      </button>
    `).join('')}
    <label class="show-archived-ctrl">
      <input type="checkbox" ${S.showArchived?'checked':''} onchange="toggleArchived(this.checked)">
      Show Archived${archivedCount > 0 ? ` <span class="archived-count">${archivedCount}</span>` : ''}
    </label>
  `;

  const todoHtml   = todo.length   ? todo.map(ticketCard).join('')   : emptyCol('✅','No pending tickets');
  const activeHtml = active.length
    ? active.map(ticketCard).join('') + `<div class="ai-working-card"><span class="spin-md"></span>AI is working on #${active[0].id}</div>`
    : emptyCol('💤','AI is idle');
  const doneHtml   = done.length   ? done.map(ticketCard).join('')   : emptyCol('📋','No completed tasks');

  document.getElementById('view-board').innerHTML = `
    <div class="board-filters">${filterChips}</div>
    <div class="kanban">
      <div class="col">
        <div class="col-bar cb-todo"></div>
        <div class="col-hdr">
          <span class="col-title ct-todo">To Do</span>
          <span class="col-count">${todo.length}</span>
        </div>
        <div class="cards-list">${todoHtml}</div>
      </div>
      <div class="col">
        <div class="col-bar cb-progress"></div>
        <div class="col-hdr">
          <span class="col-title ct-progress">In Progress</span>
          <span class="col-count">${active.length}</span>
        </div>
        <div class="cards-list">${activeHtml}</div>
      </div>
      <div class="col">
        <div class="col-bar cb-done"></div>
        <div class="col-hdr">
          <span class="col-title ct-done">Done</span>
          <span class="col-count">${done.length}</span>
        </div>
        <div class="cards-list">${doneHtml}</div>
      </div>
    </div>
  `;
}

function toggleArchived(checked) {
  S.showArchived = checked;
  renderBoard();
}

function setBoardFilter(id) {
  S.boardFilter = id;
  renderBoard();
}

function ticketCard(t) {
  const paused = t.status === 'paused';
  const active = t.status === 'in_progress';
  const done   = t.status === 'done';

  let actions = '';
  if (t.status === 'todo' || paused) {
    actions = `
      <button class="btn-sm blue" onclick="upd(${t.id},{status:'in_progress'})">▶ Start</button>
      <button class="btn-sm" onclick="editTicket(${t.id})">Edit</button>
      <button class="btn-sm danger" onclick="delTicket(${t.id})">✕</button>`;
  } else if (active) {
    actions = `
      <button class="btn-sm green" onclick="upd(${t.id},{status:'done'})">✓ Done</button>
      <button class="btn-sm" onclick="upd(${t.id},{status:'paused'})">⏸ Pause</button>
      <button class="btn-sm danger" onclick="delTicket(${t.id})">✕</button>`;
  } else if (t.archived) {
    actions = `
      <button class="btn-sm" onclick="upd(${t.id},{archived:0})">↩ Unarchive</button>
      <button class="btn-sm danger" onclick="delTicket(${t.id})">✕ Delete</button>`;
  } else {
    actions = `
      <button class="btn-sm" onclick="upd(${t.id},{status:'todo'})">↩ Reopen</button>
      <button class="btn-sm amber" onclick="upd(${t.id},{archived:1})">📦 Archive</button>
      <button class="btn-sm danger" onclick="delTicket(${t.id})">✕</button>`;
  }

  const projBadge = t.project_name
    ? `<span class="proj-badge"><span class="proj-badge-dot" style="background:${t.project_color||'#7c3aed'}"></span>${esc(t.project_name)}</span>`
    : '';

  const notesHtml = done && t.notes
    ? `<div class="tc-notes"><span class="tc-notes-label">🤖 AI notes</span>${esc(t.notes)}</div>`
    : '';

  const progressHtml = active
    ? `<div class="tc-progress-row"><span class="spin-sm"></span>AI working…</div>`
    : '';

  const pausedTag = paused
    ? `<div class="tc-paused-tag">⏸ PAUSED — waiting for reset</div>`
    : '';

  const archivedBadge = t.archived
    ? `<div class="tc-archived-badge">📦 Archived</div>`
    : '';

  const dirHtml = t.working_directory
    ? `<div class="tc-dir">📁 ${esc(t.working_directory)}</div>`
    : '';

  return `
    <div class="ticket-card${done?' tc-done':''}${t.archived?' tc-archived':''}">
      <div class="tc-top">
        <span class="tc-id">#${t.id}</span>
        <div class="tc-badges">
          ${projBadge}
          <span class="pbadge ${t.priority}">${t.priority.toUpperCase()}</span>
        </div>
      </div>
      <div class="tc-title">${esc(t.title)}</div>
      ${archivedBadge}${pausedTag}${progressHtml}${dirHtml}
      ${t.description ? `<div class="tc-desc">${esc(t.description)}</div>` : ''}
      ${notesHtml}
      <div class="tc-actions">${actions}</div>
    </div>`;
}

function emptyCol(icon, msg) {
  return `<div class="empty-col"><div class="empty-icon">${icon}</div>${msg}</div>`;
}

// ═══════════════════════════════════════════════════════════
// Projects View
// ═══════════════════════════════════════════════════════════
function renderProjects() {
  if (S.projects.length === 0) {
    document.getElementById('view-projects').innerHTML = `
      <div class="projects-view">
        <div class="no-projects">
          <div class="no-projects-icon">📁</div>
          <div class="no-projects-text">No projects yet</div>
          <div class="no-projects-sub">Create a project to organise your tickets</div>
          <br>
          <button class="btn-primary" onclick="openProjectModal()" style="margin-top:8px">+ Create First Project</button>
        </div>
      </div>`;
    return;
  }

  const cards = S.projects.map((p, i) => `
    <div class="project-card" style="animation-delay:${i*0.07}s">
      <div class="pc-top-bar" style="background:${p.color}"></div>
      <div class="pc-body">
        <div class="pc-name">
          <span class="pc-name-dot" style="background:${p.color}"></span>
          ${esc(p.name)}
          <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;margin-left:4px;${p.type==='new'?'background:rgba(139,92,246,.2);color:#a78bfa':'background:var(--surface);color:var(--text3)'}">${p.type==='new'?'✨ New':'📁 Existing'}</span>
        </div>
        <div class="pc-desc">${esc(p.description || '')}</div>
        <div class="pc-meta">
          ${p.location ? `<div class="pc-meta-row"><span class="pc-meta-icon">📁</span><span class="pc-meta-val mono">${esc(p.location)}</span></div>` : ''}
          ${p.tech_stack ? `<div class="pc-meta-row"><span class="pc-meta-icon">⚙</span><span class="pc-meta-val">${esc(p.tech_stack)}</span></div>` : ''}
          ${p.notes ? `<div class="pc-meta-row"><span class="pc-meta-icon">📝</span><span class="pc-meta-val" style="color:var(--text3);font-style:italic">${esc(p.notes.slice(0,120))}${p.notes.length>120?'…':''}</span></div>` : ''}
        </div>
        <div class="pc-counts">
          <span class="pc-count-badge pcb-active">⚡ ${p.active_tickets} active</span>
          <span class="pc-count-badge pcb-total">📋 ${p.total_tickets} total</span>
        </div>
        <div class="pc-actions">
          <button class="btn-sm blue" onclick="editProject(${p.id})">✏ Edit</button>
          <button class="btn-sm" onclick="boardForProject(${p.id})">Board →</button>
          <button class="btn-sm danger" onclick="delProject(${p.id}, '${esc(p.name)}')">✕ Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  document.getElementById('view-projects').innerHTML = `
    <div class="projects-view">
      <div class="projects-grid">${cards}</div>
    </div>`;
}

function boardForProject(id) {
  S.boardFilter = id;
  showView('board');
}

// ═══════════════════════════════════════════════════════════
// Modals — Ticket
// ═══════════════════════════════════════════════════════════
function openTicketModal(ticket = null) {
  S.editTicket = ticket;
  const title = document.getElementById('ticket-modal-title');
  const btn   = document.getElementById('ticket-submit-btn');
  title.textContent = ticket ? 'Edit Ticket' : 'New Ticket';
  btn.textContent   = ticket ? 'Save Changes' : 'Create Ticket';

  // Populate project select
  const sel = document.getElementById('ft-project');
  sel.innerHTML = '<option value="">— No project —</option>' +
    S.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

  if (ticket) {
    document.getElementById('ft-title').value = ticket.title || '';
    document.getElementById('ft-desc').value  = ticket.description || '';
    document.getElementById('ft-dir').value   = ticket.working_directory || '';
    sel.value = ticket.project_id || '';
    const radio = document.querySelector(`input[name=priority][value="${ticket.priority}"]`);
    if (radio) radio.checked = true;
  } else {
    document.getElementById('ticket-form').reset();
    sel.value = '';
    const mid = document.querySelector(`input[name=priority][value="mid"]`);
    if (mid) mid.checked = true;
  }

  document.getElementById('ticket-modal').classList.remove('hidden');
  document.getElementById('ft-title').focus();
}

async function submitTicket(e) {
  e.preventDefault();
  const title   = document.getElementById('ft-title').value.trim();
  const desc    = document.getElementById('ft-desc').value.trim();
  const dir     = document.getElementById('ft-dir').value.trim();
  const prio    = document.querySelector('input[name=priority]:checked')?.value || 'mid';
  const projRaw = document.getElementById('ft-project').value;
  const project_id = projRaw ? parseInt(projRaw) : null;

  const btn = document.getElementById('ticket-submit-btn');
  btn.disabled = true;

  if (S.editTicket) {
    await api('PUT', `/tickets/${S.editTicket.id}`, { title, description:desc, working_directory:dir, priority:prio, project_id });
  } else {
    await api('POST', '/tickets', { title, description:desc, priority:prio, working_directory:dir, project_id });
  }

  closeModal('ticket-modal');
  btn.disabled = false;
  fetchAll();
}

function editTicket(id) {
  const t = S.tickets.find(x => x.id === id);
  if (t) openTicketModal(t);
}

async function upd(id, data) {
  await api('PUT', `/tickets/${id}`, data);
  fetchAll();
}

async function delTicket(id) {
  if (!confirm('Delete this ticket?')) return;
  await api('DELETE', `/tickets/${id}`);
  fetchAll();
}

// ═══════════════════════════════════════════════════════════
// Modals — Project
// ═══════════════════════════════════════════════════════════
function openProjectModal(fromTicket = false) {
  S.fromTicketModal = fromTicket === true;
  S.editProject = null;
  document.getElementById('project-modal-title').textContent = 'New Project';
  document.getElementById('project-submit-btn').textContent  = 'Create Project';
  document.getElementById('project-form').reset();
  S.selectedColor = '#7c3aed';
  buildSwatches();
  setProjectType('existing');
  document.getElementById('project-modal').classList.remove('hidden');
  document.getElementById('fp-name').focus();
}

function editProject(id) {
  const p = S.projects.find(x => x.id === id);
  if (!p) return;
  S.editProject = p;
  S.fromTicketModal = false;
  document.getElementById('project-modal-title').textContent = 'Edit Project';
  document.getElementById('project-submit-btn').textContent  = 'Save Changes';
  document.getElementById('fp-name').value     = p.name || '';
  document.getElementById('fp-desc').value     = p.description || '';
  document.getElementById('fp-location').value = p.location || '';
  document.getElementById('fp-tech').value     = p.tech_stack || '';
  document.getElementById('fp-notes').value    = p.notes || '';
  S.selectedColor = p.color || '#7c3aed';
  buildSwatches();
  setProjectType(p.type || 'existing');
  document.getElementById('project-modal').classList.remove('hidden');
}

function setProjectType(type) {
  S.projectType = type;
  document.querySelectorAll('.type-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.type === type);
  });
  const hint  = document.getElementById('fp-location-hint');
  const input = document.getElementById('fp-location');
  if (type === 'new') {
    hint.textContent  = 'where to create it — keyword (parent dir) + new folder name, e.g. Thomas-SRC/MyNewApp';
    input.placeholder = 'e.g. Thomas-SRC/MyNewApp  or  /Users/admin/Documents/Thomas-SRC/MyNewApp';
  } else {
    hint.textContent  = 'keyword or full path — AI will find this directory';
    input.placeholder = 'e.g. greekdesire  or  /Users/admin/Documents/Thomas-SRC/MyApp';
  }
}

function buildSwatches() {
  const container = document.getElementById('swatches');
  container.innerHTML = PROJECT_COLORS.map(c => `
    <span class="swatch${c===S.selectedColor?' active':''}"
      style="background:${c}"
      onclick="selectColor('${c}')"
      title="${c}"></span>
  `).join('');
}

function selectColor(c) {
  S.selectedColor = c;
  buildSwatches();
}

async function submitProject(e) {
  e.preventDefault();
  const name  = document.getElementById('fp-name').value.trim();
  const desc  = document.getElementById('fp-desc').value.trim();
  const loc   = document.getElementById('fp-location').value.trim();
  const tech  = document.getElementById('fp-tech').value.trim();
  const notes = document.getElementById('fp-notes').value.trim();
  const color = S.selectedColor;

  const type  = S.projectType || 'existing';
  const btn   = document.getElementById('project-submit-btn');
  btn.disabled = true;

  let newProject = null;
  if (S.editProject) {
    newProject = await api('PUT', `/projects/${S.editProject.id}`, { name, color, type, description:desc, location:loc, tech_stack:tech, notes });
  } else {
    newProject = await api('POST', '/projects', { name, color, type, description:desc, location:loc, tech_stack:tech, notes });
  }

  closeModal('project-modal');
  btn.disabled = false;

  await fetchAll();

  // If opened from ticket modal, auto-select the new project
  if (S.fromTicketModal && newProject && newProject.id) {
    openTicketModal(S.editTicket);
    const sel = document.getElementById('ft-project');
    if (sel) sel.value = newProject.id;
  }
}

async function delProject(id, name) {
  if (!confirm(`Delete project "${name}"? Tickets will be unlinked.`)) return;
  await api('DELETE', `/projects/${id}`);
  fetchAll();
}

// ═══════════════════════════════════════════════════════════
// Modal helpers
// ═══════════════════════════════════════════════════════════
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function overlayClick(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['ticket-modal','project-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) closeModal(id);
    });
  }
});

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ','T') + 'Z');
  const diff = (Date.now() - d) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// ═══════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════
fetchAll();
setInterval(fetchAll, 4000);
