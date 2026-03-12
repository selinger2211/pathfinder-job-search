# Calendar Integration Agent — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/calendar/`
**Version:** v1.0.0
**Last Updated:** 2026-03-10
**Status:** Draft — pending approval

---

## 1. Purpose

The Calendar Integration Agent bridges Pathfinder with Google Calendar to automate interview lifecycle tracking. It is the bridge between external calendar events and the pipeline's internal role state. When you receive an interview invitation and add it to Google Calendar, this agent detects it, links it to the relevant role record, advances the stage if appropriate, extracts interviewer metadata, and schedules time-aware nudges that surface the right action at the right moment.

**Design Principles:**

1. **Detection over configuration.** The agent infers interview events from keywords, attendee domains, and description content — no manual setup required. Just accept the calendar invite and the system figures out the rest.
2. **Linkage creates feedback loops.** By connecting calendar events to role records, interview metadata flows back to the Pipeline and forward to the Research Brief and Debrief agents, building a complete interview narrative.
3. **Nudges surface at optimal timing.** Pre-interview nudges prompt research and prep when you need them most. Post-interview nudges capture debrief while memory is fresh and suggest follow-up actions.
4. **Stage transitions are smart.** Calendar events can auto-suggest stage changes (applied → screen, screen → interviewing) based on confidence signals, reducing manual tracking.
5. **Zero setup friction.** The agent runs as a background task with no configuration. It works with the calendar you already use, not a new interface.

---

## 2. Architecture

### High-Level Data Flow

```
Google Calendar
      │
      ▼
┌─────────────────────────────────┐
│  Calendar Integration Agent     │
│  (modules/calendar/)            │
├─────────────────────────────────┤
│ • Event detection & matching    │
│ • Role linkage                  │
│ • Stage auto-advance            │
│ • Nudge scheduling              │
│ • Interviewer extraction        │
└──────────┬──────────────────────┘
           │
      ┌────┼────┬────────────┐
      ▼    ▼    ▼            ▼
   Pipeline Research Debrief Dashboard
   (writes) Brief (reads,  (nudges,
   (reads,  (feeds  writes) schedule)
   writes)  Section 8)
```

### Runtime Architecture

The Calendar Integration Agent operates in two modes:

**1. Scheduled Background Task:**
- Runs once per session (e.g., when Dashboard loads, or on explicit user trigger)
- Checks Google Calendar for events in a rolling 90-day window
- Classifies events, links to roles, schedules nudges
- Writes updates back to `pf_roles` and `pf_calendar_links`
- Idempotent: running again skips already-processed events

**2. Real-Time Dashboard Integration:**
- Dashboard calls `gcal_list_events` directly on load to fetch today's schedule
- Displays "Today's Interviews" quick view
- Allows manual event-to-role linking from the UI if auto-detection fails
- Shows nudge queue for upcoming interviews

### Storage Model

```
┌────────────────────────────────────────┐
│       localStorage keys                │
├────────────────────────────────────────┤
│ pf_roles: Role[]                       │  ← Updated with interviewRounds
│ pf_calendar_links: CalendarLink[]      │  ← Maps event IDs to role IDs
│ pf_nudge_queue: Nudge[]                │  ← Scheduled pre/post interview actions
└────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│    Google Calendar (via MCP)           │
├────────────────────────────────────────┤
│ • Event title, description, time       │
│ • Attendee list with email domains     │
│ • Calendar event IDs                   │
└────────────────────────────────────────┘
```

### Data Dependencies

| Source | Read | Write | When |
|--------|------|-------|------|
| **Google Calendar** | Event title, description, time, attendees, event ID | None (read-only via MCP) | Every session |
| **pf_roles** | Companies, role titles, stage, interview history | `interviewRounds[]`, stage transitions | During event matching |
| **pf_connections** | Recruiter names, contact relationships | None | During interviewer extraction |
| **pf_calendar_links** | Existing event-to-role mappings | New mappings for matched events | After classification |
| **pf_nudge_queue** | Existing scheduled nudges | New nudges for upcoming interviews | After event linking |

---

## 3. Data Model

### CalendarLink Object

Represents a confirmed mapping between a Google Calendar event and a pipeline role.

