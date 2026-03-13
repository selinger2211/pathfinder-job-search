# Pathfinder Architecture Decisions and System Invariants

## 1. Purpose

This document records the key architectural decisions made in building Pathfinder, an 11-module agentic job search system, and codifies the critical system invariants that must hold true at all times. It serves as the canonical reference for understanding why the system is structured as it is, what trade-offs were accepted, and what guarantees the system makes to its modules and users. This is reference-quality documentation for systems design interviews, future maintainers, and anyone extending the platform.

---

## 2. Architecture Decision Records

### ADR-001: Standalone HTML Modules (No Framework)

**Decision:** Each module is a single `index.html` file with inline CSS and JavaScript. No build step, no bundler, no framework.

**Context:**
- System built as a rapid prototype and portfolio piece demonstrating systems thinking
- Must be explainable and defendable in a systems design interview
- Zero operational overhead when sharing or demoing

**Alternatives Considered:**
- React SPA with client-side routing
- Next.js or Nuxt for SSR
- Svelte for compiled reactivity
- Web framework (Vue, Angular)

**Why Rejected:**
- Build step adds deployment complexity and obscures the core logic
- SPA's centralized routing and bundle system contradicts the goal of module independence
- Frameworks abstract away architectural decisions that should be visible and intentional
- Each module must work independently, even if served from different directories
- No server exists, so framework-driven SSR is not applicable
- Single-file modules are maximally transparent and portable

**Trade-offs:**
- **Code duplication:** Navigation bars, helper utilities, CSS tokens are copy-pasted across modules
- **No shared components:** UI patterns (buttons, cards, modals) are duplicated rather than imported
- **Larger individual files:** Each module bundles everything it needs; no code splitting
- **Manual updates:** When shared logic changes (e.g., localStorage key names), all 11 files must be updated
- **No tree-shaking:** Unused code cannot be eliminated per-module

**Mitigation:**
- Bulk-find-and-replace tooling for synchronized updates across modules
- Consistent, copy-pasteable patterns (nav bar, data-layer imports, CSS boilerplate)
- Regular audits to identify genuine shared logic candidates for library extraction

**Status:** Accepted. This decision is unlikely to change unless the system scales beyond 20+ modules or requires a server backend.

---

### ADR-002: localStorage as Primary Data Layer

**Decision:** All structured data is stored in `localStorage` under `pf_*` keys. Each key is a serialized JSON value. localStorage is synchronous, universal, and the single source of truth during a session.

**Context:**
- Need cross-module data sharing without a server backend
- Modules run as independent static files
- Data must survive page refreshes and navigation between modules
- System is single-user (personal job search tool)

**Alternatives Considered:**
- IndexedDB for all data (large and small)
- SQLite compiled to WASM
- Server-backed database (Firebase, PostgreSQL)
- Decentralized storage (IPFS, git)

**Why Chosen:**
- **Synchronous reads:** No async/await boilerplate; `JSON.parse(localStorage.getItem('pf_key'))` is immediate
- **Universal browser support:** Works in all modern and legacy browsers; no polyfills needed
- **Simple key-value model:** Maps naturally to the data model (pipeline, contacts, settings)
- **Native scoping:** Automatically scoped per origin; no manual namespace conflicts
- **Developer UX:** Browser DevTools show all keys in Application → Storage → Local Storage; easy to inspect and debug

**Trade-offs:**
- **Storage quota:** ~5-10 MB total per origin; approaches limit with thousands of roles + companies
- **No querying:** Retrieving "all roles in Stage X" requires full-scan iteration; no indices
- **No transactions:** Multiple writes are not atomic; app crash during multi-step updates can leave inconsistent state
- **Data loss on browser clear:** If user runs "Clear all site data," all localStorage is lost
- **Synchronous blocking:** Large JSON stringifications can stall the UI thread
- **No compression:** JSON serialization is verbose; binary data cannot be stored directly

**Mitigation:**
- MCP bridge provides persistence and backup (see ADR-003)
- IndexedDB used for large binary blobs (PDFs, DOCX files) where localStorage is insufficient
- Data-layer wrapper (`data-layer.js`) batches writes and implements debounced MCP sync
- Backups at `~/.pathfinder/backups/` provide recovery from data loss
- Careful schema design to minimize per-key size

**Status:** Accepted. This is the right choice for a single-user, offline-first prototype. If the system were to scale to multi-user or require complex queries, a database backend would be reconsidered.

---

### ADR-003: MCP as Integration & Persistence Layer

**Decision:** An MCP HTTP bridge runs on `localhost:3456` and provides three roles:
1. **Persistence:** Reads and writes persistent copies of localStorage keys to `~/.pathfinder/data/{key}.json`
2. **Backup:** On every write, creates timestamped snapshots in `~/.pathfinder/backups/`
3. **File storage:** Provides tools for storing research briefs, generated artifacts, and other text files in the MCP filesystem

**Context:**
- localStorage is volatile and can be cleared by the user
- No cloud backend exists
- Need a way to survive browser data loss and provide audit trails
- Claude API calls already require MCP integration for tool use

