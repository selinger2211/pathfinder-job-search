# Comp Intelligence Agent — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/comp-intel/`
**Version:** v3.15
**Last Updated:** 2026-03-13
**Status:** Active — v3.15.0 features live

---

## 1. Purpose

The Comp Intelligence Agent provides market compensation data to inform positioning decisions, negotiation strategy, and role prioritization. It enriches role records with benchmarked salary data so you can make informed decisions about which roles to pursue and how to negotiate.

### Design Principles

1. **Data-driven positioning.** Compensation often determines whether an IC Principal or Director track is actually viable at a given company. The agent surfaces this data upfront so the positioning decision on each role has real market context.
2. **Negotiation confidence.** When an offer arrives, you should know your market position instantly — percentile, comparable data, counter-offer anchors. No guessing.
3. **Comparative analysis.** The value isn't just absolute ranges; it's comparisons — Staff at Big Tech vs. Director at Series C, or IC Principal vs. Director at the same company.
4. **Total comp, not base salary.** Base salary matters, but total comp (base + bonus + equity) is the real decision lever. The agent always shows full comp.
5. **Privacy and control.** Comp data is sensitive. The agent caches locally, never sends data to external APIs without permission, and clearly labels data source confidence.

---

## 2. Architecture

### High-Level Data Flow

```
┌──────────────────────────────────────────┐
│    Comp Intelligence Agent               │
│    (modules/comp-intel/)                 │
└──────────────────────────────────────────┘
           │
      ┌────┴────────────────────────┐
      ▼                             ▼
BENCHMARK GENERATION       NEGOTIATION SUPPORT
  (background)              (offer stage)
  │                         │
  ├─ Role entry             ├─ Offer received
  ├─ Comp data cache hit    ├─ Market percentile
  ├─ Comp data miss         ├─ Counter-offer
  ├─ Positioning decision   ├─ Equity context
  │                         ├─ Total comp vs.
  └─ Benchmark card         │   other offers
     (saved to Artifacts)   └─ NegotiationScore
                               card update
```

### Integration Points

**Reads from:**
- `pf_roles` — role title, level, company, positioning field, salary history
- `pf_companies` — company name, funding stage (for equity valuation context)
- `pf_preferences` — user's comp range preferences, target locations
- Artifacts MCP — cached comp benchmark cards

**Writes to:**
- `pf_comp_cache` — cached benchmarks by company+level+location
- Artifacts MCP — benchmark cards, negotiation scorecards
- Role record `negotiationScorecard` (via Pipeline update) — compensation dimension scores

**External APIs (with user permission):**
- Levels.fyi (public, no auth required)
- Glassdoor (public scraping)
- Job posting extraction (from Pipeline feedMetadata)

### Data Sources & Hierarchy

Comp data comes from five sources, in descending order of trust:

| Source | Coverage | Granularity | Refresh | Confidence | Access |
|--------|----------|-------------|---------|------------|--------|
| **Your own offer data** | 0 until offers received | Exact numbers, this company/level | Real-time | 100% | Role `salary` field |
| **Recruiter-disclosed ranges** | 30-40% of roles (screen stage) | Company + level + range | During screen | 95% | Role `salary` field |
| **Job posting salary ranges** | 40-50% (CA/NY/CO/WA law) | Posted range, sometimes total comp | When posted | 85% | `feedMetadata.salaryRange` |
| **Levels.fyi** | PM-specific, 50+ companies | Base, bonus, equity, total by level+location | Crowd-sourced (monthly updates) | 80-90% | Public API or scraping |
| **Glassdoor** | Broader coverage, all titles | Salary range, often outdated | Crowd-sourced (staleness varies) | 60-70% | Company profile, scraping |

### Caching Strategy

The agent maintains a local cache in `pf_comp_cache` to avoid re-fetching:

