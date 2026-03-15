# Sync Hub — Product Requirements Document

**Module:** Sync Hub
**Path:** `modules/sync/index.html`
**Version:** v3.29.0
**Last Updated:** 2026-03-15
**Status:** Active — core sync framework implemented

---

## 1. Purpose

Sync Hub is the data bridge connecting external sources (Google Calendar, Indeed, Gmail, Clay) into Pathfinder's internal modules. It transforms external data formats into Pathfinder's canonical localStorage shapes and writes them to the appropriate module keys. Sync Hub also displays sync status, freshness indicators, and statistics, and provides manual/scheduled sync controls.

**Core responsibilities:**
- Deduplicate incoming data by composite keys (company + title, gcal_id, etc.)
- Classify events and emails (interview vs. networking vs. personal, offer vs. rejection, etc.)
- Map external schemas to Pathfinder data contracts
- Track sync history in `pf_sync_log` with timestamps, counts, and freshness indicators
- Display sync UI with status cards, statistics dashboard, and outreach draft queue
- Support manual per-source sync buttons and scheduled auto-sync toggle

---

## 2. User Stories

1. **As a user, I want to sync my Google Calendar** so that upcoming interviews and networking events appear in the Calendar module and are tracked for preparation.
   - Manual sync button on Sync Hub → transforms GCAL_EVENTS → writes to pf_calendar_events
   - Deduplicates by gcal_id to avoid duplicates on re-sync
   - Classifies events into interview / networking / prep / personal; skips prep and personal
   - Maps event types (phone_screen, technical, behavioral, panel, hiring_manager, etc.)

2. **As a user, I want to sync job listings from Indeed** so that new opportunities appear in my Feed for scoring and evaluation.
   - Manual sync button on Sync Hub → transforms INDEED_JOBS → writes to pf_feed_queue
   - Deduplicates by company + title to prevent duplicates
   - Parses salary ranges and calculates score against user preferences
   - Shows posted dates in human-readable format ("Today", "3 days ago")

3. **As a user, I want Gmail alerts (recruiter messages, job leads, applications) to populate my Feed and Pipeline** so I don't miss leads or opportunities.
   - Gmail sync processes two types: job leads (→ pf_feed_queue) and application confirmations (→ pf_roles)
   - Detects email type (recruiter_inmail, interview_scheduling, rejection, offer, standard)
   - Application confirmations create a new role in "applied" stage
   - Auto-creates companies if they don't exist yet
   - Deduplicates by company + title

4. **As a user, I want Clay enrichment data to enhance my company profiles** so I have up-to-date headcount, funding, and mission statements.
   - Clay sync matches companies by name or domain
   - Merges enrichment fields (headcount, fundingStage, missionStatement)
   - Updates enrichmentStatus to "complete" on successful merge

5. **As a user, I want to see how fresh my synced data is** so I know when to re-sync.
   - Freshness badges (fresh < 1h, stale 1-24h, expired > 24h) on each source card
   - Timestamp shown for last sync per source

6. **As a user, I want to see statistics of what was synced** so I can understand the scale of each sync.
   - Stats row shows count of items per source (calendar events, feed items, roles, companies)
   - Last sync timestamp with freshness color coding
   - "Last Full Sync" displays time since the most recent full sync

7. **As a user, I want to push outreach drafts to Gmail** so I can send messages directly from Sync Hub.
   - Reads pf_outreach_gmail_queue (drafts created by Outreach module)
   - Displays draft list with recipient, subject, status (queued/sent/failed)
   - "Push via Gmail API" button changes draft status to "sent"
   - Disabled for already-sent drafts

8. **As a user, I want to enable auto-sync** so new data is pulled regularly without manual action.
   - Toggle per source (calendar, indeed, gmail, clay) in Scheduling section
   - Schedule row shows current setting (e.g., "Every 4 hours")
   - Actual scheduling handled by external agent/scheduler (Cowork); Sync Hub displays toggle state

---

## 3. Architecture