**Alternatives Considered:**
- Cloud database (Firebase, Supabase)
- Local SQLite with Node.js API
- Filesystem-only persistence (no structured interface)
- No persistence (localStorage only)

**Why Chosen:**
- **Claude-native integration:** MCP is the standard protocol for Claude to interact with systems; using it here aligns Pathfinder with Claude's ecosystem
- **Structured tool interface:** MCP tools provide a clean way for Claude agents to read/write data without bypassing the app logic
- **Local-first:** Runs on the user's machine; no cloud dependencies, no privacy concerns, no vendor lock-in
- **Extensible:** New tools can be added to the MCP server without changing the browser code (e.g., integration with LinkedIn API, email clients)
- **Graceful degradation:** If the bridge is down, the app still works via localStorage; MCP sync is a bonus, not a requirement

**Trade-offs:**
- **Operational complexity:** Requires a separate Node.js process; adds setup steps and debugging surface
- **Not available on mobile:** Mobile users cannot use MCP features
- **Network latency:** Syncing to MCP adds ~100-500 ms per write; perceived responsiveness is lower than pure localStorage
- **Dual write problem:** Data in localStorage can diverge from MCP if sync fails; reconciliation logic needed
- **Requires networking knowledge:** Debugging requires understanding HTTP, JSON, and process management

**Mitigation:**
- MCP bridge is started automatically (or included in setup scripts)
- Data-layer wrapper hides HTTP details behind localStorage-like interface
- Conflict resolution: MCP writes are idempotent; last-write-wins semantics
- Error logging: sync failures are logged but do not block the UI

**Status:** Accepted. MCP is the right integration point for a Claude-centric system. If the user does not run the MCP bridge, the system degrades gracefully.

---

### ADR-004: Direct Browser-to-Claude API Calls

**Decision:** Claude API is called directly from browser JavaScript using the `anthropic-dangerous-direct-browser-access` header. No proxy server exists. API calls are made from `modules/shared/claude-api.js`.

**Context:**
- Modules need AI-driven generation: research briefs, resume customizations, email templates, company analyses
- No backend server is available or desired
- Single-user system with sole operator
- Prototyping speed is valued over perfect security

**Alternatives Considered:**
- Proxy server (Express, Django) to mediate API calls
- Claude API integration via MCP tools (tools called by Claude, not vice versa)
- Pre-computed static content (no AI generation)

**Why Chosen:**
- **Zero server infrastructure:** Reduces deployment complexity; no additional process to manage
- **Latency:** Direct API call is faster than routing through a proxy
- **Simplicity:** JavaScript SDK can be used as-is; no custom proxy logic needed
- **Portfolio demonstration:** Shows comfort with direct API integration and browser security trade-offs

**Trade-offs:**
- **API key visibility:** Key is stored in `pf_anthropic_key` (localStorage) and is visible in browser DevTools and network tabs
- **CORS restrictions:** Some endpoints may have CORS requirements; requests from `file://` origins may be rejected
- **No request signing:** Browser cannot prove authenticity of requests; key is visible in transit
- **Streaming limitations:** Some browsers limit streaming responses from browser-initiated requests
- **Rate limiting:** All API calls are attributed to the user's account; no per-module or per-feature rate limiting
- **No audit trail:** API logs do not show which module made the call (all calls appear to come from the browser)

**Mitigation:**
- **API key security:** Key is stored only in localStorage; not synced to MCP, not exported, not logged
- **User responsibility:** System is designed for personal use; the user is the sole party with access to the API key
- **Https everywhere:** All API calls use HTTPS; keys are encrypted in transit
- **Development guidance:** Documentation warns against sharing the system with untrusted users
- **Key rotation:** User can rotate the key in settings; old key is immediately deleted from localStorage

**Status:** Accepted for single-user systems. This approach would not scale to multi-user deployments (the API key would need to be moved to a backend and kept out of the browser entirely).

---

### ADR-005: Copy-Paste Module Navigation

**Decision:** The navigation bar HTML is duplicated in each module's `index.html`. There is no shared navigation component, no JavaScript router, and no template system.

**Context:**
- Modules are standalone; each must include all its UI dependencies
- Navigation must work even if only one module's HTML file is opened
- Consistency in navigation order and styling is important

**Alternatives Considered:**
- Shared JavaScript component loaded via `<script src="../shared/nav.js"></script>`
- HTML template with CSS-in-JS navigation builder
- Web components (custom elements)
- IFrame injected nav
- Client-side SPA router with dynamic nav rendering

**Why Rejected:**
- **Shared JS component:** Couples modules to a shared dependency; breaks if shared file is missing
- **Template system:** Adds build or runtime complexity; contradicts ADR-001
- **Web components:** Overkill for a simple nav bar; still requires shared code
- **IFrame:** Adds complexity, cross-origin issues, harder to style
- **SPA router:** Centralized routing contradicts module independence

**Why Chosen:**
- **Zero dependencies:** Each module's nav bar is self-contained in its HTML file
- **Visibility:** Navigation logic is transparent and easy to audit
- **Resilience:** A single shared nav file cannot break all modules simultaneously
- **Debug-friendly:** DevTools shows complete HTML; no hidden component generation

