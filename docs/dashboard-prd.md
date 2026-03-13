# Dashboard & Launcher Module — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/dashboard/`
**Version:** v3.14
**Last Updated:** 2026-03-13
**Status:** Active — v3.14.0 features live

---

## 1. Purpose

The Dashboard is the daily entry point for Pathfinder. Every morning, you open it to answer a single question: "What should I do today?" The Dashboard synthesizes state from all agents (Pipeline, Job Feed, Calendar, Outreach, Interview) into a single, scannable view with prioritized action items.

**Design Principles:**

1. **One question, one answer.** The Dashboard doesn't show you everything — it shows you *what matters right now*. Roles that need attention bubble to the top. Everything else fades into context.
2. **Action-oriented, not informational.** A metric is useless if it doesn't prompt a decision. Every card on the Dashboard links to an action. "3 offers pending" is noise; "Respond to Stripe offer by Friday 5pm" is actionable.
3. **Time-aware, not static.** The Dashboard knows the current time, the user's calendar, and pipeline deadlines. It surfaces urgency through both content (order, urgency labels) and visual signals (red for overdue, amber for due-today, blue for suggested).
4. **Streak is motivation, not guilt.** The daily streak counter is a light motivational mechanic. It celebrates consistency without turning off days into failures. Weekends don't break it.
5. **Nudge engine is the brain.** Rules-based nudges scan the entire pipeline state and surface exactly what needs attention. Nudges are dismissible (respecting the user's agency) but persistent enough to prevent important things from falling through cracks.

---

## 2. Architecture

### High-Level Data Model

```
┌──────────────────────────────────┐
│  Dashboard & Launcher Module     │
│  (modules/dashboard/)            │
└──────────────────────────────────┘
           │
      ┌────┴────┬────────┬──────┐
      ▼         ▼        ▼      ▼
   Pipeline  Calendar  Artifacts Feed
   (reads)   (reads)   (reads)  (reads)
      │
      ├─ pf_roles
      ├─ pf_companies
      ├─ pf_connections
      ├─ pf_streak
      ├─ pf_dismissed_nudges
      └─ pf_nudge_timestamps
```

### Data Flow

```
Dashboard on load
   │
   ├── Reads pf_roles, pf_companies, pf_connections from localStorage
   ├── Calls gcal_list_events for today's interviews (real-time)
   ├── Reads pf_artifacts index for Feed Review section
   ├── Runs nudge engine (scans pipeline state against rules)
   │
   ├── Writes pf_streak (daily timestamp update)
   └── Writes pf_dismissed_nudges (when user dismisses)
        └── Writes pf_nudge_timestamps (to prevent repeats within 24h)
```

### Storage Model

```
┌─────────────────────────────────┐
│     localStorage keys           │
├─────────────────────────────────┤
│ pf_roles: Role[]                │  ← Read-only
│ pf_companies: Company[]         │  ← Read-only
│ pf_connections: Connection[]    │  ← Read-only
│ pf_artifacts: Artifact[]        │  ← Read-only index
│                                 │
│ pf_streak: {                    │  ← Dashboard writes
│   date: string (ISO),           │
│   count: number,                │
│   lastActionDate: string        │
│ }                               │
│                                 │
│ pf_dismissed_nudges: {          │  ← Dashboard writes
│   [triggerId]: timestamp        │
│ }                               │
│                                 │
│ pf_nudge_timestamps: {          │  ← Dashboard writes
│   [triggerId]: timestamp        │
│ }                               │
└─────────────────────────────────┘
```

---

## 3. Daily View Structure

The Dashboard renders three main zones on a single-column, centered (max 720px) layout, with a greeting and streak counter at the top.

### 3.1 Greeting & Streak Counter

```
Good morning, [Name]!

🔥 7-day streak
   (click to see history)
```

**Functionality:**

- Greeting text rotates based on time of day ("Good morning", "Good afternoon", "Good evening")
- Streak shows consecutive days with ≥1 meaningful action (see Section 3.2: Action Logging)
- Weekends don't break the streak (rolling 7-day window ignores day-of-week)
- Clicking the streak opens a history view showing the last 30 days of actions
- Small animation on load if streak was extended today

---

### 3.2 Action Queue (Primary Zone)

The action queue is a prioritized list of tasks that require attention. Items are sorted by urgency, then by role/company name. Each item is a clickable card with a clear action.

**Priority Levels & Visual Signals:**

| Priority | Color | Icon | When to Use | Example |
|----------|-------|------|-------------|---------|
| **Critical** | Red (#ef4444) | ⚠️ | Immediate action required | Offer response due today; interview in 2 hours |
| **Important** | Amber (#f59e0b) | ⏱️ | Due today or very soon | Outreach follow-up due; take-home due tomorrow |
| **Suggested** | Blue (#3b82f6) | 💡 | Recommended, not urgent | New Hot-tier role posted; company profile incomplete |
| **Informational** | Gray (#6b7280) | ℹ️ | FYI, no action needed | Company profile improved; feedback from interview |

**Action Queue Triggers:**

| Trigger | Priority | Card Text | Action Link | Data Source |
|---------|----------|-----------|-------------|-------------|
| Role stuck in `applied` > 21 days | Important | "No response from {company} for {days} days — mark as ghosted?" | Open role detail panel | pf_roles + nudge engine |
| Offer without response > 48h | Critical | "⚠️ Offer from {company} expires {date} — respond now" | Open offer substage | pf_roles (offer.substage) |
| Outreach step due (from contact log) | Important | "Send follow-up email to {contact} at {company}" | Open Outreach Message Generator | pf_connections + contact.outreachLog |
| Take-home due < 48h | Critical | "Take-home for {company} due {date} — submit by {time}" | Open role detail (Application tab) | pf_roles (interviewing.takeHomeDeadline) |
| Hot-tier company, no active roles | Suggested | "{company} is Hot with no active roles — check for new postings?" | Open Pipeline filtered to company | pf_companies (tier=Hot) + pf_roles |
| Interview scheduled < 48h, no brief | Critical | "Interview at {company} in {time} — generate research brief?" | Open Research Brief pre-loaded | gcal_list_events + pf_roles |
| New Hot-tier role from Job Feed | Suggested | "🔥 {company} posted {title} (match: {score}%)" | Open Pipeline card or Job Feed Review | pf_artifacts (feed metadata) |
| Interview prep not started for upcoming round | Important | "Prep not started for {company} {round type} — review materials?" | Open Research Brief section 9-10 | pf_roles (interviewSubstate) |
| Company profile < 50% complete | Informational | "{company} profile sparse — add funding, tech stack, etc.?" | Open Pipeline company profile | pf_companies (enriched fields count) |
| Outreach message requires response | Important | "Did {contact} respond to your {company} message?" | Open connection detail | pf_connections + outreachLog |

**Card Design:**

Each action queue card shows:

```
┌──────────────────────────────────────┐
│ ⚠️ CRITICAL                          │
│                                      │
│ Offer from Stripe expires Friday     │
│ (2 days)                             │
│                                      │
│ Staff Product Manager                │
│ $450-550K base + equity              │
│                                      │
│ [View Offer] [Dismiss for 24h]       │
└──────────────────────────────────────┘
```

**Interactions:**

- Click card → opens the relevant agent module or detail panel pre-loaded with the role/connection/company
- "Dismiss for 24h" → adds triggerId to `pf_dismissed_nudges` with a timestamp; nudge won't resurface until 24h passes (checked via `pf_nudge_timestamps`)
- Swipe left (mobile) → quick dismiss option
- Keyboard shortcut (e.g., `J` then `D`) → jump to Dashboard
- Action Queue has max height with scroll; items flow vertically

**Empty State:**

If no critical or important items exist, the queue shows a celebratory message:

```
✨ No urgent actions today!

You're all caught up. Here are some suggestions:
- Check new Hot-tier postings [View Feed]
- Generate briefs for next week's interviews [Research Brief]
- Review your pipeline health [View Pipeline]
```

---

### 3.3 Pipeline Summary (Secondary Zone)

A compact statistics view showing pipeline health at a glance. Updated in real-time as you navigate between modules.

**4 Cards in a 2x2 or single-column layout (responsive):**

**Card 1: Roles by Stage (Bar Chart)**

Horizontal bar chart or count summary showing distribution across 8 stages:

```
Discovered:    |||||| 6
Researching:   ||| 3
Outreach:      |||| 4
Applied:       |||||||| 8
Screen:        ||| 3
Interviewing:  || 2
Offer:         | 1
Closed:        ||||||||||||||||| 17
```

Click any bar → opens Pipeline filtered to that stage.

**Card 2: Conversion Funnel**

> **Status: Implemented (v3.12.0)** — Shows stage-by-stage conversion rates as a bar chart. Sourced from pipeline stage history. Displays after 10+ closed roles.

Shows conversion rates from stage to stage (useful after you've closed 10+ roles):

```
Discovered     100% (50 roles)
  ↓
Applied        68% (34 roles)
  ↓
Screen         53% (18 roles)
  ↓
Interviewing   50% (9 roles)
  ↓
Offer          33% (3 roles)
  ↓
Closed         100% (3 roles accepted)
```

Caveat: "Calculate after 10+ closed roles" — before that, show placeholder "Not enough data yet."

Click any stage → opens Pipeline with historical closed roles for that stage.

**Card 3: Activity Trend**

Comparison of this week vs. last week:

```
Actions this week:     ↑ 12 (+33%)
  (roles added, applied, advanced, interviewed)

Last week:             9

New roles added:       4
Roles advanced:        5
Applications:          2
Interviews completed:  1
```

Click to expand → shows daily breakdown with timestamps.

**Card 4: Average Time-in-Stage**

> **Status: Implemented (v3.12.0)** — Shows median/average days spent in each stage as a sortable table. Calculated from stage transition timestamps in pipeline.

Shows how long roles typically spend at each stage:

```
Applied:           14 days (median)
Screen:            8 days
Interviewing:      10 days
Offer:             6 days
```

Useful for identifying bottlenecks. Click any stage → shows roles currently in that stage sorted by days-in-stage (oldest first).

---

### 3.4 Feed Review Section (Tertiary Zone)

> **Status: Planned** — Not yet implemented. Spec retained for future development.

When the Job Feed Listener surfaces new matches, they appear here grouped by match score (if Job Feed is enabled). Hidden if Feed is not yet integrated.

**Planned Structure:**

```
New from Job Feed (3 roles matched today)

🔥 Strong Match (80-100%)
   ┌──────────────────────────────┐
   │ Staff Product Manager         │
   │ Stripe (San Francisco)        │
   │ Match: 94%                    │
   │                              │
   │ [Accept] [Snooze] [Dismiss] │
   └──────────────────────────────┘

⭐ Moderate Match (60-79%)
   [2 roles collapsed]
   [Expand]

~ Lower Match (40-59%)
   [1 role collapsed]
   [Expand]
```

**Planned Actions:**

- **Accept** → Adds role to Pipeline in `discovered` stage, auto-tags Hot/Active/Watching based on match score
- **Snooze** → Hides for 7 days, then re-surfaces if still not accepted
- **Dismiss** → Removes permanently (archived)

---

### 3.5 Interview Intelligence Card (Appears After 5+ Debriefs)

> **Status: Implemented (v3.14.0)** — Pattern analysis card after 5+ debriefs showing question types, pass rates, and strongest areas.

Once the Post-Interview Debrief Agent has accumulated 5+ interview records, a summary card will appear showing patterns:

```
Interview Intelligence (based on 12 debriefs)

Story Types That Land:
  • Revenue impact & growth (5 interviews, avg 4.2/5 rating)
  • Technical depth stories (3 interviews, avg 3.4/5 rating)
  • Leadership narratives (4 interviews, avg 3.8/5 rating)

Question Types to Prep:
  • Product Scaling (4 questions, avg struggle 2.1/5)
  • Market Entry (3 questions, avg 4.0/5)
  • Execution (5 questions, avg 3.9/5)

Interview Stages You Excel:
  • Phone Screen: 100% pass rate (3/3)
  • Hiring Manager Round: 75% pass rate (3/4)
  • Case/Design: 50% pass rate (2/4) ← needs work

[View Full Analysis]
```

Clicking → opens Interview Intelligence dashboard (part of Dashboard, or linked to Mock Interview agent).

---

### 3.6 Quick Actions (Footer Zone)

One-click launchers to common workflows:

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   + Add      │  View        │  Practice    │  Research    │
│   Role       │  Pipeline    │  Interview   │  Brief       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Actions:**

- **+ Add Role** → Opens Pipeline with blank role creation form
- **View Pipeline** → Opens Pipeline main view
- **Practice Interview** → Opens Mock Interview agent for interview preparation
- **Research Brief** → Opens Research Brief agent with role selector dropdown

Additional quick action buttons also available:
- **Tailor Resume** → Opens Resume Tailor with role selector dropdown

---

### 3.7 v3.11 Features

**3.7.1 Smart Outreach Nudges**

Rules 3 and 9 now read comms log context to provide intelligent follow-up suggestions:

- **If outbound email has gone dark (no response 7+ days):** Shows subject line, days elapsed, and "Draft Follow-up" button
- **If inbound message pending:** Shows "Time to reply?" prompt to encourage timely responses
- **Mutual connections surfacing:** Displays top 2 connections at target company by seniority (drawn from `pf_connections` + `pf_linkedin_network`)
- **Last comms snippet:** Shows last 80 characters of communication on nudge card for quick context
- **View Connections link:** Direct link to Pipeline connections section

**3.7.2 Upcoming Calendar Events Card**

A new card displays "Upcoming Calendar Events (Next 7 Days)" reading from Google Calendar integration (`pf_calendar_events` in localStorage):

- Shows interview events scheduled in the next 7 days
- Each event displays date/time, company, interview type tag (Phone Screen, Hiring Manager, etc.)
- Quick action buttons: "Generate Brief" (opens Research Brief pre-loaded), "Practice" (opens Mock Interview)
- Empty state when no interviews scheduled

**3.7.3 Practice Interview Quick Action**

New button in primary quick actions: "Practice Interview" → Opens Mock Interview agent for interview preparation and role-specific practice.

**3.7.4 Sync Status Banner**

Shows real-time MCP sync status by reading `pf_sync_log` from localStorage. Indicates:
- Last sync timestamp
- Sync health indicator (green = current, amber = stale >24h, red = error)
- Quick link to resync if needed

---

## 4. Streak Tracking

### 4.1 Streak Definition

A "streak" is a count of consecutive days with ≥1 meaningful action. The streak resets after a day with no logged actions.

**What counts as a meaningful action:**

- Role added to Pipeline
- Role stage transitioned
- Application submitted
- Outreach message sent
- Interview completed (logged via calendar or manual entry)
- Take-home assignment submitted
- Offer response logged (accept/decline/negotiate)
- Research brief generated
- Resume generated
- Connection added or updated

**What does NOT count:**

- Viewing a role detail
- Reading a research brief
- Dismissing a nudge
- Scheduling an event (unless it's an interview you later mark as completed)

### 4.2 Weekend Logic

Weekends (Saturday/Sunday) do not break the streak. The streak uses a "rolling 7-day window" — if you take an action on Saturday, the next required action is due by the following Saturday. This removes the guilt of Friday-to-Monday gaps.

**Example:**

```
Mon: 1 action ✓ (streak = 1)
Tue: 0 actions   (streak = 1, no reset)
Wed: 1 action ✓ (streak = 2)
Thu: 0 actions   (streak = 2, no reset)
Fri: 1 action ✓ (streak = 3)
Sat: 0 actions   (streak = 3, weekend grace)
Sun: 0 actions   (streak = 3, weekend grace)
Mon: 0 actions   (streak = 2, reset back 1; action due)
Tue: 1 action ✓ (streak = 3, recovery)
```

### 4.3 Storage & Calculation

Streak data is stored in localStorage:

```typescript
interface StreakData {
  date: string;                // ISO date of last recorded action
  count: number;               // Current streak length
  lastActionDate: string;      // ISO timestamp of last action
  actionLog: {                 // Activity log for history view
    date: string;
    action: string;
    detail?: string;           // e.g., "Applied to Stripe Staff PM"
  }[];
}
```

On Dashboard load:
1. Check current date vs. `lastActionDate`
2. If today has an action logged, increment or maintain count
3. If no action since `lastActionDate` and days gap > 1, reset streak (but keep historical log)
4. Display updated count with animation

### 4.4 Streak UI

```
🔥 7-day streak

Most recent actions:
  Today (Mar 10)     • Added role: Staff PM at Acme
                     • Applied to Stripe
  Yesterday (Mar 9)  • Generated research brief: Google
  Mar 8              • Completed phone screen: Amazon
  Mar 7              (no actions — still in streak)
  Mar 6              • Generated resume for Twitter role
  Mar 5              (no actions — still in streak)

[View all 30 days]
```

Clicking the streak or "View all 30 days" opens a calendar view with action dots on active days.

---

## 5. Nudge Engine

The Nudge Engine is the brain behind the Action Queue. It scans the entire pipeline state (roles, companies, connections, calendar events) against a set of time-based rules and generates nudges that bubble to the top of the Dashboard.

### 5.1 Nudge Architecture

```
On Dashboard Load:
  1. Read pf_roles, pf_companies, pf_connections from localStorage
  2. Call gcal_list_events for today + next 7 days
  3. Run nudge rules against current state
  4. Filter out dismissed nudges (check pf_dismissed_nudges)
  5. Filter out recent nudges (check pf_nudge_timestamps)
  6. Rank by priority, then by urgency
  7. Render into Action Queue
```

### 5.2 Nudge Lifecycle

**Generation:**
- Rules run on Dashboard load (every time you open the page)
- Rules also re-run when you manually dismiss a nudge (to show next-priority item)

**Dismissal:**
- User clicks "Dismiss for 24h" or swipes left
- Nudge ID added to `pf_dismissed_nudges` with timestamp
- Nudge timestamp added to `pf_nudge_timestamps`
- Nudge won't resurface for 24 hours (even if rule still triggers)

**Persistence:**
- After 24h, nudge eligible to surface again if rule still triggers
- If user manually acts on the nudge (e.g., responds to offer), rule is auto-cleared
- Nudges clear from `pf_dismissed_nudges` after 24 hours (garbage collection on load)

### 5.3 Nudge Rule Details

**Rule 1: Stalled Roles**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Role in `applied` stage | > 10 days since stage transition | Important | "No response from {company} for {days} days — mark as ghosted?" | Open role detail, show stage transition UI |

**Implementation:**
```
for each role where stage === 'applied':
  daysSinceApplied = now - role.stageHistory.find(sh => sh.to === 'applied').timestamp
  if (daysSinceApplied > 10):
    yield nudge(priority: 'important', triggerid: 'stalled_${roleId}')
```

---

**Rule 2: Offer Deadline**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Role in `offer` stage with substage | `received` or `evaluating` and deadline < 48h away | Critical | "⚠️ Offer from {company} expires {date} — respond now" | Open role detail, focus offer substage |

**Implementation:**
```
for each role where stage === 'offer':
  if (role.offer.substage in ['received', 'evaluating']):
    hoursUntilDeadline = (role.offer.deadline - now) / 3600
    if (hoursUntilDeadline < 48 && hoursUntilDeadline > 0):
      yield nudge(priority: 'critical', triggerid: 'offer_deadline_${roleId}')
```

---

**Rule 3: Outreach Follow-up Trigger**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Role in `outreach` stage | 7+ days in outreach stage | Important | "Follow up on your {title} outreach to {company}" | Open Outreach Message Generator |

**Implementation:**
```
for each role where stage === 'outreach':
  daysSinceOutreach = (now - role.stageHistory.find(sh => sh.to === 'outreach').timestamp) / 86400
  if (daysSinceOutreach > 7):
    yield nudge(priority: 'important', triggerid: 'outreach_followup_${roleId}')
```

**v3.11 Enhancement:** Now reads comms log context and displays:
- If outbound email has gone dark (no response 7+ days): shows subject line, days since, "Draft Follow-up" button
- If inbound message pending: "Time to reply?" prompt
- Mutual connections surfaced from `pf_connections` + `pf_linkedin_network` (top 2 by seniority)
- Last comms snippet (80 chars) shown on nudge cards
- "View Connections" link to Pipeline

---

**Rule 4: Take-Home Due**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Role in `interviewing` substage `take_home` | Deadline < 48h away | Critical | "Take-home for {company} due {date} — submit by {time}" | Open role detail, Application tab |

**Implementation:**
```
for each role where stage === 'interviewing' && role.interviewing.substate === 'take_home':
  if (role.interviewing.takeHomeDeadline):
    hoursUntilDue = (role.interviewing.takeHomeDeadline - now) / 3600
    if (0 < hoursUntilDue <= 48):
      yield nudge(priority: 'critical', triggerid: 'takehome_${roleId}')
```

---

**Rule 5: Hot-Tier New Posting**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| New role from Job Feed with tier match to Hot/Active company | Immediately upon feed update | Suggested | "🔥 {company} posted {title} (match: {score}%)" | Open Pipeline to that role, or Feed Review card |

**Implementation:**
```
for each role in pf_roles where dateAdded === today:
  company = pf_companies.find(c => c.id === role.company)
  if (company.tier in ['Hot', 'Active']):
    yield nudge(priority: 'suggested', triggerid: 'hotjob_${roleId}')
```

---

**Rule 6: Interview < 48h, No Brief**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Interview scheduled in next 48 hours (from Google Calendar) | Immediately upon detection | Critical | "Interview at {company} in {time} — generate research brief?" | Open Research Brief agent pre-loaded |

**Implementation:**
```
gcal_events = gcal_list_events(timeMin: now, timeMax: now + 48h)
for each event in gcal_events:
  if (event matches pipeline role AND role has no research brief):
    yield nudge(priority: 'critical', triggerid: 'interview_prep_${roleId}')
```

---

**Rule 7: Company Profile Sparse**

> **Status: Implemented (v3.12.0)** — Nudge fires when tracked company has <50% of enrichment fields (funding, tech stack, mission, etc.) completed.

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Company has < 50% enriched fields complete | On role advancement or company add | Informational | "{company} profile incomplete — add funding, tech stack, etc.?" | Open Pipeline company profile |

**Planned Implementation:**
```
for each company in pf_companies:
  filledFields = count(company.[domain, funding, headcount, techStack, mission, linkedinUrl, glassdoorUrl])
  completionPercent = filledFields / 8
  if (completionPercent < 0.5 && company has active roles):
    yield nudge(priority: 'informational', triggerid: 'company_profile_${companyId}')
```

---

**Rule 8: Interview Prep Not Started**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Interview scheduled, but role has no debrief from previous round AND substage is not `awaiting_decision` | 72h or less before interview | Important | "Prep not started for {company} {round type} — review materials?" | Open Research Brief sections 9-10 |

**Implementation:**
```
gcal_events = gcal_list_events(timeMin: now + 24h, timeMax: now + 72h)
for each event in gcal_events matching a pipeline role:
  role = matched role
  if (role.interviewing.substate !== 'awaiting_decision' AND
      no recent debrief for this round):
    hoursUntilInterview = (event.start - now) / 3600
    if (hoursUntilInterview < 72 && hoursUntilInterview > 0):
      yield nudge(priority: 'important', triggerid: 'prep_${roleId}_${hoursUntilInterview}h')
```

---

**Rule 1a: Stale Discovered Roles**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Role in `discovered` stage | > 3 days since stage transition | Suggested | "Still researching {title} at {company}?" | Open role detail |

**Implementation:**
```
for each role where stage === 'discovered':
  daysSinceDiscovered = (now - role.stageHistory.find(sh => sh.to === 'discovered').timestamp) / 86400
  if (daysSinceDiscovered > 3):
    yield nudge(priority: 'suggested', triggerid: 'stale_discovered_${roleId}')
```

---

**Rule 2a: Researching Too Long**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Role in `researching` stage | > 5 days in researching stage | Important | "Ready to apply to {title} at {company}?" | Open role detail, suggest apply action |

**Implementation:**
```
for each role where stage === 'researching':
  daysSinceAdded = (now - role.dateAdded) / 86400
  if (daysSinceAdded > 5):
    yield nudge(priority: 'important', triggerid: 'researching_long_${roleId}')
```

---

**Rule 4a: Screen Prep Needed**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Role in `screen` stage | On detection | Important | "Prep for your {title} screen at {company}" | Open Research Brief |

**Implementation:**
```
for each role where stage === 'screen':
  yield nudge(priority: 'important', triggerid: 'screen_prep_${roleId}')
```

---

**Rule 7a: No New Roles This Week**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Zero roles added in the last 7 days | On Dashboard load | Suggested | "No new roles this week — refresh your feed?" | Open Job Feed |

**Implementation:**
```
weekAgo = now - (7 * 24 * 60 * 60 * 1000)
rolesThisWeek = pf_roles.filter(r => new Date(r.dateAdded) > weekAgo)
if (rolesThisWeek.length === 0):
  yield nudge(priority: 'suggested', triggerid: 'no_new_roles_week')
```

---

**Rule 8a: Empty Pipeline**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Zero active roles in pipeline | On Dashboard load | Critical | "No active roles in pipeline — check Job Feed or add manually" | Open Job Feed or Pipeline add |

**Implementation:**
```
activeRoles = pf_roles.filter(r => r.stage !== 'closed')
if (activeRoles.length === 0):
  yield nudge(priority: 'critical', triggerid: 'empty_pipeline')
```

---

**Rule 9a: Streak Broken**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| No activity logged in the last 2+ days | On Dashboard load | Suggested | "No activity in {days} days — get back on track?" | Suggest adding role or applying |

**Implementation:**
```
twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000)
lastActionDate = new Date(pf_streak.lastActionDate)
if (lastActionDate < twoDaysAgo):
  yield nudge(priority: 'suggested', triggerid: 'streak_broken')
```

---

**Rule 9: No Recent Activity at Hot Company**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Company in Hot tier with no active roles (all closed or none created) | On Dashboard load | Suggested | "{company} is Hot with no active roles — check for new postings?" | Open Pipeline filtered to company, or trigger feed search |

**Implementation:**
```
for each company where tier === 'Hot':
  activeRoles = pf_roles.filter(r => r.company === company.id && r.stage !== 'closed')
  if (activeRoles.length === 0):
    yield nudge(priority: 'suggested', triggerid: 'hot_company_${companyId}')
```

---

**Rule 10: Outreach Response Needed**

| Trigger | Timing | Priority | Text | Action |
|---------|--------|----------|------|--------|
| Outreach communication pending response | 7+ days awaiting response | Important | "Follow up on your {title} outreach to {company}" | Open connection detail |

**Implementation:**
```
for each role in outreach stage with active communication:
  if (role.commsLog exists and last entry is outbound):
    daysSinceComms = (now - last comms entry.date) / 86400
    if (daysSinceComms >= 7):
      yield nudge(priority: 'important', triggerid: 'response_${roleId}')
```

---

### 5.4 Nudge Deduplication

> **Status: Implemented (v3.12.0)** — Nudges grouped by roleId with highest-priority displayed first. Secondary nudges shown behind "+" expander badge for quick access without clutter.

If multiple rules would trigger for the same role/company (e.g., both "stalled role" and "company profile sparse"), only the highest-priority nudge surfaces. Secondary nudges will be visible if the user expands "All suggestions" or dismisses the primary one.

### 5.5 Nudge Dismissal & Re-Surfacing

```
User dismisses nudge
  ↓
nudge ID added to pf_dismissed_nudges with timestamp
nudge ID added to pf_nudge_timestamps
  ↓
On next Dashboard load, nudge rule still triggers
but nudge is filtered out (dismissed_nudges check)
  ↓
24 hours later (or 25 hours, to be safe)
nudge eligible to resurface
Rule re-triggers on next load
nudge added back to Action Queue
```

**Special case: Auto-clearing on action**

If the user manually acts on a nudge (e.g., responds to an offer, moves role to closed, generates a research brief), the nudge is auto-cleared from both maps so it won't resurface.

---

## 6. Module Navigation

The Dashboard serves as the launch pad for all other modules. Each quick action or action queue item links to a specialized agent pre-loaded with the relevant context.

### 6.1 Navigation Pattern

Each module is a standalone HTML file at `modules/{module_name}/index.html`. Navigation happens via hyperlinks or `window.location.href`. Navigation state (which role is selected, which company is in focus) is preserved via:

1. **URL parameters** — e.g., `/modules/research-brief/index.html?roleId=xyz123&companyId=abc456`
2. **localStorage** — e.g., `pf_last_selected_role`, `pf_last_selected_company`

This allows bookmarking and browser back/forward navigation.

### 6.2 Navigation Links

| Action Queue Item | Destination | URL Pattern |
|-------------------|-------------|------------|
| Stalled role | Pipeline (role detail) | `/modules/pipeline/index.html?roleId={id}&panel=open` |
| Offer deadline | Pipeline (role detail, Offer tab) | `/modules/pipeline/index.html?roleId={id}&panel=open&tab=offer` |
| Outreach due | Outreach Message Generator | `/modules/outreach/index.html?connectionId={id}&roleId={id}` |
| Take-home due | Pipeline (role detail, Application tab) | `/modules/pipeline/index.html?roleId={id}&panel=open&tab=application` |
| Interview prep needed | Research Brief | `/modules/research-brief/index.html?roleId={id}` |
| Hot company no roles | Pipeline (filtered by company) | `/modules/pipeline/index.html?companyId={id}` |

### 6.3 Quick Action Links

| Quick Action | Destination | State |
|--------------|-------------|-------|
| + Add Role | Pipeline | Blank role creation form focused |
| Brief Generate | Research Brief | Role selector dropdown shown |
| Resume Generate | Resume Tailor | Role selector dropdown shown |
| View Artifacts | Artifacts Browser | List all artifacts view |

---

## 7. UI Specification

### 7.1 Layout

**Overall structure:**

- **Header** — Greeting + Streak counter + Date + Settings icon
- **Main content** — Single column, max 720px, centered, with generous vertical whitespace
  - Action Queue section (with scroll if > 5 items)
  - Pipeline Summary section (2x2 or responsive grid)
  - Feed Review section (if Feed enabled)
  - Interview Intelligence section (if 10+ debriefs)
- **Footer** — Quick Actions (4 buttons in a row, responsive to 2x2 or vertical on mobile)

### 7.2 Color & Typography

**Color system:**

- Red (#ef4444) for Critical priority
- Amber (#f59e0b) for Important priority
- Blue (#3b82f6) for Suggested priority
- Gray (#6b7280) for Informational priority
- Green (#10b981) for completed/success states

**Typography:**

- Dashboard hero numbers (streak count, pipeline total) — 2xl (28px), bold
- Card titles — lg (18px), semibold
- Card body text — base (16px), regular
- Labels & metadata — sm (14px), medium

### 7.3 Spacing & Whitespace

- Card gaps: 1.5rem (24px)
- Vertical spacing between zones: 2rem (32px)
- Padding inside cards: 1.5rem (24px)
- Line height: 1.6 for body text

### 7.4 Responsiveness

- **Desktop (1024px+):** Single column, max 720px centered
- **Tablet (768px-1023px):** Single column, max 90% width
- **Mobile (< 768px):** Full width with 1rem padding, Quick Actions stack vertically

---

### 7.5 Animations

- **Streak counter:** Pulse animation on load if streak extended today (100ms ease-out)
- **Action queue items:** Fade in on load, stagger by 50ms per item
- **Nudge dismissal:** Slide out to the right (200ms ease-in-out) then remove from DOM
- **Card hover:** Subtle box-shadow lift (100ms transition)
- **Buttons:** Background color transition on hover/focus (100ms)

---

## 8. localStorage Keys

| Key | Type | Owner | Description |
|-----|------|-------|-------------|
| `pf_roles` | `Role[]` | Pipeline (read-only) | All tracked roles |
| `pf_companies` | `Company[]` | Pipeline (read-only) | All tracked companies |
| `pf_connections` | `Connection[]` | Pipeline (read-only) | All connections |
| `pf_artifacts` | `Artifact[]` | Artifacts MCP (read-only) | Index of all saved artifacts |
| `pf_streak` | `StreakData` | Dashboard (writes) | Streak count, activity log |
| `pf_dismissed_nudges` | `{[triggerId]: timestamp}` | Dashboard (writes) | Recently dismissed nudge IDs |
| `pf_nudge_timestamps` | `{[triggerId]: timestamp}` | Dashboard (writes) | Last time each nudge surfaced |

---

## 9. Implementation Phases

### Phase 1: Core Dashboard UI (v3.11) ✅ COMPLETE

What has been implemented:

- [x] Dashboard layout (greeting, streak, action queue, pipeline summary, quick actions)
- [x] Streak tracking & storage in localStorage
- [x] Action Queue card rendering with all nudge rules
- [x] Nudge engine (rules execution, prioritization, filtering)
- [x] Quick action buttons with navigation links
- [x] Pipeline Summary: roles by stage (bar chart)
- [x] Pipeline Summary: activity trend (this week vs. last week)
- [x] Empty state messaging (when no urgent actions)
- [x] Upcoming Calendar Events card (next 7 days)
- [x] Recent Discoveries card (Job Feed integration)
- [x] Upcoming Interviews card with Practice button
- [x] Smart Outreach Nudges with comms log context
- [x] Mutual connections surfacing (pf_connections + pf_linkedin_network)
- [x] Last comms snippet display (80 chars)
- [x] Sync Status Banner (pf_sync_log integration)
- [x] Feed Review section with detailed match analysis (v3.13.0)
- [ ] Interview Intelligence card (requires 10+ debriefs)

### Phase 2: Nudge Refinement & Analytics (Planned)

- [x] Nudge deduplication UI with "+" expander (v3.12.0)
- [ ] Nudge dismissal UI improvements (undo option, snooze N hours)
- [ ] Nudge rule tuning based on user feedback
- [ ] Suppression chains (cross-rule dismissal logic)
- [x] Nudge logging to `pf_nudge_log` for analytics (v3.12.0)
- [ ] Conversion funnel metrics (after 10+ closed roles)
- [ ] Average time-in-stage calculation & visualization
- [ ] Cooldown differentiation by priority (Critical 6h vs others 24h)
- [x] Per-rule disable sidebar (v3.12.0)

### Phase 3: Intelligence & Personalization (Planned)

- [ ] Interview Intelligence card (pattern analysis from debriefs)
- [ ] Predictive nudges (ML-based role recommendation)
- [ ] Daily digest email or Slack notification (summary of action queue)
- [ ] Custom nudge rules (user-configurable rules via settings)
- [ ] Dashboard widget for API integration (embed summary elsewhere)

### Phase 4: Mobile & Beyond (Planned)

- [ ] Mobile-optimized layout & touch interactions
- [ ] Progressive Web App (PWA) — offline support
- [ ] Push notifications for critical nudges
- [ ] Integration with Telegram/Slack bot for nudge alerts

---

## 10. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Dashboard load time | < 500ms | Performance monitoring |
| Streak consistency | 70%+ users maintain 3+ day streaks | User telemetry (action log) |
| Nudge accuracy | 80%+ of nudges require action user takes | Dismiss vs. action ratio |
| Action queue engagement | 2+ actions/day per user on average | Action log counts |
| Module navigation friction | < 100ms per click | Performance monitoring |
| Feed Review acceptance rate | 40%+ of feed matches accepted or snoozed (not dismissed) | Feed metadata tracking |

---

## 11. Relationship to Other Modules

```
        ┌──────────────────────────┐
        │  Dashboard & Launcher    │
        │  (modules/dashboard/)    │
        └───────────┬──────────────┘
                    │ (reads from all)
        ┌───────────┴──────────────┬──────────────┬─────────────┐
        ▼           ▼              ▼              ▼             ▼
    Pipeline      Calendar       Artifacts      Feed          Interview
    Tracker       Integration    MCP Server     Listener      Debrief
    (pf_roles,    (gcal events)  (artifacts)    (metadata)    (debriefs)
     companies,
     connections)
```

**Data Dependencies:**

| Module | What It Provides | How Dashboard Uses It |
|--------|-----------------|----------------------|
| **Pipeline Tracker** | pf_roles, pf_companies, pf_connections | Nudge engine scans roles/companies for triggers; displays stats |
| **Calendar Integration** | Google Calendar events (via gcal_list_events) | Detects upcoming interviews; triggers "prep needed" nudges |
| **Artifacts MCP Server** | pf_artifacts index, metadata | Feed Review displays recent artifacts; Interview Intelligence reads debrief metadata |
| **Job Feed Listener** | Feed metadata in pf_artifacts | Feed Review section shows new matches |
| **Post-Interview Debrief Agent** | Debrief artifacts & patterns | Interview Intelligence card appears after 10+ debriefs |

**Outbound Navigation:**

Dashboard links to all modules:
- Pipeline Tracker — for role details, company profiles, connections
- Research Brief — for generating preparation materials
- Resume Tailor — for generating role-specific resumes
- Outreach Message Generator — for drafting personalized messages
- Artifacts Browser — for viewing all generated content

---

## 12. Technical Notes

### 12.1 Real-Time Calendar Sync

The Dashboard calls `gcal_list_events` on load to check for interviews scheduled today and tomorrow. This enables real-time detection of "Interview < 48h, no brief" nudges even if the calendar event was added after the user last opened the Pipeline.

### 12.2 Nudge Deduplication

When multiple nudge rules trigger for the same role or company, only the highest-priority nudge surfaces in the Action Queue. The secondary nudges are available via "View all suggestions" or when the user dismisses the primary nudge.

### 12.3 Streak Rollover

The streak counter increments at midnight local time (using `new Date()` for client-side time). No explicit server sync needed; the counter compares `lastActionDate` to today's date on load.

### 12.4 Performance Optimization

- **Lazy-load Feed Review & Interview Intelligence** — only render if data exists
- **Nudge rule caching** — cache rule results for 5 minutes if navigating between modules and returning
- **Action Queue pagination** — show top 5-7 items, "View all" for additional
- **Chart rendering** — use SVG or simple HTML spans for Pipeline Summary stats (no heavy charting library required)

---

## 13. Design Philosophy

The Dashboard embodies five principles from the main Pathfinder spec:

1. **Reduce to the essential.** No metrics that don't prompt action. No decorative elements.
2. **Make the next action obvious.** Every card is clickable and links to an action. The Action Queue is the primary zone, not a sidebar.
3. **Keyboard-first, mouse-friendly.** Shortcut `G` then `D` goes to Dashboard. All buttons are keyboard-accessible.
4. **Show, don't load.** Nudges surface immediately on load. No spinners or loading states (data is local).
5. **Sweat the last 10%.** Streak animation, card hover states, dismissal transitions — attention to detail.

---

## 14. Nudge Engine Safeguards & Cooldowns

- **Max nudges per load:** Display at most 5 nudges per page load. Prioritize by severity: Critical (offer expiring, interview tomorrow) > Important (follow-up overdue, stale role) > Suggested (new role to research, prep nudge).
- **Cooldown periods:** Once dismissed, a nudge rule doesn't fire again for 24 hours for that specific role. Critical nudges (offer/interview) re-fire after 6 hours. Global cooldown: if user dismisses 3+ nudges in one session, pause nudge generation until next page load.

> **Status: Implemented (v3.14.0)** — Suppression chains implemented. Dismissing nudge auto-suppresses related nudges using 7d/3d/24h rules. Stored in `pf_nudge_suppressions` localStorage.

- **Suppression chains:** Dismissing "Prep for interview at {company}" will suppress "Generate research brief for {company}" for 48 hours. Dismissing "Follow up with {contact}" will suppress "Outreach needed for {role}" for 24 hours. Suppression data stored in `pf_nudge_suppressions` with rule ID chains and expiration timestamps.

> **Status: Planned** — Nudge logging not yet implemented.

- **Nudge logging:** Implemented (v3.12.0). Every nudge trigger logs to `pf_nudge_log`: `{ ruleId, roleId, firedAt, dismissed, dismissedAt, reason }`. Dashboard analytics track nudge effectiveness (fired vs acted on).

- **Per-rule disable:** Implemented (v3.12.0). Sidebar "Nudge Preferences" allows users to disable specific rule IDs. User preferences stored in `pf_nudge_prefs` localStorage.

---

## 15. Error Handling & Edge Cases

- **Deleted role referenced:** If a nudge references a role that no longer exists in `pf_roles`, filter it out silently. Don't fire, don't show error.
- **Malformed calendar event:** If a calendar event has no title or no linked roleId, skip it in the "Upcoming Interviews" section. Log warning to console for debugging.
- **Corrupted localStorage:** If `pf_roles` can't be parsed (invalid JSON), show graceful degradation: "Unable to load pipeline data. Try refreshing." Don't crash the entire dashboard.
- **Missing external data:** If Google Calendar API is unavailable, show "Calendar sync unavailable" in the GCal card instead of an error. If feed data hasn't loaded yet, show skeleton loading state.
- **Empty states:** If no nudges fire (new user, everything up to date), show encouraging message: "You're all caught up! No actions needed right now." Not a blank section.
- **Stale metrics:** If `pf_roles` hasn't been updated in >24 hours, show subtle indicator on Dashboard metrics: "Last synced {time ago}."

---

## Conclusion

The Dashboard is the hub of Pathfinder's daily workflow. By synthesizing state from all agents into a single, scannable view with prioritized nudges, it turns a fragmented job search into a focused, intentional process. The nudge engine is the engine that keeps critical actions from falling through cracks. The streak is the thread that turns isolated actions into a practice. Together, they answer the user's daily question: "What should I do today?" — and make doing it frictionless.
