# Pipeline Tracker Module — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/pipeline/`
**Version:** v3.11
**Last Updated:** 2026-03-13
**Status:** Active — core features and advanced views implemented

---

## 1. Purpose

The Pipeline Tracker is the DATA BACKBONE of Pathfinder. Every other module — Research Brief, Resume Builder, Job Feed, Outreach — reads from it, writes to it, or depends on it. The Pipeline is the central repository of your job search: companies you're targeting, specific roles you're pursuing, where they are in the hiring process, what you've learned, and what you've sent.

**Design Principles:**

1. **Single source of truth.** All job search data flows through the Pipeline. Resume uploads, interview notes, contact info, company enrichment — everything lives here. Other modules reference it, not duplicate it.
2. **Flexible but structured.** Companies and roles have a defined schema, but the schema is designed for evolution. Enrichment fields grow as you learn more. Stage transitions are sequenced but skippable. Backward transitions are allowed — not every hiring process is linear.
3. **Readable at a glance.** The kanban board is the default view. You should understand your entire pipeline — volume by stage, hottest companies, stalled roles — in one scroll.
4. **Rich with context.** Every role carries full context: JD text, source of discovery, salary range, interview history, contacts involved, research notes, resume versions sent. Switching between Pipeline and other modules should feel seamless.
5. **Audit trail, always.** Every state change is timestamped. You can see when a role moved from `applied` to `screen`, what the reason was for closing, and what decision criteria mattered. This builds searchable history.

---

## 2. Architecture

### High-Level Data Model

```
┌──────────────────────────────────┐
│      Pipeline Tracker Module      │
│      (modules/pipeline/)          │
└──────────────────────────────────┘
           │
      ┌────┴────┐
      ▼         ▼
  COMPANIES  ROLES
    │         │
    ├─ name   ├─ id
    ├─ url    ├─ company
    ├─ logo   ├─ title
    ├─ tier   ├─ url
    ├─ conn.  ├─ jdText
    └─ enrich ├─ stage (8 states)
              ├─ salary
              ├─ history
              ├─ comms log
              ├─ resume sent
              └─ fit assessment
```

### Storage Model

```
┌─────────────────────────────┐
│     localStorage keys       │
├─────────────────────────────┤
│ pf_companies: Company[]     │  ← All target companies
│ pf_roles: Role[]            │  ← All tracked roles
│ pf_connections: Conn[]      │  ← Company contacts
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   IndexedDB: pf_resumes     │  ← Resume file blobs
│   database                  │
├─────────────────────────────┤
│ Store: resume_uploads       │
│  {roleId, file, metadata}   │
└─────────────────────────────┘
```

### Data Flow: Other Modules → Pipeline

```
Job Feed Listener
  │ (auto-create roles)
  ▼
Pipeline ◄─── Research Brief (reads roles, companies)
  ▲             Resume Builder (reads roles, JD, positioning)
  │             Outreach (reads roles, contacts, history)
  │             Interview Prep (reads roles, notes)
  │
  └─── Resume uploaded
  └─── Stage transition
  └─── Contact added
  └─── Interview note logged
```

---

## 3. Data Model: Companies

### Company Object Schema

```typescript
interface Company {
  // Core
  id: string;                   // Unique identifier (slug: lowercase, hyphens)
  name: string;                 // Full company name
  url: string;                  // Website URL
  logoUrl?: string;             // Clearbit logo fetch result

  // Tracking
  tier: 'Hot' | 'Active' | 'Watching' | 'Dormant';
  dateAdded: string;            // ISO timestamp
  lastActivity?: string;        // Last date any role updated

  // Enrichment Fields (populated on entry or via auto-enrich)
  domain?: string;              // Primary business domain (e.g., "AdTech", "AI/ML")
  hqLocation?: string;          // Headquarters city
  funding?: string;             // e.g., "Series C", "IPO", "Private"
  headcount?: number;           // Employee count
  techStack?: string[];         // Technologies they use
  mission?: string;             // Company mission / what they do

  // Research & Signals
  glassdoorUrl?: string;        // Link to Glassdoor profile
  glassdoorRating?: number;     // Glassdoor rating (if available)
  newsUrls?: string[];          // Recent news articles (from auto-enrich)
  linkedinUrl?: string;         // LinkedIn company page

  // User Notes
  personalNotes?: string;       // Freeform notes

  // Monitoring
  enrichedAt?: string;          // Last time enrichment ran
}
```

### Company Tiers & Monitoring Cadence

