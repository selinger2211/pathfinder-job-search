# Job Feed Listener Module — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/job-feed-listener/`
**Version:** v1.1.0
**Last Updated:** 2026-03-10
**Status:** Draft — pending approval

---

## 1. Purpose

The Job Feed Listener is the top-of-funnel engine. Every other module in Pathfinder operates on roles you already know about — the Feed finds them for you. It monitors email, job boards, career pages, and recruiter outreach on a scheduled cadence, scores each discovery against your preference profile, deduplicates against your pipeline, and feeds qualified roles into the system automatically.

**Why this matters more than it sounds:** Early applicants convert at dramatically higher rates. A role posted Monday morning that you discover Thursday has already been buried under 200+ applications. The Feed collapses that gap — surfacing strong matches within hours, not days. At scale (monitoring 20+ target companies, 3 job boards, and daily email), this is the difference between reactive and proactive job searching.

### Design Principles

1. **Signal, not noise.** The Feed's job is curation, not aggregation. A feed that surfaces 50 roles/day is useless. One that surfaces 3-5 high-quality matches is transformative. Scoring and filtering exist to serve this.
2. **Speed is a feature.** For Tier 1 dream companies, a strong match role should appear on your Dashboard within hours of posting. The monitoring cadence is tiered by company priority.
3. **Never lose context.** Every discovered role carries its full provenance: where it was found, when, what the match score was, and why. If a recruiter emailed about it, the recruiter's name and email are attached. If it came from Indeed, the original listing URL is preserved.
4. **Grow the pipeline, don't flood it.** Roles scoring below threshold don't auto-create pipeline entries. They sit in a review queue. The user decides what enters the pipeline — the Feed just does the legwork.
5. **Automation with a kill switch.** Every automated behavior (auto-create, tier suggestions, scoring) is visible and overridable. The Feed never takes irreversible action without the user's approval.

---