### High-Level Data Flow

```
┌────────────────────────────────────────────────────────┐
│  External Sources (GCal, Indeed, Gmail, Clay)          │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│  Sync Hub Module (modules/sync/index.html)             │
│  ─ Classification & dedup logic                        │
│  ─ Schema mapping                                      │
│  ─ Sync log recording                                  │
└─────────────────────┬──────────────────────────────────┘
                      │
         ┌────────────┼────────────┬──────────────┐
         ▼            ▼            ▼              ▼
    pf_calendar_   pf_feed_    pf_roles      pf_companies
    events         queue       (pipeline)    (with
                                            enrichment)
         │            │            │              │
         ▼            ▼            ▼              ▼
     Calendar       Job Feed    Pipeline        Pipeline
     module         module      module          module
```

### Data Ingestion Points

**Source Data Objects (defined in Sync Hub):**

1. **GCAL_EVENTS** — Array of raw Google Calendar event objects
   ```javascript
   {
     gcal_id: string,           // Unique GCal event ID for dedup
     summary: string,           // Event title
     description: string,       // Event notes (prep notes, interviewer info)
     start: ISO timestamp,      // Event start datetime
     duration: number,          // Minutes
     organizer?: string
   }
   ```

2. **INDEED_JOBS** — Array of Indeed job listings
   ```javascript
   {
     id: string,
     company: string,
     title: string,
     domain: string,
     location: string,
     salary: string,           // e.g., "$100,000 - $150,000"
     posted: ISO timestamp,
     url: string,
     stage?: string,           // Company stage (Series A, Public, etc.)
     headcount?: number
   }
   ```

3. **GMAIL_ALERTS** — Array of parsed Gmail messages
   ```javascript
   {
     id: string,
     subject: string,
     body: string,
     company: string,
     title: string,            // Job title (for leads) or position (for applications)
     domain: string,
     location: string,
     salary?: string,
     posted?: string,
     isApplication: boolean,   // true = application confirmation, false = job lead
     applicationUrl?: string,
     referredBy?: string,      // Connection name if applicable
     source: string,           // "Gmail", "LinkedIn Job Alert", etc.
     headcount?: number,
     stage?: string
   }
   ```

4. **CLAY_DATA** — Array of enriched company data from Clay
   ```javascript
   {
     name: string,
     domain: string,
     headcount: string | number,
     fundingStage: string,      // e.g., "Series B"
     description: string        // Mission statement
   }
   ```

---

## 4. Supported Sources

| Source | Status | What Syncs | Schema | Dedup Key | Notes |
|--------|--------|-----------|--------|-----------|-------|
| **Google Calendar** | ✅ Shipped | Calendar events (interview, networking, prep, personal) | GCAL_EVENTS → pf_calendar_events | gcal_id | Filters out personal & prep events before writing; classifies into event types |
| **Indeed** | ✅ Shipped | Job listings with salary, posting date | INDEED_JOBS → pf_feed_queue | company \| title | Parses salary, calculates days since posted, scores against preferences |
| **Gmail** | ✅ Shipped | Job leads (→ feed), application confirmations (→ pipeline roles), email classification | GMAIL_ALERTS → pf_feed_queue + pf_roles | company \| title (for both) | Detects offer/rejection/scheduler types; creates roles as "applied"; auto-creates companies |
| **Clay Enrichment** | ✅ Shipped | Company headcount, funding stage, mission statement | CLAY_DATA → pf_companies (merge) | company.name or company.domain | Matches existing companies; updates enrichmentStatus to "complete" |

**Planned Sources (Not Yet Implemented):**
- LinkedIn Recruiter InMail (message parsing, contact extraction)
- Workday Careers API (direct job feed)
- Greenhouse direct integration (offer letter data)

---

## 5. Data Flow & Storage

### localStorage Keys Written by Sync Hub