| Tier | Meaning | Monitor Frequency | Use Case |
|------|---------|------------------|----------|
| **Hot** | Dream target, priority 1 | 3x/week (Mon/Wed/Fri) | Apply immediately to any role, proactive outreach OK |
| **Active** | Genuinely interested, pursuing | Weekly (Monday) | Apply to strong matches, track for openings |
| **Watching** | Long-term interest | Bi-weekly (1st & 3rd Monday) | Keep on radar, lighter engagement |
| **Dormant** | Interested but not now | Never (manual only) | Archive for future, no automated actions |

Career page monitoring happens at these frequencies (see Job Feed PRD for details).

### Auto-Enrichment on Company Entry

> **Status: Planned** — Not yet implemented. Spec retained for future development.

When a company is added (manually or by Job Feed), the system should run auto-enrichment:

1. **Logo fetch** (Clearbit API) — attempt to get company logo
2. **Basic profile** — scrape LinkedIn for funding, headcount, mission
3. **News scan** — Google News API for recent articles
4. **Glassdoor lookup** — fetch Glassdoor profile URL and rating

Enrichment would happen async; the UI would show a spinner while loading. Failed enrichments wouldn't block entry.

### Company Lookup & Web Search

> **Status: Implemented (v3.12.0)** — DuckDuckGo instant answer API integration for company web search suggestions.

When manually adding a company or entering a company name in Pipeline:
- User types company name
- System displays suggestions from cached company list
- For new companies, shows DuckDuckGo instant answer results
- User selects from suggestions or confirms manual entry
- Selected company auto-populates `name`, `url`, and `domain` from DuckDuckGo data

---

## 4. Data Model: Roles

### Role Object Schema

```typescript
interface Role {
  // Core Identity
  id: string;                   // Unique identifier (uuid)
  company: string;              // Reference to Company.id
  title: string;                // Job title (e.g., "Senior Product Manager")
  url?: string;                 // Link to job posting (if available)

  // Job Description & Content
  jdText?: string;              // Full job description text (pasted or fetched)

  // Position & Level
  positioning: 'ic' | 'management';  // Controls Resume Tailor & Research Brief behavior
  targetLevel?: string;         // Inferred or set by user (Senior, Principal, Director, VP, etc.)

  // Discovery & Source
  source: 'manual' | 'job_feed' | 'outreach' | 'referral';
  dateAdded: string;            // ISO timestamp when role was added

  // Lifecycle & Stage Management
  stage: 'discovered' | 'researching' | 'outreach' | 'applied' | 'screen' | 'interviewing' | 'offer' | 'closed';
  stageHistory: StageTransition[];  // Full history of stage changes

  // Stage-Specific Substates (optional, used within parent stage)
  interviewing?: {
    substate: 'prep' | 'in_loop' | 'take_home' | 'awaiting_decision';
    updatedAt: string;
  };
  offer?: {
    substate: 'received' | 'evaluating' | 'negotiating' | 'decision_pending';
    updatedAt: string;
  };

  // Compensation
  salary?: {
    min?: number;
    max?: number;
    currency: string;            // "USD", "EUR", etc.
    equity?: string;             // e.g., "0.5% 4-year vest"
    bonus?: string;              // e.g., "15-20%"
  };

  // Interview Tracking
  interviewTypes?: string[];    // e.g., ["phone_screen", "coding", "system_design", "bar_raiser", "team_panel"]
  interviewSchedule?: {
    type: string;
    date: string;                // ISO timestamp
    interviewer?: string;
    notes?: string;
  }[];

  // Closure Metadata (populated when stage is 'closed')
  closeReason?: 'rejected' | 'ghosted' | 'declined' | 'accepted' | 'on_hold' | 'role_frozen';
  closureNotes?: string;        // Why rejected, etc.
  closedAt?: string;            // ISO timestamp

  // Fit Assessment
  fitAssessment?: {
    strong: boolean;
    gaps: boolean;              // Has resume gaps
    borderline: boolean;        // Marginal fit
    notes?: string;             // Research Brief feedback
  };

  // Resume & Application
  resumeSent?: {
    filename: string;           // e.g., "John_Doe_Resume_Acme_Senior_PM.docx"
    uploadedAt: string;         // ISO timestamp
    version?: string;           // e.g., "v2" if multiple versions uploaded
    blobId?: string;            // Reference to file in IndexedDB (pf_resumes)
  }[];

  // Communication Log
  commsLog: CommLogEntry[];    // Timestamped interactions

  // Research & Notes
  personalNotes?: string;       // Freeform notes about this role
}

interface StageTransition {
  from: string;                 // Previous stage (or null if initial)
  to: string;                   // New stage
  timestamp: string;            // ISO timestamp
  reason?: string;              // **Status: Implemented (v3.12.0)** — Optional reason chips when changing stage, saved to stageHistory
}

interface CommLogEntry {
  timestamp: string;            // ISO timestamp
  type: 'email' | 'call' | 'message' | 'form_submit' | 'interview_conducted' | 'offer_received';
  channel?: string;             // "email", "LinkedIn", "phone", "Zoom", etc.
  contact?: string;             // Reference to connection ID or free-form name
  subject?: string;             // e.g., "Application submitted", "Phone screen scheduled"
  link?: string;                // URL to email thread, message, etc.
  notes?: string;               // Details of the interaction
  outcome?: string;             // e.g., "scheduled interview", "rejected", "waiting for response"
}
```

