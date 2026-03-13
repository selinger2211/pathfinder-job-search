# Pathfinder Event Taxonomy & Instrumentation Schema

## 1. Purpose

Pathfinder's 11 modules currently emit data independently—pipeline tracks `stageHistory`, outreach maintains `outreachLog`, debrief stores `ratings`—making cross-module analytics fragmented and unreliable. A canonical event stream provides a single source of truth for all user actions, enabling accurate dashboard metrics, trend analysis, and data export. With a uniform schema, we move from ad-hoc formulas to reproducible, auditable analytics that track conversions, response rates, and time-to-hire across the entire job search lifecycle.

## 2. Canonical Event Schema

All events logged to `pf_event_log` follow this structure:

```javascript
// Example event
{
  id: string,           // "evt-1710355200000-a7f3"
  timestamp: number,    // Date.now() — milliseconds since epoch
  source: string,       // module name: "pipeline", "outreach", "feed", "interview", etc.
  action: string,       // verb: "role.added", "outreach.sent", "interview.scheduled"
  resourceType: string, // "role", "company", "connection", "interview", "debrief"
  resourceId: string,   // unique identifier for the resource (roleId, companyName, etc.)
  details: {            // action-specific payload — structure varies by action
    // example for outreach.sent:
    // { channel: "email", contactId: "c123", messageId: "msg-456", responseTarget: 7 }
  },
  version: 1            // schema version for future migrations
}
```

**Field Definitions:**
- **id**: Unique event identifier. Format: `evt-{timestamp}-{random4}` (e.g., `evt-1710355200000-a7f3`). Use for deduplication and audit trails.
- **timestamp**: Milliseconds since epoch (JavaScript `Date.now()`). Enables precise ordering and time-bucketing for analytics.
- **source**: The module that generated the event. Values: `pipeline`, `outreach`, `feed`, `resume`, `interview`, `research`, `networking`, `calendar`, `comp`, `dashboard`, `debrief`, `system`.
- **action**: Verb describing what happened. Always snake_case: `role.added`, `outreach.sent`, `interview.completed`.
- **resourceType**: The domain object being acted upon. Values: `role`, `company`, `connection`, `interview`, `debrief`, `brief`, `resume`, `event`, `benchmark`.
- **resourceId**: Identifier for that object. For roles, use the roleId. For companies, use the normalized company name or ID. Must be non-empty and consistent across all events.
- **details**: Optional. Action-specific payload. Always an object `{}`. Include only contextual data needed for analytics; do not duplicate fields already in id/resourceId.
- **version**: Schema version (currently `1`). Enables backward-compatible schema evolution.

## 3. Event Catalog