```typescript
interface CalendarLink {
  id: string;                       // Unique identifier (uuid)
  eventId: string;                  // Google Calendar event ID
  roleId: string;                   // Reference to Role.id
  company: string;                  // Reference to Company.id (cached for quick lookup)
  title: string;                    // Interview round title (cached from event)

  // Event Details (cached from calendar)
  eventTitle: string;               // Original calendar event title
  eventDescription?: string;        // Event description, if present
  startTime: string;                // ISO timestamp
  endTime: string;                  // ISO timestamp
  duration: number;                 // Duration in minutes
  attendees: string[];              // Attendee email addresses

  // Matching Confidence
  confidenceScore: number;          // 0-100, based on detection signals
  matchedSignals: string[];         // Array of signals that matched (e.g., ["title_keyword", "attendee_domain"])

  // Linkage Metadata
  linkedAt: string;                 // ISO timestamp when link was created
  updatedAt: string;                // ISO timestamp of last update
  manuallyConfirmed: boolean;       // True if user manually confirmed the link

  // Interviewers Extracted
  interviewers: {
    email: string;
    name?: string;                  // Extracted from attendee, if available
    connectionId?: string;          // Reference to Connection.id if found
    internalAttendee?: boolean;     // True if attendee is at same company as user
  }[];
}
```

### InterviewRound Object (nested in Role)

When a calendar event is linked to a role, it creates an interview round record.

```typescript
interface InterviewRound {
  id: string;                       // Unique identifier (uuid)
  calendarEventId: string;          // Reference to CalendarLink.eventId
  type: string;                     // Interview type: "phone_screen" | "hiring_manager" | "technical" | "behavioral" | "system_design" | "panel" | "take_home" | "other"

  // Scheduling
  date: string;                     // ISO timestamp
  duration: number;                 // Duration in minutes

  // Interviewers
  interviewers: {
    email: string;
    name?: string;
    connectionId?: string;
  }[];

  // Outcome (populated post-interview via Debrief Agent)
  debrief?: {
    impression?: number;            // 1-5 gut check from debrief
    whatLanded?: string[];          // Positive moments
    whatDidntLand?: string[];       // Weak moments
    questionsAsked?: string[];      // Interview questions
    theirPriorities?: string[];     // Team/company priorities identified
    redFlags?: string[];            // Concerns about role/team/company
    debriefdAt?: string;            // ISO timestamp when debrief was captured
  };

  // Tracking
  completed: boolean;               // True after event end time passes
  completedAt?: string;             // ISO timestamp when event ended
  notes?: string;                   // User-added notes
}
```

### Nudge Object

Represents a scheduled action reminder tied to an interview event.

```typescript
interface Nudge {
  id: string;                       // Unique identifier (uuid)
  roleId: string;                   // Reference to Role.id
  calendarEventId: string;          // Reference to CalendarLink.eventId
  type: 'pre_interview' | 'post_interview';

  // Timing
  triggeredAt?: string;             // ISO timestamp when nudge was scheduled
  fireAt: string;                   // ISO timestamp when nudge should surface
  timezone?: string;                // IANA timezone for the event

  // Content
  title: string;                    // e.g., "Phone Screen at Stripe in 2 days"
  message: string;                  // Detailed nudge text
  action: {
    type: 'research_brief' | 'review_prep' | 'review_tmay' | 'launch_debrief' | 'check_in' | 'next_round';
    targetSection?: string;         // For research brief: e.g., "section_9", "section_10"
    data?: Record<string, any>;     // Action-specific context (e.g., company name, round type)
  };

  // Tracking
  dismissed: boolean;               // User clicked away without acting
  acted: boolean;                   // User followed the action
  actsAt?: string;                  // ISO timestamp when action was taken
}
```

---

## 4. Event Detection & Matching

The agent scans Google Calendar events and classifies them using a weighted signal system. Multiple signals combined increase confidence.

### Detection Signals

