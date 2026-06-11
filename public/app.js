const API = '/api/tickets';
let tickets = [];

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

const fetchTickets = async () => {
  try {
    tickets = await api('GET', '');
    render();
  } catch (e) {
    console.error(e);
  }
};

const updateTicket = async (id, data) => {
  await api('PUT', `/${id}`, data);
  fetchTickets();
};

const deleteTicket = async (id) => {
  if (!confirm('Delete this ticket?')) return;
  await api('DELETE', `/${id}`);
  fetchTickets();
};

const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function card(t) {
  const paused = t.status === 'paused';
  const active = t.status === 'in_progress';

  let actions = '';
  if (t.status === 'todo' || paused) {
    actions = `
      <button class="btn-act start" onclick="updateTicket(${t.id},{status:'in_progress'})">&#9654; Start</button>
      <button class="btn-act del"   onclick="deleteTicket(${t.id})">&#10005; Delete</button>`;
  } else if (active) {
    actions = `
      <button class="btn-act done"  onclick="updateTicket(${t.id},{status:'done'})">&#10003; Done</button>
      <button class="btn-act"       onclick="updateTicket(${t.id},{status:'paused'})">&#9646;&#9646; Pause</button>
      <button class="btn-act del"   onclick="deleteTicket(${t.id})">&#10005;</button>`;
  } else {
    actions = `
      <button class="btn-act"       onclick="updateTicket(${t.id},{status:'todo'})">&#8617; Reopen</button>
      <button class="btn-act del"   onclick="deleteTicket(${t.id})">&#10005; Delete</button>`;
  }

  return `
    <div class="ticket">
      <div class="ticket-top">
        <span class="ticket-id">#${t.id}</span>
        <span class="pbadge ${t.priority}">${t.priority.toUpperCase()}</span>
      </div>
      <div class="ticket-title">${esc(t.title)}</div>
      ${paused ? `<span class="paused-tag">&#9646;&#9646; PAUSED &mdash; waiting for usage reset</span>` : ''}
      ${t.working_directory ? `<div class="ticket-dir">&#128193; ${esc(t.working_directory)}</div>` : ''}
      ${t.description ? `<div class="ticket-desc">${esc(t.description)}</div>` : ''}
      <div class="ticket-actions">${actions}</div>
    </div>`;
}

function render() {
  const todo   = tickets.filter(t => t.status === 'todo' || t.status === 'paused');
  const active = tickets.filter(t => t.status === 'in_progress');
  const done   = tickets.filter(t => t.status === 'done');

  todo.sort((a, b) => {
    if (a.status === 'paused' && b.status !== 'paused') return -1;
    if (b.status === 'paused' && a.status !== 'paused') return 1;
    const p = { high: 0, mid: 1, low: 2 };
    return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
  });

  const $todo   = document.getElementById('cards-todo');
  const $active = document.getElementById('cards-active');
  const $done   = document.getElementById('cards-done');

  $todo.innerHTML   = todo.length   ? todo.map(card).join('')   : '<div class="empty-col"><div class="icon">&#9989;</div>No pending tickets</div>';
  $done.innerHTML   = done.length   ? done.map(card).join('')   : '<div class="empty-col"><div class="icon">&#128203;</div>No completed tasks</div>';

  if (active.length) {
    $active.innerHTML = active.map(card).join('') +
      `<div class="ai-indicator"><span class="spinner"></span>AI is working on #${active[0].id}</div>`;
  } else {
    $active.innerHTML = '<div class="empty-col"><div class="icon">&#128164;</div>AI is idle</div>';
  }

  document.getElementById('count-todo').textContent   = todo.length;
  document.getElementById('count-active').textContent = active.length;
  document.getElementById('count-done').textContent   = done.length;

  const st = document.getElementById('ai-status');
  if (active.length) {
    st.textContent = `AI: Working on #${active[0].id}`;
    st.className = 'ai-status working';
  } else if (todo.some(t => t.status === 'paused')) {
    st.textContent = 'AI: Paused (usage limit)';
    st.className = 'ai-status paused';
  } else {
    st.textContent = 'AI: Idle';
    st.className = 'ai-status idle';
  }
}

// Modal
const modal  = document.getElementById('modal');
const form   = document.getElementById('ticket-form');
const open   = () => modal.classList.remove('hidden');
const close  = () => { modal.classList.add('hidden'); form.reset(); };

document.getElementById('btn-new').onclick    = open;
document.getElementById('btn-close').onclick  = close;
document.getElementById('btn-cancel').onclick = close;
modal.onclick = e => { if (e.target === modal) close(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

form.onsubmit = async e => {
  e.preventDefault();
  const priority = form.querySelector('input[name=priority]:checked')?.value || 'mid';
  await api('POST', '', {
    title:             document.getElementById('f-title').value.trim(),
    description:       document.getElementById('f-desc').value.trim(),
    priority,
    working_directory: document.getElementById('f-dir').value.trim()
  });
  close();
  fetchTickets();
};

fetchTickets();
setInterval(fetchTickets, 4000);
