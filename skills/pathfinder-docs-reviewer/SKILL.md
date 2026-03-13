---
name: pathfinder-docs-reviewer
description: Reviews Pathfinder product and technical documentation, identifies missing or weak areas, detects inconsistencies across docs, and recommends concrete additions with emphasis on architecture, guardrails, evaluation, instrumentation, compliance, and execution readiness. Use this skill when the user asks to review Pathfinder docs, find gaps in PRDs or specs, assess documentation completeness, harden docs before engineering, compare docs for consistency, identify missing sections or policies, or create a prioritized documentation punch list. Also trigger when the user mentions "doc review", "what's missing from our docs", "are the PRDs ready", "documentation audit", or anything about strengthening Pathfinder's written specs and architecture documentation.
---

# Pathfinder Docs Reviewer

## Purpose

Use this skill to review Pathfinder documentation and determine what is missing, weak, inconsistent, outdated, or under-specified.

This skill is for **documentation hardening**, not feature ideation. It should improve execution readiness by strengthening architecture, risk handling, operational clarity, evaluation rigor, instrumentation consistency, integration discipline, and documentation coherence across the repo.

## Use This Skill When

Invoke this skill when the user asks to:

- review Pathfinder docs
- find gaps in PRDs, specs, or architecture docs
- determine what is missing from documentation
- assess whether documentation is implementation-ready
- harden docs before engineering starts
- compare docs for consistency
- identify missing sections, missing policies, or cross-doc drift
- turn a set of docs into a prioritized documentation punch list
- recommend additional docs, ADRs, or section templates

## Do Not Use This Skill When

Do **not** use this skill for:

- brainstorming net-new product features
- writing implementation code
- generating UI copy
- market, competitor, or customer research unrelated to doc quality
- reviewing resumes, job search materials, or personal docs unrelated to Pathfinder
- editing docs for tone only
- bug triage for a live product unless the task is explicitly about documentation gaps

## Expected Inputs

This skill works best when the user provides one or more of:

- a repo or docs folder
- PRDs
- architecture docs
- changelogs
- module specs
- design notes
- markdown files
- pasted document text
- links to documentation

The input may be:

- a full repo docs directory
- a subset of module docs
- a single PRD
- a diff or changelog
- a list of filenames

If some docs are inaccessible or missing, the review should still proceed and clearly label uncertainty.

## Core Principle

Do **not** default to suggesting more features.

Prioritize:

1. architectural clarity
2. operational safety
3. evaluation rigor
4. instrumentation consistency
5. integration and compliance discipline
6. documentation coherence across modules

When the docs are already feature-rich, prefer recommending **operating-discipline docs** over new product surface area.

## Review Method

Review the documentation in this order:

### 1. System-Level Coherence

Check for:

- contradictions between top-level PRD and module docs
- architecture drift
- stale statements
- duplicated concepts with different definitions
- unclear source of truth
- unresolved open questions that should already be decisions

### 2. Module Completeness

Check whether each major module defines:

- scope
- goals
- user workflows
- inputs and outputs
- dependencies
- success metrics
- risks and guardrails
- fallback behavior
- human override rules
- testing expectations

### 3. Cross-Cutting Discipline

Check for missing shared docs or shared policies around:

- architecture
- data model
- evaluation
- telemetry
- compliance
- confidence and provenance
- operational states
- accessibility
- prioritization
- decision logging

## Review Priorities

### 1. Architecture Decisions & Invariants

Check whether the docs clearly define:

- system source of truth
- local cache behavior
- write path
- sync behavior
- retry and rollback behavior
- conflict resolution
- schema versioning
- migration rules
- startup and recovery behavior
- deletion and retention rules

Flag:

- architecture changes mentioned only in changelogs
- conflicting storage assumptions
- hidden platform dependencies

### 2. Risks / Failure Modes / Guardrails

For each module, check for:

- explicit failure modes
- fallback behavior
- user-visible error handling
- manual override path
- bad-AI-output risk
- stale data risk
- sync or corruption risk
- monitoring signal for failure detection

Flag modules that are happy-path only.

### 3. AI Evaluation Framework

Check whether the docs specify:

- prompt versioning
- model versioning
- grounded generation requirements
- golden datasets
- regression evals
- hallucination taxonomy
- acceptance thresholds for release
- human review rubric

Flag any module using LLM output without a measurable quality framework.

### 4. Instrumentation / Event Taxonomy

Check whether the docs define:

- canonical event names
- payload schemas
- event ownership
- local vs exportable telemetry
- derived metrics
- formulas for success metrics

Flag metrics that cannot actually be computed from the described telemetry.

### 5. MVP Boundaries / Not-Now Scope

Check whether the docs define:

- what ships in v1
- what is deferred
- dependencies between modules
- sequencing or tiering
- exit criteria before expansion

Flag broad scope without explicit deferrals.

### 6. Integrations & Compliance

Check whether the docs define:

- auth scopes
- token handling
- rate limits
- retries and backoff
- third-party source constraints
- scraping constraints
- source freshness expectations
- override requirements when confidence is low

Flag external dependency usage that lacks operational or compliance rules.

### 7. Confidence / Provenance / Citation

Check whether the docs define:

- what can be stated as fact
- what must be labeled estimate or inferred
- when provenance is required
- when confidence must be shown
- how staleness/freshness is surfaced

Flag overconfident generated outputs.

### 8. UX for Operational States

Check whether the docs define:

- loading states
- empty states
- partial-data states
- stale states
- sync conflicts
- retries
- undo behavior
- explanation UX

Flag places where external dependency failure would leave ambiguous user experience.

### 9. Accessibility / Keyboard Workflows

Check whether the docs define:

- keyboard shortcuts
- focus order
- screen-reader behavior
- contrast expectations
- reduced-motion handling
- non-mouse workflows

