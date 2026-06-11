# TaskRelay Skill

Autonomous task execution from the TaskRelay queue.
Reads tickets by priority (HIGH > MID > LOW), executes them, monitors usage, and self-pauses when usage reaches 5% — then auto-resumes after the reset.

## Triggers
- "Start work from TaskRelay"
- "taskrelay start" / "work on tickets" / "execute tickets"
- `/taskrelay`
- Fired automatically by ScheduleWakeup (polling loop or usage-pause resume)

## Stop Trigger
- **"stop working on taskrelay"** / **"stop taskrelay"** / **"taskrelay stop"** → cancel any pending ScheduleWakeup, report final summary, stop the loop completely.

## TaskRelay Endpoints
- **Queue** (priority-sorted, paused first): `GET http://192.168.68.111:4010/api/tickets/queue`
- **Update ticket**: `PUT http://192.168.68.111:4010/api/tickets/:id` `{"status":"..."}`
- **UI**: http://192.168.68.111:4010

Valid statuses: `todo`, `in_progress`, `done`, `paused`, `cancelled`

---

## Work Loop

### Phase 0 — Check usage FIRST
Before touching any ticket, check whether Claude Code reports near-limit usage.
If you see "X% remaining" and X <= 5, or "usage limit reached", go directly to **PAUSE FLOW**.

### Phase 1 — Fetch the queue
```bash
curl -s http://192.168.68.111:4010/api/tickets/queue
```
- Returns tickets sorted by: paused first → HIGH → MID → LOW → oldest
- If the array is empty: **do NOT stop** — report "Queue empty. Checking again in 60s…" then call ScheduleWakeup with delaySeconds=60, prompt="Start work from TaskRelay", reason="TaskRelay polling — queue empty, rechecking". Stay connected indefinitely until the user says **"stop working on taskrelay"** or closes the terminal.

### Phase 2 — Claim the top ticket
Take ticket[0]. Mark it in_progress:
```bash
curl -s -X PUT http://192.168.68.111:4010/api/tickets/TICKET_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'
```
Announce: `Starting ticket #ID [PRIORITY]: TITLE`

### Phase 3 — Load project context + resolve working directory

#### Step 3a — Fetch project details (if ticket has project_id)
If the ticket has a `project_id`, fetch it:
```bash
curl -s http://192.168.68.111:4010/api/projects/PROJECT_ID
```
This returns: `name`, `location`, `tech_stack`, `notes` (AI knowledge), `description`.

Use this information as context for executing the task:
- **`location`** → use as working directory if ticket's `working_directory` is empty
- **`tech_stack`** → know what stack you're working with
- **`notes`** → read as AI knowledge/context before starting work
- Announce: `Project: PROJECT_NAME | Stack: TECH_STACK | Dir: LOCATION`

#### Step 3b — Resolve working directory

Priority order:
1. `ticket.working_directory` (if set — overrides project)
2. `project.location` (if ticket has a project with location set)
3. No directory (work from wherever makes sense)

The `working_directory` / `location` field accepts either a full absolute path OR a project name/keyword.

**Check `project.type` first:**

---

**If `project.type === 'existing'`** (default):

Find the directory. If it starts with `/` → use as-is. Otherwise search:

```bash
# Search Thomas-SRC first
find /Users/admin/Documents/Thomas-SRC -maxdepth 2 -type d \
  -iname "*KEYWORD*" 2>/dev/null | head -5

# If nothing, search Profile-SRC
find /Users/admin/Documents/Profile-SRC -maxdepth 2 -type d \
  -iname "*KEYWORD*" 2>/dev/null | head -5
```

Pick best match (shortest path, Thomas-SRC preferred).
If nothing found → mark ticket paused with note "directory not found: KEYWORD", move to next ticket.

---

**If `project.type === 'new'`** (AI should create the directory):

The `location` field contains either a full path or `PARENT/FOLDERNAME` format.

**Case A — full path** (starts with `/`):
```bash
mkdir -p "/full/path/to/NewProject"
```

**Case B — keyword/name** (e.g. `Thomas-SRC/MyNewApp` or just `MyNewApp`):
- If format is `PARENT/NAME`: resolve the parent with `find`, then create `PARENT_PATH/NAME`
- If just a name with no `/`: default parent is `/Users/admin/Documents/Thomas-SRC/`
```bash
# Example: location = "Thomas-SRC/GreekDesire2"
PARENT=$(find /Users/admin/Documents/Thomas-SRC -maxdepth 1 -type d 2>/dev/null | head -1)
# PARENT = /Users/admin/Documents/Thomas-SRC
mkdir -p "/Users/admin/Documents/Thomas-SRC/GreekDesire2"
```

After creating the directory, also initialize it if appropriate (e.g., `git init` for a code project).

Announce: `Created new project directory → /full/resolved/path`

