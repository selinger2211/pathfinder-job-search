# Resume Builder Module — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/resume-tailor/`
**Version:** v3.13
**Last Updated:** 2026-03-13
**Status:** Active — v3.13.0 features live

---

## 1. Purpose

The Resume Builder is Pathfinder's conversion engine. Every other module generates intelligence — research briefs, company profiles, connection maps — but this is the module that turns intelligence into an artifact a hiring manager reads. It takes a job description, the user's bullet bank, and the Research Brief's fit assessment and produces a one-page tailored resume in under 60 seconds.

**The current module is a manual tool.** You select a role, analyze the JD, hand-pick bullets, and click generate. This PRD redefines it as an **opinionated, JD-driven agent** — one that reads the JD, makes the hard editorial decisions automatically, and presents you with a near-final resume you approve or adjust. The goal is to collapse the 30-minute "tailor my resume for this role" task into a 3-minute review-and-approve flow.

### Design Principles

1. **JD is the driver.** The job description controls everything: summary framing, skill bar ordering, bullet selection, role subtitle emphasis. The user's input is the JD and a positioning toggle (IC vs. management). Everything else is derived.
2. **Opinionated defaults, easy overrides.** The agent makes every decision — but every decision is visible and reversible. You can swap bullets, reorder skills, or rephrase the summary. You don't *have* to configure anything, but you *can* change anything.
3. **Honest framing, always.** Keywords must be earned. The agent never mirrors JD language onto the resume unless the user has genuinely done that work. This is not a keyword-stuffing tool — it's a positioning tool.
4. **Bullet bank is a living system.** The bank grows from two directions: the user curates bullets manually, and the agent proposes new bullets when it spots uncovered JD angles in the user's experience. Over time, the bank becomes comprehensive enough that generation requires zero new writing.
5. **Feedback loops, not silos.** The Research Brief's fit assessment feeds into resume generation. Resume generation surfaces bullet bank gaps. Bullet bank growth improves future resumes. Every generation makes the system smarter.

---

## 2. Architecture

### Data Flow

```
Pipeline (pf_roles)           Research Brief
  │ JD text                     │ Fit assessment
  │ Company name                │ Section 5 ("Why You Fit")
  │ Role title                  │ Section 10 ("Comp Intelligence")
  │ Positioning (IC/mgmt)       │
  └──────────┬──────────────────┘
             │
             ▼
    ┌─────────────────────┐
    │   JD Analysis       │  ← Phase 1: auto-runs on role selection
    │   (client-side)     │
    │                     │
    │ • Seniority level   │
    │ • Top keywords      │
    │ • Domain detection  │
    │ • Role type         │
    │ • Stakeholder env   │
    │ • Fit assessment    │
    └─────────┬───────────┘
              │
              ▼
    ┌─────────────────────┐
    │   Resume Generation │  ← Phase 2: MCP server (Claude API)
    │   (MCP tool call)   │
    │                     │
    │ Inputs:             │
    │ • JD analysis       │
    │ • Bullet bank       │
    │ • User preferences  │
    │ • Positioning       │
    │                     │
    │ Outputs:            │
    │ • Summary text      │
    │ • Skills bar        │
    │ • Role subtitles    │
    │ • Bullet selections │
    │ • Cover letter (opt)│
    └─────────┬───────────┘
              │
              ▼
    ┌─────────────────────┐
    │   Review & Export    │
    │                     │
    │ • Live HTML preview │
    │ • DOCX export       │
    │ • PDF export        │
    │ • Version log entry │
    │ • Artifact save     │
    └─────────────────────┘
```

### Storage

| Key | Type | Owner | Description |
|-----|------|-------|-------------|
| `pf_bullet_bank` | `Bullet[]` | Resume Builder | Curated bullet pool with metadata |
| `pf_resume_log` | `ResumeLog[]` | Resume Builder | Every resume ever generated |
| `pf_preferences` | `object` | Settings | Canonical skills pool, contact info, education, publication |
| `resume_{companySlug}_{roleId}` | `object` | Resume Builder | Cached resume state (analysis, bullet selections, generated content) |