| Event Name | Source | Action | Resource Type | Resource ID Example | Details Payload | Dashboard Metric |
|---|---|---|---|---|---|---|
| Role Added | pipeline | role.added | role | role-uuid | `{ source: "manual" \| "feed", companyName, jobTitle, url }` | Total roles in pipeline |
| Role Applied | pipeline | role.applied | role | role-uuid | `{ appliedAt, url, channel: "email" \| "platform" }` | Applications this week |
| Role Stage Changed | pipeline | role.stageChanged | role | role-uuid | `{ fromStage, toStage, movedAt }` | Time in stage (avg) |
| Role Rejected | pipeline | role.rejected | role | role-uuid | `{ rejectionReason, rejectedAt }` | Rejection rate (%) |
| Role Offer Received | pipeline | role.offerReceived | role | role-uuid | `{ offerAt, compensation: { salary, equity, bonus } }` | Offers pending |
| Role Offer Accepted | pipeline | role.offerAccepted | role | role-uuid | `{ acceptedAt, compensation }` | Offers accepted |
| Role Closed | pipeline | role.closed | role | role-uuid | `{ closedAt, reason: "hired" \| "rejected" \| "withdrawn" }` | Pipeline velocity |
| Outreach Message Drafted | outreach | outreach.drafted | connection | connection-id | `{ channel: "email" \| "linkedin" \| "phone", draft }` | Outreach engagement |
| Outreach Message Sent | outreach | outreach.sent | connection | connection-id | `{ channel, sentAt, messageId, relatedRoleId }` | Outreach this week |
| Outreach Response Received | outreach | outreach.responseReceived | connection | connection-id | `{ respondedAt, responseTime (ms), sentiment: "positive" \| "neutral" \| "negative" }` | Outreach response rate (%) |
| Outreach Conversation Ended | outreach | outreach.ended | connection | connection-id | `{ endedAt, outcome: "meeting" \| "no_response" \| "rejected" }` | Conversion by channel |
| Research Brief Generated | research | brief.generated | brief | brief-id | `{ roleId, generatedAt, template, modelUsed: "gpt-4" \| "claude", tokens }` | Briefs generated |
| Research Brief Regenerated | research | brief.regenerated | brief | brief-id | `{ version, regeneratedAt, reason }` | Brief efficiency (regens) |
| Research Cache Hit | research | brief.cached | brief | brief-id | `{ cachedQuery, savedTokens }` | Cache hit rate (%) |
| Resume JD Analyzed | resume | resume.analyzed | role | role-uuid | `{ analyzedAt, matchScore: 0-100, gaps: [] }` | Resume analysis completions |
| Resume Generated | resume | resume.generated | resume | resume-id | `{ generatedAt, roleId, variant: "full" \| "tailored", tokens }` | Resume variants created |
| Resume Exported | resume | resume.exported | resume | resume-id | `{ exportedAt, format: "pdf" \| "docx" \| "text", destination }` | Resumes exported |
| Interview Scheduled | interview | interview.scheduled | interview | interview-id | `{ roleId, scheduledFor (ISO), interviewer, duration (min) }` | Interviews this month |
| Interview Completed | interview | interview.completed | interview | interview-id | `{ completedAt, duration (min), type: "phone" \| "video" \| "onsite" }` | Interview pipeline |
| Interview Debrief Submitted | debrief | debrief.submitted | debrief | debrief-id | `{ roleId, submittedAt, ratings: { communication, alignment, excitement }, nextSteps }` | Debrief loop closed |
| Networking Connection Tracked | networking | connection.tracked | connection | connection-id | `{ trackedAt, source: "manual" \| "linkedin", name, company, title }` | Connections tracked |
| Networking LinkedIn Import | networking | connection.imported | connection | connection-id | `{ importedAt, count, source: "linkedin" }` | LinkedIn syncs |
| Networking Mutual Connection Found | networking | connection.mutual | connection | connection-id | `{ foundAt, relatedRoleId, mutualVia: "name" }` | Mutual connections |
| Feed Roles Scored | feed | feed.scored | role | role-uuid | `{ scoredAt, score: 0-100, factors: { match, location, salary } }` | Roles scored this week |
| Feed Role Accepted to Pipeline | feed | feed.accepted | role | role-uuid | `{ acceptedAt, score }` | Feed conversion (%) |
| Feed Role Dismissed | feed | feed.dismissed | role | role-uuid | `{ dismissedAt, reason: "location" \| "salary" \| "mismatch" }` | Dismissal rate (%) |
| Feed Role Snoozed | feed | feed.snoozed | role | role-uuid | `{ snoozeUntil (ISO), reason }` | Snoozed roles |
| Calendar Event Created | calendar | event.created | event | event-id | `{ createdAt, linkedRoleId, type: "interview" \| "deadline" \| "nudge", dueDate }` | Calendar events |
| Calendar Event Linked | calendar | event.linked | event | event-id | `{ linkedAt, roleId }` | Events linked to roles |
| Calendar Nudge Fired | calendar | nudge.fired | role | role-uuid | `{ firedAt, nudgeType: "followup" \| "app_deadline" \| "interview_prep", acknowledged }` | Nudges fired |
| Calendar Nudge Dismissed | calendar | nudge.dismissed | role | role-uuid | `{ dismissedAt, nudgeType, snoozeUntil }` | Nudge engagement (%) |
| Compensation Data Entered | comp | comp.entered | benchmark | benchmark-id | `{ enteredAt, salary, equity, bonus, location, yearsExp }` | Comp data points |
| Compensation Benchmark Compared | comp | comp.compared | benchmark | benchmark-id | `{ comparedAt, roleId, percentile: 0-100 }` | Benchmark queries |
| Compensation Negotiation Strategy Generated | comp | comp.strategy | role | role-uuid | `{ generatedAt, rangeMin, rangeMax, negotiationPoints: [] }` | Negotiation strategies |
| Dashboard Metric Computed | dashboard | metric.computed | role | "weekly" \| "monthly" | `{ computedAt, metricName, value }` | Dashboard accuracy |
| System Sync Completed | system | sync.completed | role | "all" | `{ completedAt, duration (ms), modulesSync, eventsLogged }` | Data freshness |
| System Backup Created | system | backup.created | role | "all" | `{ createdAt, size (bytes), retentionDays: 90 }` | Backup frequency |
| System Data Imported | system | data.imported | role | "all" | `{ importedAt, source: "file" \| "export", recordCount }` | Data migrations |

