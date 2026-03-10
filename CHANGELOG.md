# Changelog

All notable changes to Pathfinder are documented here. Each entry corresponds to a PRD version bump.

---

## v1.3.1 — 2026-03-10

### What Changed
- **Data migration from Contact-Outreach.xlsx** — Python script (`scripts/migrate-contacts.py`) reads Sheet4 (59 contacts, 15 columns), maps to Pathfinder schema (pf_connections + pf_companies), normalizes tiers, parses outreach status, infers relationship types, outputs JSON to `scripts/migration-output/`
- **Demo/Personal data toggle** — shared `data-switcher.js` injects a pill toggle into every module's nav bar. "Personal" fetches migrated JSON and reloads; "Demo" clears all pf_* keys so modules re-seed sample data. No more browser console pasting
- **Full 10-module navigation** — standardized nav across all 10 modules with working relative paths. Previously 6 modules had broken/incomplete navs (hash links, missing links, or no nav at all). Also updated `pathfinder.css` to support 10 nav items with flex overflow
- **Narrower Pipeline Kanban columns** — columns now use `flex: 1 1 0` (min 160px, max 240px) instead of fixed 280px, so all 8 stages fit on screen. Card padding, gaps, and logos tightened; long titles/company names truncate with ellipsis
- **Dashboard seed data fix** — company schema changed from `companyId` to `company` (name string) to match Pipeline format
- **Comp Intel data compatibility** — added `normalizeRoles()` and `inferLevelFromTitle()` to bridge Pipeline format (`role.company` name string) to comp-intel format (`role.company_id` + companies lookup)
- **Missing navbars added** — Outreach, Debrief, and Comp Intel modules received full nav HTML using shared CSS `.nav` class
- **PRD updated** — bumped to v1.3.1

---

## v1.3.0 — 2026-03-09

### What Changed
- **Calendar Integration Agent built** (`modules/calendar/index.html`) — bridges Google Calendar with pipeline for interview lifecycle tracking, week view with color-coded event cards, event detection & matching with confidence scoring (title keywords, attendee domains, recruiter names), pre-interview nudge timeline (72h/48h/morning-of/post-event), event-to-role linking with stage transition suggestions, scan simulation, sync log, 8 seeded demo events
- **Artifacts MCP Server built** (`mcp-servers/pathfinder-artifacts-mcp/`) — TypeScript MCP server providing shared file storage for all Pathfinder agents, 6 tools (save_artifact, get_artifact, list_artifacts, search_artifacts, tag_artifact, delete_artifact), 14 artifact types, index.json metadata store, full-text search with relevance scoring, soft delete with archive, Zod input validation, stdio transport
- **All 11 modules complete** — entire Pathfinder system from PRD is now built
- **PRD updated** — bumped to v1.3.0

---

## v1.2.5 — 2026-03-09