**IndexedDB:** `pf_resumes` database stores uploaded resume file blobs (DOCX/PDF). These are the final exported files attached to pipeline roles, not the generation state.

---

## 3. Phase 1: JD Analysis (Client-Side)

Phase 1 runs automatically when a role is selected — no manual trigger required. If the role has JD text, the analysis fires immediately and populates the Analysis tab.

### 3.1 What Gets Extracted

| Field | Detection Method | Example Output |
|-------|-----------------|----------------|
| **Seniority level** | Title keyword scan (VP, Director, Principal, Staff, Senior) + JD body signals (team size, budget ownership, strategy language) | `"Principal"` |
| **Top 5-7 keywords** | TF-IDF-style extraction against the user's bullet bank. Only surface keywords the user legitimately has experience with. Flag borderline terms. | `["addressability", "real-time decisioning", "publisher monetization", "privacy", "audience segmentation"]` |
| **Primary domain** | Pattern matching on JD body (AdTech, AI/ML, identity, SaaS, fintech, data platforms, etc.) | `"AdTech"` |
| **Role type** | JD structure analysis (0-to-1 signals, scaling language, platform/infra terms, GTM emphasis) | `"Platform/Infrastructure"` |
| **Stakeholder environment** | Entity extraction (engineers, advertisers, agencies, C-suite, publishers, etc.) | `"Cross-Functional"` |
| **Fit assessment** | Keyword overlap with bullet bank + gap detection | `{ strong: true, gaps: false, borderline: false }` |

### 3.2 Auto-Analysis Behavior

The analysis auto-fires in these scenarios:
- User selects a role from the dropdown that has `jdText` on the role object
- User pastes/edits JD text in the sidebar and clicks "Analyze"
- Role is loaded from cache that already has a saved analysis

The analysis result is cached in `resume_{companySlug}_{roleId}` so it persists across page loads and doesn't re-run unnecessarily.

### 3.3 Analysis UI

The Analysis tab displays:
- **Role Profile** — seniority, role type, domain, stakeholder environment (all editable inline)
- **Key Skills & Keywords** — checkbox pills, pre-checked based on relevance. User can uncheck to exclude from generation.
- **Fit Assessment** — color-coded summary (green = strong, yellow = borderline, red = gaps). Actionable recommendation text.

---

## 4. Phase 2: Resume Generation (MCP Server)

Generation is the core value. It takes the Phase 1 analysis, the bullet bank, and the user's preferences and produces a complete, ready-to-export resume. This happens server-side via the MCP server's Claude API integration.

### 4.1 Generation Trigger

The "Generate Resume" button appears after Phase 1 completes. One click generates the entire resume. No configuration screens, no multi-step wizard. The agent makes every decision based on the analysis.

### 4.2 What Gets Generated

Six components, in priority order:

**1. Summary (highest priority)**
Rewritten for every JD. The summary:
- Opens with seniority level + domain matching the JD title
- Uses 3-5 keywords from the JD (only where the user genuinely has experience)
- References signature proof points (scale, impact metrics from the bullet bank)
- Closes with a cross-functional leadership line tuned to what the JD values
- Length: 4-5 sentences, one paragraph, no bullets

**2. Skills Bar (high priority)**
8 skills max, separated by `·`. Ordered by JD relevance (most relevant first). Pulled from the canonical skills pool in `pf_preferences`, substituting JD-specific terms where the user has the skill.

**3. Role Subtitles (medium priority)**
One-line italic subtitle per role, reframed to emphasize the JD-relevant angle. Recent roles get heavier customization; older roles are stable anchors.

**4. Bullet Selection & Ordering (medium priority)**
The agent selects from the bullet bank based on:
- Keyword relevance to the JD analysis
- Narrative coherence (bullets should tell a story, not just list achievements)
- Per-role limits (configurable in preferences, default: most recent = 3-4, mid-career = 5-6, older = 2 each)
- Always lead each role with the most JD-relevant bullet

**5. Lead Experience Framing (situational)**
The most recent role's lead bullet can be reframed depending on JD emphasis (e.g., leading with AI for AI roles, with platform work for platform roles).

