# Pathfinder Documentation Review v3.11
**Review Date:** 2026-03-13
**Reviewer:** Claude (via Pathfinder Docs Reviewer Skill)
**Review Scope:** All system docs + 11 module PRDs + changelog + context guide
**Total Docs Reviewed:** 17 primary markdown documents + CHANGELOG + CLAUDE_CONTEXT

---

## Overall Assessment

Pathfinder's documentation is **strong in breadth but uneven in depth and consistency**. The system PRD and CLAUDE_CONTEXT are well-structured with clear architecture diagrams and data contracts. Individual module PRDs are thorough, but with significant gaps in three areas:

1. **Risk/Failure Mode Coverage** — 4 modules (Dashboard, Outreach, Pipeline, Research Brief) lack explicit risk sections. Dashboard is particularly hollow on error states and guardrails.
2. **AI Evaluation & Quality Assurance** — No system-wide evaluation framework exists. Modules using Claude API (Research Brief, Resume Builder, Debrief, Outreach, Mock Interview) define prompts but lack golden datasets, regression tests, or acceptance thresholds.
3. **Instrumentation & Event Taxonomy** — Scattered success metrics but no canonical event schema, no event ownership assignments, no formulas linking metrics to instrumentation.

**Strengths:**
- Architecture is crystal-clear with excellent dependency graphs
- Data model is well-defined with explicit field ownership and mutable/immutable rules
- Integration points with external services (Google Calendar, Gmail, Levels.fyi, Apify, Clay) are documented
- Each module defines purpose, data flow, and UI specs thoroughly
- CLAUDE_CONTEXT enforces critical rules (PRD sync, version convention, data contracts)

**Weaknesses:**
- No unified system-level policies for AI evaluation, confidence levels, or content quality gates
- Error handling is documented per-module but lacks cross-module patterns
- Testing expectations are aspirational, not operational (no concrete test case examples)
- Domain model glossary is absent (terms like "positioning", "tier", "stage" recur with slight inconsistencies)
- No ADR (Architecture Decision Record) history for significant architectural choices

---

## Highest-Priority Gaps

### 1. **Research Brief: Missing Success Metrics & Testing Strategy**
**Severity:** HIGH
**Evidence Status:** Confirmed missing
**Why It Matters:** Research Brief is one of the three AI-powered content generation modules (alongside Resume Builder and Debrief). The PRD defines 10 sections and prompt structure but provides no measurable quality bar, no regression test dataset, and no acceptance criteria for release. This creates implementation risk — devs will guess what "good enough" means.

**Exact Recommendation:**
- Add Section 11: "Success Metrics" defining:
  - Citation accuracy rate (≥95% of claims must be sourceable to role/company data or flagged as inferred)
  - Section completeness (all 10 sections generated in <45 seconds)
  - User satisfaction (after N runs, measure which sections users find most/least useful)
  - Staleness detection (stale claims flagged within 24h of data expiration)
- Add Section 12: "Testing Strategy" with:
  - 5 golden test cases (Stripe Staff PM, Amazon Principal PM, early-stage startup role, etc.)
  - Regression dataset: 20 roles with hand-evaluated "correct" briefs
  - Evaluation rubric (is each section fact-grounded? Does it match the role scope? Does it address user positioning?)
  - Automated freshness checker: validate citations are live before release

**Suggested Filename/Section:** `docs/research-brief-prd.md` → add Sections 11-12 after "Section 10: Success Criteria"

---

### 2. **Dashboard: No Guardrails for Nudge Engine Rules**
**Severity:** HIGH
**Evidence Status:** Confirmed missing
**Why It Matters:** Dashboard defines 12 nudge triggers (roles stuck >21d, offer response overdue, etc.) but provides no safeguards against:
- Nudge storm: firing 10+ nudges on single page load
- False positives: nudging "apply for Hot-tier companies" when user explicitly dismissed that category
- Cascading dismissals: if user dismisses "prep for interview", does system stop generating related prep nudges?

The current design has no `pf_nudge_suppression` rules, no cooldown period logic (24h dismiss works for one nudge, not entire rule), and no per-rule disable mechanism. This is a reliability gap.

**Exact Recommendation:**
- Add Section 14: "Nudge Engine Safeguards" defining:
  - Max 3 nudges per page load (prioritize by severity: Critical > Important > Suggested)
  - Cooldown periods: once dismissed, rule doesn't fire again for 24h, except Critical items (re-fire after 6h)
  - Suppression: certain dismissals suppress related rules (dismiss "prep for interview" → suppress "research brief needed" for same role for 48h)
  - Logging: every nudge trigger logs to `pf_nudge_log: { trigger, fired, dismissed, dismissedAt, reason }` for analytics
  - Manual disable: sidebar "Nudge Preferences" allows user to disable specific rules entirely