| Signal | Weight | Example | Confidence |
|--------|--------|---------|------------|
| **Title keyword** | +40 | "Phone Screen", "Interview", "Hiring Manager Call", "Technical Round", "Bar Raiser", "Debrief" | High |
| **Attendee domain** | +30 | Calendar invite from `@stripe.com` when Stripe is in pipeline | High |
| **Recruiter name match** | +25 | Attendee matches a connection with `relationshipType: 'recruiter'` | High |
| **Description content** | +15 | Description mentions role title or "interview loop" | Medium |
| **Duration heuristic** | +10 | 30-60 min meeting with external attendee during business hours (8am-6pm) | Low |
| **Attendee count** | +5 | 2-4 attendees suggest formal interview vs. casual meeting | Low |

### Classification Algorithm

1. **Parse event:** Extract title, description, attendee list, duration, start time
2. **Company lookup:** Check if any attendee domain matches a company in pipeline
3. **Role lookup:** If company found, scan all roles at company for keyword matches
4. **Signal scoring:** Sum weights for all matched signals
5. **Decision:**
   - Score ≥ 70 → **High confidence** — auto-link
   - Score 50-69 → **Medium confidence** — surface suggestion in Dashboard
   - Score < 50 → **Low confidence** — ignore, user can manually link

### Example: Phone Screen at Stripe

```
Event: "Phone Screen - Stripe Product Manager"
Attendees: recruiter@stripe.com, jane.doe@example.com (user)
Duration: 45 minutes
Description: "Initial phone screen for Senior PM role. Discuss background and product sense."

Signal matching:
  ✓ Title keyword "Phone Screen" → +40
  ✓ Attendee domain @stripe.com matches pipeline company "Stripe" → +30
  ✓ Recruiter name matches connection list → +25
  ✓ Description mentions "PM role" matching pipeline role → +15
  ✓ Duration 45 min, external attendee → +10
  ─────────────────────────────────────
  Total score: 120 (capped at 100) → AUTO-LINK
```

### Example: "Team Coffee"

```
Event: "Team Coffee - Catch up"
Attendees: alice@stripe.com
Duration: 30 minutes
Description: ""

Signal matching:
  ✗ Title generic (no interview keywords) → +0
  ✓ Attendee domain @stripe.com → +30
  ✗ No recruiter match → +0
  ✗ No description → +0
  ✗ 30 min, external, but vague context → +5
  ─────────────────────────────────────
  Total score: 35 → IGNORE (too low confidence)

  [If Stripe is a "Hot" company with open roles, user sees suggestion:
   "Calendar event 'Team Coffee with alice@stripe.com' — link to a role at Stripe?"]
```

### Conflict Resolution

If multiple roles at the same company could match an event:
1. Check event description for role title or JD keywords → match exact role
2. If multiple still match, check interview substate (if one role in `interviewing` and another in `applied`, match the `interviewing` role)
3. If still ambiguous, surface as "Could be multiple roles — which one?" in Dashboard for user to select

---

## 5. Event Processing Workflow

### Step 1: Event Detection (runs on session start or manual trigger)

```
For each Google Calendar event in last 7 days + next 90 days:
  1. Extract: title, description, attendees, time, duration
  2. Run classification algorithm
  3. If score ≥ 70:
     - Check if CalendarLink already exists for this event ID
     - If new, create CalendarLink record
     - Proceed to Step 2: Role Linking
  4. Else if score 50-69:
     - Surface suggestion in Dashboard (user can confirm/dismiss)
  5. Else:
     - Skip (low confidence)
```

### Step 2: Role Linking & Stage Auto-Advance

```
For each matched CalendarLink:
  1. Look up Role by roleId
  2. Add entry to Role.interviewRounds[]
  3. Auto-suggest stage transition:
     - If Role.stage == 'applied' AND event has external attendee from company:
       → Suggest 'applied' → 'screen'
     - Else if Role.stage == 'screen' AND event is second/later round:
       → Suggest 'screen' → 'interviewing'
     - Else: No auto-advance, user decides
  4. Write updated Role back to localStorage
```

### Step 3: Interviewer Extraction

```
For each CalendarLink.attendees:
  1. Extract email and any available name
  2. Check if attendee matches a Connection in pf_connections
  3. If match found:
     - Add connectionId to InterviewRound.interviewers
     - Flag for Research Brief Section 8 (Interviewer Insights)
  4. If no match:
     - Try to infer name from email (e.g., "jane.doe@company.com" → "Jane Doe")
     - Add to InterviewRound.interviewers with name only
  5. Return list for Research Brief to fetch additional context
```