| Key | Type | Written By | Purpose |
|-----|------|-----------|---------|
| `pf_sync_log` | SyncLogEntry[] | syncCalendar, syncIndeed, syncGmail, syncClay | Historic record of all syncs with timestamp, source, added/skipped counts |
| `pf_calendar_events` | CalendarEvent[] | syncCalendar | Calendar module reads for event list; stores classification + company extraction |
| `pf_feed_queue` | FeedItem[] | syncIndeed, syncGmail | Job Feed module reads for pipeline of opportunities |
| `pf_roles` | Role[] | syncGmail (applications) | Pipeline module reads; roles added in "applied" stage from application confirmations |
| `pf_companies` | Company[] | syncGmail (auto-create), syncClay (merge) | Pipeline module reads; Sync Hub creates stubs for Gmail roles, enriches from Clay |
| `pf_outreach_gmail_queue` | GmailDraft[] | Outreach module (written), Sync Hub reads | Sync Hub displays drafts with push buttons |

### Deduplication Strategy

**Goal:** Prevent duplicate entries when syncing multiple times.

1. **Calendar events:** Keyed by `gcal_id` (unique Google identifier)
   - Before adding: check if gcalId exists in pf_calendar_events
   - If exists: skip (mark as skipped in log)

2. **Indeed + Gmail Feed:** Keyed by `company + "|" + title` (case-insensitive)
   - Before adding: check if key exists in pf_feed_queue
   - If exists: skip

3. **Gmail Application Roles:** Keyed by `company + "|" + title`
   - Before adding: check if key exists in pf_roles
   - If exists: skip

4. **Companies:** Matched by exact name or domain
   - syncGmail: checks if company name exists (case-insensitive); if yes, skips creation
   - syncClay: matches by name OR domain; if found, merges (no skip)

### Sync Log Structure

Each sync operation appends a log entry to `pf_sync_log`:

```javascript
{
  source: 'gcal' | 'indeed' | 'gmail' | 'clay',  // Source name
  timestamp: ISO timestamp,                       // When sync occurred
  added: number,                                  // Count of items added
  skipped: number,                                // Count of duplicates/filtered
  feedAdded?: number,                             // Gmail-specific: feed items added
  rolesAdded?: number,                            // Gmail-specific: pipeline roles added
  companiesAdded?: number,                        // Gmail-specific: companies created
  enriched?: number                               // Clay-specific: companies enriched
}
```

**Example log entries:**
```javascript
[
  { source: 'gcal', timestamp: '2026-03-13T09:15:00Z', added: 3, skipped: 1 },
  { source: 'indeed', timestamp: '2026-03-13T09:16:00Z', added: 12, skipped: 5 },
  { source: 'gmail', timestamp: '2026-03-13T09:17:00Z', feedAdded: 2, rolesAdded: 1, companiesAdded: 1, skipped: 3 },
  { source: 'clay', timestamp: '2026-03-13T09:18:00Z', enriched: 8 }
]
```

### Data Freshness Calculation

```javascript
function calculateFreshness(timestamp) {
  const hoursSince = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
  if (hoursSince <= 1) return { status: 'fresh', hours };     // Green
  if (hoursSince <= 24) return { status: 'stale', hours };    // Amber
  return { status: 'expired', hours };                         // Red
}
```

**Visual Treatment:**
- **Fresh (< 1h):** Green badge + count ✓
- **Stale (1-24h):** Amber badge ⚠️
- **Expired (> 24h):** Red badge ✗
- **Never synced:** Red "Expired" badge

---

## 6. UI Layout

### Overall Page Structure

