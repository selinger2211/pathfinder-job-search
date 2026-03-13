# Pathfinder Testing Strategy

## 1. Purpose

This document defines the testing approach for Pathfinder, an 11-module job search system built as standalone HTML pages with no build step. Until now, testing has been ad-hoc. This strategy establishes repeatable testing practices across unit, integration, end-to-end, and AI output levels, ensuring each module functions correctly both individually and as part of the larger system.

## 2. Testing Levels

### Unit Testing

**What:** Individual functions (scoring engine, salary extraction, domain parsing, date formatting) tested in isolation.

**How:** Create `tests/` directory with a simple HTML test runner that executes assertions. For now, use vanilla JavaScript assertions (no external framework required). Each test file maps to a module:
- `tests/job-feed-tests.html` — Feed module functions
- `tests/pipeline-tests.html` — Pipeline module functions
- `tests/research-tests.html` — Research module functions
- Open in browser, check console for pass/fail count

**Priority functions to test:**

| Function | Module | Reason |
|----------|--------|--------|
| `scoreRole()` | Job Feed | Complex weighting logic; small changes impact role ranking |
| `extractSalaryFromJD()` | Pipeline | Regex parsing; prone to off-by-one and formatting errors |
| `getCompanyDomain()` | Feed / Pipeline | URL parsing edge cases (www, subdomains, special chars) |
| `evaluateSalary()` | Pipeline | Range comparison; impacts salary filter accuracy |
| `estimateTotalComp()` | Feed | Archetype ratio calculations; financial accuracy matters |
| `generateNudges()` | Dashboard | 12 rule conditions; easy to introduce regressions |
| `sortLinkedInConnections()` | Pipeline | Multi-factor sorting; affects connection prioritization |

**Test Structure:**
```javascript
// tests/job-feed-tests.html
<script>
let passCount = 0, failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`✓ ${message}`);
  } else {
    failCount++;
    console.error(`✗ ${message}`);
  }
}

// Example test
function testScoreRole() {
  const role = { title: "Engineer", yearsExperience: 5, salary: 150000 };
  const score = scoreRole(role);
  assert(score >= 0 && score <= 100, "scoreRole returns 0-100");
  assert(typeof score === "number", "scoreRole returns number");
}

testScoreRole();
console.log(`Results: ${passCount} passed, ${failCount} failed`);
</script>
```

---

### Integration Testing

**What:** Cross-module data flow verification. Test that when one module saves data, other modules receive it correctly via localStorage.

**How:**
1. Open developer console on each module
2. Seed localStorage with known data using `seedTestData()` utility
3. Load the dependent module
4. Verify expected fields appear and calculations are correct
5. Check console logs for hydration success

**Priority flows:**

| Flow | Setup | Verify |
|------|-------|--------|
| Feed → Pipeline | Add 3 roles to Feed via job list | Pipeline shows all 3 with correct title, company, salary fields |
| Pipeline stage change | Move role from "Applied" to "Screen" | Dashboard nudge fires; role appears in "Upcoming Interviews" |
| Research Brief generation | Generate brief for a Pipeline role | Brief saved to role's `research_brief` field; Pipeline displays it |
| Calendar event → Dashboard | Create mock interview event (March 20, 2pm) | Dashboard shows in "This Week" section with correct time |
| Resume Builder → Role | Select bullets for a role, save | Role's `selected_bullets` field updated; can be viewed in Pipeline |

**Test Utility (seed-test-data.js):**
```javascript
function seedTestData(module) {
  if (module === 'feed') {
    localStorage.setItem('pf_jobs', JSON.stringify([
      { id: 1, title: "Senior Engineer", company: "TechCorp", url: "https://techcorp.com/jobs/1" },
      { id: 2, title: "Product Manager", company: "StartupXYZ", url: "https://startupxyz.com/jobs/2" }
    ]));
  } else if (module === 'pipeline') {
    localStorage.setItem('pf_roles', JSON.stringify([
      {
        id: 1,
        title: "Senior Engineer",
        company: "TechCorp",
        stage: "Applied",
        salary_min: 140000,
        salary_max: 180000
      }
    ]));
  }
  console.log(`[Seed] Test data loaded for ${module}`);
}
```