**6. New Bullet Proposals (when needed)**
If the JD covers an angle the user genuinely has experience in but no bullet addresses, the agent proposes a new bullet. Proposed bullets are clearly flagged as "NEW — needs approval" and are NOT included in the exported resume until the user approves them. Approved bullets auto-add to the bullet bank.

### 4.3 MCP Tool: `pf_generate_resume`

```typescript
// Input
{
  roleId: string;
  companySlug: string;
  jdAnalysis: {
    seniority: string;
    keywords: string[];
    domain: string;
    roleType: string;
    stakeholderEnv: string;
    fit: { strong: boolean; gaps: boolean; borderline: boolean };
  };
  bulletBank: Bullet[];
  preferences: {
    contactInfo: ContactInfo;
    education: string;
    publication: Publication;
    canonicalSkills: string[];
    positioning: 'ic' | 'management';
  };
  researchBrief?: {
    fitSection: string;    // Section 5 content
    compSection: string;   // Section 10 content
  };
}

// Output
{
  summary: string;         // Generated summary paragraph
  skillsBar: string[];     // Ordered skills list
  roles: {
    company: string;
    title: string;
    dates: string;
    subtitle: string;      // Generated italic subtitle
    bullets: {
      id: string;          // Bullet bank ID (null if new proposal)
      text: string;        // Bullet text (may be reframed)
      isNew: boolean;      // True if this is a new bullet proposal
      relevanceScore: number; // 0-1, how relevant to JD
    }[];
  }[];
  coverLetter?: string;    // Only if requested
  rationale: string;       // Explanation of key editorial decisions
}
```

### 4.4 Hard Rules (Inviolable)

These rules are enforced at generation time and cannot be overridden:

1. **One page, always.** The generated content must fit on a single US Letter page with the specified margins and fonts.
2. **Never embellish.** If a JD uses a product name the user hasn't worked on, the agent uses honest framing (see Section 7).
3. **Keywords must be earned.** No pattern-matching JD language onto the resume without genuine experience backing it.
4. **No em dashes.** Use spaced en dash (` – `) everywhere.
5. **Bullet format:** `**Bold lead phrase** followed by regular text with a specific metric or outcome`.
6. **Every role has an italic subtitle** beneath the job header.
7. **Output:** `.docx` file via the `docx` npm library.

### 4.5 Seniority Calibration

| JD Title Contains | Summary Opens With |
|---|---|
| Sr. Director / VP | "Sr. Director-level Product leader..." |
| Director | "Director-level Product leader..." |
| Principal PM | "Principal-level Product leader..." |
| Staff PM | "Staff-level Product leader..." |
| Senior PM | "Senior Product Manager..." |

### 4.6 Positioning-Aware Generation

The `positioning` field (IC vs. management) on the role controls framing:

| Aspect | IC | Management |
|--------|-----|------------|
| Summary opener | "Principal-level Product leader..." | "Director-level Product leader..." |
| Bullet selection | Depth: systems built, technical decisions, individual ownership | Breadth: team leadership, org outcomes, cross-functional influence |
| Lead experience | Most recent technical/platform work | Career progression showing increasing scope |
| Skills bar | Technical/domain skills first | Leadership/strategy skills first |

---

## 5. Bullet Bank

The bullet bank is the Resume Builder's long-term memory. It starts with a seed set and grows with every resume generated.

### 5.1 Data Model

```typescript
interface Bullet {
  id: string;              // Unique identifier
  role: string;            // Which job role this bullet is from (e.g., "JPMC", "Yahoo")
  text: string;            // Full bullet text with **bold** lead phrase
  theme: string;           // Category: technical, leadership, revenue, 0-to-1, cross-functional
  keywords: string[];      // Relevant domain keywords this bullet demonstrates
  metrics: string[];       // Specific numbers/percentages in this bullet
  dateAdded: string;       // ISO date
  usageCount: number;      // How many resumes have used this bullet
  lastUsed: string;        // ISO date of last usage
  approved: boolean;       // False = agent-proposed, needs user review
  source: 'seed' | 'manual' | 'agent-proposed' | 'research-brief';
}
```

### 5.2 Growth Mechanisms

The bank grows from four sources:

1. **Seed bullets** — ship with the module, covering the user's known experience
2. **Manual additions** — user writes and adds bullets directly in the Bullet Bank tab
3. **Agent proposals** — during generation, the agent identifies JD angles not covered by existing bullets and proposes new ones. These are flagged `approved: false` and must be explicitly approved.
4. **Research Brief feed** — when the Research Brief generates Section 5 ("Why You Fit"), it may surface experience angles the user hasn't bulletized. The Resume Builder imports these as bullet proposals.

### 5.3 Bullet Bank as Feeder

This is the key insight the user identified: "I have a ton of Agile experience, but didn't add it to the bullet bank."

The agent should proactively identify **experience gaps** in the bullet bank:
- After generating a resume, compare the JD keywords against the bullet bank's keyword coverage
- If a keyword is relevant (the user has the experience) but no bullet demonstrates it, flag it as a "Bullet Bank Gap"
- Propose a bullet with the standard formula: `**[Action verb phrase]** + context + specific metric`
- Track gap frequency across roles — if "Agile" shows up in 5 JDs but has no bullet, surface it prominently

The Bullet Bank tab should have a "Suggested Bullets" section showing:
- Agent-proposed bullets awaiting approval
- Frequently-requested keywords with no bullet coverage
- Underused bullets that might be stale

### 5.4 Honest Framing Guidelines

| Avoid (if not directly done) | Honest Alternative |
|---|---|
| Product-specific names (e.g., "Sponsored Ads") | Generic category (e.g., "advertiser-facing ad products") |
| "Identity Resolution" (if only consuming) | "Addressability" or "audience identity systems" |
| "Clean Rooms" | "privacy-compliant data collaboration" |
| Specific vendor products (e.g., "UID2," "RampID") | "privacy-preserving identity solutions" |
| Domain terms without direct experience | Omit unless explicitly applicable |

When in doubt: describe what was actually built and let the reader make the connection.

---

## 6. Feedback Loops

The Resume Builder doesn't operate in isolation. It both consumes and produces data that other modules use.

### 6.1 Research Brief → Resume Builder

| Research Brief Section | How Resume Builder Uses It |
|----------------------|---------------------------|
| Section 5: "Why You Fit" | Seeds the fit assessment; surfaces experience angles for bullet selection |
| Section 6: "Potential Concerns" | Identifies gaps to avoid over-claiming in the resume |
| Section 10: "Comp Intelligence" | Informs seniority calibration (is this role priced at Director or VP?) |
| Section 0: "JD Summary" | Provides a clean, structured version of the JD for analysis |

### 6.2 Resume Builder → Research Brief

| Resume Builder Output | How Research Brief Uses It |
|----------------------|---------------------------|
| Fit assessment | Section 5 reads the fit assessment to tailor "Why You Fit" content |
| Bullet selections | Section 11 ("Questions to Ask") can reference what the resume emphasized |
| Identified gaps | Section 6 ("Potential Concerns") highlights resume gaps as interview risks |

### 6.3 Resume Builder → Bullet Bank (self-feeding)

Every resume generation is a bullet bank audit:
- New bullet proposals get queued for approval
- Usage counts update on selected bullets
- Keyword gap analysis runs post-generation
- The more resumes generated, the more comprehensive the bank becomes

### 6.4 Pipeline → Resume Builder (auto-context)

When a role is selected, the Resume Builder pulls:
- JD text from `pf_roles`
- Company profile from `pf_companies`
- Positioning (IC/management) from the role record
- Connections from `pf_connections` (relevant for cover letter personalization)

No re-entry required. Change the JD in Pipeline, and the Resume Builder picks it up on next load.

---

## 7. UI Specification

### 7.1 Layout

The Resume Builder uses the standard Pathfinder sidebar + workspace layout:

**Sidebar (left, 260px):**
- Role selector dropdown (grouped by pipeline stage)
- Company card (logo, name, domain, tier)
- Role details (position, stage, type, date added)
- JD display (scrollable, with Edit JD button)
- Fit Assessment summary (color-coded)

**Workspace (right, fills remaining):**
Four tabs: Analysis | Builder | Bullet Bank | History

### 7.2 Tab: Analysis

Displays the Phase 1 JD analysis. Auto-populates when a role with JD text is selected.