```
┌─────────────────────────────────────────────┐
│  Navbar (⚡ Pathfinder)                     │
├─────────────────────────────────────────────┤
│  SYNC HUB — Bridge External Data Into Path… │
│  Sync external sources to keep your pipe… │
│                                             │
│  ✓ Last synced 2 hours ago                 │
├─────────────────────────────────────────────┤
│  SYNC ALL                                   │
│  [Sync All] Last full sync: 2 hours ago    │
├─────────────────────────────────────────────┤
│  SOURCE CARDS (Grid: 1-2 per row)          │
│                                             │
│  ┌──────────────────┐ ┌──────────────────┐ │
│  │ 📅 Google Cal    │ │ 💼 Indeed        │ │
│  │ Interview events │ │ Job listings     │ │
│  │ ✓ Fresh         │ │ ⚠️ Stale (6h)   │ │
│  │ 3 events synced │ │ 12 jobs synced   │ │
│  │ [Sync Cal]      │ │ [Sync Indeed]    │ │
│  └──────────────────┘ └──────────────────┘ │
│                                             │
│  ┌──────────────────┐ ┌──────────────────┐ │
│  │ ✉️ Gmail        │ │ 🎯 Clay          │ │
│  │ Leads + apps    │ │ Enrichment       │ │
│  │ ✗ Expired (2d)  │ │ ✓ Fresh (30m)   │ │
│  │ 5 items synced  │ │ 8 companies      │ │
│  │ [Sync Gmail]    │ │ [Sync Clay]      │ │
│  └──────────────────┘ └──────────────────┘ │
├─────────────────────────────────────────────┤
│  STATISTICS DASHBOARD                       │
│  Calendar: 47 events | Indeed: 200 jobs    │
│  Gmail: 35 roles | Companies: 50           │
├─────────────────────────────────────────────┤
│  OUTREACH DRAFT QUEUE                       │
│  ✉️ "Follow-up: Stripe PM role"            │
│     To: alice@stripe.com | Queued          │
│     [Push via Gmail API]                    │
│                                             │
│  (No drafts message if empty)               │
├─────────────────────────────────────────────┤
│  SYNC SCHEDULING                            │
│  Google Calendar: [Toggle] Every 4 hours   │
│  Indeed: [Toggle] Every 6 hours             │
│  Gmail: [Toggle] Every 1 hour               │
│  Clay: [Toggle] Every 12 hours              │
│                                             │
│  Last full sync: 2 hours ago                │
├─────────────────────────────────────────────┤
│  SYNC LOG VIEWER                            │
│  [14:32] Calendar sync complete: 3 added... │
│  [14:33] Indeed sync complete: 12 added…   │
│  [14:34] Gmail sync complete: 5 added…     │
│  [14:35] Clay sync complete: 8 enriched…   │
│  [Export Log]                               │
└─────────────────────────────────────────────┘
```

### Source Card Details

Each source card displays:

1. **Icon + Title** (with background color)
   - 📅 Google Calendar → blue
   - 💼 Indeed → dark blue
   - ✉️ Gmail → red
   - 🎯 Clay → indigo

2. **Subtitle** (description of what syncs)

3. **Freshness badge** (Fresh/Stale/Expired)
   - Shows hours since last sync if available

4. **Data preview** (scrollable list of latest items)
   - 3-5 most recent items summarized
   - Company names, job titles, event summaries

5. **Sync button** (primary action)
   - Disabled during active sync
   - Shows spinner while syncing

6. **Status badge** (after sync)
   - "Synced (12 added)" — blue
   - "Ready" — green (for Clay with no data)
   - "Error" — red (if sync failed)

### Statistics Row

Four stat items in a responsive grid (4 columns on desktop, 1 on mobile):

```
┌───────────┬──────────┬──────────┬──────────┐
│ Calendar  │ Indeed   │ Gmail    │ Companies│
│ 47        │ 200      │ 35       │ 50       │
│ Events    │ Jobs     │ Roles    │ Managed  │
│ 2h ago    │ Fresh    │ 1h ago   │ 30m ago  │
│ (green)   │ (green)  │ (green)  │ (green)  │
└───────────┴──────────┴──────────┴──────────┘
```

Each stat item shows:
- **Value** (large, primary color)
- **Label** (small, secondary color)
- **Last sync time + freshness color**

### Outreach Draft Queue

Card-based layout with draft metadata and action button:

```
┌─────────────────────────────────────────┐
│ ✉️ | Subject: "Follow-up: Stripe PM"   │
│    | To: alice@stripe.com               │
│    | Created: 2026-03-13                │
│    | [Queued] [Push via Gmail API]      │
│    |                                     │
│ ✉️ | Subject: "Thank you note"         │
│    | To: bob@amazon.com                 │
│    | Created: 2026-03-12                │
│    | [Sent] [Push via Gmail API] ✗      │
└─────────────────────────────────────────┘
```

Button states:
- **Queued:** Blue, clickable
- **Sent:** Disabled, grayed out
- **Failed:** Red, clickable to retry

### Scheduling Section

Per-source toggle switches with schedule labels:

```
┌─────────────────────────────────────┐
│ Google Calendar:                    │
│ [Toggle ✓]  Every 4 hours          │
│                                     │
│ Indeed:                             │
│ [Toggle]  Every 6 hours             │
│                                     │
│ Gmail:                              │
│ [Toggle ✓]  Every 1 hour            │
│                                     │
│ Clay:                               │
│ [Toggle]  Every 12 hours (manual)   │
│                                     │
│ Last full sync: 2 hours ago         │
└─────────────────────────────────────┘
```

---

## 7. Integration Points

### How Other Modules Read Synced Data

| Module | Reads | Purpose |
|--------|-------|---------|
| **Calendar** | `pf_calendar_events` | Displays synced interview/networking events in week/month view |
| **Job Feed** | `pf_feed_queue` | Shows synced Indeed + Gmail job leads with scores |
| **Pipeline** | `pf_roles`, `pf_companies` | Displays synced application confirmations as roles in "applied" stage |
| **Dashboard** | `pf_sync_log` (indirect) | Reads via Sync Hub UI for freshness; cards show sync status |

### What Writes Data Back

Only **Outreach module** writes `pf_outreach_gmail_queue` for Sync Hub to read and push.

### Artifact Integration

- No artifact storage in Sync Hub
- Calendar events and feed items are fully materialized in localStorage
- Outreach drafts reference pf_outreach_gmail_queue only

---

## 8. Error Handling & Edge Cases

### Sync Errors

| Scenario | Current Behavior | Future |
|----------|------------------|--------|
| **Network error** | Log as warning, retry not implemented | Implement exponential backoff retry |
| **Invalid JSON in source data** | Wrapped in try-catch, logs error | Show error card with suggestion |
| **Missing required field** | Item skipped, counted as skipped | Validate schema before sync |
| **Dedup collision** | Item skipped, counted as skipped | Log detail about dedup match |
| **Large sync batch (100+ items)** | No pagination, all-or-nothing write | Batch in chunks of 50 |
| **Clay enrichment no data** | Shows warning log, sets status "ready" | Display helpful message to user |

### Edge Cases

1. **Syncing empty source data**
   - GCAL_EVENTS, INDEED_JOBS, GMAIL_ALERTS, CLAY_DATA all empty arrays
   - Sync buttons enabled but will log "0 items added"
   - Card status shows "Synced (0)"

2. **Re-syncing same data multiple times**
   - Dedup keys prevent duplicates
   - Skipped items logged; no side effects

3. **Company name normalization**
   - Gmail: `alert.company` → direct string match (case-insensitive)
   - Sync Hub does NOT strip extra whitespace, accents, or special chars (could be future)
   - Dedup treats "Acme Corp" and "ACME CORP" as different without normalization

4. **Stale data overwrite**
   - Old pf_calendar_events entries are never deleted
   - Manual sync appends; user must manually clear old events
   - No auto-cleanup; retention is indefinite

5. **Source data with no timestamps**
   - CALENDAR: `start` field is mandatory
   - INDEED: `posted` timestamp is mandatory for freshness
   - GMAIL: alerts without timestamps get `new Date().toISOString()` on sync
   - CLAY: no timestamp tracked; uses current sync time

---

## 9. Success Metrics

1. **Sync Reliability**
   - % of syncs that complete without errors (target: 99%)
   - Mean time to sync per source (target: < 5s for 50 items)

