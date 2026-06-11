# AIJira

An autonomous task manager for Claude Code. Create tickets, assign them to projects, and let the AI skill work through the queue while you focus on other things.

![AIJira Board](https://img.shields.io/badge/stack-Node.js%20%2B%20SQLite-339933?style=flat-square&logo=node.js)
![Docker](https://img.shields.io/badge/deploy-Docker-2496ED?style=flat-square&logo=docker)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## What It Does

AIJira is a lightweight kanban board built specifically for Claude Code autonomous execution. Tickets sit in a queue ordered by priority. The companion skill picks them up one by one, executes each task using Claude Code tools (Read, Edit, Write, Bash, etc.), marks them done with an AI-written summary, then moves to the next — all without human intervention.

**Key features:**

- **Kanban board** — To Do / In Progress / Done columns, live-updating every 4 seconds
- **Projects** — group tickets under projects with color coding, tech stack metadata, and AI knowledge notes
- **Priority queue** — HIGH → MID → LOW, paused tickets always resurface first
- **Archive** — completed tickets can be archived and hidden; show/hide with a checkbox
- **Usage-aware** — the skill self-pauses at 5% usage remaining and auto-resumes after reset
- **Persistent loop** — the skill polls every 60 seconds when the queue is empty; no manual restart needed

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Database | SQLite via better-sqlite3 |
| Frontend | Vanilla JS SPA (no build step) |
| Container | Docker + Docker Compose |

---

## Quick Start

### Requirements

- Docker and Docker Compose
- Claude Code with skill support

### Run with Docker Compose

```bash
git clone <this-repo>
cd AIJira
docker compose up -d
```

The UI will be available at **http://localhost:4010**.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4010` | Port the server listens on |
| `DB_PATH` | `/app/data/aijira.db` | Path to the SQLite database |

The database is persisted in a named Docker volume (`aijira_data`). To back it up:

```bash
docker cp aijira:/app/data/aijira.db ./backup.db
```

---

## API Reference

All endpoints are under `/api`.

### Tickets

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tickets` | All tickets (with project join) |
| `GET` | `/api/tickets/queue` | Priority-sorted queue (todo + paused only) |
| `GET` | `/api/tickets/:id` | Single ticket |
| `POST` | `/api/tickets` | Create ticket |
| `PUT` | `/api/tickets/:id` | Update ticket (any field) |
| `DELETE` | `/api/tickets/:id` | Delete ticket |

**Create ticket body:**
```json
{
  "title": "Add authentication to the API",
  "description": "Implement JWT login and refresh token logic",
  "priority": "high",
  "working_directory": "myapp",
  "project_id": 1
}
```

**Valid priorities:** `high`, `mid`, `low`

**Valid statuses:** `todo`, `in_progress`, `done`, `paused`, `cancelled`

**Archive a ticket:**
```bash
curl -X PUT http://localhost:4010/api/tickets/5 \
  -H "Content-Type: application/json" \
  -d '{"archived": 1}'
```

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | All projects (with ticket counts) |
| `GET` | `/api/projects/:id` | Single project |
| `POST` | `/api/projects` | Create project |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project (tickets unlinked) |

**Create project body:**
```json
{
  "name": "GreekDesire",
  "color": "#3b82f6",
  "type": "existing",
  "description": "Dating platform",
  "location": "greekdesire",
  "tech_stack": "Next.js, PostgreSQL, Docker",
  "notes": "Main API is at /api/v2. Always run migrations before deploying."
}
```

**Project types:**
- `existing` — AI will search for the directory by keyword or use the full path as-is
- `new` — AI will create the directory on first ticket execution, then flip to `existing`

### Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stats` | Dashboard stats (counts, priority breakdown, recent activity) |

---

## The AIJira Skill

The skill makes Claude Code autonomously drain the ticket queue. Install it once and trigger it with a phrase.

### Installation

1. Copy `SKILL.md` into your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills/aijira
cp SKILL.md ~/.claude/skills/aijira/SKILL.md
```

2. If you use a custom skill loader (superpowers or similar), register it:

```bash
# In your ~/.claude/CLAUDE.md or skill registry, add a reference to:
# ~/.claude/skills/aijira/SKILL.md
```

3. **Update the endpoint URL** inside `SKILL.md` to match your server:

```
# Find this line and change the IP/port:
GET http://192.168.68.111:4010/api/tickets/queue
```

### Trigger Phrases

Start the skill by saying any of:

- `Start work from AIJira`
- `aijira start`
- `work on tickets`
- `/aijira`

Stop it with:

- `stop working on aijira`
- `stop aijira`

### What the Skill Does

```
Phase 0 → Check usage (pause if ≤ 5% remaining)
Phase 1 → Fetch queue → if empty, wait 60s and retry
Phase 2 → Claim ticket → mark in_progress
Phase 3 → Load project context (location, tech stack, AI notes)
        → Resolve working directory (search or create)
        → Execute the task using Claude Code tools
Phase 4 → Mark done with AI-written summary notes
        → Loop back to Phase 1
```

When usage hits 5%, the skill saves its position (marks ticket as `paused`) and schedules an automatic resume via `ScheduleWakeup` for after the reset window.

### Project Location Resolution

The `location` field on a project (or `working_directory` on a ticket) can be:

| Value | Behavior |
|-------|----------|
| `/Users/admin/Documents/Thomas-SRC/MyApp` | Used as-is |
| `greekdesire` | Searched in `Thomas-SRC/` then `Profile-SRC/` |
| `Thomas-SRC/NewApp` (with `type: new`) | Directory created at that path |

---

## Board UI

### Views

| View | Description |
|------|-------------|
| **Dashboard** | Stat cards, priority breakdown, recent activity, projects overview |
| **Board** | Kanban columns — To Do / In Progress / Done |
| **Projects** | Project cards with metadata, ticket counts, and edit/delete |

### Board Features

- **Filter by project** — click a project chip to narrow the board to that project's tickets
- **Show Archived** — checkbox in the filter bar reveals archived tickets in the Done column
- **Archive a ticket** — click `📦 Archive` on any Done ticket to hide it
- **Unarchive** — only visible when "Show Archived" is checked; click `↩ Unarchive` to restore
- **AI chip** — sidebar footer shows live AI status (Idle / Working on #N / Paused)

### Ticket Card Actions

| Column | Actions |
|--------|---------|
| To Do / Paused | `▶ Start`, `Edit`, `✕ Delete` |
| In Progress | `✓ Done`, `⏸ Pause`, `✕ Delete` |
| Done (normal) | `↩ Reopen`, `📦 Archive`, `✕ Delete` |
| Done (archived) | `↩ Unarchive`, `✕ Delete` |

---

## Development

Run locally without Docker:

```bash
npm install
node server.js
# UI at http://localhost:4010
```

The frontend is fully static — edit `public/app.js`, `public/style.css`, or `public/index.html` and refresh. No build step.

### Project Structure

```
AIJira/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server.js          # Express API
├── db.js              # SQLite schema + query layer
├── SKILL.md           # Claude Code skill definition
└── public/
    ├── index.html     # SPA shell + modals
    ├── app.js         # All frontend logic
    └── style.css      # Dark theme
```

---

## Updating

```bash
# Pull latest code to your server
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='*.db' \
  ./ user@yourserver:/opt/aijira/

# Rebuild and restart (zero downtime on the volume)
ssh user@yourserver "cd /opt/aijira && docker compose up --build -d"
```

The SQLite volume is never touched during rebuilds.

---

## License

MIT