## 4. Derived Metrics

All dashboard metrics are computed directly from `pf_event_log` using these formulas:

### Weekly & Time-Based Metrics

**Actions This Week**
```javascript
events
  .filter(e => e.timestamp >= now - 7 * 86400000)
  .filter(e => ['role.applied', 'outreach.sent', 'interview.scheduled'].includes(e.action))
  .length
```

**Applications This Week**
```javascript
events
  .filter(e => e.timestamp >= now - 7 * 86400000)
  .filter(e => e.action === 'role.applied')
  .length
```

**Outreach This Week**
```javascript
events
  .filter(e => e.timestamp >= now - 7 * 86400000)
  .filter(e => e.action === 'outreach.sent')
  .length
```

**Interviews This Month**
```javascript
events
  .filter(e => e.timestamp >= now - 30 * 86400000)
  .filter(e => e.action === 'interview.scheduled')
  .length
```

**Roles Per Week (Average)**
```javascript
const weeks = [...];  // group events by week
const rolesAdded = weeks.map(w =>
  events.filter(e => e.action === 'role.added' && e.timestamp in w).length
);
rolesAdded.reduce((a, b) => a + b) / rolesAdded.length
```

### Conversion & Funnel Metrics

**Applied → Screen Conversion Rate (%)**
```javascript
const applied = events.filter(e => e.action === 'role.applied').length;
const screened = events.filter(e => e.action === 'role.stageChanged')
  .filter(e => e.details.toStage === 'phone_screen').length;
(screened / applied * 100).toFixed(1)
```

**Screen → Interview Conversion Rate (%)**
```javascript
const screened = events.filter(e => e.action === 'role.stageChanged')
  .filter(e => e.details.toStage === 'phone_screen').length;
const interviewed = events.filter(e => e.action === 'interview.scheduled').length;
(interviewed / screened * 100).toFixed(1)
```

**Interview → Offer Conversion Rate (%)**
```javascript
const interviewed = events.filter(e => e.action === 'interview.completed').length;
const offers = events.filter(e => e.action === 'role.offerReceived').length;
(offers / interviewed * 100).toFixed(1)
```

**Feed Acceptance Rate (%)**
```javascript
const scored = events.filter(e => e.action === 'feed.scored').length;
const accepted = events.filter(e => e.action === 'feed.accepted').length;
(accepted / scored * 100).toFixed(1)
```

**Outreach Response Rate (%)**
```javascript
const sent = events.filter(e => e.action === 'outreach.sent').length;
const responded = events.filter(e => e.action === 'outreach.responseReceived').length;
(responded / sent * 100).toFixed(1)
```

**Outreach Conversion to Meeting (%)**
```javascript
const responded = events.filter(e => e.action === 'outreach.responseReceived').length;
const meetings = events.filter(e => e.action === 'outreach.ended')
  .filter(e => e.details.outcome === 'meeting').length;
(meetings / responded * 100).toFixed(1)
```

### Time-in-Stage Metrics

