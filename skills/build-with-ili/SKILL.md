---
name: build-with-ili
description: "Operating system for building software with Ili. Governs how Claude works: parallel execution, design-first thinking, honest QA, decision points, error recovery, context management, and the 'last 10%' quality bar. Use this skill at the START of every project, every new session, and whenever Claude is about to build, ship, or evaluate anything. Trigger on: new project, build something, create a module, start coding, ship a feature, QA pass, polish pass, deploy, or any multi-step software task. This skill is always relevant when writing code — even if the user doesn't mention it."
---

# Build With Ili

This is how we build software together. Read this before writing a single line of code.

These patterns were extracted from a real project (Pathfinder — 12 modules, 30,000+ lines, v1.0 → v2.1.3 across multiple sessions). They are battle-tested. The lessons here come from actual mistakes that cost real time to fix.

---

## How to Use This Skill

This file is the operating system. It lives as a skill so Claude loads it automatically when building software.

For any specific project, there should also be a `CLAUDE_CONTEXT.md` at the project root (see the Context Management section for the template). That file holds project-specific state — modules, versions, data contracts. This skill holds the universal rules that apply to every project.

The two work together: this skill tells Claude *how* to work; CLAUDE_CONTEXT.md tells Claude *what* to work on.

---

## Part 1: Operating Principles

### Parallel by Default

If tasks don't depend on each other, run them at the same time. Don't ask — just do it.

Five modules need features? Fire five agents simultaneously. PRD, CHANGELOG, and CONTEXT need updates? Edit all three in one tool call. Build + test + docs? Parallelize the independent parts.

The only time to go sequential is when Task B literally needs the output of Task A. If you're unsure, bias toward parallel — the worst case is a merge conflict, which is cheaper than wasted serial time.

### Design Is a First-Class Citizen

Every screen, every interaction, every empty state — design matters as much as the code behind it. This isn't "make it pretty at the end." Design thinking happens at the start:

**Before building any UI, answer these questions:**
- Who is the user and what are they trying to accomplish?
- What does the ideal experience feel like — not just look like?
- What happens when there's no data? When something fails? When the user does something unexpected?
- Is the information hierarchy clear? Can the user find what matters in 2 seconds?

**Design standards that apply to everything we build:**
- Consistent visual language: colors, spacing, typography, and component patterns should be uniform across every module. Use CSS variables, not raw values.
- Every interactive element needs a hover state, a focus state, and a transition (150ms ease minimum).
- Empty states are a design opportunity, not an afterthought. They should guide the user toward the next action, not just say "No data."
- Loading states are required for any async operation. The user should never stare at a frozen screen.
- Accessibility is a design requirement: proper contrast ratios, keyboard navigation, screen reader support (aria-labels, aria-live regions, focus management).
- Mobile responsiveness should be considered even for desktop-first tools. At minimum, nothing should break on a smaller viewport.

When presenting design decisions, show the user what they'll get — not just describe it. If building HTML/CSS, create the component and let them see it. Screenshots beat paragraphs.

### Sweat the Last 10%

Nothing ships at 90%. The last 10% is where quality lives. Error handling, empty states, accessibility, transitions, validation — these are requirements, not nice-to-haves. If you wouldn't ship it to a paying customer, it's not done.

See the Polish Pass Checklist in Part 4 for the specific line items.

### Definition of Done

Three tiers. Don't confuse them:

**Built** — Code is written. Functions exist, logic is implemented. This is not "done."

**Verified** — QA passed. HTML validity, missing element IDs, broken references, localStorage key consistency, cross-module navigation, and **interactive workflow testing** (clicking every button, testing every form, switching every view, verifying state persistence) — all checked. This is not "done" either.

**Shipped** — Committed with version bump, PRD updated, changelog entry written, runs without errors. This is done.

Never report something as "100%" at the Built tier. Percentages must be backed by verification, not gut feel.

### Honest Status

Report what's actually true. "6 files changed, 3,176 lines added" is verifiable. "All localStorage operations wrapped in try/catch" is verifiable. "~85% complete" is vibes.

When giving status, always include what's broken, not just what's built. A status report that only lists accomplishments is hiding information.

---

## Part 2: Decision Points

Not everything should be autopiloted. Some decisions have real consequences for the user, the stakeholders, or the application's performance. Here's when to pause and present options:

### Always Pause For:
- **Architecture choices** — Framework selection, database design, API patterns, state management approach. These are expensive to reverse. Present 2-3 options with tradeoffs.
- **User-facing design decisions** — Layout patterns, navigation structure, information hierarchy, interaction models. The user lives with these daily.
- **Performance tradeoffs** — Client vs. server rendering, caching strategy, data loading patterns. These affect real users in production.
- **Scope questions** — "Should this module do X or Y?" When requirements are ambiguous, don't guess. Present the options with LOE (level of effort) and impact estimates.
- **Destructive operations** — Anything that deletes data, changes file structure, or modifies shared contracts between modules.

### Never Pause For:
- Implementation details within an agreed architecture
- Code style choices (follow the project's established patterns)
- Which files to edit (that's Claude's job to figure out)
- Parallelization decisions (always parallel by default)

### How to Present Decisions:
State the decision clearly. Give 2-3 options. For each option, include: what it does, the LOE, the impact on users, and any risks. Make a recommendation but let the user choose. Keep it concise — a decision framework, not an essay.

---

## Part 3: Prioritization

When deciding what to build first, use this framework:

**User impact first, balanced with LOE and cost/time.**

| Priority | Description | Example |
|----------|-------------|---------|
| **P0** | Blocks the user from using the product | Broken navigation, JS errors on load, missing core functionality |
| **P1** | High user impact, reasonable LOE | Key features, cross-module integration, data flow |
| **P2** | Medium impact or high LOE | Polish, secondary features, nice-to-have integrations |
| **P3** | Low impact or very high LOE | Edge cases, micro-optimizations, cosmetic tweaks |

Within each priority level, batch related work together and run in parallel. Ship P0 first, then P1 in parallel batches, then P2, etc.

When the user says "what's next" — present the highest-impact items first, grouped into parallelizable batches, with LOE estimates. Let them pick.

---

## Part 4: Build Patterns

### Batch Execution

Group related work into batches. Ship each batch as one version:

```
Batch 1 (5 agents in parallel):
  - Module A: Feature X
  - Module B: Feature Y
  - Module C: Feature Z
  → Commit as vX.Y.0

Polish Pass (4 agents in parallel):
  - Group 1: Modules A+B error handling + a11y + design polish
  - Group 2: Modules C+D error handling + a11y + design polish
  → Commit as vX.Y+1.0

QA Pass (1 agent):
  - Full audit across all modules
  → Fix issues → Commit as vX.Y+1.1
```

### Agent Prompt Structure

When launching parallel agents, each needs five things:

1. **Working directory** — absolute path to the project root
2. **Specific files** — which files to read and modify (not "the module" — the actual file paths)
3. **Exact scope** — what to build, with concrete deliverables. "Add error handling" is vague. "Wrap all localStorage.getItem calls in try/catch with fallback to empty array, add empty state messages to all list containers, add aria-label to all icon-only buttons" is concrete.
4. **Quality bar** — the checklist they must hit before they're done (use the Polish Pass Checklist)
5. **Constraints** — what NOT to do. "Don't rewrite the entire file." "Don't run npm install." "Read all files before making changes."

### The Polish Pass Checklist

This is the "last 10%" checklist. Every feature, every module, every batch must pass this before it counts as Verified:

**Error Handling:**
- Every `localStorage.getItem` + `JSON.parse` in try/catch with graceful fallback
- Empty state messages for all lists, tables, charts, and panels
- Form validation: required fields, numeric ranges, date formats
- CDN/external script loading failures handled with user-facing message

**Design & Accessibility (WCAG 2.1 AA):**
- `aria-label` on all icon-only buttons
- `role="alert"` on notification/status elements
- `aria-live="polite"` on dynamic content regions
- Focus management: modals auto-focus first input on open, return focus on close
- Keyboard navigation: Escape closes modals, Enter submits forms, arrow keys where appropriate
- Proper color contrast ratios
- CSS transitions (150ms ease) on all interactive elements
- Hover states on every clickable element
- Loading states during async operations
- `cursor: pointer` on clickable non-anchor elements
- Consistent CSS variable usage (no raw hex colors or pixel values inline)
- Empty states that guide the user, not just display "No data"

**Data Validation:**
- `.trim()` on all text inputs before storage
- `textContent` instead of `innerHTML` for user-generated content (XSS prevention)
- Email validation where applicable
- Numeric range checks where applicable
- Date format validation where applicable

**Code Quality:**
- No `console.log` (only `console.warn` / `console.error` for actual issues)
- No TODO/FIXME/HACK comments remaining — implement the fix or remove the comment
- JSDoc-style comments on every function explaining what it does
- Visual section separators between major code sections (`/* ====== SECTION ====== */`)

### QA Audit Checklist

Run after every major batch. This is non-negotiable — the QA step found 7 bugs in Pathfinder including a critical one that broke an entire module, *after* everything was called "100%."

**HTML Integrity:**
- Script tag balance (open/close counts match per file)
- All onclick/event handlers reference functions that exist in the script block
- All element IDs referenced in JavaScript exist in the HTML
- All HTML tags properly nested

**Cross-Module:**
- Navigation bar has links to ALL modules in every module (including the module itself, marked active)
- Shared CSS/JS files exist and are referenced correctly from every module
- localStorage keys match between modules that share data (same spelling, same format)

**Interactive QA (the most important section of this entire checklist):**

Screenshots are not QA. Console silence is not QA. If you haven't clicked it, you haven't tested it.

The reason this matters: in Pathfinder, every module passed "visual rendering" checks — pages loaded, no console errors, layouts looked correct. But when a real user clicked through basic workflows, bugs were everywhere: buttons that did nothing, views that didn't switch, data that didn't persist, forms that broke on submit. The gap between "it renders" and "it works" is where most bugs live.

*Test workflows, not pages.* A workflow is a sequence of actions a real user would take. Don't test "does the Kanban page load" — test "can I add a role, drag it to a new stage, refresh the page, and see it in the right stage." Every module should have 3-5 core workflows identified and tested.

*How to run interactive QA:*
1. Open the module in a real browser (use the Chrome extension's tab tools or a local HTTP server)
2. For each core workflow, perform the actual sequence of clicks, form fills, and interactions
3. After each action, verify the result: did the UI update? Did the data persist? Did related modules pick up the change?
4. Reload the page mid-workflow and verify state survived
5. Test the empty state: clear relevant localStorage keys, reload, verify the module handles having no data gracefully
6. Test error paths: enter invalid data, leave required fields blank, submit forms with edge-case values

*What to actually look for (beyond console errors):*
- Buttons that do nothing when clicked (missing event handlers, wrong function references)
- Views/tabs that don't switch (competing CSS systems, selector ambiguity)
- Data that doesn't persist across page reloads (localStorage writes failing silently)
- Images/logos that show broken image icons (dead external APIs, wrong URLs)
- Forms that silently fail (no validation feedback, no success confirmation)
- Dropdowns or selects with missing options (hardcoded lists that don't match actual data)
- Elements that visually overlap or disappear at certain states
- Inline styles that override CSS class-based visibility (a common architecture bug)

*Report format:* For each workflow tested, report what you did, what happened, and whether it matched expectations. "Tested add-role workflow: clicked Add Role → filled form → submitted → role appeared in Kanban stage 1 → refreshed page → role still there. PASS." or "Tested view-switching workflow: clicked Table View → columns rendered → clicked Companies View → blank page. FAIL — inline display:none on container overrides CSS class."

*When to run interactive QA:*
- After every major batch (same as before)
- After any fix to a module — verify the fix actually works AND that it didn't break adjacent workflows
- Before any commit that touches UI code

*The bottom line:* A module is not QA'd until you've personally performed every core user workflow and verified the outcome. Taking a screenshot of a page that loaded is step zero — the real QA starts when you start clicking.

**Documentation:**
- PRD version matches CHANGELOG latest entry
- CLAUDE_CONTEXT.md version matches both
- All modules listed in CLAUDE_CONTEXT.md implementation table

---

## Part 5: Architecture Guidance

### This Is a Demo Machine

The architecture patterns described here are optimized for rapid prototyping and demonstration. They are explicitly NOT industry best practice for production systems. This distinction should be clear in all documentation, code comments, and artifacts we produce.

**What we use and why:**

| Pattern | Why We Use It | Production Alternative |
|---------|--------------|----------------------|
| Single-file HTML (HTML+CSS+JS) | Zero build step, instant demo, opens anywhere | Component framework (React, Vue, Svelte) with build pipeline |
| localStorage for data | No server needed, works offline, instant setup | PostgreSQL/MongoDB with proper ORM and migrations |
| Direct browser API calls | No backend to deploy or maintain | Server-side API layer with auth, rate limiting, caching |
| CDN script imports | No npm install, no node_modules | Package manager with lockfile, bundler, tree-shaking |
| IndexedDB for files | Client-side blob storage, no S3 needed | Cloud storage (S3, GCS) with signed URLs |

**When recommending architecture, always frame it:**
- "For this demo/prototype, we're using X because it's fast to build and easy to show. In production, you'd want Y because [reason]."
- Code comments should note: `// Demo pattern: localStorage. Production would use a proper database.`
- PRDs should have a "Production Considerations" section noting what would change at scale.

**When the user asks "how should I build this," present the spectrum:**
1. **Demo/prototype** (what we typically build) — fastest to ship, easiest to show, runs anywhere
2. **MVP** — adds a real backend, basic auth, proper database, still cuts corners on ops
3. **Production** — full stack, CI/CD, monitoring, auth, tests, deployment pipeline

Let the user pick the right level for their needs.

### Cross-Module Communication

Modules talk to each other through shared localStorage keys with a namespace prefix. Every key gets a project prefix (e.g., `pf_` for Pathfinder, `xx_` for Project X). Always wrap reads in try/catch. Always document keys in CLAUDE_CONTEXT.md.

### External API Bridge (Sync Hub Pattern)

When the project needs data from external APIs that can't be called from the browser (CORS, auth, rate limits), use the bridge pattern:

Claude fetches data server-side via MCP tools, transforms it to the project's localStorage format, embeds it in a Sync Hub HTML page as JavaScript constants, and the user opens the page and clicks "Sync" to write data to localStorage. Other modules pick it up automatically.

This is a demo pattern. In production, you'd have a backend service that handles the API calls and exposes a clean REST/GraphQL endpoint to the frontend.

---

## Part 6: Error Recovery

Things will go wrong. Here's how to handle the common failures:

### Agent Fails Halfway
If a parallel agent crashes or produces incomplete work: don't panic. Check what it did complete (`git diff`), keep the good parts, and re-launch a new agent to finish just the remaining work. Don't re-do everything.

### Build or Compile Fails
If `npm install`, `npm run build`, or any build step fails in the VM (common — the Cowork VM has limited memory): note it in the commit message and CLAUDE_CONTEXT.md as "requires build on user's machine." Provide the exact commands. Don't waste time debugging VM resource limits.

### Git Auth Fails
The Cowork VM doesn't have git credentials for pushing. Stack commits locally. The user pushes from their Mac. This is a known constraint — don't try to fix it, just work around it.

### Merge Conflicts from Parallel Agents
Parallel agents editing different files won't conflict. If two agents need to edit the same file (e.g., a shared nav bar), either: (a) have one agent do all nav bar updates, or (b) handle conflicts after both finish by reading the file and reconciling manually.

### Something Works Locally but Not in Production
Flag it. Add to Known Issues in CLAUDE_CONTEXT.md. Note the environment difference. Don't silently ship something that only works in the demo environment.

### When You're Stuck
Present the situation honestly: "I've tried X and Y, both failed because Z. Here are our options: (A) try a different approach, (B) work around it, (C) skip it for now and document it as a known limitation." Let the user decide.

---

## Part 7: Context Management

Sessions die. Context compacts. This is the single hardest problem in multi-session projects. Here's how to survive it:

### CLAUDE_CONTEXT.md (Project Root)

Every project gets one. This is the first file Claude reads in any new session. Template:

```markdown
# [Project Name] — Session Context for Claude

**Read this file at the start of every new session.**

---

## What Is [Project]
[2-3 sentence description. Stack. Architecture pattern.]

**Owner:** [Name] ([email])
**Repo:** [URL]
**Local Path:** [path]

---

## The Modules / Components
[Table: Module | Path | Primary Function | Key Data Stores]

---

## Mandatory Rules
[Project-specific rules that must be followed in every session]

---

## Current State
**Version:** vX.Y.Z
**Last Updated:** YYYY-MM-DD

### Implementation Status
[Table: Module | % Complete | What Works | What's Missing]

### Known Issues
[Bullet list of actual bugs, limitations, environment constraints]

---

## How to Start a New Session
1. Read this file
2. Read CHANGELOG.md for recent changes
3. `git log --oneline -10` for latest commits
4. Read relevant component PRD for whatever the user wants to work on
5. Ask what the user wants to do (don't re-explain the project)
```

### What Goes Where

The system is designed so a new session can pick up where the last one left off without the user re-explaining anything:

**CLAUDE_CONTEXT.md** — Current state. What exists, what's broken, what the rules are. Updated after every major version bump.

**CHANGELOG.md** — History. What changed and when, with enough detail (function names, localStorage keys, concrete features) that a fresh session can understand the scope of past work.

**Commit messages** — Intent. The "why" behind each version bump. Format: `vX.Y.Z: Short description of what changed and why`. Future sessions will read `git log` to reconstruct the project timeline.

**Component PRDs** (`docs/[module]-prd.md`) — Specifications. What each module is supposed to do, organized in phases with implementation checklists. Agents read only the PRD they need.

**Master PRD** (`docs/PRD.md`) — The single source of truth for what shipped when, via the version history table.

### The PRD Sync Rule

Every code change must update: the relevant component PRD, the main PRD version number, the version history table, and the CHANGELOG. No exceptions. This was the most important convention in Pathfinder — it's what made context recovery possible across sessions.

### Version Convention
- Patch (x.x.Y) = bug fixes, minor tweaks
- Minor (x.Y.0) = new features, module improvements
- Major (Y.0.0) = architectural changes

### Commit Convention
- Format: `vX.Y.Z: Short description`
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Stack commits locally; the user pushes manually
- Use HEREDOC for commit messages to preserve formatting

---

## Part 8: Lessons Learned

These are real mistakes from real projects. They're here so they don't happen again.

**Called it "done" before QA.** A QA audit found 7 bugs including a critical JavaScript-breaking regex — after everything was already called "100%." Now: QA is mandatory after every batch, not optional.

**Percentage estimates were vibes.** Said "95%" when there were missing HTML element IDs and a module with no navigation bar at all. Now: percentages must be backed by verification. If you can't prove it works, don't call it done.

**Polish was a separate phase instead of part of the build.** Error handling, accessibility, and validation got deferred to a "cleanup pass" that found hundreds of issues. Now: the Polish Checklist is the definition of done for every feature, not a later phase.

**Design was treated as decoration.** Empty states were blank divs. Loading states were missing. Hover effects were inconsistent. Now: design is a first-class citizen. Every screen gets designed, not just coded.

**Agents needed explicit instructions to parallelize.** The instruction had to be given twice. Now: parallel execution is the default for independent tasks. Period.

**Git push can't happen from the Cowork VM.** The VM doesn't have git credentials. Don't waste time debugging it. Stack commits, push from Mac.

**Screenshot QA is not QA.** In Pathfinder v2.1.3, every module "passed QA" — pages loaded, no console errors, layouts looked fine in screenshots. Then the user tested basic workflows and found bugs everywhere: Pipeline views didn't switch, buttons did nothing on click, data didn't persist. The root cause was that QA meant "take a screenshot and check the console." Real QA means performing actual user workflows — clicking buttons, filling forms, switching views, reloading, testing empty states. If you haven't interacted with it the way a user would, you haven't tested it. This lesson was expensive enough that it got its own section in the QA Audit Checklist above.

---

## Part 9: Templates

### New Project Kickoff
- Create repo with README
- Create `CLAUDE_CONTEXT.md` using the template in Part 7
- Create `CHANGELOG.md` with v0.1.0 entry
- Create `docs/PRD.md` with problem statement, architecture, version history table
- Create shared styles/utilities directory
- Create first module as proof of concept
- Commit as v0.1.0

### New Module
- Create the module file(s)
- Include shared CSS and JS
- Add navigation links to all existing modules
- Update all existing modules to link to the new one
- Create component PRD in `docs/`
- Add to CLAUDE_CONTEXT.md module table
- Bump version, update PRD history, update CHANGELOG

### Pre-Commit
- `git diff --stat` — verify all expected files changed
- Version bumped in PRD
- Version history row added to PRD
- CHANGELOG entry written with concrete details (not "various improvements")
- CLAUDE_CONTEXT.md updated (version + implementation status + any new known issues)
- Commit message format: `vX.Y.Z: Description`
- Co-authored-by line included
