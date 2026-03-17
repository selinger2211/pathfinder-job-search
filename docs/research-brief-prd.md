# Research Brief Module — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/research-brief/`
**Version:** v3.33.0
**Last Updated:** 2026-03-16
**Status:** Active — v3.33.0 spec-aligned: expandable sections, handoff buttons, news banner, context indicators

---

## 1. Purpose

The Research Brief is the preparation engine of Pathfinder. Before every interview loop, networking call, or application decision, you should be able to open a brief and know: **what this role actually needs, what this company is doing right now, who you'd work with, how your experience maps, and exactly what to say.**

The v3 architecture is **browser-first**, generating all 13 sections via direct Claude API calls from the client (not MCP). Each section streams sequentially, cites its sources, and caches locally. Optional HTTP bridge (`localhost:3456`) persists results for durability. Tavily web search enriches company research with live news.

### Design Principles

1. **JD is the anchor.** Every section reads the job description. Nothing generates in a vacuum. If there's no JD, the brief asks you to add one.
2. **Your experience is the lens.** The brief isn't a Wikipedia article about the company — it's a pursuit document for *you* interviewing for *this role*. Your resume bullets, story bank, and connections feed into every relevant section.
3. **Trust but Verify.** Every claim is cited with evidence labels (JD, EXT, ILI, CTX, DOC, INF, NC). Sources are timestamped. Stale data is flagged.
4. **Browser-first generation.** All generation happens client-side via direct Claude API calls (`modules/shared/claude-api.js`). Results cache locally (localStorage) and optionally persist via HTTP bridge for durability.
5. **Honest and practical.** Sharp, credible tone. Not overly corporate, not overly optimistic. Explicit about uncertainty and risks.

---

## 2. Architecture

### 2.1 Execution Model

**Browser-first, direct API calls:**

- Entry point: `index.html` (React/VanillaJS app)
- API calls: `modules/shared/claude-api.js` (direct Anthropic API client)
- No MCP involvement (MCP-first architecture is Status: Planned)
- Sequential section streaming (not batched)
- Results cached in localStorage with version bumping for automatic purge on app update

**Optional HTTP bridge for durability:**

- Bridge listens on `http://localhost:3456`
- If available, persists cached briefs for cross-session durability
- If unavailable, browser works fully offline
- Graceful fallback: if API fails, offline brief generator triggers

### 2.2 API Integration

**Claude model:** `claude-sonnet-4-20250514` (configurable via localStorage `pf_claude_model`)
**Temperature:** 0.3 (sharp, focused output)
**Max tokens:** 4096 per section
**Streaming:** Per-section sequential streaming (not parallel batching)

**System prompt:** "You are a senior job-pursuit strategist. Your role is to deeply analyze job opportunities and prepare precise, actionable briefs. Be sharp, credible, and practical. Flag risks and uncertainties explicitly."

### 2.3 Web Search Integration (Tavily)

**Optional Tavily API key input** in sidebar settings.

**searchCompanyNews()** function fetches live company research:
- 5 recent news articles about the target company
- Leadership changes, product launches, funding, acquisitions
- Results labeled as **EXT** (External Research) in the brief
- Graceful degradation if no key provided

**Triggered automatically** when:
- User saves a JD with a company name
- User clicks "Refresh Company News"
- Or can be skipped for opaque/confidential roles

### 2.4 Offline Mode (Fallback Brief Generator)

**generateOfflineBrief()** builds all 13 sections from JD text parsing when:
- No Anthropic API key configured
- API request fails with any status error (4xx, 5xx, network timeout)
- Offline mode enabled in settings

**Parsing pipeline:**
- Keyword extraction (responsibility, skill, requirement patterns)
- LinkedIn network lookup from `pf_connections` + `pf_linkedin_network`
- JD responsibility parsing (extract scope, team, metrics)
- Qualification extraction (explicit vs. implied requirements)
- Resume bullet matching (local similarity scoring)

**Output:** All 13 sections pre-filled with parsed data, clearly labeled as inferred, user prompted to trigger Claude generation once API is available.

### 2.5 Caching & Invalidation

**localStorage keys:**
- `pf_brief_app_version` — app version (triggers purge on mismatch)
- `pf_brief_${roleId}_section${n}` — cached section HTML
- `pf_brief_${roleId}_metadata` — role metadata, timestamps
- `pf_brief_${roleId}_sources` — source ledger (planned v3.30+)

