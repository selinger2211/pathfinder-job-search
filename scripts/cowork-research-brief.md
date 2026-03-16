# Cowork Research Brief Generation — Deep Research Protocol

**Purpose:** When generating research briefs in Cowork, Claude MUST perform deep web research BEFORE writing any section content. This replaces the Tavily API approach with free Cowork WebSearch/WebFetch tools.

---

## Step 1: Deep Research Phase (BEFORE any section generation)

For each role, run these web searches and store results:

### Required Searches (7 queries minimum)

1. **Company overview + financials:**
   `{companyName} company overview revenue employees {year}`

2. **Recent news:**
   `{companyName} news announcements {year}`

3. **Product strategy + AI:**
   `{companyName} product strategy AI launches {year}`

4. **Competitors:**
   `{companyName} competitors market position`

5. **Leadership:**
   `{companyName} CEO leadership team executive`

6. **Role-specific context:**
   `{companyName} {roleTitle} team hiring`

7. **Glassdoor / culture:**
   `{companyName} glassdoor interview process culture`

### How to Execute

```
For each query:
1. Use WebSearch to find results
2. Use WebFetch on the top 2-3 most relevant URLs
3. Extract key facts: numbers, names, dates, quotes
4. Tag each fact with its source URL
```

### Store Results As

Create a `research-context` object with these fields:

```json
{
  "companyName": "RingCentral",
  "researchedAt": "2026-03-16T...",
  "financials": {
    "revenue": "$2.2B ARR (2025)",
    "headcount": "~7,000",
    "ticker": "RNG",
    "marketCap": "$X.XB",
    "source": "https://..."
  },
  "recentNews": [
    { "headline": "...", "date": "...", "relevance": "...", "source": "..." }
  ],
  "competitors": [
    { "name": "...", "differentiation": "...", "source": "..." }
  ],
  "leadership": [
    { "name": "...", "title": "...", "relevance": "...", "source": "..." }
  ],
  "productStrategy": "...",
  "interviewProcess": "...",
  "culture": "..."
}
```

---

## Step 2: Generate Brief JSON with Research Integrated

When writing each section's `content` field in the cowork-brief JSON:

1. **Cite research as EXT:** Every fact from web research gets `<span class="cite">fact <span class="cite-label" data-label="EXT">EXT</span></span>`
2. **Include source URLs:** Where possible, embed source URLs in the citation for traceability
3. **Mix evidence types:** Each section should have JD + EXT + ILI/CTX citations — NOT just one type
4. **Target 5+ EXT per section** for company-facing sections (2, 3, 5, 7, 9)
5. **Target 2+ EXT per section** for candidate-facing sections (4, 8, 10, 11, 12, 13)

### Section-Specific Research Integration

| Section | Key Research Inputs |
|---------|-------------------|
| 1. Pursuit Economics | financials, competitors, culture |
| 2. Why This Role Exists | recentNews, productStrategy, leadership |
| 3. Company & Market Context | ALL research fields — this is the primary research section |
| 4. Why You Are Plausible | competitors (to position against), productStrategy |
| 5. Screen-Out Risks | interviewProcess, culture, competitors (hiring bar) |
| 6. What They Actually Need | productStrategy, recentNews |
| 7. Your Fit | competitors, productStrategy (to frame fit against market) |
| 8. Gaps & Mitigation | interviewProcess (known focus areas) |
| 9. Network Strategy | leadership (identify key people) |
| 10. Interview Prep | interviewProcess, culture, recentNews |
| 11. Proof Points | competitors (what differentiates) |
| 12. Deal-Breaker Test | financials, culture, interviewProcess |
| 13. Next Steps | leadership (WHO to contact), recentNews |

---

## Step 3: Formatting Requirements

ALL sections MUST use proper HTML structure:

- `<h3>` for subsection headings — NEVER bold text as heading
- `<table>` for structured data — NEVER inline numbered lists
- `<ol><li>` for numbered items — NEVER `(1)`, `(2)`, `(3)` inline
- `<ul><li>` for bullet lists — NEVER dashes in `<p>` tags

Sections 10, 12, 13 specifically require TABLE format (not paragraph format).

---

## Step 4: Save Brief

Save to `modules/research-brief/cowork-briefs/{roleId}.json` in the standard format:

```json
{
  "role": { "title": "...", "company": "..." },
  "company": { "name": "...", ... },
  "sections": {
    "pursuitEconomics": { "content": "<h3>...", "citations": [...], "confidence": "High" },
    ...
  },
  "generatedAt": "ISO timestamp",
  "newsResults": { "newsItems": [...], "searchTimestamp": "..." },
  "researchSources": ["url1", "url2", ...]
}
```

Include `newsResults` so the UI news banner can display research source count.

---

## Citation Targets (Quality Gate)

A brief that passes quality check has:

- **30+ EXT citations** across all 13 sections
- **Every section has at least 1 EXT citation**
- **Section 3 (Company & Market) has 8+ EXT citations**
- **Zero sections with ONLY JD or ONLY CTX citations**
- **All tables use `<table>` tags, not inline formatting**