### Step 4: Nudge Scheduling

```
For each linked event:
  1. Calculate nudge fire times based on event start time:
     - 72h before → "Research brief not started" nudge
     - 48h before → "Review prep materials" nudge
     - Morning of (8am local) → "Review TMAY + questions" nudge
     - 1h after event end → "Capture debrief" nudge

  2. For each nudge:
     - Create Nudge record
     - Set fireAt timestamp
     - Add to pf_nudge_queue
     - Store in localStorage

  3. Dashboard watches pf_nudge_queue and surfaces nudges when fireAt <= now
```

---

## 6. Pre-Interview Nudges

Time-aware nudges surface before interviews to prompt research, preparation, and mental readiness.

### Nudge Schedule

| Timing | Title | Message | Action |
|--------|-------|---------|--------|
| **72h before** | Interview coming up | "Interview at {company} in 3 days — research brief not started" | Launch Research Brief for this role |
| **48h before** | Review prep materials | "Review your prep for {company} {round type}" | Open existing Research Brief; review Sections 1-7 |
| **Morning of** | Interview today | "{company} interview at {time} — review TMAY script and questions to ask" | Open Brief Sections 9-10 (Your Story, Questions to Ask) |
| **1h after** | Capture debrief | "How did your {company} interview go? Capture it while it's fresh." | Launch Debrief Agent with interview context pre-loaded |

### Nudge Customization

If Research Brief exists for the role:
- 72h nudge becomes "Research brief exists — review before the call"
- 48h nudge highlights sections most relevant to interview type (e.g., for technical round: Section 5 Technical Overview)

If multiple interviews same day:
- Nudges batch into a single "Morning briefing: {N} interviews today" card
- Allows quick toggle through each interview's prep materials

### Dismissal & Tracking

- User can dismiss a nudge without acting (stored in Nudge.dismissed)
- If nudge is dismissed, a milder version re-surfaces 24h before event
- Dashboard tracks which nudges were acted on (Nudge.acted = true when user clicks action)

---

## 7. Post-Interview Triggers & Follow-Up

After an interview event ends, the agent watches for patterns that signal next steps.

### Auto-Detection Rules

**Next Round Scheduled:**
```
If new calendar event from same company detected within 1-2 weeks after interview:
  1. Likely a follow-up round (debrief → next interview)
  2. Auto-link new event to same role
  3. Update Role.interviewing.substate to 'in_loop'
  4. Nudge: "Next round at {company} scheduled for {date}"
```

**No Follow-Up (Check-In Nudge):**
```
If 2 weeks pass after interview and no follow-up event from company:
  1. Likely a waiting period or silent rejection
  2. Surface nudge: "No follow-up from {company} in 2 weeks — check in with recruiter?"
  3. Nudge includes draft email template
  4. User can mark as "awaiting_decision" substate if they have reason to wait
```

**Offer Event Detected:**
```
If new calendar event from company with title containing "offer", "compensation", "decision call":
  1. Suggest advancing Role.stage to 'offer'
  2. Update Role.offer.substate to 'received'
  3. Nudge: "Offer discussion scheduled at {company} — prepare negotiation brief"
  4. Link to Comp Intelligence Agent for salary benchmarking
```

**Rejection Signal:**
```
If calendar event deleted or meeting shows "Declined" status, or no communication within 30 days:
  1. Prompt user: "No activity for 30 days — mark as closed?"
  2. If user confirms: Role.stage = 'closed', closeReason = 'ghosted'
  3. This is a soft suggestion, not automatic
```

---

## 8. UI Specification

### 8.1 Calendar Integration Points

**1. Dashboard — Today's Interview Widget**

Shows today's scheduled interviews pulled from calendar:
- Company logo, role title
- Time, duration, attendees
- Quick action buttons: "Open Brief", "Review TMAY", "Start Prep"
- If nudge is active, nudge card displayed above event

**2. Pipeline — Interview Rounds Tab (in Role Detail Panel)**

