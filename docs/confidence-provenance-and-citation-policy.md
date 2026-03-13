# Confidence, Provenance, and Citation Policy

## 1. Purpose

This document establishes the canonical system-wide policy for how Pathfinder handles data quality assessment, tracks data origin and lineage, and attributes information through citations. It ensures transparency, trustworthiness, and auditability across all 11 modules and enables users to understand the reliability of every piece of information presented.

## 2. Confidence Levels

| Level | Meaning | When Used | Visual Indicator |
|-------|---------|-----------|-----------------|
| **High** | User-entered or structurally reliable data | Manual input, stage transitions, tracked connections | No indicator (default) |
| **Medium** | Machine-extracted or enriched data | JD extraction, company metadata from Clay/web, salary parsing | Subtle source badge |
| **Low** | Inferred or estimated data | Estimated total comp, AI-generated insights, pattern detection | "Estimated" label + tooltip |

## 3. Provenance Requirements by Data Type

For each data type, the following provenance metadata must be tracked and retained:

- **User-entered data:** `{ enteredBy: "user", enteredAt: ISO8601 }` — No additional provenance tracking required.

- **Feed-imported data:** `{ source: "linkedin-alert" | "indeed" | "gmail" | "manual-paste", importedAt: ISO8601, emailId?, url? }` — Must link back to source email thread or posting URL where applicable.

- **AI-generated content:** `{ model: "claude-opus-4-6", promptVersion: "v2.1", generatedAt: ISO8601, roleId, inputHash: SHA256 }` — Full generation metadata enabling reproducibility and audit trails.

- **Enriched data:** `{ source: "greenhouse-api" | "cors-proxy" | "duckduckgo" | "clay", fetchedAt: ISO8601, url, confidence: "high|medium|low" }` — Must include the URL fetched and confidence assessment.

- **Extracted data:** `{ method: "regex" | "json-ld" | "html-container" | "semantic-parse", extractedFrom: URL, extractedAt: ISO8601, confidence }` — Explicitly document extraction methodology and confidence.

## 4. Citation Policy for AI-Generated Content

- **Research Brief:** Every factual claim must cite its source (JD text, company profile, enrichment data, calendar event). Claims that cannot be sourced are prefixed with "Based on available information..." or marked as inference.

- **Resume Builder:** Every skill, accomplishment, and bullet point must map to a specific entry in the bullet bank or user-provided profile data. No invented content; if data is insufficient, note the gap rather than fabricate.

- **Outreach:** Every specific claim about the recipient (name, title, company, recent achievement) must cite its source. Unverified claims use hedging language ("appears to", "likely", "based on public information").

- **Debrief Synthesis:** Pattern-based claims must be grounded to a minimum of 3 independent debrief entries; single-observation claims are marked as preliminary.

## 5. Staleness Policy

| Data Age | Visual Treatment | User Action |
|----------|-----------------|-------------|
| Fresh (within threshold) | No indicator | None needed |
| Approaching stale (>70% of threshold) | Subtle clock icon | Optional refresh button displayed |
| Stale (past threshold) | Warning badge "Data may be outdated" | Suggested refresh offered |
| Very stale (>2x threshold) | Prominent warning panel | Prompted to refresh or explicitly acknowledge outdated data |

## 6. Display Rules

- **High-confidence data:** Display directly without qualification or visual modifier; full authority implied.

- **Medium-confidence data:** Display with subtle source badge (e.g., small "via Greenhouse" label in secondary color, positioned bottom-right of data element).

- **Low-confidence data:** Display with prominent "Estimated" or "Inferred" label followed by a tooltip explaining the methodology (e.g., "Estimated based on industry benchmarks and company size").

- **Unknown or missing data:** Display "Not available" in muted text color; never leave fields blank or omit data rows without explanation.

- **Multi-source data:** If a single display item aggregates multiple sources, show "Multiple sources" badge with a collapsible detail view listing each source and its confidence.

## 7. Audit Trail Requirements

- All data transformations (extraction, enrichment, AI processing) must be reversible to the original source.
- Confidence assignments must be logged with justification (e.g., "set to Medium: regex extraction from unstructured text").
- Citation references must be stored with sufficient context to survive minor edits (e.g., preserve line number and surrounding text snippet, not just URL).
- User-initiated corrections override system confidence; corrections are logged as `{ userCorrectedAt, originalValue, newValue, reason? }`.