2. **Deduplication Effectiveness**
   - Duplicate rate (% of attempted additions that are dedup-skipped, target: < 5% after first full sync)

3. **Data Freshness**
   - % of sources in "fresh" status (< 1h) at any given time (target: 70%)
   - Median age of oldest item in pf_feed_queue (target: < 7 days)

4. **User Engagement**
   - % of users who run "Sync All" at least once per week (target: 80%)
   - % of synced roles that move to "applied" stage within 7 days (target: 30%)
   - % of synced feed items accepted to Pipeline (target: 15%)

5. **Outreach Draft Queue**
   - % of queued drafts pushed successfully (target: 95%)
   - Mean time from draft creation to push (target: < 30s)

---

## 10. Implementation Phases

### ✅ Phase 1 (v3.11 — Shipped)

**Core Sync Framework:**
- [x] syncCalendar() — GCal → pf_calendar_events with classification & dedup
- [x] syncIndeed() — Indeed jobs → pf_feed_queue with scoring
- [x] syncGmail() — Gmail leads & applications → pf_feed_queue & pf_roles
- [x] syncClay() — Clay enrichment → pf_companies merge
- [x] pf_sync_log recording for all sources
- [x] Freshness indicators (fresh/stale/expired badges)
- [x] Statistics dashboard (counts per source, timestamps)
- [x] Outreach draft queue display + manual push buttons
- [x] Scheduling UI with toggle switches (display only — actual scheduling external)
- [x] Export sync log button (CSV/JSON)
- [x] Auto-backup after "Sync All" (via MCP)

**Event Classification:**
- [x] Calendar event filtering (interview/networking only, skip personal/prep)
- [x] Gmail email type detection (recruiter InMail, interview scheduling, rejection, offer)
- [x] Event type mapping (phone_screen, technical, behavioral, panel, hiring_manager)

**Company Auto-Creation:**
- [x] Gmail application → create company stub if not exists
- [x] Fallback domain guessing (company.toLowerCase().replace(/\s+/g, '') + '.com')

### 🔄 Phase 2 (v3.12 — Planned)

**Enhanced Email Parsing:**
- [ ] Recruiter InMail detection + extraction of contact info
- [ ] Offer letter parsing (salary, start date, stock vesting)
- [ ] Interview scheduling parsing (calendar event extraction from email body)
- [ ] Rejection reason extraction (boilerplate taxonomy)

**Sync Scheduling:**
- [ ] Actual scheduled syncs via Cowork (hourly, daily, etc.)
- [ ] Sync state persistence (toggle state → pf_sync_config key)
- [ ] Push notifications on large syncs (> 10 items)

**Data Validation & Schema:**
- [ ] Input validation before sync (required fields, data types)
- [ ] Batch sync with chunking (process 50 items at a time)
- [ ] Error reporting UI with suggestions

**LinkedIn Integration:**
- [ ] LinkedIn Recruiter InMail API integration (requires OAuth)
- [ ] Job alert email parsing (already partially done in Feed module)

### 🚫 Phase 3 (v3.13+) — Aspirational

- Workday Careers API direct integration
- Greenhouse offer letter webhook receiver
- Zapier/Make integration for custom source bridges
- Sync conflict resolution (same role from multiple sources)
- Duplicate company merging (manual or ML-based)

---

## 11. Risk / Failure Modes

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Dedup key collision** | Low | Duplicate entries in Pipeline | Use composite keys (company + title) for all sources; add gcal_id for Calendar |
| **Large sync batch (1000+)** | Medium | Browser memory overflow, localStorage quota exceeded | Implement chunking; show progress indicator |
| **Stale data not cleaned up** | Medium | Feed/Pipeline bloat, search/sort slowness | Add "Clear old data" button; implement retention policy (30 days) |
| **Company name normalization failures** | High | Rich → Richโ (Unicode) treated as different companies | Implement normalizeCompanyName() helper with Unicode handling |
| **Gmail API rate limit** | Low | Sync fails silently; user doesn't know | Add retry-after headers; display error message |
| **External source data format change** | Medium | Sync logic breaks | Document all source schemas in this PRD; add version detection |
| **Outreach draft push fails silently** | Low | Draft stuck in "queued" state forever | Add timeout/retry with exponential backoff |
| **Time zone bugs in freshness calc** | Low | Badges show incorrect hours | Always use UTC for storage; convert to local only for display |