```typescript
interface CompData {
  // Key: "{company}_{level}_{location}"
  [key: string]: {
    company: string;
    level: string;
    location: string;

    // Each source contributes to a composite range
    sources: {
      levelsData?: {
        base: { min: number; max: number; p50: number };
        bonus: { min: number; max: number; p50: number };
        equity: { min: number; max: number; p50: number };
        total: { min: number; max: number; p50: number };
        sampleSize: number;
        lastUpdated: string;
      };
      glassdoorRange?: {
        min: number;
        max: number;
        title: string;
        numReports: number;
      };
      postedRanges?: {
        min: number;
        max: number;
        company: string;
        datePosted: string;
      }[];
      recruiterRanges?: {
        min: number;
        max: number;
        contactName: string;
        dateShared: string;
      }[];
    };

    // Composite view
    aggregated: {
      baseRange: { min: number; max: number };
      bonusPercentRange: { min: number; max: number };
      equityRange: { min: number; max: number };
      totalRange: { min: number; max: number };
      confidence: 'high' | 'medium' | 'low';
      sourceSummary: string; // e.g., "Levels.fyi (142 reports), Glassdoor (87 reports)"
    };

    lastCacheRefresh: string; // ISO timestamp
  };
}
```

**Cache refresh rules:**
- Levels.fyi data: refresh if > 30 days old
- Glassdoor: refresh if > 60 days old
- Posted ranges: refresh if new roles are discovered
- Recruiter/offer data: update immediately when new entry added

---

## 3. Core Capability: Comp Benchmarking

### 3.1 Benchmark Card Generation

When you're researching a role or need to make a positioning decision, the agent generates a benchmark card:

#### Input
- Company name
- Job title or level (e.g., "Senior PM", "Staff PM", "Director")
- Location (optional; defaults to HQ location or primary market)
- Positioning preference (IC vs. management, if known)

#### Output: Benchmark Card (Artifact)

```markdown
# Compensation Benchmark: Stripe — Staff PM (IC)

**Company:** Stripe
**Role:** Staff Product Manager (Individual Contributor)
**Location:** San Francisco Bay Area
**Requested:** 2026-03-10 14:30 UTC

---

## Market Range (Levels.fyi, 142 recent reports)

**Base Salary:**
- Range: $210K – $260K
- P50 (Median): $235K
- Distribution: 25% earn <$225K, 50% earn <$235K, 75% earn <$250K

**Bonus (Annual % of Base):**
- Range: 15–25% ($31.5K – $65K in absolute terms)
- Median: 20% ($47K)

**Equity (Annual Value, 4-Year Vest):**
- Range: $150K – $300K per year
- Median: $200K per year
- Typical vest: 1-year cliff, then monthly over remaining 3 years

**Total Compensation (Base + Bonus + Equity):**
- Range: $398K – $625K
- Median: $482K
- Note: Includes base + on-target bonus + average annual equity value

---

## Posted Range (if disclosed)

This role on Stripe's career page shows:
- Base: $220K – $280K (2026-03-08)

The market P50 is below the posted range midpoint, suggesting Stripe is paying above median.

---

## Your Preferences vs. Market

**Your comp range (from settings):** $250K – $450K total comp

| Dimension | Market (P50) | Your Target | Gap |
|-----------|--------------|-------------|-----|
| Base | $235K | $250K+ | -$15K (below target) |
| Bonus | $47K | 15%+ | On target |
| Equity | $200K/yr | $150K+/yr | On target |
| **Total** | **$482K** | **$400K–$450K** | **+$32K (exceeds target)** |

---

## Positioning Analysis

**Question:** Should you pursue this as IC Staff or Director?

**IC Staff (what this benchmark shows):**
- Total comp median: $482K
- Market upside: up to $625K
- Role authority: deep technical influence, craft leadership
- Career signal: "expert IC at a high bar"

**Director at Stripe (comparison):**
- Estimated total comp (median): $450K – $550K
- Based on typical 10–15% uplift from IC Staff
- Role authority: team leadership, org scope
- Career signal: "first-time manager at high bar"

**Recommendation:** IC Staff pays similarly to Director (possibly slightly better given Stripe's IC comp philosophy). If you're targeting both IC and management career paths, the IC Staff option here has no comp penalty and may have better optionality downstream (pure IC advancement or transition to management later).

---

## Context & Caveats

- **Data freshness:** Levels.fyi data is 28 days old. Crowd-sourced; reflects last 12 months of updates.
- **Your location:** Benchmark is SF Bay. If relocating, adjust base down 15–25% for remote or secondary markets.
- **Vest schedules:** Stripe's typical vest is 1-year cliff + 3-year monthly. Equity value assumes you stay 4 years.
- **Bonus variation:** Bonus ranges significantly by performance rating. "Expected" bonus is 20%; strong performers see 25%+, low performers 15%–.
- **Equity volatility:** Stripe is private; valuation could shift. Equity value is theoretical unless/until liquidity event.

---

## Negotiation Anchors (if you reach offer stage)

*Generated when offer is received; see Section 3.3 for details.*

---

**Generated by Pathfinder Comp Intelligence Agent | Data sources: Levels.fyi, Stripe career page | No external data shared**
```

