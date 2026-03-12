# Resume Best Practices
*Distilled from Ili Selinger's job search process, March 2026*

---

## Hard Rules

- **One page. Always.** No exceptions regardless of experience length. Force prioritization.
- **Output filename is always generic** – `Ili_Selinger_Resume.docx`, never company-specific. Recruiters notice tailored filenames and it signals desperation.
- **Never use em dashes (—)** in any written content. They read as LLM-generated. Use a spaced en dash ( – ) instead.
- **Every bullet follows the same format:** **Bold lead phrase** followed by regular text with a specific metric or outcome.
- **Every role must have an italic subtitle** beneath the job header. It frames the work for the reader before they hit the bullets.

---

## Before You Write Anything: JD Analysis

Do this before touching the resume. Extract and state explicitly:

1. **Target seniority level** – what level is the JD actually hiring for?
2. **Top 5–7 keywords** – the most important domain/skill terms you legitimately have experience with. Flag any that are borderline.
3. **Primary domain** – AdTech, AI/ML, identity, SaaS, data platforms, etc.
4. **Role type** – 0-to-1 product, scaling, platform/infra, GTM-heavy, engineering-facing?
5. **Stakeholder environment** – advertisers, engineers, C-suite, agencies, publishers?
6. **Fit assessment** – see below

Only customize the resume after completing this analysis. Skipping it leads to keyword-stuffing and misaligned framing.

---

## Fit Assessment: Flag Gaps Before Generating

Run this check before generating any version:

- **Missing core requirement** – if the JD lists a hard requirement you clearly don't have, say so explicitly. Do not paper over it.
- **Stretch requirements** – adjacent but not direct experience. Note it and use honest framing.
- **Strong fit signals** – where your background is an unusually strong match. These should be amplified.

```
Fit Assessment:
- Strong match: [reasons]
- Gaps to note: [any hard gaps]
- Borderline terms: [keywords that need careful framing]
```

If there are disqualifying gaps, decide consciously whether to proceed rather than hoping the resume hides them.

---

## Keyword Integrity: The Most Important Rule

**Keywords must be earned, not mirrored.**

Do not pattern-match JD language onto the resume unless you have genuinely done that work. Using a keyword just because it appears in the JD – without real backing – is embellishment. Recruiters and hiring managers who know the domain will catch it immediately and it destroys credibility faster than a gap does.

If a keyword fits legitimately, use it. If it doesn't fit, find the honest adjacent term or leave it out entirely.

### Common Honest Alternatives

| Avoid (if not directly done) | Honest Alternative |
|---|---|
| "Sponsored Ads" (Amazon product) | "advertiser-facing ad products" |
| "Identity Resolution" (if only consuming, not building) | "Addressability" or "audience identity systems" |
| "Clean Rooms" | "privacy-compliant data collaboration" |
| "UID2 / RampID" (specific products) | "privacy-preserving identity solutions" |
| "Retail Media" | omit unless explicitly applicable |
| "Measurement" as a primary skill | "attribution and conversion tracking" |

When in doubt: describe what you actually built and let the reader make the connection. Don't reach for the JD's vocabulary if it doesn't fit naturally.

---

## What Gets Customized Per JD

### 1. Summary (Highest Priority)
Rewrite for every JD. The summary should:
- Open with **seniority level and domain** matching the JD title
- Use **3–5 keywords from the JD** – only where you genuinely have that experience
- Include scale proof points (revenue owned, users served, system scale)
- Close with a cross-functional leadership line tuned to what the JD values
- Length: 4–5 sentences, one paragraph, no bullet points

**Seniority calibration:**

| JD Title Contains | Summary Opens With |
|---|---|
| Sr. Director / VP | "Sr. Director-level Product leader..." |
| Director | "Director-level Product leader..." |
| Principal PM | "Principal-level Product leader..." |
| Staff PM | "Staff-level Product leader..." |
| Senior PM | "Senior Product Manager..." |