**Trade-offs:**
- **Manual synchronization:** When nav order changes, all 11 `index.html` files must be updated
- **Code duplication:** 11 copies of the same 30-50 line HTML snippet
- **Inconsistency risk:** If one file is not updated, that module's nav will be out of sync
- **Maintenance burden:** Scaling to 20+ modules makes synchronization painful

**Mitigation:**
- Standardized nav HTML snippet in `modules/SHARED_NAV_TEMPLATE.html` for copy-paste
- Bulk-edit tooling (search-and-replace, regex) for synchronized updates across all modules
- Pre-commit hooks to detect nav mismatches across modules
- Regular audits to catch inconsistencies

**Status:** Accepted. This is pragmatic for 11 modules. If the system grows to 20+ modules, a shared component system would be reconsidered.

---

### ADR-006: Google Favicon API for Company Logos

**Decision:** Company logos are retrieved via `https://google.com/s2/favicons?domain={domain}&sz=128` with a fallback to a colored letter circle generated via CSS.

**Context:**
- Modules display company logos throughout the UI (pipeline, research, company cards)
- No company logo database or API key is available
- Logos must load quickly and cover diverse companies
- Fallback must be generic and accessible

**Alternatives Considered:**
- Company-specific API (Clearbit, Hunter.io)
- Stored logo library (SVG sprites)
- Unicode emoji as fallback
- Generic icon (briefcase, building)

**Why Chosen:**
- **No API key required:** Google's favicon API is public and free
- **High coverage:** Works for ~90% of companies; consistent and automatic
- **Cached by CDN:** Fast delivery via Google's infrastructure
- **Size specification:** `sz=128` provides high-DPI support
- **Simple fallback:** Colored letter circles are visually distinctive and don't require external assets

**Trade-offs:**
- **Dependency on Google:** System cannot function offline (for logo loading)
- **Privacy:** Google can see which companies the user is researching
- **Accuracy:** Some companies have branded logos that do not match their domain; generic icons returned
- **Domain requirement:** Must know the company's domain; company names alone don't work
- **Fallback visibility:** If the favicon API is slow or fails, the letter circle may flash briefly

**Mitigation:**
- **DOMAIN_OVERRIDES map:** Hardcoded domain corrections for tricky company names (e.g., "Y Combinator" → "ycombinator.com")
- **getCompanyDomain() function:** Extracts domain from company websites, email domains, or LinkedIn URLs
- **Colored letter circles:** CSS-based; guaranteed to render even if favicon API is down
- **getCompanyColor() function:** Deterministic color mapping based on company name (same company always gets same color)
- **handleLogoError() function:** Graceful fallback if favicon fails to load
- **Lazy loading:** Logos are loaded on-demand, not preloaded for all companies

**Status:** Accepted. This is a pragmatic, cost-free solution for a prototype. A production system would integrate a paid logo service or maintain a local logo library.

---

## 3. System Invariants

System invariants are properties that must always be true. If any invariant is violated, the system is in an inconsistent state and behavior becomes undefined. Each invariant is critical to the correctness of the application.

### Invariant 1: Pipeline is the Single Source of Truth for Roles and Companies

**The Invariant:**
All role and company data is authoritative in `pf_pipeline` (localStorage key). Any other representation of roles or companies (views, searches, displays) must be derived from `pf_pipeline` via filtering, sorting, or joining with other keys. No role or company can exist in any other data structure without also existing in `pf_pipeline`.

**Why It Matters:**
- **Consistency:** If roles exist in multiple places, they can diverge; which version is correct becomes ambiguous
- **Single update point:** All modules can trust that updating `pf_pipeline` is sufficient to update the system state
- **Query correctness:** Searches and filters operate on a known, complete dataset
- **Debugging:** When data seems wrong, there is one place to inspect and fix it

**What Breaks If Violated:**
- Modules may display contradictory or stale role information
- Deleting a role from `pf_pipeline` but not from a view's local array can cause zombie roles to reappear
- Searches may miss roles or return duplicates
- AI-driven modules may operate on incomplete or contradictory information about the job market

**Enforcement:**
- Every `CREATE` operation appends to `pf_pipeline`
- Every `DELETE` operation removes from `pf_pipeline` and cascades to dependent keys
- Views (e.g., `pf_saved_drafts`) store only role IDs, not full role copies
- `UPDATE` operations modify `pf_pipeline` directly; no shadow copies

---

### Invariant 2: All `pf_*` localStorage Keys Sync to MCP Within 1 Second (When Bridge Available)

**The Invariant:**
Whenever a `pf_*` key is written in localStorage, `data-layer.js` monitors the write and triggers an HTTP request to the MCP bridge within 1 second. The MCP bridge persists the value to `~/.pathfinder/data/{key}.json`. If the bridge is unavailable, the write succeeds in localStorage but an error is logged; subsequent writes may re-attempt the sync.