**Average Time in Phone Screen (days)**
```javascript
const transitions = events.filter(e => e.action === 'role.stageChanged')
  .filter(e => e.details.fromStage === 'phone_screen' && e.details.toStage !== 'phone_screen');

const times = transitions.map(t => {
  const entered = events.find(e =>
    e.action === 'role.stageChanged' &&
    e.details.toStage === 'phone_screen' &&
    e.resourceId === t.resourceId
  );
  return (t.timestamp - entered.timestamp) / 86400000;
});

(times.reduce((a, b) => a + b) / times.length).toFixed(1)
```

**Average Time in Onsite (days)**
```javascript
// Same pattern as above, filtering for toStage === 'onsite' and toStage !== 'onsite'
```

### Activity Metrics

**Debrief Loop Closure Rate (%)**
```javascript
const completed = events.filter(e => e.action === 'interview.completed').length;
const debriefs = events.filter(e => e.action === 'debrief.submitted').length;
(debriefs / completed * 100).toFixed(1)
```

**Resume Tailoring Rate (%)**
```javascript
const analyzed = events.filter(e => e.action === 'resume.analyzed').length;
const generated = events.filter(e => e.action === 'resume.generated').length;
(generated / analyzed * 100).toFixed(1)
```

**Brief Regeneration Rate (%)**
```javascript
const generated = events.filter(e => e.action === 'brief.generated').length;
const regenerated = events.filter(e => e.action === 'brief.regenerated').length;
(regenerated / generated * 100).toFixed(1)
```

**Offers Pending**
```javascript
events
  .filter(e => e.action === 'role.offerReceived')
  .filter(e => !events.find(x =>
    x.action === 'role.offerAccepted' &&
    x.resourceId === e.resourceId &&
    x.timestamp > e.timestamp
  )).length
```

**Offers Accepted (Lifetime)**
```javascript
events.filter(e => e.action === 'role.offerAccepted').length
```

## 5. Event Logging Pattern

### Shared Utility Function

Create `js/event-logger.js`:

```javascript
/**
 * Log a canonical event to pf_event_log
 * @param {string} action - verb like "role.added", "outreach.sent"
 * @param {string} resourceType - "role", "connection", "interview", etc.
 * @param {string} resourceId - unique id for the resource
 * @param {object} details - optional action-specific payload
 * @param {string} source - module name (auto-detected if not provided)
 */
export function logEvent(action, resourceType, resourceId, details = {}, source = null) {
  if (!source) {
    source = detectSourceModule();  // Use document.currentScript or module context
  }

  const event = {
    id: generateEventId(),
    timestamp: Date.now(),
    source,
    action,
    resourceType,
    resourceId,
    details,
    version: 1
  };

  // Write to localStorage
  const log = getEventLog();
  log.push(event);

  // Enforce 5000 event limit: remove oldest if needed
  if (log.length > 5000) {
    log.splice(0, log.length - 5000);
  }

  localStorage.setItem('pf_event_log', JSON.stringify(log));

  // Queue for MCP sync (debounced, 1 second)
  queueSyncToMCP(event);

  return event.id;
}

function generateEventId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 6);
  return `evt-${timestamp}-${random}`;
}

function getEventLog() {
  try {
    return JSON.parse(localStorage.getItem('pf_event_log') || '[]');
  } catch {
    return [];
  }
}

function detectSourceModule() {
  // Detect module from URL pathname or module context
  const path = window.location.pathname;
  if (path.includes('/pipeline')) return 'pipeline';
  if (path.includes('/outreach')) return 'outreach';
  if (path.includes('/feed')) return 'feed';
  if (path.includes('/interview')) return 'interview';
  if (path.includes('/resume')) return 'resume';
  // ... etc for all 11 modules
  return 'unknown';
}

const syncQueue = [];
let syncTimeout = null;

function queueSyncToMCP(event) {
  syncQueue.push(event);

  if (syncTimeout) clearTimeout(syncTimeout);

  syncTimeout = setTimeout(() => {
    if (syncQueue.length === 0) return;

    // Call MCP data-layer sync
    window.postMessage({
      type: 'SYNC_EVENT_LOG',
      events: syncQueue.splice(0)
    }, '*');
  }, 1000);
}
```