### What Changed
- **Mock Interview Agent built** (`modules/mock-interview/index.html`) — 7 interview types (Execution, Strategy, Design, Product Sense, Behavioral, Technical, Homework), chat-style Q&A thread with evaluation rubrics, framework adherence checks, TMAY practice mode with timer, story bank management (10 seeded STAR stories), session history
- **Post-Interview Debrief Agent built** (`modules/debrief/index.html`) — 8-section wizard-style debrief form (overall impression, what landed, what didn't, questions asked, priorities, red flags, follow-ups, interviewer notes), pattern analysis after 3+ debriefs, question bank aggregation, debrief history
- **Comp Intelligence Agent built** (`modules/comp-intel/index.html`) — heuristic-based comp benchmarking by company stage/level/location, positioning comparison (IC vs management comp), negotiation support with percentile analysis and counter-offer suggestions, comp dashboard table across all pipeline roles, 8 demo company benchmarks
- **PRD updated** — bumped to v1.2.5

---

## v1.2.4 — 2026-03-09

### What Changed
- **Outreach Message Generator built** (`modules/outreach/index.html`) — 8 message types (LinkedIn, cold email, follow-up, referral, InMail, thank-you networking, thank-you interview, recruiter response), 3 tone variants, character count with limit bar, outreach sequence tracker, message library

---

## v1.2.3 — 2026-03-09

### What Changed
- **Job Feed Listener built** (`modules/job-feed-listener/index.html`) — user preference profile, 6-point quick-check filter, weighted match scoring (0-100), feed review cards with accept/dismiss/snooze, score breakdown tooltips, feed sources panel, analytics tab, run history log, 16 demo roles

---

## v1.2.2 — 2026-03-09

### What Changed
- **Dashboard & Launcher built** (`modules/dashboard/index.html`) — single-column daily command center with time-of-day greeting, animated streak counter, nudge engine (5 trigger types with critical/important/informational priority), pipeline summary with animated bar chart and conversion funnel, quick action buttons linking to all modules
- **Nudge engine** — scans pf_roles against time-based rules: ghosted roles (21+ days in applied), pending offers (48h+), hot-tier gaps, upcoming interviews without briefs, sparse company profiles. Nudges dismissible with 24h expiry
- **Streak tracking** — consecutive day tracking with weekend skip logic, longest streak record, animated count-up with bounce easing
- **Module navigation** — consistent top nav bar linking Dashboard, Pipeline, Research Brief, Resume Tailor
- **PRD updated** — bumped to v1.2.2

---

## v1.2.1 — 2026-03-09

### What Changed
- **Research Brief Agent built** (`modules/research-brief/index.html`) — 10-section interview prep brief with streaming simulation, per-section caching (`research_{slug}_{roleId}_{section}`), floating TOC with scroll tracking, section-level refresh, export as HTML, print support
- **Demo content templates** — each section generates realistic company-specific content by reading Pipeline data (company stage, domain, headcount, positioning). Not lorem ipsum.
- **Cache invalidation rules** — JD changes invalidate sections 4/5/6/9/10, positioning changes invalidate 4/5/10, company profile changes invalidate 1/2/3/6/7
- **PRD updated** — bumped to v1.2.1

---

## v1.2.0 — 2026-03-09

### What Changed
- **Resume Tailor built** (`modules/resume-tailor/index.html`) — two-phase workflow: JD analysis (seniority detection, keyword extraction, domain identification, fit assessment) followed by resume builder (summary editor, skills bar with draggable pills, bullet selection per role, live preview pane)
- **Bullet Bank** — seeded with 15 realistic PM bullets across 6 themes (Technical Depth, Leadership, Revenue Impact, User Growth, Zero-to-One, Cross-Functional), each with metadata (keywords, metrics, usage count). Supports add/edit/delete, JSON export/import
- **Version Log** — tracks every resume generation with date, company, role, customizations, fit assessment, and filename. Browsable in History tab with load/delete
- **Two-panel layout** — collapsible context sidebar (company card, role details, JD, fit assessment) + fluid workspace with tab navigation (Analysis / Builder / Bullet Bank / History)
- **Local JD analysis heuristics** — keyword extraction, seniority calibration, domain detection, and fit assessment using pattern matching (placeholder for future Claude API integration)
- **PRD updated** — bumped to v1.2 with changelog entry

---

## v1.1.0 — 2026-03-09

### What Changed
- **Pipeline Tracker built** (`modules/pipeline/index.html`) — kanban board with 8 stage columns, drag-and-drop, table view toggle, search/filter, keyboard shortcuts, command palette, theme toggle, company auto-enrichment via Clearbit, 13 demo roles
- **Design system created** (`modules/shared/pathfinder.css`) — full token system (colors, typography, spacing, shadows, motion, radius), dark-first with light mode override, all component styles from PRD spec
- **README.md added** — project overview, architecture summary, quick start, project structure
- **CHANGELOG.md added** — this file; tracks every PRD version bump
- **Code documentation** — thorough plain-English comments added to both pathfinder.css and pipeline/index.html so even non-developers can follow the code
- **PRD updated** — added changelog section, bumped to v1.1

---

## v1.0.0 — 2026-03-09

### What Changed
- **Initial PRD completed** (2225 lines) covering all 11 agents, data schemas, design system spec, deployment strategy
- **Resume customization agent spec** fully integrated into PRD Section 7.3 (9 subsections: Hard Rules, Two-Phase Process, What Gets Customized, Seniority Calibration, Bullet Bank, Positioning-Aware Generation, Cover Letter, Version Log, Output Format)
- **Comp targets added** — $285K-$450K range with structured schema
- **STAR stories integrated** — all 10 stories as seed data with JSON schema and growth mechanism
- **Architecture diagram redrawn** — consistent spacing and box widths
- **Mobile considerations added** — Section 6.9 with breakpoint strategy
- **Bullet bank growth mechanism** specified with localStorage schema
- **Repo scaffolded** — directory structure for all modules, docs, MCP servers, skills
