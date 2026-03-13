# Compensation Estimation Skill

## Name
comp-estimation

## Description
Estimate annual total compensation (TC) for product management roles from job postings. Classifies the posted compensation type FIRST (base salary vs total target cash vs OTE vs unknown), then applies appropriate formulas. Prevents double-counting errors from naively multiplying total-target-cash ranges.

## Trigger Phrases
- estimate compensation
- comp estimation
- total comp
- salary estimation
- compensation range

## When to Use
- A job posting includes a salary or compensation range
- Need to estimate likely total compensation
- Need to distinguish base salary vs total target cash vs OTE
- Need to infer IC vs manager PM role archetype
- Need company-stage or company-type calibration

## Core Principle
**Never estimate total compensation until the posted compensation type has been classified.**

The estimator must separate:
1. Posted range type (base salary? total target cash? OTE? unknown?)
2. Company comp structure (public calibrated? startup heuristic? generic?)
3. Inferred level (mid PM, senior PM, principal PM)
4. IC vs manager role archetype
5. Location band

---

## Step 1: Detect Posted Range Type

### A. BASE_SALARY
Classify as `BASE_SALARY` if compensation text includes:
- "base salary", "annual base pay", "salary range", "pay range", "base compensation"

### B. TOTAL_TARGET_CASH
Classify as `TOTAL_TARGET_CASH` if compensation text includes:
- "total target cash", "inclusive of bonus", "inclusive of bonus or commission"
- "cash compensation", "target cash"

### C. OTE
Classify as `OTE` if compensation text includes:
- "on-target earnings", "OTE", "commission eligible", "variable comp", "quota", "attainment"

### D. UNKNOWN
If none match, classify as `UNKNOWN`.

### Priority Order
If multiple patterns match: OTE > TOTAL_TARGET_CASH > BASE_SALARY > UNKNOWN

---

## Step 2: Detect Role Archetype

### IC Signals
- individual contributor, IC role, no direct reports, hands-on, deep technical
- principal, staff, cross-functional influence, own strategy and execution

### Manager Signals
- manage a team, build or lead a team, direct reports, people manager
- coach PMs, hire and develop, org design

### Outputs: `IC_PM`, `MANAGER_PM`, `UNKNOWN`

**Rule:** At large public companies, IC and manager PM roles are both normal at senior levels. IC signals should NOT create a compensation penalty.

---

## Step 3: Infer Seniority / Level

### Title Mapping
- Associate PM / APM → L1
- PM → L3/L4
- Senior PM → L4/L5
- Principal PM / Staff PM → L5/L6
- Group PM / Director PM → senior manager track or top IC

### Reinforcement Signals (increase level)
- executive communication, org-wide scope, platform ownership
- multi-product ownership, technical architecture depth
- 8+ / 10+ / 12+ years experience

---

## Step 4: Determine Calibration Mode

- `PUBLIC_CALIBRATED` — Company is public or has known comp patterns
- `STARTUP_HEURISTIC` — Seed / Series A / Series B / lightly benchmarked private
- `GENERIC_FALLBACK` — No reliable company calibration

---

## Step 5: Estimate Total Compensation

### Formula A: BASE_SALARY
`estimated_tc = base_salary × tc_multiplier`

#### Multipliers (public/mature tech PM roles)
| Level | Low | High |
|-------|-----|------|
| Mid PM | 1.25 | 1.40 |
| Senior PM | 1.30 | 1.45 |
| Principal PM | 1.35 | 1.55 |

Late-stage private: 1.25–1.50
Seed/Series A/B: 1.05–1.35 (cash-heavy) to 1.15–1.60 (high-equity)

**Hard cap:** Never exceed multiplier of 1.65 without company-specific evidence.

### Formula B: TOTAL_TARGET_CASH
`estimated_tc = total_target_cash + estimated_equity`

**Do NOT apply the base-salary TC multiplier to total target cash.**

#### Equity Add-on (public/late-stage tech PM)
| Level | Low | High |
|-------|-----|------|
| Mid PM | +10% | +25% |
| Senior PM | +15% | +35% |
| Principal PM | +20% | +45% |

### Formula C: OTE
- Route to sales-comp estimator (not PM formulas)
- If title is PM but comp is OTE, mark confidence Low

### Formula D: UNKNOWN
- Conservative fallback: `posted_range × 1.15–1.40`
- Wider range, lower confidence

---

## Step 6: Location Normalization
- Use location-specific band when available
- Don't mix Colorado/national transparency ranges into Bay Area estimates
- If location unclear/mismatched, downgrade confidence

---

## Confidence Scoring

| Factor | Condition | Points |
|--------|-----------|--------|
| Range type | Clear base salary phrase | +20 |
| Range type | Clear total target cash phrase | +20 |
| Range type | Conflicting phrases | -15 |
| Range type | Unknown type | -20 |
| Calibration | Company-specific benchmark | +20 |
| Calibration | Peer-company calibration | +10 |
| Calibration | Generic only | 0 |
| Level | Title + JD agree | +15 |
| Level | Title only | +5 |
| Level | Ambiguous | -10 |
| Location | Exact band match | +10 |
| Location | State-level only | +5 |
| Location | Mismatch/unclear | -10 |
| Role type | Clear IC or manager | +10 |
| Role type | Conflicting/none | 0 |

### Confidence Mapping
- 55+ → High
- 35–54 → Medium
- Below 35 → Low

---

## Guardrails

### Hard Guardrails
1. If detected type is `TOTAL_TARGET_CASH`, NEVER apply a full TC multiplier
2. If estimated midpoint exceeds known visible company PM top-of-range by >20%, flag low confidence
3. If output above likely PM bands and title is not Director/VP, cap or flag

### Soft Guardrails
- Principal IC at public company can be very highly paid
- Lack of direct reports = no comp discount
- Startup title inflation ≠ public-company compensation

---

## Examples

### Example 1: Adobe Principal PM (Base Salary)
- Comp text: "$148K–$282K"
- Type: BASE_SALARY (no TCC signal)
- Role: IC_PM, Level: Principal, Calibration: PUBLIC_CALIBRATED
- Est. TC: ~$200K–$437K, Confidence: Medium-High

### Example 2: Autodesk Sr Principal PM (Base Salary)
- Comp text: "$125K–$223,850"
- Type: BASE_SALARY
- Role: IC_PM, Level: Principal, Calibration: PUBLIC_CALIBRATED
- Est. TC: ~$163K–$336K, Confidence: Medium

### Example 3: Amplitude Principal PM (Total Target Cash)
- Comp text: "$200K–$301K total target cash"
- Type: TOTAL_TARGET_CASH
- Role: IC_PM, Level: Principal, Calibration: PUBLIC_CALIBRATED
- Est. TC: ~$240K–$420K, Confidence: Medium

---

## Implementation Phases

### Phase 1 (Core)
- Range-type classifier
- Remove generic flat-ratio logic
- Hard guardrail for total target cash

### Phase 2 (Calibration)
- Company-specific calibration
- Location normalization
- Confidence scoring

### Phase 3 (Learning)
- Learned priors by company/title/level
- Anomaly detection and review flags