**Why It Matters:**
- **Persistence:** Without MCP sync, data is lost if the user closes the browser or clears site data
- **Audit trail:** Timestamped MCP files provide a record of changes
- **Recovery:** Backups at `~/.pathfinder/backups/` allow the user to revert to prior states
- **Trust:** Users can see that data is being persisted, not just kept in volatile memory

**What Breaks If Violated:**
- Data loss: If a user closes the browser without MCP syncing, changes are lost
- Inconsistent backups: Backup snapshots do not include recent writes
- Audit trail gaps: Changes cannot be traced after the fact
- User data loss: Critical information (contact details, application status) disappears

**Enforcement:**
- `data-layer.js` wraps `localStorage.setItem()` with debounced MCP sync logic
- Sync failure is logged but does not throw (graceful degradation)
- Debounce window is 100-300 ms to batch consecutive writes
- Hard deadline: if debounce expires, sync is triggered immediately
- Bridge unavailable: app continues to work; sync is retried on next write

**Monitoring:**
- Check browser DevTools → Network tab for POST requests to `localhost:3456/api/set-key`
- Check `~/.pathfinder/data/` for recent `{key}.json` files
- Check browser console for `[Pathfinder MCP]` log messages

---

### Invariant 3: Every Module Can Function with localStorage Alone (MCP is Optional)

**The Invariant:**
A module must be usable with the MCP bridge unavailable or disabled. Writing to localStorage succeeds; reading from localStorage succeeds. The MCP bridge is an optional enhancement that provides persistence and backup, not a required dependency.

**Why It Matters:**
- **Resilience:** If the Node.js MCP process crashes, the app remains usable
- **Offline operation:** Modules work even if the MCP bridge cannot be reached (network down, bridge not started)
- **Development:** Developers can test modules without running the full infrastructure
- **Portability:** The app can be deployed in environments where running MCP is not feasible (mobile, cloud sandbox)

**What Breaks If Violated:**
- User cannot use the system if MCP is down
- Perceived reliability is low; every network hiccup breaks the app
- Debugging becomes impossible; cannot test without full infrastructure
- System is not suitable for offline scenarios

**Enforcement:**
- All MCP operations are wrapped in try-catch blocks
- Sync failures do not throw; errors are logged to console only
- Data-layer fallback: if MCP request fails, localStorage read/write still succeeds
- No module code should contain `fetch()` or HTTP calls that are not error-wrapped
- Test suite includes "MCP down" scenarios

**Verification:**
- Stop the MCP bridge: `pkill -f "mcp server"` or `Ctrl+C` in the Node.js process
- Reload the module: it should continue to work, reading/writing to localStorage
- Create new role, add company, stage role: all operations should succeed
- Restart MCP bridge: synced data should be found in `~/.pathfinder/data/`

---

### Invariant 4: API Key (`pf_anthropic_key`) is NEVER Synced to MCP or Exported

**The Invariant:**
The `pf_anthropic_key` key in localStorage is excluded from MCP sync. It is never written to `~/.pathfinder/data/pf_anthropic_key.json`. It is never logged, exported, or sent outside the browser process. If the user exports data or backs up to a file, the API key is explicitly omitted.

**Why It Matters:**
- **Security:** The API key is the credential for Claude API calls; exposing it allows an attacker to make calls on the user's behalf and incur charges
- **Privacy:** The API key identifies the user and their API usage; storing it in plaintext files exposes this information
- **Compliance:** Many security frameworks (SOC 2, HIPAA) require that credentials never be stored in plaintext on disk
- **Trust:** Users must trust that their credentials are protected

**What Breaks If Violated:**
- Leaked API key: anyone with access to `~/.pathfinder/data/` can impersonate the user
- Unauthorized API usage: attacker can make expensive AI calls on the user's account
- Credential exposure: backups and exports contain the API key, which can be found via git history or file recovery
- Compliance violation: system fails security audits

**Enforcement:**
- `data-layer.js` explicitly excludes `pf_anthropic_key` from MCP sync
- Export logic filters out `pf_anthropic_key` before writing to file
- Backup logic in MCP server excludes `pf_anthropic_key` from timestamped snapshots
- Code review: every `setItem()` call must verify that `pf_anthropic_key` is not accidentally synced
- Test: exporting data and verifying the exported file does not contain the API key

**Verification:**
- Inspect `~/.pathfinder/data/pf_anthropic_key.json`: file should NOT exist
- Run `grep -r "pf_anthropic_key" ~/.pathfinder/backups/`: should return nothing
- Export data via UI: exported JSON should not contain the API key

---

### Invariant 5: Every Role Has a Unique `id` (Format: `role-{timestamp}`)

**The Invariant:**
Every role object in `pf_pipeline` has a unique `id` field formatted as `role-{millisecond-timestamp}`, e.g., `role-1710429123456`. No two roles share the same ID. The ID is immutable and assigned at role creation time.

**Why It Matters:**
- **Unique identity:** Roles are indexed and referenced by ID; without unique IDs, updates and deletions become ambiguous
- **Determinism:** Timestamp-based IDs are deterministic and sortable; debugging is easier than random UUIDs
- **Collision prevention:** Millisecond granularity prevents ID collisions even in rapid-fire role creation
- **Minimal overhead:** Timestamps are smaller and faster than UUIDs; serialization is efficient