### 3.2 Benchmark Card Triggers

Benchmark cards are generated in these scenarios:

1. **On role entry** (optional auto-generation)
   - When you add a role to Pipeline, the agent checks if comp data exists
   - If data is available, generates initial benchmark card and saves to Artifacts
   - Surfaces positioning guidance if IC/management decision is relevant

2. **On positioning decision change**
   - When you toggle role's `positioning` field (IC ↔ management), agent regenerates benchmark card with comparative analysis
   - Shows side-by-side comp for IC vs. Director at the same company

3. **On research brief request**
   - When you open a role's Research Brief, comp benchmarking is Section 2
   - Generates fresh benchmark inline (not a separate artifact)

4. **On manual request**
   - "Benchmark this role" button in Pipeline role detail panel
   - User can request fresh benchmark at any time

### 3.3 Positioning-Aware Comp Analysis

The agent compares different career tracks at the same company or across companies:

#### IC vs. Management at Same Company

**Scenario:** You're pursuing both Staff PM (IC) and Director roles at Meta.

**Question:** "Does Director pay more than Staff?"

**Answer (automated comparison):**

```
Meta — Staff PM (IC) vs. Director

Staff PM (IC):
  Base: $260K – $310K (P50: $285K)
  Bonus: 15–20%
  Equity: $300K – $450K/yr
  Total: $580K – $815K (P50: ~$650K)

Director (Org)
  Base: $290K – $340K (P50: $315K)
  Bonus: 15–20%
  Equity: $350K – $500K/yr
  Total: $680K – $900K (P50: ~$750K)

Comp Verdict: Director pays ~$100K more (P50) due to higher base + equity.

HOWEVER: IC Staff at Meta is rare and has higher ceiling. Equity upside for
top performers can exceed Director. Recommend IC Staff if maximizing
long-term wealth; Director if maximizing near-term cash + stability.
```

#### IC Principal vs. Director at Different Companies

**Scenario:** You have competing interests in Staff PM (IC) at Stripe vs. Director at Series C startup (Notion-stage).

**Question:** "Which pays more?"

**Answer (automated comparison):**

```
IC Principal (Stripe) vs. Director (Series C Startup)

Stripe — Staff PM (IC):
  Total Comp (P50): $482K
  Equity: Mature, liquid events likely within 2–3 years (ongoing private sales or IPO)
  Risk: Low-moderate

Series C Startup — Director:
  Total Comp (estimated): $280K base + $70K bonus + $300K equity (4yr) = $650K nominal
  BUT equity risk: Series C → liquidity event 5–8 years out (or failure)
  Expected value: $650K × 60% success rate = $390K

Comp Verdict: Stripe Staff pays higher and has lower equity risk.
Series C Director has higher ceiling but significant dilution risk.
Recommend Stripe for risk-averse or liquidity-focused strategy.
```

---

## 4. Core Capability: Negotiation Support

### 4.1 Negotiation Scorecard

When a role reaches the `offer` stage, the agent analyzes the offer against market and generates a **Negotiation Scorecard** — a structured 25-point system across five dimensions:

```typescript
interface NegotiationScorecard {
  roleId: string;
  offerDate: string;
  offerDetails: {
    base: number;
    bonus?: { percentage: number; amount?: number };
    equity?: {
      amount: number;
      vestSchedule: string; // e.g., "1yr cliff, 4yr total"
      strikePrice?: number;
    };
    total: number;
  };

  scores: {
    compensation: {
      points: number; // 0–25
      basePercentile: number; // e.g., 65 for P65
      bonusPercentile: number;
      equityPercentile: number;
      totalPercentile: number;
      assessment: string; // "Excellent (P75+)", "Above Market (P50–75)", "Market (P35–50)", "Below Market (<P35)"
      suggestion?: string; // Counter-offer anchor with data
    };

    scope: {
      points: number; // 0–25
      teamSize?: number;
      reportingLevel?: string;
      assessment: string;
      notes?: string;
    };

    growth: {
      points: number; // 0–25
      upskillOpp?: string;
      careerPath?: string;
      assessment: string;
      notes?: string;
    };

    culture: {
      points: number; // 0–25
      assessment: string;
      notes?: string;
    };

    riskFactors: {
      points: number; // 0–25 (higher = lower risk)
      companyStability?: string;
      equityRisk?: string;
      restructureRisk?: string;
      assessment: string;
      notes?: string;
    };
  };

  totalScore: number; // 0–125 (5 dimensions × 25 points max)
  recommendation: string; // Summary verdict, "Strongly Recommend Accept / Counter / Decline"
  generatedAt: string;
}
```

