# AI Evaluation Framework for Pathfinder

## 1. Purpose & Scope

This document establishes evaluation standards, versioning protocols, and quality gates for Claude API integrations across Pathfinder's agentic job search system. It ensures consistent, safe, and accurate output across five high-stakes modules that generate personalized job search content.

**Modules covered:**
- **Research Brief** — Company and role preparation documents
- **Resume Builder** — JD analysis and resume generation
- **Debrief** — Post-interview synthesis and feedback capture
- **Outreach** — Multi-channel messaging (LinkedIn, email, thank-you notes)
- **Mock Interview** — Multi-turn interview simulation across 7 interview types

**Why this matters:** These modules directly influence user decision-making in high-stakes career contexts. Hallucinations, factual errors, or misattributions can damage user credibility, waste preparation time, or trigger poor hiring decisions.

---

## 2. Prompt Versioning

### Naming Convention
Prompts are versioned using the format:
```
{module}_{feature}__v{N}_{YYYYMMDD}
```

**Examples:**
- `research-brief__company-section__v2_20260313`
- `resume-builder__jd-analysis__v1_20260301`
- `debrief__interviewer-synthesis__v3_20260310`
- `outreach__linkedin-message__v2_20260305`
- `mock-interview__behavioral-questions__v1_20260313`

### Storage & Documentation
- Prompts embedded as constants in module code (e.g., `modules/research-brief/prompts.js`)
- Each module's PRD includes a **Prompt Inventory** section listing all active versions
- Version history and rationale documented in module-level CHANGELOG
- Retired versions (N-2 and earlier) retained as commented-out code blocks for quick rollback

### Change Protocol
1. **Create**: Assign new version number, update constant name, document in CHANGELOG
2. **Test**: Run full regression suite against golden dataset for that feature
3. **Flag degradation**: If any regression case scores below acceptance threshold, iterate before merge
4. **Deploy**: Merge with version update and CHANGELOG delta
5. **Monitor**: Flag any user-reported issues within first 48 hours of deployment

### Rollback Procedure
1. Identify prior version in code comments (N-1 or N-2)
2. Swap the active constant to prior version
3. Deploy immediately
4. File post-mortem issue and schedule re-evaluation before re-attempting

---

## 3. Model Versioning

### Current Configuration
- **Default model**: `claude-sonnet-4-20250514` (stored in `pf_claude_model`)
- **Storage location**: User settings and module configuration
- **User override**: Any module with Claude API access allows settings override
- **API configuration**: Direct browser-to-Anthropic via `anthropic-dangerous-direct-browser-access` header
- **API key storage**: `pf_anthropic_key` (user-scoped)

### Model Update Process
1. **Detection**: Monitor Anthropic release notes and Claude API changelog
2. **Preparation**: When new model released, schedule evaluation within 1 week
3. **Regression suite**: Run all 5 modules' golden datasets on new model vs. current model
4. **Comparison**: Score outputs on accuracy, relevance, hallucination frequency using module-specific rubrics
5. **Decision gate**:
   - If new model scores **≥ current model**: Safe to adopt, document performance delta
   - If new model scores **< current model**: Document specific trade-offs (speed, cost, etc.) and defer adoption OR iterate with Anthropic if critical issue found
6. **Rollout**: Update `pf_claude_model` default, notify users of model change, allow override in settings
7. **Observation period**: Monitor user feedback for 2 weeks post-update

---

## 4. Grounding Requirements by Module

| Module | Hallucination Risk | Max Error Rate | Grounding Requirement | Source of Truth |
|--------|-------------------|----------------|----------------------|-----------------|
| **Research Brief** | Medium | ≤5% | 100% of facts must be cited to source | Job description, enriched company data (Crunchbase, LinkedIn, recent news), user-provided context |
| **Resume Builder** | High | ≤2% | All skills and quantified accomplishments must map to user's bullet bank or explicitly stated experience | User's provided bullet bank, stated work history, verifiable metrics only |
| **Debrief** | Low | ≤10% | Synthesis must attribute feedback only to user's stated interviewer names and feedback | User's typed interview notes, stated interviewer roles, explicit feedback provided |
| **Outreach** | High | ≤1% | No invented facts about recipients; specific initiatives must be confirmed in input data (LinkedIn profile, mutual connections, company news) | Recipient's LinkedIn profile, mutual connection data, company website, confirmed initiatives only |
| **Mock Interview** | Low | ≤10% | Questions can be generative to industry; evaluation/feedback must ground in user's actual stated answers | User's stated response text, interview type specification, industry role requirements |