### 8 Lifecycle Stages

**Stage Definitions & Transitions:**

```
DISCOVERED → RESEARCHING → OUTREACH → APPLIED → SCREEN → INTERVIEWING → OFFER → CLOSED

Backward transitions allowed at any point (e.g., revert from SCREEN to APPLIED if role re-opened)
```

| Stage | Meaning | Entry Criteria | Exit Actions |
|-------|---------|---|---|
| **discovered** | Found via Job Feed, recruiter, or referral | Auto-created by Job Feed or manual entry | You decide to pursue (→researching) or dismiss |
| **researching** | You're researching the company/role | Intentional move from discovered | Ready to apply (→outreach or →applied) |
| **outreach** | You've contacted someone at company | Referral/networking follow-up sent | Application submitted (→applied) or no response (→closed) |
| **applied** | Application submitted (form, email, or referral) | Resume/cover submitted | Recruiter responds with screening (→screen) or rejection (→closed) |
| **screen** | Phone/video screen scheduled or in progress | Recruiter or hiring manager confirmed | Pass to interview loop (→interviewing) or rejected (→closed) |
| **interviewing** | In interview loop (with substates) | First interview scheduled | Offer received (→offer), rejected (→closed), or on hold (→closed) |
| **offer** | Offer received (with substates) | Offer negotiation starts | Decision made (→closed) |
| **closed** | Role concluded | One of: rejected, accepted, declined, on hold, ghosted, role frozen | End state; may move backward if role re-opens |

**Substate Details:**

> **Status: Planned** — Not yet implemented. Spec retained for future development.

Interview and offer substages allow fine-grained tracking within those stages:

Within `interviewing`:
- `prep` — You're preparing, interview not yet scheduled
- `in_loop` — Currently in the interview process (scheduling or completed rounds)
- `take_home` — Take-home assignment assigned or in progress
- `awaiting_decision` — Interviews complete, waiting for decision

Within `offer`:
- `received` — Offer just received, awaiting your review
- `evaluating` — You're reviewing terms
- `negotiating` — Back-and-forth on terms
- `decision_pending` — Waiting on company response to your counter, or ready to decide

Interview and offer substages would complement the 8-stage pipeline. All substates are optional. Use them if helpful; omit if not needed.

### Stage Transition Rules

1. **Sequencing:** Forward progression is normal (discovered → researching → ... → closed), but not required.
2. **Skipping allowed:** You can jump directly from `discovered` to `applied` if you already know the role.
3. **Backward transitions allowed:** If a role is rejected but then the company re-opens it, move it back to `applied` and continue.
4. **Every transition is timestamped:** `stageHistory` captures all moves with reasons.
5. **Closure is final:** Once closed, the role stays closed unless explicitly moved back. Helpful for historical tracking.

### Positioning Field

The `positioning` field (IC vs. management) is a schema property that controls behavior downstream:

| Module | How It Uses `positioning` |
|--------|---|
| **Resume Builder** | Frames summary (principal engineer vs. director), bullet selection (depth vs. breadth), skills bar order |
| **Research Brief** | Adjusts interview prep recommendations, compensation context, leadership expectations |
| **Outreach Module** | Frames the pitch — IC emphasizes expertise, management emphasizes team scope |

Set `positioning` on role entry or update it as you learn more about the role's true focus.

---

## 5. Data Model: Connections

### Connection Object Schema