### 4.2 Compensation Dimension Scoring (0–25)

**Points allocation:**

```
P75+ (Excellent):      25 points  (≥ 75th percentile)
P60–75 (Above Market): 20 points
P50–60 (Market):       15 points
P40–50 (Slightly Low): 10 points
<P40 (Below Market):    5 points
```

**Calc method:**

For each component (base, bonus, equity), calculate percentile against market range:

```
Percentile = (offerValue - minMarket) / (maxMarket - minMarket) × 100
```

Then weight:
- **Base:** 40% of total comp score
- **Bonus:** 30%
- **Equity:** 30%

### 4.3 Negotiation Suggestions

The agent generates actionable counter-offer language:

```markdown
## Negotiation Suggestions

**Current Offer:**
- Base: $260K
- Bonus: 15%
- Equity: 0.4% 4-year vest
- Total: $410K

**Analysis:**
Base salary is P45 (below market P50 of $285K). You have room to counter.

**Suggested Counter:**

"Thank you for the offer. I'm excited about the role.
I'd like to propose adjusting the base to $280K, which aligns with
market rate for this level at comparable companies.
This would bring total comp to ~$445K, in line with my expectations
and market benchmarks I've researched."

**Why this works:**
- Specific number ($280K) backed by market data ("P50 for this level")
- Professional, not aggressive
- Leaves other dimensions (bonus, equity) intact
- Market percentile: P60 (above median, reasonable ask)

**Alternative if they push back:**
"I understand budget constraints. Could we discuss equity acceleration
(vest cliff from 1yr to 6mo)? That adds value without base impact."

**Walk-away level:** <$270K base. Below that, total comp drops below P40
and forfeits your negotiating power.
```

### 4.4 Total Comp Comparison Across Active Offers

If you have multiple offers, the agent shows a comparison:

```markdown
## Offer Comparison: Active Offers

| Dimension | **Stripe** | **Meta** | **Series A Startup** |
|-----------|-----------|----------|----------------------|
| Base | $260K | $290K | $200K |
| Bonus (%) | 20% ($52K) | 15% ($43.5K) | 0% |
| Equity (/yr) | $200K | $350K | $300K |
| **Total** | **$512K** | **$683.5K** | **$500K** |
| Percentile | P60 | P75+ | P35 |
| Risk | Low | Low | High |
| Verdict | **Solid, Safe** | **Excellent, Pay Peak** | **Risky, Lowest Pay** |

**Recommendation:** Meta's offer is exceptional on comp (P75+).
If you want the safest path with market-beating pay, Meta wins.
If you're OK with risk for upside, Series A has equity potential but unproven.
Stripe is a reliable middle option.
```

---

## 5. Data Model

### 5.1 Comp Data Stored in Artifacts

Each benchmark card and negotiation scorecard is saved as an Artifact:

```
Artifact Type: comp_benchmark
Tags: {company}, {level}, {location}, {positioning}
Filename: {company}_{level}_{location}_benchmark_{date}.md
Example: stripe_staff-pm_san-francisco_benchmark_2026-03-10.md

Artifact Type: negotiation_scorecard
Tags: {company}, {roleId}, offer_received
Filename: {company}_{roleId}_negotiation_{date}.md
Example: stripe_role-uuid_negotiation_2026-03-10.md
```

### 5.2 Role Record Enhancements

When comp data is attached to a role, the role record is enriched:

```typescript
// Added/updated fields on Role object (in pf_roles)

interface Role {
  // ... existing fields ...

  // Compensation fields
  salary?: {
    min?: number;          // In USD
    max?: number;
    currency: string;      // "USD", "EUR", etc.
    equity?: string;       // e.g., "0.5% 4-year vest"
    bonus?: string;        // e.g., "15-20%" or "$X-$Y"
  };

  // When offer is received
  offerDetails?: {
    base: number;
    bonus?: number;        // Annual amount in USD
    bonusPercentage?: number;
    equity?: {
      amount: number;      // Shares or % of company
      strikePrice?: number;
      vestSchedule: string; // "1yr cliff, 4yr total"
      value?: number;      // Estimated annual value in USD
    };
    benefits?: string[];   // e.g., ["401k", "health", "pto"]
    startDate?: string;    // ISO date
  };

  // Comp intelligence data
  compData?: {
    benchmarkGenerated: string; // ISO timestamp
    positioningRecommendation?: string;
    marketPercentile?: number;  // e.g., 65 for P65
  };

  // Negotiation tracking
  negotiationScorecard?: NegotiationScorecard;
  negotiationAttempts?: {
    date: string;
    counterProposal: string;
    response?: string;
    status: 'pending' | 'accepted' | 'rejected';
  }[];

  // Research Brief integration
  researchBrief?: {
    section2_compBenchmark?: string; // Content from comp module
  };
}
```

### 5.3 localStorage Keys

```typescript
interface LocalStorageCompData {
  pf_comp_cache: CompData;           // Cached benchmarks
  pf_comp_prefs: {
    targetCompensation: {
      min: number;
      max: number;
      currency: string;
    };
    prioritizeEquity: boolean;
    prioritizeLocation: string[];     // e.g., ["SF", "NYC", "Remote"]
    equityMultiplier: number;        // Weight equity premium (1.0 = normal)
  };
  pf_offers: {                       // Active offers tracking
    [roleId: string]: {
      company: string;
      offerDate: string;
      offerDetails: OfferDetails;
    };
  };
}
```

---

## 6. UI Specification

### 6.1 Comp Intelligence Panel

Accessible from the Pipeline role detail or as a standalone module.

**Layout:**

```
┌─────────────────────────────────────────┐
│  Comp Intelligence: [Company] [Role]    │ ← Header w/ company logo
├─────────────────────────────────────────┤
│                                         │
│  [ Benchmark ] [ Positioning ] [ Offer]│ ← Tab selector
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Market Range (Levels.fyi, 142 reports)│
│  ───────────────────────────────────── │
│                                         │
│  Base Salary:        $210K – $260K     │
│    Median (P50):     $235K             │
│                                         │
│  Bonus:              15–25%            │
│    Median:           20% ($47K)        │
│                                         │
│  Equity (annual):    $150K – $300K     │
│    Median:           $200K             │
│                                         │
│  Total Comp:         $398K – $625K     │
│    Median:           $482K             │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Your Target:        $250K – $450K     │
│  Posted Range:       $220K – $280K     │
│                                         │
│  [ View Full Benchmark Card ]          │
│  [ Compare Positioning (IC vs. Mgmt) ] │
│                                         │
└─────────────────────────────────────────┘
```

### 6.2 Offer Evaluation Tab

When role is in `offer` stage:

```
┌─────────────────────────────────────────┐
│  [ Offer ]                              │
├─────────────────────────────────────────┤
│                                         │
│  RECEIVED OFFER:                        │
│  ─────────────────────────────────────  │
│  Base:         $280K                    │
│  Bonus:        15% ($42K)               │
│  Equity:       0.3% vesting 4yr         │
│  Total:        $482K                    │
│                                         │
│  MARKET POSITION:                       │
│  ─────────────────────────────────────  │
│  Base Percentile:         P62 🟢         │
│  Bonus Percentile:        P50 ⚪         │
│  Equity Percentile:       P55 ⚪         │
│  Total Comp Percentile:   P58 ⚪         │
│                                         │
│  ASSESSMENT: Above Market               │
│  This offer is strong but not           │
│  exceptional. You have room to counter. │
│                                         │
│  [ View Counter-Offer Strategy ]        │
│  [ Compare vs. Other Offers ]           │
│                                         │
│  [ Accept ]  [ Counter ]  [ Decline ]   │
│                                         │
└─────────────────────────────────────────┘
```

### 6.3 Positioning Comparison View

Shows side-by-side comp for IC vs. management:

```
┌────────────────────────────────────────────────┐
│  Positioning Analysis: Meta                    │
├────────────────────────────────────────────────┤
│                                                │
│  Staff PM (IC) ─────────── Director (Management)
│                                                │
│  Base:        $285K             $315K          │
│  Bonus:       $57K (20%)         $63K (20%)    │
│  Equity:      $200K/yr           $350K/yr      │
│  ──────────────────────────────────────────── │
│  Total:       $542K              $728K          │
│  Percentile:  P60                P75+          │
│                                                │
│  IC Advantages:                                │
│  • Pure craft authority                        │
│  • Optionality to stay IC or transition mgmt   │
│  • Shorter onboarding, faster impact           │
│                                                │
│  Director Advantages:                          │
│  • +$186K annual comp (34% uplift)            │
│  • Org scope and team growth                   │
│  • Management visibility for future roles      │
│                                                │
│  Recommendation: Both are market-competitive.  │
│  Choose based on career preference, not comp.  │
│                                                │
│  [ Choose IC ]  [ Choose Management ]          │
│                                                │
└────────────────────────────────────────────────┘
```

### 6.4 Comp Preferences Settings

Standalone settings view:

```
┌──────────────────────────────────────┐
│  Comp Preferences                    │
├──────────────────────────────────────┤
│                                      │
│  Target Total Comp:                  │
│  $[250,000] – $[450,000] / year      │
│                                      │
│  Preferred Locations:                │
│  ☑ San Francisco / Bay Area          │
│  ☑ New York                          │
│  ☑ Remote                            │
│  ☐ Other: [____________]             │
│                                      │
│  Equity Preference:                  │
│  ○ Prefer stable, cash-heavy comp    │
│  ◉ Balanced (public company equity)  │
│  ○ Maximize equity (startup upside)  │
│                                      │
│  Salary vs. Equity Weight:           │
│  Base/Bonus: [====░░░░] 40%          │
│  Equity:     [░░░░════] 60%          │
│                                      │
│  [ Save Preferences ]                │
│                                      │
└──────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1: Core Benchmarking (Current)

**What exists:**
- [x] Levels.fyi data fetching and caching (via public API / Apify)
- [x] Benchmark card generation (text or markdown format)
- [x] Storage in Artifacts MCP
- [x] Display in role detail panel
- [x] Manual trigger ("Benchmark this role" button)
- [x] Glassdoor salary range integration

**In progress:**
- [ ] Auto-generation on role entry
- [ ] Positioning-aware comparison (IC vs. Director)

### Phase 2: Negotiation Support (v1.0.1)

> **Status: Implemented (v3.15.0)** — Negotiation scorecard, counter-offer wizard, equity valuation, multi-offer comparison.

**Implemented:**
- [x] Offer stage detection and Negotiation Scorecard generation
- [x] Market percentile calculation
- [x] Counter-offer suggestion engine with 4-step Claude wizard
- [x] Equity valuation calculator (funding stage → est. valuation → share value)
- [x] Multi-offer comparison table
- [ ] Negotiation attempt tracking (track counter cycles)

### Phase 3: Positioning Intelligence (v1.1)

> **Status: Implemented (v3.13.0)** — IC vs Director comparison. Cross-company table. Percentile position.

**Implemented:**
- [x] Automated IC vs. Director comp comparison at same company
- [x] Cross-company positioning analysis
- [x] Comp impact on positioning field decision
- [x] Integration with Research Brief (Section 2)
- [x] Positioning recommendations based on comp data

### Phase 4: Advanced Analytics (v1.2+)

> **Status: Implemented (v3.13.0)** — Comp by funding stage chart. Comp by tier chart. Stats cards.

**Implemented:**
- [x] Historical offer analysis (track comp trends across your search)
- [x] Comp by company tier / funding stage / size
- [x] Compensation regression (base, bonus, equity as f(company, level, location))
- [x] Export offer data for personal archive
- [x] Comp insights dashboard (heatmaps, distributions)

---

## 8. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Benchmark generation time | <2 sec | Performance monitoring |
| Data freshness | 95%+ current within 30 days | Cache hit rate, data age |
| Comp accuracy (vs. actual offers) | P50 ±15% of actual | Offer data entry feedback |
| Negotiation counter suggestions accepted | 60%+ | User action tracking |
| Positioning recommendations heeded | 70%+ user agreement | Post-benchmark survey |
| Coverage (roles with benchmarks) | 80%+ of active roles | Artifact count / role count |

---

## 9. Relationship to Other Modules

### 9.1 Data Dependencies

```
              ┌──────────────────────────┐
              │  Comp Intelligence Agent │
              │  (modules/comp-intel/)   │
              └───────────┬──────────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
        Pipeline       Research      Negotiation
        Tracker        Brief         Tracking
        (reads:        (Section 2)   (Scorecard)
         roles,
         companies)
