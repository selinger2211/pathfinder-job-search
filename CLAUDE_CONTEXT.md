# Pathfinder — Session Context for Claude

**Read this file at the start of every new session.** It contains the rules, conventions, and current state needed to work on this project without losing context.

---

## What Is Pathfinder

Pathfinder is an agentic job search system with 11 standalone HTML modules sharing data via localStorage + IndexedDB. Each module is a single `index.html` file in `modules/`. There is no backend server required for core functionality — Claude API calls happen directly from the browser via `modules/shared/claude-api.js`.

**Owner:** Ili Selinger (ilan.selinger@gmail.com)
**Repo:** github.com/selinger2211/pathfinder-job-search
**Local Path:** ~/Projects/job-search-agents

---

## The 11 Modules

| Module | Path | Primary Function | Key localStorage Keys |
|--------|------|------------------|----------------------|
| Pipeline Tracker | `modules/pipeline/` | Data backbone — companies, roles, connections, kanban board | `pf_companies`, `pf_roles`, `pf_connections` |
| Dashboard | `modules/dashboard/` | Daily launcher — nudge engine, action queue, streak tracking | `pf_streak`, `pf_dismissed_nudges`, `pf_theme` |
| Job Feed Listener | `modules/job-feed-listener/` | Top-of-funnel — scoring engine, preference matching | `pf_preferences`, `pf_feed_queue`, `pf_feed_runs` |
| Research Brief | `modules/research-brief/` | Claude-powered company/role prep briefs (14 sections) | `pf_anthropic_key`, `pf_claude_model` |
| Resume Builder | `modules/resume-tailor/` | JD analysis (Phase 1) + Claude resume generation (Phase 2) | `pf_bullet_bank`, `pf_resume_log` |
| Outreach | `modules/outreach/` | 8 message types via Claude (LinkedIn, email, thank you, etc.) | `pf_outreach_messages`, `pf_outreach_sequences` |
| Mock Interview | `modules/mock-interview/` | Multi-turn Claude sessions across 7 interview types | `pf_mock_sessions`, `pf_story_bank` |
| Debrief | `modules/debrief/` | 8-section post-interview capture + Claude synthesis | `pf_debriefs` |
| Comp Intelligence | `modules/comp-intel/` | Compensation data entry, comparison, negotiation strategy | `pf_comp_data` |
| Calendar | `modules/calendar/` | Manual event tracking, pre/post-interview nudges | `pf_calendar_events`, `pf_calendar_nudges` |
| Sync Hub | `modules/sync/` | Bridge external APIs (GCal, Indeed, Gmail, Clay) into Pathfinder | `pf_sync_log` (writes to other module keys) |
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

---

## Current State (Update This After Major Changes)

**Current Version:** v3.2.0
**Last Updated:** 2026-03-12

### Implementation Status

| Module | % Complete | What Works | What's Missing (External APIs) |
|--------|-----------|------------|-------------------------------|
| Pipeline | ~100% | Kanban, CRUD, drag-drop, IndexedDB resume, comms log, URL import, CSV export, company view, fit assessment, keyboard shortcuts, **Clay enrichment display**, **enrichment badges**, **stage analytics + funnel chart**, **stale role detection (14d)**, **Google Favicon logos**, **collapsible comms log**, **Artifacts section (replaces Resume Sent)**, **Research Brief trigger button** | — |
| Dashboard | ~100% | 12-rule nudge engine, streak, action queue, feed review, interview intelligence, pipeline funnel, activity feed, weekly stats, real-time storage listener, **GCal card (next 3 events + countdown)**, **sync status indicator**, **quick actions row**, **debrief pending badge**, **outreach queue indicator** | — |
| Job Feed | ~100% | Scoring engine, preference editor, manual entry, dedup, quick-check filter, auto-pipeline, analytics, snooze, career page URL import, Sources tab, **error handling, a11y, visual polish** | — |
| Research Brief | ~100% | Claude API, 14 section prompts, caching, citation system, localStorage artifact save, saved briefs panel, **error handling, a11y, visual polish**, **URL param deep-linking (`?roleId=X`)** | — |
| Resume Builder | ~100% | Phase 1 JD analysis, Phase 2 streaming, cover letter, bullet bank, keyword gap, version history, DOCX/PDF export, **error handling, a11y, export validation** | — |
| Outreach | ~100% | 8 message types, sequence scheduling, response tracking, templates, history/analytics, Gmail integration, Draft Queue, **email validation, a11y, error handling** | — |
| Mock Interview | ~100% | Multi-turn Claude, 7 types, 100+ question bank (11 companies), session playback, performance trends, custom questions, practice tracking, company-calibrated sessions, **a11y, error handling, input sanitization** | — |
| Debrief | ~100% | 8-section form, Claude synthesis, pattern analysis, timeline, export, Calendar auto-populate, pending events section, cross-module sync, **form validation, a11y, keyboard nav** | — |
| Comp Intel | ~100% | Data entry, comparison, Claude negotiation, charts, scorecard, Indeed salary, bulk import, market positioning, BATNA, **salary validation, a11y, error handling** | — |
| Calendar | ~100% | Week/month/day views, nudges, event-role linking, auto-trigger debrief, pending debrief badge, **date validation, a11y, keyboard nav, visual polish** | — |
| Sync Hub | ~100% | GCal sync, Indeed sync, Gmail sync (leads + applications), Clay placeholder, file upload, dedup, sync log, **outreach draft push**, **richer Gmail parsing (InMail/scheduling/rejection/offer)**, **data freshness indicators**, **sync stats dashboard**, **scheduling UI + auto-sync toggle**, **export sync log**, **auto-backup after Sync All** | — |
| MCP Server | ~95% | **All 9 tools fully implemented** (save, get, list, search, tag, delete, generate-brief, **backup-pipeline**, **restore-pipeline**), **enhanced storage (SHA-256, excerpts, relevance search)**, **soft/hard delete**, HTTP bridge with backup/restore endpoints, **comprehensive README + implementation status docs** | Build on Mac (`npm run build`), end-to-end testing |

### Known Issues
- MCP server TypeScript build requires a real machine (OOMs in lightweight VMs)
- Research Brief stage dropdown missing "outreach" stage (Amazon Ads role has stage "outreach" which isn't in the stage list)

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
- **Migration data sync**: Updated all 3 migration JSON files to match browser localStorage: 7 real roles (full JDs, comms logs, resumes), 50 companies (fixed ATS→real domains), 63 connections (4 new manual). Bumped MIGRATION_VERSION to 4. Replaced Clearbit logoUrls with Google Favicon API in migration data.

### Previously Fixed (v2.3.1)
- **Sibling roles in detail panel**: Role detail slide-out now shows "Other Roles at [Company]" section when a company has multiple roles. Each sibling shows stage pill, tier, level, last activity. Clicking navigates directly to that role's detail. Uses IIFE in template literal to compute sibling list.

### Previously Fixed (v2.3.0)
- **Removed bulk-select checkbox entirely**: The `<input type="checkbox">` on every kanban card (and all associated bulk-select CSS, toolbar HTML, JS functions) has been deleted. This was the "white square" reported across 3+ sessions.
- **Restored company logos**: Switched from dead Clearbit API to Google Favicon API (`/s2/favicons?domain=X&sz=128`). Logos load reliably. Letter-initial colored circles as fallback. New companies get logos automatically via domain resolution (`getCompanyDomain`).

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
- Clearbit logo API dead (HubSpot acquisition) → replaced with Google Favicon API across 6 files
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