Under the role detail panel, new "Interview History" tab shows:
- Linked calendar events with dates, interviewers, duration
- Debrief status (captured / pending)
- Stage transition suggestions triggered by this event
- Manually link/unlink events if auto-detection missed

**3. Calendar Widget (Future)**

If building a custom calendar view:
- Show interview events from Google Calendar
- Color code by stage (screen=yellow, interviewing=orange, offer=green)
- Click event to jump to role detail or open brief

### 8.2 Nudge Display

**Dashboard Nudge Panels:**

Nudges display in a chronological queue on the right sidebar of Dashboard:

```
┌─────────────────────────────┐
│  Next Actions               │
├─────────────────────────────┤
│ ⏰ Interview today (9am)     │
│  Stripe — Phone Screen      │
│  [Review Brief] [Start Prep]│
│                             │
│ ⏰ In 3 days (11am)          │
│  Google — Hiring Mgr Call   │
│  Research brief not started │
│  [Start Research Brief]     │
│                             │
│ ⏰ In 1 week (10am)          │
│  Meta — Design Round        │
│  [Review Prep]              │
└─────────────────────────────┘
```

**Nudge Card Details:**
- Icon indicates nudge type (clock for timing, info for action needed)
- Company logo (if available)
- Role title and round type
- Action button with primary call-to-action
- Dismiss button (small X)
- Expandable for more details (e.g., attendee list, meeting link)

### 8.3 Interviewer Linking

**Research Brief Section 8 — Interviewer Insights**

Once interviewers are extracted from calendar, they appear in Research Brief:

```
Section 8: Interviewer Insights

🔗 This interview is scheduled with 2 people:

1. Jane Smith (jane@stripe.com)
   • Role: Senior Recruiter
   • Connection status: Not in your network
   • First time interviewing you? Yes

2. Bob Johnson (bob@stripe.com)
   • Role: Hiring Manager, Product
   • Connection status: Not in your network
   • Glassdoor reviews: Search on Glassdoor (link)
   • LinkedIn: Search on LinkedIn (link)

[Fetch interviewer context from LinkedIn]
```

If user has connection data for an interviewer, Research Brief can reference prior interactions and relationship context.

---

## 9. Implementation Phases

### Phase 1: Core Event Detection & Linking (v1.0)

**In scope:**
- [x] Read Google Calendar via MCP (gcal_list_events)
- [x] Implement classification algorithm (signal matching, scoring)
- [x] Create CalendarLink and InterviewRound objects in localStorage
- [x] Link matched events to pipeline roles
- [x] Extract interviewer emails and names
- [x] Schedule nudge queue in localStorage
- [x] Dashboard displays today's interviews

**Out of scope:**
- UI for manual event linking (will add in Phase 2)
- Interviewer context fetching (LinkedIn, Glassdoor)
- Post-event follow-up triggers (check-in nudges, no-response detection)

### Phase 2: Nudges & UX Polish (v1.1)

- [ ] Implement full nudge display on Dashboard
- [ ] Pre-interview nudges trigger at correct times
- [ ] Nudge actions link to Research Brief, Debrief Agent
- [ ] Post-interview nudge ("Capture debrief") surfaces after event ends
- [ ] Manual event linking UI in Pipeline (for low-confidence events)
- [ ] Interviewer context fetching (LinkedIn, Glassdoor, internal notes)

### Phase 3: Post-Event Triggers (v1.2)

- [ ] Detect next round scheduled within 1-2 weeks
- [ ] Auto-link follow-up events
- [ ] No-follow-up nudge after 2 weeks
- [ ] Offer detection and stage auto-advance
- [ ] 30-day check-in for stalled roles

### Phase 4: Intelligence & Feedback Loops (v1.3+)

- [ ] Interview outcome patterns (which types of questions, which companies)
- [ ] Interviewer reputation scoring (how often leads to next round)
- [ ] Stage transition success rates (screen→offer conversion by company)
- [ ] Company interview process insights (typical number of rounds, duration)
- [ ] Trend analysis dashboard (interview volume by week, offer rate)

### Bug Fixes (v2.1.4)