```typescript
interface Connection {
  id: string;                   // Unique identifier
  company: string;              // Reference to Company.id
  name: string;                 // Contact full name
  title?: string;               // Their title at company
  email?: string;               // Email address
  linkedinUrl?: string;         // LinkedIn profile
  relationshipType?: 'employee' | 'recruiter' | 'referral' | 'met_at_event' | 'mutual';

  // Outreach Tracking
  outreachLog?: {
    date: string;               // ISO timestamp
    method: 'email' | 'linkedin' | 'call' | 'in_person';
    subject?: string;           // Email subject or message summary
    outcome?: string;           // "scheduled", "no response", "positive", "declined"
  }[];

  // Relationship Strength
  referralStatus?: 'referred_us' | 'willing_to_refer' | 'neutral' | 'unresponsive';
  linkedinPriorityScore?: number;  // 0-10; used for LinkedIn outreach prioritization

  // Notes
  notes?: string;               // Personal context about this connection
}
```

### Connection Usage

Connections serve as:
1. **Reference for outreach** — who to contact at a company
2. **Interview loop tracking** — which contacts are interviewing you
3. **Referral source** — logging who referred you to a role
4. **LinkedIn targeting** — scoring contacts for outreach prioritization
5. **Comms log linking** — CommsLogEntry.contact references connections

---

## 6. Resume Uploads & Storage

### Upload Mechanism

Roles support attaching multiple resume versions via drag-and-drop:

1. User opens a role detail panel
2. "Resume Sent" section shows upload area (or list of previously uploaded resumes)
3. User drags/drops `.docx` or `.pdf` file
4. System stores file blob in IndexedDB (`pf_resumes` database)
5. Metadata saved to role's `resumeSent[]` array
6. Filename and upload timestamp displayed in Pipeline

### Storage Details

**IndexedDB Structure:**
```
Database: pf_resumes
Store: resume_uploads
  Key: {roleId}_{version}_{timestamp}
  Value: {
    roleId: string,
    filename: string,
    blob: File object,
    uploadedAt: string,
    version: string (e.g., "v1", "v2"),
    contentType: string (e.g., "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  }
```

**Why IndexedDB?**
- Local file storage without server
- Can hold large blobs (multiple versions per role, many roles)
- Persists across page refreshes
- Better than localStorage for binary data

**Cleanup:**
- Old resume versions can be manually deleted from the UI
- If role is deleted, associated resumes are auto-cleaned

---

## 7. Comms Log

Every role has a `commsLog` array tracking all interactions:

### Example Timeline

```
[
  {
    timestamp: "2026-03-10T14:30:00Z",
    type: "form_submit",
    channel: "company_careers",
    subject: "Application submitted",
    outcome: "waiting_for_response"
  },
  {
    timestamp: "2026-03-12T09:15:00Z",
    type: "email",
    channel: "email",
    contact: "conn_id_456",  // Reference to recruiter connection
    subject: "Phone screen scheduled",
    link: "https://calendar.google.com/...",
    outcome: "scheduled_interview"
  },
  {
    timestamp: "2026-03-14T10:00:00Z",
    type: "interview_conducted",
    channel: "Zoom",
    contact: "conn_id_456",
    subject: "Initial phone screen with recruiter",
    notes: "Discussed background, 30 min, went well",
    outcome: "moved_to_next_round"
  },
  {
    timestamp: "2026-03-17T16:45:00Z",
    type: "email",
    contact: "conn_id_456",
    subject: "Rejected",
    outcome: "not_moving_forward"
  }
]
```

### Comms Log UI

In the role detail panel, the Comms Log appears as a scrollable timeline:
- Each entry shows timestamp, channel icon, contact name (if applicable), subject, and notes
- Entries are sorted chronologically (newest at top)
- Add button to manually log interactions not auto-captured
- Click any entry to expand for full notes

---

## 8. Opaque Recruiter Outreach

> **Status: Planned** — Not yet implemented. Spec retained for future development.

Some recruiter emails mention opportunities without revealing the company or role details upfront. The Pipeline supports "opaque" entries that can later be revealed:

### Entry Pattern

When a recruiter says "I have a great opportunity for you," you can create a role with:

```typescript
{
  company: "Unknown Company",  // Literal string
  title: "Confidential Opportunity",
  source: 'outreach',
  stage: 'discovered',
  personalNotes: "Recruiter: Jane Smith, jane@recruiter.com — waiting for details"
}
```

### Reveal Flow

Once the recruiter shares details:
1. Update `company` to the actual company name
2. Update `title` to the actual role title
3. Paste JD text into `jdText`
4. System auto-creates/links company profile if new
5. Entry immediately becomes visible to other modules (Research Brief, Resume Builder)

---

## 9. URL Import for Adding Roles

Users can add roles by pasting a link to a job posting:

### URL Import Flow