**What Breaks If Violated:**
- Duplicate IDs: updating one role accidentally updates another
- Orphaned references: views store role IDs; if IDs are not unique, the wrong role is displayed
- Sorting and filtering: ID-based sorting becomes incorrect
- Persistence: MCP sync assumes IDs are unique; duplicate IDs cause race conditions

**Enforcement:**
- Role creation function: `generateRoleId()` returns `'role-' + Date.now()`
- Validation: on pipeline load, check that all role IDs are unique; log a warning if duplicates are found
- Never allow ID reassignment; ID is read-only after creation
- Test: create roles in rapid succession (same millisecond) and verify IDs are still unique (use `Date.now() + Math.random()` if necessary)

**Verification:**
```javascript
const pipeline = JSON.parse(localStorage.getItem('pf_pipeline'));
const ids = pipeline.roles.map(r => r.id);
const unique = new Set(ids);
console.assert(ids.length === unique.size, 'Duplicate role IDs detected');
```

---

### Invariant 6: Companies are Identified by `name` (String), Not by ID

**The Invariant:**
Companies in the system are uniquely identified by their `name` field (a string like "Anthropic" or "Y Combinator"). There is no separate `company_id`. When a role references a company, it stores the company name, not an ID. If two roles reference the same company name, they are referring to the same company.

**Why It Matters:**
- **Simplicity:** No need to manage an ID space or ID assignment logic
- **Human-readable:** Debugging and manual inspection of data is straightforward
- **Merge safety:** If a user types "Anthropic" and "anthropic", the system treats them as different companies (this is a feature, not a bug; user is responsible for consistency)
- **No orphaning:** If a company is deleted, all roles referring to it remain valid (company name string is still there)

**What Breaks If Violated:**
- Undefined company references: if companies are deleted, role company IDs become invalid pointers
- ID assignment complexity: need a separate ID generation system for companies
- Inconsistent displays: roles show company ID instead of human-readable name
- Joins become complex: querying "all roles at Anthropic" requires a company lookup table

**Enforcement:**
- Role schema: `{ company: "Anthropic" }` (string), not `{ company_id: 42 }`
- Company operations: adding a company means adding a unique company name to `pf_companies`
- Deletion: deleting a company does NOT delete roles; those roles retain the company name as a string
- Validation: when creating a role, the company name is stored directly; no ID lookup happens

**Verification:**
```javascript
const pipeline = JSON.parse(localStorage.getItem('pf_pipeline'));
pipeline.roles.forEach(role => {
  console.assert(typeof role.company === 'string', `Role ${role.id} has non-string company`);
});
```

---

### Invariant 7: Stage Transitions are Append-Only in `stageHistory[]`

**The Invariant:**
Each role has a `stageHistory` array. Whenever a role's stage is changed, a new entry is appended to `stageHistory`; no entry is ever deleted or modified. The current stage is always the last entry in the history. The history is an immutable, ordered log of all stage transitions.

**Why It Matters:**
- **Audit trail:** History shows when and how the role transitioned through stages
- **Trend analysis:** The system can answer questions like "how long does it take to go from Apply to Interview?"
- **Recovery:** If a stage change was accidental, the history shows the prior state
- **Debugging:** When a role is in an unexpected stage, history reveals how it got there
- **Analytics:** Future modules can analyze stage transitions to improve recommendations

**What Breaks If Violated:**
- Lost history: if entries are deleted, the audit trail is incomplete
- Incorrect current stage: if an entry is modified, the current state becomes ambiguous
- Corrupted timeline: if entries are reordered, the sequence of events is lost
- Misleading analytics: stage transition times become meaningless

**Enforcement:**
- Stage change function: create a new history entry, do NOT modify existing entries
- Immutability: `stageHistory` is never spliced, shifted, or popped; only pushed
- Schema: each history entry includes `{ from, to, timestamp, notes? }`
- Validation: on pipeline load, verify that stage history is sorted by timestamp and matches the current stage