### 2. Skills Bar (High Priority)
- 8 skills max, separated by `·`
- Mirror JD language **only where you genuinely have the skill**
- Order skills by relevance to the JD (most relevant first)
- Do not use product-specific terms you haven't worked on

### 3. Role Subtitles (Medium Priority)
One-line italic subtitle per role. Customize to frame the work for the specific JD. A role can read very differently to an identity-focused recruiter vs. an AI-focused one. The subtitle is where you set that frame.

### 4. Bullet Selection and Ordering (Medium Priority)
- Always lead each role with the most JD-relevant bullet
- Bullets should tell a coherent story aligned to the JD – don't just pick the highest-metric bullets, pick the most *relevant* ones
- Limit bullets per role to maintain one-page constraint

---

## Bullet Writing Formula

Every bullet must follow this structure:

**[Action verb phrase – the most impressive part]** + [context: what it was, who it served, what problem it solved] + [specific metric or outcome]

### Requirements for every bullet:
- Bold lead phrase captures the achievement, not the activity
- At least one specific metric (%, $, scale, time saved, users, accuracy rate)
- Written in past tense
- No soft language ("helped with," "supported," "contributed to")

### Strong vs. weak examples:

| Weak | Strong |
|---|---|
| "Worked on AI platform development" | **Built and launched agentic AI platform** used by 7,000+ users, reducing time-to-insight 40–60% |
| "Helped improve revenue" | **Drove $100M+ revenue growth** via search and mail retargeting; rebuilt ranking models driving 50% revenue increase |
| "Led compliance work" | **Led GDPR and CCPA compliance** across targeting and identity systems; designed consent-aware data pipelines |

---

## Technical Output Requirements

These are non-negotiable for professional quality:

- **Format:** `.docx` generated via Node.js `docx` library (not Google Docs export – formatting breaks)
- **Page:** US Letter (12240 x 15840 DXA)
- **Margins:** top/bottom 780 DXA, left/right 1008 DXA
- **Font:** Arial throughout
- **Job headers:** borderless two-column table (company + title left, date right-aligned) – never tab stops, they break in Google Docs
- **Bullet indents:** left 480 DXA, hanging 280 DXA
- **Bullets:** `LevelFormat.BULLET` with numbering config – never unicode bullet characters inline
- **Validate** with `validate.py` before delivering
- **PDF** preferred over docx for submissions – convert via LibreOffice

---

## Version Logging

Every time a resume is generated, log it:

```
Date: [YYYY-MM-DD]
Company: [company name]
Role: [job title]
JD Source: [URL or "text provided"]
Key customizations: [2–3 bullet summary of what changed]
Fit assessment: [Strong / Moderate / Stretch]
Cover letter generated: [Yes / No]
```

This matters when running multiple applications in parallel. You need to know exactly which version went where.

---

## Cover Letters

Only generate when explicitly needed. Rules:
- 3 paragraphs max, no longer than half a page
- **Paragraph 1:** Why this role and this company specifically – reference something concrete from the JD or company context
- **Paragraph 2:** The 1–2 most relevant proof points from your background, in plain language
- **Paragraph 3:** Short close – direct, no filler phrases
- Tone: confident and direct. No "I am excited to apply" or "I believe I would be a great fit"
- Never use em dashes

---

## Outreach Email Principles

Cold outreach emails are not resumes. Different rules apply:

- **Short, direct, low-friction** – 3–4 sentences maximum for cold intros
- **LinkedIn profile link preferred over resume attachment** for cold outreach – easier to consume, less presumptuous
- **Let the other party lead** – do not assume they are hiring or that you are qualified; open a door, don't walk through it uninvited
- **No filler phrases** – "I hope this finds you well," "I wanted to reach out," "I believe my background aligns" – all cut
- **Never use em dashes** – same rule as resume

---

## The Meta-Principle

The resume is not a record of your career. It is a targeted argument that you are the right person for this specific role. Everything on it should serve that argument. If something does not serve it – even if it is impressive in other contexts – cut it or deprioritize it.

Tailoring is not embellishment. It is focus. The keyword integrity rule is what keeps tailoring honest.