### Module Integration

Each module imports and calls `logEvent`:

```javascript
// pipeline/index.js
import { logEvent } from '../js/event-logger.js';

function addRole(companyName, jobTitle, url) {
  const roleId = generateRoleId();
  const role = { id: roleId, companyName, jobTitle, url, createdAt: Date.now() };

  // Store role
  storeRole(role);

  // Log event
  logEvent('role.added', 'role', roleId, {
    source: 'manual',
    companyName,
    jobTitle,
    url
  });
}

function moveRoleToStage(roleId, newStage) {
  const role = getRole(roleId);
  const oldStage = role.stage;
  role.stage = newStage;

  storeRole(role);

  logEvent('role.stageChanged', 'role', roleId, {
    fromStage: oldStage,
    toStage: newStage,
    movedAt: Date.now()
  });
}
```

### Storage & Retention

- **Primary storage**: `pf_event_log` in localStorage as JSON array
- **Backup**: IndexedDB `pf_event_log` object store (auto-synced, used if localStorage quota exceeded)
- **Retention policy**:
  - Keep 90 days of events in localStorage (oldest auto-purged when >5000 events)
  - Keep full year in IndexedDB for historical analysis
  - CSV export available for archival

### Data Layer Sync

`data-layer.js` listens for sync queue and pushes to MCP:

```javascript
window.addEventListener('message', (evt) => {
  if (evt.data.type === 'SYNC_EVENT_LOG') {
    const events = evt.data.events;

    // Call MCP endpoint or socket
    fetch('/api/events/batch', {
      method: 'POST',
      body: JSON.stringify({ events, timestamp: Date.now() })
    });
  }
});
```

## 6. Implementation Notes

### Design Principles

1. **Append-only**: Events are never modified or deleted (except by retention policy). This ensures audit trail integrity.
2. **Immutable IDs**: Once assigned, an event ID never changes. Use for deduplication if synced multiple times.
3. **Distributed clock**: Use client-side `Date.now()` for ordering. Events logged within the same millisecond are ordered by insertion order within `pf_event_log`.
4. **No PII in details**: Never log email addresses, phone numbers, or sensitive personal data in the `details` object. Log only business-relevant context (dates, counts, enums).

### Quality Assurance

- **Validation**: Each module validates action, resourceType, and resourceId before calling `logEvent()`. Invalid calls log to console but don't crash.
- **Testing**: Unit tests verify `logEvent()` writes to localStorage, correct event structure, and debounce behavior.
- **Monitoring**: Dashboard includes "Events logged this session" metric and "Last sync time" to verify data freshness.

### Dashboard Implementation

Dashboard queries events on load and on 5-second refresh:

```javascript
function computeMetrics() {
  const events = getEventLog();

  return {
    actionsThisWeek: computeActionsThisWeek(events),
    appliedToScreenConversion: computeConversion(events, 'applied', 'screened'),
    outreachResponseRate: computeOutreachResponse(events),
    offersAccepted: events.filter(e => e.action === 'role.offerAccepted').length,
    // ... etc
  };
}
```

### Export & External Analysis

CSV export includes columns: timestamp, source, action, resourceType, resourceId, details (JSON). Format allows import into analytics tools (Google Sheets, Tableau, etc.) for trend analysis, cohort reporting, and anomaly detection.

Example export:
```
timestamp,source,action,resourceType,resourceId,details
1710355200000,pipeline,role.added,role,role-abc-123,"{""source"":""manual"",""companyName"":""Acme Corp""}"
1710355205000,feed,feed.scored,role,role-abc-123,"{""score"":87,""factors"":""...""}"
1710355210000,pipeline,role.applied,role,role-abc-123,"{""channel"":""platform""}"
```

---

**Version**: 1.0
**Last Updated**: 2026-03-13
**Maintained by**: Pathfinder Architecture Team
