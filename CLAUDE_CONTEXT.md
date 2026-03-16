# Pathfinder — Session Context for Claude

**Read this file at the start of every new session.** It contains the rules, conventions, and current state needed to work on this project without losing context.

---

## What Is Pathfinder

Pathfinder is an agentic job search system with 11 standalone HTML modules sharing data via localStorage + IndexedDB. Each module is a single `index.html` file in `modules/`. There is no backend server required for core functionality — Claude API calls happen directly from the browser via `modules/shared/claude-api.js`.

**Current Version:** v3.34.1 (as of 2026-03-16)
**Last Major Features:** Job Feed Listener v3.34.0 (Company Knowledge Base, Adaptive Weighting, Score Transparency, Date Display Fix, Non-local Flags, Rejected Roles Tab, Dismiss Reason Modal); Research Brief v3.34.1 (Tavily removal, cowork sessions for live research). 781+ unit tests, 97.5%+ statement coverage across 11 shared modules.
**Status:** All 11 modules pass HTML integrity + brace balance + safeJsonParse coverage. Job Feed enhanced with company metadata, improved scoring transparency, and dismissed role tracking. Research Brief simplified with Tavily removal; cowork sessions recommended for live web research.

**Owner:** Ili Selinger (ilan.selinger@gmail.com)
**Repo:** github.com/selinger2211/pathfinder-job-search
**Local Path:** ~/Projects/job-search-agents-v2

---

## The 11 Modules

| Module | Path | Primary Function | Key localStorage Keys |
|--------|------|------------------|----------------------|
| Pipeline Tracker | `modules/pipeline/` | Data backbone — companies, roles, connections, kanban board | `pf_companies`, `pf_roles`, `pf_connections` |
| Dashboard | `modules/dashboard/` | Daily launcher — nudge engine, action queue, streak tracking | `pf_streak`, `pf_dismissed_nudges`, `pf_theme` |
| Job Feed Listener | `modules/job-feed-listener/` | Top-of-funnel — scoring engine (v3.34.0: Company Knowledge Base, Adaptive Weighting, Score Transparency), preference matching, dismissed role tracking | `pf_preferences`, `pf_feed_queue`, `pf_feed_runs`, `pf_feed_rejected` |
| Research Brief | `modules/research-brief/` | V3: 13-section pursuit strategy brief with training knowledge (EXT), cowork sessions for live research, additional context, 7 evidence labels, upgraded fit model, PDF export | `pf_anthropic_key`, `pf_claude_model` |
| Resume Builder | `modules/resume-tailor/` | JD analysis (Phase 1) + Claude resume generation (Phase 2) | `pf_bullet_bank`, `pf_resume_log` |
| Outreach | `modules/outreach/` | 8 message types via Claude (LinkedIn, email, thank you, etc.) | `pf_outreach_messages`, `pf_outreach_sequences` |
| Mock Interview | `modules/mock-interview/` | Multi-turn Claude sessions across 7 interview types | `pf_mock_sessions`, `pf_story_bank` |
| Debrief | `modules/debrief/` | 8-section post-interview capture + Claude synthesis | `pf_debriefs` |
| Comp Intelligence | `modules/comp-intel/` | Compensation data entry, comparison, negotiation strategy | `pf_comp_data` |
| Calendar | `modules/calendar/` | Manual event tracking, pre/post-interview nudges | `pf_calendar_events`, `pf_calendar_nudges` |
| Sync Hub | `modules/sync/` | Bridge external APIs (GCal, Indeed, Gmail, Clay) into Pathfinder + Data Backup/Restore | `pf_sync_log`, `pf_last_backup` (writes to other module keys) |
| Artifacts MCP | `mcp-servers/pathfinder-artifacts-mcp/` | File storage layer — research briefs, resumes, JDs | Filesystem (not localStorage) |

---

## PRD Locations

Every module has a standalone PRD in `docs/`:

- `docs/PRD.md` — Main system PRD (the master)
- `docs/pipeline-tracker-prd.md`
- `docs/dashboard-prd.md`
- `docs/job-feed-prd.md`
- `docs/research-brief-prd.md`
- `docs/resume-builder-prd.md`
- `docs/outreach-prd.md`
- `docs/mock-interview-prd.md`
- `docs/debrief-prd.md`
- `docs/comp-intelligence-prd.md`
- `docs/calendar-prd.md`
- `docs/artifacts-mcp-prd.md`
- `docs/sync-hub-prd.md` ← NEW (was missing, created v3.11)

### System-Level Policy Docs (added v3.11.0)

- `docs/ai-evaluation-framework.md` — Prompt versioning, model versioning, grounding requirements, hallucination taxonomy, acceptance thresholds, regression testing for all 5 Claude-powered modules
- `docs/instrumentation-event-taxonomy.md` — Canonical event schema, 33-event catalog, derived metrics formulas, `logEvent()` pattern
- `docs/architecture-decisions-and-invariants.md` — 6 ADRs (standalone HTML, localStorage, MCP, direct API, nav pattern, favicon API) + 10 system invariants
- `docs/domain-model-and-glossary.md` — Canonical definitions for "positioning" (3 meanings), "tier", "stage", "enrichment", "brief", "nudge", "artifact" + data ownership table + role lifecycle state machine
- `docs/integrations-and-compliance.md` — 13 external services with auth, rate limits, freshness policy, fallback behavior + compliance notes
- `docs/confidence-provenance-and-citation-policy.md` — 3-tier confidence system (High/Medium/Low), provenance tracking requirements, citation policy per AI module, staleness visual treatment
- `docs/testing-strategy.md` — Unit/integration/E2E approach, golden datasets for 5 AI modules, failure injection scenarios, performance benchmarks, execution schedule
- `docs/bugs-and-improvements.md` — Tracked backlog items
- `docs/documentation-review-v3.11.md` — Full docs audit with coverage scorecard

---

## Mandatory Rules

### 1. PRD Sync Rule (CRITICAL)
**Every code change must update:**
- The relevant component PRD (implementation phase checklist)
- The main PRD version number (`docs/PRD.md` → Status field)
- The main PRD version history table
- The CHANGELOG.md

No exceptions. This was established as a permanent rule in v1.5.0.

### 2. Version Convention
- Patch bump (1.x.Y) = bug fixes, minor tweaks
- Minor bump (1.X.0) = new features, module improvements
- Major bump (X.0.0) = architectural changes

### 3. Commit Convention
- Stack commits, user pushes manually
- Commit message format: `vX.Y.Z: Short description`
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Use HEREDOC for commit messages

### 4. Code Quality
- Well-commented, muggle-friendly (someone with no coding background should understand the comments)
- Every function has a comment explaining INPUT → OUTPUT
- Visual section separators in code (`/* ====== SECTION NAME ====== */`)
- "Trust but Verify" — all data traceable to source

### 5. File Storage Architecture
- **localStorage** — All structured data (roles, companies, preferences, sessions)
- **MCP data layer** — `modules/shared/data-layer.js` monkey-patches localStorage to sync `pf_*` keys to MCP HTTP bridge. 22 keys synced with 1-second debounce. Auto-recovery on startup if localStorage is empty. Graceful degradation when bridge is unavailable.
- **MCP data files** — `~/.pathfinder/data/{key}.json` — persistent key-value store via HTTP bridge endpoints (`PUT/GET/DELETE /data/:key`)
- **IndexedDB** (`pf_resumes` database) — Resume file blobs (PDF, DOCX, DOC)
- **MCP filesystem** — Research briefs, artifacts (text-based)
- **MCP backups** — `~/.pathfinder/backups/` — timestamped full snapshots (from v2.4.0)

### 6. Claude API Pattern
- All modules use `modules/shared/claude-api.js` for Claude API calls
- Direct browser-to-Anthropic API via `anthropic-dangerous-direct-browser-access` header
- API key stored in `pf_anthropic_key`
- Model stored in `pf_claude_model` (default: `claude-sonnet-4-20250514`)
- MCP HTTP bridge (localhost:3456) provides data sync + backup endpoints

