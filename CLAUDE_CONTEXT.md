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
- **IndexedDB** (`pf_resumes` database) — Resume file blobs (PDF, DOCX, DOC)
- **MCP filesystem** — Research briefs, artifacts (text-based)

### 6. Claude API Pattern
- All modules use `modules/shared/claude-api.js` for Claude API calls
- Direct browser-to-Anthropic API via `anthropic-dangerous-direct-browser-access` header
- API key stored in `pf_anthropic_key`
- Model stored in `pf_claude_model` (default: `claude-sonnet-4-20250514`)
- MCP HTTP bridge (localhost:3456) is optional fallback, not required

---

## Current State (Update This After Major Changes)

**Current Version:** v2.1.6
**Last Updated:** 2026-03-11

### Implementation Status

| Module | % Complete | What Works | What's Missing (External APIs) |
|--------|-----------|------------|-------------------------------|
| Pipeline | ~100% | Kanban, CRUD, drag-drop, IndexedDB resume, comms log, URL import, bulk actions, CSV export, company view, fit assessment, keyboard shortcuts, **Clay enrichment display**, **enrichment badges**, **stage analytics + funnel chart**, **stale role detection (14d)** | — |
| Dashboard | ~100% | 12-rule nudge engine, streak, action queue, feed review, interview intelligence, pipeline funnel, activity feed, weekly stats, real-time storage listener, **GCal card (next 3 events + countdown)**, **sync status indicator**, **quick actions row**, **debrief pending badge**, **outreach queue indicator** | — |
| Job Feed | ~100% | Scoring engine, preference editor, manual entry, dedup, quick-check filter, auto-pipeline, analytics, snooze, career page URL import, Sources tab, **error handling, a11y, visual polish** | — |
| Research Brief | ~100% | Claude API, 14 section prompts, caching, citation system, localStorage artifact save, saved briefs panel, **error handling, a11y, visual polish** | — |
| Resume Builder | ~100% | Phase 1 JD analysis, Phase 2 streaming, cover letter, bullet bank, keyword gap, version history, DOCX/PDF export, **error handling, a11y, export validation** | — |
| Outreach | ~100% | 8 message types, sequence scheduling, response tracking, templates, history/analytics, Gmail integration, Draft Queue, **email validation, a11y, error handling** | — |
| Mock Interview | ~100% | Multi-turn Claude, 7 types, 100+ question bank (11 companies), session playback, performance trends, custom questions, practice tracking, company-calibrated sessions, **a11y, error handling, input sanitization** | — |
| Debrief | ~100% | 8-section form, Claude synthesis, pattern analysis, timeline, export, Calendar auto-populate, pending events section, cross-module sync, **form validation, a11y, keyboard nav** | — |
| Comp Intel | ~100% | Data entry, comparison, Claude negotiation, charts, scorecard, Indeed salary, bulk import, market positioning, BATNA, **salary validation, a11y, error handling** | — |
| Calendar | ~100% | Week/month/day views, nudges, event-role linking, auto-trigger debrief, pending debrief badge, **date validation, a11y, keyboard nav, visual polish** | — |
| Sync Hub | ~100% | GCal sync, Indeed sync, Gmail sync (leads + applications), Clay placeholder, file upload, dedup, sync log, **outreach draft push**, **richer Gmail parsing (InMail/scheduling/rejection/offer)**, **data freshness indicators**, **sync stats dashboard**, **scheduling UI + auto-sync toggle**, **export sync log** | — |
| MCP Server | ~95% | **All 7 tools fully implemented** (save, get, list, search, tag, delete, generate-brief), **enhanced storage (SHA-256, excerpts, relevance search)**, **soft/hard delete**, HTTP bridge, **comprehensive README + implementation status docs** | Build on Mac (`npm run build`), end-to-end testing |

### Known Issues
- MCP server TypeScript build requires a real machine (OOMs in lightweight VMs)
- Research Brief stage dropdown missing "outreach" stage (Amazon Ads role has stage "outreach" which isn't in the stage list)

### Recently Fixed (v2.1.6)
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