---

### End-to-End Testing

**What:** Full user journeys from job discovery through offer/rejection, validating the entire system works together.

**How:** Manual test scripts (provided below). Load all modules in sequence, follow the script, document any deviations. Future: automate with Playwright or Puppeteer.

**Scenario 1: Single Role Happy Path**

1. **Feed:** Search for "Engineer Manager San Francisco"
2. Verify 10+ roles appear with scores
3. Click "Save to Pipeline" on the top-scoring role (score 85+)
4. **Pipeline:** Verify role appears in "New" stage with all fields (title, company, salary, JD link)
5. Click role → "Start Research"
6. **Research:** Verify Research Brief appears with 4+ sections (Company Overview, Role Fit, Growth Opportunity, Interview Prep)
7. Return to Pipeline, change stage to "Applied"
8. **Dashboard:** Verify nudge appears: "Role moved to Applied. Next: schedule screen."
9. Click "Schedule Interview" in Dashboard
10. **Calendar:** Create mock interview for March 25, 2pm
11. **Dashboard:** Verify interview appears in "Upcoming" section
12. Complete mock interview → debrief captured
13. **Pipeline:** Verify debrief linked to role; nudge shows "Debrief recorded"

**Expected outcome:** Role progresses through entire workflow with no data loss or crashes.

---

**Scenario 2: Bulk Feed Import**

1. **Feed:** Toggle "Import 20 test roles" (creates mock dataset)
2. Verify all 20 roles appear with varied scores (50-95)
3. Apply filter: salary $150k-$200k, only 8 roles pass
4. Select top 5 by score, bulk "Save to Pipeline"
5. **Pipeline:** Verify 5 roles in "New" stage
6. Verify sorting is correct (highest salary first within same company category)

**Expected outcome:** Bulk operations complete without timeout; Pipeline displays all 5 roles.

---

**Scenario 3: Mock Interview Debrief Loop**

1. **Pipeline:** Navigate to a role in "Screen" stage
2. Click "Start Mock Interview"
3. **Mock Interview:** Complete 3 questions, provide answers, get evaluations
4. Submit for debrief
5. **Debrief:** Verify insights generated and match interview content (e.g., "You struggled with system design" should reference an actual system design question)
6. **Pipeline:** Return to role, verify debrief appears; role auto-moves to "Interview" stage
7. **Research:** Click "Research Brief" → verify brief includes "Interview Prep" section with debrief insights

**Expected outcome:** Debrief data flows into Research Brief; no hallucinated insights.

---

## 3. AI Output Testing (Golden Datasets)

All 5 Claude-powered modules use golden datasets to catch regressions in AI output quality.

### Golden Dataset Registry

| Module | Dataset Location | # Test Cases | What's Evaluated |
|--------|-----------------|-------------|-----------------|
| Research Brief | `docs/eval/research-brief/` | 10 roles | Section completeness, citation accuracy, company details correctness |
| Resume Builder | `docs/eval/resume-builder/` | 5 roles | Bullet selection accuracy, keyword coverage, no hallucinated skills |
| Debrief | `docs/eval/debrief/` | 5 interviews | Pattern detection accuracy, feedback attribution to actual answers |
| Outreach | `docs/eval/outreach/` | 5 contacts | Personalization quality, no hallucinated facts, tone appropriateness |
| Mock Interview | `docs/eval/mock-interview/` | 5 sessions | Question relevance, technical framework adherence, evaluation accuracy |

### Golden Dataset Structure

```
docs/eval/{module}/
├── test-case-001.json          # Input data (role, company, JD, etc.)
├── test-case-001-expected.json # Expected output (known-good baseline)
├── test-case-001-actual.json   # Last run output
├── test-case-002.json
├── test-case-002-expected.json
├── test-case-002-actual.json
├── ...
└── results.md                  # Regression notes and comparison
```

**Example: Research Brief Test Case**