1. User clicks "Import from URL" in the Pipeline add form
2. System attempts to fetch and parse the posting
3. Supports common sources: LinkedIn, Indeed, Dice, company career pages (Lever, Greenhouse, Ashby)
4. Extracts: company, title, jdText, salary (if visible)
5. Falls back to manual entry if fetch fails

**Implementation Detail (CORS Proxy Chain):**
- Direct browser fetch often blocked (CORS headers)
- Solution: chain through Pathfinder's CORS proxy (`/api/fetch-url`)
- Proxy validates URL domain, fetches server-side, returns HTML to browser
- Browser parses HTML to extract role details

Posting sites that work best:
- LinkedIn (high reliability)
- Indeed (high reliability)
- Company career pages with open APIs (Lever, Greenhouse)
- Dice, Tech.co, others with CORS headers

---

## 10. UI Specification

### 10.1 Layout

The Pipeline UI follows Pathfinder's standard layout:

**Sidebar (left, 280px):**
- Add Company / Add Role buttons
- Company filter (checkboxes for tiers, search)
- Role status summary (count by stage)
- Quick filters (unreviewed, needs action, etc.)

**Main workspace (right, fills remaining):**
- Kanban board (default view) or list view
- Grouped by stage columns
- Drag-and-drop between stages
- Role cards showing company, title, stage, date added, tier badge

### 10.2 Kanban Board

**Column Layout:**

Eight columns, one per stage: DISCOVERED | RESEARCHING | OUTREACH | APPLIED | SCREEN | INTERVIEWING | OFFER | CLOSED

**Role Cards (within columns):**

Each card shows:
- Company logo (left)
- Role title
- Company name (subtext)
- Tier badge (Hot/Active/Watching/Dormant)
- Days in stage (right-aligned, small text)
- Salary if available (subtext, small)
- Hover shows: JD preview, last update, resume sent status

**Drag-and-Drop:**
- Drag card to adjacent column to move to new stage
- On drop, system prompts: "Move [title] from [stage] to [new stage]? Add reason?" (optional)
- Transition recorded in stageHistory

**Card Interactions:**
- Click card to open side panel (role detail view)
- Right-click for context menu (edit, delete, archive, duplicate)
- Hover to show preview tooltip

### 10.3 Role Detail Panel (Slide-Out)

Opens from right side of screen when role card clicked. Contains multiple tabs:

**Tab 1: Overview**
- Company info (logo, name, tier, url)
- Role title, level, positioning toggle
- Source badge (Feed/Manual/Outreach/Referral)
- Date added, date stage updated
- Tier selector (Hot/Active/Watching/Dormant) — drag-drop to change
- Stage transition button + reason text input
- "Research Brief" button (link to module for this role)
- "Generate Resume" button (link to Resume Builder for this role)

**Tab 2: Job Details**
- Title, level, positioning
- URL (if available, clickable)
- JD text (scrollable, with edit button)
- Salary range (if known)
- Interview types expected (tags)

**Tab 3: Company Profile**
- Company enrichment fields (mission, domain, funding, headcount, tech stack)
- Glassdoor link and rating
- Recent news (if available)
- Personal notes (edit)
- Tier selector

**Tab 4: Contacts & Outreach**
- Connections list (recruiter, referrer, etc. with outreach history)
- "Add Contact" button
- For each contact: name, title, email, relationship type, last contact date

**Tab 5: Communications**
- Comms log timeline (newest first)
- Each entry shows: date, type, channel, contact, subject, notes
- "Log Interaction" button to manually add entries
- Interview scheduling links (if present in log)

**Tab 6: Application**
- Resume Sent section (upload DOCX/PDF, list of uploaded versions)
- Drag-drop upload area
- Each resume shows: filename, upload date, version, delete button
- "Apply Now" button (if applicable)

**Tab 7: Fit & Notes**
- Fit assessment (strong/borderline/gaps) — from Research Brief if available
- Personal notes (edit)
- Close reason + notes (if stage is 'closed')

**Bottom Action Bar:**
- Back button
- Delete button (with confirm)
- Duplicate button (creates copy in discovered stage)
- Archive button (moves to closed with 'on_hold' reason)

### 10.4 List View (Alternative)

Table with columns: Company | Title | Level | Stage | Salary | Days in Stage | Last Update

Sortable by any column. Click row to open detail panel. Bulk actions: move to stage, change tier, export.

### 10.5 Filtering & Search

**Sidebar Filters:**
- **By Tier** — Hot, Active, Watching, Dormant (checkboxes)
- **By Stage** — Show/hide individual stages (checkboxes)
- **By Source** — Feed, Manual, Outreach, Referral (checkboxes)
- **By Status** — Unreviewed, Needs Action, On Hold, Closed (quick toggles)
- **Search** — Company name or role title (text input, live filter)