---

## 12. Testing Strategy

### Unit Tests (Planned)

```javascript
// dedup.test.js
test('dedupByCompositeKey filters duplicates', () => {
  const items = [
    { company: 'Acme', title: 'PM' },
    { company: 'ACME', title: 'pm' }  // Should be caught as dup
  ];
  const deduped = dedupByCompositeKey(items);
  expect(deduped).toHaveLength(1);
});

// freshness.test.js
test('calculateFreshness returns fresh for < 1h', () => {
  const recent = new Date(Date.now() - 30 * 60 * 1000);  // 30 min ago
  const { status } = calculateFreshness(recent.toISOString());
  expect(status).toBe('fresh');
});

// classifyEvent.test.js
test('classifyEvent detects interview events', () => {
  const event = { summary: 'Phone Screen with Alice', description: '' };
  expect(classifyEvent(event)).toBe('interview');
});
```

### Integration Tests (Planned)

1. **Full sync flow**
   - Input: GCAL_EVENTS, INDEED_JOBS, GMAIL_ALERTS, CLAY_DATA
   - Action: Run syncCalendar() → syncIndeed() → syncGmail() → syncClay()
   - Assert: All keys written to localStorage; pf_sync_log records all events; dedup works

2. **Dedup prevents duplicates**
   - First sync: 10 items
   - Second sync: Same 10 items
   - Assert: Second sync skips all 10, added=0, skipped=10

3. **Email classification**
   - Input: Offer letter, rejection, recruiter InMail, job lead
   - Assert: Each classified correctly; appropriate key assignments

### E2E Tests (Planned)

1. Open Sync Hub → Click "Sync All" → Verify cards show updated counts and freshness
2. Push Gmail draft → Verify draft status changes to "sent" → Resume in Outreach module shows sent
3. Toggle auto-sync → Verify toggle state persists on reload

### Test Data

Use real examples from CLAUDE_CONTEXT.md migration data:
- 3 GCal events (interview, networking, personal)
- 12 Indeed jobs (varied salary, locations)
- 5 Gmail alerts (2 job leads, 2 application confirmations, 1 offer)
- 8 Clay enrichment records (varied headcount/stage)

---

## 13. Dependencies & External Assumptions

### Hard Dependencies
- **localStorage API** — must be available and writable (≥5MB quota)
- **pf_sync_log key** — all syncs write here; Dashboard reads for status
- **Source data objects** — GCAL_EVENTS, INDEED_JOBS, GMAIL_ALERTS, CLAY_DATA must be defined globally

### Soft Dependencies
- **MCP HTTP bridge** — auto-backup after sync (graceful degradation if unavailable)
- **Gmail API** (future) — required for push draft functionality
- **Google Calendar API** (future) — required for real-time event sync

### Assumptions

1. **Calendar events are pre-fetched** — GCAL_EVENTS populated by external agent, not fetched live
2. **Email parsing is pre-done** — GMAIL_ALERTS structured as objects, not raw email blobs
3. **Company names are human-readable** — No automated normalization before sync (manual cleanup if needed)
4. **Sync triggers are manual or external** — Dashboard doesn't auto-call sync (Cowork agent does)

---

## 14. Future Enhancements (Backlog)

- **Smart dedup** — Fuzzy match company names (Acme vs. Acme Corp vs. ACME) using Levenshtein distance
- **Conflict resolution** — When same role synced from two sources, surface merge UI
- **Company auto-enrichment** — Call Clay API directly instead of manual data pass
- **Real-time sync** — WebSocket stream from external sources instead of periodic polling
- **Sync filters** — User can opt out of specific source types or companies
- **Historical replay** — Re-run past syncs to see how data evolved
- **Analytics** — Track sync trends (average items per week, dedup rate over time)
- **Rollback** — Undo a specific sync operation