```json
// test-case-001.json (INPUT)
{
  "role": "Senior Backend Engineer",
  "company": "Stripe",
  "jd": "5+ years backend experience, strong Go/Rust skills, payment systems...",
  "company_info": {
    "founded": 2010,
    "hq": "San Francisco, CA",
    "revenue": "1B+",
    "mission": "Increase the GDP of the internet"
  }
}
```

```json
// test-case-001-expected.json (BASELINE - KNOWN GOOD)
{
  "company_overview": "Founded in 2010, Stripe is a payment infrastructure platform...",
  "role_fit": "Your 5+ years experience aligns with...",
  "growth_opportunity": "Stripe invests heavily in backend infrastructure...",
  "interview_prep": "Be prepared to discuss...",
  "citations": ["stripe.com", "crunchbase.com"]
}
```

### Regression Protocol

**Before ANY prompt change in a Claude-powered module:**

1. Run all golden test cases through the module
2. Save outputs to `test-case-NNN-actual.json`
3. Compare actual vs. expected section-by-section using this checklist:
   - **Factual accuracy:** Does it match known company facts?
   - **Completeness:** Are all expected sections present?
   - **Tone:** Is voice consistent with previous version?
   - **Hallucinations:** Any made-up facts or false citations?
   - **Length:** Significantly shorter/longer?

4. Document findings in `results.md`:
```markdown
## Regression Test Results: 2026-03-13

**Prompt Change:** Updated Research Brief system prompt to emphasize company culture

**Results:** 10/10 passed
- test-case-001: PASS (minor wording change in role_fit section)
- test-case-002: PASS
- ... all others PASS

**Notes:** No regressions detected. New prompt slightly more conversational but maintains accuracy.
```

5. **If regression detected:**
   - Revert the prompt change
   - Add the failing test case to the golden dataset permanently
   - Document why it failed
   - Re-run to confirm fix

**If prompt improves output:**
   - Update `expected.json` file
   - Note in `results.md` why baseline was updated
   - Proceed with deployment

---

## 4. Failure Injection Testing

Test system behavior when things break. These are spot-checks; run monthly.

### Test Scenarios

| Scenario | How to Test | Expected Behavior |
|----------|------------|-------------------|
| **localStorage cleared mid-session** | Open Pipeline, clear `pf_roles` via DevTools Console | App detects empty data on next module load; shows "Data recovery needed" button; can reload from MCP bridge |
| **Claude API key invalid** | Set `pf_anthropic_key` to "invalid_key_12345" in settings | Any Claude call shows error: "API key invalid. Update in Settings." No silent failures. No retry loop. |
| **Claude API rate limited (429)** | Trigger rapid calls to Research Brief (5+ in 10 seconds) | First 3 requests include exponential backoff: wait 2s, 4s, 8s. After 3 retries, show: "Rate limited. Try again in ~1 minute." User can retry manually. |
| **MCP bridge down** | Stop the MCP bridge process, keep app running | App works normally via localStorage. Calendar reads work. Sync indicator shows "MCP unavailable." No error popups. |
| **Corrupted JSON in localStorage** | Set `pf_roles` to `"{invalid json"` via console | Pipeline module loads but shows: "Unable to load data. [Recover]" button triggers reload from MCP. Doesn't crash. Console error logged. |
| **Network offline** | Disconnect network (DevTools > Offline) | All local features work (Feed, Pipeline, Dashboard read). Claude calls fail gracefully: "Network unavailable. Check your connection." |
| **Very large dataset** | Seed 500+ roles via `seedTestData('large')` | Dashboard loads <3s. Scrolling smooth. No jank. DevTools shows <100MB memory. |
| **Empty dataset** | Clear all `pf_*` localStorage keys | Each module shows appropriate empty state (Feed: "No jobs yet", Pipeline: "Start adding roles"). No crashes. |

### Running Failure Tests

Use this checklist for monthly spot-checks:

```
[ ] localStorage cleared — recovery works
[ ] API key invalid — error message clear and immediate
[ ] API rate limit — backoff works, user can retry
[ ] MCP bridge down — app functions, sync shows unavailable
[ ] Corrupted JSON — graceful error with recovery
[ ] Network offline — clear messaging
[ ] 500 roles loaded — performance acceptable
[ ] Empty dataset — empty states work

Date: ______ | Tester: ______ | Notes: _______________
```