**Status Indicators:**
- "Unreviewed" — stage = discovered, no interactions logged
- "Needs Action" — interview scheduled, offer pending, or 30+ days with no update
- "On Hold" — stage = closed with reason = on_hold

### 10.6 Company View

Separate "Companies" tab shows all companies in a card layout:

- Company logo, name, tier, headcount, domain
- Role count (e.g., "3 active roles")
- Recent activity date
- Glassdoor rating
- Click card to view company profile + all roles at company
- Drag card to change tier

### 10.7 Default Score Sort (v3.11)

Table view defaults to sorting by score column in descending order (`sortColumn = 'score'`, `sortAsc = false`). A new **Score** column displays fit assessment values with color-coded backgrounds:

- **Green** (≥70): Strong fit
- **Yellow** (40-69): Marginal fit
- **Muted** (<40): Weak fit or no assessment

Within kanban card views, roles in each stage column are automatically sorted by score descending, surfacing the strongest opportunities at the top of each stage.

### 10.8 Company Visibility (v3.11)

Company names in both kanban cards and table view are now **clickable links** that navigate to the Research Brief module, scoped to that company. On hover, a tooltip displays the company's mission statement (if available). Kanban cards also show a brief company description line below the role title, giving context at a glance.

### 10.9 Compensation Display (v3.11)

Compensation is now displayed in a structured format instead of a simple range:

- **Posted Base:** $XK–$YK (from job description)
- **Est. Total Comp:** ~$XK–$YK (including estimated equity and bonus)

An info icon tooltip explains the difference between base salary and total compensation, helping users evaluate offers accurately.

### 10.10 LinkedIn Network in Detail Panel

A new **LinkedIn Network** section in the detail panel displays company connections sorted by seniority level (VP/Director/Senior first) and department relevance. Each connection shows:

- Name, title, and relationship type
- Purple **Product** badge and blue **Eng** badge for relevant department categorization
- A **+ Track** button that promotes the contact to the `pf_connections` tracking list

This allows quick identification of high-value referral targets without leaving the Pipeline.

### 10.11 Command Palette (⌘K)

A quick action palette accessible via the keyboard shortcut **⌘K** (Cmd+K on Mac, Ctrl+K on Windows/Linux) provides:

- Search for roles by title, company, or stage
- Quick actions: "Add Role", "Add Company", "Export", "View Companies"
- Fuzzy search across role and company names
- Navigate to any open role or company detail in one keystroke

### 10.12 CSV Export

An **Export** button in the toolbar allows users to download their entire pipeline as a CSV file, including:

- All role details (title, company, stage, salary, dates)
- All company data (name, tier, domain, headcount)
- Timestamp of export for audit trails

Exported CSV includes both kanban and list view formats depending on current view selection.

### 10.13 Column Collapsing

Kanban columns can be **collapsed** to minimize visual clutter:

- Click the column header to toggle collapse state
- Collapsed columns show only a count badge (e.g., "3 roles")
- Column state is persisted in localStorage for the user's session
- Useful for hiding completed stages or de-prioritized work

### 10.14 Expandable Connection Cards

Connection cards in the **Contacts & Outreach** tab are now **expandable**:

- Click to reveal per-contact communication history (filtered from the comms log)
- Quick-log input field allows adding interactions without navigating away
- Shows timestamps, channel, and notes for each contact-specific interaction
- Contacts can be sorted by last interaction date or by seniority

### 10.15 Sibling Role Cards

The detail panel now displays a **Sibling Roles** section showing other open roles at the same company:

- Each sibling shows: title, stage badge, days in stage
- Click a sibling card to instantly jump to that role's detail panel
- Useful for evaluating multiple positions at the same target company

### 10.16 Stale Role Detection (v3.11)

Kanban cards display a **14-day stale badge** when a role has had no updates (comms log entry, stage change, or resume sent) in the last 14 days:

- Badge appears in the top-right corner of the card
- Subtle visual styling to avoid clutter
- Helps identify roles that need follow-up or may be stuck

### 10.17 Company View (Alternative View)

A **Companies** tab in the main workspace shows an alternative view grouping by company instead of role:

- Card layout with company logo, name, tier, domain
- Role count per company (e.g., "3 roles: 1 screen, 2 applied")
- Click to expand and see all roles at that company inline
- Drag to change tier
- Useful for companies with multiple opportunities or when prioritizing by company strategy

### 10.18 Fit Assessment