- [x] **Add Event modal invisible:** Modal CSS class mismatch — Calendar used `active` class but shared `pathfinder.css` requires `open` class for `opacity: 1`. Modal was `display: flex` but `opacity: 0` (transparent). Fixed all 8 references (openModal, closeModal, openAddEventModal, openEventDetail, openCommandPalette, handleOutsideClick, Escape handler, overlay click handler).
- [x] **Sync Log "undefined" for sync type:** `loadSyncLog()` rendered `entry.action` and `entry.status`, but Sync Hub writes entries with `entry.source` and no `status` field. Fixed renderer to fall back to `entry.source`, derive status from `entry.added`, and build detail rows from flat entry fields.

---

## 10. Integration Points with Other Modules

### Research Brief Agent

**Dependency:** Calendar Integration feeds interviewer metadata to Section 8

```
Calendar Integration:
  Extracts interviewers from calendar event
  → Writes to Role.interviewRounds[].interviewers

Research Brief:
  Reads Role.interviewRounds[].interviewers
  → Generates Section 8: Interviewer Insights
  → Fetches context (LinkedIn, Glassdoor, internal notes)
```

**Timing:** When Research Brief is generated after event is linked, it includes interviewer cards. If generated before, nudge suggests "Research brief exists — update with interviewer context" when interviewers are extracted.

### Debrief Agent

**Dependency:** Calendar Integration provides interview context to Debrief prompt

```
Calendar Integration:
  Links event to role
  Extracts interviewer names, round type

Debrief Agent (triggered by post-interview nudge):
  Pre-loads interview metadata
  Prompts structured debrief questions
  Captures outcome data
  Writes back to Role.interviewRounds[].debrief
```

**Workflow:**
1. Event linked by Calendar Integration
2. 1h after event ends, nudge surfaces: "Capture debrief?"
3. User clicks nudge → launches Debrief Agent with interview context
4. Debrief Agent populates company, role, interviewer names, interview type
5. After debrief, suggests: "Send thank-you to interviewers?"
6. Hands off to Outreach Message Generator

### Pipeline Tracker

**Bidirectional:** Calendar events update role stage; role stage filters calendar monitoring

```
Calendar Integration → Pipeline:
  New CalendarLink
  → Auto-link to Role
  → Update Role.interviewRounds[]
  → Suggest stage transition

Pipeline → Calendar Integration:
  User changes role stage manually
  → Calendar Integration watches that stage
  → Filters event detection to likely companies/roles
```

**Example:** If user moves role to `screen` stage, Calendar Integration prioritizes watching for phone screens at that company.

### Dashboard

**Dependency:** Dashboard queries Calendar Integration for today's schedule

```
On Dashboard load:
  1. Call gcal_list_events(timeMin: today, timeMax: tomorrow)
  2. Check pf_calendar_links for linked events
  3. Display "Today's Interviews" widget
  4. Show pending nudges from pf_nudge_queue
  5. Highlight overdue nudges (fireAt < now and not acted)
```

**Real-Time Updates:** If user has Dashboard open and calendar event is updated (time changed, attendee added), Dashboard can poll gcal_list_events every 5 minutes to refresh.

### Comp Intelligence Agent

**Dependency:** Calendar Integration signals when compensation discussion is scheduled

```
Calendar Integration:
  Detects offer/compensation event
  → Suggests advancing to Role.stage = 'offer'
  → Triggers nudge

Comp Intelligence Agent (user opens offer section):
  Reads Role.salary
  Reads Role.stage = 'offer'
  → Generates benchmarking + negotiation brief
  → Suggests counter-offer strategy
```

---

## 11. localStorage Keys

| Key | Type | Owner | Description |
|-----|------|-------|-------------|
| `pf_calendar_links` | `CalendarLink[]` | Calendar Integration | All detected/confirmed event-to-role mappings |
| `pf_nudge_queue` | `Nudge[]` | Calendar Integration | Scheduled nudges (pre/post interview) |
| `pf_roles` | `Role[]` | Pipeline (updated by Calendar) | Updated with interviewRounds[] entries |