Update the project's location in TaskRelay to the resolved full path:
```bash
curl -s -X PUT http://192.168.68.111:4010/api/projects/PROJECT_ID \
  -H "Content-Type: application/json" \
  -d '{"location":"/full/resolved/path","type":"existing"}'
```
(Setting type to "existing" after creation so it won't re-create on next ticket.)

---

Announce the resolved path: `Resolved "KEYWORD" → /full/path/to/project`

#### Step 3c — Execute the task
1. Use the resolved path as the working root for all file operations.
2. Read `description` — this is the full task specification.
3. If the project has `notes` (AI knowledge), read them as context before starting.
4. Use Claude Code tools (Read, Edit, Write, Bash, etc.) to complete the task.
5. Work until the task described is fully done.

### Phase 4 — Complete and continue
Write a concise summary of what was done, then mark the ticket done with that summary as `notes`:

```bash
curl -s -X PUT http://192.168.68.111:4010/api/tickets/TICKET_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done",
    "notes": "- Created auth.js with JWT login and refresh logic\n- Updated routes/index.js to add /login and /logout\n- Added 3 tests in auth.test.js (all passing)\n- Working directory: ~/webapp/"
  }'
```

**Notes format** — bullet list, plain text, covering:
- What files were created or changed
- What was implemented / fixed
- Any important decisions made
- Resolved working directory (if it was a keyword)

Keep notes under ~200 words. Use `\n` for line breaks in the JSON string.

Announce: `✓ Completed #ID: TITLE`

Then **check usage** (Phase 0), and if OK go back to Phase 1 for the next ticket.
Repeat until queue is empty or usage triggers a pause.

---

## Usage Monitoring

### What to watch for
After every completed ticket (or significant milestone within a long task), check for these messages from Claude Code:
- "You have X% of your usage remaining"
- "Usage limit reached. Resets at HH:MM AM/PM"
- "Your usage resets in Xh Ym"
- Any message indicating you're at or below 5% remaining

### PAUSE FLOW — when at 5% or limit reached

**Step 1**: If currently working on a ticket, mark it paused:
```bash
curl -s -X PUT http://192.168.68.111:4010/api/tickets/CURRENT_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"paused"}'
```

**Step 2**: Extract the reset time from Claude Code's message.
Examples:
- "resets at 3:45 PM" → calculate seconds from now until 3:45 PM today (or tomorrow if past)
- "resets in 2h 15m" → delaySeconds = 8100
- "resets in 47 minutes" → delaySeconds = 2820

Always add 120 seconds buffer so you don't wake up too early.

**Step 3**: Call ScheduleWakeup:
```
delaySeconds: (calculated seconds to reset) + 120
prompt: "Start work from TaskRelay"
reason: "usage at 5% - resuming after reset at HH:MM"
```

**Step 4**: Report to user:
```
⏸ Paused — usage at 5%.
Ticket #ID saved as paused.
Will resume automatically at HH:MM.
Queue: N tickets remaining.
```

### On Resume (ScheduleWakeup fires)
The prompt "Start work from TaskRelay" fires again. The skill restarts at Phase 0.
The queue will return the previously paused ticket first — resume it normally.

---

## Priority Rules
1. **Paused tickets** — always resume interrupted work first
2. **HIGH** priority tickets
3. **MID** priority tickets
4. **LOW** priority tickets
5. Within same priority: oldest `created_at` first

---

## Session Summary
Only print a summary when the loop is **explicitly stopped** (user says stop) or on a usage-pause:
```
=== TaskRelay Session Summary ===
Completed : N tickets  (#1, #3, #5)
Paused    : N tickets  (#4 — usage limit, resumes at HH:MM)
Errors    : N tickets  (#7 — reason)
Queue left: N tickets
```
When the queue is empty and the loop is still running, do NOT print a summary — just report the idle message and reschedule.

---

## Error Handling
- **Directory not found**: create it with `mkdir -p`, or skip ticket and mark paused with a note
- **Task fails / unclear**: mark paused, move to next ticket — do not delete
- **TaskRelay unreachable**: stop and report "TaskRelay not accessible at 192.168.68.111:4010"
- **3 consecutive failures**: stop, report all failure reasons, ask user to review tickets

---

## Notes
- Never mark a ticket done unless the task is actually finished
- Paused tickets reappear at the top of the queue on next session
- `working_directory` accepts a full path OR a project name — the skill resolves it automatically
- Search order: Thomas-SRC first, then Profile-SRC
- The working_directory is on THIS machine (the one running Claude Code), not the server
- This skill is designed to run fully autonomously — no user input needed during execution

## Working Directory Examples
| What you type | Resolves to |
|---------------|-------------|
| `greekdesire` | `/Users/admin/Documents/Thomas-SRC/greekdesire/` |
| `nexuslayer`  | `/Users/admin/Documents/Thomas-SRC/NextLayer/` |
| `mdmermaid`   | `/Users/admin/Documents/Thomas-SRC/mdmermaid/` |
| `ospd`        | `/Users/admin/Documents/Profile-SRC/OSPD2/` (or best match) |
| `clientflow`  | `/Users/admin/Documents/Thomas-SRC/New-Project-1/clientflow/` |
| `/Users/admin/Documents/Thomas-SRC/MyApp` | used as-is |