- Add Section 15: "Error Handling & Edge Cases":
  - What if nudge references a deleted role? (Filter it out, don't fire)
  - What if calendar event is malformed? (Log error, skip that event, continue processing)
  - What if `pf_roles` is corrupted? (Graceful degrade: show what can be parsed, show warning)

**Suggested Filename/Section:** `docs/dashboard-prd.md` → add Sections 14-15

---

### 3. **No System-Wide AI Evaluation Framework**
**Severity:** BLOCKER
**Evidence Status:** Confirmed missing
**Why It Matters:** Five modules call Claude API for content generation (Research Brief, Resume Builder, Debrief, Outreach, Mock Interview). Each defines prompts but none define:
- Prompt versioning strategy (how do we track "v1" vs "v2" of research brief prompt?)
- Model versioning (are we pinning `claude-sonnet-4-20250514` or using latest? When do we test new models?)
- Grounding requirements (which modules can hallucinate vs. which must be fact-grounded?)
- Hallucination taxonomy (Research Brief: confuses companies. Resume: invents skills. Outreach: creates false claims about recipient.)
- Acceptance thresholds (minimum citation accuracy for release? Max error rate?)
- Regression testing (when we improve a prompt, how do we verify we didn't break existing quality?)

**Exact Recommendation:**
Create new file: `docs/ai-evaluation-framework.md` with:

**Section 1: Prompt Versioning**
- Format: `{module}_{section or feature}__v{N}_{date}`
- Example: `research-brief__company-section__v2_20260313`
- Stored in module PRDs and CLAUDE_CONTEXT versioning table
- When changed: bump version, document delta in CHANGELOG
- Rollback procedure: keep prior 2 versions available in code, can revert via feature flag

**Section 2: Model Versioning**
- Current default: `claude-sonnet-4-20250514` (stored in `pf_claude_model`)
- Test schedule: when new Claude version released, run regression suite within 1 week
- A/B testing: Modules can expose "model selector" in settings for experimentation
- Acceptance criteria: new model must score ≥current model on regression dataset, or document trade-off

**Section 3: Grounding by Module**
| Module | Hallucination Risk | Max Error Rate | Grounding Requirement |
|--------|-------------------|---------------|-----------------------|
| Research Brief | Medium | ≤5% | 100% citations required; sources must be JD + enriched company data + user input |
| Resume Builder | High | ≤2% | All skills/accomplishments must map to user's bullet bank or stated experience |
| Debrief | Low | ≤10% | Synthesis okay if grounded to user's stated feedback (user data as source of truth) |
| Outreach | High | ≤1% | No invented facts about recipient; specific initiatives must be confirmed in input |
| Mock Interview | Low | ≤10% | Questions can be generative; evaluation reasoning must reference user's stated answer |

**Section 4: Hallucination Taxonomy**
- **Research Brief hallucinations**: Confuses company A with company B (cite wrong funding); claims wrong competitors; attributes news to wrong company
- **Resume hallucinations**: Invents skills user doesn't have; fabricates quantified impact; exaggerates seniority signals
- **Debrief hallucinations**: Attributes feedback to wrong interviewer; invents patterns user didn't describe
- **Outreach hallucinations**: Invents specific facts about recipient (claims they led X when they didn't); false product claims
- **Mock Interview hallucinations**: Asks about technologies not relevant to stated role; misunderstands industry norms

**Section 5: Acceptance Thresholds**
- Research Brief: 95% of citations must resolve (link to source). 0 factual contradictions detected on spot check.
- Resume: 100% of stated skills/impact in user's bullet bank. 0 invented accomplishments on QA review.
- Debrief: All feedback categorized correctly. Pattern claims grounded to ≥3 independent instances.
- Outreach: 100% personalization signals present (recipient name, specific initiative, relevant background). 0 hallucinated facts on manual review.
- Mock Interview: Framework adherence ≥80% (e.g., ≥8/10 questions follow stated interview type). Evaluation reasons cite user's actual words.

**Section 6: Regression Testing**
- **Golden datasets**: Each module maintains 10-20 hand-curated test cases with known-good outputs
- **Before release**: Run regression suite on current prompt vs prior prompt. Flag any degradation.
- **Quarterly audit**: Sample 30 random outputs per module, score against rubric, track metrics over time
- **Version control**: Keep regression datasets in `/docs/eval/` folder with results timestamped

**Section 7: Human Review Gates**
- First 10 runs of new prompt version: manual review before showing to user
- If error detected: roll back prompt, add test case to golden dataset
- Monthly: sample 3 random outputs per module, escalate any concerns

**Suggested Filename:** `docs/ai-evaluation-framework.md` (new file)

---

### 4. **No Event Taxonomy / Instrumentation Schema**
**Severity:** HIGH
**Evidence Status:** Confirmed missing
**Why It Matters:** Dashboard defines success metrics ("3 offers pending", "12 actions this week", "67% applied-to-screen conversion"). But there's no canonical event schema. Each module logs data differently:
- Pipeline: `lastActivity` timestamp on role
- Outreach: `outreachLog[]` with `{ date, note, channel, contactId }`
- Debrief: `debriefs[]` with `{ roleId, date, ratings{} }`
- Calendar: Event titles + linked roleId

This fragmentation makes:
- Dashboard metrics unreliable (can't aggregate "actions this week" if modules define action differently)
- Analytics impossible (no way to compute week-over-week trends across the system)
- Troubleshooting hard (no shared logging format)

**Exact Recommendation:**
Create new file: `docs/instrumentation-event-taxonomy.md` with:

**Section 1: Canonical Event Schema**
```javascript
// Every event logged to pf_event_log: Event[]
{
  id: string,           // "evt-{timestamp}-{uuid4}"
  timestamp: number,    // milliseconds since epoch
  source: string,       // module name: "pipeline", "dashboard", "outreach", etc.
  action: string,       // verb: "role.added", "outreach.sent", "interview.completed"
  resourceType: string, // "role", "company", "connection", "interview"
  resourceId: string,   // roleId, companyName, connectionId, etc.
  details: object,      // action-specific payload
  userId: string,       // always "self" (single-user system, but structured for future)
  version: number       // schema version for migrations
}
```

**Section 2: Event Catalog (Partial)**
| Event | Source | ResourceType | Action | Details | Metric |
|-------|--------|-------------|--------|---------|--------|
| Role discovered | job-feed | role | role.added | { feedSource, score, matchReason } | "New roles added" |
| Role applied | pipeline | role | role.applied | { method, applicationDate, url } | "Applications" |
| Stage transition | pipeline | role | role.stage_changed | { fromStage, toStage, reason, manual } | "Roles advanced" |
| Interview scheduled | calendar | role | interview.scheduled | { interviewType, interviewer, date } | "Interviews scheduled" |
| Interview completed | debrief | role | interview.completed | { interviewType, rating, feedback } | "Interviews completed" |
| Outreach sent | outreach | connection | outreach.sent | { messageType, channel, recipientId, date } | "Outreach messages sent" |
| Research brief generated | research-brief | role | brief.generated | { sections, generationTime, cached } | "Briefs generated" |
| Resume generated | resume-builder | role | resume.generated | { filename, format, positioning } | "Resumes generated" |
| Debrief submitted | debrief | role | debrief.submitted | { sections, insights } | "Debriefs submitted" |

**Section 3: Derived Metrics**
- "Actions this week" = SUM(events where source != "dashboard" AND timestamp within [Mon 0:00, Sun 23:59])
- "Conversion Applied → Screen" = COUNT(role.stage_changed, toStage=screen) / COUNT(role.stage_changed, fromStage=applied)
- "Interview feedback loop closed" = COUNT(interview.completed) / COUNT(interview.scheduled) within 7 days

**Section 4: Event Logging Pattern**
```javascript
// Every module implements logEvent(action, resourceType, resourceId, details)
// Stored to: pf_event_log (localStorage) with 1-second debounce, synced to MCP via data-layer.js
// Retention: 90 days in localStorage, archive to MCP after 30 days
// Purge: oldest events dropped when pf_event_log exceeds 5000 events
```

**Section 5: Analytics Queries**
- Dashboard queries event_log for daily metrics
- Users can export event_log to CSV for external analysis
- MCP server provides `/events?filter={source,action,date_range}` endpoint

**Suggested Filename:** `docs/instrumentation-event-taxonomy.md` (new file)

---

### 5. **Outreach Module: No Risk / Fallback Guidance**
**Severity:** HIGH
**Evidence Status:** Confirmed missing
**Why It Matters:** Outreach is responsible for generating personalized networking messages that the user sends under their own name. Failure modes:
- Hallucinated facts about recipient (module claims "I know you led X project" when they didn't) → damaged relationship
- Generic template when personalization fails → wastes outreach opportunity
- Message sent to wrong person → awkward (wrong email, LinkedIn DM to wrong user)
- Email bounce → outreach marked sent but never received

Currently the PRD defines message types and structure but has no safety guardrails:
- No minimum personalization threshold before allowing send
- No fallback message template if context is missing
- No validation that recipient email/LinkedIn exists
- No grace period for "unsend" (once user clicks send, it's gone)

**Exact Recommendation:**
Add Section 14 to `docs/outreach-prd.md`:

**"14. Risks / Failure Modes / Guardrails"**

- **Risk: Hallucinated recipient facts** (High impact)
  - Mitigation: Generator output must cite every specific claim. Unverified claims prefixed with "I believe" or "I understand". User can edit before sending.
  - Fallback: If context data incomplete, show warning: "This draft lacks specific personalization. Review before sending?"
  - Acceptance: ≥2 of 4 personalization pillars (specific initiative, recipient role, your background, mutual connection) must be present to allow send without user confirmation

- **Risk: Generic template masquerading as personal** (Medium impact)
  - Mitigation: All messages generated from specific context. Template fallbacks never sent directly.
  - Fallback: If generator returns placeholder text (e.g., "[Your background here]"), show error and ask user to add context
  - Acceptance: 0 placeholder text in final message before send

- **Risk: Message sent to wrong recipient** (High impact)
  - Mitigation: Email validation. If recipient email not in `pf_connections`, show warning: "This person isn't in your connections. Email: {email}. Correct?" LinkedIn DM only works if connectionId exists.
  - Fallback: Draft Queue feature — save unsent messages with 24h "recall" window. User can edit before final send.
  - Acceptance: Require explicit confirmation for new emails

- **Risk: Email bounces silently** (Medium impact)
  - Mitigation: If user provides email, send a test message first (e.g., to self or a test account) to validate deliverability
  - Fallback: If bounce detected, suggest: "Email returned undeliverable. Try LinkedIn instead?" or "Update contact email and retry?"
  - Acceptance: Log bounce events, surface in Dashboard as "Outreach delivery issue"

- **Risk: Campaign sent too fast (spam filter)** (Low impact)
  - Mitigation: Draft Queue batches outreach. When user queues 5+ messages, show warning: "Sending 5 emails in one session may trigger spam filters. Space them out 1-2 hours apart?"
  - Fallback: Offer "Schedule sends" — queue messages with time delays

---

### 6. **Pipeline: Missing Confidence / Provenance Policy**
**Severity:** MEDIUM
**Evidence Status:** Confirmed missing
**Why It Matters:** Pipeline stores roles with rich metadata: salary ranges (extracted from JD), company tier (assigned by user), stage history (manual + auto-triggered). But the PRD doesn't define:
- Which fields are authoritative vs. inferred?
- When is user-entered data vs. AI-extracted data?
- How stale can salary data be before showing warning?
- What provenance must be logged (who extracted this? when? from where?)

This creates data integrity issues. Example: a salary extracted 6 months ago is displayed as current; user doesn't realize it's stale.

**Exact Recommendation:**
Add Section 16 to `docs/pipeline-prd.md`:

**"16. Confidence & Provenance Handling"**

| Field | Source | Confidence | Staleness Warning | Provenance Logged |
|-------|--------|-----------|-------------------|-------------------|
| `salary.min / .max` | JD extraction (Apify or web search) | Medium | ≥30 days | { source, extractedAt, extractedFrom (URL), extractionMethod } |
| `title` | User input | High | Never | { enteredBy, enteredAt } |
| `stage` | User manual transition | High | Never | { changedBy, changedAt, reason } |
| `fundingStage` | Enrichment (Clay, Crunchbase) | Medium | ≥90 days | { source, enrichedAt, dataPoint } |
| `missionStatement` | Enrichment | Medium | ≥90 days | { source, enrichedAt } |
| `logoUrl` | Google Favicon API | High (structural) | Never | { source, fetchedAt } |
| `connections.linkedRoles[]` | User manual linking | High | Never | { linkedBy, linkedAt } |

- When displaying stale data: show subtle indicator (clock icon + tooltip "Last updated 45 days ago")
- When displaying enriched data: show source badge (Clay logo, Crunchbase icon, etc.)
- When user questions data: "Update this?" button calls refresh with data layer

---

### 7. **Artifacts MCP: Missing Confidence / Provenance**
**Severity:** MEDIUM
**Evidence Status:** Confirmed missing
**Why It Matters:** Research briefs, resumes, and debriefs are saved to MCP with citations/timestamps, but the artifact index doesn't capture:
- Which claims in the brief are facts vs. inferences?
- When will this brief become stale (inferred from company news refresh interval)?
- Can this artifact be exported/shared, and are there compliance concerns?
- Audit trail: who generated it? Who modified it?

**Exact Recommendation:**
Add to `docs/artifacts-mcp-prd.md` Section 8 "Security & Privacy":

**"8.2 Confidence & Freshness Metadata"**

Every artifact carries metadata:
```javascript
{
  id: "brief-{roleId}",
  type: "research_brief",
  roleId, companyName,
  createdAt, generatedBy: "claude-sonnet-4-20250514",
  freshUntil: ISO timestamp,  // when should this be refreshed?
  confidence: { // per-section
    companyProfile: "high",
    competitors: "medium",
    culture: "low",  // inferred from limited data
  },
  provenance: {
    dataAge: { companyNews: 3d, funding: 120d, ... },
    sources: [ "jobDescription", "crunchbase", "linkedin", ... ]
  },
  auditLog: [
    { action: "created", by: "claude", at: timestamp },
    { action: "regenerated", by: "claude", at: timestamp }
  ]
}
```

---

## What's Missing

### Critical Missing Docs

1. **`docs/architecture-decisions-and-invariants.md`** (BLOCKER)
   - No record of major architectural choices: why MCP? why localStorage over IndexedDB? why vanilla HTML/JS vs framework?
   - No documented invariants: what must always be true (e.g., "Pipeline is single source of truth for roles", "all pf_* keys synced within 1 second")
   - ADR candidates: MCP as integration layer, localStorage as source of truth, no server backend

2. **`docs/domain-model-and-glossary.md`** (HIGH)
   - Terms like "positioning" (IC vs. leader), "tier" (hot/active/watching), "stage" (8 lifecycle stages), "enrichment" used across modules with slight variations
   - No central definitions
   - Example: Pipeline refers to "stage" as 8 values; Dashboard refers to stages elsewhere; no validation that stage enums are consistent

3. **`docs/integrations-and-compliance.md`** (HIGH)
   - No unified policy for external service auth, rate limiting, token handling, data freshness
   - Google Calendar: rate limits? token refresh? Fallback if API unavailable?
   - Gmail: OAuth scopes? Data residency? Retention policy?
   - Clay: API credentials handling? Fallback if unavailable?
   - Levels.fyi: scraping vs API? Copyright concerns?

4. **`docs/confidence-provenance-and-citation-policy.md`** (HIGH)
   - No system-wide rules for when to show confidence levels, when to require citations, when to flag stale data
   - Each module should reference this canonical policy

5. **`docs/mvp-boundaries-and-sequencing.md`** (MEDIUM)
   - PRD defines what ships v1, what's deferred, but no explicit exit criteria
   - When is Dashboard "done enough" for release? When are mock interviews feature-complete?
   - No sequencing rules (e.g., "Pipeline must launch before Outreach", "Job Feed before Resume Builder")

6. **`docs/testing-strategy.md`** (HIGH)
   - No unified testing approach across modules
   - No golden datasets for regression testing
   - No end-to-end test scenarios documented
   - No chaos/failure injection testing (e.g., "what happens if localStorage is cleared mid-session?")

### Critical Missing Sections in Existing Docs

**Research Brief PRD:**
- ❌ Success Metrics
- ❌ Testing Strategy
- ❌ Risk / Failure Modes / Guardrails

**Dashboard PRD:**
- ❌ Risk / Failure Modes / Guardrails (error handling when nudge references deleted role, etc.)
- ❌ Testing Strategy
- ❌ Confidence / Provenance

**Pipeline Tracker PRD:**
- ❌ Confidence / Provenance (when is salary data stale?)
- ❌ Risk / Failure Modes (data corruption recovery)

**Outreach PRD:**
- ❌ Risk / Failure Modes (hallucinated facts, email bounce handling)

**Mock Interview PRD:**
- ❌ Instrumentation (no mention of event logging for session data)

**Resume Builder PRD:**
- ❌ Confidence / Provenance (how do we track which bullet bank items were used?)
- ❌ Testing Strategy (regression dataset for resume quality)

---

## Cross-Doc Inconsistencies

### 1. **"Stage" Terminology Inconsistency**
- **Pipeline PRD** defines 8 role lifecycle stages: `discovered`, `researching`, `outreach`, `applied`, `screen`, `interviewing`, `offer`, `closed`
- **Job Feed PRD** references "stage" as tier (hot/active/watching), NOT lifecycle stage
- **Dashboard PRD** uses both meanings interchangeably without clarification
- **CLAUDE_CONTEXT** defines stage as lifecycle in data contracts, but the JSON output from Feed has both `stage` (lifecycle) and `tier` (priority)

**Fix:** Create glossary defining both concepts clearly, use `lifecycle_stage` vs `tier` consistently

### 2. **Enrichment Status Representation**
- **Pipeline Data Model**: `company.enrichmentStatus: "enriched" | "pending" | null`
- **Job Feed PRD**: no mention of enrichment status field
- **Artifacts PRD**: artifacts have `confidence` and `provenance` but roles don't reference this

**Fix:** Document which modules enrich which entities and to what standard

### 3. **"Brief" vs "Research Brief" vs "Section"**
- **Research Brief PRD** calls the output a "brief"
- **CLAUDE_CONTEXT** calls it a "research brief"
- **Dashboard PRD** refers to generating a "research brief"
- **Pipeline PRD** refers to "Brief" artifacts

Use consistent terminology: **"Research Brief"** always refers to the full 10-section output; **"Brief Section"** refers to individual sections.

### 4. **Positioning Field Definition**
- **Pipeline Data Model** defines `role.positioning: string` (IC or leader)
- **Comp Intel PRD** uses "positioning" to mean role seniority (staff, senior, principal)
- **Resume Builder PRD** uses "positioning" to mean value proposition (problem solver, people builder, etc.)

**Fix:** Rename to avoid ambiguity: `role.careerPath` (IC vs leader), `role.level` (seniority), `resume.positioning` (value prop)

### 5. **"Outreach" Scope Inconsistency**
- **Dashboard PRD** treats outreach as a nudge trigger (e.g., "send follow-up email")
- **Outreach PRD** treats outreach as the entire message generation pipeline
- Unclear: is "Outreach" a module, a pipeline stage, or a type of action?

**Fix:** Rename module to "Outreach Message Generator" everywhere; clarify Pipeline stage `outreach` means "contact the person"

---

## Module-by-Module Gaps

### Pipeline Tracker PRD
**Missing:**
- Risk / Failure Modes section (data corruption recovery, bulk operation rollback)
- Confidence / Provenance section (staleness of enriched fields, salary data freshness)
- Recovery procedure if localStorage is cleared while user is editing
- Collision handling: what if user edits same role in two tabs?

**Weak:**
- "Resume Uploads & Storage" (Section 6) is vague on file formats, size limits, IndexedDB quota
- "Opaque Recruiter Outreach" (Section 8) needs clearer guidance on when to auto-populate vs. ask user

**Inconsistencies:**
- Data Model lists `artifacts` array but "Relationship to Other Modules" doesn't mention Artifacts MCP integration clearly enough

**Recommendation:**
- Add "Risk / Failure Modes / Guardrails" (see Section 2 above)
- Add "Confidence & Provenance" section (see Section 6 above)
- Expand "Resume Uploads & Storage" with concrete limits (e.g., "max 50MB per file, max 100 files total, IndexedDB quota 50MB")

---

### Dashboard PRD
**Missing:**
- Risk / Failure Modes section (nudge storms, false positives, cascading dismissals)
- Testing Strategy (how do we test nudge triggers?)
- Confidence / Provenance (is "3 offers pending" a fact or stale data?)
- Error handling when calendar API unavailable, when feeds haven't loaded yet

**Weak:**
- Section 5 (Nudge Engine) defines 12 rules but no cooldown logic, no max-nudges-per-load safeguard
- Section 3 (Daily View) describes design but no fallback for slow-loading sections
- Section 12 (Technical Notes) is two sentences; should cover edge cases

**Inconsistencies:**
- Section 5 refers to "nudge rules" but section text calls them "triggers"; terminology inconsistent

**Recommendation:**
- Add "Nudge Engine Safeguards & Cooldowns" subsection
- Add "Error Handling & Edge Cases" section (see Section 2 above)
- Expand "Technical Notes" with recovery procedures

---

### Job Feed PRD
**Strong** — Has most sections well-covered. No major gaps detected.

Minor improvements:
- "Confidence / Provenance Handling" could be more explicit about what "match score 94%" means (which weights matter?)

---

### Research Brief PRD
**Missing:**
- Success Metrics (see Section 1 above)
- Testing Strategy (see Section 1 above)
- Risk / Failure Modes section (hallucinated company, mismatched JD, stale data, long generation times)

**Weak:**
- Section 7 (Export & Artifacts) assumes artifacts auto-save but no failure recovery docs
- Section 8 (Integration Points) mentions Research Brief reads from Pipeline but doesn't specify error handling if role data missing

**Recommendation:**
- Add Sections 11-12 (see Section 1 above)
- Add "Risk / Failure Modes" section covering:
  - Hallucinated company claims (mitigation: cite every fact)
  - JD mismatch (company sections don't match role's company) (mitigation: validate, show warning)
  - Generation timeout >60s (mitigation: show user progress, allow cancel)
  - API errors (mitigation: fallback to cached brief)

---

### Resume Builder PRD
**Missing:**
- Confidence / Provenance section (which bullet bank items were selected? why?)
- Testing Strategy (regression dataset for resume quality)

**Weak:**
- Section 4 (Phase 2: Resume Generation) describes streaming but no failure recovery if generation halts
- Section 6 (Feedback Loops) mentions user can edit, but no version control explained (can user restore prior version?)

**Recommendation:**
- Add "Confidence & Provenance" section documenting:
  - Every selected bullet linked back to `pf_bullet_bank` entry
  - Every skill claim traceable to resume content
  - Generation timestamp + model version logged
- Add "Testing Strategy" with golden test cases (e.g., 5 roles with hand-curated "correct" resumes)

---

### Outreach PRD
**Missing:**
- Risk / Failure Modes section (see Section 5 above)

**Weak:**
- Section 4 (Message Generation Logic) assumes context always available; no fallback if company/connection data incomplete
- Section 5 (Workflow Integration) assumes email always works; no bounce handling

**Recommendation:**
- Add "Risk / Failure Modes / Guardrails" section (see Section 5 above)

---

### Debrief PRD
**Strong** — Has most sections covered. Minor improvements:
- Section 11 (Technical Notes) mentions pattern analysis but no minimum dataset size specified (10 debriefs? 20?)
- "Relationship to Other Modules" could clarify: if user deletes a role, what happens to its debriefs?

---

### Comp Intelligence PRD
**Strong** — Well-documented. No major gaps.

---

### Calendar PRD
**Missing:**
- Testing Strategy (how do we test event matching, nudge triggers?)

**Weak:**
- Section 14 (Error Handling & Edge Cases) is brief; could expand on:
  - What if Google Calendar is unavailable?
  - What if event is deleted from calendar but Pipeline still references it?
  - What if sync is delayed by >24h?

---

### Mock Interview PRD
**Missing:**
- Instrumentation section (event logging for session data, session analytics)

**Weak:**
- Section 5 (Company-Calibrated Question Generation) assumes company profile always available; no fallback
- Section 7 (Tell Me About Yourself) describes TMAY but no evaluation rubric for "good" vs "needs work"

---

### Artifacts MCP PRD
**Missing:**
- Confidence / Provenance section (see Section 7 above)

**Weak:**
- Section 8 (Security & Privacy) doesn't cover artifact sharing / export compliance
- Section 10 (Future Extensions) vague on "publish artifact" feature; no access control policy

---

## Recommended New Docs

### Priority 1 (BLOCKER - required before engineering)
1. **`docs/ai-evaluation-framework.md`** — prompt versioning, model versioning, grounding requirements, hallucination taxonomy, acceptance thresholds, regression testing
2. **`docs/instrumentation-event-taxonomy.md`** — canonical event schema, event catalog, derived metrics, event logging pattern, analytics queries
3. **`docs/architecture-decisions-and-invariants.md`** — Why MCP? Why localStorage? Core invariants (Pipeline = single source of truth, all pf_* keys synced within 1s, etc.)

### Priority 2 (HIGH - required for completeness)
4. **`docs/domain-model-and-glossary.md`** — canonical definitions for "positioning", "tier", "stage", "enrichment", "brief", "positioning", etc.
5. **`docs/integrations-and-compliance.md`** — unified policy for auth scopes, token handling, rate limits, data freshness, fallback behavior for Google Calendar, Gmail, Levels.fyi, Clay, Apify
6. **`docs/confidence-provenance-and-citation-policy.md`** — system-wide rules for confidence levels, citations, staleness warnings, audit trails
7. **`docs/testing-strategy.md`** — unit/integration/E2E approach, golden datasets, regression rubric, failure injection scenarios

### Priority 3 (MEDIUM - quality of life)
8. **`docs/mvp-boundaries-and-sequencing.md`** — what ships v1 vs vNext, exit criteria per module, launch sequencing rules
9. **`docs/adr/ADR-001-mcp-as-integration-layer.md`** — why MCP? Alternatives considered? Trade-offs?
10. **`docs/adr/ADR-002-localStorage-as-source-of-truth.md`** — why not server-backed database? Sync strategy with MCP?

---

## Recommended Section Additions

### Add to Pipeline Tracker PRD
- Section 16: "Confidence & Provenance Handling" (specify staleness warnings, source metadata, enrichment standard)
- Section 17: "Risk / Failure Modes / Guardrails" (data corruption recovery, bulk operation rollback, localStorage persistence, collision handling)

### Add to Dashboard PRD
- Section 14: "Nudge Engine Safeguards & Cooldowns" (max nudges per load, dismissal semantics, suppression rules, logging)
- Section 15: "Error Handling & Edge Cases" (deleted role reference, malformed calendar event, corrupted localStorage, unavailable external service)
- Expand Section 12 "Technical Notes" with recovery procedures

### Add to Research Brief PRD
- Section 11: "Success Metrics" (citation accuracy, section completeness, user satisfaction, staleness detection)
- Section 12: "Testing Strategy" (golden datasets, regression rubric, evaluation, automated freshness check)
- Section 13: "Risk / Failure Modes / Guardrails" (hallucinated claims, JD mismatch, generation timeout, API errors)

### Add to Resume Builder PRD
- Section 13: "Confidence & Provenance" (bullet traceability, skill sourcing, generation metadata, version history)
- Section 14: "Testing Strategy" (golden test cases, regression dataset, quality rubric)

### Add to Outreach PRD
- Section 14: "Risk / Failure Modes / Guardrails" (hallucinated facts, generic fallback, wrong recipient, email bounce, spam filter)

### Add to Mock Interview PRD
- Section 17: "Instrumentation & Event Logging" (session events, question answer-time tracking, performance trends)

### Add to Calendar PRD
- Expand Section 14 "Error Handling & Edge Cases" (unavailable Google Calendar, deleted event references, sync delay recovery)
- Add Section 15: "Testing Strategy"

### Add to Artifacts MCP PRD
- Section 9: "Confidence & Freshness Metadata" (artifact confidence per section, freshness timeline, provenance logging, audit trail)

---

## Blunt Recommendation

**STOP adding features. Fix documentation first.**

The team is at v3.11.0 with 11 production modules. You have strong architecture clarity but critical gaps in **operational discipline**: no AI evaluation framework, no system-wide instrumentation, no risk mitigation guidelines, and uneven quality coverage across modules.

**If you ship v4.0 without these:**

1. Resume Builder's "hallucinated skills" bug won't be caught in testing (no regression dataset, no acceptance rubric)
2. Dashboard's nudge engine will fire 10+ messages on single load (no max-nudges safeguard, no cooldown logic)
3. Research Brief will cite stale company data and user won't know (no freshness metadata, no staleness warning)
4. Outreach will hallucinate facts about recipients and damage relationships (no validation, no "unverified claim" prefix)
5. You can't compute real success metrics (no event taxonomy, Dashboard metrics are guesses)

**Sequencing:**

**Phase A (1 week):** Create 3 blocker docs
- `ai-evaluation-framework.md` (needed before Resume/Research Brief/Debrief testing)
- `instrumentation-event-taxonomy.md` (needed before Dashboard can compute real metrics)
- `architecture-decisions-and-invariants.md` (needed for design doc clarity)

**Phase B (1 week):** Add missing sections to 6 PRDs
- Research Brief: Success Metrics + Testing Strategy + Risks
- Dashboard: Safeguards + Error Handling
- Pipeline: Confidence/Provenance + Risks
- Resume: Confidence/Provenance + Testing
- Outreach: Risk/Failure Modes
- Calendar: Error Handling expanded + Testing

**Phase C (1 week):** Create 4 supporting docs
- Domain glossary
- Integrations & compliance policy
- Confidence & provenance policy
- Testing strategy overview

**Then resume feature work.** The system is architecturally sound; it just needs its guardrails formalized before scaling to more users or modules.

---

## Appendix: Coverage Scorecard

| Module | Purpose | Architecture | Data Model | Success Metrics | Testing | Risk/Failure | Confidence/Provenance | Instrumentation | Integration | Overall |
|--------|---------|--------------|-----------|-----------------|---------|-------------|----------------------|-----------------|------------|---------|
| **Pipeline** | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | 78% |
| **Dashboard** | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | 67% |
| **Job Feed** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 100% |
| **Research Brief** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 67% |
| **Resume Builder** | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | 78% |
| **Outreach** | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | 89% |
| **Mock Interview** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | 89% |
| **Debrief** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 100% |
| **Comp Intel** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 100% |
| **Calendar** | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | 89% |
| **Artifacts MCP** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | 89% |
| **System Level** | ✓ | ✓ | ✓ | — | — | — | — | — | △ | 60% |

**Legend:** ✓ = complete, ✗ = missing, △ = partial

**System-Level Assessment:**
- Architecture: ✓ (PRD Section 5 excellent)
- Data Model: ✓ (CLAUDE_CONTEXT comprehensive)
- Integration: △ (scattered across docs, no unified policy)

**Average Coverage:** 83% (strong, but gaps cluster in testing/evaluation/risk)

---

**End of Review**

Generated via Pathfinder Docs Reviewer Skill (v1.0)
Review methodology: 14-point rubric covering architecture, risks, evaluation, instrumentation, integration, confidence, testing, MVP scope, ADRs, glossary, consistency, accessibility, human override, and success metrics.