- **Role Profile section** — four editable fields (seniority, role type, domain, stakeholder env)
- **Key Skills & Keywords** — checkbox pills, all pre-checked. Uncheck to exclude from generation.
- **Fit Assessment** — color-coded card with strong/gaps/borderline indicators and recommendation text
- **"Generate Resume" button** — appears when analysis is complete. Single click triggers full generation.

### 7.3 Tab: Builder

The main generation workspace. Shows:

- **Live HTML preview** of the resume (rendered to match DOCX output as closely as possible)
- **Section-by-section editing** — click any section (summary, skills, role subtitle, bullets) to edit inline
- **Bullet swap UI** — for each role, see selected bullets with drag-to-reorder. "More bullets" expander shows unselected bullets from the bank.
- **New bullet proposals** — highlighted in amber with "Approve" / "Reject" buttons
- **Export bar** — DOCX download, PDF download, copy-to-clipboard (plain text)
- **"Regenerate" button** — re-runs generation with current analysis + any manual overrides

### 7.4 Tab: Bullet Bank

Full bullet bank management:

- **By Role view** — bullets grouped by employer (JPMC, Yahoo, New Relic, Conversant)
- **By Theme view** — bullets grouped by theme (technical, leadership, revenue, 0-to-1, cross-functional)
- **Suggested Bullets section** — agent-proposed bullets awaiting approval, keyword gap alerts
- **Add Bullet form** — manual entry with role, theme, keywords, and text fields
- **Bullet stats** — usage count, last used date, keyword tags
- **Import/Export** — JSON export for backup, import for restore

### 7.5 Tab: History

Version log of every resume generated:

- Date, company, role, positioning
- Key customizations summary (what changed vs. base)
- Fit assessment at time of generation
- Quick actions: view, re-export, duplicate-and-edit
- Cover letter indicator (if one was generated)

### 7.6 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-4` | Switch between tabs (Analysis, Builder, Bullet Bank, History) |
| `G` | Generate resume (when analysis is complete) |
| `E` | Toggle edit mode on the current section |
| `D` | Download DOCX |
| `P` | Download PDF |
| `Esc` | Close edit mode / deselect |

---

## 8. Output Format

### 8.1 DOCX Generation

Generated via Node.js `docx` library with these constraints:

- **Page:** US Letter (12240 x 15840 DXA)
- **Margins:** top/bottom 780 DXA, left/right 1008 DXA
- **Fonts:** Arial throughout
- **Job headers:** borderless two-column table (company+title left, date right-aligned). Never use tab stops (they break in Google Docs).
- **Bullet indents:** left 480 DXA, hanging 280 DXA
- **Bullet style:** `LevelFormat.BULLET` with numbering config. Never unicode bullet characters inline.
- **Output filename:** `{FirstName}_{LastName}_Resume_{Company}_{RoleTitle}.docx`

### 8.2 Auto-Save

On generation, the resume is:
1. Cached in localStorage at `resume_{companySlug}_{roleId}` (generation state)
2. Logged to `pf_resume_log` (version history)
3. Saved via Artifacts MCP with tags: `{company, roleId, type: 'resume', positioning, date}`
4. Available for attachment in the Pipeline's "Resume Sent" section

---

## 9. Cover Letter (Optional)

For each application, the agent may produce a cover letter alongside the resume:

- 3 paragraphs max, no longer than half a page
- Paragraph 1: Why this role and this company specifically — reference something concrete from the JD or company context
- Paragraph 2: The 1-2 most relevant proof points from the user's background, in plain language
- Paragraph 3: Short close — direct, no filler phrases
- Tone: confident, direct, no fluff. No "I am excited to apply" or "I believe I would be a great fit"
- Never use em dashes
- Only generated when explicitly requested (checkbox in the Builder tab)

---

## 10. Implementation Phases

### Phase 1: Client-Side Foundation (Current — v1.0)
What exists today:
- [x] Role selector with pipeline integration
- [x] Client-side JD analysis (seniority, keywords, domain, role type, stakeholder env, fit)
- [x] Auto-analysis on role selection
- [x] Bullet bank with seed data
- [x] Manual bullet selection in Builder tab
- [x] Basic HTML preview
- [x] Version history tab