**Automatic purge:**
- On app version change (self-healing script at <head>)
- When user clicks "Clear Cache"
- When JD text changes (triggers re-generation)

**Cross-tab refresh:**
- storage event listeners detect changes in other tabs
- visibilitychange handler re-syncs on tab activation

### 2.6 Evidence Labels & Citation Model

**7 evidence labels** (implemented, with color coding):

| Label | Color | Meaning |
|-------|-------|---------|
| **JD** | green | Extracted from job description text |
| **EXT** | blue | External research (Tavily web search) |
| **ILI** | purple | Ili profile, resume bullets, story bank |
| **CTX** | cyan | Additional context provided by user |
| **DOC** | teal | Uploaded supporting document |
| **INF** | orange | Inference (Claude's reasoning) |
| **NC** | red | Needs confirmation (uncertain claim) |

**Citation UX:**
- Each claim tagged with evidence label
- Hover tooltip shows timestamp and source snippet
- Click-through to original source where possible
- Source ledger (planned) tracks all citations with provenance chain

---

## 3. The 13 Sections (V3 Structure)

### 3.1 Section 1: Pursuit Economics (Compact Decision Box)

**Location:** Pinned above all other sections in sidebar; also rendered as decision box at top of main panel
**Length:** 1-2 screens (table format)
**Audience:** Decision-maker (you)

**Format: 7-row decision table**

| Row | Field | Content |
|-----|-------|---------|
| 1 | **Recommendation** | "Pursue Hard" / "Pursue" / "Interested" / "Hold" / "Pass" |
| 2 | **Fit Level** | "Strong" / "Solid" / "Possible" / "Weak" |
| 3 | **Confidence** | % (0-100), derived from evidence count + freshness |
| 4 | **Time Investment** | "High: 20+ hrs" / "Medium: 8-15 hrs" / "Low: 2-5 hrs" |
| 5 | **Expected Yield** | "High upside, moderate risk" or similar honest framing |
| 6 | **Overall Timeline** | "Can move fast (1-2 weeks)" / "Moderate (3-4 weeks)" / "Slow" |
| 7 | **Critical Next Action** | Single most important next step (prepare story? land intro? etc.) |

**Notes:**
- This section is pre-calculated across all 13 sections (not generated separately)
- Recommendation algorithm: weights fit %, screen-out severity, network proximity, timeline fit
- "Confidence" is derived from count of evidence sources, freshness of data, agreement across sources
- Rendered as sticky card at top of main panel and in decision box in sidebar

---

### 3.2 Section 2: Why This Role Exists

**Length:** 2-3 screens
**Audience:** Strategic context (you)

**Subsections:**

**Business Problem** (1 para)
What problem is this hire solving? Decode from JD language, team description, company stage.
Evidence: **JD**, **EXT** (recent news), **INF**

**Why Now** (1 para)
What changed? New product, re-org, backfill, scaling? Identify urgency signals.
Evidence: **JD**, **EXT**, **INF**

**First-Year Mandate** (1 para)
What does success look like at month 12? Specific outcomes, not vague goals.
Evidence: **JD**, **INF**

**Success Measures** (3-5 bullets)
Specific KPIs this role will be measured on. Tie each to JD language.
Evidence: **JD**, **INF**

**Hidden Tensions** (bullets, if any)
Red flags ONLY — unrealistic scope, conflicting requirements, buzzword density.
If none: "No significant red flags identified."
Do NOT fabricate concerns.
Evidence: **JD**, **INF**, **NC** (if uncertain)

---

### 3.3 Section 3: Company & Market Context

**Length:** 3-4 screens
**Audience:** Strategic context (you)

**Subsections:**

**Company Overview** (2 paras)
What do they do? Stage, size, market position. Include Tavily-sourced recent news.
Evidence: **JD**, **EXT**, **INF**

**Recent Momentum** (2-3 bullets)
Recent funding, launches, partnerships, hiring spree. From Tavily.
Evidence: **EXT**, **INF**

**Competitive Landscape** (2 paras)
Who are they competing against? What's their advantage/weakness?
Evidence: **EXT**, **INF**

**Why This Role Matters Now** (1 para)
How does this hire fit into the company's current strategy?
Evidence: **JD**, **EXT**, **INF**

---

### 3.4 Section 4: Why You Are Plausible

**Length:** 2-3 screens
**Audience:** Self-confidence + interview prep (you)

**Subsections:**

**Direct Matches** (2-3 bullets)
Experiences that perfectly map to explicit JD requirements.
Evidence: **ILI**, **JD**

**Adjacent but Defensible** (2-3 bullets)
Skills that are close but not exact — how to bridge the gap?
Evidence: **ILI**, **INF**

**Pattern Argument** (1 para)
Meta-pattern: "Your pattern is X, their need is X" — helps explain non-traditional fits.
Evidence: **ILI**, **INF**

**Strongest Evidence** (2-3 bullets)
Specific bullets from your resume that prove the pattern.
Evidence: **ILI**

---

### 3.5 Section 5: Why You May Get Screened Out

**Length:** 1-2 screens
**Audience:** Risk mitigation (you + interviewer prep)

**Format: Severity matrix**

Each potential screen-out risk includes:
- **Risk:** Description of the concern (e.g., "No direct PM experience")
- **Severity:** High / Medium / Low (subjective, based on JD language)
- **Recruiter Likelihood:** % chance recruiter flags this (1-100)
- **HM Likelihood:** % chance hiring manager flags this (1-100)
- **Bridgeable:** Yes / Maybe / No
- **Evidence:** What specific JD language triggers this?
- **Bridge Strategy:** How to mitigate (e.g., "Lead with X story")

**Examples:**
- No direct PM experience (severity, likelihood, bridge)
- Different industry (severity, likelihood, bridge)
- Gap in X skill (severity, likelihood, bridge)
- Overqualified/underqualified (severity, likelihood, bridge)

---

### 3.6 Section 6: What They Actually Need

**Length:** 2-3 screens
**Audience:** Interview prep + fit assessment (you)

**Subsections:**

**Explicit Requirements** (2-3 bullets)
What the JD explicitly states. Parsed directly from JD text.
Evidence: **JD**

**Implied Requirements** (2-3 bullets)
What's *not* in the JD but derived from role, team, company stage.
Evidence: **JD**, **INF**, **EXT**

**Scope and Authority** (1 para)
What's the actual scope? How much real authority? Budget? Headcount?
Evidence: **JD**, **INF**, **NC** (if unclear)

**Hidden Constraints** (bullets, if any)
Unstated limitations: budget caps, timeline pressure, political dynamics.
If none: "No hidden constraints identified."
Evidence: **JD**, **INF**, **NC**

---

### 3.7 Section 7: Your Fit (Upgraded 7-Column Fit Table)

**Length:** 1-2 screens
**Audience:** Interview prep (you)

**Format: Multi-column fit table**

| Requirement | Match | Proof | Risk | Bridge | Best Framing | Src |
|-------------|-------|-------|------|--------|--------------|-----|
| Req #1 (explicit from JD) | Strong / Solid / Weak / None | Specific bullet or artifact | Risk description (if any) | How to mitigate | How to present in interview | Label (JD/ILI/INF) |
| Req #2 | ... | ... | ... | ... | ... | ... |

**Column definitions:**
- **Requirement:** Parsed from JD, numbered
- **Match:** Honest assessment (Strong/Solid/Weak/None)
- **Proof:** Specific resume bullet, story, or artifact
- **Risk:** Gap or concern with this match
- **Bridge:** How to close the gap (story, reframe, context)
- **Best Framing:** Word-for-word sentence to use in interview
- **Src:** Evidence label (JD, ILI, INF, etc.)

**Notes:**
- One row per explicit JD requirement
- If you have no proof, say "None" — don't fake it
- "Bridge" is actionable: "Lead with X story" or "Emphasize Y context"

---

### 3.8 Section 8: Gaps and Mitigation

**Length:** 1-2 screens
**Audience:** Interview prep (you)

**Format: Gap cards (one per gap)**

Each gap includes:
- **Gap Name** (e.g., "No Direct PM Experience")
- **Severity** (Critical / High / Medium / Low)
- **Why It Matters** (1 para — why would HM care?)
- **Bridge Strategy** (1-2 paras — how you'd address it)
- **Proof Points** (bullets — specific evidence you'd cite)
- **Preemptive Framing** (word-for-word preamble to use before it comes up)

**Examples:**
- Missing skill → "Here's how I'd ramp"
- Industry switch → "Here's the transferable pattern"
- Gap in timeline → "I've done rapid ramp-up before"

---

### 3.9 Section 9: Network Strategy

**Length:** 1-2 screens
**Audience:** Outreach + interview prep (you)

**Format: Contacts table**

| Name | Title | Relationship | Ask Type | Key Question | Decision Impact |
|------|-------|--------------|----------|---------------|-----------------|
| Person A | Role at Company | Knows them from X | Intro to HM / Advice call / Casual chat | "What's the team dynamic?" | High (decision-maker) |
| Person B | ... | ... | ... | ... | Medium (can influence) |

**Columns:**
- **Name:** Contact name
- **Title:** Job title + company
- **Relationship:** How you know them (worked together, mutual, etc.)
- **Ask Type:** Intro / Advice / Social proof / Casual feedback
- **Key Question:** Best single question to ask them
- **Decision Impact:** How much influence they have (High/Medium/Low)

**Notes:**
- Pulled from `pf_connections` + `pf_linkedin_network`
- Prioritized by proximity (1st degree > 2nd degree)
- "Decision Impact" reflects their seniority/influence at the company

---

### 3.10 Section 10: Interview Preparation

**Length:** 2-3 screens
**Audience:** Interview prep (you)

**Subsections:**

**Top 5 Most Likely Questions** (5 bullets)
Derived from JD language + role level. What will they definitely ask?
Evidence: **JD**, **INF**

**Top 3 Highest-Risk Questions** (3 bullets)
Questions that could derail you. Screen-out risks + gap-related.
Evidence: **JD**, **INF**

**Best Stories to Deploy** (3-5 story summaries)
Tie each to the fit matrix + gaps. Handoff to Story Bank.
Evidence: **ILI**

**Objection Handling** (3-5 objections + rebuttals)
Tie to Section 5 (screen-out risks). What if they push back on X?
Evidence: **JD**, **INF**

---

### 3.11 Section 11: Proof Points to Add

**Length:** 1-2 screens
**Audience:** Artifact prep (handoff to Resume, Outreach, Mock)

**Format: Proof-point cards with handoff buttons**

Each proof point:
- **Claim:** The thing you need to prove (e.g., "Can ship fast in complex orgs")
- **Current Evidence:** What you have now (from resume)
- **Gap:** What's missing
- **Handoff Actions:**
  - [ ] Update Resume Bullet (link to Resume Tailor)
  - [ ] Prep for Mock Interview (link to Mock Interview)
  - [ ] Include in Outreach (link to Outreach)
  - [ ] Add to Story Bank (link to Story Bank)

**Notes:**
- Surfaced by comparing fit matrix against resume
- Not just academic — should trigger artifact updates

---

### 3.12 Section 12: Deal-Breaker Test

**Length:** 1-2 screens
**Audience:** Decision-making (you)

**Format: 3-5 deal-breaker facts with testing strategy**

Each deal-breaker includes:
- **Fact:** The potential deal-breaker (e.g., "No relocation" / "Must have 5+ yrs PM")
- **How to Test:** How you'd confirm (email recruiter / ask at first call / etc.)
- **Current Assessment:** What you know now (Confirmed / Likely / Unclear / Not an issue)
- **Decision:** If confirmed, do you drop? Y/N
- **Evidence:** Source of this fact (**JD**, **EXT**, **INF**, **NC**)

**Examples:**
- "Remote required" → Ask recruiter via email → Unclear → Drop if on-site only
- "Need 5+ yrs PM" → JD says "5+ years experience" → Confirmed → Keep pursuing (you have 6)
- "Team size < 2 people" → Ask HM in screening → Needs confirmation → Drop if solo IC

**Notes:**
- Deal-breakers are *personal* (hard stops for you) + *objective* (things that would disqualify you)
- Separate the two categories in the output
- Clear, honest: "If X, I walk"

---

### 3.13 Section 13: Next-Step Plan

**Length:** 1 screen
**Audience:** Action-taking (you)

**Format: 5 maximum concrete actions**

Each action:
- **Action:** Specific, measurable (e.g., "Message Alex Chen on LinkedIn with context")
- **Owner:** You / Someone else
- **Deadline:** By when?
- **Expected Outcome:** What success looks like
- **Time Investment:** 5 mins / 30 mins / 1-2 hours

**Template:**

1. [ ] **Before first outreach:** [specific action tied to Section 9 network]
2. [ ] **Before first screening call:** [specific action tied to Section 11 proof points]
3. [ ] **Before first interview:** [specific action tied to Section 10 interview prep]
4. [ ] **Time check:** [hard deadline — "apply by Friday" or "talk to recruiter by 3/20"]
5. [ ] **Contingency:** [what if X happens? e.g., "If no response in 5 days, try second-degree path"]

---

## 4. Additional Context System

### 4.1 Text Input for Free-Form Context

**Location:** Sidebar settings panel
**UI:** Textarea, max 2000 chars
**Storage key:** `pf_brief_${roleId}_custom_context`

**Use cases:**
- "I have a friend at this company who said..."
- "The recruiting email mentioned..."
- "Last time I talked to them..."

**Integration:**
- Included in all 13 sections as **CTX** evidence
- Can be edited at any time
- Triggers re-generation of dependent sections

### 4.2 File Upload for Supporting Documents

**Location:** Sidebar upload panel
**Supported formats:** .doc, .docx, .txt, .md (via mammoth.js)
**Max file size:** 10 MB
**Storage key:** `pf_brief_${roleId}_docs` (array of { name, text, uploadedAt })

**Integration:**
- Text extracted via mammoth.js (Word) or native readAsText (txt/md)
- Included in all 13 sections as **DOC** evidence
- Indexed for search: "Show me what the spec says about..."

---

## 5. Generation Parameters & Streaming

### 5.1 Per-Section Generation

**Temperature:** 0.3 (sharp, not creative)
**Max tokens:** 4096
**Stop sequence:** None (let Claude finish naturally)
**Streaming:** Yes, per section (not batched)

**Error handling:**
- Per-section error catch with retry UI
- If API error → offer offline brief, graceful degradation
- If timeout → allow user to retry individual section

### 5.2 System Prompt

```
You are a senior job-pursuit strategist advising a candidate on a specific role at a specific company. Your job is to deeply analyze the opportunity and prepare a sharp, practical, credible brief.

Guidelines:
1. Ground everything in the job description. If it's not in the JD or clearly implied, say so.
2. Be honest about gaps and risks. Don't sugarcoat.
3. Every claim should cite its source: JD, external research, resume, or inference.
4. Use a sharp, practical tone. Not corporate, not overly optimistic. Be direct.
5. Flag uncertainty explicitly: "This is unclear from the JD" or "I'd need to confirm this."
6. Be concise: say what matters, trim the rest.
7. Focus on *this candidate's* fit for *this role*, not generic analysis.
```

---

## 6. UI / UX

### 6.1 Layout

**Two-column layout:**
- **Left sidebar (340px):** Role strip (pinned), input controls, cache/settings
- **Main panel (flex):** Sections flow vertically, Pursuit Economics at top (pinned decision box), scrollable

**Role strip (pinned):**
- Sticky at top of sidebar
- Shows all open briefs (chips with company logo, title, tier indicator)
- Click to switch between briefs
- Drag-to-reorder (planned v3.30+)

**Pursuit Economics decision box:**
- Pinned sticky at top of main content
- 7-row table with clear color coding
- Color-coded recommendation (green=pursue hard, yellow=interested, red=pass)

### 6.2 Sidebar Input Controls

**Order (top to bottom):**

1. **Role Strip** (pinned) — Open briefs
2. **JD Input** — Textarea or upload for job description
3. **Tavily API Key** — Optional for live company news
4. **Additional Context** — Textarea for user notes
5. **File Upload** — .doc, .docx, .txt, .md
6. **Generation Controls**
   - [ ] Use offline mode (checkbox)
   - [ ] Refresh company news (button)
   - [ ] Generate all sections (button)
   - [ ] Clear cache (button)
7. **Settings** — API key, model selection, theme

### 6.3 Section Rendering

**Each section displays:**
- Section number + title (h3)
- Content (HTML streamed from Claude)
- Source badges (JD, EXT, ILI, CTX, DOC, INF, NC)
- Timestamp (when generated)
- Retry button (if error)
- "Jump to" navigation (sidebar)

**Loading states:**
- Skeleton screens while streaming
- Spinner during generation
- Clear indication of which sections are cached vs. fresh

### 6.4 Logo Display (Multi-Fallback Chain)

**Fallback chain for company logos:**

1. **Google Favicon API** → `https://www.google.com/s2/favicons?sz=128&domain=${domain}`
2. **Letter Avatar** → First letter of company name, colored background
3. **Placeholder icon** → Generic company icon

**Stored at:**
- `pf_brief_${roleId}_company_logo` (localStorage)
- Expires after 30 days

---

## 7. Export & Artifacts

### 7.1 PDF Export

**Library:** html2pdf.js
**Trigger:** "Export to PDF" button in header
**Includes:**
- All 13 sections (rendered HTML → PDF)
- Pursuit Economics decision box at top
- Timestamp of generation
- Company logo in header

**Exclusions:**
- Sidebar input controls
- Edit buttons / retry buttons
- Timestamps for individual sections (too cluttered)

**File naming:** `${companyName}_${roleTitle}_Research_${date}.pdf`

### 7.2 Handoff to Other Modules

**From Proof Points (Section 11):**
- [ ] **Update Resume** → opens Resume Tailor with pre-filled context
- [ ] **Mock Interview** → opens Mock Interview with brief context
- [ ] **Outreach** → opens Outreach module with company/role context

**From Gaps & Mitigation (Section 8):**
- [ ] **Prepare Story** → opens Story Bank, pre-fills gap to address

**From Network Strategy (Section 9):**
- [ ] **Draft Outreach** → opens Outreach module with contact name pre-filled
- [ ] **Find Second Degree** → opens LinkedIn network view filtered to this company

---

## 8. Integration Points

### 8.1 From Other Modules

**Resume / Story Bank:**
- Imported via `pf_resume_bullets`, `pf_story_bank`
- Used in Section 4 (Plausibility), Section 7 (Fit table), Section 10 (Interview prep)

**LinkedIn Network:**
- Imported via `pf_connections` + `pf_linkedin_network`
- Used in Section 9 (Network Strategy)

**Comp Intel:**
- Imported via `pf_companies` (salary ranges, headcount)
- Supplement company context (planned v3.30+)

**Debrief / Previous Briefs:**
- Can reference previous interviews at same company
- Surface in "Hidden Tensions" if applicable

### 8.2 To Other Modules

**Resume Tailor:**
- "Update Resume" handoff with brief context
- Pre-fills bullet bank with proof points from Section 11

**Mock Interview:**
- "Prep for Mock" handoff
- Pre-fills with Section 10 questions + Section 8 gaps

**Outreach:**
- "Draft Outreach" handoff
- Pre-fills with contact name (from Section 9), company, role
- Includes Section 4 (plausibility) as context

**Story Bank:**
- "Add Story" handoff
- Pre-fills with gap (from Section 8) as context

---

## 9. Implementation Roadmap

### P1: Core (v3.29.0 — In Progress)

- [x] 13-section generation pipeline (basic)
- [x] Browser-first API integration
- [x] localStorage caching + version bumping
- [x] Pursuit Economics decision box
- [x] Section 5 screen-out risk matrix
- [x] Upgraded fit table (Section 7, 7-column)
- [x] Deal-Breaker Test (Section 12)
- [x] PDF export (html2pdf.js)
- [x] Role strip pinning
- [x] Evidence labels (7 types)
- [x] Offline brief generator (fallback)
- [x] Multi-fallback logo chain
- [x] Cross-tab refresh (storage event + visibilitychange)
- [x] Next-step plan (Section 13, max 5 actions)
- [ ] Tavily web search integration (live company news)
- [ ] Additional context + file upload (text input, mammoth.js)

### P2: Quality & UX (v3.30.0 — Planned)

- [ ] Deeper company research (Comp Intel integration)
- [ ] Citation UI with hover tooltips + click-through
- [ ] Source ledger (full provenance chain)
- [ ] Network strategy table + 2nd-degree lookup
- [ ] Interview prep: story deployment + objection handling
- [ ] Proof-point handoff UX (Resume, Mock, Outreach integration)
- [ ] Drag-to-reorder role chips
- [ ] "Jump to section" navigation in sidebar

### P3: Advanced (v3.31.0+ — Planned)

- [ ] MCP-first architecture (server-side generation)
- [ ] Batch parallel generation (all 13 sections at once)
- [ ] Full source ledger integration (every sentence cited)
- [ ] Degraded mode for opaque/confidential roles (mask company name, etc.)
- [ ] Competitor brief (switch view to analyze competitors)
- [ ] Historical briefs (archive + version diffing)
- [ ] Collab briefs (shared URL for feedback from friends)

---

## 10. Status Tracking: Features Implemented vs. Planned

### Implemented [x]

- [x] 13-section structure (all sections generate)
- [x] Browser-first architecture (claude-api.js)
- [x] localStorage caching with version bumping
- [x] Self-healing cache purge (app version detection)
- [x] Sequential streaming (not parallel)
- [x] Pursuit Economics (Section 1) decision box
- [x] Screen-out risk matrix (Section 5)
- [x] 7-column fit table (Section 7)
- [x] Deal-Breaker test (Section 12)
- [x] Next-step plan (Section 13)
- [x] 7 evidence labels (JD, EXT, ILI, CTX, DOC, INF, NC)
- [x] PDF export (html2pdf.js)
- [x] Role strip with pinning
- [x] Multi-fallback logo chain
- [x] Cross-tab refresh (storage + visibilitychange)
- [x] HTTP bridge fallback (localhost:3456)
- [x] Offline brief generator (keyword parsing, network lookup)
- [x] Error handling with re-throw for API errors

### Planned [ ] — Status: Planned (will implement in future versions)

- [ ] Tavily web search (live company news in Section 3)
- [ ] Additional context text input (CTX evidence)
- [ ] File upload for supporting docs (DOC evidence, mammoth.js)
- [ ] Citation UI with hover + click-through
- [ ] Source ledger (full provenance, Section 7.12 of main PRD)
- [ ] MCP-first architecture (server-side generation)
- [ ] Batch parallel generation (all sections at once)
- [ ] Full source ledger integration
- [ ] Degraded mode for opaque/confidential roles
- [ ] Deeper Comp Intel integration
- [ ] Historical brief archive
- [ ] Collab brief sharing

---

## 11. Copy & Tone

**Target tone:** Sharp, credible, honest, practical.

**Not:**
- Overly corporate ("We're excited to explore...")
- Overly optimistic ("You're a perfect fit!")
- Generic ("This is a great opportunity...")
- Patronizing ("Here's what you should do...")

**Yes:**
- Direct ("Your PM experience doesn't match the JD on X")
- Honest ("This is a red flag if they care about Y")
- Practical ("Here's how you'd frame it in the interview")
- Specific ("Lead with your Z project, which shows...")

**Example language:**

❌ "You have strong product thinking skills that align well with the role."
✅ "Your experience shipping in resource-constrained environments (Z project) directly matches their stated need to 'move fast with small teams.'"

❌ "There are some risks to consider."
✅ "You'll likely get screened out on missing 5+ years of PM experience. Here's how to bridge it: [X story]."

❌ "The company is doing great."
✅ "They've hired 12 PMs in the last year (from Tavily search) — signals rapid scaling. That usually means high execution bar."

---

## 12. Testing Strategy

### 12.1 Unit Tests

- [x] `generateOfflineBrief()` — keyword extraction, requirement parsing
- [x] Evidence label assignment — correct source per section
- [x] Recommendation algorithm — fit % + screen-out severity → recommendation
- [ ] Tavily mock response parsing (once integrated)
- [ ] File upload parsing (mammoth.js, text extraction)

### 12.2 Integration Tests

- [x] Full 13-section generation pipeline (happy path)
- [x] Error handling (API failure → offline mode)
- [x] Cache invalidation (version bump triggers purge)
- [x] Cross-tab sync (storage event propagation)
- [ ] Tavily integration (end-to-end with mock key)
- [ ] Handoff to Resume Tailor (proof points → bullet updates)

### 12.3 E2E Tests

- [x] User opens Research Brief, pastes JD, generates brief (basic)
- [ ] User enables Tavily, fetches company news, sees in Section 3
- [ ] User uploads supporting doc, sees DOC evidence in sections
- [ ] User adds custom context, sees CTX evidence
- [ ] User exports to PDF, validates all sections present
- [ ] User switches between open briefs (role chip switching)

---

## 13. Success Criteria

### Brief Quality

- **Specificity:** Every claim tied to JD, user's resume, or company research (not generic)
- **Honesty:** Risks and gaps explicitly flagged, not glossed over
- **Actionability:** Each section suggests concrete next steps (prepare story, send intro, etc.)
- **Evidence:** Every significant claim has a source label (JD/EXT/ILI/CTX/DOC/INF/NC)

### Performance

- **Generation speed:** Each section streams in <5 seconds (0.3 temp, focused)
- **Cache hit:** Returning users load brief in <1 second (from localStorage)
- **Offline fallback:** If API fails, offline brief generates in <2 seconds with 80%+ of content

### Adoption

- **Users trigger generation:** >70% of briefs generated, not just skeleton
- **Multiple sections read:** >80% of users read at least 8/13 sections
- **PDF export used:** >30% of briefs exported
- **Handoff clicks:** >20% of users click through to Resume Tailor or Mock Interview

### Reliability

- **No data loss:** Cache survives app refresh, cross-tab refresh, network hiccup
- **Clear error messages:** Users understand why generation failed and how to fix
- **Graceful degradation:** Offline mode activates without user confusion

---

## 14. Risk / Failure Modes / Guardrails

### Risk 1: Hallucinated Company Info (Tavily Disabled)

**Problem:** If Tavily is not configured, Claude might hallucinate recent news.
**Mitigation:**
- Clearly label all company info as **INF** (inference) if Tavily unavailable
- Prompt Claude to say "I don't have recent company info" rather than guess
- Offer Tavily setup prompt

### Risk 2: Stale Data Persisted in Cache

**Problem:** Cached brief may be outdated if JD changes slightly.
**Mitigation:**
- Hash JD text, invalidate cache if hash changes
- Offer "Refresh" button per section
- Version bump triggers full purge (self-healing)

### Risk 3: Overconfidence in Fit Score

**Problem:** User might over-index on Fit % in Pursuit Economics, ignore risks.
**Mitigation:**
- Confidence % is conservative (based on evidence count, freshness)
- Recommendation logic weights screen-out severity equally with fit %
- Bold red flags in Section 5 (screen-out risks)

### Risk 4: API Key Exposure

**Problem:** localStorage stores API key in plaintext.
**Mitigation:**
- Document risk in settings ("Keys stored locally, not sent to servers")
- Offer "Clear API Key" button
- Recommend OAuth / environment key management (future)

### Risk 5: Offline Mode Quality

**Problem:** Offline brief is rough; user might over-rely on it.
**Mitigation:**
- Clearly label offline content as "parsed, not generated by Claude"
- Offer bright banner: "This brief was generated offline. Refresh with Claude when available."
- Disable some sections if offline (e.g., company research requires API)

### Risk 6: Section Interdependencies

**Problem:** Section 7 (Fit table) depends on Section 6 (What They Need).
**Mitigation:**
- Generate sections in order (2, 3, 4, 5, 6, 7, ...)
- Cache Section 6 result, pass to Section 7 prompt
- If Section 6 fails, Section 7 shows partial result with warning

---

## 15. Appendix: Prompt Templates (Examples)

### Section 1: Pursuit Economics (Aggregation, Not Generation)

This section is **calculated** from the other 12, not generated. Pseudo-code:

```
fit_score = (match_count / total_requirements) * 100
screen_out_severity = MAX(severity scores from Section 5)
confidence = COUNT(evidence sources) * FRESHNESS_FACTOR

recommendation = IF (fit_score > 80 AND screen_out_severity < "high") THEN "Pursue Hard"
                 ELSE IF (fit_score > 60) THEN "Pursue"
                 ELSE IF (fit_score > 40) THEN "Interested"
                 ELSE IF (screen_out_severity > "high") THEN "Hold"
                 ELSE "Pass"
```

### Section 3: Company & Market Context (with Tavily)

**System prompt:**
```
You are a researcher analyzing a company and market context.

If Tavily results are provided, integrate them as EXT (External Research) evidence.
If no Tavily results, use only JD and inference (INF).

Structure:
1. Company Overview (2 paras) — what do they do, stage, size
2. Recent Momentum (3 bullets) — recent news (from Tavily if available)
3. Competitive Landscape (2 paras) — competitors, market position
4. Why This Role Matters Now (1 para) — role in company strategy

Every claim should cite its source: JD, EXT (Tavily), or INF.
```

**User prompt:**
```
Analyze the company for this job:

Company: ${companyName}
JD excerpt: ${jdText}

${tavilyResults ? `Recent news (from Tavily): ${tavilyResults}` : "No external news available."}

Generate Section 3.
```

### Section 5: Screen-Out Risks (Structured)

**System prompt:**
```
You are a career strategist analyzing hire-ability risks.

Structure a risk as:
- Risk: [Description]
- Severity: [High/Medium/Low]
- Recruiter Likelihood: [0-100%]
- HM Likelihood: [0-100%]
- Bridgeable: [Yes/Maybe/No]
- Evidence: [JD language triggering this]
- Bridge: [How to mitigate]

Focus on realistic risks only, based on the JD.
Do NOT fabricate concerns.
```

---

## 16. Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-15 | v3.29.0 | Complete rewrite: browser-first, 13 sections, evidence labels, offline mode, Tavily ready |
| 2026-03-13 | v3.17 | Previous version (v3.16.0 features documented) |

---

**End of Research Brief PRD**