**Verification:**
```javascript
const pipeline = JSON.parse(localStorage.getItem('pf_pipeline'));
pipeline.roles.forEach(role => {
  const history = role.stageHistory;
  for (let i = 1; i < history.length; i++) {
    console.assert(history[i].timestamp >= history[i-1].timestamp, 'Stage history is not chronological');
  }
  const currentStage = history[history.length - 1]?.to;
  console.assert(currentStage === role.stage, `Role ${role.id} stage doesn't match history`);
});
```

---

### Invariant 8: UI-Only Keys (Theme, View Mode) are NOT Synced to MCP

**The Invariant:**
Certain localStorage keys are purely UI preferences and are never synced to MCP. These include:
- `pf_theme` (dark/light mode)
- `pf_sort_mode` (how to sort the pipeline view)
- `pf_view_mode` (list/kanban view)
- `pf_sidebar_collapsed` (UI state)
- Any key prefixed with `_ui_` or `_local_`

These keys do not have persistent copies in `~/.pathfinder/data/`.

**Why It Matters:**
- **Privacy:** UI preferences are personal and not backed up; the user can change them without worrying about persistence
- **Sync performance:** Excluding UI keys reduces the amount of data synced to MCP; faster updates
- **Clean backups:** Backups contain only meaningful data, not transient UI state
- **Portability:** If the user exports data to share with someone else, UI preferences are not included

**What Breaks If Violated:**
- UI state persists across devices: user's dark mode setting on laptop syncs to desktop, which is undesired
- Backup bloat: frequent UI state changes trigger many MCP writes
- Confusing exports: exported data includes irrelevant UI settings
- Larger sync payload: every UI toggle triggers a network request

**Enforcement:**
- `data-layer.js` checks the key name before syncing; keys starting with `_` or in a UI_KEYS set are excluded
- Explicit list: `UI_KEYS = ['pf_theme', 'pf_sort_mode', 'pf_view_mode', 'pf_sidebar_collapsed']`
- Code review: new UI state keys must be explicitly marked as non-synced
- Test: verify that changing theme or view mode does not create new files in `~/.pathfinder/data/`

**Verification:**
```javascript
const uiKeys = Object.keys(localStorage).filter(k => k.startsWith('pf_'));
const dataDirFiles = fs.readdirSync(path.expanduser('~/.pathfinder/data'));
uiKeys.forEach(key => {
  console.assert(!dataDirFiles.includes(`${key}.json`), `UI key ${key} was synced to MCP`);
});
```

---

### Invariant 9: All Modules Share the Same CSS Variable Tokens for Consistent Theming

**The Invariant:**
All modules reference CSS variables defined in a shared palette (e.g., `--color-primary`, `--color-bg`, `--font-family-mono`). No module uses hardcoded colors or typography. The variables are defined in a `modules/shared/variables.css` file or inline in each module's `<style>` tag, but the values are identical across all modules.

**Why It Matters:**
- **Visual consistency:** Users see the same colors and fonts across all modules; the system feels cohesive
- **Theme switching:** When the user changes the theme, all modules update in sync
- **Maintenance:** Changing brand colors or fonts is a single edit, not 11 edits
- **Accessibility:** CSS variables can be used to enforce contrast ratios and font sizes

**What Breaks If Violated:**
- Inconsistent UI: some modules are dark, others are light
- Theme switching fails: one module updates theme but others don't
- Maintenance nightmare: updating brand colors requires editing all files
- Accessibility issues: no centralized way to enforce color contrast

**Enforcement:**
- Shared variables file: `modules/shared/variables.css` defines all theme tokens
- Module imports: each `index.html` includes `<link rel="stylesheet" href="../shared/variables.css">`
- Code review: no hardcoded colors like `#FF0000` or `rgb(255, 0, 0)` in module CSS; all colors use variables
- Test: change `--color-primary` and verify all modules update visually
- Build time: pre-commit hook checks for hardcoded colors in module CSS files

**Verification:**
```css
/* modules/shared/variables.css */
:root {
  --color-primary: #007bff;
  --color-secondary: #6c757d;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-text-primary: #212529;
  --color-text-secondary: #6c757d;
  --font-family-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-family-mono: "Courier New", Courier, monospace;
}

/* Each module uses these variables, never hardcoded colors */
.button {
  background-color: var(--color-primary);
  color: var(--color-bg-primary);
  font-family: var(--font-family-sans);
}
```

---

### Invariant 10: Company Logos Follow the Canonical Logo Pattern

**The Invariant:**
When displaying a company logo, the system follows this deterministic fallback chain:
1. Check `DOMAIN_OVERRIDES[company_name]` for a hardcoded domain
2. Call `getCompanyDomain(company_name, role.companyUrl, role.companyEmail)` to extract/infer the domain
3. Fetch `https://google.com/s2/favicons?domain={domain}&sz=128`
4. If favicon fails or is generic, generate a colored letter circle via CSS using `getCompanyColor(company_name)` and the company's first letter

Every company always shows a logo (never missing/broken); colors are deterministic (same company always gets the same color).

**Why It Matters:**
- **Visual consistency:** Users see the same logo for the same company across all views
- **Offline fallback:** If the favicon API is down, colored circles still render
- **Performance:** Deterministic colors mean no per-render computation
- **Accessibility:** Colored backgrounds ensure sufficient contrast for text
- **User experience:** No broken image icons; every company is visually represented

**What Breaks If Violated:**
- Inconsistent logos: Anthropic shows different logos in different modules
- Missing logos: some companies display broken image icons
- Non-deterministic colors: same company has different colors on page reload
- Accessibility issues: text on logo background has poor contrast

**Enforcement:**
- Logo rendering function: strictly follows the fallback chain
- DOMAIN_OVERRIDES: hardcoded for ~30 tricky company names
- getCompanyDomain(): robust extraction from URLs and email domains
- getCompanyColor(): deterministic hash of company name → color
- handleLogoError(): fallback to letter circle if favicon fails
- Test: render logos for 100 companies and verify no broken images; verify determinism by reloading