### Phase 2: MCP-Powered Generation (Next — v2.0)

> **Status: Planned** — Not yet implemented. Spec retained for future development.

- [ ] `pf_generate_resume` MCP tool with Claude API integration
- [ ] Server-side generation of summary, skills bar, subtitles, bullet selection
- [ ] New bullet proposal flow (agent proposes → user approves → bank grows)
- [ ] DOCX export via `docx` npm library
- [ ] PDF export (DOCX → PDF conversion)
- [ ] Research Brief data feed (fit assessment, Section 5 content)

### Phase 3: Feedback Loops & Intelligence (v2.1+)

> **Status: Implemented (v3.13.0)** — Keyword gap analysis with frequency. Claude-generated bullet suggestions. "Add to Bullet Bank" buttons.

- [x] Keyword gap analysis post-generation
- [x] Suggested Bullets section in Bullet Bank tab
- [x] Research Brief → Resume Builder automatic data flow
- [x] Resume Builder → Pipeline fit assessment writeback
- [ ] Cover letter generation
- [ ] Bulk generation (generate resumes for all active roles in one click)

---

## 11. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Time from "select role" to "export DOCX" | < 3 minutes | Timestamp log |
| User edits after generation | < 5 per resume (ideally 0-2) | Edit event tracking |
| Bullet bank coverage | 90%+ of JD keywords covered by existing bullets | Gap analysis |
| Resume reuse rate | Every resume uses 80%+ existing bullets (vs. new) | Bullet bank stats |
| Honest framing compliance | 0 embellished keywords per resume | Manual audit |

---

## 12. Relationship to Other Modules

```
Pipeline ──────► Resume Builder ──────► Artifacts MCP
  (roles, JD)     (generation)           (file storage)
                       │
Research Brief ◄───────┤
  (fit data)           │
                       ▼
                  Bullet Bank
                  (grows over time)
                       │
                       ▼
                  Outreach Module
                  (resume attachment, talking points)
```

The Resume Builder is the central conversion point in Pathfinder. Everything upstream (Pipeline, Research Brief, Feed) prepares context. Everything downstream (Outreach, Interview Prep) uses the resume as a reference artifact.

---

## 13. Confidence & Provenance

- **Bullet bank traceability:** Every bullet selected for a resume is tagged with its `pf_bullet_bank` entry ID. Generated resumes log: `{ bulletIds: [], model, promptVersion, generatedAt, roleId, positioning }`.
- **Skill sourcing:** Every skill listed in the generated resume must map to either: (a) a bullet bank entry, (b) the user's stated experience in their profile, or (c) a skill explicitly mentioned in the JD (marked as "gap" if user doesn't have it). Skills from source (c) are flagged as "stretch" and shown with a visual indicator.
- **Generation metadata:** Each resume generation logs: model version, prompt version, JD hash, selected positioning (IC/leader), bullet bank version hash, generation timestamp. Stored in `pf_resume_log`.
- **Version history:** User can view prior resume versions for any role. Diff view highlights what changed between versions (bullets added/removed, phrasing changes).

---

## 14. Testing Strategy

- **Golden test cases:** Maintain 5 roles in `docs/eval/resume-builder/` with hand-curated "correct" resumes:
  1. FAANG Staff PM role (IC positioning, technical emphasis)
  2. Growth-stage Head of Product (leader positioning, team-building emphasis)
  3. AI/ML PM role (technical + domain expertise)
  4. Enterprise SaaS PM (GTM + customer-facing)
  5. Early-stage founding PM (generalist, zero-to-one)
- **Regression protocol:** Before prompt changes, generate all 5 resumes and compare: bullet selection accuracy (did it pick the right bullets?), keyword coverage (does it hit JD keywords?), no hallucinated skills, formatting intact.
- **Acceptance criteria:** ≥80% of selected bullets are relevant to the JD. Zero invented skills or accomplishments. Keyword gap coverage ≥70% (at least 70% of JD keywords addressed).
- **Edge cases:** Role with no JD (stub only), role with extremely long JD (>5000 words), empty bullet bank, bullet bank with 100+ entries.