A **Fit Assessment** badge appears on role cards and in the detail panel, reflecting the candidate-to-role alignment:

- Sourced from Research Brief analysis or manual evaluation
- Displays as: "Strong Fit", "Marginal Fit", or "Weak Fit"
- Color-coded: green (strong), yellow (marginal), red/muted (weak)
- Tooltip shows assessment reasoning (gaps, experience alignment, etc.)

---

## 11. localStorage Keys

| Key | Type | Owner | Description |
|-----|------|-------|-------------|
| `pf_companies` | `Company[]` | Pipeline | All tracked companies |
| `pf_roles` | `Role[]` | Pipeline | All tracked roles |
| `pf_connections` | `Connection[]` | Pipeline | All company contacts |

All three keys are read-accessible by other modules (Research Brief, Resume Builder, Outreach, etc.). Only Pipeline module writes to them (though Feed Listener can write new roles in coordination).

---

## 12. Implementation Phases

### Phase 1: Core Pipeline UI (Current — v3.11)
What exists today:
- [x] localStorage schema for companies, roles, connections
- [x] Kanban board UI with 8 columns
- [x] Drag-and-drop stage transitions
- [x] Role cards with basic info display
- [x] Company & role CRUD (add, edit, delete)
- [x] Role detail panel (slide-out) with tabs
- [x] Filtering by tier, stage, source
- [x] Search by company/title
- [x] Resume upload to IndexedDB (pf_resumes database)
- [x] Comms log UI in detail panel
- [x] Default score sort with color-coded Score column (v3.11)
- [x] Clickable company names linking to Research Brief (v3.11)
- [x] Compensation display with Posted Base and Est. Total Comp (v3.11)
- [x] LinkedIn Network section in detail panel (v3.11)
- [x] Command Palette (⌘K) for quick search/actions (v3.11)
- [x] CSV Export functionality (v3.11)
- [x] Collapsible kanban columns (v3.11)
- [x] Expandable connection cards with per-contact comms history (v3.11)
- [x] Sibling role cards showing other roles at same company (v3.11)
- [x] 14-day stale role detection badge (v3.11)
- [x] Company View (alternative grouping by company) (v3.11)
- [x] Fit Assessment badge on cards and detail panel (v3.11)

### Phase 2: Enrichment & Automation (v1.1)
- [ ] Auto-enrichment on company entry (Clearbit logo, LinkedIn profile, Glassdoor lookup) — **Planned**
- [ ] Company lookup web search on manual add — **Planned**
- [x] URL import for adding roles (CORS proxy) (v3.11)
- [ ] Tier management suggestions from Job Feed
- [ ] Stage-based notifications ("interview in 2 days")
- [ ] Bulk actions (move multiple roles, change tier for multiple companies)

### Phase 3: Feedback Loops & Intelligence (v1.2+)
- [x] Research Brief data writeback to role fitAssessment (v3.11)
- [x] Fit assessment visible in Pipeline (v3.11)
- [x] Interview prep notes linkage (v3.11)
- [ ] Tier demotion suggestions (no activity, all roles closed, news alerts)
- [ ] Historical analytics (funnel conversion rate by source, stage, tier)

### Phase 4: Advanced Integrations (Future)
- [ ] Calendar sync for interview scheduling (Google Calendar integration)
- [ ] Email tracking (when resume read, interview invite accepted)
- [ ] LinkedIn message tracking (outreach follow-up reminders)
- [ ] Salary data aggregation from multiple roles
- [x] Export to CSV (v3.11)

---

## 13. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Pipeline accuracy | 100% — all roles current | Manual audit, stale data reports |
| Search speed (Command Palette) | < 200ms | Performance monitoring |
| Drag-drop responsiveness | < 200ms | UX metrics |
| Data consistency | 0 orphaned roles | Weekly integrity checks |
| Stale role detection accuracy | 100% — all 14+ day roles flagged | Automated audit |
| Score visibility | 100% of roles with fit assessment show color | UI audit |
| User engagement | 3+ interactions per role | Analytics |
| Export completeness | 100% of roles, companies, connections exportable | CSV validation |

---

## 14. Relationship to Other Modules

```
        ┌──────────────────────┐
        │  Pipeline Tracker    │
        │  (modules/pipeline/) │
        └──────────┬───────────┘
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
      Job Feed  Research  Resume Builder
      (writes   Brief     (reads roles,
       roles)   (reads)   JD, positioning)
                  │
                  ▼
             Outreach Module
             (reads roles, contacts,
              comms log, resumes)
                  │
                  ▼
             Interview Prep
             (reads roles, notes,
              stage, interview types)
```