**Verification:**
```javascript
// Render a company logo for "Anthropic"
const logoUrl = getCompanyLogoUrl('Anthropic');
// Expected: https://google.com/s2/favicons?domain=anthropic.com&sz=128

const logoUrl2 = getCompanyLogoUrl('Anthropic');
// Expected: same URL (deterministic)

const color = getCompanyColor('Anthropic');
// Expected: same color every time (deterministic hash)

// If favicon fails, handleLogoError() renders a letter circle
// <div style="background: #007bff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">A</div>
```

---

## 4. Data Flow Diagram

### 4.1 Write Flow (User Creates/Updates Role)

```
┌─────────────────────────────────────────────────────────────────┐
│ User Action (in Module)                                         │
│  - Click "Add Role" → form fills → submit                       │
│  - Click "Stage Change" → select new stage → confirm            │
│  - Edit company notes → type → blur                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Module JavaScript (in browser)                                  │
│  - Create/update role object                                    │
│  - Call dataLayer.setPipeline(roles) or dataLayer.set()         │
│  - UI reflects change immediately (optimistic update)           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ data-layer.js (in browser)                                      │
│  - Intercept setItem() call                                     │
│  - Validate data (schema check, invariant checks)               │
│  - Call localStorage.setItem('pf_pipeline', JSON.stringify(...))│
│  - If key is 'pf_anthropic_key': SKIP MCP sync (Invariant 4)   │
│  - Otherwise: debounce MCP sync (queue for later)               │
│  - Return immediately (sync is async)                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
           ┌─────────┴──────────┐
           │                    │
           ▼ (immediate)        ▼ (debounced, ~100-300ms)
   ┌──────────────────┐   ┌─────────────────────────────┐
   │ localStorage     │   │ HTTP Bridge Request         │
   │ (sync, local)    │   │ (async, fallible)           │
   │                  │   │                             │
   │ pf_pipeline      │   │ POST /api/set-key           │
   │ pf_companies     │   │ body: {                     │
   │ pf_contacts      │   │   key: 'pf_pipeline',       │
   │ ...              │   │   value: {...full JSON...}  │
   │                  │   │ }                           │
   │ (data is here    │   │                             │
   │  immediately)    │   │ (retry on failure)          │
   └──────────────────┘   └────────────┬────────────────┘
                                       │
                                       ▼ (on success)
                    ┌──────────────────────────────────────┐
                    │ MCP Server (Node.js)                 │
                    │ localhost:3456                       │
                    │                                      │
                    │ Handle POST /api/set-key             │
                    │  - Receive key and value             │
                    │  - Validate (no pf_anthropic_key)    │
                    │  - Write to disk                     │
                    └────────────────┬─────────────────────┘
                                     │
                    ┌────────────────┴─────────────────────┐
                    │                                      │
                    ▼ (primary data)     ▼ (audit trail)
        ┌──────────────────────┐  ┌─────────────────────┐
        │ ~/.pathfinder/data   │  │ ~/.pathfinder/      │
        │                      │  │ backups/            │
        │ pf_pipeline.json     │  │                     │
        │ pf_companies.json    │  │ 2026-03-13_         │
        │ pf_contacts.json     │  │ 14-30-45.tar.gz     │
        │ ...                  │  │ (full snapshot)     │
        │ (JSON files, one per │  │                     │
        │  localStorage key)   │  │ (timestamped,       │
        │                      │  │  compressed)        │
        │ [NOT pf_anthropic_   │  │                     │
        │  key]                │  │ [NOT pf_anthropic_  │
        │                      │  │  key]               │
        └──────────────────────┘  └─────────────────────┘
```

### 4.2 Read Flow (User Views Pipeline)

```
┌─────────────────────────────────────────────────────────────────┐
│ User Action (in Module)                                         │
│  - Navigate to pipeline module                                  │
│  - Module loads                                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Module JavaScript (in browser)                                  │
│  - Call dataLayer.getPipeline() or dataLayer.get('pf_pipeline')│
│  - Request goes to data-layer.js                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ data-layer.js (in browser)                                      │
│  - Check if key exists in localStorage                          │
│  - If found: return immediately (sync read, <1ms)               │
│  - If not found: (rare on init) fetch from MCP bridge           │
│  - Parse JSON and return parsed object                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Module JavaScript receives data                                 │
│  - Iterate roles, render UI                                    │
│  - Sort, filter, group by stage                                 │
│  - Display to user                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Initialization Flow (App Start-Up)

```
┌──────────────────────────────────────┐
│ User opens module (e.g., pipeline)   │
│ Browser loads index.html             │
└────────────────┬──────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ index.html loads   │
        │                    │
        │ <script src="../   │
        │  shared/data-      │
        │  layer.js"></script>
        │                    │
        │ Module JS runs     │
        └────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │ data-layer.js initializes      │
    │                                │
    │ On first access:               │
    │  1. Check localStorage for key │
    │  2. If empty AND MCP available │
    │     → Fetch from MCP bridge    │
    │        GET /api/get-key        │
    │     → Cache in localStorage    │
    │  3. If MCP unavailable         │
    │     → Use empty/default state  │
    │                                │
    │ localStorage is now the        │
    │ source of truth for this app   │
    │ instance                       │
    └────────────────────────────────┘
