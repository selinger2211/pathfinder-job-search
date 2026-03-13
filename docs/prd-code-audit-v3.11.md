# Pathfinder PRD vs Code Audit — v3.11.0

**Audit Date:** 2026-03-13
**Scope:** All 11 module PRDs audited against actual implementation code
**Purpose:** Identify drift between documentation and what's actually built

---

## Executive Summary

Across all 11 modules, the audit found **3 categories of drift:**

1. **PRD describes features that aren't built** — aspirational specs from early planning that were never implemented (MCP tool calls, auto-detection algorithms, cross-module integrations)
2. **Code has features not in PRD** — features built iteratively (v3.0–v3.11) that were never back-ported to the PRD
3. **PRD and code disagree** — values, thresholds, or behaviors that diverged during implementation

**The biggest systemic issue:** PRDs were written assuming an MCP-first architecture (server-side Claude calls, MCP tool APIs, artifact storage). The actual implementation is browser-first (direct Claude API calls, localStorage, inline generation). This architectural reality needs to be reflected in the PRDs.

---

## Module-by-Module Findings

### 1. Job Feed Listener

**Implementation: ~85% of core, ~40% of integrations**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 10 | Gmail integration, Indeed/Dice API, career page monitoring, feed analytics, MCP tools, feed run logging, tier promotion engine, dedup vs pipeline |
| Built, not in PRD | 12 | JD enrichment (CORS+ATS+DDG), stub JD detection, URL import, manual add, leader/IC bonus, comp confidence labels, JD sidebar panel, company descriptions, snoozed tab |
| Discrepancies | 9 | Network weight (PRD: 10%, code: 15%), comp weight (PRD: 10%, code: 5%), stalled threshold differences, no Tier 1 exception in quick-check |

**Verdict:** Core scoring engine is solid and ahead of PRD in enrichment. PRD needs major update to document v3.4–v3.11 features. Feed source integrations (Gmail, Indeed, Dice, career pages) are spec'd but unbuilt.

---

### 2. Pipeline Tracker

**Implementation: ~80% of core, ~50% of advanced features**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 12 | Interview/offer substages, stage transition reasons, opaque recruiter tracking, company auto-enrichment, web search lookup, table sorting (partially), fit assessment UI, comms log rendering |
| Built, not in PRD | 10 | Column collapsing, LinkedIn network in detail panel, command palette (⌘K), company descriptions on cards, sibling role cards, CSV export, expandable connection cards, score sort default |
| Discrepancies | 6 | Salary display (PRD: range only; code: posted base + est TC), company view shows connections not role count |

**Verdict:** Kanban board and data model are robust. PRD needs updates for v3.11 features (score sort, company visibility, comp labeling). Substage system is designed but not built.

---

### 3. Dashboard

**Implementation: ~70% of core, ~30% of advanced**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 16 | Feed review section, interview intelligence card, conversion funnel viz, avg time-in-stage, company profile sparse rule, nudge dedup UI, nudge logging, cooldown differentiation by priority, suppression chains, per-rule disable |
| Built, not in PRD | 14 | 4 extra nudge rules (stale discovered, researching too long, screen prep, no new roles), comms-aware follow-ups, mutual connections, GCal events card, practice interview button, sync status banner |
| Discrepancies | 12 | Stalled threshold (PRD: 21d, code: 10d), interview prep (PRD: <48h, code: <72h), outreach trigger (PRD: 3d response wait, code: 7d in stage), streak weekend logic missing, quick actions differ |

**Verdict:** Nudge engine works but rules diverge from PRD significantly. v3.11 smart nudges (comms, connections) not in PRD. Several aspirational features (interview intelligence, feed review) never built.

---

### 4. Research Brief

**Implementation: ~60% of core, ~20% of advanced**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 20 | MCP tool generation (pf_generate_brief_section), citation system, source ledger, batch parallel generation, degraded modes (company-unknown, role-unknown), section invalidation triggers, stale badges, per-section refresh, bullet/story bank integration, interviewer research, brief version comparison, markdown export |
| Built, not in PRD | 11 | HTTP bridge config, fallback API mode, demo data, role selector grouping, sidebar TOC, IndexedDB PDF storage, clear & regenerate button, deep-linking, section keyboard shortcuts |
| Discrepancies | 10 | PRD: MCP server-side generation; Code: browser-side with embedded templates. PRD: citations saved via MCP; Code: no citation data structure. PRD: batch-parallel; Code: sequential |

