# Integrations and Compliance

## 1. Purpose

This document defines the unified policy for all external service integrations in Pathfinder, including authentication, rate limiting, token handling, data freshness expectations, and fallback behavior. It ensures consistent, secure, and reliable interactions with all integrated services across the 11 HTML modules.

## 2. Integration Inventory

| Service | Module(s) | Auth Method | Rate Limits | Data Freshness | Fallback |
|---------|-----------|-------------|-------------|----------------|----------|
| Claude API | Research, Resume, Debrief, Outreach, Mock | API key (localStorage) | Per-plan (typically 40 RPM) | Real-time generation | Show error, suggest retry |
| Google Calendar API | Calendar, Sync Hub | OAuth 2.0 (via Sync Hub) | 500 requests/day (free tier) | Sync on page load + manual | Show "Calendar sync unavailable", use manual events |
| Gmail API | Sync Hub, Job Feed | OAuth 2.0 | 250 quota units/day | Scheduled sync (hourly) | Feed uses cached data, show "Last synced {time}" |
| Google Favicon API | All modules with logos | None (public) | No known limit | Structural (logos don't change often) | Letter circle fallback via `handleLogoError()` |
| Greenhouse API | Job Feed (enrichment) | None (public) | Unknown, treat as 60 RPM | On-demand per role | Skip, try next strategy |
| Lever API | Job Feed (enrichment) | None (public) | Unknown, treat as 60 RPM | On-demand per role | Skip, try next strategy |
| Ashby API | Job Feed (enrichment) | None (public) | Unknown, treat as 60 RPM | On-demand per role | Skip, try next strategy |
| DuckDuckGo HTML Search | Job Feed (enrichment) | None (public) | Unknown, be conservative (1.5s delay) | On-demand | Skip enrichment for that role |
| CORS Proxies (allorigins, corsproxy, codetabs) | Job Feed | None (public) | Varies | Real-time relay | Chain: try proxy 1, fallback to proxy 2, then proxy 3 |
| Levels.fyi | Comp Intelligence | Web scraping | Be conservative (max 5 RPM) | Cached per company | Show "Market data unavailable" |
| Indeed | Sync Hub, Comp | API or scraping | Per-plan | Sync on demand | Cached data with freshness indicator |
| Clay | Sync Hub (future) | API key | Per-plan | On-demand enrichment | Skip enrichment, show "Enrichment unavailable" |
| MCP HTTP Bridge | All modules (data sync) | None (localhost only) | No limit (local) | 1-second debounce | App works via localStorage alone |

## 3. Auth Token Handling Policy

- **API keys:** Anthropic API keys are stored exclusively in `pf_anthropic_key` localStorage variable — NEVER synced to MCP, NEVER exported to external systems, NEVER logged or transmitted in telemetry
- **OAuth tokens:** Managed by Sync Hub module with automatic refresh handling; if refresh fails, system prompts user to re-authenticate through the standard OAuth flow
- **Code security:** No credentials stored in source code or committed to version control; all secrets must be user-provided at runtime
- **Execution context:** All API calls originate from the browser; no server-side proxy for core functionality to minimize credential exposure vectors

## 4. Rate Limit Handling

- **Claude API:** Respect 429 Too Many Requests responses with exponential backoff (2s → 4s → 8s, maximum 3 retries)
- **ATS APIs:** Enforce 1.5 second delay between consecutive requests during batch enrichment operations
- **Google APIs:** Respect quota and rate limit headers in response; if quota exceeded, degrade gracefully to cached data
- **General rule:** If any external call fails 3 consecutive times, cease retry attempts, display user-friendly error message, and offer manual retry button

## 5. Data Freshness Policy

| Data Type | Refresh Interval | Staleness Warning | Auto-Refresh |
|-----------|-----------------|-------------------|--------------|
| JD text | Never auto-refreshes (job may be taken down) | ≥60 days | No |
| Company metadata | On-demand via enrichment | ≥90 days | No |
| Calendar events | On page load + hourly sync | ≥24h since last sync | Yes (Sync Hub) |
| Gmail leads | Hourly sync via scheduled task | ≥24h since last sync | Yes (scheduled) |
| Salary benchmarks | On-demand per company | ≥30 days | No |
| Feed scoring | On preference change | N/A (computed) | Yes (live) |

## 6. Compliance Notes

- **Data residency:** All data is stored locally on the user's machine; no cloud storage of personal data, job search history, or enrichment results
- **LinkedIn compliance:** Data import is sourced exclusively from user's own LinkedIn data export (GDPR-compliant personal data access mechanism)
- **Gmail access:** OAuth consent includes minimum required scopes (read-only for email parsing and lead extraction; no send/delete permissions)
- **Data sharing:** No user data is shared with third parties; all integrations fetch only public or user-authorized information
- **Data portability:** User retains ability to export all stored data via Sync Hub's export feature or MCP backup commands