### Grounding Implementation
- **Research Brief**: Inject structured company data and JD text as context; require `[source]` tags in output
- **Resume Builder**: Embed user's bullet bank in system prompt; validate all claims against bank before returning
- **Debrief**: Pass user's interview notes verbatim in context window; block synthesis on unattributed claims
- **Outreach**: Embed recipient profile JSON; flag any fact claims outside profile data
- **Mock Interview**: Embed user's stated answer in evaluation prompt; reference specific quotes in feedback

---

## 5. Hallucination Taxonomy

### Research Brief
**High-risk hallucinations:**
- **Company confusion**: Attributes a competitor's funding, news, or product roadmap to the target company
  - *Example*: "Acme Corp raised Series B in 2025" when only competitor TechCorp raised Series B
  - *Detection*: Cross-check all dollar amounts, funding rounds, and investor names against Crunchbase/LinkedIn
- **False attribution**: Cites a news article or initiative to wrong company
  - *Example*: Attributes DuckDuckGo's privacy campaign to Google
  - *Detection*: Verify article URLs and publication dates; check bylines for company name
- **Outdated information**: Presents stale job requirements or team structure as current
  - *Example*: Lists CEO who left 18 months ago as current
  - *Detection*: Cross-reference any person or role claim against current LinkedIn/Crunchbase data
- **Invented product details**: Fabricates a product feature or roadmap item
  - *Example*: "Acme's dashboard supports real-time Slack integration" when not mentioned in JD or company materials
  - *Detection*: Verify all product claims against JD text and official product docs

### Resume Builder
**High-risk hallucinations:**
- **Invented skills**: Adds technical or domain skills user never mentioned
  - *Example*: "Proficient in Kubernetes" when user's bullet bank only mentions Docker
  - *Detection*: Do word-match against user's provided bullet bank and work history
- **Fabricated metrics**: Creates specific numbers or impact claims not in bullet bank
  - *Example*: "Reduced page load times by 40%" when user only stated "improved performance"
  - *Detection*: Flag any quantified claim without source in bullet bank; require user confirmation
- **Overstated accomplishments**: Reframes a supporting role as a lead role
  - *Example*: "Led cross-team API redesign" when user's bullet says "contributed to API redesign"
  - *Detection*: Semantic analysis of verb strength; manual review of high-stakes bullets
- **Role/context mismatch**: Describes work experience in wrong job context
  - *Example*: Lists "HR management" skills for an engineering role where user was an IC engineer
  - *Detection*: Cross-check role context against JD requirements and user's stated target roles

### Debrief
**Medium-risk hallucinations:**
- **Interviewer misattribution**: Attributes feedback to wrong person or invents interviewer name
  - *Example*: "Sarah from Engineering said..." when interview notes only mention "the hiring manager"
  - *Detection*: Verify all interviewer names/roles against user's stated interview notes
- **Invented feedback pattern**: Infers a non-existent theme from feedback
  - *Example*: Synthesizes "emphasis on technical depth" when notes show only one mention of a specific tool
  - *Detection*: Manual review of synthesis logic; require ≥2 independent data points for pattern claims
- **Overgeneralization**: Extracts a broad conclusion from narrow feedback
  - *Example*: "Team prioritizes startup mentality" based on one casual comment about "scrappy work"
  - *Detection*: Flag synthesis statements that extrapolate beyond evidence; require user confirmation

### Outreach
**Critical hallucinations:**
- **Invented facts about recipient**: Fabricates personal details, role, or interests
  - *Example*: "I saw your recent article on AI in healthcare" when recipient has no published articles
  - *Detection*: Cross-check all recipient-specific claims against LinkedIn profile, company website, and company news feed