### 8. No Git Worktree Isolation (MANDATORY)
**NEVER use `isolation: "worktree"` when launching agents on this repo.** Worktree agents create `.git/worktrees/` directories and lock files that the VM cannot clean up, requiring manual intervention from the user. Use in-process agents only. This rule was established after a v3.20.5 incident where a worktree agent introduced brace mismatches and created persistent lock files.

If git lock files appear: `find ~/Projects/job-search-agents-v2/.git -name "*.lock" -delete && find ~/Projects/job-search-agents-v2/.git/objects -name "tmp_obj_*" -delete`

### 9. Pre-Commit QA Gate (MANDATORY — DO NOT SKIP)
**Every commit MUST pass these steps IN ORDER. No exceptions. No "I'll do it later."**

This rule was added after v3.31.0 shipped with 3 dead function references that the regression test would have caught — because it was never run.

**One-liner (run this, or run `bash scripts/pre-commit-qa.sh`):**
```bash
node scripts/workflow-regression.js && node scripts/interactive-qa.js
```
If either exits non-zero, STOP. Fix all failures. Re-run until clean. Do not commit with failures.

**What each test does:**
- `workflow-regression.js` — Static analysis: dead function calls, broken IDs, missing imports, cross-module data contracts
- `interactive-qa.js` — Headless DOM testing via jsdom: simulates clicks, tab switches, form interactions, localStorage persistence, checks for display:none file inputs, verifies new UI elements exist and old ones are removed

**Additional manual steps:**
- If any functions were deleted/renamed, update `REMOVED_FUNCTIONS` in `scripts/workflow-regression.js`
- `git diff --stat` to verify expected files changed
- Version bumped in PRD + CHANGELOG + CLAUDE_CONTEXT.md

**On Ili's Mac:** The `.git/hooks/pre-commit` hook runs both tests automatically before every `git commit`. No manual step needed.

**In Cowork VM:** The FUSE commit workaround bypasses hooks, so Claude MUST run `bash scripts/pre-commit-qa.sh` before creating any commit. No exceptions.

**Real browser QA (when Chrome MCP is available):**
If the user has `python3 -m http.server 8765` running in `~/Projects/job-search-agents-v2`, Claude can run full browser QA via the Chrome MCP tools:
1. Navigate to `http://localhost:8765/modules/{module}/index.html` in Chrome
2. Take screenshots, click buttons, check console errors, verify DOM state via JS
3. Test the specific workflows that changed (tab switches, file uploads, form submits, modal open/close)
4. This supplements headless QA — it catches visual/CSS bugs that jsdom cannot

