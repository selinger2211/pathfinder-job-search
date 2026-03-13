# Changelog

All notable changes to Pathfinder are documented here. Each entry corresponds to a PRD version bump.

---

## v3.13.0 — 2026-03-13

### What Changed — Cross-Module Wiring: 12 Tier 2 Features (10 Modules)

**Summary:** Major release completing second-order integrations across 10 modules. Tier 2 "Cross-Module Wiring" features connect modules that were previously standalone, enabling context to flow bidirectionally through the entire system.

**Changes:**

**Dashboard Module (#15):**
1. **Feed Review Section** — "New Matches" card showing top 5 unreviewed feed items not yet in pipeline. Each item shows match score, company, title, source, with Accept/Snooze/Dismiss action buttons. Reads from `pf_artifacts` feed metadata. Feeds qualified matches into Pipeline discovery stage.

**Outreach Module (#17, #18):**
2. **Thank You (Interview) Message Type** — New message type pulling debrief data for personalized thank-yous per interviewer. Reads `pf_debrief[roleId].interviewerNotes` to surface what was discussed, automatically generates opening ("Thank you for the discussion about...") grounded in interview context.

3. **InMail (LinkedIn) Message Type** — New message type with 200 character preview limit, 1900 character full limit. Includes preview mode showing how message renders on LinkedIn. Shared connections display (top 3 mutual connections ranked by seniority) with "mention connection?" option.

**Debrief Module (#19):**
4. **Next Steps Panel** — After debrief save, summary screen shows two action cards: "Refresh Research Brief" (button) and "Draft Thank-You" (button). On "Refresh" click, writes `pf_brief_invalidation` signal to localStorage with affected section IDs (1-13). Updates `role.lastDebriefAt` timestamp for tracking interview completeness.

**Research Brief Module (#20, #21):**
5. **Auto Cache Invalidation** — On brief load, checks `pf_brief_invalidation` signal. For invalidated sections, displays yellow banner: "⚠️ [Sections 1, 5, 7] are stale due to recent interview debrief. Data has changed." "Regenerate Stale Sections" button reruns only those sections without clearing others. Respects stale section state across browser refresh.

6. **Export Formats (HTML + Markdown)** — Alongside existing PDF export, added HTML export (standalone file with embedded CSS, all sections, citations, source links) and Markdown export (pasted into notes apps or shared with mentors). Export dropdown menu consolidates all three formats with download buttons.

**Calendar Module (#22, #23):**
7. **Confidence Scoring Algorithm** — Event detection weighted signal system: Title keyword (+40), attendee domain (+30), recruiter match (+25), description content (+15), duration (+10), attendee count (+5). Score 0-100: ≥70 auto-link, 40-69 suggestion buttons, <40 ignore. Matched events auto-advance pipeline stage (Applied → Screen, Screen → Interviewing) based on confidence.

8. **Interviewer Linking** — Extract attendee names/emails from calendar events. Match against `pf_connections` (explicit) and `pf_linkedin_network` (inferred). Interviewer cards display name, title, seniority badge (IC/Manager/Director/VP), connection status, previous interactions (if any). Research Brief Section 5 auto-populated with interviewer context.

**Job Feed Module (#24):**
9. **Automatic Dedup vs Pipeline** — On feed score completion, compare each discovered role against `pf_roles` and recent closed roles (90d). Exact match: Same company + title + URL → skip, update `lastSeenDate`. Fuzzy match: Same company + similar title (edit distance <3) → badge "Possible Duplicate" with manual review button. Repost detection: Same title, new URL after ghosted role → "Repost Candidate" badge. Badges prevent accidental duplicates.

**Pipeline Module (#26):**
10. **Interview & Offer Substages** — Expanded `interviewing` and `offer` stages with substates for fine-grained tracking. Within `interviewing`: Phone Screen, Technical, Onsite, Final Round, Team Match. Within `offer`: Verbal, Written, Negotiating, Accepted, Declined. Substates optional; shown in stage transition UI as radio buttons, saved to `role.interviewing.substate` and `role.offer.substate`.

**Mock Interview Module (#30, #31):**
11. **Intelligence & Calibration** — JD-calibrated question generation: Claude reads full JD + company profile + fit assessment gaps to generate targeted questions per interview type. Questions cached per role+type in `pf_mock_calibrated_questions` localStorage (TTL 1 week). Post-session summary card displays: overall score, score distribution (% 5s/4s/3s), strongest answers (with why), weakest answers (gaps), framework compliance %, fit progress vs session. Analytics tab shows sessions/week, type coverage heatmap, current streak, top improvement areas.

**Comp Intelligence Module (#32, #33):**
12. **Positioning Intelligence** — IC vs Director comparison table at same company: Side-by-side columns showing base/bonus/equity for Staff IC vs Director track. Cross-company table showing compensation for same level across 5-10 tracked companies. Percentile position display: "You're targeting comp at 65th percentile for Senior PM at [company]" based on Levels.fyi benchmarks. Integration with Research Brief Section 2 (Compensation).

13. **Advanced Analytics** — Historical offer tracking: Chart showing comp trends across your search (offer timeline on X-axis, total comp on Y-axis). Comp by funding stage chart (Seed vs Series A/B/C vs Growth vs Public). Comp by company tier chart (Hot/Active/Watching). Stats cards: Average offer, highest/lowest, negotiation success rate (counter → acceptance), offer-to-hire conversion %.

**Resume Builder Module (#38):**
14. **Feedback Loops** — Post-generation keyword gap analysis: System scans JD against selected bullets, identifies uncovered keywords with frequency ranking. Claude-generated bullet suggestions queued in Bullet Bank with "Approve" / "Reject" buttons. "Add to Bullet Bank" buttons on each approved suggestion. Feedback loop: Resume generation → gaps identified → new bullets proposed → bullet bank grows → future resumes cover more keywords automatically.

**Files modified:** `modules/dashboard/`, `modules/outreach/`, `modules/debrief/`, `modules/research-brief/`, `modules/calendar/`, `modules/job-feed-listener/`, `modules/pipeline/`, `modules/mock-interview/`, `modules/comp-intel/`, `modules/resume-tailor/`

**Data layer updates:**
- Added `pf_brief_invalidation` localStorage key (signal for stale sections)
- Added `pf_feed_snoozed` localStorage key (snoozed feed items)
- Added `pf_feed_dismissed` localStorage key (dismissed feed items)
- Added `pf_mock_calibrated_questions` localStorage key (cached questions per role+type)
- Added `pf_outreach_nav_state` localStorage key (outreach module UI state)

---

## v3.12.0 — 2026-03-13

### What Changed — Tier 1 Quick Wins: 14 Features (Dashboard, Research Brief, Pipeline, Feed, Calendar)

**Summary:** Major feature release delivering 14 "Tier 1 Quick Win" features across 5 modules.

**Changes:**

**Dashboard Module (6 features):**

1. **Conversion Funnel Card** — Stage-to-stage conversion rates displayed as bar chart. Shows percentage moving from each stage to the next (e.g., Applied 68% → Screen, Screen 53% → Interviewing). Only displays after 10+ closed roles to ensure statistical validity. Sourced from `pf_roles` stage history analysis.

2. **Average Time-in-Stage Card** — Median/average days spent in each stage as sortable table. Calculated from `stageHistory` timestamps for all roles. Helps identify bottlenecks (e.g., "Screen is taking 8 days avg, Interviewing 10 days").

3. **Company Profile Sparse Nudge (Rule 13)** — Fires when a tracked company has <50% enrichment completeness (missing funding, headcount, tech stack, mission, etc.). Suggests opening company profile to complete missing data. Supports goal-driven research.

4. **Nudge Deduplication UI** — Nudges grouped by roleId with highest-priority displayed first. Secondary nudges hidden behind "+" expander badge. Reduces visual clutter while maintaining discoverability. Persists state per role.

5. **Nudge Logging** — All nudges logged to `pf_nudge_log` localStorage with: ruleId, roleId, timestamp (firedAt), dismissed status + timestamp, acted status + timestamp. Enables Dashboard analytics to track nudge effectiveness (fired vs dismissed vs acted). Historical audit trail for each rule.

6. **Per-Rule Nudge Preferences** — Dashboard sidebar "Nudge Preferences" section includes toggles for all 13 nudge rules. User preferences stored in `pf_nudge_prefs` localStorage, persisted across sessions. Users can disable specific rules they find noisy or irrelevant.

**Research Brief Module (4 features):**

7. **Citation Markers & Popovers** — Inline clickable [n] markers throughout brief sections. Click to reveal popover showing: claim text, source type badge (JD/enrichment_web/manual/ai_generated), source link, fetch date, trust level indicator. Supports "Trust but Verify" principle.

8. **Section Status Badges** — Each section displays a pill badge showing: Fresh (generated <24h ago), Cached (24h+ no changes), Stale (data invalidation fired), Error (generation failed), Generating (real-time progress). Users know at a glance which sections are current vs outdated.

9. **Generation Progress Bar** — Real-time progress indicator at top of page during generation showing "Generating section 3/13... (Batch 1: 6/8 complete)". Updates as Claude streams responses. Provides transparency during async generation.

10. **Keyboard Shortcut G** — Press G to trigger full brief generation or regeneration. Complements existing section shortcuts (0-9, Shift+0-3). Speeds up power-user workflows.

**Pipeline Module (2 features):**

11. **Stage Transition Reason Field** — When changing a role's stage via drag-drop or button, optional reason chips appear (e.g., "Passed screen", "Company freezing hiring", "Better opportunity"). Reason saved to `stageHistory[].reason`. Builds audit trail explaining each transition decision.

12. **Company Web Search Suggestions** — When manually adding a company or typing a company name in Pipeline, system provides DuckDuckGo instant answer API results. Shows company domain, mission statement, key facts. Users select from suggestions or confirm manual entry. Auto-populates name, url, domain.

**Job Feed Module (1 feature):**

13. **Feed Run Logging** — Every feed scan/refresh logged to `pf_feed_run_log` localStorage with: timestamp (runAt), number of items found, number accepted to pipeline, number dismissed, average score, duration (ms). Header displays summary stats. Enables Feed analytics dashboard (future).

**Calendar Module (1 feature):**

14. **Specific Nudge Timing** — Pre-interview nudges scheduled at precise intervals: 72h before ("Research brief not started"), 48h before ("Review prep materials"), morning of 8am ("Review TMAY + questions"), 1h after event end ("Capture debrief"). Each nudge displays countdown timer and action button. Post-interview nudge surfaces Debrief Agent with context pre-loaded.

**Files modified:** `modules/dashboard/index.html`, `modules/research-brief/index.html`, `modules/pipeline/index.html`, `modules/job-feed-listener/index.html`, `modules/calendar/index.html`

**Data layer updates:**
- Added `pf_nudge_log` localStorage key (nudge audit trail)
- Added `pf_nudge_prefs` localStorage key (per-rule user preferences)
- Added `pf_feed_run_log` localStorage key (feed run stats)
- Added `pf_calendar_dismissed_nudges` localStorage key (nudge dismissal tracking with timestamps)

---

## v3.11.0 — 2026-03-13

### What Changed — Bug Fixes + UX Improvements (6 Backlog Items)

**User asked:** "let's fix the bugs and then to the docu review" — referring to the 6 items in `docs/bugs-and-improvements.md`.

**Changes:**

1. **Smart outreach nudges (Dashboard)** — Nudge engine Rule 3 (applied, no response) and Rule 9 (outreach follow-up) now read the most recent comms log entry for context-aware suggestions. If an outbound email has gone dark, the nudge shows the subject line, days since, and a "Draft Follow-up" button linking to Outreach with role pre-selected. Inbound messages get "Time to reply?" prompts. Mutual connections surfaced from `pf_connections` + `pf_linkedin_network` (top 2 by seniority). Nudge cards show last comms snippet (80 chars) and "View Connections" link.

2. **Pipeline default sort by score** — Table view now defaults to `sortColumn = 'score'`, `sortAsc = false` (highest first). New Score column added to table headers with color-coded values (green 70+, yellow 40-69, muted <40). Kanban cards sort within each stage column by score descending.

3. **Company visibility across surfaces** — Company names are now clickable (→ Research Brief) in Feed cards, Pipeline kanban cards, Pipeline table view, and Pipeline detail panel. Hover tooltip shows company mission statement. Brief company description (1 line, truncated) added below company name on Feed and Pipeline cards. New `getCompanyDescription()` helper reads `missionStatement` from `pf_companies`.

4. **Full JD sidebar panel (Job Feed)** — New `.jd-detail-panel` (480px, slides from right with overlay) shows: company logo + name + title (sticky header), full JD text with readable typography (line-height 1.6), source badge, confidence indicator, close button. "View Full JD" button on each feed card with full JD.

5. **Comp estimate labeling** — `renderCompDisplay()` rewritten. Now shows two clear lines: "Posted Base: $XK–$YK" (extracted from JD) and "Est. Total Comp: ~$XK–$YK" (calculated). Info icon (ℹ️) with tooltip explaining methodology. "Posted Base: Not listed" fallback when no salary data. Color-coded confidence retained.

6. **Company description in Research Brief** — Added `companyDescription` div to company card, populated with `missionStatement`. Styled consistently with other surfaces.

**Files changed:** `modules/job-feed-listener/index.html`, `modules/pipeline/index.html`, `modules/dashboard/index.html`, `modules/research-brief/index.html`

---

## v3.10.0 — 2026-03-12

### What Changed — Free JD Enrichment Engine + Nav Reorder + Logo Fixes

**User asked:** "no let's drop apify" / "we'll do it ourselves" / "also another bug: the research for ring central picked up yahoo" / "let's go back to enriching all by default on load" / "the order of tabs are not in the optimal order" / "noticing some logos are linkedin when they should not be" / "for those do a good search with title and the company name"

**Changes:**

1. **Replaced Apify with free direct JD enrichment engine** — Zero cost, no API keys. Three strategies tried in order: (1) LinkedIn CORS proxy — fetches LinkedIn job page via proxy chain (allorigins.win → corsproxy.io → codetabs.com), extracts JSON-LD structured data. (2) ATS public APIs — Greenhouse, Lever, Ashby free endpoints. (3) DuckDuckGo job board search — searches title + company name, prioritizes Indeed/Glassdoor/BuiltIn results, extracts JD via JSON-LD or HTML container patterns. Company name validation ensures extracted JD matches the target role.

2. **Auto-enrichment re-enabled on page load** — Background async loop enriches all stub JDs with 1.5s delay between fetches. Progress shown in header: "(enriching X/Y...)". Toast notification on completion.

3. **Research Brief company mismatch guard** — JD validation checks if first 500 chars mention company name; prepends warning if not. System prompt declares `<company>` tag as authoritative truth, ignoring mismatched JD company references.

4. **Feed logo fix** — `renderCardLogo()` now always uses `getCompanyDomain()` instead of `item.domain` (which contains industry category like "Enterprise SaaS / AI", not a web domain).

5. **LinkedIn favicon fix** — `getCompanyDomain()` now skips LinkedIn job URLs (`/jobs/view/...`) instead of returning "linkedin.com" as domain. Falls through to name-based fallback for proper company favicon.

6. **Nav tabs reordered chronologically** across all 11 modules: Dashboard → Feed → Pipeline → Research → Resume → Outreach → Comp → Mock → Debrief → Calendar → Sync Hub.

7. **Sidebar Apify UI removed** — Replaced with simple "JD Enrichment" info panel explaining the zero-config approach. No API keys, no settings to configure.

---

## v3.9.0 — 2026-03-12

### What Changed — Research Brief Auto-Generation + Pipeline UX Fixes

**User asked:** "if I go to a page and there is nothing there, it has never been run, you should just generate the brief" / "these logos I cannot decipher" (comms dropdown) / Apify public-actor-disabled error

**Changes:**

1. **Research Brief auto-generation (v3.9.0)** — When navigating to a Research Brief page with no cached brief, the brief auto-generates immediately. No more empty "Click Generate Brief" state. If a cached brief exists, it shows instantly. Briefs persist until the user explicitly regenerates.

2. **Brief PDF auto-generated and attached to pipeline roles** — After generation, a PDF is rendered via `html2pdf.js` and stored in IndexedDB (`brief-{roleId}` key in `pf_resumes` DB). The role's `artifacts[]` entry gets an `indexedDbKey` so Pipeline shows preview/download buttons. Brief metadata (`briefArtifactId`, `briefGeneratedAt`) also written to role. Pipeline sidebar shows "View Research Brief" (with date) when a brief exists, "Generate Research Brief" when it doesn't.

3. **Generate → Regenerate button** — Button dynamically switches between "Generate Brief" (first run) and "Regenerate Brief" (when a cached brief exists). "Clear Cache" button renamed to "Clear & Regenerate" and now auto-triggers a fresh generation instead of showing an empty state.

4. **Pipeline comms dropdown labels** — Per-contact channel `<select>` in Pipeline detail panel now shows text labels ("✉️ Email", "💼 LinkedIn", etc.) instead of bare emoji that were unreadable at small sizes. Dropdown widened from 90px → 105px.

5. **Apify public-actor-disabled error** — New 403 error variant (`public-actor-disabled`) now handled with a clear message: "Your Apify plan does not support running public actors." Batch enrichment early-aborts on this error to prevent wasting retries.

---

## v3.8.5 — 2026-03-12

### What Changed — Apify Credit Conservation

**User asked:** "let's make sure we're being prudent with the apify calls"

**Changes:**

1. **Reduced maxItems from 10 → 1** — Each enrichment call now requests only 1 result. We only enrich once if we can get it. If the top result doesn't match with 40%+ confidence, fetching more won't help. Saves ~90% on credits per call.

2. **Re-enrich guard** — `enrichRoleJD()` now skips roles that already have `jdEnriched: true` with a full JD. Prevents wasting credits on double-enrichment.

3. **Batch early-abort on auth errors** — Batch "Enrich JDs" now also breaks on 401/403/not-rented errors (previously only broke on 402 billing errors).

---

## v3.8.4 — 2026-03-12

### What Changed — Pipeline Logo System + Feed Stats Bar

**User reported:** "logos are all messed up" / "use what we have in the pipeline" / "add this to your skill"

**Changes:**

1. **Feed: Full Pipeline logo system ported** — Replaced naive `guessDomain()` with Pipeline's battle-tested system: `DOMAIN_OVERRIDES` map, `getCompanyDomain(name, url)` with ATS-aware extraction (Workday, Greenhouse, Lever, Ashby, LinkedIn URLs), `getCompanyColor(name)` for consistent fallback colors, `handleLogoError()` for graceful degradation to colorful letter circles. `guessDomain()` kept as backward-compat alias.

2. **Feed: Stats bar with counts** — New bar between tabs and cards: total roles, unique company count, stage breakdown. Auto-updates on every card re-render.

3. **CLAUDE_CONTEXT: Logo pattern documented** — Rule 7 in Mandatory Rules documents the canonical logo system all modules must use. (Build skill is read-only; pattern documented in project context instead.)

---

## v3.8.2 — 2026-03-12

### What Changed — On-Demand Enrichment Only

**User reported:** Burned through Apify credits. Auto-enrich on page load is too aggressive.

**Changes:**

1. **Feed: Disabled auto-enrich on load** — Commented out the auto-enrich block that ran on every page load. JD enrichment is now on-demand only via per-card "⚡ Enrich" button and the batch "Enrich JDs" header button. Page load now just shows stub count ("X need JDs") instead of auto-enriching. Code preserved as commented block for easy re-enable.

---

## v3.8.1 — 2026-03-12

### What Changed — Async Apify Enrichment + Billing Early-Abort

**User reported:** "I'm still not seeing JDs being enriched" — happitap actor was timing out at the 300-second sync API limit on every enrichment attempt, and then 402 billing errors were not being caught (looped through all 17 roles).

**Changes:**

1. **Feed: Async Apify run + poll pattern** — Replaced synchronous API endpoint (`run-sync-get-dataset-items`, 300s hard timeout) with async 3-step pattern: POST to start run → poll status every 15s → fetch dataset items on success. Supports up to 10 minutes per actor run (40 polls × 15s). Logs progress: "Apify run started: {id}", "Still waiting... (Xs elapsed)", "Run succeeded after ~Xs".

2. **Feed: Early abort on billing errors** — Auto-enrich loop now breaks immediately on 402 ("free tier limit reached") instead of trying all remaining roles. Shows toast warning. Previously tried all 17 roles individually, each failing instantly.

---

## v3.8.0 — 2026-03-12

### What Changed — Classification-First Comp Estimation Engine

**User requested:** "we need to update the compensation logic it's off" — old engine naively divided listed salary by a flat ratio (e.g., Public = 0.55), producing wild overestimates when postings already disclosed total target cash. Adobe $282K base was being estimated at $513K total.

**Changes:**

1. **Feed: Classification-first comp estimator (v2)** — Complete rewrite of the comp estimation engine. Core principle: detect the posted compensation TYPE before applying any formula. Four detected types: `BASE_SALARY` (apply TC multiplier), `TOTAL_TARGET_CASH` (add equity only — never multiply by TC ratio), `OTE` (pass through, flag cautious), `UNKNOWN` (conservative 1.15–1.40x fallback). Prevents double-counting when postings already include bonus in their range.

2. **Feed: PM seniority inference** — New `inferPMLevel(title, jdText)` classifies roles as mid/senior/principal from title keywords + JD reinforcement signals (executive communication, platform ownership, 10+ years). Multipliers scale by level.

3. **Feed: Calibration modes** — `getCalibrationMode(stage)` returns `PUBLIC_CALIBRATED`, `STARTUP_HEURISTIC`, or `GENERIC_FALLBACK`. Each mode has its own multiplier ranges.

4. **Feed: Confidence scoring** — `calculateCompConfidence()` scores reliability based on comp type clarity, calibration quality, JD availability, and role archetype. Maps to High/Medium/Low labels shown on cards.

5. **Feed: Card display shows TC range + confidence** — Cards show "→ ~$170K–$395K TC (low)" with color-coded confidence. Hover tooltip shows full classification details.

6. **Feed: Hard guardrails** — TC multiplier capped at 1.65x. TCC postings never get base-salary multiplier. OTE flagged as low confidence for PM roles.

7. **Skill: Comp estimation spec** — New `docs/skill-comp-estimation.md` with full methodology.

---

## v3.7.0 — 2026-03-12

### What Changed — Expanded Company Stages, Comp Estimation Engine, Leader/IC Awareness

**User requested:** "let's add a new option for Series A, VC Funded, etc so we can keep / filter as we want" + "for Comp, many times it Base plus bonus, equity etc, can we have this and estimate based on the type of company" + "let's also put in some awareness that for smaller companies I'm going to want to favor people leader vs. IC on bigger ones"

**Changes:**

1. **Feed: Expanded company stage options** — Replaced 4-stage checkboxes (Series B+, Late-stage, Pre-IPO, Public) with 7 granular stages: Seed/Angel, Series A, Series B, Series C+, Late-stage/Pre-IPO, Public, Bootstrapped/Private. New `normalizeStage()` function maps old values ("Series B+", "Late-stage", "Pre-IPO", "Private") to canonical new values for backward compatibility. Manual entry dropdown and URL import defaults updated.

2. **Feed: Comp estimation engine** — New `estimateTotalComp(baseSalary, stage)` estimates total compensation (base + bonus + equity) from listed base salary using company-archetype ratios. Ratios: Public=55% base, Late-stage=60%, Series C+=65%, Series B=68%, Series A=72%, Seed=80%, Bootstrapped=85%. Formula: `estimatedTotal = baseSalary / baseRatio`. New `parseSalaryAndEstimate()` parses salary strings and returns min/max breakdowns. New `renderCompDisplay()` shows listed salary + "→ ~XK total (est.)" with hover tooltip showing base/bonus/equity breakdown + stage + ratio.

3. **Feed: Comp scoring uses estimated total** — `scoreRole()` comp dimension now scores against estimated total compensation (not raw listed salary). Roles where estimated total ≥ target = 100, ≥ min base = 70, below = 0. No salary data = 50 (neutral).

4. **Feed: Leader/IC scoring awareness** — JD text scanned for management signals ("manage a team", "direct reports", "build and lead", etc.) and IC signals ("individual contributor", "no direct reports", etc.). Additive bonus applied: small company (Seed/A/B) + leader = +5 pts, larger company + leader = +2 pts, IC = neutral (0). Badge shown in score breakdown ("Leader@Small", "Leader", "IC@Small", "IC").

---

## v3.6.1 — 2026-03-12

### What Changed — Auto-Enrich on Load, Comp Slider Cleanup, Happitap Fix

**User reported:** "from a user POV, they should have been updated or updating when I open the app" + "lose the max total, just put in min and target, there should be no 'max', why would i not want money?" + "the slider does not make sense, why is 250 farther to R than the 350"

**Changes:**

1. **Feed: Auto-enrich on page load** — When the feed loads with an Apify token configured and stub JDs exist, enrichment now runs automatically in the background. Progress counter shown in the Enrich button area. Auth errors (403/401) abort the loop early to avoid wasting API calls. No manual "Enrich" button click required.

2. **Feed: Removed Max Total comp slider** — Only Min Base and Target Total remain. There's no reason to cap upside on compensation. Scoring updated: roles meeting/exceeding target = 100, above min but below target = 70, below min = 0.

3. **Feed: Unified comp slider scale** — Both sliders now use the same 50-1000K range so $250K visually sits left of $350K. Previously Min Base (max=800) and Target Total (max=1500) used different scales, making the thumbs misleadingly positioned.

4. **Feed: Happitap actor input fixes** — Fixed 3 input validation errors for `happitap/linkedin-job-scraper`: keywords sent as array (not string), `datePosted: '30d'` field added, `proxyCountry: 'US'` replaces `proxy: { useApifyProxy: true }` object.

---

## v3.6.0 — 2026-03-12

### What Changed — Settings Live-Update, Comp Sliders, Cross-Module Bug Fixes

**User reported:** "when I make a change to the settings, e.g., changing my desired compensation ranges on the UI I have to refresh for them to take effect in the UI, also wouldn't a slider be better for compensation?" + "look to all UI settings for the display issue — this gets added to the skill"

**Changes:**

1. **Feed: Compensation range sliders** — Replaced number inputs with range sliders (`<input type="range">`) for Min Base and Target Total compensation. Each slider shows a live-updating `$XK` label during drag. Debounced save (500ms idle) persists to `pf_preferences` and re-scores all feed cards instantly. Both sliders share the same 50-1000K scale. No page refresh needed.

2. **Feed: Company stage checkbox live-update** — Toggling company stage checkboxes (Series B+, Late-stage, Pre-IPO, Public) now immediately saves preferences, re-scores all feed cards, and re-renders the grid with a toast confirmation. Previously, checkbox changes updated in-memory state but required a page refresh to take effect.

3. **Feed: Apify actor support for free actors** — Changed default actor from `valig` (expired) to `logical_scrapers/linkedin-jobs-scraper` (consumption-based, free). Added support for 3 actor input format families: keywords-based (`logical_scrapers`, `happitap`, `fetchclub`), searchUrl-based (`bebity`, `curious_coder`), and field-based (`valig`, `data_wizard`). Auto-detects format from actor ID.

4. **Feed: Null guard on role.location in scoreRole()** — Fixed `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` crash when a feed role has no `location` field. Now defaults to empty string.

5. **Mock Interview: Practiced questions live-update** — Marking a question as practiced now calls `renderQuestionBankUI()` so the "practiced" badge appears immediately without a page refresh.

6. **Research Brief: API key security fix** — After saving an API key, the input field now shows a masked placeholder (`••••••••••••••••`) instead of the full plaintext key. Previously, the full key was set back into `input.value` after 3 seconds. Added guard against re-submitting the masked placeholder.

7. **Skill: Settings Live-Update Pattern added** — Created `docs/skill-patch-settings-live-update.md` documenting the mandatory 5-step live-update pattern (validate → update state → persist → re-render → feedback) and the debounced slider variant. This pattern is now a hard rule for all future settings work.

---

## v3.5.2 — 2026-03-12

### What Changed — Stage Date/Time Manual Override for Analytics

**User requested:** "i'm going to need to be able to manually override date/time for some of the stages so we can get our analytics working properly."

**Changes:**

1. **Pipeline: datetime-local inputs in Stage History** — Stage history timeline now uses `<input type="datetime-local">` instead of `<input type="date">`. Each stage shows the full date AND time (e.g., "03/12/2026, 08:04 PM") and is editable by clicking the calendar icon. New `formatDatetimeLocal(ts)` helper function handles both numeric timestamps and ISO strings, formatting them as `YYYY-MM-DDTHH:MM` for the input.

2. **Pipeline: Fix current stage date editing** — The change handler for stage history date inputs had a bug where editing the *current* stage's date (index `-1`) did nothing. The check `r.stageHistory[idx]` fails for index -1. Now properly detects index -1 and updates `role.lastActivity` instead of stageHistory array entry. Toast distinguishes "Current stage date updated" vs "Stage date updated".

3. **Pipeline: CSS for datetime-local inputs** — Added `max-width: 180px` and matching hover/focus styles for `input[type="datetime-local"]` alongside existing `input[type="date"]` rules.

---

## v3.5.1 — 2026-03-12

### What Changed — Bug Fixes: Accept→Pipeline, Dark Mode Cache, Dismiss Persist

**User reported:** "I accepted a job in the feed and it disappeared" + "still stuck in dark mode on some"

**Changes:**

1. **Feed: Accept → Pipeline integration** — `acceptRole()` now creates a full Pipeline role (stage: "discovered") in `pf_roles` with all metadata (JD text, salary, source, feed metadata, stage history). Also creates a company entry in `pf_companies` if one doesn't exist, with Google Favicon logo via domain guessing. New helper functions: `addRoleToPipeline(feedRole)` creates the role + company, `guessDomain(companyName)` maps common company names to domains with hardcoded overrides and a generic fallback. Toast updated: "✅ [title] at [company] → Pipeline (Discovered)".

2. **Feed: Dismiss persists to localStorage** — `dismissRole()` now calls `saveFeedQueue()` after removing the role from `state.feedItems`, so dismissed roles don't reappear on page reload.

3. **Dark mode cache fix** — Added theme initialization to `data-layer.js` (loaded by all 11 modules): reads `pf_theme` from localStorage and sets `data-theme` attribute on `<html>` element immediately on load. This overrides any stale cached CSS `:root` values. Previously, modules could render in dark mode if the browser had cached an old version of `pathfinder.css` where `:root` had dark values (pre-v3.3.1).

4. **Cache-bust query params** — Added `?v=3.5.1` to `pathfinder.css`, `data-layer.js`, and `claude-api.js` `<script>`/`<link>` tags in all 11 modules. Forces browsers to fetch fresh copies after the dark mode CSS change in v3.3.1.

5. **Fix: Apify companyName array** — `buildApifyInput()` now sends `companyName: [company]` (array) instead of `companyName: company` (string). The valig actor spec requires an array, and the string was returning a 400 error.

---

## v3.5.0 — 2026-03-12

### What Changed — JD-First Scoring Engine + Apify Actor Swap

**User requested:** "update our Match Score to use the JD not the title" + "or both...fallback on title if no JD" + "i'm also getting an error on the enrich"

**Changes:**

1. **Feed: JD-first scoring engine** — Complete rewrite of `scoreRole()`. When a role has a full JD (via Apify enrichment), all title-matching and keyword-scanning now reads the JD text instead of just the title. A `searchText` variable selects the richest available text: full JD when present, title+company+domain when only a stub exists. New scoring tier: target title found in JD (but not in actual title) scores 75/100 in the Role Fit dimension (between exact title match at 100 and seniority-only fallback at 50).

2. **Feed: mustHaveKeywords activation** — `prefs.mustHaveKeywords` (e.g., "product manager", "strategy") was defined in preferences but never wired into the scoring engine. Now incorporated as 60% weight in the Keyword Relevance dimension via a composite formula: `keywordScore = (mustHaveRatio × 100 × 0.6) + (boostScore × 0.4)`. This moved keyword scores from 0 to 38 for most cards.

3. **Feed: Apify actor swap to valig** — Replaced `bebity/linkedin-jobs-scraper` (free trial expired, 403 "actor-is-not-rented") with `valig/linkedin-jobs-scraper` (consumption-based pricing from $5/mo free credits, no rental fee required). New `buildApifyInput()` function auto-detects actor type and sends the correct input format: field-based actors (valig, data_wizard) get `{ title, location, companyName[], rows }`, while searchUrl-based actors (bebity, curious_coder) get `{ searchUrl, count }`.

4. **Feed: Configurable Apify actor** — New "Actor ID (advanced)" field in sidebar settings. Actor ID stored in `pf_apify_actor` localStorage key with `getApifyActorId()` fallback to `DEFAULT_APIFY_ACTOR`. Users can swap actors without code changes if a free trial expires. Button renamed from "Save Token" to "Save Settings".

5. **Feed: Improved error handling** — Specific 403 "actor-is-not-rented" error message with actionable guidance (switch actor in sidebar or rent at console.apify.com). 401/402 errors get descriptive messages. JD extraction handles 6 field name variants across different Apify actors.

---

## v3.4.0 — 2026-03-12

### What Changed — Apify-Powered JD Enrichment Engine

**User requested:** "another thing we need to solve for feed is the ability to get the job description programatically" + "let's go apify free tier" + "the JD is the fulcrum, it should be gotten"

**Changes:**

1. **Feed: Apify JD enrichment engine** — New `enrichRoleJD(role)` function calls Apify's `bebity/linkedin-jobs-scraper` actor via synchronous REST API. Searches LinkedIn for `{title} {company}`, fuzzy-matches the best result (company name + title similarity scoring), and extracts the full JD text. Minimum 300-char threshold to distinguish real JDs from email stubs. Enriched roles get `jdEnriched: true`, `jdEnrichedAt`, `jdEnrichSource`, `jdEnrichConfidence` metadata fields.

2. **Feed: JD quality indicators** — Every feed card now shows a JD quality badge: yellow "📄 Stub JD" for roles with only email-extracted stubs (<300 chars), or green "✓ Full JD" for roles with real JDs. Enriched cards show a JD snippet preview with confidence percentage.

3. **Feed: Per-card "⚡ Enrich" button** — Appears on stub-JD cards when Apify token is set. One-click enrichment with loading animation (pulsing blue badge). Graceful failure handling with toast notifications.

4. **Feed: Batch "Enrich JDs" button** — Header button shows count of roles needing JDs (e.g., "16 need JDs"). Processes all stub-JD roles sequentially with 2-second delays between API calls. Stops gracefully on Apify quota errors. Progress counter updates live.

5. **Feed: Apify settings section** — New sidebar section below preferences: API Token input (password field), connection status indicator (green dot = connected, gray = not connected), "Save Token" button. Token stored in `pf_apify_key` localStorage key.

6. **Feed: Stub JD detection** — `isStubJD(role)` checks JD length (<300 chars) and common email-parsing patterns ("posted via job alert", "application submitted", "interview scheduled", etc.) to reliably identify roles needing enrichment.

**Architecture notes:**
- Apify free tier = $5/month compute credits (~50-200 role enrichments/month)
- Actor: `bebity/linkedin-jobs-scraper` — scrapes public LinkedIn job search pages (no login required)
- API pattern: POST `run-sync-get-dataset-items` — one call starts actor, waits, returns results
- Fuzzy matching: 0-100 confidence score (50pts company name, 50pts title). 40+ required to accept match.
- Enriched JDs persist to `pf_feed_queue` in localStorage, survives page reload.

**Files changed:**
- `modules/job-feed-listener/index.html` (enrichment engine, CSS, sidebar settings, card UI, event handlers)

---

## v3.3.1 — 2026-03-12

### What Changed — Salary Intelligence, Light Theme Default, Score Transparency, Built In Email Source

**User requested:** "let's start w/ salary, push it and then go to resume builder, one thing to note is the pipeline should be salary aware, if it's known to be below my threshold, we should not add to pipeline, if it's unknown say so and I can decide. currently min salary is 250K, target salary is 300K - 450" + "also some tabs are in dark mode and others in light, let's default to light mode and only go to dark mode on user initiated" + "on the feed, can we have transparency on the match score, why is it a 70 vs 30?" + "also for the email feed are you capturing these from Built In?"

**Changes:**

1. **Pipeline: Salary extraction from JDs** — New `extractSalaryFromJD(jdText)` engine with 3 regex patterns: dollar ranges ($172,645 - $375,285), K ranges (192K-330K), and single amounts near salary context words. Sanity checks: $50K-$2M range, min ≤ max. Salary displayed on Pipeline kanban cards with color coding: green (in-range/above), red with ⚠️ (below $250K floor), italic gray (unknown). `evaluateSalary()` returns 'below' | 'in-range' | 'above' | 'unknown'.

2. **Salary preferences system** — New `pf_salary_prefs` localStorage key stores `{ minSalary: 250000, targetMin: 300000, targetMax: 450000 }`. Shared between Pipeline and Feed. `loadSalaryPrefs()` reads with defaults. Seeded on Pipeline init.

3. **Feed: Salary gate on acceptance** — `acceptRole()` checks salary before adding to Pipeline. If listed salary max is below $250K floor, shows confirm dialog warning the user. Unknown salary always allowed through. Feed comp defaults updated: minBase 285K→250K, targetBase 350K→300K.

4. **Theme: Light mode default** — Swapped `pathfinder.css` so `:root` = light mode values (was dark). `[data-theme="dark"]` = dark override. All modules with `initTheme()` now default to `'light'` (Pipeline, Dashboard, Sync, Calendar). Modules without theme code (Feed, Research, Resume, etc.) automatically get light mode from `:root`.

5. **Feed: Score breakdown transparency** — Replaced hidden hover tooltip with visible inline color-coded dimension chips on both feed cards and snoozed cards. Each dimension (Title, Domain, Keywords, Location, Network, Stage, Comp) shows its score with tier coloring: green (70+), yellow (40-69), red (0-39).

6. **Feed: Built In email source** — Parsed `support@builtin.com` job alert emails and added 5 new roles to `gmail-seed.json`: GEICO ($146K-$230K), Amplitude ($200K-$301K), Zendesk ($183K-$275K), DIRECTV ($122K-$222K), Autodesk ($125K-$224K). Built In added as active source in FEED_SOURCES. Source badge shows "Gmail / Built In".

**Files changed:**
- `modules/pipeline/index.html` (salary extraction engine, salary CSS, card rendering, prefs seeding, theme default)
- `modules/job-feed-listener/index.html` (comp defaults, salary gate, score breakdown CSS+HTML, Built In source)
- `modules/job-feed-listener/gmail-seed.json` (16 → 22 items: +5 Built In + 1 Zendesk dedup)
- `modules/shared/pathfinder.css` (theme swap: `:root` light, `[data-theme="dark"]` dark)
- `modules/dashboard/index.html` (theme default)
- `modules/sync/index.html` (theme default)
- `modules/calendar/index.html` (theme swap: inline CSS light default)

---

## v3.3.0 — 2026-03-12

### What Changed — LinkedIn Network Prioritization, Pipeline Dedup, Dashboard Overhaul, Fuzzy Match Fix

**User requested:** "on the Job Feed, make sure we are connecting my LinkedIn connections to see who I know and use it to prioritize the feed, also I see roles I already applied for in the feed, those should already be in an accepted state" + "Also in the action queue on the dashboard, you need to give both company name and role, I don't know what I'm looking at by role name alone, make sure you put company logo in the dashboard as well" + "There may be an issue with LinkedIn 1st connections being tied to a company — I know these two don't work at VectorOne"

**Changes:**

1. **Feed: LinkedIn network scoring (new 7th dimension)** — Feed scoring engine now loads `pf_linkedin_network` (2,687 connections) and `pf_connections` (64 tracked) to score network proximity. New 15% weight dimension: tracked connection at company = 100pts, 3+ LinkedIn connections = 80pts, 1-2 LinkedIn = 50pts, none = 0pts. Purple network badges on feed cards show connection count with tooltip listing names. Scoring weights rebalanced: Title 25→20%, Domain 25→20%, Keywords 20→15%, Location 15% (unchanged), Network 15% (NEW), Stage 10% (unchanged), Comp 5% (unchanged).

2. **Feed: Pipeline dedup** — Feed items that match a role already in the Pipeline at an active stage (applied, screen, interviewing, offer, outreach) are filtered out entirely. Fuzzy company + title matching with "product" keyword fallback. On current data: 5 roles filtered (RingCentral screen, Amazon applied, LiveRamp applied, Yahoo applied, Intuit outreach), 11 remaining.

3. **Dashboard: Action queue overhaul** — Nudge cards now show company logo (via Google Favicon API, with fallback domain guess), and ALL nudge text includes both role title AND company name. Updated 7 nudge rules (rules 2-6, 8-9) that were missing one or the other. Added `getCompanyLogoUrl()` helper that looks up domain from `pf_companies` first, falls back to guessing `companyname.com`.

4. **Fuzzy matching fix (Pipeline + Feed)** — Fixed false positive matches where very short LinkedIn company names like "On" or "CT" would match inside longer company names like "VectorOne". Root cause: `target.includes(liCompany)` with no length guard. Fix: require minimum 4 characters for substring matching, plus word-boundary regex check. Applied to Pipeline `getLinkedInConnectionsForCompany()` and Feed `getNetworkAtCompany()` + `checkPipelineStatus()`.

**Files changed:**
- `modules/job-feed-listener/index.html` (network scoring, pipeline dedup, fuzzy match fix)
- `modules/dashboard/index.html` (logos, company+role text, `getCompanyLogoUrl()`)
- `modules/pipeline/index.html` (fuzzy match fix)

---

## v3.2.1 — 2026-03-12

### What Changed — LinkedIn Job Alert Feed Integration

**User requested:** "is the feed pulling in job postings from my gmail? E.g., the Intuit role" + "also I want provenance, so I can go to the email and click in to get more information"

**Changes:**
1. **LinkedIn Job Alert parsing** — Scans `jobalerts-noreply@linkedin.com` emails, extracts individual job listings (title, company, location, LinkedIn job URL) from the structured email body.
2. **12 new feed items from LinkedIn Alerts** — Intuit (Agentic AI), OpenAI (API Model Behavior), Stripe (ML/GenAI), Microsoft (Human Data), SoFi (AI SDLC), Salesforce (Agentforce), Adobe (AI Measurement), Google Cloud (GPM), Sigma (AI Builder), Netflix (Games), Uber (Consumer Platform), Harvey (Data & Retrieval).
3. **Dual-link provenance badges** — LinkedIn items show "LinkedIn ↗" (links to job posting) + "✉️" (links to Gmail alert email). Gmail items still show "Gmail ↗" → original email.
4. **LinkedIn active in FEED_SOURCES** — New source card in Sources tab.
5. **Updated scheduled task** — `pathfinder-gmail-sync` now scans both direct recruiter emails AND LinkedIn Job Alert emails.

**Files changed:**
- `modules/job-feed-listener/index.html` (LinkedIn source, dual-link badges, secondary badge CSS)
- `modules/job-feed-listener/gmail-seed.json` (4 → 16 items: 4 Gmail + 12 LinkedIn)

---

## v3.2.0 — 2026-03-12

### What Changed — Live Gmail Feed + Source Linking

**User requested:** "I'm not seeing any of the jobs that are in my inbox... nor do I see the source of where they are coming from, if it's an email I should be able to link back to the actual email so I can click in"

**Changes:**
1. **Removed all demo data** — Deleted `DEMO_FEED_ITEMS` (16 fake roles) and `DEMO_FEED_RUNS` (4 fake run records) from Feed module. Auto-cleanup on init purges any stale demo items with `feed-*` IDs from localStorage.
2. **Real Gmail data seeding** — Created `gmail-seed.json` with 4 real job emails extracted from user's Gmail: RingCentral (interview), Amazon Ads (referral from Sam Blum), LiveRamp (referral from Manoj Kumar), Yahoo (referral from Giovanni Gardelli). Feed loads this on first open.
3. **Clickable source badges** — Each feed card's source badge (e.g., "Gmail ↗") is now a link that opens the original email in Gmail. New `.card-badge-link` CSS with hover state.
4. **Referral badges** — Cards show "🤝 Referred by {name}" when `feedMetadata.referredBy` is present. New `.referral-badge` CSS.
5. **Auto-refresh timer** — Feed reloads from localStorage every 15 minutes to pick up items added by the MCP sync agent. Also syncs on initial page load (sync-on-open).
6. **Honest "Check Now" button** — Replaced fake toast ("Found 3 new roles!") with actual feed reload and re-score.
7. **Scheduled Gmail sync task** — Created hourly Cowork scheduled task (`pathfinder-gmail-sync`) that scans Gmail for job-related emails and updates `pf_feed_queue`.
8. **Research Brief bridge fallback fix** — Removed blocking `showBridgeError()` + `return` in `generateBrief()`. Now calls `await checkBridgeHealth()` which sets `state.useFallbackAPI = true`, letting `generateSectionViaAPI()` automatically use the direct Claude API path.

**Files changed:**
- `modules/job-feed-listener/index.html` (removed demo constants, added seed loading, source linking, referral badges, auto-refresh, honest Check Now)
- `modules/job-feed-listener/gmail-seed.json` (new — real Gmail feed items)
- `modules/research-brief/index.html` (bridge fallback fix)

---

## v3.1.0 — 2026-03-12

### What Changed — Inline Comms Per Contact

**User requested:** "is there an opportunity to tie the notes in w/ the contacts section? Like should the comms log be associated w/ the contact instead of it's own section?"

**Changes:**
1. **Expandable tracked connection cards** — Each tracked contact card is now clickable. Clicking expands to reveal that contact's comms history (from `role.commsLog`) and a quick-log input. Cards show a purple border when expanded.
2. **Last activity date on cards** — Each collapsed card shows the date of the most recent comms entry, so you can see at a glance when you last interacted with someone.
3. **Quick-log per contact** — Inside each expanded card: a channel selector (email/LinkedIn/phone/video/in-person) + note textarea + "Log" button. Notes are automatically tagged with the contact name in `role.commsLog`.
4. **Removed standalone Comms Log section** — The separate "Comms Log" section is gone. Contact-specific comms live inside the cards. General notes (not tied to a contact) appear in a collapsible "General Notes" section only when they exist.
5. **General Notes section** — Non-contact comms entries are shown in their own collapsible section below Artifacts, with a quick-add input for logging general role notes.

**Files changed:**
- `modules/pipeline/index.html` (CSS: expandable cards, comms panel, quick-log. JS: `toggleConnCard()`, `quickLogComms()`, updated `buildConnectionsList()`, updated `addCommsEntry()`. Template: removed standalone Comms Log, added General Notes.)

---

## v3.0.0 — 2026-03-12

### What Changed — MCP-Backed Data Layer + Unified Connections

**User requested:** "Everything in localStorage also has MCP backup / reads from MCP server" and "how shall we collapse these into one section?" (re: separate Connections and LinkedIn Network sections)

**Changes:**

#### MCP-Backed Data Persistence
1. **Created `modules/shared/data-layer.js`** — Core data persistence layer. Monkey-patches `localStorage.setItem` and `localStorage.removeItem` to transparently sync all `pf_*` keys to the MCP HTTP bridge. 22 data keys synced with 1-second debounce. Excludes API keys and UI-only keys for security.
2. **Added HTTP bridge data endpoints** — 4 new endpoints on the MCP bridge (`PUT /data/:key`, `GET /data/:key`, `GET /data`, `DELETE /data/:key`). Key-value files stored at `~/.pathfinder/data/{key}.json`.
3. **Auto-recovery on startup** — If core localStorage keys are empty (fresh browser, cleared cache), the data layer attempts to recover from MCP bridge automatically. Checks `pf_roles`, `pf_companies`, `pf_connections` as sentinel keys.
4. **Graceful degradation** — If MCP bridge is unavailable, app works via localStorage alone. Console message: `[DataLayer] MCP bridge not available — localStorage only mode`.
5. **Script tag added to all 11 modules** — Every module now loads `data-layer.js` before any other scripts, ensuring all localStorage writes are intercepted.

#### Unified Connections Section
6. **Merged Connections + LinkedIn Network** — The detail panel now shows ONE "Connections (N)" section instead of two. Tracked connections (from `pf_connections`) appear at the top, LinkedIn network connections below, separated by a subtle divider. Total count = tracked + LinkedIn.
7. **De-duplication** — LinkedIn connections that are already in your tracked connections list are automatically filtered out, preventing duplicate display.
8. **Cross-company contacts** — The "Add External Contact" form now includes a Company field so you can add contacts from other companies (e.g., a recruiter at Agency X representing Company Y). Defaults to the role's company if left blank.
9. **Removed redundant Notes field** — Simplified the add contact form by removing the inline notes field (comms log handles note-taking).

**Files changed:**
- `modules/shared/data-layer.js` (NEW — MCP sync layer)
- `mcp-servers/pathfinder-artifacts-mcp/src/http-bridge.ts` (data endpoints)
- All 11 module HTML files (added `data-layer.js` script tag)
- `modules/pipeline/index.html` (merged connections section, de-duplication, cross-company contacts)
- `docs/PRD.md` (version bump + history)

---

## v2.7.0 — 2026-03-12

### What Changed — LinkedIn Network Import

**User requested:** "I want to have a list of all my LinkedIn 1st connections so when I add a new company / role I know if I have any connections I can use for references / back-channel to the hiring manager" and "when listing LinkedIn connections favor those in Product and Engineering and by seniority of title"

**Changes:**
1. **Parsed 2,687 LinkedIn connections** — Python script (`scripts/parse-linkedin-connections.py`) reads LinkedIn data export CSV and produces `pf_linkedin_network.json`. Company names normalized (JPMorganChase → JPMorgan Chase, etc.). Auto-loads into localStorage on first Pipeline visit.
2. **LinkedIn Network section in Pipeline detail panel** — New collapsible "LinkedIn Network (N)" section between Connections and Sibling Roles. Shows connections at the role's company with fuzzy matching (handles "Amazon" matching "Amazon Ads").
3. **Smart sorting by seniority + department** — Connections sorted by: (a) Product and Engineering people first, (b) then by seniority tier (C-level → SVP → VP → Director → Senior → Manager → others). No more alphabetical ordering.
4. **Department badges** — Purple "Product" and blue "Eng" badges on matching titles for quick visual scanning.
5. **Show More button** — Initial view shows top 10 connections (most senior/relevant). "Show N more connections" button expands to the full list.
6. **Promote to tracked connection** — "+ Track" button on each LinkedIn connection creates a `pf_connections` record pre-filled with name, title, LinkedIn URL, and "1st" connection degree.
7. **Kanban card connection counts** — Cards now show combined count of tracked connections + LinkedIn network connections at that company.

**Files changed:**
- `modules/pipeline/index.html` (CSS, template, JS: sorting engine, expand/collapse, promote, dept badges)
- `scripts/parse-linkedin-connections.py` (new — LinkedIn CSV parser)
- `scripts/linkedin-connections.csv` (new — raw LinkedIn export)
- `scripts/migration-output/pf_linkedin_network.json` (new — parsed output, 2,687 records)
- `docs/resume_best_practices.md` (new — saved for future Resume Builder integration)

---

## v2.6.0 — 2026-03-12

### What Changed — Remove Demo Mode (Single-User Architecture)

**User requested:** "let's get rid of Demo Mode, we are just going to have this work for one user (Me), the demo mode is not helpful as of now"

**Changes:**
1. **Deleted `data-switcher.js`** — The Demo/Personal toggle that appeared in every module's nav bar is gone. The app now operates exclusively with Ili's real data.
2. **Removed demo seed logic from 5 modules** — Pipeline, Research Brief, Calendar, Job Feed Listener, and Resume Builder no longer inject demo companies/roles/events when localStorage is empty. If there's no data, you get a clean slate.
3. **Job Feed Listener reads from `pf_feed_queue`** — Instead of rendering hardcoded `DEMO_FEED_ITEMS`, the feed now reads from localStorage (populated by Sync Hub syncs or manual entry). Empty-state banner updated to say "Use Sync Hub to pull jobs."
4. **Preserved useful defaults** — Resume Builder's starter bullet bank (generic resume bullets) is still seeded on first use. Calendar's nudge/sync-log initialization is preserved.
5. **New architectural principle established** — localStorage will be backed by MCP server as source of truth (coming in v3.0.0). No more reliance on migration JSON files for data recovery.

**Files changed:**
- `modules/shared/data-switcher.js` (to be deleted — script tags removed from all 11 modules)
- `modules/pipeline/index.html` (gutted `initializeData()` demo seed)
- `modules/research-brief/index.html` (gutted `initializeDemo()`)
- `modules/calendar/index.html` (gutted `loadOrCreateDemoData()`, kept nudge/theme init)
- `modules/resume-tailor/index.html` (removed mode check, removed demo resume log)
- `modules/job-feed-listener/index.html` (added `loadFeedQueue()`, replaced 3 DEMO_FEED_ITEMS references, updated banner text)

---

## v2.5.0 — 2026-03-12

### What Changed — Pipeline Side Panel Restructure

**User requested:** "research does not need its own tab, it should be part of the Company → Role... also the Comms Log can be long, so we should be able to collapse the text... also in the Resume Storage, it should also allow for other artifacts"

**Changes:**
1. **"Resume Sent" → "Artifacts"** — Renamed the resume section to a general-purpose Artifacts section. Each artifact shows a colored type badge (blue = resume, green = research, yellow = document). New `role.artifacts` array in the data model supports non-resume files. Legacy `resumesSent` entries are merged at render time (backwards compatible, no migration needed).
2. **"Generate Research Brief" button** — New button in the Artifacts section that opens the Research Brief module in a new tab with the role pre-selected via `?roleId=X` URL parameter. Research Brief module updated to read URL params on init.
3. **Collapsible Comms Log** — Comms Log section starts collapsed with a summary showing entry count and latest date. Click the section title to expand/collapse with smooth CSS transitions. The "add new entry" form stays always visible below so you can log without expanding. Reusable `.collapsible` / `.collapsible-content` CSS classes added for future use on other sections.

**Files changed:**
- `modules/pipeline/index.html` (Artifacts section, collapsible comms log, research brief button, new CSS, new helper functions)
- `modules/research-brief/index.html` (URL param deep-linking support)

---

## v2.4.0 — 2026-03-12

### What Changed — MCP Pipeline Backup System

**User requested:** "would it not be safer to store the backup and config into the MCP server rather than localStorage?"

**Changes:**
1. **New MCP tool: `pf_backup_pipeline`** — Takes all `pf_*` localStorage key/value pairs as input, writes a timestamped JSON snapshot to `~/.pathfinder/backups/` with SHA-256 checksum, auto-prunes to keep latest 50 backups
2. **New MCP tool: `pf_restore_pipeline`** — Two modes: `action: "list"` returns all available backups with timestamps, labels, and key counts; `action: "restore"` reads a specific backup and returns the data for the caller to write back into localStorage. Verifies checksums on restore.
3. **HTTP bridge endpoints** — `POST /backup`, `POST /restore`, `GET /backups` added to `http-bridge.ts` for browser access (Sync Hub, Pipeline Tracker, etc.)
4. **Sync Hub auto-backup** — Every `Sync All` run now calls `backupPipeline('after-sync')` which tries MCP first, falls back to localStorage if MCP bridge is unavailable
5. **Backup file format** — Version 1 schema: `{ version, timestamp, label, keyCount, keys, checksum, data }` — designed for forward compatibility

**Architecture:** localStorage remains the live working copy (fast for the browser). MCP backups are the durable layer that survives browser data clears, machine switches, and bad deploys.

**Files changed:**
- `mcp-servers/pathfinder-artifacts-mcp/src/tools/backup.ts` (new)
- `mcp-servers/pathfinder-artifacts-mcp/src/tools/restore.ts` (new)
- `mcp-servers/pathfinder-artifacts-mcp/src/index.ts` (tool registration)
- `mcp-servers/pathfinder-artifacts-mcp/src/http-bridge.ts` (HTTP endpoints)
- `modules/sync/index.html` (auto-backup after sync)

---

## v2.3.2 — 2026-03-12

### What Changed — Migration Data Sync

**User requested:** "before we push anything i want to make sure you capture the current pipeline configuration"

**Changes:**
1. **Updated all 3 migration JSON files** to match the current browser localStorage state:
   - `pf_roles.json`: 3 → 7 roles with real titles, full JD text, comms logs, and resume metadata
   - `pf_companies.json`: 45 → 50 companies with corrected domains and Google Favicon logoUrls
   - `pf_connections.json`: 59 → 63 connections (4 new manual connections added)
2. **Fixed ATS domains** on new companies: LiveRamp (liveramp.com), RingCentral (ringcentral.com), Intuit (intuit.com) — were incorrectly set to Workday/ATS subdomains
3. **Replaced Clearbit logoUrl** references with Google Favicon API in all migration company data
4. **Bumped MIGRATION_VERSION** from 3 → 4 in `data-switcher.js`

**Roles now tracked:**
- Yahoo — Sr. Director Consumer Data Product - Activation (applied/hot)
- LiveRamp — Sr. Director Product Management: Addressability (applied/hot)
- Amazon Ads — Principal Product Manager - Tech, Sponsored Ads (applied/hot)
- RingCentral — Sr. Director of Product (screen/active)
- VectorOne — Head of Product (screen/active)
- Intuit — Principal Product Manager - Agentic Conversational Experiences (outreach/active)
- Yieldmo — Head of Product (researching/hot)

**Files Modified:**
- `scripts/migration-output/pf_roles.json` — complete rewrite (3 → 7 roles)
- `scripts/migration-output/pf_companies.json` — updated (45 → 50, fixed domains + logoUrls)
- `scripts/migration-output/pf_connections.json` — appended 4 new connections (59 → 63)
- `modules/shared/data-switcher.js` — MIGRATION_VERSION 3 → 4

---

## v2.3.1 — 2026-03-11

### What Changed — Sibling Roles in Detail Panel

**User reported:** "from the card I cannot see other roles if they exist"

**Feature:**
1. **"Other Roles at [Company]" section** in the role detail slide-out panel. When a company has multiple roles, this section lists all sibling roles with:
   - Color-coded stage pill (matches kanban stage colors)
   - Tier, target level, and last activity date
   - Click-to-navigate — clicking a sibling opens its detail panel directly
2. Section only appears when the company has 2+ roles (no empty state clutter)
3. **Cleaned test data** — removed debugging test role from localStorage

**Files Modified:**
- `modules/pipeline/index.html` — added sibling role section in `openRoleDetail()`, added `.sibling-role-card` and `.sibling-role-stage` CSS

---

## v2.3.0 — 2026-03-11

### What Changed — Remove Bulk-Select Checkbox + Restore Logos

**Issues reported by user:**
1. Logos missing from kanban cards (Clearbit API is dead/unreliable)
2. Checkbox element not wanted — remove entirely

**Fixes:**
1. **Removed bulk-select checkbox**: Deleted `<input type="checkbox">` from every kanban card, along with all bulk-select CSS, toolbar HTML, and JS functions. This was the "white square" the user saw across 3+ sessions.
2. **Restored logos**: Switched from dead Clearbit API to Google Favicon API (`/s2/favicons?domain=X&sz=128`). Logos load reliably. Letter-initial fallback still works.
3. **New company logos auto-resolve**: When adding a new company, domain is derived from name/URL via `getCompanyDomain`, and Google Favicon fetches the icon automatically.

**Files Modified:**
- `modules/pipeline/index.html` — removed all bulk-select code; switched logo API to Google Favicon

---

## v2.2.2 — 2026-03-11

### What Changed — Fix: Hidden Bulk-Select Checkbox Was the "White Square"

**Root cause found:** The "checkbox in front of the logos" was a *literal* `<input type="checkbox">` element (`.role-card-checkbox`) rendered on every kanban card for bulk selection. It was always visible — an 18×18px white native checkbox at the top-left of each card, right next to the company logo. This is what the user had been reporting as "white squares" / "checkboxes" across three separate reports.

**Fix:** Checkbox is now hidden by default (`opacity: 0; pointer-events: none`). It appears on card hover and when already checked, so bulk-selection still works.

**Files Modified:**
- `modules/pipeline/index.html` — `.role-card-checkbox` CSS updated

---

## v2.2.0 — 2026-03-11

### What Changed — Personal Data Accuracy + Logo Fix + Migration Versioning

**Issues reported by user:**
1. Logo white background looked like checkboxes on dark theme
2. Pipeline stages were wrong — Yahoo and Amazon Ads should be in "applied" (submitted)
3. LiveRamp was missing entirely (not in spreadsheet data)
4. Old data stuck in localStorage even after migration files updated

**Fixes:**
1. **Logo CSS**: Removed `background: #ffffff` and `border` from `.role-card-logo` and `.table-company-logo`. Switched to circular (`border-radius: 50%`), transparent background, 28px size. Fallback letter initials also circular now.
2. **Stage corrections**: Yahoo moved from "outreach" → "applied". Amazon Ads moved from "screen" → "applied". Both with proper stageHistory entries.
3. **LiveRamp added**: New entry in `pf_companies.json` (domain: liveramp.com) and `pf_roles.json` (role-migrated-046, stage: applied, tier: hot).
4. **Migration version system**: Added `MIGRATION_VERSION` constant to data-switcher. When bumped, forces re-seed of personal data on next Personal mode load (clears stale migration data). Stored in `pf_migration_version` localStorage key. Version 2 = current.

**Files Modified:**
- `modules/pipeline/index.html` — logo CSS (circular, transparent, no border)
- `modules/shared/data-switcher.js` — migration version system (MIGRATION_VERSION, migrationNeedsRefresh, markMigrationCurrent)
- `scripts/migration-output/pf_roles.json` — Yahoo/Amazon stages fixed, LiveRamp added
- `scripts/migration-output/pf_companies.json` — LiveRamp added

---

## v2.1.9 — 2026-03-11

### What Changed — Personal Data Integrity + Logo Polish

**Root Cause:** `pf_roles.json` was generated with generic placeholder data (all "discovered" stage, "Open Role" title, no notes). The data-switcher overwrote localStorage on every Demo→Personal switch, destroying any user edits (moved stages, added notes, new roles).

**Fixes:**
1. **Real migration data**: Regenerated `pf_roles.json` from Contact-Outreach.xlsx with actual outreach statuses mapped to Pipeline stages: 6 in Outreach (LinkedIn messages sent), 1 in Screen (meeting scheduled), 38 in Discovered. Personal notes populated from spreadsheet contact notes (per-contact with name and title).
2. **Seed-once data-switcher**: `loadPersonalData()` now only writes migration data if the localStorage key doesn't already exist. Added backup/restore system: switching Personal→Demo backs up core data; switching Demo→Personal restores from backup first, then seeds any missing keys from files.
3. **Logo polish**: Increased to 32px with 6px border-radius, subtle border, purple letter-initial fallback. Added `DOMAIN_OVERRIDES` map for companies whose name doesn't map to a domain (e.g., "Amazon Ads" → amazon.com, "Bounti.ai" → bounti.ai). Table view logos also get letter fallback on error.

**Files Modified:**
- `scripts/migration-output/pf_roles.json` — regenerated with real stages, notes, connection counts
- `modules/shared/data-switcher.js` — seed-once logic, backup/restore functions
- `modules/pipeline/index.html` — logo CSS (32px, border, fallback), DOMAIN_OVERRIDES map, table onerror

---

## v2.1.8 — 2026-03-11

### What Changed — Logo Visibility Fix

Company logos on Pipeline kanban cards were nearly invisible — 20x20px favicon images with a dark background that blended into the dark card theme. Fixed across all 4 logo CSS classes:

- Increased `.role-card-logo` from 20px→28px with white background + 3px padding
- Added white background to `.table-company-logo`, `.company-card-logo`, `.company-lookup-logo`
- Added letter-initial fallback (`.role-card-logo-fallback`) when favicon fails to load — shows first letter of company name in accent color instead of hiding the image

---

## v2.1.7 — 2026-03-11

### What Changed — Personal Mode Roles + Personal-First Principle

Personal mode Pipeline was showing 0 roles because no `pf_roles.json` migration file existed — the data-switcher explicitly set `pf_roles = []`. This meant the most important view in the entire app (the job search kanban) was completely empty when using real data. Fixed across three layers:

#### Migration: Generated pf_roles.json
- Created `scripts/migration-output/pf_roles.json` — one role per company (45 total), all in "discovered" stage
- Used numeric timestamps (matching `Date.now()` format that Pipeline expects) — ISO strings caused "NaN d" display
- Set `positioning: 'ic'` — empty string was falling through to "Mgmt" badge
- Set `stage: 'discovered'` — original `'saved'` value was not in Pipeline's `STAGES` array, causing roles to be invisible

#### Data Switcher: Load Roles File
- Updated `loadPersonalData()` to fetch `pf_roles.json` alongside companies and connections
- Made roles file optional (graceful fallback to `[]` if file doesn't exist)
- Updated console log to include roles count
- Updated header comments to reflect three-file loading

#### Skill: Personal-First Operating Principle
- Added "Personal Mode Is the First-Class Citizen" as a core operating principle in build-with-ili skill
- Updated QA checklist to enforce Personal-first testing order
- Added lesson learned documenting the multi-session pattern of Demo-first testing that left Personal mode broken

---

## v2.1.6 — 2026-03-11

### What Changed — Data Contract Fixes + Calendar Double-Prefix Bug

Interactive QA round 2 uncovered a systemic data contract violation across 4 modules and a critical double-prefix bug in Calendar that broke Personal mode.

#### Cross-Module Data Contract Fix (c.id → c.name)
- **Root cause:** Company objects in `pf_companies` have a `name` field but NO `id` field. Roles in `pf_roles` have a `company` field (string name) but NO `companyId` field. Connections have `name` but NO `id`. Multiple modules were using `c.id` or `role.companyId` for lookups, which always resolved to `undefined`.
- **Outreach (CRITICAL):** Company dropdown option values were all `"undefined"` because `c.id` doesn't exist. Fixed all company and connection option values and find lookups to use `c.name`. Also added selection restore after `renderSidebar()` rebuilds dropdowns (AppState values were lost on re-render).
- **Debrief:** Simplified `getCompanyName(role)` to return `role.company || 'Unknown'` (removed dead `c.id === role.companyId` fallback). Fixed `renderCompanyCard` lookup to use `c.name === companyName`.
- **Calendar:** Fixed 4 locations where `companies.find(c => c.id === role.companyId)` was used — changed to direct `role.company` field access.
- **Pipeline:** Fixed connection option values from `c.id` to `c.name`, and lookup in `addCommsEntry()`.

#### Calendar Double-Prefix Bug (pf_pf_*)
- **Root cause:** Calendar's `getStorageData(key)` and `saveStorageData(key, data)` helpers internally prepend `pf_` to the key parameter (e.g., `localStorage.getItem(\`pf_${key}\`)`). But ALL callers were passing keys that ALREADY included the `pf_` prefix (e.g., `getStorageData('pf_roles')` → `localStorage.getItem('pf_pf_roles')`).
- **Impact:** Calendar module was reading from and writing to `pf_pf_calendar_events`, `pf_pf_roles`, `pf_pf_companies`, etc. — keys that were never populated by other modules. This made Calendar appear completely empty in Personal mode.
- **Fix:** Stripped `pf_` prefix from ALL caller arguments (dozens of replacements): `getStorageData('pf_roles')` → `getStorageData('roles')`, `saveStorageData('pf_calendar_events', ...)` → `saveStorageData('calendar_events', ...)`, etc.
- **Cleanup:** Removed 5 orphaned `pf_pf_*` keys from localStorage.
- **Audit:** Verified all other modules with similar helper patterns (Sync Hub) — no other instances of this bug.

---

## v2.1.5 — 2026-03-11

### What Changed — Data Mode Consistency (Demo/Personal Toggle)

Audit of Demo vs Personal data mode revealed 3 modules missing the data-switcher toggle and an incomplete clearing function.

#### Data-Switcher Added to 3 Missing Modules
- Debrief, Comp Intel, and Sync Hub were the only modules without the Demo/Personal toggle
- Added `<script src="../shared/data-switcher.js"></script>` to all 3 — now all 11 modules have consistent data mode support

#### Data-Switcher Clearing Now Dynamic
- `clearAllData()` previously used a hardcoded `PF_KEYS` array that was missing keys like `pf_resume_log`, `pf_bullet_bank`, `pf_comp_data`, `pf_sync_log`, `pf_feed_queue`
- Replaced with `getAllPfKeys()` which dynamically scans all `pf_*` localStorage keys
- Protects `pf_data_mode`, `pf_anthropic_key`, and `pf_claude_model` from clearing

#### Resume Builder Demo Seeding Guard
- `initializeDemoData()` wrote `pf_resume_log` unconditionally even if the user had real resume data
- Added existence check: `if (!localStorage.getItem('pf_resume_log'))` before writing demo log
- The function already correctly checks `pf_data_mode === 'personal'` and `pf_bullet_bank` existence

#### Known Issues Cleanup
- Removed "Sync Hub has duplicate localStorage keys (`pf_pf_roles`, `pf_pf_companies`)" from known issues — verified helper functions correctly add `pf_` prefix and callers pass unprefixed keys. Bug was already fixed or was never in the code.

---

## v2.1.4 — 2026-03-11

### What Changed — Calendar Bug Fixes (Interactive QA)

Two bugs found during the first Interactive QA pass across all 11 modules.

#### Calendar Add Event Modal Invisible (Bug Fix)
- Clicking "+ Add Event" button did nothing — modal appeared to not open
- Root cause: Shared `pathfinder.css` defines `.modal-overlay` with `opacity: 0` and expects `.modal-overlay.open` to set `opacity: 1`. Calendar module used `.modal-overlay.active` class instead, which only set `display: flex` but never overrode the `opacity: 0` from shared CSS. The modal was technically open but fully transparent
- Fix: Changed all modal class references from `active` to `open` across 8 locations (openModal, closeModal, openAddEventModal, openEventDetail, openCommandPalette, handleOutsideClick, keyboard Escape handler, overlay click handler). Updated local CSS `.modal-overlay.active` to `.modal-overlay.open` with explicit `opacity: 1` and `pointer-events: auto`

#### Calendar Sync Log Shows "undefined" (Bug Fix)
- Sync Log tab displayed "⚠ undefined" for all 3 sync entries instead of the source name
- Root cause: `loadSyncLog()` rendered `entry.action` and `entry.status`, but Sync Hub writes entries with `entry.source` (gcal/indeed/gmail) and no `status` field. Data shape mismatch between writer and reader
- Fix: Renderer now falls back to `entry.source` when `entry.action` is missing, derives `status` from `entry.added > 0`, and builds detail rows from flat entry fields (Added, Skipped, Updated, Errors) when no explicit `details` object exists

---

## v2.1.3 — 2026-03-11

### What Changed — User-Reported Bug Fixes + Pipeline View Architecture Fix

Five bugs discovered during live user testing. All fixed and verified in browser.

#### Logos Broken Across 4 Modules (Bug Fix)
- All company logos showed as broken images / blank squares
- Root cause: Clearbit logo API (`logo.clearbit.com`) was shut down after HubSpot acquisition
- Fix: Replaced all Clearbit URLs with Google Favicon API (`google.com/s2/favicons?domain=...&sz=128`) across 6 files: Pipeline, Calendar, Research Brief, Resume Tailor, and migrate-contacts.py
- Added one-time localStorage migration in Pipeline to patch existing saved company data

#### Pipeline View Toggle Destroying Buttons (Bug Fix)
- Clicking Kanban/Table/Companies buttons caused them to disappear
- Root cause: Old click handler on parent `#view-toggle` div set `textContent` which destroyed all child button elements (event bubbled up)
- Fix: Removed old conflicting handler; proper `switchView()` handlers at bottom of script already existed

#### Research Brief MCP Bridge Notice (UX Fix)
- Scary "MCP bridge not running" warning confused users on load
- Root cause: `checkBridgeHealth()` showed a UI notice when MCP bridge wasn't running
- Fix: Removed UI notice entirely — direct Claude API works fine and is the expected path for most users

#### Pipeline Table View Crash (Critical Fix)
- Switching to Table view crashed with `applyFilters is not defined`
- Root cause: `renderTable()` called `applyFilters(sorted)` but function was never defined
- Fix: Changed to `filterRoles(sorted)` — the existing filter function used by Kanban view

#### Pipeline View Init Architecture Conflict (Critical Fix)
- Pipeline page loaded blank when `pf_view_mode` was 'table' or 'companies' in localStorage
- Root cause: Two competing visibility mechanisms — `render()` toggled inline `display` styles on `.kanban-view` and `.table-view` selectors, while `switchView()` used CSS classes on `.page`. The `.kanban-view` selector matched `.page` (when switchView added that class) instead of `#kanban`, causing the wrong element's display to be toggled
- Fix: (1) Changed page init from `render()` to `switchView(currentViewMode)` for proper CSS class setup. (2) Removed `render()`'s inline display toggling — CSS rules on `.page.kanban-view`, `.page.table-view`, `.page.companies-view` now handle all visibility. (3) Removed `style="display: none;"` from `.table-view` and `.companies-view` HTML containers

---

## v2.1.2 — 2026-03-10

### What Changed — Visual QA Bug Fixes

First-ever browser visual QA pass across all 11 modules uncovered 4 bugs (2 critical module-breakers). All fixed and verified in browser.

#### Dashboard — Match Score Display (Bug Fix)
- Match scores showed "5000% match" instead of "50% match"
- Root cause: `Math.round(item.score * 100)` — score is already stored as a percentage (50 = 50%), not a decimal
- Fix: Changed to `Math.round(item.score)` on line 2627

#### Research Brief — Module Completely Broken (Critical Fix)
- Entire module failed to initialize — dropdown empty, nothing rendered
- Root cause: `deleteBtn.aria-label = 'Delete this brief'` — can't use dot notation with hyphenated HTML attributes
- Fix: Changed to `deleteBtn.setAttribute('aria-label', 'Delete this brief')` on line 2062
- Introduced during the v2.1.0 accessibility polish pass

#### Debrief — Module Completely Broken (Critical Fix)
- Entire module failed to initialize — `SyntaxError: Unexpected identifier 'renderTimelineTab'`
- Root cause: `DebriefApp` is an object literal (`const DebriefApp = {}`), all methods need comma separators between them. 5 methods were missing trailing commas.
- Fix: Added commas at lines 1519, 1571, 1634, 1692, 1767

#### Calendar — Crash on Init (Bug Fix)
- `RangeError: Invalid time value` from `Intl.DateTimeFormat.format()` with invalid Date objects
- Root cause: `new Date(evt.date)` produces invalid Date for some calendar event date formats
- Fix: Added validation guard `if (!(date instanceof Date) || isNaN(date.getTime()))` to both `formatTime()` and `formatDateShort()` functions

---

## v2.1.0 — 2026-03-10

### What Changed — Perfection Pass (All 8 Browser Modules → 100%)

Applied enterprise-grade polish across all modules simultaneously:

#### Error Handling (All Modules)
- Every `localStorage.getItem` / `JSON.parse` wrapped in try/catch with graceful fallbacks
- Empty state messages for all lists, tables, charts, and panels when no data exists
- Form validation: required fields enforced, numeric range checks, date format validation
- CDN script loading failures handled with user-facing error messages

#### Accessibility — WCAG 2.1 AA (All Modules)
- `aria-label` on ALL icon-only buttons across all 8 modules
- `role="alert"` on notification/status elements
- `aria-live="polite"` on dynamic content regions
- Focus management: modals auto-focus first input on open, return focus on close
- Keyboard navigation: Escape closes modals, Enter submits forms, arrow keys navigate

#### Visual Polish (All Modules)
- CSS transitions (150-200ms ease) on ALL interactive elements
- Hover states on every clickable element with shadow elevation
- Loading spinners during Claude API calls
- `cursor: pointer` on all clickable non-anchor elements
- Consistent CSS variable usage throughout

#### Data Validation (All Modules)
- Input sanitization using `.trim()` and `textContent` (prevents XSS)
- Email validation in Outreach, salary validation in Comp Intel, date validation in Calendar/Debrief

#### Code Quality (All Modules)
- Removed all `console.log` statements
- Fixed all TODO/FIXME/HACK comments
- JSDoc comments on every function

---

## v2.0.0 — 2026-03-10

### What Changed — System-Wide Completion Milestone

#### Sync Hub — 70% → 100%
- **Outreach Draft Push**: Reads `pf_outreach_gmail_queue`, displays queued Gmail drafts with subject, recipient, status, and "Push via Gmail API" button
- **Richer Gmail parsing**: New `GMAIL_PATTERNS` object detects recruiter InMail notifications, interview scheduling emails, rejection emails, and offer letters via regex
- **Data freshness indicators**: Green (< 1 hour), yellow (1-24 hours), red (> 24 hours) badges on each sync card based on `pf_sync_log` timestamps
- **Sync statistics dashboard**: Stats row showing total items synced per source with last sync timestamps
- **Sync scheduling UI**: "Last Full Sync" display and "Auto-Sync via Cowork" toggle with `pf_auto_sync_enabled` localStorage
- **Export sync log**: Downloads sync log as JSON file (`pathfinder-sync-log-YYYY-MM-DD.json`)

#### Dashboard — 90% → 100%
- **Google Calendar integration card**: Next 3 upcoming events from `pf_calendar_events` with countdown timers ("in 2 hours", "tomorrow at 3pm") and color-coded type badges (interview=red, networking=blue, prep=green)
- **Sync status indicator**: Top banner showing "Last synced: X ago" from `pf_sync_log`, amber warning if stale (> 24h)
- **Quick actions row**: 4 buttons — Add Role, Research Company, Practice Interview, Check Job Feed — with Lucide icons and hover effects
- **Debrief pending badge**: Counts past interview events without debriefs, shows "X interviews to debrief" with link to Debrief module
- **Outreach queue indicator**: Shows pending draft count from `pf_outreach_gmail_queue` with "Review & Send" link

#### Pipeline Tracker — 95% → 100%
- **Clay company enrichment display**: "Company Intelligence" section in company detail modal showing funding, headcount, techStack, investors, recentNews if Clay data exists; "Enrich via Sync Hub" link if not
- **Auto-enrichment status badges**: Green checkmark (enriched) or gray circle (pending) on company cards in Companies View
- **Role stage analytics**: Conversion rates between stages (e.g., "Applied → Screen: 45%"), average days per stage, horizontal funnel chart
- **Stale role detection**: Amber border + "Stale — X days" badge on roles not updated in 14+ days

#### MCP Artifacts Server — 45% → 95%
- **All 7 tools fully implemented**: save, get, list, search, tag, delete, generate-brief-section (previously stubs)
- **Enhanced storage layer**: SHA-256 checksums, auto-generated excerpts, full-text search with relevance scoring (0-1) and context snippets
- **Tag management**: Add/remove operations with deduplication
- **Delete modes**: Soft delete (archive with metadata) and hard permanent delete
- **Comprehensive README.md**: Setup instructions, tool documentation, usage examples, architecture overview
- **IMPLEMENTATION_STATUS.md**: Technical details, completion checklist, deployment path
- **Note**: Requires `npm run build` on Mac (OOMs in lightweight VMs)

---

## v1.9.0 — 2026-03-10

### What Changed

#### Research Brief — Citation System + Saved Briefs
- **Citation system**: Each generated section now tracks and displays source citations as footnotes with numbered references
- **Source aggregation**: "Sources" section at the bottom of each brief rolls up all citations across all sections
- **localStorage artifact save**: Briefs saved to `pf_research_briefs` with id, company, role, sections, timestamp, and version
- **Saved Briefs panel**: Sidebar panel to browse, load, and delete previously saved briefs (20-brief limit per company)
- Auto-save after generation completes

#### Job Feed Listener — Career Page URL Import + Sources Tab
- **Career page URL import**: Parses URLs from Lever, Greenhouse, Ashby, Workday, and LinkedIn ATS pages. Auto-extracts company name from domain
- **Import URL modal**: Paste or type a career page URL with real-time URL detection and metadata feedback
- **Sources tab**: Analytics cards per source (Sync Hub, Manual, URL Import, etc.), source filtering with checkboxes, horizontal bar chart visualization
- New functions: `parseCareerPageUrl()`, `detectUrlMetadata()`, `renderSourceAnalytics()`, `applySourceFilters()`

#### Comp Intelligence — Indeed Integration + Bulk Import + Market Positioning
- **Indeed salary data integration**: Reads salary ranges from `pf_feed_queue` (Indeed-sourced jobs) via `extractIndeedSalaryData()`
- **Bulk import modal**: 3-tab interface — Paste Data (CSV/JSON/plaintext), Sync Indeed Jobs, Direct Entry
- **Market positioning chart**: Percentile visualization (25th/50th/75th/90th) with 4-color system (red/orange/yellow/green)
- **Enhanced negotiation**: BATNA identification from pipeline, competing offers analysis, leverage points

#### Calendar — Auto-Trigger Debrief
- **Debrief button**: Appears on past interview events, navigates to Debrief module with pre-populated context
- **Pending debrief badge**: Shows count of past interview events without debriefs
- **Cross-module communication**: Writes to `pf_pending_debrief` localStorage key for Debrief module to pick up
- New functions: `eventNeedsDebrief()`, `countPendingDebriefs()`, `triggerDebrief()`, `linkDebriefToEvent()`

#### Debrief — Auto-Populate from Calendar
- **Auto-populate**: Reads `pf_pending_debrief` from localStorage and pre-fills form fields (company, role, date, type)
- **Pending events section**: "Recent Events Needing Debrief" shows past interview events from Calendar that lack debriefs
- **Cross-module sync**: On debrief save, writes `debriefId` back to the calendar event for status tracking
- New functions: `checkPendingDebrief()`, `renderPendingDebriefBanner()`, `getPendingCalendarEvents()`

#### Mock Interview — 100+ Question Bank
- **Question Bank**: 100+ real PM interview questions across 11 companies (Google, Meta, Amazon, Apple, Microsoft, Stripe, Airbnb, Netflix, Uber, Spotify, Coinbase), 7 types, 3 difficulty levels
- **Question Bank tab**: Multi-level filtering by search text, company, type, and difficulty
- **Custom questions**: Users can add their own questions via `pf_custom_questions`
- **Practice tracking**: Tracks practiced questions via `pf_practiced_questions` with timestamps
- **Company-calibrated sessions**: Passes 5 relevant bank questions to Claude as context for more realistic mock interviews

---

## v1.8.0 — 2026-03-10

### What Changed

#### Resume Builder — DOCX/PDF Export
- **DOCX export**: Converts generated resume HTML to a properly formatted Word document using docx.js (client-side). ATS-friendly: Arial font, US Letter, 1-inch margins, no colors, proper heading hierarchy and bullet lists
- **PDF export**: Converts resume preview to PDF using html2pdf.js with portrait orientation, high-quality rendering (2x scale), and clean margins
- Auto-names files as `Resume_{Company}_{Title}.docx/.pdf`
- Both buttons appear in the Phase 2 generation-actions area

#### Outreach — Gmail Integration
- **"Open in Gmail" button**: Pre-fills Gmail compose URL with subject, body, and recipient for email-type messages (cold email, follow-up, thank-you, recruiter response, networking intro). Opens in new tab.
- **"Queue as Gmail Draft" button**: Saves message to `pf_outreach_gmail_queue` localStorage for batch sending via Cowork's Gmail API
- **Draft queue viewer**: Shows queued drafts with subject, recipient, company, role, date. Remove button per draft. Status tracking (pending/synced/sent)
- Smart subject extraction from generated message body
- LinkedIn message types excluded from Gmail buttons (keep existing behavior)

---

## v1.7.0 — 2026-03-10

### What Changed
- **New Module: Sync Hub** (`modules/sync/index.html`) — Bridges external APIs (Google Calendar, Indeed, Gmail, Clay) into Pathfinder's localStorage data layer.

#### Sync Hub Features
- Google Calendar sync: fetches events via MCP, auto-classifies (interview, networking, prep, personal), transforms to `pf_calendar_events` format with dedup by `gcalId`
- Indeed sync: imports job listings with full metadata (company, title, salary, location), scores against `pf_preferences` using the same 6-dimension model as Job Feed, writes to `pf_feed_queue`
- Gmail sync: extracts job leads from Built In, LinkedIn, and recruiter alerts → feed queue; detects application confirmations → creates `pf_roles` entries as "applied" stage with referral tracking
- Clay enrichment: placeholder infrastructure for company enrichment (funding, headcount, tech stack), syncs to `pf_companies`
- File upload: accepts `sync-payload.json` from Cowork for fresh data (drag-and-drop or click)
- Sync log: timestamped activity log showing what was added/skipped per sync
- Event classification engine: keyword-based categorization of calendar events
- Dedup engine: prevents duplicate entries across re-syncs using composite keys

#### Navigation
- Added "Sync Hub" link to all 9 module navbars (dashboard, pipeline, job-feed-listener, research-brief, resume-tailor, outreach, mock-interview, debrief, calendar)

---

## v1.6.0 — 2026-03-10

### What Changed
- **Feature completion pass** — 50+ features added across all 9 browser modules, closing the majority of Phase 1 PRD gaps.

#### Pipeline Tracker
- URL import: parse job posting URLs (Lever, Greenhouse, Ashby, LinkedIn, Workday), auto-extract company from domain
- Bulk actions: select multiple cards, move to stage, change tier, export selected, delete selected
- CSV export: export all roles or companies as downloadable CSV files
- List view sorting: sortable columns with direction toggle, persisted sort preference
- Company view tab: card grid of all companies with logo, tier, role count, last activity
- Fit assessment display: strong/borderline/gaps badges, close reason selector, closure notes
- Keyboard shortcuts: `n` (new role), `f`/`/` (search), `Escape` (close panel)

#### Dashboard
- Feed review section: top 5 highest-scoring feed items with score bars and quick actions
- Interview intelligence card: upcoming interviews from pf_calendar_events with prep/practice links
- Pipeline funnel visualization: horizontal CSS bar chart by stage, clickable to filter
- Activity feed: chronological list of recent events across all modules
- Weekly summary stats: applications, interviews, response rate, pipeline health indicator
- localStorage change listener: real-time re-render when other modules update data

#### Job Feed Listener
- Manual role entry form: full form with company, title, JD, location, salary, domain, stage
- Dedup engine: exact + fuzzy matching (Levenshtein distance) against pipeline, warnings before add
- Quick-check filter: 6-point binary filter (level, domain, location, stage, blockers, interest), 5/6 pass required
- Auto-pipeline creation: creates pf_roles + pf_companies entries, tier based on score
- Feed analytics tab: total discovered, avg score, accept rate, score distribution chart, top companies
- Snooze functionality: 7-day snooze with auto-resurface, dedicated snoozed tab with badge

#### Resume Builder
- Cover letter generation: Claude-powered streaming with role-specific prompts, copy/download
- Bullet bank sidebar: browse/search bullets by category, add new, mark as "must include"
- Keyword gap detection: JD keywords vs bullet bank coverage, covered (green) vs gap (red)
- Version history: per-role version tracking with timestamp, view previous, compare versions

#### Outreach
- Sequence scheduling: schedule follow-ups with date picker, sequence timeline view
- Response tracking: mark as sent/opened/responded/no_response, color-coded status
- Message templates: save/load templates by message type, stored in pf_outreach_templates
- Outreach history: full history view with stats, response rate, timeline grouped by company

#### Mock Interview
- Story bank extraction: Claude analyzes sessions, extracts STAR stories, dedup, saves to pf_story_bank
- Question bank: auto-add questions from sessions, search/filter, "Practice This Question" button
- Session playback: full transcript with color-coded feedback, export as text, copy to clipboard
- Performance trends: CSS bar charts by type, strongest/weakest identification, practice recommendations

#### Debrief
- Pattern analysis: after 5+ debriefs, shows recurring questions, red flags, valued skills
- Research Brief refresh trigger: "Update Research Brief?" prompt after new information
- Debrief timeline: vertical timeline visualization with impression indicators, expandable
- Export: downloadable .txt file and copy-to-clipboard for all 8 sections

#### Comp Intelligence
- Visualization: CSS horizontal bar charts comparing base/bonus/equity across roles
- Comparison table: sortable table with vs-target percentage, above/below highlighting
- Multi-role aggregation: median base, average total, best/worst offers, disclosed vs unknown count
- Negotiation scorecard: 25-point system (5 dimensions × 5 pts each), aggressiveness guidance

#### Calendar
- Month view: grid calendar with event dots, click-to-expand, previous/next navigation
- Day view: 30-minute time slots, event blocks, add event with date pre-fill
- Smart event-role linking: company name autocomplete, auto-link when single role match
- Post-event automation: auto-complete status, debrief banner, stage advancement suggestions

---

## v1.5.0 — 2026-03-10

### What Changed
- **Full system implementation** — All 10 browser modules rebuilt from UI shells to functional applications with real localStorage data and Claude API integration. This is the "make it real" release.

#### Shared Infrastructure
- **Shared Claude API utility** (`modules/shared/claude-api.js`) — Direct browser-to-Anthropic API calls via `anthropic-dangerous-direct-browser-access` header. Supports `generate()`, `stream()`, `converse()`, `generateHTML()`. API key management, model selection, MCP bridge fallback. All AI-powered modules use this.

#### Module Rebuilds
- **Dashboard** — 12-rule nudge engine reading real `pf_roles`/`pf_companies` data. Rules: stale discovered, researching too long, applied no response, screen prep, interview coming, offer pending, pipeline dry, high-value stale, outreach follow-up, rejection pattern, empty pipeline, streak broken. Real streak tracking. Action queue with module deep-links.
- **Job Feed Listener** — Real weighted scoring engine (6 dimensions: title 25%, domain 25%, keywords 20%, location 15%, stage 10%, comp 5%). Full preference editor with tag inputs. Hard caps for excluded domains/keywords (max 39). Feed cards with score breakdown tooltips. Accept/Dismiss/Snooze actions.
- **Research Brief** — Direct Claude API fallback when MCP bridge unavailable. All 14 section prompts embedded in browser JS. Automatic bridge detection with seamless fallback. Same response format from both paths.
- **Resume Builder** — Phase 2: Claude-powered streaming resume generation. Expert system prompt with positioning awareness (IC vs management). Bullet bank context injection. Copy HTML, download, save to pipeline actions. Phase 1 analysis preserved.
- **Outreach** — 8 message types via Claude API (LinkedIn connect, cold email, referral request, thank you, follow-up, recruiter response, networking intro, interest expression). Anti-template system prompt. Context from roles, companies, connections, bullet bank. Copy + save to outreach log.
- **Mock Interview** — Multi-turn Claude conversation via `converse()`. 7 interview types (behavioral, product sense, execution, strategy, design, technical, TMAY). Framework-specific prompts. Session recording to `pf_mock_sessions`. Story bank reference sidebar.
- **Debrief** — 8-section structured form (overall impression, what landed, didn't land, questions asked, priorities, red flags, follow-ups, notes). Claude-powered synthesis generating themes, patterns, recommendations. Storage in `pf_debriefs`. History tab.
- **Comp Intelligence** — Manual comp data entry per role. Market benchmark data points. Comp comparison dashboard. Claude-powered negotiation strategy generation. Target range display from preferences.
- **Calendar** — Manual event entry (Phase 1, no Google Calendar API yet). Week view with colored event blocks by type. Upcoming events sidebar. Pre-interview nudges (24h) with deep links to Research Brief, Mock Interview. Post-interview debrief prompts.

#### MCP Server Fixes
- **Artifact ID collision** — `generate-brief.ts` now includes role ID and section number in artifact ID, preventing sections from overwriting each other
- **Search relevance scoring** — Fixed formula that always returned 1.0; now uses content-length-scaled scoring

### PRD Rule
- **NEW RULE**: Every code change must update the relevant component PRD + main PRD version + changelog. No exceptions.

---

## v1.4.4 — 2026-03-10

### What Changed
- **Abhijay Arora Vuyyuru credited on Job Feed PRD** — Expanded Section 13 ("Inspiration") into "Inspiration & Credits" with dedicated subsection (13.1) for Abhijay's work. Documented five specific Substack articles and n8n workflows that directly shaped the Feed module's architecture: autonomous job hunting agent (Apify + Gemini + Gmail drafting), hidden job market discovery via LLMs, career page scraping with connectors, resume auto-optimization, and the comprehensive AI job search guide. Each workflow linked to the specific PRD sections it influenced. Feed PRD bumped to v1.1.0.
- **PRD updated** — System PRD bumped to v1.4.4

---

## v1.4.3 — 2026-03-10

### What Changed
- **Complete standalone PRD suite** — Every module and agent now has its own standalone PRD with value statement, architecture, data model, UI spec, implementation phases, and cross-module relationships. New PRDs:
  - `pipeline-tracker-prd.md` — Data backbone: companies, roles, 8 lifecycle stages, connections, kanban UI, opaque recruiter flow
  - `dashboard-prd.md` — Daily launcher: action queue, nudge engine, pipeline summary, streak tracking, metrics & analytics
  - `outreach-prd.md` — Message generator: 8 message types, personalization engine, anti-template rules, workflow integration
  - `mock-interview-prd.md` — Practice engine: 7 interview types with frameworks, company-calibrated questions, story bank, TMAY mode, question intelligence scraping
  - `debrief-prd.md` — Post-interview capture: 8-section conversational debrief, pattern analysis after 10+ debriefs, Research Brief refresh triggers
  - `comp-intelligence-prd.md` — Compensation data: market benchmarking, positioning-aware analysis (IC vs mgmt), negotiation support with 25-point scorecard
  - `calendar-prd.md` — Google Calendar bridge: event detection & role matching, pre/post-interview nudges, stage auto-advance
  - `artifacts-mcp-prd.md` — Shared file layer: 6 MCP tools, 10 artifact types, local storage architecture, HTTP bridge
- **PRD updated** — System PRD bumped to v1.4.3

---

## v1.4.2 — 2026-03-10

### What Changed
- **Resume Builder standalone PRD** — `docs/resume-builder-prd.md`. Redefines the Resume Builder as an opinionated, JD-driven agent. Key additions: auto-analysis on role selection, MCP-powered generation (Phase 2), bullet bank as a living system with 4 growth mechanisms (seed, manual, agent-proposed, research-brief-fed), keyword gap analysis, feedback loops between Research Brief and Resume Builder, and cover letter generation
- **Job Feed Listener standalone PRD** — `docs/job-feed-prd.md`. Full spec for the top-of-funnel automation: 5-stage processing pipeline (Extract → Enrich → Dedup → Score → Create), weighted scoring model (title 25%, domain 25%, keywords 20%, location 15%, stage 10%, comp 5%), tiered career page monitoring, Gmail integration with Claude-powered email classification, feed queue for weak matches, and source ROI analytics. Inspired by n8n job automation workflows
- **PRD updated** — System PRD bumped to v1.4.2

---

## v1.4.1 — 2026-03-10

### What Changed
- **Research Brief — Markdown-to-HTML sanitization** — Added `sanitizeContent()` function that converts markdown remnants (bold, italic, headers, numbered/unordered lists, inline code) to proper HTML. Applied at all 3 content insertion points (cache restore, generate, refresh). Fixes sections 11 (Questions to Ask) and 13 (Likely Interview Questions) where Claude API responses contained raw `**bold**` text instead of rendered HTML
- **Research Brief — Stronger system prompt** — Updated the MCP server's `claude.ts` system prompt to explicitly forbid markdown syntax and require HTML-only output. Reduces markdown leakage at the source
- **Resume Builder — Markdown bold in bullets** — Added `mdBold()` helper that converts `**text**` to `<strong>text</strong>` at bullet rendering points. Fixes raw markdown showing in bullet bank entries
- **Resume Builder — Auto-analysis on role selection** — `selectRole()` now auto-runs `analyzeJD()` when a role with existing JD text is selected, instead of requiring the user to manually click Edit JD → Analyze JD. Cached analysis is restored if available; otherwise, analysis runs automatically and gets cached for next time
- **PRD updated** — System PRD bumped to v1.4.1

---

## v1.4.0 — 2026-03-10

### What Changed
- **Research Brief v2 Engine — MCP Server + HTTP Bridge** — Built the actual generation backend that was spec'd in v1.3.8. The MCP server (`pathfinder-artifacts-mcp`) now includes a `pf_generate_brief_section` tool that calls the Anthropic API with section-specific prompts for all 14 sections (0-13). Each section has a custom system prompt, context block (JD, company, connections, bullets, stories, comp data), and output structure matching the PRD spec. Generated sections are cached as artifacts in `~/.pathfinder/artifacts/`
- **HTTP Bridge Server** — Lightweight HTTP server (localhost:3456) runs alongside the MCP server so the browser can POST generation requests. Routes: `POST /api/generate-section`, `GET /api/section-defs`, `GET /api/health`, `GET /api/cached-brief`. Standalone mode available via `npm run bridge` for development without Claude Desktop
- **Browser-side v2 Generation Engine** — Research Brief module rewritten to call the MCP server via HTTP bridge instead of generating template strings locally. 3-batch dependency ordering: pre-batch (Section 0 if no JD), Batch 1 (sections 1-6,8,10 in parallel), Batch 2 (7,9,12,13 depend on Batch 1), Batch 3 (11 depends on all). Real-time skeleton loading states, per-section error handling with retry buttons, and "missing inputs" callouts
- **API Key Settings UI** — New sidebar section for entering/saving Anthropic API key. Key stored in localStorage (`pf_anthropic_key`), sent only to the local MCP bridge server. Visual feedback on save with masked display
- **Keyboard shortcuts extended** — Sections 0-9 via digit keys, sections 10-13 via Shift+0-3. Updated from the old 1-10 range
- **Dynamic progress tracking** — `updateProgress()` now accepts (completed, total) parameters from the generation engine instead of hardcoding 10
- **New MCP server files:** `src/services/claude.ts` (Claude API client + 14 section prompts), `src/tools/generate-brief.ts` (tool handler + Zod validation), `src/http-bridge.ts` (HTTP bridge server), `src/bridge-standalone.ts` (standalone entry point)
- **PRD updated** — Research Brief PRD at v2.0.0. System PRD bumped to v1.4.0

---

## v1.3.10 — 2026-03-10

### What Changed
- **Resume attachment in Pipeline detail panel** — New "Resume Sent" section lets you upload externally-created resumes (PDF or DOCX) via drag-and-drop or file picker. Files stored in IndexedDB (`pf_resumes` database) to avoid localStorage size limits. Metadata (filename, size, date, notes) stored on the role's `resumesSent[]` array. Supports preview (opens in new tab), download, and remove. Multiple resumes per role supported. Upload flow includes a notes field for annotating what version this is
- **Comms Log in Pipeline detail panel** — Timestamped interaction log tied to connections. Each entry captures: free-form note text, channel (Email, LinkedIn, Phone, Video Call, In Person, Other), optional link (email thread, calendar invite, etc.), and optional connection tie (dropdown from company connections). Newest-first timeline with channel icons, contact name, timestamp, note, and clickable link. Complements Stage History with a full audit trail of every interaction
- **PRD updated** — Section 7.1.6 expanded with Resume Sent and Comms Log specs + data model. Bumped to v1.3.10

---

## v1.3.9 — 2026-03-10

### What Changed
- **Company logos on Pipeline cards** — Every role card now shows the company's favicon next to the company name. Uses Google Favicons API (`google.com/s2/favicons?domain=...&sz=128`) instead of Clearbit (which was failing). Added `getCompanyDomain()` helper that parses ATS URLs (Workday `ouryahoo.wd5.myworkdayjobs.com` → `yahoo.com`, Greenhouse, Lever, Ashby, LinkedIn) to extract real company domains
- **Company logo in Pipeline detail panel header** — Detail slide-out now shows the company logo next to company name and role title
- **Company logo in Research Brief sidebar** — Same ATS-aware domain extraction added to Research Brief. Sidebar company card now displays accurate logos
- **Connections section in Pipeline detail panel** — Full connection list with avatar initials, name, title, relationship badge, and LinkedIn profile links (blue "in" icon). Connections stored in `pf_connections` localStorage and counted per-company. "Add Connection" form with name, title, LinkedIn URL, relationship type, and notes
- **Inbound outreach tracking** — New collapsible "Add Contact / Inbound Outreach" section in Add Role modal. Captures contact name, title, email, LinkedIn URL, source (LinkedIn InMail/Email/Referral/Recruiter/Networking/Other), relationship (New/1st/2nd/Recruiter/Referral), and outreach context. Role title is now optional — leaving it blank creates an "Exploratory" role with an "Inbound" badge. Auto-creates a `pf_connections` record when contact info is provided. Auto-sets stage to "outreach" for exploratory roles with a contact
- **Outreach context in detail panel** — Exploratory roles and roles with `knownContext` show an "Outreach Context" section displaying all logged context entries (date, author, content) with a "Log Context" form for adding follow-up notes, call summaries, etc. New `addContextToRole()` function appends to the role's `knownContext[]` array
- **PRD updated** — bumped to v1.3.9

---

## v1.3.8 — 2026-03-10

### What Changed
- **Research Brief v2 overhaul** — Complete redesign from 10 template-based sections to 13 MCP-generated sections. Every section now anchored to JD text and user's actual experience (bullet bank, story bank, connections). New sections: Role Decode, Company Now, Funding & Corporate Structure, Competitive Landscape, Team & Org Intelligence, Network & Connections, Fit Analysis (green/yellow/red requirement mapping), Compensation Intelligence, Strategic Challenges & First 90 Days, Culture & Values Decode, Questions to Ask (organized by interview round), TMAY Script (90-sec + 2-min versions), Likely Interview Questions (with matched STAR stories). Generation via MCP tool `pf_generate_brief_section` in 3 dependency batches. Full standalone PRD at `docs/research-brief-prd.md`
- **Opaque Recruiter Outreach** — New Pipeline feature (Section 7.1.7) supporting three real-world patterns: unknown company with described role, known company with unknown role, and both unknown. New data model fields: `confidential` flag on roles (`{ company: bool, role: bool }`), `knownAttributes` on companies (industry, stage, headcount hints), `roleHints` on roles (function, level, scope hints), `recruiterSource` tracking (name, firm, contact, channel). "Reveal Company" and "Reveal Role" actions in Pipeline detail panel merge partial data into real records, flip confidential flags, trigger brief regeneration, and log citations
- **Research Brief degraded mode** — When roles have partial info, the brief generates what it can and clearly shows what's blocked with an Unlock Roadmap UI. Company-unknown: 5 full + 4 partial + 4 blocked. Role-unknown: 4 full + 5 partial + 4 blocked. Both-unknown: 0 full + 2 partial + 11 blocked. Each blocked section shows exactly what info is needed to unlock it
- **Main PRD Section 7.2 replaced** — Old 10-section spec removed, replaced with v2 summary (13 sections, 3-batch MCP generation) and pointer to standalone PRD
- **PRD updated** — bumped to v1.3.8

---

## v1.3.7 — 2026-03-10

### What Changed
- **Citations & Source Tracking PRD redesign** — rewrote Section 7.12 to center citations on the Artifacts MCP server instead of localStorage. Citations are now a first-class artifact type (`citation`) stored alongside research briefs, JD snapshots, etc. Each citation links a specific claim to its source (email, calendar event, job posting URL, enrichment, AI-generated, or manual entry) with trust levels and staleness tracking
- **Three new MCP tools specified** — `pf_save_citation` (write/deduplicate citation records), `pf_get_citations` (query with filters by company, role, module, source type, staleness), `pf_check_freshness` (batch URL liveness checks with stale flagging). Added to PRD Section 9.2
- **Source Ledger module designed** — centralized read-only table view accessible from Dashboard nav where all citations across all modules roll up. Filterable by company, source type, trust level, freshness, module, and date range. Summary stats with trust distribution and stale count. Row-level actions: expand details, view source, refresh, delete
- **Inline citation display spec** — Research Brief gets `[n]` markers with per-section Sources footer; Pipeline detail panel gets source attribution on stage history entries with deep links (View in Gmail, View in Calendar); Pipeline cards get trust indicator dots; Outreach messages get source tooltips
- **PRD updated** — bumped to v1.3.7

---

## v1.3.6 — 2026-03-10

### What Changed
- **Pipeline: Role Detail/Edit panel** — clicking a role card now opens a slide-out panel from the right with full CRUD capabilities. Editable fields: company, title, positioning, tier, URL (with clickable link), dates (added, last activity), job description. Stage management via button row — click any stage to move forward, revert, or skip. Stage history timeline with editable dates for each transition. Delete button with confirmation. All changes persist to localStorage via `updateRole()`. `updateRole()` now respects explicit `lastActivity` overrides
- **Pipeline: URL Import for Add New Role** — new "Import from Job Posting" section at the top of the Add Role modal. Paste a URL (Workday, Greenhouse, Lever, Ashby, LinkedIn supported), click Import, and the system auto-extracts company name (from URL domain patterns), role title, location, salary, positioning, and JD body text. Uses a 3-proxy CORS chain (allorigins.win → corsproxy.io → codetabs.com) with 10s timeouts each. Falls back gracefully if all proxies fail
- **Research Brief persistence** — previously generated briefs now auto-restore from localStorage cache when you return to the Research Brief page. New `restoreCachedBrief()` function checks for cached sections on role selection and renders them with "Cached" badges and dates. No more losing your brief when navigating away
- **PRD updated** — bumped to v1.3.6

---

## v1.3.5 — 2026-03-10

### What Changed
- **Research Brief generation fixed for Personal mode** — added `normalizeCompanyForBrief()` and `normalizeRoleForBrief()` functions that backfill default values for all fields expected by generation templates. Personal companies only had 6 fields (name, domain, tier, missionStatement, logoUrl, contactCount) vs the 15+ fields templates assumed. `targetLevel` is now inferred from the role title (e.g. "Sr. Director" → `Sr. Director`)
- **Resume Tailor Personal mode guard** — added `pf_data_mode === 'personal'` check to prevent demo bullet bank from seeding. Role selector now handles roles without a standard stage value (groups into "PIPELINE" fallback), and displays `role.company` name when no company match found
- **Dashboard theme toggle fixed** — `updateThemeIcon()` was crashing with `TypeError: Cannot read properties of null` because the nav replacement removed the `#themeIcon` element. Rewrote to swap inline SVGs (sun ↔ moon) on the `#themeToggle` button instead
- **Job Feed sample-data banner** — in Personal mode, a yellow banner now appears above feed cards: "Sample Data — Showing curated job postings scored against your preferences". Clarifies that feed uses curated demo postings in both modes (no real API connections yet)
- **PRD updated** — bumped to v1.3.5

---

## v1.3.4 — 2026-03-10

### What Changed
- **Research Brief role selector fixed** — a `</script>` tag inside the export template literal was terminating the main script block early, causing a `SyntaxError: Unexpected end of input` that prevented `initializeUI()` from ever running. Roles added via Pipeline now appear in the Research Brief dropdown
- **Dashboard nav standardized** — replaced the old `.nav-bar` markup (different class, `<ul><li>` structure, larger font, only 4 links visible) with the shared `.nav` component used by all other modules. All 10 module links now display consistently across every page
- **PRD updated** — bumped to v1.3.4

---

## v1.3.3 — 2026-03-10

### What Changed
- **Personal mode fully fixed across all modules** — added `pf_data_mode` guard to 7 modules (Pipeline, Dashboard, Outreach, Calendar, Comp-Intel, Debrief, Research-Brief) so none of them seed demo data when in Personal mode. Root cause: Dashboard checked `roles.length > 0` (empty = re-seed), Calendar checked `roles.length === 0` (empty = re-seed), and navigating between modules would progressively overwrite personal data with demo companies
- **Debrief role selector grouped by company** — roles now display in `<optgroup>` sections sorted by company name, making it easy to find a specific role. Added `getCompanyNameForRole()` helper to handle both Pipeline schema (`role.company` string) and Debrief demo schema (`role.companyId` lookup)
- **Debrief company card fix** — sidebar company card now gracefully handles both data schemas with fallback for logo, domain, and name
- **PRD updated** — bumped to v1.3.3

---

## v1.3.2 — 2026-03-10

### What Changed
- **Pipeline search covers companies & roles** — search bar and Command Palette (Cmd+K) now search across company name, role title, stage, and positioning. Placeholder updated from "Search roles..." to "Search companies & roles..."
- **Command Palette always shows companies** — previously capped company results at 5; now shows up to 10 mixed results (roles + companies) with domain info in subtitles
- **Personal mode demo data fix** — switching to Personal now sets an empty `pf_roles` array so Pipeline's `initializeData()` doesn't re-seed demo companies. User's real companies appear in the Add Role dropdown
- **PRD updated** — bumped to v1.3.2

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