## 2. Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────┐
│                    INPUT SOURCES                     │
│                                                     │
│  Gmail ──► Recruiter outreach, job alerts, referrals│
│  Indeed ──► Saved search results via API             │
│  Dice ──► Tech-focused saved searches               │
│  LinkedIn ──► Email alert parsing                    │
│  Career Pages ──► RSS/scraping (Lever, Greenhouse)  │
│  Manual ──► User paste/entry                         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              PROCESSING PIPELINE                      │
│                                                      │
│  Extract ──► Enrich ──► Dedup ──► Score ──► Create   │
│                                                      │
│  • Parse source format       • Fetch full JD if link │
│  • Classify email type       • Auto-create company   │
│  • Extract structured data   • Check vs pipeline     │
│                              • 0-100 weighted score  │
│                              • Auto-create or queue   │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                    OUTPUTS                            │
│                                                      │
│  Pipeline (pf_roles) ◄── Strong matches (40+)       │
│  Feed Queue ◄── Weak matches (20-39) for review     │
│  Dashboard ◄── Notifications, tier suggestions       │
│  Analytics (pf_feed_runs) ◄── Run metadata           │
│  Companies (pf_companies) ◄── Auto-created profiles  │
└──────────────────────────────────────────────────────┘
```

### Implementation Model

The Feed Listener runs as a **scheduled Cowork skill** — not a persistent background process. Each run:

1. Reads `pf_preferences` for scoring criteria
2. Reads `pf_companies` and `pf_roles` for dedup context
3. Checks each configured source for new signals since last run
4. Processes signals through the 5-stage pipeline
5. Writes results to localStorage
6. Logs run metadata for analytics

Runs are idempotent — running twice produces no duplicates because of the dedup stage. The skill can be invoked manually ("check my feed now") or on a schedule via Pathfinder's task scheduler.

### Storage

| Key | Type | Owner | Description |
|-----|------|-------|-------------|
| `pf_preferences` | `object` | Settings | Scoring criteria, target titles, domains, comp range, keywords |
| `pf_feed_runs` | `FeedRun[]` | Feed Listener | Run log with metadata (sources checked, roles found, errors) |
| `pf_feed_queue` | `FeedItem[]` | Feed Listener | Roles scoring 20-39, held for manual review |
| `pf_feed_sources` | `Source[]` | Feed Listener | Configured sources with status, last checked, cadence |
| `pf_roles` | `Role[]` | Pipeline | Where qualifying roles land (shared with all modules) |
| `pf_companies` | `Company[]` | Pipeline | Where new companies land (shared with all modules) |

---

## 3. User Profile — "What I'm Looking For"

The Feed needs a structured version of your preferences to score incoming roles. This profile lives in `pf_preferences` and powers the match scoring engine.

### 3.1 Preference Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `targetTitles` | `string[]` | Role titles you're targeting | `["Senior PM", "Staff PM", "Principal PM", "Director of Product", "VP Product"]` |
| `targetLevel` | `enum` | Seniority range | `senior` through `vp` |
| `positioning` | `enum` | Default IC/management framing | `ic` (with `management` for smaller companies) |
| `primaryDomains` | `string[]` | Core domain interests | `["AdTech", "AI/ML", "Data Platforms", "Enterprise SaaS"]` |
| `secondaryDomains` | `string[]` | Open to if strong fit | `["Infrastructure", "Security", "Healthcare"]` |
| `excludedDomains` | `string[]` | Hard no | `["Crypto", "Gaming", "Consumer Social"]` |
| `companyStage` | `string[]` | Acceptable stages | `["Series B+", "Late-stage", "Pre-IPO", "Public"]` |
| `minHeadcount` | `number` | Minimum company size | `100` |
| `location` | `string[]` | Acceptable locations | `["Remote", "Hybrid (SF Bay)", "San Francisco"]` |
| `excludedLocations` | `string[]` | Non-starters | `["On-site outside SF Bay"]` |
| `compRange` | `object` | `{minBase, targetBase, maxTotal}` | `{minBase: 285000, targetBase: 350000, maxTotal: 450000}` |
| `mustHaveKeywords` | `string[]` | Hard requirements in JD | `["product manager", "strategy"]` |
| `boostKeywords` | `string[]` | Strong positive signals | `["AdTech", "targeting", "LLM", "agents", "real-time"]` |
| `excludeKeywords` | `string[]` | Disqualifiers | `["junior", "associate", "intern", "contract"]` |

### 3.2 Preference Versioning

The preference profile should be versioned. When you tighten or relax criteria, the Feed stores a snapshot so you can correlate preference changes with match rate changes. Did relaxing the location filter actually surface better roles? The data answers this.

### 3.3 Preference UI

The Feed sidebar exposes the preference editor:
- **Target Roles section** — title pills (add/remove), seniority range slider
- **Domains section** — primary/secondary/excluded with drag-to-reclassify
- **Location section** — tag input with preset options (Remote, Hybrid, On-site) + city autocomplete
- **Comp section** — range slider with min/target/max
- **Keywords section** — must-have, boost, exclude — each as a tag input
- **Quick-Check toggles** — the 6-point filter (see Section 5.5), each individually disableable

---

## 4. Input Sources

The Feed monitors multiple channels. Each source has different signal quality, extraction complexity, and monitoring frequency.

### 4.1 Source Configuration

| Source | Method | Signal Quality | What It Captures | Default Cadence |
|--------|--------|---------------|-----------------|-----------------|
| **Gmail — Recruiter Outreach** | Gmail MCP connector | High (pre-qualified) | Company, role, recruiter name, JD text or link | Every run |
| **Gmail — Job Alert Emails** | Gmail MCP connector | Medium (keyword-matched) | LinkedIn/Indeed/Glassdoor alerts with role title, company, link | Every run |
| **Gmail — Networking Follow-ups** | Gmail MCP connector | High (warm lead) | Contact name, company, potential role mentions | Every run |
| **Indeed API** | MCP connector | Medium | Full JD text, company, location, salary range, posting date | 3x/week |
| **Dice API** | MCP connector | Medium (tech-focused) | Full JD text, company, tech requirements | 3x/week |
| **LinkedIn Saved Searches** | Email alert parsing | Medium | Role title, company, link (JD requires click-through) | As alerts arrive |
| **Company Career Pages** | RSS/scraping (Lever, Greenhouse, Ashby) | High (direct) | Full JD, team, level | Tiered by company priority |
| **Manual Entry** | Feed UI | Highest | Full role details entered by user | On-demand |

### 4.2 Source Priority

Processing order matters. High-signal sources first:
1. Gmail recruiter outreach (inbound, pre-qualified)
2. Gmail networking follow-ups (warm leads)
3. Gmail job alert emails (keyword-matched)
4. Company career pages (direct, fresh)
5. Job board APIs (broad, structured)

### 4.3 Career Page Monitoring (Tiered Cadence)

Career pages are monitored on a schedule tied to company tier:

| Company Tier | Check Frequency | Rationale |
|-------------|----------------|-----------|
| Hot (Tier 1) | 3x/week (Mon/Wed/Fri) | Dream targets — speed matters most |
| Active (Tier 2) | Weekly (Monday) | Actively tracking, but not urgent |
| Watching (Tier 3) | Monthly (first Monday) | Keeping an eye out |
| Dormant (Tier 4) | Not monitored | User must manually add |

The Feed supports adding career page URLs in the source configuration. For companies using standard ATS platforms (Lever, Greenhouse, Ashby, Workday), the Feed can auto-detect the job listing format and extract structured data. For custom career pages, it falls back to general scraping with Claude-powered parsing.

### 4.4 Gmail Integration

Gmail is the highest-value source because it captures inbound signal — recruiters reaching out to you, job alerts from saved searches, and networking follow-ups mentioning opportunities.

**Email Classification:**
Claude-powered classification distinguishes:
- `recruiter_outreach` — direct recruiter messages about specific roles
- `job_alert` — automated emails from LinkedIn, Indeed, Glassdoor with role listings
- `networking_followup` — messages from contacts mentioning potential roles or companies
- `irrelevant` — newsletters, marketing, spam

Only the first three types proceed through the pipeline.

**Extraction from recruiter emails:**
- Company name (from email domain + body parsing)
- Role title (from subject line + body)
- Recruiter name and email (for Pipeline connections)
- JD text or link (inline or attached)
- Comp mentions (if present)

**Extraction from job alert emails:**
- Role title, company, posting URL (template-based parsing — LinkedIn/Indeed/Glassdoor have consistent formats)
- Multiple roles per email (LinkedIn alerts often contain 5-10 listings)

---

## 5. Processing Pipeline

Every incoming signal follows a five-stage processing pipeline. Each stage has clear inputs, outputs, and failure modes.

### 5.1 Stage 1: Extract

Parse the source to extract structured data. Different sources require different strategies:

| Source Type | Extraction Method |
|-------------|------------------|
| Recruiter email | Claude-powered parsing (classify + extract) |
| Job alert email | Template-based parsing (LinkedIn/Indeed have consistent HTML) |
| Job board API | Structured API response (already structured) |
| Career page RSS | HTML parsing + ATS-specific extractors |
| Manual entry | User-provided structured input |

**Output:** A normalized `RawFeedItem` object:
```typescript
interface RawFeedItem {
  sourceType: 'recruiter_email' | 'job_alert' | 'job_board' | 'career_page' | 'manual';
  sourceId: string;          // Email messageId, posting URL, etc.
  company: string;
  title: string;
  url?: string;              // Link to the original posting
  jdText?: string;           // Full JD text (if available)
  location?: string;
  salary?: { min?: number; max?: number; currency?: string };
  postingDate?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  extractedAt: string;       // ISO timestamp
}
```

### 5.2 Stage 2: Enrich

For signals that only have a link (e.g., LinkedIn alert emails), attempt to fetch the full JD text:
- **Public postings** (Lever, Greenhouse, company websites): scrape and extract JD text
- **Behind authentication** (LinkedIn): log the link, flag for manual JD paste
- **New companies**: auto-create a sparse company profile (name, domain, inferred tier)

Enrichment also attempts to resolve company identity — mapping email domains and company names to existing `pf_companies` records.

### 5.3 Stage 3: Deduplicate

Before scoring, check for duplicates against the existing pipeline:

| Match Type | Condition | Action |
|-----------|-----------|--------|
| **Exact** | Same company + same title + same URL | Skip; update `lastSeenDate` on existing role |
| **Fuzzy** | Same company + similar title (edit distance < 3) + posted within 30 days | Flag as potential duplicate for user review |
| **Repost** | Same company + same title + new URL + previous role was `ghosted`/`role_frozen` | Flag as potential repost, suggest re-engaging |

Dedup runs against both active pipeline entries and recently closed roles (last 90 days).

### 5.4 Stage 4: Score

Each extracted role is scored against the user profile. The scoring model produces a **match score (0-100)** with a transparent breakdown.

**Scoring Dimensions:**

| Dimension | Weight | How It's Calculated |
|-----------|--------|-------------------|
| Role Fit | 20% | **JD-first (v3.5.0):** When full JD exists, scans JD for target title keywords (100=exact title match, 75=title found in JD body, 50=seniority match). When stub JD only, falls back to title-only matching (v3.3 behavior). |
| Domain Match | 20% | Uses `searchText` (full JD when available, title+company+domain when stub). `primaryDomains` = full points, `secondaryDomains` = half. `excludedDomains` = instant disqualify. |
| Keyword Relevance | 15% | **Composite score (v3.5.0):** 60% `mustHaveKeywords` fulfillment ratio + 40% `boostKeywords` density. Both scan `searchText` (JD-first, title-fallback). Formula: `keywordScore = (mustHaveRatio × 100 × 0.6) + (boostScore × 0.4)`. |
| Location Match | 15% | Role's location/remote policy matches preferences? Remote = full points if preferred, on-site in excluded location = 0 |
| Network Signal | 10% | LinkedIn connections at the company (from `pf_linkedin_network`). 3+ = full, 1-2 = half, 0 = zero. |
| Company Stage | 10% | Company stage/size matches `companyStage` and `minHeadcount`? |
| Comp Signal | 10% | If salary range disclosed, does it overlap with `compRange`? No disclosure = neutral (don't penalize) |

**Score Interpretation:**

| Score | Classification | Action |
|-------|---------------|--------|
| 80-100 | **Strong Match** | Auto-create in pipeline at `discovered` stage, suggest Hot tier, Dashboard notification |
| 60-79 | **Good Match** | Auto-create in pipeline, suggest Active tier |
| 40-59 | **Moderate Match** | Auto-create in pipeline, suggest Watching tier |
| 20-39 | **Weak Match** | Hold in Feed Queue (no pipeline entry), available for manual review |
| 0-19 | **No Match** | Discard silently |

Hard cap: roles with `excludeKeywords` present get max score of 39 regardless of other factors.

### 5.5 Role Quick-Check Filter

Before the full scoring pipeline, a fast 6-point binary filter eliminates clearly unfit roles:

| # | Check | Pass Condition |
|---|-------|---------------|
| 1 | Level appropriate? | Title maps to target seniority range |
| 2 | Domain relevant? | At least one `primaryDomain` or `secondaryDomain` keyword in JD |
| 3 | Location OK? | Remote, or hybrid/on-site in an accepted location |
| 4 | Company stage OK? | Not below minimum stage threshold |
| 5 | No hard blockers? | None of `excludeKeywords` present |
| 6 | Interesting problem? | At least 2 `boostKeywords` present (proxy for genuine interest) |

Roles must pass 5 of 6 checks to proceed to scoring. Exception: Tier 1 company roles get a pass (dream targets always get scored).

### 5.6 Stage 5: Create & Notify

For roles scoring 40+, the Feed creates a pipeline entry:

```typescript
interface FeedCreatedRole {
  id: string;                // Auto-generated
  company: string;           // Extracted or matched to existing
  title: string;
  url: string;
  jdText: string;            // Full JD (or empty if behind auth)
  positioning: string;       // From user default preference
  source: 'job_feed';
  stage: 'discovered';
  dateAdded: string;
  feedMetadata: {
    sourceType: string;
    sourceId: string;
    matchScore: number;
    matchBreakdown: Record<string, number>;
    extractedAt: string;
    recruiterName?: string;
    recruiterEmail?: string;
  };
}
```

The Dashboard surfaces new discoveries in a **Feed Review** section, grouped by match quality. Each card shows the score with a breakdown tooltip, and one-click actions: **Accept** (confirms in pipeline), **Dismiss** (archives), or **Snooze** (hide for 7 days).

---

## 6. Feed Review UI

The Feed module's browser interface is the review and configuration surface. It's NOT where the processing happens (that's the scheduled skill) — it's where the user reviews results, configures sources, and tunes preferences.

### 6.1 Layout

Two-panel design: sidebar (left, 320px) + feed content (right, fills remaining).

**Sidebar sections:**
- Preferences editor (collapsible sections for each preference category)
- Source status (last checked, next scheduled, error count per source)
- Feed analytics summary (roles this week, avg score, acceptance rate)

**Main content:**
- Feed header with title, view toggle (card/list), and filter controls
- Feed cards sorted by score (descending), grouped by match tier
- Each card shows: company logo, role title, match score bar, source icon, posting date, one-click actions

### 6.2 Feed Card

Each feed card displays:

```
┌──────────────────────────────────────────────────┐
│ [Logo]  Company Name                    Score: 87│
│         Role Title                      ████████░│
│                                                  │
│  Source: Indeed  •  Posted: 2 days ago            │
│  Domain: AdTech  •  Location: Remote             │
│                                                  │
│  Keywords: targeting, real-time, privacy          │
│                                                  │
│  [Accept ✓]  [Dismiss ✗]  [Snooze ⏰]  [View →] │
└──────────────────────────────────────────────────┘
```

**Score bar:** Color-coded by tier (green 80+, blue 60-79, yellow 40-59, gray 20-39). Hovering reveals the breakdown tooltip showing points per dimension.

**Accept** moves the role to the Pipeline in `discovered` stage. **Dismiss** archives it (hidden from feed, logged for analytics). **Snooze** hides for 7 days, then resurfaces. **View** opens the full JD in a slide-out panel.

### 6.3 Filters

The feed can be filtered by:
- Score range (slider)
- Source type (checkboxes)
- Domain (tag filter)
- Location (tag filter)
- Date range (posted within)
- Status (new, snoozed, dismissed — with "show dismissed" toggle)

### 6.4 Feed Queue

Below the main feed, a collapsible "Weak Matches" section shows roles scoring 20-39. These didn't auto-create pipeline entries but are available for manual review. The user can promote any of these to the pipeline with one click.

### 6.5 Source Management

A dedicated "Sources" tab in the sidebar lets the user:
- Add/remove career page URLs for monitoring
- Configure cadence per source (override defaults)
- View source health (last successful check, error log)
- Enable/disable individual sources
- Test a source configuration ("check now" button)

---

## 7. Company Auto-Creation

When the Feed encounters a company not yet in the system, it auto-creates a profile:

| Source | Auto-populated Fields |
|--------|----------------------|
| Recruiter email | `name`, recruiter added as connection |
| Job board API | `name`, `hqLocation`, sometimes `headcount`, `fundingStage` |
| Career page | `name`, `domain` (from URL) |
| Job alert email | `name` only |

New companies start at **Dormant** tier by default. The match score on the triggering role may suggest a higher tier. The profile completeness indicator flags the sparse profile for enrichment.

**Frequency signals:** If a company appears multiple times (multiple roles, recruiter + job board), the Feed logs this as a signal that may suggest tier promotion — even before the user reviews the roles.

---

## 8. Tier Management Suggestions

The Feed actively manages the funnel by suggesting tier changes:

### Promotion Triggers
- Strong match role (80+) at a Dormant/Watching company → suggest promoting to Hot/Active
- Multiple roles posted at a company within 30 days → suggest promoting (active hiring signal)
- Recruiter outreach from a pipeline company → suggest promoting (inbound signal)
- Networking contact mentions a role at a pipeline company → suggest promoting

### Demotion Signals
- No new roles at a Hot company for 60+ days → suggest demoting to Watching
- All roles at a company closed as `rejected`/`ghosted` → suggest demoting to Dormant
- Company in layoff news → flag for review (possible hiring freeze)

All suggestions are surfaced as nudges on the Dashboard. The Feed **never auto-changes tiers** — the user decides.

---

## 9. Feed Analytics

The Feed tracks its own performance to help tune the scoring model:

| Metric | What It Measures | Why It Matters |
|--------|-----------------|----------------|
| **Volume** | Roles discovered per week, by source | Are sources producing enough signal? |
| **Quality** | Average match score by source, accept rate by score band | Are high scores actually good matches? |
| **Speed** | Time from posting to discovery, time from discovery to user action | Is the Feed fast enough for competitive advantage? |
| **Conversion** | % of feed-discovered roles advancing past `discovered` | Are accepted roles turning into real applications? |
| **Source ROI** | Which sources yield best conversion (not just volume) | Should you add/remove sources? |

The analytics UI lives in the Feed sidebar as a collapsible summary, with a full analytics view accessible from the Dashboard.

---

## 10. Scheduled Execution

### 10.1 Default Schedule

| Task | Frequency | Timing |
|------|-----------|--------|
| Check Gmail (all types) | Every run | On each scheduled execution |
| Scan job board APIs | 3x/week | Monday, Wednesday, Friday morning |
| Check Tier 1 career pages | 3x/week | Monday, Wednesday, Friday |
| Check Tier 2 career pages | Weekly | Monday morning |
| Check Tier 3 career pages | Monthly | First Monday |

### 10.2 Trigger Modes

- **Scheduled** — runs automatically per the cadence above via Pathfinder's task scheduler
- **Manual** — user clicks "Check Now" in the Feed UI or invokes from Dashboard
- **Event-driven** — future: trigger on new Gmail notification (requires webhook)

### 10.3 Run Logging

Every run is logged:

```typescript
interface FeedRun {
  id: string;
  startedAt: string;
  completedAt: string;
  sourcesChecked: string[];
  signalsProcessed: number;
  rolesCreated: number;
  rolesDuplicate: number;
  rolesQueued: number;      // Sent to feed queue (weak matches)
  rolesDiscarded: number;
  errors: { source: string; message: string }[];
}
```

---

## 11. MCP Tools

The Feed exposes tools for other agents to query:

| Tool | Parameters | Returns | Description |
|------|-----------|---------|-------------|
| `check_feed` | `{sources?: string[]}` | `{discovered, processed, errors}` | Trigger a feed check |
| `get_feed_status` | `{}` | `{lastRun, nextScheduled, sourceStatus[]}` | Source health overview |
| `get_feed_queue` | `{minScore?, maxResults?}` | `FeedItem[]` | View pending weak matches |
| `update_preferences` | `{...partial}` | `{updated}` | Modify scoring profile |
| `get_feed_analytics` | `{dateRange?}` | Analytics object | Performance metrics |

---

## 12. Implementation Phases

### Phase 1: Manual Feed + Preferences UI (Current)
What exists today:
- [x] Feed card UI shell with demo data
- [x] Sidebar layout with preference sections
- [x] Score display with color-coded bars
- [ ] Preference editor (full form with save/load)
- [ ] Feed card actions (Accept/Dismiss/Snooze)
- [ ] Feed queue for weak matches

### Phase 2: Gmail Integration (Next)
- [ ] Gmail MCP connector for email classification
- [ ] Recruiter outreach extraction (Claude-powered)
- [ ] Job alert email parsing (LinkedIn, Indeed, Glassdoor templates)
- [ ] Networking follow-up detection
- [ ] Dedup against existing pipeline
- [ ] Scoring engine with weighted dimensions
- [ ] Auto-create pipeline entries for strong matches
- [ ] Dashboard notifications for new discoveries

### Phase 2.5: Apify JD Enrichment (v3.4.0 — SHIPPED)
- [x] Apify API token storage (`pf_apify_key`) + sidebar settings UI
- [x] JD quality detection (`isStubJD()` — length + pattern-based)
- [x] LinkedIn Jobs Scraper integration (`bebity/linkedin-jobs-scraper`)
- [x] Fuzzy match engine (company name + title similarity, 40+ confidence threshold)
- [x] Per-card "⚡ Enrich" button with loading state
- [x] Batch "Enrich JDs" button with live progress counter
- [x] JD quality badges (stub vs full) on feed cards
- [x] Enriched JD snippet preview on cards
- [x] Graceful error handling (quota limits, no matches, API errors)
- [ ] Career page scraping fallback (Lever, Greenhouse, Ashby, Workday)
- [ ] Auto-enrich on feed item creation (background enrichment)

### Phase 3: Job Board APIs
- [ ] Indeed API integration via MCP connector
- [ ] Dice API integration via MCP connector
- [ ] Saved search management UI
- [ ] Result dedup across sources (same role on Indeed + company page)

### Phase 4: Career Page Monitoring
- [ ] ATS-specific extractors (Lever, Greenhouse, Ashby, Workday)
- [ ] RSS feed support for career pages
- [ ] Generic scraping with Claude-powered parsing fallback
- [ ] Tiered cadence scheduling per company tier
- [ ] Career page URL management in Source tab

### Phase 5: Intelligence Layer
- [ ] Tier promotion/demotion suggestions
- [ ] Feed analytics dashboard
- [ ] Preference version tracking with A/B comparison
- [ ] Company frequency signals
- [ ] Repost detection and re-engagement prompts

---

## 13. Inspiration & Credits

### 13.1 Abhijay Arora Vuyyuru — AI Job Search Automation Pioneer

The Feed module's design is directly inspired by the work of **[Abhijay Arora Vuyyuru](https://abhijayvuyyuru.substack.com/)**, a Product Manager at Google/YouTube and author of the *AI Action Letter* newsletter. Abhijay has published extensively on using AI agents and automation to transform job searching from a manual grind into an automated pipeline. His work demonstrated the core thesis that underpins this module: job discovery should happen *for* you, not *by* you.

**Key workflows from Abhijay that shaped this PRD:**

- **[AI Agent That Job Hunts While You Sleep](https://abhijayvuyyuru.substack.com/p/ai-agent-that-job-hunts-while-you)** — An n8n + Apify + Gemini workflow that scrapes LinkedIn for jobs posted in the last 24 hours, pulls decision-maker data, generates personalized outreach messages (<100 words, tuned for tone), and drafts them in Gmail automatically. This workflow directly inspired our Gmail integration architecture (Section 4.4), the scheduled execution model (Section 10), and the idea that discovered roles should automatically trigger downstream actions (outreach, research).
- **[Use LLMs in Your Job Search](https://abhijayvuyyuru.substack.com/p/use-llms-in-your-job-search)** — Demonstrated using LLMs to uncover the "hidden job market" by finding social media posts from hiring managers sourcing candidates directly, bypassing HR portals. This informed our multi-source philosophy — the best roles aren't always on job boards.
- **[Use LLM with Connectors to Land Your Next Job](https://abhijayvuyyuru.substack.com/p/use-llm-with-connectors-to-land-your)** — Showed the Apify + Claude pattern for scraping company career pages before roles hit LinkedIn. Directly inspired our Career Page Monitoring architecture (Section 4.3) and the tiered cadence system.
- **[AI Automation That Optimizes Your Resume for EVERY Job](https://abhijayvuyyuru.substack.com/p/this-ai-automation-optimizes-your)** — An n8n workflow using Gemini 1.5 Pro to automatically tailor resumes per job description. While this maps more directly to the Resume Builder module, the pattern of "discover → enrich → act" is the Feed's core pipeline philosophy.
- **[AI Guide to Land a Job/Internship in 2026](https://abhijayvuyyuru.substack.com/p/abhijays-ai-guide-to-land-a-jobinternship)** — A comprehensive 10-tip guide with practical prompts and automation workflows. Validated our conviction that AI-powered job search isn't a gimmick — it's a competitive advantage.

**What we took from Abhijay's approach:** The fundamental insight that job search can be decomposed into automatable stages (scrape → classify → score → act), that the AI layer should handle unstructured-to-structured conversion (emails, career pages, recruiter outreach), and that the human should focus on decision-making while the system handles discovery. Abhijay's n8n workflows proved this works in practice.

### 13.2 n8n Ecosystem

Beyond Abhijay's work, the broader n8n job automation community validated specific implementation patterns. Projects like [Job-Hunter](https://github.com/adarsh-ajay/Job-Hunter), [JobHuntAutomation](https://github.com/kashimkyari/JobHuntAutomation), and [Job-Search-Automation](https://github.com/rahulkumar-24/Job-Search-Automation-Using-n8n) demonstrate the pattern: scheduled scraping → AI enrichment → structured storage → notification.

Key patterns adopted from these workflows:

- **Scheduled execution with idempotent runs** — n8n workflows run on cron, process new items since last run, and skip duplicates. Our Feed skill follows the same model.
- **AI-powered classification** — rather than rigid regex parsing, use Claude to classify emails (recruiter vs. alert vs. noise) and extract structured data from unstructured sources.
- **Multi-source aggregation with dedup** — the same role often appears on multiple boards. Cross-source dedup prevents duplicate pipeline entries.
- **Score-gated actions** — not every discovery deserves a pipeline entry. Scoring gates auto-creation while preserving weak matches for manual review.
- **Provenance tracking** — every discovered role carries full metadata about where it was found and when, enabling source ROI analysis.

### 13.3 Where Pathfinder Diverges

- **Integration with a full job search system** — n8n workflows dump results into Google Sheets or send Telegram notifications. Pathfinder's Feed writes directly to the Pipeline, triggers Research Brief generation, and feeds the Resume Builder.
- **Preference-aware scoring** — most n8n workflows use simple keyword matching. Pathfinder's scoring model uses weighted dimensions across title, domain, keywords, location, company stage, and comp.
- **Tier-aware monitoring** — career page monitoring frequency is tied to company priority, not a flat schedule.
- **Feedback loops** — accepted/dismissed signals improve scoring over time. n8n workflows have no feedback mechanism.

---

## 14. Relationship to Other Modules

```
                    ┌─────────────┐
                    │  Job Feed   │
                    │  Listener   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Pipeline │ │Dashboard │ │Companies │
        │ (roles)  │ │ (alerts) │ │ (profiles)│
        └────┬─────┘ └──────────┘ └──────────┘
             │
     ┌───────┼───────┐
     ▼       ▼       ▼
  Research  Resume   Outreach
  Brief     Builder  Module
```

The Feed is the primary source of new pipeline entries. Every downstream module benefits from faster, higher-quality role discovery.