```

### 4.4 Multi-Module Data Consistency

When multiple modules are open in different tabs/windows:

```
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ Tab 1: Pipeline Module       │      │ Tab 2: Research Module       │
│                              │      │                              │
│ User stages a role:          │      │ User is viewing roles        │
│  - Calls setPipeline(roles)  │      │ (reads pf_pipeline)          │
│  - Updates localStorage      │      │                              │
│  - Debounced MCP sync        │      │                              │
│    queued                    │      │                              │
└────────────┬─────────────────┘      └──────────────────────────────┘
             │
             │ (localStorage is per-origin, SHARED across same-origin tabs)
             │
             ▼
    ┌──────────────────────────┐
    │ localStorage             │
    │ pf_pipeline updated      │
    │ (visible to both tabs)   │
    │                          │
    │ Tab 2 can see the update │
    │ immediately (cross-tab   │
    │ communication via        │
    │ storage event or polling)│
    └─────────────┬────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ MCP Bridge (async) │
         │                    │
         │ Tab 1's sync       │
         │ updates           │
         │ ~/.pathfinder/data │
         │ MCP is source of   │
         │ truth for         │
         │ persistence        │
         └────────────────────┘

Both tabs are eventually consistent:
 - Immediate consistency in localStorage (same-origin)
 - Eventual consistency in MCP (async sync)
 - If browser is closed and reopened, MCP data is re-hydrated to localStorage
```

### 4.5 Data Layers Summary

**Layer 1: Browser Memory (JavaScript objects)**
- Ephemeral; lost on page reload
- Fastest (no I/O)
- Example: `const role = { id: 'role-123', company: 'Anthropic', ... }`

**Layer 2: localStorage (Browser storage)**
- Survives page reloads, tab closes
- Survives browser restart (until user clears site data)
- Synchronous, fast (a few milliseconds)
- ~5-10 MB quota per origin
- Shared across same-origin tabs/windows
- Example: `localStorage.getItem('pf_pipeline')`

**Layer 3: IndexedDB (Browser database)**
- Survives browser restart
- Asynchronous, supports large binary objects (PDFs, DOCX)
- ~50 MB quota per origin
- Used for: `pf_resumes` (file storage)
- Example: `pf_resumes` database stores resume files

**Layer 4: MCP Bridge (localhost:3456)**
- Local HTTP server; requires Node.js process running
- Fallible (can be down); graceful degradation if unavailable
- Persists to disk within 100-300 ms of write
- Example: `POST localhost:3456/api/set-key`

**Layer 5: Disk (/~/.pathfinder/data/)**
- JSON files, one per localStorage key
- Persistent; survives application restart
- Human-readable; easy to inspect and edit
- Manual backup: `~/.pathfinder/backups/{timestamp}.tar.gz`
- Example: `~/.pathfinder/data/pf_pipeline.json`

**Read/Write Latency by Layer:**

| Layer | Read (ms) | Write (ms) | Failure Mode |
|-------|-----------|-----------|---|
| Memory | <0.1 | <0.1 | Data loss on reload |
| localStorage | 1-5 | 1-5 | Data loss if user clears site data |
| IndexedDB | 5-50 | 5-50 | Quota exceeded; async complications |
| MCP Bridge | 10-100 | 100-500 | Server down; network down |
| Disk | 100-500 (first access) | 100-500 | Disk full; permissions denied |

**Consistency Guarantees:**

- **localStorage ↔ memory:** Strong (immediate updates via JS objects)
- **localStorage ↔ IndexedDB:** Strong (both are browser storage)
- **localStorage ↔ MCP:** Eventual (async debounced sync)
- **MCP ↔ Disk:** Strong (MCP writes immediately to disk)
- **Disk ↔ localStorage:** Eventual (only on app restart or manual MCP fetch)

---

## 5. Glossary

- **MCP:** Model Context Protocol; a protocol for Claude to interact with external systems via tools
- **MCP Bridge:** HTTP server at `localhost:3456` that provides persistence and file storage
- **ADR:** Architecture Decision Record; a document recording a significant architectural decision
- **Invariant:** A property that must always be true; violation indicates a bug or data corruption
- **Debounce:** Grouping multiple consecutive writes into a single operation after a delay
- **Deterministic:** Same input always produces the same output; no randomness or side effects
- **Graceful degradation:** System continues to function with reduced capability when optional components are unavailable
- **Same-origin:** Web pages served from the same protocol, domain, and port; they share localStorage and can communicate
- **Persistent:** Data survives application restarts and browser closing

---

## 6. References and Related Documentation

- **Setup Guide:** See `/docs/getting-started.md` for installation and initial configuration
- **API Reference:** See `modules/shared/claude-api.js` for Claude API call patterns
- **Data Layer API:** See `modules/shared/data-layer.js` for localStorage/MCP interface
- **Module Template:** See `modules/SHARED_NAV_TEMPLATE.html` for copy-paste navigation
- **CSS Variables:** See `modules/shared/variables.css` for theme tokens
- **Backup/Recovery:** See `~/.pathfinder/backups/` for timestamped snapshots