**Verdict:** Largest drift of any module. PRD describes an MCP-first architecture; code is entirely browser-first. Core brief generation works but advanced features (citations, invalidation, degraded modes, integrations) are unbuilt. PRD needs fundamental rewrite to match browser-first reality.

---

### 5. Resume Builder

**Implementation: ~70% of core, ~40% of advanced**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 9 | MCP server generation, DOCX export (partial), PDF export (library loaded but incomplete), new bullet proposals with approval workflow, Research Brief data feed, cover letter (partial), keyword gap UI (partial), artifacts MCP storage, bulk generation |
| Built, not in PRD | 3 | Version history localStorage, interactive bullet selection UI, demo background data |
| Discrepancies | 4 | Export: PRD says DOCX via library; code outputs primarily HTML. Generation: PRD says MCP; code uses direct Claude API |

**Verdict:** Phase 1 (JD analysis) solid. Phase 2 (generation) works but via direct API, not MCP. Export formats incomplete. Bullet bank functional but no approval workflow.

---

### 6. Outreach

**Implementation: ~75% of core, ~30% of advanced**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 9 | InMail as distinct type, debrief integration for thank-yous, personalization signal validation, edit context sidebar, scheduled sends, response rate analytics, smart timing suggestions, conversation threading, email bounce detection |
| Built, not in PRD | 3 | Gmail compose integration, message type stats tracking, "networking-intro" message type |
| Discrepancies | 3 | Follow-up timeline differs, citation rendering missing, character limits differ from PRD |

