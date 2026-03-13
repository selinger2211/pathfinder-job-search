# Pathfinder — Bugs / Improvements Backlog

**Created:** 2026-03-13
**Status:** Active

---

## 1. Action Queue: Smarter Outreach Suggestions

**Module:** Dashboard (nudge engine) + Outreach
**Priority:** High
**Type:** Enhancement

When Pathfinder proposes a reach-out because a role is stuck, it should use the actual context of the last communication — not generate a generic nudge.

**Requirements:**

- Read the most recent comms log entry for the role/connection
- If last communication was an email that has gone dark → propose a follow-up based on that thread
- Leverage the Outreach module to draft a follow-up email automatically
- Optionally suggest alternate paths (e.g., reaching out through mutual connections)
- When mutual connections exist, surface them explicitly: "You and Ivan Markan are both connected to him."
- Pull mutual connections from `pf_linkedin_network` + `pf_connections`

**Goal:** Make the action queue feel intelligent and actionable, not generic.

---

## 2. Job Feed: Rank by Match Score

**Module:** Job Feed + Pipeline
**Priority:** High
**Type:** Bug / UX

The Job Feed should default to sorting in descending order by match score (highest score first).

**Requirements:**

- Default sort = score descending
- Apply the same ranking logic to Pipeline kanban and list views
- Both views should feel consistent and prioritize the best opportunities first

---

## 3. Job Feed: Better Company Visibility

**Module:** Job Feed + Pipeline + Research
**Priority:** Medium
**Type:** Enhancement

Users should be able to quickly understand who a company is without leaving the current view.

**Requirements:**

- Click-through on company names (link to company detail or Research Brief)
- Hover tooltip showing brief company description
- Brief company description visible directly on the feed card
- Apply the same company description treatment to:
  - Pipeline company cards
  - Research views/cards

---

## 4. Job Feed: Full Job Description Access

**Module:** Job Feed
**Priority:** High
**Type:** Enhancement

Users should be able to see the full job description from the Job Feed without navigating away.

**Requirements:**

- Add a sidebar/panel pattern (similar to Pipeline's detail panel) for drilling into:
  - Company details
  - Full JD text
  - Related context (connections, comms, artifacts)
- The JD is referenced constantly — it must be easily accessible

---

## 5. Compensation Display: Clearer Estimate Labeling

**Module:** Job Feed + Pipeline + Comp Intel
**Priority:** Medium
**Type:** UX Fix

The salary/comp section should be explicit about what is posted vs. estimated.

**Requirements:**

- Top line: "Posted Base" (from JD extraction)
- Bottom line: "Estimated Total Comp" (calculated)
- Add tooltip or info icon explaining the estimation logic
- Users should understand how the estimate was derived

---

## 6. Extend Company Summary Across Surfaces

**Module:** Job Feed + Pipeline + Research
**Priority:** Medium
**Type:** Enhancement

Brief company descriptions should appear consistently across all surfaces, not just one view.

**Requirements:**

- Add company description to:
  - Job Feed cards
  - Pipeline company cards
  - Research views/cards
- Source: `pf_companies.missionStatement` or enriched company data
- Keep it brief (1-2 sentences max on cards, full description in detail panels)

---

## Notes

Items 3 and 6 overlap — company visibility is the common theme. Could be addressed together.

Items 2 and 4 together would make Job Feed feel like a proper "triage" view: sorted by relevance, with full JD access.