```

### 9.2 Data Flows

| Module | What It Reads | What It Writes |
|--------|---|---|
| **Pipeline Tracker** | Comp benchmarks (Artifacts) when displaying role detail | Updated `negotiationScorecard` field on offer stage |
| **Research Brief** | Comp data from cache; benchmarks | Comp benchmark content (Section 2 of brief) |
| **Outreach Module** | Comp data for context-aware negotiation talk tracks | None (read-only) |
| **Resume Builder** | Comp data for positioning decision | None (read-only) |
| **Dashboard** | Comp alerts (offer received → scorecard ready) | None (read-only) |

### 9.3 Integration Example

**Flow: New role → Comp benchmark → Positioning decision → Research Brief**

```
1. User adds role to Pipeline
   ↓
2. Comp Intel Agent checks if comp data exists
   ├─ If yes: Generate benchmark card (Artifacts)
   ├─ If no: Flag as "comp data pending" in role detail
   ↓
3. User reviews benchmark card
   ├─ IC Staff at this company pays $482K
   ├─ Director pays $728K
   ↓
4. User makes positioning decision (toggle `positioning: 'ic'`)
   ├─ Comp module regenerates benchmark with IC/mgmt comparison
   ├─ Updates role's compData.positioningRecommendation
   ↓
5. User opens Research Brief for this role
   ├─ Research Brief Agent fetches comp benchmark from Artifacts
   ├─ Displays as Section 2 (Compensation Context)
   ├─ Uses positioning to frame compensation talk track
   ↓
6. Research Brief saved (Artifacts)
```

---

## 10. Technical Notes

### 10.1 External API Integration

**Levels.fyi:**
- Public API (no auth required)
- Query: `GET /api/salaries/?company={name}&role={title}&location={city}`
- Response: Base, bonus, equity, total comp, percentiles
- Rate limit: 100 req/min (ample for local use)
- Fallback: Cache aggressively; if API down, use stale data with warning

**Glassdoor:**
- Public web scraping (no official API)
- Use CORS proxy (`/api/fetch-url`) to fetch company profile
- Parse salary section with regex/DOM traversal
- Fallback: Skip if scraping fails; rely on Levels.fyi

**Job Posting Salary Ranges:**
- Already extracted by Job Feed Listener
- Read from `role.feedMetadata.salaryRange`
- No additional API call needed

### 10.2 CORS & Privacy

- All external API calls go through Pathfinder's CORS proxy (`/api/fetch-url`)
- Proxy validates domain, fetches server-side, returns HTML/JSON
- User data (offers, pref comp) NEVER sent to external APIs
- Comp cache stored locally in `pf_comp_cache` (localStorage)

### 10.3 Caching & Performance

- Benchmark generation cached by `{company}_{level}_{location}` key
- Cache invalidation: refresh if > 30 days old OR user explicitly requests refresh
- Estimated API calls: ~3-5 per unique company+level combo (amortized)
- Local storage impact: ~10-50 KB per 100 benchmarks (manageable)

---

## 11. Open Questions & Future Considerations

1. **Equity valuation for private companies:** How to estimate share value pre-exit? Use funding stage proxy (Series A = $25M valuation, etc.)? Ask user for valuation?
2. **Cost of living adjustments:** Auto-adjust benchmarks for location (SF to Austin = -20% base)? Or show multiple location scenarios?
3. **Role-specific benchmarks:** Comp varies by seniority, domain (PM vs. TPM vs. APM). Should we normalize to "Senior PM" or show range?
4. **Negotiation history:** Track successful counters vs. rejections to build user-specific playbook ("When I counter >X%, success rate is Y%")?
5. **International roles:** Support GBP, EUR, CHF, etc.? Currency conversion for comparisons?

---

## Conclusion

The Comp Intelligence Agent transforms compensation from a black box into a decision tool. By aggregating market data from multiple sources and presenting it with positioning and negotiation context, it gives you confidence in your positioning decisions and negotiation strategy. When an offer arrives, you know your market position instantly and can negotiate from data, not gut feel.

The module is designed to be self-contained (reads Pipeline and external APIs, writes Artifacts and role fields) while feeding seamlessly into downstream workflows (Research Brief, negotiation tracking, offer comparison).