---

## Appendix A: Data Contracts

### pf_calendar_events (Synced from GCal)

```javascript
{
  id: string,                   // "evt-gcal-{timestamp}-{index}"
  gcalId: string,               // Original GCal event ID (for dedup)
  title: string,                // Event title
  company: string,              // Extracted from networking events, e.g., "Acme" from "Acme < > Ili"
  date: ISO timestamp,          // Event start time
  duration: number,             // Minutes
  type: 'phone_screen' | 'technical' | 'behavioral' | 'panel' | 'hiring_manager' | 'follow_up' | 'other',
  roleId: string | null,        // Link to pf_roles (set by user manually)
  interviewers: string[],       // Names, extracted from description
  prepNotes: string,            // Event description / notes
  meetingLink: string,          // Video call URL if present
  status: 'upcoming' | 'completed',
  createdAt: ISO timestamp,     // When synced
  source: 'gcal_sync',
  category: 'interview' | 'networking' | 'prep' | 'personal' | 'other'
}
```

### pf_feed_queue (Synced from Indeed + Gmail)

```javascript
{
  id: string,                   // Source-specific ID
  company: string,
  title: string,
  domain: string,               // e.g., "acme.com"
  location: string,
  remote: boolean,
  posted: string,               // Human-readable: "Today", "3 days ago"
  source: 'Indeed' | 'Gmail' | 'LinkedIn Job Alert',
  jd: string,                   // Full JD text (empty if not yet enriched)
  salary: string,               // e.g., "$100K - $150K" or "Not disclosed"
  stage: string,                // Company stage (Series A, Public, etc.)
  headcount: string | number,
  url: string,                  // Application link
  score: number,                // 0-100, calculated from preferences
  scoring: { [key]: number },   // Breakdown (title, domain, keywords, location, etc.)
  syncedAt: ISO timestamp
}
```

### pf_roles — Synced from Gmail Applications

```javascript
{
  id: string,                   // "role-gmail-{timestamp}-{index}"
  company: string,              // Company NAME (string match to pf_companies.name)
  title: string,
  url: string,                  // Application link
  jdText: string,               // (empty on sync)
  positioning: 'ic' | 'management',  // Guessed from title
  targetLevel: string,          // Guessed from title
  source: 'gmail_referral',
  stage: 'applied',             // Always "applied" on sync
  stageHistory: [{ stage, date }],
  salary: string,
  dateAdded: number | ISO timestamp,  // Timestamp
  lastActivity: number | ISO timestamp,
  connections: number,          // Count
  tier: 'active',
  referredBy: string | null     // Contact name if applicable
}
```

### pf_companies — Created/Enriched by Sync

```javascript
{
  // Created by syncGmail (stub)
  id: string,                   // "comp-gmail-{timestamp}-{index}"
  name: string,
  domain: string,               // Guessed: company.toLowerCase() + '.com'
  url: string,
  logoUrl: string,
  tier: 'active',
  missionStatement: string,
  headcount: string,
  fundingStage: string,
  remotePolicy: string,
  enrichmentStatus: 'pending' | 'complete',
  dateAdded: number | ISO timestamp,
  source: 'gmail_sync',

  // Enriched by syncClay (merged)
  clayEnrichedAt: ISO timestamp
}
```

### pf_sync_log (All Syncs)

```javascript
[
  {
    source: 'gcal' | 'indeed' | 'gmail' | 'clay',
    timestamp: ISO timestamp,
    added: number,
    skipped: number,
    // Gmail-specific:
    feedAdded?: number,
    rolesAdded?: number,
    companiesAdded?: number,
    // Clay-specific:
    enriched?: number
  },
  ...
]
```

---

**End of Document**