---

## 5. Performance Benchmarks

All metrics measured in production-like conditions (DevTools Performance tab, no throttling unless noted).

| Metric | Target | How to Measure |
|--------|--------|---------------|
| **Dashboard page load** (100 roles, calendar events) | <2s | DevTools Performance tab, Largest Contentful Paint (LCP) |
| **Pipeline page load** (100 roles with scores) | <2s | DevTools Performance tab |
| **Feed page load** (search, 50 results with scores) | <2s | DevTools Performance tab |
| **Feed scoring** (50 roles, all calculations) | <500ms | Console: `console.time('scoreAll'); ... console.timeEnd('scoreAll')` |
| **Research Brief generation** (end-to-end Claude call) | <60s | Timer in UI during generation |
| **localStorage read** (all keys: roles, settings, calendar) | <100ms | Console: `console.time('hydrate'); ... console.timeEnd('hydrate')` |
| **MCP sync round-trip** (send + receive) | <500ms | DevTools Network tab, XHR request timing |
| **Resume bullet filtering** (100 bullets, selection) | <200ms | Console timer in Resume Builder |
| **Mock interview question loading** | <1s | Page render time in DevTools |

### Performance Test Script

```javascript
// Run in DevTools console on each module
console.time('hydrate');
const roles = JSON.parse(localStorage.getItem('pf_roles') || '[]');
console.timeEnd('hydrate');
// Should see <100ms

console.time('scoreAll');
roles.forEach(role => scoreRole(role));
console.timeEnd('scoreAll');
// Should see <500ms for 50 roles

// Check memory
console.log(performance.memory.usedJSHeapSize / 1048576 + ' MB');
// Should be <100MB even with 500 roles
```

---

## 6. Test Execution Schedule

| Frequency | What | Who | Duration |
|-----------|------|-----|----------|
| **Every code change** | Run affected unit tests | Developer (Claude) | <5 min |
| **Every prompt change** (Research, Resume, Debrief, Outreach, Mock Interview) | Run AI golden dataset regression (all test cases for that module) | Developer (Claude) | <15 min |
| **Weekly** | Manual E2E walkthrough: Scenario 1 (single role happy path) on one module pair (e.g., Feed → Pipeline) | User (Ili) | <30 min |
| **Monthly** | Failure injection spot-check: 3-4 scenarios from Section 4 | Developer (Claude) | <30 min |
| **Quarterly** | Full regression suite: all unit tests + all AI golden datasets + all 3 E2E scenarios + performance benchmarks | Developer (Claude) | <2 hours |

### Before Any Release to Production

1. Run full unit test suite (all modules)
2. Run AI golden dataset regression (all 5 modules)
3. Verify all 3 E2E scenarios pass
4. Run performance benchmarks; confirm no degradation
5. Spot-check 2-3 failure injection scenarios
6. Document results in `docs/RELEASE_NOTES.md`

---

## 7. Tools & Resources

### Test Files Location
- **Unit tests:** `tests/` (HTML + JS)
- **AI golden datasets:** `docs/eval/{module}/`
- **Utilities:** `tests/seed-test-data.js`, `tests/test-runner.js`
- **Results:** Each module's `docs/eval/{module}/results.md`

### Quick Commands
```bash
# Open unit tests in browser
open tests/job-feed-tests.html

# Seed test data (from any module's DevTools console)
seedTestData('feed');  // or 'pipeline', 'research', etc.

# Clear all test data
localStorage.clear(); location.reload();

# Check for errors in console
// Filter by "ERROR" or module name
```

---

## 8. Acceptance Criteria

A module/change is **ready for production** when:

- ✓ All unit tests for that module pass
- ✓ All affected integration flows pass
- ✓ AI golden dataset regression shows no regressions (or improvements documented)
- ✓ All E2E scenarios complete without crashes
- ✓ Performance benchmarks met (no >10% degradation)
- ✓ No new failure injection issues
- ✓ Results documented in release notes