Calendar Integration module writes to `pf_calendar_links` and `pf_nudge_queue` exclusively. It reads `pf_roles` to match events and writes updated role records back with new `interviewRounds[]` entries.

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Event detection accuracy** | 85%+ true positives | Manual audit of detected vs. missed interview events |
| **False positive rate** | <5% | % of auto-linked events user has to manually unlink |
| **Nudge timing accuracy** | 95%+ nudges fire within ±15 min of target | Timestamp comparison of fireAt vs. actual surface time |
| **Interviewer extraction** | 90%+ of attendees have email extracted | Audit extracted names/emails against calendar events |
| **Stage auto-advance accuracy** | 80%+ suggestions are correct | User accepts/ignores rate for suggested transitions |
| **End-to-end latency** | <5s from event detection to nudge display | Performance monitoring on scheduled task |
| **User engagement** | 70%+ of nudges are acted upon | Track Nudge.acted flag |
| **Debrief capture rate** | 60%+ of interviews debriefed within 1h | Track debrief completion timestamp vs. event end time |

---

## 13. Relationship to Other Modules

```
        ┌──────────────────────────────┐
        │  Calendar Integration Agent  │
        │  (modules/calendar/)         │
        └──────────┬───────────────────┘
                   │
         ┌─────────┼─────────┬──────────┬───────────┐
         ▼         ▼         ▼          ▼           ▼
      Pipeline  Research  Debrief   Outreach    Dashboard
      (updates  Brief     Agent     (thank-you  (nudge queue,
       roles)   (Section 8)(feeds)  notes)      today schedule)
```

### Data Dependencies Summary

| Module | What It Reads from Calendar | What It Writes Back |
|--------|---|---|
| **Pipeline** | (N/A) — Calendar writes TO Pipeline | — |
| **Research Brief** | Interviewer metadata from interviewRounds | (N/A) |
| **Debrief Agent** | Interview context (type, company, interviewers) | Debrief outcome data back to interviewRounds |
| **Outreach** | Interviewer names for thank-you notes | (N/A) |
| **Dashboard** | Nudge queue, today's events | (N/A) — reads only |
| **Google Calendar** | Event title, description, attendees, time | (N/A) — read-only via MCP |

---

## 14. Error Handling & Edge Cases

### Case: Event Has No External Attendees

**Scenario:** Internal team sync scheduled, not an interview

**Detection:** Only internal company domain in attendees

**Behavior:** Skip event during classification (low signal strength). If event title has interview keywords, surface as "Team meeting?" suggestion for user to confirm.

### Case: Calendar Event Deleted After Linking

**Scenario:** User deletes calendar event (e.g., interview cancelled)

**Detection:** CalendarLink references event that no longer exists in gcal_list_events

**Behavior:**
- On next scheduled detection run, mark CalendarLink.completed = true with cancellationReason
- Surface nudge: "{company} interview cancelled — update pipeline?"
- User can manually update role stage or close the role

### Case: Recruiter Email Not Recognized

**Scenario:** Calendar invite from recruiter at unfamiliar domain

**Detection:** Attendee domain doesn't match any pipeline company

**Behavior:**
- Signal strength drops (no domain match)
- If title has strong interview keywords, still classify as interview
- Interviewers list includes email only (no name match, no connection link)
- Research Brief Section 8 suggests "Confirm company name" if fuzzy matching possible

### Case: Same Person Interviewed Twice

**Scenario:** Same interviewer at same company, different rounds

**Detection:** CalendarLink.interviewers list includes duplicate email address

**Behavior:**
- Debrief Agent notes: "Jane Smith again (your second meeting with her)"
- Research Brief can reference previous interview notes
- Opportunity for Research Brief to suggest: "Jane asked about {topic} last time — be ready for follow-up"

### Case: Ambiguous Time Zone

**Scenario:** Event scheduled in different time zone than user's local

**Detection:** Calendar event includes explicit timezone

**Behavior:**
- Calendar Integration converts to user's local timezone for nudge scheduling
- Nudge displays both event time and user's local time
- Morning-of nudge fires at 8am in user's timezone, not event timezone

---

## 15. Implementation Notes

### Scheduled Task Integration

The Calendar Integration runs as a scheduled Cowork task. Pseudo-code:

```javascript
// /modules/calendar/SKILL.md (scheduled task)

// Runs once per session start (or explicit user trigger)
async function detectCalendarEvents() {
  const roles = JSON.parse(localStorage.getItem('pf_roles') || '[]');
  const connections = JSON.parse(localStorage.getItem('pf_connections') || '[]');
  const existingLinks = JSON.parse(localStorage.getItem('pf_calendar_links') || '[]');

  // Define time window: last 7 days + next 90 days
  const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all calendar events
  const events = await gcal_list_events({
    timeMin,
    timeMax,
    maxResults: 250
  });

  for (const event of events.events) {
    // Skip if already linked
    if (existingLinks.find(link => link.eventId === event.id)) continue;

    // Classify event
    const score = classifyEvent(event, roles);

    if (score.confidenceScore >= 70) {
      // High confidence: auto-link
      const match = score.roleId;
      const calendarLink = createCalendarLink(event, match, score);
      existingLinks.push(calendarLink);

      // Update role with interview round
      const role = roles.find(r => r.id === match);
      role.interviewRounds = role.interviewRounds || [];
      role.interviewRounds.push(createInterviewRound(event, calendarLink));

      // Schedule nudges
      const nudges = scheduleNudges(event, match, role);
      const queue = JSON.parse(localStorage.getItem('pf_nudge_queue') || '[]');
      queue.push(...nudges);
      localStorage.setItem('pf_nudge_queue', JSON.stringify(queue));
    }
    else if (score.confidenceScore >= 50) {
      // Medium confidence: surface suggestion
      const suggestion = {
        eventId: event.id,
        title: event.summary,
        suggestedRoleId: score.roleId,
        confidenceScore: score.confidenceScore,
        createdAt: new Date().toISOString()
      };
      // Store suggestion for Dashboard to display
      const suggestions = JSON.parse(localStorage.getItem('pf_calendar_suggestions') || '[]');
      suggestions.push(suggestion);
      localStorage.setItem('pf_calendar_suggestions', JSON.stringify(suggestions));
    }
  }

  // Write updated data back
  localStorage.setItem('pf_calendar_links', JSON.stringify(existingLinks));
  localStorage.setItem('pf_roles', JSON.stringify(roles));
}
```

### Google Calendar MCP Usage

Calendar Integration uses `gcal_list_events` from the Google Calendar MCP connector:

```javascript
// Minimal example
const response = await gcal_list_events({
  timeMin: "2026-03-10T00:00:00Z",
  timeMax: "2026-06-10T23:59:59Z",
  maxResults: 250,
  singleEvents: true  // Expand recurring events
});

// response.events is an array of:
// {
//   id: string,
//   summary: string,
//   description?: string,
//   start: { dateTime: string, timeZone?: string },
//   end: { dateTime: string, timeZone?: string },
//   attendees?: [{ email: string, displayName?: string, organizer?: boolean }],
//   organizer: { email: string, displayName?: string },
//   ...
// }
```

The agent extracts title, description, attendee emails/names, and time information from the response and classifies as described in Section 4.

---

## 16. Technical Debt & Future Enhancements

1. **Interviewer Context Fetching** — Integration with LinkedIn API (or web scrape fallback) to fetch interviewer titles, company tenure, interview patterns
2. **Calendar Sync Bidirectionality** — Write debrief notes back to calendar event description (optional, respect user preference)
3. **Recurring Interview Patterns** — Detect if same company interviews multiple candidates on same dates, infer pipeline stage distribution
4. **Interview Outcome Prediction** — ML model trained on historical debriefs to predict offer likelihood
5. **Cross-Role Interview Analytics** — Dashboard showing interview volume trends, offer rate by company, interview type effectiveness
6. **Mobile Calendar Sync** — If building mobile app, sync calendar data to mobile for offline access
7. **Timezone Intelligence** — For distributed teams, auto-detect recruiter timezone and optimize nudge timing accordingly

---

## Conclusion

The Calendar Integration Agent is the temporal hub of Pathfinder. By linking calendar events to role records, it creates a complete interview lifecycle narrative — from first calendar invite through debrief through offer. This linkage enables other agents (Research Brief, Debrief, Outreach) to provide perfectly-timed support, and it builds a dataset of interview patterns that informs future prep strategies.

The agent operates silently in the background, requiring zero configuration. As soon as you accept a calendar invite, Pathfinder knows about the interview and begins orchestrating the preparation workflow.