**Verdict:** 8 message types work. Draft queue works. Missing debrief integration (thank-yous can't reference interview discussion) and advanced analytics.

---

### 7. Mock Interview

**Implementation: ~75% of core, ~50% of advanced**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 4 | Company-JD calibration (questions tagged by company but not JD-aware), multi-turn follow-up probes (partial), performance trends (UI exists, logic incomplete), full session playback |
| Built, not in PRD | 2 | Custom question addition, question bank search/filters |
| Discrepancies | 4 | Question count (~80 vs "100+"), TMAY more complete than PRD describes, session durations differ slightly |

**Verdict:** Strongest implementation-to-PRD alignment. Question bank and session flow work well. JD-aware calibration is the main missing piece.

---

### 8. Debrief

**Implementation: ~40% of PRD vision**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 8 | Claude conversational debrief (form-only today), auto-activation after interviews, pattern analysis on Dashboard, Research Brief refresh trigger, Outreach thank-you handoff, MCP artifact storage, interview round auto-detection, question bank tagging |
| Built, not in PRD | 5 | Text export, pending debrief banner, sidebar previous debriefs, timeline tab, star rating display |
| Discrepancies | 3 | PRD: 8 structured sections; Code: simplified form (impression, questions, follow-up, next steps). PRD: conversational; Code: form-based |

**Verdict:** Significant gap. PRD envisions a conversational Claude-powered debrief; code is a structured form. Cross-module integrations (→ Research Brief, → Outreach) not wired.

---

### 9. Comp Intelligence

**Implementation: ~30% of PRD vision**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 10 | Glassdoor scraping, multi-offer comparison table, negotiation scorecard (25-point system), market percentile calculation, counter-offer suggestion engine, equity valuation context, BATNA analysis, auto-generation on role entry, positioning-aware comparison, comp caching |
| Built, not in PRD | 3 | Bulk manual data entry, Levels.fyi source selector, positioning toggle UI |
| Discrepancies | 3 | PRD: API-driven data; Code: manual entry. PRD: tabs (Benchmark/Positioning/Offer); Code: single page |

**Verdict:** Largest feature gap. PRD describes a sophisticated comp analysis engine; code is primarily a manual data entry form. Negotiation features (scorecard, counter-offer, BATNA) not built.

---

### 10. Calendar

**Implementation: ~35% of PRD vision**

| Category | Count | Key Items |
|----------|-------|-----------|
| In PRD, not built | 10 | Week view, auto-detection/classification algorithm (confidence scoring), stage auto-advance, pre-interview nudge timing (72h/48h/morning-of), post-interview nudge (1h after), interviewer-connection linking, Research Brief auto-population, follow-up event detection, rejection signal detection, GCal MCP integration |
| Built, not in PRD | 4 | Debrief badge in sidebar, manual event linking UI, nudge dismiss tracking, week view placeholder CSS |
| Discrepancies | 3 | PRD: auto-link events with ≥70 confidence; Code: manual link. PRD: nudges on Dashboard; Code: nudges in Calendar module. PRD: GCal MCP calls; Code: local data |

**Verdict:** Month/day views work. Manual event tracking works. But the core value prop (intelligent event detection, auto-nudges, cross-module triggers) is not built.

---

### 11. Sync Hub

**Implementation: ~50% of UI, no PRD exists**

| Category | Count | Key Items |
|----------|-------|-----------|
| No PRD exists | — | Sync Hub has NO PRD in `docs/`. Only referenced in main PRD and CLAUDE_CONTEXT |
| Built features | 7 | UI layout with 4 source cards (GCal, Indeed, Gmail, Clay placeholder), sync buttons, status indicators, freshness badges, sync log viewer |
| Not built | 4 | Cross-module sync orchestration, dedup logic, bulk import, auto-sync scheduling |

**Verdict:** Needs a PRD created from scratch. UI framework exists but sync logic is thin.

---

## Systemic Issues

### 1. MCP-First vs Browser-First Architecture
The PRDs (especially Research Brief, Resume Builder, Debrief) were written assuming MCP server-side generation. The actual implementation uses direct browser-to-Claude API calls. **Every PRD referencing MCP tools needs to be updated to reflect the browser-first pattern.**

### 2. Cross-Module Integrations Not Wired
PRDs describe rich cross-module data flows (Debrief → Research Brief, Calendar → Dashboard nudges, Comp → Pipeline). Most of these are one-way reads from localStorage — the active "trigger" integrations aren't built.

### 3. Features Built in v3.0–v3.11 Not Back-Ported to PRDs
The rapid v3.x development cycle added significant features (JD enrichment engine, smart nudges, company visibility, score sorting, comp labeling) that aren't reflected in module PRDs.

---

## Recommended Actions

### Priority 1: Update PRDs to Match Reality (docs catch up to code)
These are the most impactful — they eliminate confusion about what's actually built.

| Module | Action |
|--------|--------|
| **Job Feed** | Add: enrichment engine (3 strategies), stub JD detection, JD sidebar, comp labeling, company descriptions, URL import, manual add, leader/IC bonus. Fix: scoring weights. Remove: Gmail/Indeed/Dice API specs (mark as "Planned") |
| **Pipeline** | Add: LinkedIn network display, CSV export, command palette, expandable connections, score sort, company descriptions, column collapse. Mark substages as "Planned" |
| **Dashboard** | Add: 4 extra nudge rules, comms-aware follow-ups, mutual connections, GCal card, practice button. Fix: rule thresholds (10d not 21d, 72h not 48h, 7d not 3d). Mark feed review/interview intelligence as "Planned" |
| **Research Brief** | Major rewrite: change from MCP-first to browser-first architecture description. Document embedded templates, fallback API, IndexedDB PDF storage, deep-linking. Mark citations/invalidation/degraded modes as "Planned" |

### Priority 2: Create Missing PRD
| Module | Action |
|--------|--------|
| **Sync Hub** | Create `docs/sync-hub-prd.md` from scratch documenting current 4-source architecture |

### Priority 3: Mark Aspirational Features as "Planned"
Rather than removing unbuilt features from PRDs, mark them clearly:

```markdown
> **Status: Planned** — Not yet implemented. Spec retained for future development.
```

This preserves the design intent while being honest about what ships today.

### Priority 4: Fix Numeric Discrepancies
| Item | PRD Value | Code Value | Recommended |
|------|-----------|------------|-------------|
| Network scoring weight | 10% | 15% | Update PRD to 15% |
| Comp scoring weight | 10% | 5% | Update PRD to 5% |
| Stalled role threshold | 21 days | 10 days | Update PRD to 10 days |
| Interview prep nudge | <48h | <72h | Update PRD to 72h |
| Outreach follow-up trigger | 3 days wait | 7 days in stage | Update PRD to 7 days |

---

**End of Audit**

Generated by Claude via Pathfinder Docs Reviewer methodology.