The Pipeline Tracker is the hub. Every other module consumes its data. The Job Feed writes new roles to it. Everything else reads and annotates.

**Key Data Dependencies:**

| Module | What It Reads | What It Writes |
|--------|---|---|
| **Job Feed Listener** | pf_companies, pf_roles | New roles, new companies, feed metadata |
| **Research Brief** | pf_roles, pf_companies, pf_connections | fitAssessment notes |
| **Resume Builder** | pf_roles (JD, positioning, company) | Resume sent metadata, fit assessment |
| **Outreach Module** | pf_roles, pf_companies, pf_connections | Comms log entries, contact outreach history |
| **Interview Prep** | pf_roles, pf_connections | Interview notes, schedule |

---

## 15. Technical Debt & Future Considerations

1. **Data Migration** — When schema evolves (new fields on Role, Company), existing roles auto-populate defaults. No data loss.
2. **Backup/Export** — Users can export all pipeline data (JSON or CSV) for safekeeping.
3. **Sync Across Devices** — Future: sync localStorage to cloud backend (Supabase, Firebase) so Pipeline accessible on mobile or second device.
4. **API Webhooks** — Future: allow external services to POST new roles/updates to Pipeline (e.g., IFTTT, Zapier integration).
5. **Audit Logging** — Track every mutation (add, edit, delete) with user timestamp for compliance.

---

## 16. Confidence & Provenance Handling

Define which fields are authoritative vs. inferred, when data goes stale, and what provenance to log.

| Field | Source | Confidence | Staleness Threshold | Provenance Logged |
|-------|--------|-----------|--------------------|--------------------|
| `role.title` | User input or feed import | High | Never stale | `{ enteredBy: "user" or "feed", enteredAt }` |
| `role.stage` | User manual transition | High | Never stale | `{ changedBy: "user", changedAt, fromStage, reason }` |
| `role.salary` | JD extraction (regex) | Medium | ≥30 days | `{ source: "jd-extraction", extractedAt, extractedFrom: URL, method }` |
| `role.salaryOverride` | User manual entry | High | Never stale | `{ enteredBy: "user", enteredAt }` |
| `company.fundingStage` | Enrichment (Clay, web) | Medium | ≥90 days | `{ source, enrichedAt, dataPoint }` |
| `company.missionStatement` | Enrichment | Medium | ≥90 days | `{ source, enrichedAt }` |
| `company.headcount` | Enrichment | Medium | ≥90 days | `{ source, enrichedAt }` |
| `role.jdText` | Feed import or enrichment | Medium | ≥60 days (job may be filled) | `{ source: "linkedin" or "ats-api" or "web-search", fetchedAt, confidence }` |
| `role.connections[]` | User manual linking | High | Never stale | `{ linkedBy: "user", linkedAt }` |
| `company.logoUrl` | Google Favicon API | High (structural) | Never stale | Auto-generated, no logging needed |

**Staleness indicators:**
- When displaying data past its staleness threshold: show subtle clock icon + tooltip "Last updated {N} days ago"
- When data is >2x staleness threshold: show warning badge "Data may be outdated"
- Future: "Refresh" button per field calls relevant enrichment source

---

## 17. Risk / Failure Modes / Guardrails

- **Data corruption recovery:** If `pf_roles` or `pf_companies` is corrupted (unparseable JSON), attempt auto-recovery from MCP bridge (`GET /data/pf_roles`). If MCP unavailable, show "Data recovery needed" modal with option to restore from backup (`~/.pathfinder/backups/`).
- **Bulk operation rollback:** Bulk stage transitions, bulk tier changes, and CSV imports create a snapshot in `pf_pipeline_undo` before executing. "Undo" button available for 30 seconds after bulk action.
- **Concurrent editing:** If user has Pipeline open in two tabs and edits the same role, last-write-wins (localStorage is single-threaded). Future: `storage` event listener detects external changes and prompts merge.
- **localStorage quota exceeded:** If `setItem` throws `QuotaExceededError`, show warning: "Storage full. Export data and clear old roles to free space." Suggest archiving closed/rejected roles.
- **Drag-drop failures:** If drag-drop stage transition fails (DOM event lost), show toast "Stage change didn't save. Try again." Log error for debugging.

---

## Conclusion

The Pipeline Tracker is the information backbone of the job search system. By centralizing companies, roles, contacts, and interaction history, every downstream module can operate on current, reliable data. The kanban board is the cognitive model — you see your entire pipeline at a glance, understand where things are stuck, and move roles forward with intention.