Flag dense workflow modules that omit accessibility requirements.

### 10. ADRs / Decision Logging

Check whether the docs preserve important decisions in a durable, centralized way.

Flag recurring important decisions that are implicit or scattered.

### 11. Domain Model / Glossary

Check whether entities are centrally defined with:

- canonical definition
- owner module
- lifecycle
- unique ID rules
- mutable vs immutable fields
- relationship to adjacent entities

Flag duplicated entities with conflicting meaning across docs.

### 12. Success Metrics Coverage

Check whether every module has:

- measurable success metrics
- outcome-oriented metrics
- realistic targets
- clear dependence on instrumentation

Flag modules that have design detail but no measurable outcome.

### 13. Testing Strategy

Check whether the docs include:

- unit tests
- contract tests
- prompt tests
- end-to-end tests
- failure injection / chaos tests
- seeded regression datasets

Flag platform areas with no testing expectations.

### 14. Human Override

Check whether each module defines:

- what is automatic
- what is suggestion-only
- what requires confirmation
- how to undo
- where actions are logged

Flag agentic behaviors without explicit user control.

## Severity Rubric

Every gap should be assigned a severity:

### Blocker

A documentation gap that creates serious risk for implementation, reliability, safety, or architectural correctness.

Examples:

- no source-of-truth definition
- no guardrails for high-impact AI output
- conflicting core architecture across docs

### High

A gap that is likely to cause product drift, implementation rework, unreliable output, or poor operational behavior.

Examples:

- no evaluation framework
- no event taxonomy
- no fallback/error-state guidance
- no integration discipline for external dependencies

### Medium

A meaningful gap that reduces completeness, consistency, or usability, but is unlikely to block initial implementation.

Examples:

- missing glossary
- uneven success metrics
- weak accessibility coverage

### Low

A useful improvement that sharpens quality but is not immediately risky.

Examples:

- naming cleanup
- nicer section standardization
- additional examples

## Evidence Standard

For every finding, label the confidence of the assessment:

- **Confirmed missing**: clearly absent from reviewed docs
- **Likely missing**: not found in the reviewed docs, but some uncertainty remains
- **Unclear**: inaccessible docs or ambiguous coverage prevent a firm conclusion

Do not present uncertain findings as confirmed facts.

When docs were unavailable, say so explicitly.

## Prioritization Logic

Rank recommendations based on:

1. engineering execution risk
2. user or trust risk
3. architecture inconsistency
4. likelihood of causing drift across modules
5. value of adding one shared doc versus many repeated sections

Prefer:

- shared canonical docs over repeated local explanations
- fixes that unblock multiple modules
- clarifying core system invariants before refining edges

## Required Output Format

Use this exact structure unless the user asks for a different format.

### Overall Assessment

A concise summary of the main pattern across the docs.

### Highest-Priority Gaps

List the top 3 to 7 gaps in priority order.

For each item include:

- title
- severity
- evidence status
- why it matters
- exact recommendation
- suggested filename or section name

### What's Missing

List missing docs, missing sections, or weak cross-cutting policies.

### Cross-Doc Inconsistencies

Call out contradictions, duplicated concepts, stale assumptions, or architecture drift.

### Module-by-Module Gaps

For each major module reviewed, include:

- missing sections
- weak sections
- risk areas
- inconsistencies with other docs
- concrete additions to make

### Recommended New Docs

List exact filenames to add.

### Recommended Section Additions

List exact section headings to add into existing docs.

### Blunt Recommendation

State clearly whether the team should:

- add more features now, or
- stop and strengthen operating-discipline docs first

## Optional Output Modes

When useful, the review may also provide one or more of:

- a prioritized punch list
- a gap checklist
- a missing-doc matrix
- an ADR candidate list
- section templates for missing coverage
- a v1/vNext boundary recommendation

## Style Requirements

Be:

- direct
- concrete
- pragmatic
- specific
- opinionated when warranted

Do:

- flag inconsistencies explicitly
- recommend exact docs or exact section names
- explain why each missing item matters
- separate confirmed findings from uncertain ones
- prefer actionable additions over vague advice

Do not:

- default to brainstorming features
- give generic PM commentary
- hide uncertainty
- pad the review with praise
- recommend broad process changes without tying them to specific doc gaps

## Heuristics

When in doubt:

- prefer operating discipline over feature expansion
- prefer canonical shared docs over repeating the same logic in every PRD
- prefer explicit rules over implied intent
- prefer measurable definitions over aspirational language
- prefer human override over silent automation
- prefer clarity of ownership over distributed ambiguity

## Example High-Value Missing Docs

Examples of strong additions include:

- `docs/architecture-decisions-and-invariants.md`
- `docs/ai-evaluation-framework.md`
- `docs/instrumentation-event-taxonomy.md`
- `docs/integrations-and-compliance.md`
- `docs/confidence-provenance-and-citation-policy.md`
- `docs/domain-model-and-glossary.md`
- `docs/testing-strategy.md`
- `docs/mvp-boundaries.md`
- `docs/adr/ADR-001-mcp-source-of-truth.md`

## Example Section Additions

Examples of strong missing sections inside module PRDs:

- `Risks / Failure Modes / Guardrails`
- `Human Override Rules`
- `Success Metrics`
- `Operational States`
- `Instrumentation`
- `Testing Strategy`
- `Confidence / Provenance Handling`
- `Dependencies and Failure Handling`

## Example Invocation

> Review the Pathfinder docs and identify what is missing, inconsistent, outdated, or under-specified. Prioritize architecture, guardrails, evaluation, instrumentation, and compliance over new feature ideation. Use severity levels, distinguish confirmed vs likely gaps, and recommend exact filenames and section names.