- **False product claims**: States product features or achievements that don't exist
  - *Example*: "Your platform integrates with 50+ tools" when only 15 are listed
  - *Detection*: Embed official product/company data in prompt; validate claims against source before output
- **Invented mutual connection or shared context**: References a non-existent connection or fake shared experience
  - *Example*: "We both worked at TechCorp" when user never worked there
  - *Detection*: Ground mutual connections in provided connection data; block unsourced shared-context claims
- **Misattributed initiative**: Credits recipient with a company initiative they didn't lead
  - *Example*: "I noticed you spearheaded the DEI program" when someone else leads it
  - *Detection*: Verify all leadership claims against company org data if available; require source in input

### Mock Interview
**Medium-risk hallucinations:**
- **Irrelevant questions**: Asks questions unrelated to stated role or industry
  - *Example*: For a Product Manager role, asks "Walk me through your DevOps monitoring strategy"
  - *Detection*: Semantic relevance check against industry best practices and role JD; manual review of first 10 runs
- **Factual errors about industry**: Misstates industry trends or company facts
  - *Example*: "Your company was founded in 2018" when it was 2015
  - *Detection*: Cross-reference any company/industry claims in questions against pre-loaded data
- **Misaligned evaluation**: Feedback contradicts user's stated answer or focuses on wrong dimensions
  - *Example*: User says "I used A/B testing" and feedback says "no mention of data-driven approach"
  - *Detection*: Programmatic check: evaluation text must reference user's actual answer text

---

## 6. Acceptance Thresholds

### Pass/Fail Criteria by Module

#### Research Brief
- **PASS**: All 14 sections completed; ≤1 hallucination per section; 100% of claims cited; no unmatched company/role
- **FAIL**: >1 hallucination per section, OR uncited claim, OR obvious company confusion, OR factual error on primary company funding/structure
- **Conditional**: Minor formatting issues or 1 outdated person title (e.g., old CEO listed) = manual review required; user must acknowledge before display

#### Resume Builder
- **PASS**: All provided bullets incorporated; no invented skills; quantified claims traceable to input; ≤2 minor tone adjustments from user feedback
- **FAIL**: Invented skill >5 words, OR fabricated metric without source, OR role context mismatch, OR claimed experience not in user's history
- **Conditional**: Reframed weak verb (e.g., "contributed" → "led") = flag for user confirmation before output

#### Debrief
- **PASS**: All user-provided feedback incorporated; synthesis grounded to stated feedback; interviewer names match user's notes; ≤1 inference unsupported by evidence
- **FAIL**: Unattributed feedback, OR interviewer name mismatch, OR >1 unsupported pattern inference, OR synthesis contradicts stated feedback
- **Conditional**: Single pattern inference from 1-2 data points = accept with confidence score <70%; flag for user review

#### Outreach
- **PASS**: Message personalized to recipient; all recipient-specific claims verified; no false product claims; tone matches channel
- **FAIL**: Invented fact about recipient, OR false product claim, OR unverified mutual connection claim, OR tone inappropriate for channel
- **Conditional**: Minor personalization gap (e.g., generic mention of role) = accept but flag for user refinement

#### Mock Interview
- **PASS**: Questions relevant to stated role/industry; evaluation references user's actual answer; feedback actionable; ≤1 factual error in question
- **FAIL**: Question irrelevant to role, OR evaluation misrepresents user's answer, OR >1 factual error in question, OR feedback non-actionable
- **Conditional**: Edge-case question (novel but defensible for role) = accept with lower confidence; user can skip if not useful

---

## 7. Regression Testing

### Golden Datasets
Each module maintains 10–20 hand-curated test cases with known-good reference outputs:

**Location**: `docs/eval/{module}/golden-dataset.json`

**Structure per case**:
```json
{
  "test_id": "rb-jd-analysis-001",
  "module": "resume-builder",
  "feature": "jd-analysis",
  "input": {
    "jd": "...",
    "user_bullet_bank": [...]
  },
  "expected_output_keys": ["skill_gaps", "resume_sections", "bullet_suggestions"],
  "acceptance_criteria": "≤2 invented skills, all gaps map to JD text",
  "reference_output": {...}
}
```