### 9. safeJsonParse Pattern (MANDATORY)
All localStorage reads MUST use the `safeJsonParse()` helper (defined in every module's script block). Never use bare `JSON.parse(localStorage.getItem(...))`. The pattern:
```javascript
function safeJsonParse(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`[Pathfinder] Corrupt localStorage key "${key}", using fallback`, e);
    return fallback;
  }
}
```
Usage: `safeJsonParse('pf_roles', [])` instead of `JSON.parse(localStorage.getItem('pf_roles') || '[]')`.

### 7. Company Logo Pattern (MANDATORY)
Any module showing company logos MUST import `modules/shared/logos.js` — do NOT copy logo functions inline. This was extracted in v3.30.0 after the logo system regressed 4+ times from copy-paste drift.

**Source of truth:** `modules/shared/logos.js` (v3.30.0)
**Import:** `<script src="../shared/logos.js?v=3.30.0"></script>` (before your main `<script>` block)
**Available functions:** `DOMAIN_OVERRIDES`, `getCompanyDomain(name, url)`, `getCompanyLogoUrl(name, url)`, `getCompanyColor(name)`, `handleLogoError(img, name, cssClass)`, `companyLogoHtml(name, cssClass, url)`, `guessDomain(name)`
**To add a new domain override:** Edit `DOMAIN_OVERRIDES` in `logos.js` — one change, all modules get it.
**Regression check:** `scripts/regression-check.sh` fails if any module has inline DOMAIN_OVERRIDES or getCompanyDomain.
**CSS:** `.card-logo` (container) + `.card-logo-fallback` (letter circle) in `pathfinder.css`

---

## Data Contracts (Shared Object Shapes)

These are the actual field shapes for objects stored in shared localStorage keys. **Check this section before writing any code that reads from these keys.** This prevents the most common cross-module bug: assuming fields exist that don't.

### pf_companies — Company[]

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| **name** | string | **YES** | **Primary identifier — use this for all lookups. There is NO `id` field.** |
| domain | string | yes | e.g., "stripe.com" — used for logo URLs |
| tier | string | no | "hot" / "active" / "watching" |
| missionStatement | string | no | Company mission/description |
| headcount | string | no | e.g., "1000-5000" |
| fundingStage | string | no | e.g., "Series C" |
| remotePolicy | string | no | e.g., "hybrid" |
| url | string | no | Company website URL |
| logoUrl | string | no | Google Favicon URL |
| enrichmentStatus | string | no | "enriched" / "pending" / null |
| dateAdded | string | no | ISO date |
| notes | string | no | Personal only — from migration |
| enrichmentPercent | number | no | 0-100, for Rule 13 sparse nudge detection (v3.12.0) |

### pf_roles — Role[]

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Format: "role-{timestamp}" |
| **company** | string | **YES** | **Company NAME (string match to company.name). There is NO `companyId` field.** |
| title | string | yes | Job title |
| url | string | no | Job posting URL |
| jdText | string | no | Full job description text |
| positioning | string | no | Why the user is a good fit |
| targetLevel | string | no | e.g., "senior", "staff" |
| source | string | no | e.g., "linkedin", "referral" |
| stage | string | no | Pipeline stage: "saved" / "applied" / "interviewing" / "offer" / "rejected" / "outreach" |
| stageHistory | array | no | Array of {stage, date} transitions |
| salary | object | no | {min, max, currency} |
| dateAdded | string | no | ISO date |
| lastActivity | string | no | ISO date |
| connections | array | no | Array of connection names linked to this role |
| tier | string | no | Inherited from company tier |
| resumesSent | array | no | Legacy: array of {filename, size, type, date, notes, indexedDbKey} |
| artifacts | array | no | New (v2.5.0): array of {type, filename, size, date, notes, url?, indexedDbKey?}. Types: "resume", "research_brief", "document" |
| commsLog | array | no | Array of {date, note, link, channel, contactId, contactName} |

### pf_connections — Connection[]

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Format: "conn-{timestamp}" (manual) or "conn-001" (migration) |
| **name** | string | **YES** | **Primary display field. Use `name` for dropdown values and lookups.** |
| company | string | yes | Company NAME (string match) |
| title | string | no | Job title at the company |
| linkedinUrl | string | no | Full LinkedIn profile URL |
| relationship | string | no | "hiring-manager" / "recruiter" / "peer" / "referral" / etc. |
| notes | string | no | Free-text notes |
| linkedRoles | array | no | Role IDs this connection is linked to |
| outreachLog | array | no | Array of outreach entries |
| referralStatus | string | no | "none" / "requested" / "received" |
| source | string | no | "manual" / "migration" |
| scores | object | no | Personal only — {aiRelevance, hiringInfluence, warmth, strategicLeverage, responseLikelihood} |
| totalScore | number | no | Personal only — sum of scores |
| tier | string | no | Personal only — "hot" / "warm" / "cold" |
| tierLabel | string | no | Personal only — "A+" / "A" / "B" etc. |
| outreachStatus | string | no | "none" / "sent" / "replied" |
| outreachChannel | string | no | "linkedin" / "email" |
| lastOutreachDate | string | no | ISO date |
| connectionDegree | string | no | "1st" / "2nd" |
| seniority | string | no | "SVP" / "Director" / etc. |

### pf_linkedin_network — LinkedInConnection[]

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| firstName | string | yes | First name from LinkedIn |
| lastName | string | yes | Last name from LinkedIn |
| name | string | yes | Combined "First Last" |
| linkedinUrl | string | no | Full LinkedIn profile URL |
| email | string | no | Email if available (rare) |
| company | string | yes | Current company (normalized) |
| position | string | no | Current job title |
| connectedOn | string | no | ISO date string (YYYY-MM-DD) |

**Source:** Parsed from LinkedIn data export via `scripts/parse-linkedin-connections.py`. ~2,687 records. Auto-loaded into localStorage from `scripts/migration-output/pf_linkedin_network.json` on first Pipeline visit. Used as lookup layer only — not editable. Use `pf_connections` for tracked/curated connections.

### pf_nudge_log — NudgeLogEntry[] (v3.12.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Unique identifier (uuid) |
| ruleId | string | yes | Which nudge rule fired (e.g., "rule_7_sparse_company") |
| roleId | string | yes | Target role for this nudge |
| firedAt | string | yes | ISO timestamp when nudge was triggered |
| dismissed | boolean | yes | True if user dismissed without acting |
| dismissedAt | string | no | ISO timestamp of dismissal |
| reason | string | no | User's dismissal reason (if provided) |
| acted | boolean | yes | True if user took the suggested action |
| actsAt | string | no | ISO timestamp of action |

**Purpose:** Audit trail for nudge effectiveness analytics. Dashboard can calculate fired vs dismissed vs acted ratios per rule.

### pf_nudge_prefs — NudgePreferences (v3.12.0)

Object with boolean flags per nudge rule:

```typescript
{
  rule_1_stale_discovered: true,
  rule_2_stale_researching: true,
  rule_3_applied_no_response: true,
  rule_4_interview_prep: true,
  rule_5_offer_pending: true,
  rule_6_outreach_follow_up: true,
  rule_7_sparse_company: true,
  rule_8_interview_prep_not_started: true,
  rule_9_take_home_due: true,
  rule_10_offer_deadline: true,
  rule_11_interview_today: true,
  rule_12_weekly_summary: true,
  rule_13_new_feed_matches: true
}
```

**Purpose:** User preferences for nudge rule enablement. Toggled in Dashboard sidebar. False = rule disabled (no nudges for that rule).

### pf_feed_run_log — FeedRunEntry[] (v3.12.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Unique identifier (uuid) |
| runAt | string | yes | ISO timestamp of feed scan |
| itemsFound | number | yes | Total roles discovered in this run |
| itemsAccepted | number | yes | Roles added to Pipeline |
| itemsDismissed | number | yes | Roles dismissed/archived |
| averageScore | number | yes | Mean match score for discovered items (0-100) |
| durationMs | number | yes | How long the run took (milliseconds) |
| source | string | yes | "gmail" / "indeed" / "manual" / "career_page" |

**Purpose:** Feed analytics. Header displays summary. Enables future Feed dashboard showing source ROI, volume trends, conversion rates.

### pf_calendar_dismissed_nudges — CalendarDismissal[] (v3.12.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| nudgeId | string | yes | ID of dismissed nudge |
| eventId | string | yes | Calendar event ID this nudge relates to |
| dismissedAt | string | yes | ISO timestamp |
| reEligibleAt | string | yes | ISO timestamp when nudge can resurface (dismissedAt + 24h) |

**Purpose:** Track nudge dismissals so they don't immediately resurface. After reEligibleAt passes, nudge can fire again.

### pf_nudge_suppressions — SuppressionChain[] (v3.14.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Unique identifier (uuid) |
| ruleId | string | yes | Primary rule that was dismissed (e.g., "rule_4_interview_prep") |
| roleId | string | yes | Target role for this suppression chain |
| suppressedRuleIds | array | yes | Array of related rules to suppress (e.g., ["rule_8_interview_prep_not_started"]) |
| suppressedAt | string | yes | ISO timestamp when suppression activated |
| expiresAt | string | yes | ISO timestamp when suppression expires (7d/3d/24h based on rule) |
| dismissalReason | string | no | Optional reason user provided when dismissing |

**Purpose:** Auto-suppress related nudges when user dismisses primary nudge. Dismissing "Prep for interview at {company}" suppresses "Generate research brief for {company}" for duration. Prevents nudge fatigue for interconnected actions on same role.

### pf_brief_invalidation — BriefInvalidation (v3.13.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| roleId | string | yes | Role whose brief is stale |
| invalidatedSections | number[] | yes | Section numbers (0-13) that need regeneration |
| reason | string | yes | "debrief_completed" / "jd_updated" / "positioning_changed" / "manual" |
| timestamp | string | yes | ISO timestamp when invalidation fired |

**Purpose:** Signal from Debrief Agent to Research Brief that cached sections are stale and need regeneration. Brief checks this on load and displays "Regenerate Stale Sections" button.

### pf_feed_snoozed — FeedSnoozed[] (v3.13.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| feedItemId | string | yes | ID of snoozed feed item |
| snoozedAt | string | yes | ISO timestamp |
| reAppearAt | string | yes | ISO timestamp when item resurfaces (typically 7 days later) |

**Purpose:** Track snoozed job feed items (via Feed Review "Snooze" button) so they don't clutter the review queue until the snooze period expires.

### pf_feed_dismissed — FeedDismissed[] (v3.13.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| feedItemId | string | yes | ID of dismissed feed item |
| dismissedAt | string | yes | ISO timestamp |
| reason | string | no | "not_interested" / "duplicate" / "wrong_level" / etc. |

**Purpose:** Track permanently dismissed feed items so they don't reappear in future feed runs.

### pf_mock_calibrated_questions — CalbratedQuestions (v3.13.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| roleId | string | yes | Target role ID |
| interviewType | string | yes | "behavioral" / "product_strategy" / "design" / etc. |
| questions | Question[] | yes | Array of JD-calibrated questions |
| generatedAt | string | yes | ISO timestamp |
| expiresAt | string | yes | ISO timestamp (1 week TTL) |

**Purpose:** Cache JD-calibrated questions per role+type so they're reusable across multiple mock sessions without regenerating via Claude every time.

### pf_outreach_nav_state — OutreachNavState (v3.13.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| selectedTab | string | yes | "compose" / "history" / "drafts" |
| selectedRoleId | string | no | Currently selected role (if in compose tab) |
| selectedMessageType | string | no | Currently selected message type (if in compose) |
| draftId | string | no | Current draft ID being edited |
| lastVisitedAt | string | yes | ISO timestamp for UX continuity |

**Purpose:** Preserve Outreach module navigation state across page reloads so users don't lose context when switching modules and returning.

### pf_brief_section_collapse — BriefSectionCollapse (v3.16.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| roleId | string | yes | Role whose brief section state is stored |
| collapsedSections | number[] | yes | Array of section numbers (0-13) that user has collapsed |
| stickyNavOpen | boolean | yes | Whether sticky sidebar is currently open (v3.16.0) |
| lastUpdated | string | yes | ISO timestamp of last collapse/expand change |

**Purpose:** Track which brief sections user has collapsed/expanded so state persists across page reloads (v3.16.0). Sticky sidebar toggle state also preserved.

### pf_section_meta_* — SectionMeta (v3.16.0)

Format: `pf_section_meta_{companySlug}_{roleId}_{sectionNum}`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| sectionNum | number | yes | Section number (0-13) |
| freshAt | string | yes | ISO timestamp when this section was last generated |
| sourceHash | string | yes | SHA-256 hash of input sources (JD, company data, bullets, etc.) |
| isFresh | boolean | yes | True if inputs haven't changed since generation |
| isStale | boolean | yes | True if cross-module invalidation signal fired |
| staleDueToSources | string[] | yes | Which source types changed: "jd", "company", "bullets", "comp", "debrief" (v3.16.0) |
| refreshButtonVisible | boolean | yes | True if user should see "Refresh" button for this section (stale or error) |

**Purpose:** Track section-level staleness with source hashing so brief knows which sections to regenerate (v3.16.0 #51). "Smart regeneration" only refreshes stale sections, preserving fresh ones.

### pf_research_briefs — ResearchBrief[] (v3.16.0)

MCP-backed artifact persistence (SQLite table). Queried via MCP tools: `pf_save_brief`, `pf_get_brief`, `pf_list_briefs`, `pf_compare_briefs`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Unique artifact ID (uuid) |
| roleId | string | yes | Target role ID |
| company | string | yes | Company name (for filtering) |
| roleTitle | string | yes | Role title |
| generatedAt | string | yes | ISO timestamp when brief was created |
| sections | BriefSection[] | yes | Array of generated sections (0-13) with content, citations, metadata |
| inputsMissing | string[] | no | Which data inputs were unavailable during generation |
| sectionsGenerated | number | yes | How many of 14 sections succeeded |
| tags | string[] | yes | [company, roleId, "complete"/"degraded", dateString] for filtering |
| metadata | object | yes | {sectionsGenerated, inputsMissing: [], generatedAt: ISO} |
| sourceUrl | string | no | Original posting URL if imported |
| status | string | yes | "complete" / "degraded" / "draft" |

**Purpose:** Server-side persistence of research briefs via MCP (v3.16.0 #28). Enables "Save to Server" button and "Brief History" dropdown. Each generation is a new version; never overwritten. Compare tool supports side-by-side diff.

### pf_gmail_token — GmailAuth (v3.17.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| accessToken | string | yes | OAuth access token for Gmail API |
| tokenType | string | yes | "Bearer" |
| expiresAt | string | yes | ISO timestamp when token expires |
| refreshToken | string | no | Refresh token for re-authorization |
| scope | string | yes | "https://www.googleapis.com/auth/gmail.readonly" |

**Purpose:** Store OAuth credentials for Gmail API access (v3.17.0 #40). Job Feed uses this to authenticate Gmail API calls for email scanning. Token managed via UI; auto-refresh when expired.

### pf_career_pages — CareerPageConfig[] (v3.17.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Unique identifier (uuid) |
| company | string | yes | Reference to Company.id |
| url | string | yes | Career page URL (e.g., https://stripe.com/jobs) |
| atsType | string | yes | "greenhouse" \| "lever" \| "ashby" \| "generic" |
| lastCheckAt | string | no | ISO timestamp of last crawl |
| checkFrequency | string | yes | "3x_week" \| "weekly" \| "monthly" \| "manual" |
| enabled | boolean | yes | Whether to include in auto-checks |
| notes | string | no | User notes about this page |

**Purpose:** Configuration for career page monitoring (v3.17.0 #41). Stores URLs and check cadence per company. Used by Job Feed scheduler to determine check frequency based on company tier.

### pf_career_page_cache — CareerPageCache (v3.17.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| companyId | string | yes | Reference to Company.id |
| url | string | yes | Career page URL |
| lastCrawledAt | string | yes | ISO timestamp |
| jobListings | JobListing[] | yes | Array of detected jobs at time of crawl |

**JobListing:**
| Field | Type | Notes |
|-------|------|-------|
| id | string | Listing ID from ATS or generated hash |
| title | string | Job title |
| url | string | Job posting URL |
| postedAt | string | ISO timestamp |
| department | string | Department or team |

**Purpose:** Cache of job listings from last career page crawl (v3.17.0 #41). Used for new job detection — comparing current crawl against cached listings identifies new roles. Cache busted on each crawl.

### pf_interviewer_reputation — InterviewerReputation[] (v3.18.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Unique identifier (uuid) |
| email | string | yes | Interviewer email address (primary identifier) |
| name | string | no | Interviewer name (cached from calendar) |
| company | string | yes | Company where interview took place |
| encounterCount | number | yes | Total times interviewed by this person |
| averageRating | number | no | 1-5 rating from debriefs (null if no ratings) |
| nextRoundRate | number | yes | Percentage of interviews with this person leading to next round (0-100) |
| questionTypes | string[] | yes | Array of interview question types they typically ask (e.g., "behavioral", "product_strategy") |
| lastInterviewAt | string | yes | ISO timestamp of most recent interview with this person |
| interviewIds | string[] | yes | Array of interview round IDs from calendar |
| notes | string | no | User notes about this interviewer |

**Purpose:** Builds interviewer reputation profile for Phase 4 intelligence (v3.18.0 #53). Used to power reputation scoring in Intelligence tab, predict interview outcomes, and surface patterns like "Jane Smith leads to next round 75% of the time" or "This interviewer focuses on system design questions."

### pf_interview_intelligence — InterviewIntelligence (v3.18.0)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | Unique identifier (uuid) |
| roleId | string | yes | Reference to Role.id |
| interviewType | string | yes | Type of interview (e.g., "phone_screen", "technical") |
| outcome | string | yes | "advanced" / "rejected" / "no_response" |
| completedAt | string | yes | ISO timestamp when interview happened |
| debrief | string | no | Reference to debrief ID if exists |
| dayOfWeek | number | yes | 0-6 (Monday=0, Sunday=6) |
| hourOfDay | number | yes | 0-23 |
| interviewerEmail | string | yes | Email of interviewer(s) |
| prepLevel | string | yes | "minimal" / "standard" / "thorough" (inferred from debrief) |
| companyTier | string | yes | Company tier at time of interview |

**Purpose:** Normalized interview event data for Pattern Analysis (v3.18.0 #53). Used to identify patterns like "Better outcomes with Manager interviews on Tuesdays" or "Technical rounds have 60% pass rate at Tier 1 companies."

---

## Current State (Update This After Major Changes)

**Current Version:** v3.20.6
**Last Updated:** 2026-03-14
**Status:** ROADMAP COMPLETE — All 53 planned features implemented. Full QA pass completed v3.20.5-6: safeJsonParse hardening (9 modules, 90 replacements), resume-tailor nav bar restored, pipeline Sync Hub link fixed, brace mismatches fixed in job-feed-listener and comp-intel.

---

## MCP Tools Summary (v3.16.0)

The MCP server at `mcp-servers/pathfinder-artifacts-mcp/` provides the following tools for module use:

| Tool | Parameters | Returns | Module Uses | Status |
|------|-----------|---------|-------------|--------|
| **pf_save_brief** | `{roleId, company, roleTitle, sections, metadata}` | `{id, savedAt}` | Research Brief | Implemented v3.16.0 (#28) |
| **pf_get_brief** | `{id}` | `ResearchBrief` | Research Brief | Implemented v3.16.0 (#28) |
| **pf_list_briefs** | `{company?, roleId?, limit?, offset?}` | `ResearchBrief[]` | Research Brief | Implemented v3.16.0 (#28) |
| **pf_compare_briefs** | `{id1, id2}` | `{diff, changes, metadata}` | Research Brief | Implemented v3.16.0 (#28) |
| **pf_search_feed** | `{minScore?, maxResults?, company?, sources?}` | `FeedItem[]` | Job Feed | Implemented v3.16.0 (#35) |
| **pf_get_role** | `{feedItemId}` | `FeedItem` | Job Feed | Implemented v3.16.0 (#35) |
| **pf_generate_brief_section** | `{sectionNum, company, role, jdText, context}` | `{sectionContent, citations}` | Research Brief | Implemented v3.16.0 (#36) |
| **pf_generate_bullets** | `{roleId, companySlug, jdAnalysis, bulletBank, preferences}` | `{bullets, newProposals, gapAnalysis}` | Resume Builder | Implemented v3.16.0 (#49) |
| **pf_export_resume** | `{roleId, format, resumeData}` | `{url, filename, format}` | Resume Builder | Implemented v3.16.0 (#49) |

---

### Implementation Status

| Module | % Complete | What Works | What's Missing (External APIs) |
|--------|-----------|------------|-------------------------------|
| Pipeline | ~100% | Kanban, CRUD, drag-drop, IndexedDB resume, comms log, URL import, CSV export, company view, fit assessment, keyboard shortcuts, **Clay enrichment display**, **enrichment badges**, **stage analytics + funnel chart**, **stale role detection (14d)**, **Google Favicon logos**, **collapsible comms log**, **Artifacts section (replaces Resume Sent)**, **Research Brief trigger button**, **default score sort + Score column**, **clickable company names + descriptions** | — |
| Dashboard | ~100% | 12-rule nudge engine, streak, action queue, feed review, interview intelligence, pipeline funnel, activity feed, weekly stats, real-time storage listener, **GCal card (next 3 events + countdown)**, **sync status indicator**, **quick actions row**, **debrief pending badge**, **outreach queue indicator**, **smart outreach nudges (comms-aware + mutual connections)** | — |
| Job Feed | ~100% | Scoring engine, preference editor, manual entry, dedup, quick-check filter, auto-pipeline, analytics, snooze, career page URL import, Sources tab, **error handling, a11y, visual polish**, **free direct JD enrichment (CORS proxy + ATS APIs + web search)**, **auto-enrich on page load**, **nav reorder**, **JD detail sidebar panel**, **clickable company names**, **improved comp labeling** | — |
| Research Brief | ~100% | Claude API, 14 section prompts, caching, citation system, localStorage artifact save, saved briefs panel, **error handling, a11y, visual polish**, **URL param deep-linking (`?roleId=X`)**, **auto-generate on first visit**, **brief attached to pipeline roles** | — |
| Resume Builder | ~100% | Phase 1 JD analysis, Phase 2 streaming, cover letter, bullet bank, keyword gap, version history, DOCX/PDF export, **error handling, a11y, export validation** | — |
| Outreach | ~100% | 8 message types, sequence scheduling, response tracking, templates, history/analytics, Gmail integration, Draft Queue, **email validation, a11y, error handling** | — |
| Mock Interview | ~100% | Multi-turn Claude, 7 types, 100+ question bank (11 companies), session playback, performance trends, custom questions, practice tracking, company-calibrated sessions, **a11y, error handling, input sanitization** | — |
| Debrief | ~100% | 8-section form, Claude synthesis, pattern analysis, timeline, export, Calendar auto-populate, pending events section, cross-module sync, **form validation, a11y, keyboard nav** | — |
| Comp Intel | ~100% | Data entry, comparison, Claude negotiation, charts, scorecard, Indeed salary, bulk import, market positioning, BATNA, **salary validation, a11y, error handling** | — |
| Calendar | ~100% | Week/month/day views, nudges, event-role linking, auto-trigger debrief, pending debrief badge, **date validation, a11y, keyboard nav, visual polish** | — |
| Sync Hub | ~100% | GCal sync, Indeed sync, Gmail sync (leads + applications), Clay placeholder, file upload, dedup, sync log, **outreach draft push**, **richer Gmail parsing (InMail/scheduling/rejection/offer)**, **data freshness indicators**, **sync stats dashboard**, **scheduling UI + auto-sync toggle**, **export sync log**, **auto-backup after Sync All** | — |
| MCP Server | ~95% | **All 9 tools fully implemented** (save, get, list, search, tag, delete, generate-brief, **backup-pipeline**, **restore-pipeline**), **enhanced storage (SHA-256, excerpts, relevance search)**, **soft/hard delete**, HTTP bridge with backup/restore endpoints, **comprehensive README + implementation status docs** | Build on Mac (`npm run build`), end-to-end testing |

### Known Issues
- MCP server TypeScript build requires a real machine (OOMs in lightweight VMs). Start with: `cd mcp-servers/pathfinder-artifacts-mcp && npm run build && node dist/index.js`
- JD enrichment: roles without LinkedIn URLs or ATS links rely on DuckDuckGo web search fallback — coverage is good but not 100%
- CORS proxy 1 (allorigins.win) tends to timeout; proxy 2 (corsproxy.io) works reliably as fallback
- Research Brief stage dropdown missing "outreach" stage (Amazon Ads role has stage "outreach" which isn't in the stage list)
- Git lock files: if commits fail with "index.lock exists", run: `find ~/Projects/job-search-agents-v2/.git -name "*.lock" -delete`

### Recently Fixed (v3.29.0)
- **Clearbit Logo API dead** → Resolved. Switched to Google Favicon API across 6 files. Logos load reliably with letter-initial colored circles as fallback.
- **Pipeline analytics 300% conversion** → Resolved. Formula fixed for accurate conversion rate calculations.
- **Research Brief API error fallback** → Resolved. Re-throws all API errors for proper debugging instead of silently failing.

### Recently Fixed (v3.20.5-6) — QA Pass
- **Resume Builder nav bar**: Was completely missing — users got trapped in the module. Added full 11-module nav bar with Resume tab marked active.
- **Pipeline Sync Hub link**: Was pointing to `../sync-hub/` (wrong) — fixed to `../sync/`.
- **safeJsonParse hardening**: Added `safeJsonParse()` helper to 9 modules (90 replacements). Protects against corrupt localStorage crashing modules.
- **Cache-bust params**: Added `?v=3.5.1` to Resume Builder's shared CSS/JS imports.
- **Brace mismatches**: Fixed duplicate closing brace in job-feed-listener and missing closing brace in comp-intel (introduced by worktree agent copy).

### Recently Fixed (v3.16.0)
- **Research Brief Smart Caching Phase 2**: Cross-module invalidation signals from Pipeline, Company, Comp, Debrief. Section-level staleness tracking with source hashing. Smart regeneration only refreshes stale sections. New `pf_section_meta_*` and `pf_brief_section_collapse` localStorage keys. (#51)
- **Research Brief Phase 4 Polish**: Enhanced citation popovers with URL, date, trust level, refresh button. Improved progress bar showing section names and ETA. Keyboard shortcuts (G/E/R/Esc/arrows). Sticky section navigation sidebar (200px left). (#52)
- **Research Brief MCP Artifact Persistence**: `pf_save_brief`, `pf_get_brief`, `pf_list_briefs`, `pf_compare_briefs` tools. SQLite research_briefs table. "Save to Server" button and "Brief History" dropdown in UI. (#28)
- **Job Feed MCP Tool Integration**: `pf_search_feed` and `pf_get_role` tools. MCP status indicator (green/gray dot) in feed header. (#35)
- **MCP Server Brief Section Generation**: New `pf_generate_brief_section` tool for server-side brief section generation via Claude API. (#36)
- **Resume Builder MCP-Powered Generation**: `pf_generate_bullets` and `pf_export_resume` tools. MCP Generate toggle and "Export via MCP" button in UI. (#49)
- **New localStorage Keys**: `pf_section_meta_{companySlug}_{roleId}_{sectionNum}`, `pf_brief_section_collapse`, `pf_research_briefs` (MCP-backed).

### Recently Fixed (v3.15.0)
- **Outreach Debrief-Aware Drafting**: When generating interview thank-you messages, system injects context from interview debrief with specific discussion points and themes. Message quality scorer rates 1-10 with breakdown. Edit sidebar (320px) with tone/length selectors and regenerate button.
- **Outreach Response Rate Analytics**: After 10+ sent messages, surfaces analytics by message type/channel with optimal timing suggestions and A/B insights based on response patterns.
- **Debrief Pattern Analysis**: After 10+ debriefs, system detects patterns (question types, themes, sentiment) and generates intelligence dashboard with charts and recommendations. Cross-module signal `pf_debrief_patterns` feeds Dashboard, Research Brief, Mock Interview.
- **Comp Intelligence Negotiation Support**: Negotiation scorecard with 5-dimension radar chart, 4-step counter-offer wizard with Claude, equity valuation calculator (funding stage → share value estimates), multi-offer comparison table with color-coded percentiles.
- **Calendar Phase 2 & 3**: Full nudge display with company logos + prep checklists, manual event-to-role linking UI, post-event detection triggering debrief capture, stage progression suggestions, follow-up queue with badge count, interview journey timeline view showing all rounds per role.
- **New localStorage Keys**: `pf_outreach_analytics`, `pf_counter_offers`, `pf_calendar_prep_checklists`, `pf_calendar_manual_links`, `pf_debrief_patterns`, `pf_outreach_edit_state`.

### Recently Fixed (v3.14.0)
- **Dashboard Suppression Chains**: Dismissing nudge auto-suppresses related nudges (7d/3d/24h rules), stored in `pf_nudge_suppressions` localStorage.
- **Dashboard Interview Intelligence Card**: Pattern analysis after 5+ debriefs showing question types, pass rates, strongest areas.
- **Job Feed Tier Management Suggestions**: Auto-suggest company tier promotion/demotion based on activity with "Update Tier" button.
- **Job Feed Feed Analytics**: New analytics tab showing match accuracy, false positive rate, score distribution, acceptance trends, top sources.
- **Pipeline Opaque Recruiter Outreach**: "Quick Add Recruiter Outreach" for unknown company/role, dashed-border cards with "Reveal Details" button.
- **Research Brief Degraded Mode**: Handles company-unknown, role-unknown, no-JD scenarios with placeholders and degraded banners.

### Recently Fixed (v3.13.0)
- **Dashboard Feed Review Section**: Top 5 unreviewed feed items with Accept/Snooze/Dismiss buttons.
- **Outreach Thank You (Interview)**: New message type pulling debrief data for personalized thank-yous per interviewer.
- **Outreach InMail**: LinkedIn InMail with 200/1900 character limits, preview mode, shared connections display.
- **Debrief Next Steps Panel**: "Refresh Research Brief" + "Draft Thank-You" action cards, writes `pf_brief_invalidation` signal, updates `role.lastDebriefAt`.
- **Research Brief Auto Cache Invalidation**: Checks `pf_brief_invalidation` on load, displays stale section banners, "Regenerate Stale Sections" button.
- **Research Brief Export Formats**: HTML and Markdown export alongside PDF, dropdown menu.
- **Calendar Confidence Scoring Algorithm**: 0-100 score with auto-match at 70+, suggestion buttons 40-69.
- **Calendar Interviewer Linking**: Match attendees to connections/LinkedIn network, seniority badges.
- **Job Feed Automatic Dedup**: Exact + fuzzy matching vs pipeline, "In Pipeline" and "Possible Duplicate" badges.
- **Pipeline Interview & Offer Substages**: Phone Screen/Technical/Onsite/Final Round/Team Match for interviews; Verbal/Written/Negotiating/Accepted/Declined for offers.
- **Mock Interview Intelligence & Calibration**: JD-calibrated questions cached per role+type, post-session summary, analytics tab.
- **Comp Intelligence Positioning Intelligence**: IC vs Director comparison, cross-company table, percentile position.
- **Comp Intelligence Advanced Analytics**: Comp by funding stage chart, comp by tier chart, stats cards.
- **Resume Builder Feedback Loops**: Keyword gap analysis, Claude-generated bullet suggestions, "Add to Bullet Bank" buttons.

### Recently Fixed (v3.12.0)
- **Dashboard Conversion Funnel**: Stage-to-stage conversion rates bar chart after 10+ closed roles.
- **Dashboard Average Time-in-Stage**: Median days per stage table calculated from stageHistory.
- **Company Profile Sparse Nudge**: Rule 13 fires when company <50% enriched.
- **Nudge Deduplication UI**: Groups by roleId, shows highest-priority, "+" expander for additionals.
- **Nudge Logging**: All nudges logged to `pf_nudge_log` (generated/dismissed/acted).
- **Per-Rule Nudge Preferences**: Sidebar toggles for all 13 rules, stored in `pf_nudge_prefs`.
- **Research Brief Citations**: Clickable [n] popovers with source/date/trust info.
- **Section Status Badges**: Fresh/Cached/Stale/Error/Generating pills per section.
- **Generation Progress Bar**: Real-time "Generating section 3/13..." indicator.
- **Keyboard Shortcut G**: Press G to generate brief.
- **Pipeline Stage Transition Reasons**: Optional reason chips saved to stageHistory.
- **Company Web Search**: DuckDuckGo instant answer suggestions on company name input.
- **Feed Run Logging**: Stats logged to `pf_feed_run_log` in header.
- **Calendar Nudge Timing**: 72h/48h/morning-of/post-interview with countdowns.

### Recently Fixed (v3.9.0)
- **Research Brief auto-generation + PDF persistence**: Briefs auto-generate on first visit (no manual "Generate" click needed). Cached briefs persist until explicit regeneration. After generation, a PDF is auto-rendered via `html2pdf.js` and stored in IndexedDB (`brief-{roleId}` key in `pf_resumes` DB). The role's `artifacts[]` entry has an `indexedDbKey` so Pipeline shows preview/download buttons for the PDF. Brief metadata (`briefArtifactId`, `briefGeneratedAt`) attached to pipeline roles. Generate button becomes "Regenerate" when brief exists. Pipeline sidebar shows "View Research Brief" when brief exists. "Clear Cache" renamed to "Clear & Regenerate" and auto-triggers fresh generation.
- **Pipeline comms dropdown**: Per-contact channel dropdown now shows text labels ("✉️ Email", "💼 LinkedIn", etc.) instead of bare emoji. Widened from 90px → 105px.
- **Apify public-actor-disabled error**: New 403 error type handled with clear upgrade message. Batch enrichment early-aborts on this error.

### Recently Fixed (v3.8.5)
- **Apify credit conservation**: maxItems 10→1 (only enrich once if we can get it). Re-enrich guard skips already-enriched roles. Batch early-abort on auth errors.

### Recently Fixed (v3.8.4)
- **Feed card logos**: Ported full Pipeline logo system — `DOMAIN_OVERRIDES`, `getCompanyDomain(name, url)` with ATS-aware extraction, `getCompanyColor(name)` for colorful letter fallbacks, `handleLogoError()` for graceful degradation.
- **Feed stats bar**: Shows total roles, unique companies, and stage breakdown between tabs and cards.
- **Logo pattern documented**: Rule 7 in Mandatory Rules section of CLAUDE_CONTEXT.md.

### Recently Fixed (v3.8.2)
- **Auto-enrich disabled**: Switched JD enrichment from automatic-on-load to on-demand only. Per-card "⚡ Enrich" and batch "Enrich JDs" buttons still work. Conserves Apify credits. Auto-enrich code commented out (re-enable by uncommenting block in init).

### Recently Fixed (v3.8.1)
- **Async Apify enrichment**: Replaced sync API (300s hard timeout) with async run + poll pattern (up to 10 min). Happitap actor was timing out every time on the sync endpoint.
- **Billing early-abort**: Auto-enrich loop now breaks on first 402 error instead of trying all 17 roles.

### Recently Fixed (v3.8.0)
- **Classification-first comp estimator**: Detects posted comp type (BASE_SALARY / TOTAL_TARGET_CASH / OTE / UNKNOWN) before applying formulas. TCC postings get equity add-on only (no full TC multiplier). PM level inference (mid/senior/principal) with calibration modes (public/startup/generic). Confidence scoring (High/Medium/Low). Hard cap at 1.65x. Adobe estimate dropped from $513K to $170K–$395K range.
- **Comp estimation skill doc**: `docs/skill-comp-estimation.md` — full spec with multiplier tables, equity heuristics, confidence rubric, guardrails.

### Recently Fixed (v3.7.0)
- **Expanded company stages**: 7 granular options (Seed/Angel, Series A, Series B, Series C+, Late-stage/Pre-IPO, Public, Bootstrapped/Private) replacing old 4-stage set. `normalizeStage()` provides backward compat for old values.
- **Comp estimation engine**: `estimateTotalComp()` estimates total comp from listed base using company-archetype ratios (Public 55%, Seed 80%, etc.). Cards show "→ ~XK total (est.)" with hover breakdown. Scoring uses estimated total.
- **Leader/IC awareness**: JD text scanned for management/IC signals. Small company (Seed/A/B) + leader = +5 pts bonus, larger + leader = +2. Badge in score breakdown.

### Recently Fixed (v3.6.1)
- **Auto-enrich on page load**: Feed now auto-enriches stub JDs in background on load (when Apify token is configured). Progress counter shown. Auth errors abort early. No manual click needed.
- **Max Total slider removed**: Only Min Base and Target Total remain. Scoring simplified: meets target = 100, above min = 70, below min = 0. No cap on upside.
- **Comp slider unified scale**: Both sliders now 50-1000K so visual positions match ($250K sits left of $350K).
- **Happitap actor input fixes**: 3 validation errors fixed: keywords as array, `datePosted: '30d'`, `proxyCountry: 'US'` (flat string, not proxy object).

### Recently Fixed (v3.6.0)
- **Settings live-update pattern**: All settings now update the UI immediately without page refresh. Comp range inputs replaced with range sliders (debounced save + instant label). Company stage checkboxes re-score and re-render feed on toggle. Mock Interview practiced questions re-render question bank. Research Brief API key masked with placeholder (never exposed in plaintext). Settings Live-Update Pattern documented in `docs/skill-patch-settings-live-update.md` as mandatory rule.
- **Apify actor swap (again)**: Default changed from `valig` (expired) to `logical_scrapers/linkedin-jobs-scraper` (consumption-based, free). `buildApifyInput()` now supports 3 format families: keywords-based, searchUrl-based, field-based.
- **scoreRole null guard**: Fixed crash when `role.location` is undefined — now defaults to empty string.

### Recently Fixed (v3.5.2)
- **Stage date/time override**: Stage history timeline uses `datetime-local` inputs (shows date + time). Fixed current stage date editing (index -1 was silently failing). New `formatDatetimeLocal()` helper. CSS for datetime-local inputs.

### Recently Fixed (v3.5.1)
- **Accept → Pipeline integration**: `acceptRole()` now creates a full Pipeline role (stage: "discovered") in `pf_roles` + company in `pf_companies` with Google Favicon logo. New helpers: `addRoleToPipeline()`, `guessDomain()`. Toast shows "→ Pipeline (Discovered)".
- **Dismiss persistence**: `dismissRole()` now calls `saveFeedQueue()` so dismissed roles don't reappear on reload.
- **Dark mode cache fix**: `data-layer.js` initializes `data-theme` on `<html>` from `pf_theme` on every page load. Overrides stale cached CSS. Cache-bust `?v=3.5.1` on shared CSS/JS links in all 11 modules.
- **Apify companyName array**: `buildApifyInput()` sends `companyName: [company]` (array) instead of string. Fixes 400 error from valig actor.

### Recently Fixed (v3.5.0)
- **JD-first scoring engine**: `scoreRole()` rewritten with `searchText` pattern — scans full JD when available, falls back to title+company+domain for stubs. New tier: target title found in JD body = 75/100 Role Fit. `hasFullJD` flag in score breakdown.
- **mustHaveKeywords activation**: `prefs.mustHaveKeywords` now 60% weight in Keyword dimension via composite formula: `(mustHaveRatio × 100 × 0.6) + (boostScore × 0.4)`. Keywords went from 0→38 for most cards.
- **Apify actor swap**: Replaced `bebity/linkedin-jobs-scraper` (trial expired, 403) with `valig/linkedin-jobs-scraper` (consumption-based, free). `buildApifyInput()` auto-detects actor type (field-based vs searchUrl-based). `companyName` sent as array per valig spec.
- **Configurable actor ID**: New `pf_apify_actor` localStorage key + sidebar UI field. Users can swap actors without code changes. `getApifyActorId()` falls back to `DEFAULT_APIFY_ACTOR`.

### Recently Fixed (v3.4.0)
- **Apify JD enrichment engine**: Feed roles with stub JDs can now be enriched with full JD text via Apify's `bebity/linkedin-jobs-scraper` actor. Per-card "⚡ Enrich" button, batch "Enrich JDs" header button with live progress counter, JD quality badges (yellow "Stub JD" / green "Full JD"), Apify API token settings in sidebar (`pf_apify_key`). Fuzzy matching scores company name + title (40+ confidence required). Enriched roles get `jdEnriched`, `jdEnrichedAt`, `jdEnrichSource`, `jdEnrichConfidence` metadata. Free tier = $5/mo compute.

### Recently Fixed (v3.3.1)
- **Salary extraction from JDs**: Pipeline cards show extracted salary with color coding (green=in-range, red=below $250K floor, gray=unknown). 3-pattern regex engine (dollar ranges, K ranges, context amounts). `pf_salary_prefs` stores thresholds (min $250K, target $300K-$450K).
- **Feed salary gate**: `acceptRole()` warns before adding below-threshold roles to Pipeline. Comp defaults updated (minBase 250K, targetBase 300K).
- **Light mode default**: `pathfinder.css` `:root` now light, `[data-theme="dark"]` for dark. All modules default to light theme.
- **Score breakdown transparency**: Feed cards show inline color-coded dimension chips (Title, Domain, Keywords, Location, Network, Stage, Comp) with tier coloring (green 70+, yellow 40-69, red 0-39).
- **Built In email source**: 5 new roles from `support@builtin.com` alerts (GEICO, Amplitude, Zendesk, DIRECTV, Autodesk). Built In active in FEED_SOURCES.

### Recently Fixed (v3.2.1)
- **LinkedIn Job Alert parsing**: Feed now extracts individual job listings from LinkedIn Job Alert emails (`jobalerts-noreply@linkedin.com`). 12 new roles added: Intuit, OpenAI, Stripe, Microsoft, SoFi, Salesforce, Adobe, Google, Sigma, Netflix, Uber, Harvey.
- **Dual-link provenance badges**: LinkedIn items show "LinkedIn ↗" (job posting) + "✉️" (Gmail alert email). Gmail items show "Gmail ↗" → original email. User can always trace back to the source.
- **LinkedIn active in FEED_SOURCES**: Listed as active source alongside Gmail and Manual Entry.
- **Updated scheduled task**: `pathfinder-gmail-sync` scans both direct recruiter emails and LinkedIn Job Alert emails.

### Recently Fixed (v3.2.0)
- **Live Gmail Feed**: Feed now shows real job emails from Gmail inbox. Removed all demo data (`DEMO_FEED_ITEMS`, `DEMO_FEED_RUNS`). Auto-cleanup purges stale demo items on init. Gmail seed data loaded from `gmail-seed.json` (4 real roles: RingCentral, Amazon, LiveRamp, Yahoo).
- **Source URL linking**: Feed cards have clickable "Gmail ↗" badge linking to original email. New `.card-badge-link` CSS.
- **Referral badges**: Cards show "🤝 Referred by X" when `feedMetadata.referredBy` is set.
- **Auto-refresh timer**: Feed reloads from localStorage every 15 minutes + on page load. Picks up items added by MCP sync agent.
- **Scheduled Gmail sync**: Hourly Cowork scheduled task scans Gmail and updates `pf_feed_queue`.
- **Research Brief bridge fallback**: Removed blocking `showBridgeError()` — now falls through to direct Claude API when bridge is down.

### Recently Fixed (v3.1.0)
- **Inline Comms Per Contact**: Tracked connection cards in Pipeline detail panel are now expandable — click to see comms history and quick-log input. Last activity date shown on collapsed cards. Standalone "Comms Log" section removed. General notes (non-contact comms) appear in their own collapsible section. New JS functions: `toggleConnCard()`, `quickLogComms()`.

### Recently Fixed (v3.0.0)
- **MCP-Backed Data Layer**: Created `modules/shared/data-layer.js` that monkey-patches localStorage to sync 22 `pf_*` keys to MCP HTTP bridge with 1-second debounce. Added 4 new HTTP bridge endpoints (`PUT/GET/DELETE /data/:key`, `GET /data`). Files stored at `~/.pathfinder/data/`. Auto-recovery on startup, graceful degradation when bridge unavailable. Script tag added to all 11 modules.
- **Unified Connections Section**: Merged "Connections" and "LinkedIn Network" into one section in Pipeline detail panel. Tracked connections at top, LinkedIn below (de-duplicated). Total count excludes duplicates. New "Add External Contact" form supports cross-company contacts (e.g., recruiters at other firms). Removed redundant Notes field from add contact form.

### Recently Fixed (v2.7.0)
- **LinkedIn Network Import**: Parsed 2,687 LinkedIn 1st-degree connections into `pf_linkedin_network`. Pipeline detail panel shows LinkedIn connections sorted by seniority (VP → Director → Senior) with Product/Engineering people surfaced first. Purple "Product" and blue "Eng" department badges. "Show More" button expands from top-10 preview to full list. "+ Track" promotes to active connection. Kanban cards show combined tracked + LinkedIn connection counts.

### Previously Fixed (v2.6.0)
- **Demo Mode removed**: Deleted `data-switcher.js`, removed Demo/Personal toggle from all 11 modules. App is now single-user (Ili only). No more demo seed data in Pipeline, Research Brief, Calendar, Resume Builder. Job Feed reads from `pf_feed_queue` localStorage instead of hardcoded demo items. New principle: localStorage backed by MCP (v3.0.0).

### Previously Fixed (v2.5.0)
- **Pipeline side panel restructure**: "Resume Sent" renamed to "Artifacts" with type badges (resume/research/document). Added "Generate Research Brief" button that deep-links to Research Brief module via `?roleId=X`. Comms Log now collapsible (starts collapsed, shows count + latest date). New `role.artifacts` array in data model. Reusable `.collapsible` CSS pattern.

### Previously Fixed (v2.4.0)
- **MCP pipeline backup system**: Added `pf_backup_pipeline` and `pf_restore_pipeline` MCP tools. Backups write timestamped JSON snapshots of all `pf_*` keys to `~/.pathfinder/backups/` with SHA-256 checksums and auto-pruning (max 50). HTTP bridge endpoints added (`POST /backup`, `POST /restore`, `GET /backups`). Sync Hub auto-backs up after every Sync All with localStorage fallback when MCP is unavailable.

### Previously Fixed (v2.3.2)
- **Migration data sync**: Updated all 3 migration JSON files to match browser localStorage: 7 real roles (full JDs, comms logs, resumes), 50 companies (fixed ATS→real domains), 63 connections (4 new manual). Bumped MIGRATION_VERSION to 4. Replaced Google Favicon API logoUrls in migration data.

### Previously Fixed (v2.3.1)
- **Sibling roles in detail panel**: Role detail slide-out now shows "Other Roles at [Company]" section when a company has multiple roles. Each sibling shows stage pill, tier, level, last activity. Clicking navigates directly to that role's detail. Uses IIFE in template literal to compute sibling list.

### Previously Fixed (v2.3.0)
- **Removed bulk-select checkbox entirely**: The `<input type="checkbox">` on every kanban card (and all associated bulk-select CSS, toolbar HTML, JS functions) has been deleted. This was the "white square" reported across 3+ sessions.
- **Restored company logos**: Using Google Favicon API (`https://www.google.com/s2/favicons?domain={domain}&sz=128`). Logos load reliably. Letter-initial colored circles as fallback. New companies get logos automatically via domain resolution (`getCompanyDomain`).

### Previously Fixed (v2.2.0)
- **Real pipeline data from spreadsheet**: Regenerated `pf_roles.json` with actual outreach statuses mapped to Pipeline stages (6 in Outreach, 1 in Screen, 38 in Discovered). Personal notes now populated from spreadsheet contact notes.
- **Data-switcher seed-once fix**: No longer overwrites user edits on every Demo→Personal switch. Backup/restore system preserves roles, connections, companies across mode switches. Core data only written if localStorage key doesn't exist.
- **Logo polish**: Increased to 32px with 6px border-radius, subtle border, letter-initial fallback (purple badge). Added DOMAIN_OVERRIDES map for companies like "Amazon Ads" → amazon.com.

### Previously Fixed (v2.1.8)
- **Logo visibility fix**: Increased kanban card logos from 20px→28px with white background + padding so favicons pop against dark theme. Added letter-initial fallback for broken images. Fixed all logo classes (role-card, table, company-card, company-lookup).

### Previously Fixed (v2.1.7)
- **Personal mode roles now load**: Generated `pf_roles.json` (45 roles from existing companies, stage="discovered"). Updated data-switcher to fetch and load roles file. Fixed data format: numeric timestamps (not ISO strings), valid Pipeline stage name, IC positioning default.
- **Personal-first principle**: Added to build-with-ili skill as a core operating principle. QA always starts in Personal mode. Migration completeness is a ship-blocker.

### Previously Fixed (v2.1.6)
- **Data contract fix (c.id → c.name)**: Company objects have `name` but no `id` field; roles have `company` (string) but no `companyId`. Fixed all lookups across 4 modules: Outreach (critical — dropdown values were all "undefined"), Debrief, Calendar, Pipeline
- **Calendar double-prefix bug (pf_pf_*)**: `getStorageData()` / `saveStorageData()` helpers prepend `pf_` to keys, but all callers were passing keys already prefixed with `pf_` (e.g., `getStorageData('pf_roles')` → `localStorage.getItem('pf_pf_roles')`). Fixed dozens of call sites. This was why Calendar appeared empty in Personal mode.
- **Outreach selection restore**: After `renderSidebar()` rebuilds dropdown HTML, selected values are now restored from AppState

### Previously Fixed (v2.1.5)
- Data-switcher (Demo/Personal toggle) added to Debrief, Comp Intel, Sync Hub — all 11 modules now have it
- `clearAllData()` now dynamically scans all `pf_*` keys instead of hardcoded list (protects API key + model)
- Resume Builder demo seeding now checks `pf_resume_log` existence before overwriting

### Previously Fixed (v2.1.4)
- Calendar Add Event modal invisible → modal CSS class mismatch (`active` vs shared `open`); changed all 8 references to `open`
- Calendar Sync Log "undefined" → data shape mismatch between Sync Hub writer (`source`) and Calendar reader (`action`); now handles both

### Previously Fixed (v2.1.3-v2.1.4)
- Google Favicon API implemented across 6 files for reliable company logo resolution
- Pipeline view toggle buttons destroyed on click → removed conflicting parent handler
- Research Brief "MCP bridge not running" scare notice → removed (direct API is default)
- Pipeline `applyFilters` undefined crash → fixed to `filterRoles`
- Pipeline blank page on table/companies init → rewired init to use `switchView()`, CSS-only visibility

### Git State
- Remote: github.com/selinger2211/pathfinder-job-search
- Push command: `cd ~/Projects/job-search-agents && git push origin main`

---

## Inspiration Credits
- **Abhijay Arora Vuyyuru** — AI job search automation pioneer (Substack: AI Action Letter). Credited in Job Feed PRD Section 13.1.
- **n8n ecosystem** — Job automation workflow patterns. Credited in Job Feed PRD Section 13.2.

---

## How to Start a New Session

1. Read this file (`CLAUDE_CONTEXT.md`)
2. Read `CHANGELOG.md` for recent changes
3. Check `git log --oneline -10` for latest commits
4. Read the relevant component PRD for whatever the user wants to work on
5. Ask user what they want to do (don't re-explain the project)
