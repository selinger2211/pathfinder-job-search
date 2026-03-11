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
| Comp Intelligence | `modules/comp-intel/` | Compensation data entry, comparison, negotiation strategy | `pf_comp_cache` |
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

**Current Version:** v1.7.0
**Last Updated:** 2026-03-10

### Implementation Status

| Module | % Complete | What Works | What's Missing (External APIs) |
|--------|-----------|------------|-------------------------------|
| Pipeline | ~95% | Kanban, CRUD, drag-drop, IndexedDB resume, comms log, URL import, bulk actions, CSV export, company view, fit assessment, keyboard shortcuts | Company auto-enrichment (Clearbit/LinkedIn APIs) |
| Dashboard | ~90% | 12-rule nudge engine, streak, action queue, feed review, interview intelligence, pipeline funnel, activity feed, weekly stats, real-time storage listener | Google Calendar direct API sync |
| Job Feed | ~75% | Scoring engine (6 dimensions), preference editor, manual entry, dedup engine, quick-check filter, auto-pipeline creation, analytics, snooze | Gmail/Indeed/Dice APIs, career page scraping |
| Research Brief | ~65% | Direct Claude API, 14 section prompts, section caching | Citation system polish, MCP artifact save |
| Resume Builder | ~85% | Phase 1 JD analysis, Phase 2 streaming generation, cover letter, bullet bank UI, keyword gap detection, version history | DOCX/PDF export |
| Outreach | ~90% | 8 message types via Claude, copy/save, sequence scheduling, response tracking, templates, history/analytics | Real email sending |
| Mock Interview | ~85% | Multi-turn Claude, 7 types, session storage, story extraction, question bank, session playback, performance trends | Web scraping for real interview questions |
| Debrief | ~85% | 8-section form, Claude synthesis, history, pattern analysis, timeline, export, Research Brief triggers | Auto-trigger from Calendar events |
| Comp Intel | ~80% | Data entry, comparison table, Claude negotiation, visualization charts, aggregation stats, 25-point scorecard | Levels.fyi/Glassdoor data scraping |
| Calendar | ~80% | Manual events, week/month/day views, nudges, smart event-role linking, post-event automation | Google Calendar API |
| Sync Hub | ~70% | GCal sync, Indeed sync, Gmail sync (leads + applications), Clay placeholder, file upload, dedup, sync log | Auto-refresh from Cowork scheduled tasks, richer Gmail parsing |
| MCP Server | ~45% | Tool stubs, storage layer, HTTP bridge skeleton, bug fixes | Build on Mac (`npm run build`), end-to-end testing |

### Known Issues
- MCP server TypeScript build requires a real machine (OOMs in lightweight VMs)
- Research Brief still attempts MCP bridge first before direct API fallback
- Some modules still have demo/seed data for first-run experience

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