**Maintenance**:
- Review and update quarterly
- Add new cases when bugs or edge cases emerge
- Version golden datasets alongside prompt versions
- Tag cases by risk level: `critical`, `high`, `medium`, `low`

### Pre-Release Testing Protocol
1. **Baseline**: Run current prompt version against golden dataset; record scores
2. **New version**: Deploy candidate prompt; run against same golden dataset
3. **Comparison**: Compare outputs on:
   - Hallucination count per module
   - Citation completeness (for Research Brief)
   - Skill/experience accuracy (for Resume Builder)
   - Attribution accuracy (for Debrief, Outreach)
   - Relevance score (for Mock Interview)
4. **Flagging**: Any test case score drop >10% = **halt merge**, iterate prompt
5. **Sign-off**: Engineering + Product approval before deploying to production

### Quarterly Audit
- **Sample**: 30 random outputs per module from last 90 days
- **Review**: Human spot-check for hallucinations not caught by automated tests
- **Reporting**: Document findings in quarterly quality report; escalate critical issues
- **Iteration**: Adjust prompts or golden datasets based on audit findings

### Version Control
- Golden datasets stored as JSON in `docs/eval/{module}/`
- Datasets tagged with prompt version and model version
- Change log: `docs/eval/CHANGELOG.md`
- Example entry:
  ```
  ## 2026-03-13
  - Added 3 new Research Brief test cases for competitor confusion edge cases
  - Updated Resume Builder golden dataset for prompt v2
  ```

---

## 8. Human Review Gates

### When Manual Review is Required

| Trigger | Module | Action | Timeline |
|---------|--------|--------|----------|
| **First deployment of new prompt version** | All | Manual review of first 10 consecutive outputs | Before display to production users |
| **Model version change** | All | Manual review sample of 20 outputs across all modules | Within 48 hours of model update |
| **Hallucination flag in automated test** | Any | Review output before returning to user | Real-time block; escalate if pattern emerges |
| **Low confidence score** | Outreach, Debrief | Manual review before display | Before output delivery |
| **User reports inaccuracy** | Any | Investigate case, review similar outputs for pattern | Within 24 hours; escalate if >2 similar issues in week |

### Monthly Sampling Protocol

**Cadence**: Every Friday, sample across all modules

**Sample size**:
- 5 Research Brief outputs
- 5 Resume Builder outputs
- 5 Debrief outputs
- 5 Outreach messages
- 5 Mock Interview Q&A pairs

**Review criteria**:
- Factual accuracy (spot-check 2–3 claims per output)
- Hallucination presence (any ungrounded claims?)
- Attribution accuracy (if claims made, are they cited/sourced?)
- Tone and relevance (appropriate for context?)

**Documentation**:
- Record in `docs/eval/monthly-review-log.md`
- Flag any concerns for engineering review
- Escalate patterns to product + engineering sync

**Sign-off**:
- Minimum 2 human reviewers per sample
- Approval required to continue operation without restrictions

### Critical Issue Escalation
- **Severity 1** (hallucination affecting >5 users or >$1K impact): Stop using prompt, rollback to prior version, post-mortem within 24 hours
- **Severity 2** (isolated hallucination in 1–4 users): Isolate test case, update golden dataset, iterate prompt, re-test before redeployment
- **Severity 3** (minor factual gap, ambiguous claim): Add to audit log, adjust acceptance criteria if needed, no immediate rollback

---

## Appendix: Implementation Checklist

- [ ] Embed all prompts as versioned constants in module code
- [ ] Create golden datasets for each of 5 modules (10–20 cases each)
- [ ] Set up pre-release regression test pipeline
- [ ] Configure automated hallucination detection (citation gaps, fact-check)
- [ ] Establish weekly manual review process
- [ ] Document current model version in `pf_claude_model`
- [ ] Create CHANGELOG files for each module
- [ ] Set up model update monitoring and 1-week evaluation timeline
- [ ] Brief team on rollback procedures and escalation protocol
