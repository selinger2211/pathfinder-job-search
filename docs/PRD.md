# Pathfinder — Product Requirements Document
### An Agentic Job Search System

**Author:** Ili Selinger
**Date:** March 2026
**Status:** v3.6.0

---

## 1. Executive Summary

Pathfinder is a system of specialized AI agents that collaborate to manage every stage of a senior PM job search — from discovering roles on job boards through closing offers. It replaces the current fragmented workflow (spreadsheets, scattered docs, repetitive ChatGPT sessions) with a unified architecture where information is entered once and flows everywhere it's needed.

The system is built on an **agentic decomposition** pattern: 11 independent modules, each with a single responsibility, communicating through a shared localStorage data layer and a local Artifacts MCP server. There is no single-page application — each agent is a standalone HTML page that reads shared state, does its job, and writes results back. The infrastructure runs entirely on the user's machine with zero cloud dependencies.

**The agents:**

- **Pipeline Tracker** — the data backbone. Companies with rich profiles (20+ metadata fields), roles with 8-stage lifecycle tracking, IC/management positioning per role, and a connections log for networking.
- **Job Feed Listener** — monitors Gmail alerts, Indeed, Dice, and career pages on a scheduled cadence. Scores roles against a preference profile (0-100 weighted match), auto-creates pipeline entries, and suggests tier promotions.
- **Research Brief Agent** — streams a 10-section company/role prep brief from Claude with per-section caching and smart invalidation.
- **Resume Tailor Agent** — analyzes JD fit, generates positioning-aware resumes (IC vs. management framing), and maintains a reusable bullet bank.
- **Calendar Integration Agent** — links Google Calendar events to pipeline roles, triggers stage transitions, and powers pre-interview nudge sequences.
- **Outreach Message Generator** — drafts 8 message types (LinkedIn requests, cold emails, thank-you notes, recruiter responses) with personalization that requires specific signals, not generic templates.
- **Post-Interview Debrief Agent** — captures structured feedback after each round, identifies patterns across 10+ interviews, and feeds insights back to research and prep.
- **Comp Intelligence Agent** — benchmarks compensation from Levels.fyi and job postings, with positioning-aware analysis and negotiation support.
- **Mock Interview Agent** — runs company-calibrated practice sessions across 7 interview types (execution, strategy, design, product sense, behavioral, technical, homework) with detailed frameworks, real interview questions sourced from Glassdoor/Blind/Reddit, story bank management, and TMAY practice mode.
- **Dashboard & Launcher** — daily action queue, pipeline summary, streak tracking, and a nudge engine that surfaces the right action at the right time.
- **Artifacts MCP Server** — the shared file layer. Saves and retrieves research briefs, resumes, JDs, debriefs, and mock session transcripts with structured tagging.

**Why this matters:** The current market offers fragmented tools — Teal for tracking ($29/mo), Jobscan for ATS (Applicant Tracking System) optimization ($50/mo), Final Round AI for mock interviews ($96-288/yr), Apollo for outreach ($49/mo) — none of which share context or model the job search as a stateful lifecycle. Pathfinder replaces 4-5 separate subscriptions (~$136-193/mo) with a single local system running on Claude (~$5-15/mo in API usage). More importantly, no existing tool offers positioning awareness, persistent company intelligence, or company-calibrated interview prep.

**Implementation:** A rapid build sprint migrating from initial concept to production. Phase 1 decomposes into standalone modules, Phase 2 adds the MCP and skills layer, Phase 3 builds the Job Feed Listener, and Phase 4 delivers the interview and outreach agents. The entire system is built with vanilla HTML/CSS/JS (zero build step) and designed to be explainable in a systems design interview — making Pathfinder both a productivity tool and a portfolio piece.

## 2. Problem Statement

A modern PM job search is a multi-month, full-time operation. The market has shifted dramatically from the ZIRP era where senior PMs could field multiple offers from a handful of applications. Today, experienced Directors and Principals routinely apply to 100+ roles, manage 15+ concurrent interview processes, and still struggle to convert. The funnel is long, the rejection rate is high, and the cognitive load is crushing.

The work itself is deeply repetitive but not automatable in the traditional sense — each role requires a tailored resume, a customized cover letter, company-specific research, interviewer analysis, and a prep strategy that accounts for the specific interview format (execution, strategy, design, behavioral, technical, homework). Multiply that by dozens of active roles across different stages, and the tracking problem alone becomes a job.

Existing tools fail in predictable ways. Spreadsheets can track status but can't generate content. AI chat interfaces can generate content but have no memory across sessions — you re-explain your background every time. Job boards surface roles but don't connect to your prep workflow. The result is a fragmented process: job descriptions saved in random folders, resumes scattered across Downloads, research notes in one tool, contact tracking in another, and no system connecting them.

The core problem is threefold:

**Statefulness.** Every job description should be entered once and flow through the entire system — informing research, resume tailoring, outreach messaging, and interview prep. Today, you re-enter the same information into every tool at every stage.

**Lifecycle management.** A job search has a well-defined lifecycle (discover, research, outreach, apply, screen, interview, offer, negotiate) with specific actions required at each stage. No existing tool models this lifecycle or prompts you with the right action at the right time.

**Compound repetition.** An effective job search requires maintaining a growing Target Account List, checking top-tier boards 3x/week, running outreach sequences with 3-4 touchpoints per contact, and customizing materials for every application. This is 10-15 hours/week of mechanical work that an agent system could reduce to minutes.

## 3. Competitive Landscape

### 3.1 Market Overview

The job search tools market has fragmented into four categories, each solving one piece of the problem while missing the others. No existing product treats the job search as a stateful lifecycle with specialized agents sharing context.

### 3.2 Direct Competitors

| Product | Category | What It Does Well | What It Misses | Pricing |
|---------|----------|-------------------|----------------|---------|
| **Teal** | All-in-one tracker | Kanban tracker + AI resume builder + cover letters. Most complete single product. Generous free tier. | No research briefs, no company intelligence, no outreach automation, no mock interviews. Resume AI is generic — no positioning awareness. | Free / $29/mo / $179/yr |
| **Huntr** | Tracker + resume | Clean kanban board with AI resume/cover letter. Good UX. | Simpler than Teal. No content generation depth. Essentially a prettier spreadsheet with AI bolted on. | Free / $40/mo |
| **Jobscan** | ATS optimization | Market leader for ATS keyword scoring. Tells you what's missing. | Keyword matching, not actual tailoring. Tells you what's wrong but doesn't fix it. No pipeline tracking. | 5 free scans / $49.95/mo |
| **Careerflow** | Career platform | Tracker + resume + LinkedIn optimization + networking tools. Closest to full-suite. | Centralized SaaS — your data lives on their servers. No agent architecture, no MCP. Features are separate, not integrated. | $30-50/mo |
| **Simplify** | Autofill + tracking | Chrome extension that auto-fills application forms. Reduces clicking. | Optimizes speed of submission, not quality. No research, no tailoring, no interview prep. | Free / ~$30/mo |
| **Rezi / Reztune** | Resume generation | Generate tailored resumes from JDs. Free tiers available. | Resume-only. No pipeline, no research, no stateful memory across roles. | Free / ~$29/mo |

### 3.3 Adjacent Competitors

| Product | Category | Overlap with Pathfinder | Key Difference |
|---------|----------|------------------------|----------------|
| **Final Round AI** | Interview prep | AI mock interviews with real-time coaching, question generation | Voice-based, generic questions, no company context, no pipeline integration. $96-288/yr. |
| **JobCopilot / LazyApply** | Auto-apply bots | Bulk job submission (50-750 apps/day) | Spray-and-pray philosophy. Opposite of Pathfinder's targeted approach. $29-50/mo. |
| **Scale.jobs** | Outsourced applications | Human assistants handle applications at scale | $299 for 500 apps. Outsources the work instead of building intelligence. |
| **Levels.fyi** | Comp data | Salary benchmarking by company/level/location | Data-only, no integration with job search workflow. Free / paid benchmarking tools. |
| **Apollo.io** | Sales outreach | Contact finding, email sequences | Built for sales, not job seekers. Useful as a data source, not a competitor. Freemium. |

### 3.4 Why Pathfinder Is Different

**Statefulness.** In every competitor, the resume builder and the job tracker are separate features that happen to be in the same app. They don't share context. You can't enter a JD (Job Description) once and have it flow to a research brief, a tailored resume, a fit assessment, outreach messages, and interview prep. Pathfinder's shared data layer means every agent has full context.

**Positioning awareness.** No competitor supports IC vs. management framing per role. Pathfinder's positioning field changes resume strategy, TMAY scripts, outreach tone, and comp benchmarking — across all agents, from a single toggle.

**Company intelligence.** No competitor builds a persistent company profile that accumulates over time. Pathfinder tracks mission, funding, tech stack, competitors, recent news, culture, and connections — all available to every agent.

**Interview lifecycle.** No competitor connects calendar events to pipeline roles, auto-generates debriefs, feeds insights back into research briefs, or runs company-calibrated mock interviews. The interview agents are Pathfinder's strongest differentiation.

**Privacy-first.** Every competitor is a centralized SaaS — your job search data (salary expectations, company opinions, interview struggles) lives on someone else's server. Pathfinder runs locally with zero cloud dependencies.

**Agentic architecture.** Pathfinder is built as a system of specialized agents communicating through MCP — not a monolithic app with AI features tacked on. This is both a technical differentiator and an interview showcase.

### 3.5 Value Proposition

**For the user (today):**

Pathfinder turns a 10-15 hour/week manual process into focused 2-3 hour/week decision-making. The mechanical work — checking boards, tailoring resumes, researching companies, drafting outreach, prepping for interviews — is handled by specialized agents. You focus on the parts that require human judgment: deciding which roles to pursue, how to position yourself, and which offers to accept.

**Quantified value at the current Teal+ price point ($29/mo):**

| Capability | Time Saved Per Week | Competitor Equivalent | Competitor Cost |
|------------|--------------------|-----------------------|----------------|
| Pipeline tracking + kanban | 1-2 hrs | Teal / Huntr | $29-40/mo |
| Resume tailoring (positioning-aware) | 2-3 hrs | Jobscan + Rezi | $50-80/mo |
| Research briefs (10-section, company-specific) | 3-4 hrs | Manual research | — |
| Outreach message generation | 1-2 hrs | Apollo.io + manual | $49/mo |
| Mock interviews (company-calibrated) | 1-2 hrs | Final Round AI | $8-24/mo |
| Comp benchmarking | 30 min | Levels.fyi manual lookup | Free-paid |
| Calendar + debrief automation | 30 min | Manual tracking | — |
| **Total** | **~10 hrs/week** | **4-5 separate subscriptions** | **$136-193/mo** |

Pathfinder replaces 4-5 paid subscriptions with a single local system that costs nothing beyond the Claude API usage (~$5-15/month depending on volume).

**For interviews (portfolio value):**

Pathfinder demonstrates agentic architecture, MCP server design, Claude API integration, prompt engineering, privacy-first data architecture, and product thinking — in a single project that the interviewer can interact with live. This is worth more than any number of hypothetical system design answers.

## 4. Vision & Goals

**Vision:** Pathfinder is a system of specialized AI agents that collaborate to manage every stage of a job search — from discovering roles through closing offers. Each agent has a single responsibility and shares state through a common data layer, so you enter information once and it flows everywhere it's needed.

**Primary goals:**

- **Eliminate re-entry.** A job description entered in the Pipeline flows automatically to the Research Brief agent, Resume Tailor, and outreach tools. Company and role context is always available without re-explaining.
- **Model the real lifecycle.** Pipeline stages map to the actual job search process — from target account discovery through offer negotiation — with stage-appropriate actions and agent suggestions at each transition.
- **Reduce mechanical work.** The 10-15 hours/week of repetitive search operations (board checking, resume customizing, research compiling, outreach tracking) should collapse to focused decision-making: review what the agents produced, approve or adjust, move forward.
- **Demonstrate agentic architecture.** The system itself is a portfolio piece — an interview-ready demonstration of agent decomposition, MCP server design, shared state management, and Claude-native development patterns.

**Non-goals:**

- Replacing human judgment on fit, culture, or career direction. Agents surface information; the user decides.
- Building a general-purpose job board or ATS. This is a personal power tool, not a platform.
- Achieving feature parity with enterprise recruiting software. Simplicity and privacy matter more than completeness.

## 5. System Architecture

### 5.1 Design Philosophy

The system follows an **agentic decomposition** pattern: instead of a single-page application, each capability is a specialized agent with a single responsibility, well-defined inputs/outputs, and no direct dependencies on other agents. Agents collaborate through a shared data layer and a common artifact storage service — never by calling each other directly.

This mirrors how production AI systems are built at scale: specialized models/agents, shared data infrastructure, and an orchestration layer that delegates work. The architecture is intentionally designed to be explainable in a systems design interview.

**Core principles:**

- **One agent, one job.** The Research Brief agent doesn't know about resume generation. The Resume Tailor doesn't know about pipeline stages. Each agent does one thing well.
- **Data as the integration layer.** Agents communicate through shared localStorage keys and the Artifacts MCP server. No agent imports another agent's code.
- **Privacy-first.** All data stays on the user's machine. No server, no database, no accounts. localStorage for structured data, local filesystem (via MCP) for files.
- **Graceful degradation.** Each module works as a standalone HTML page. The MCP and skill layers add orchestration power but aren't required for basic functionality.
- **Zero build step.** Vanilla HTML/CSS/JS. No bundler, no transpiler, no npm. Open the file, it works. This eliminates the deployment friction that slows down traditional single-page apps.

### 5.2 System Layers

The system is organized into three layers:

**Infrastructure Layer** — shared services that any agent can use:

- **Artifacts MCP Server** — file storage, retrieval, and tagging. Exposes tools like `save_artifact`, `list_artifacts`, `get_artifact`, `tag_artifact`. When the Research Brief agent finishes streaming, it auto-saves the output here. When the Resume Tailor generates a DOCX, same. The Pipeline Tracker queries this server to display what's attached to each role. No manual filing required.
- **Pipeline Data Store** — localStorage with a defined JSON schema. The canonical source of truth for roles, companies, connections, and stage history.

**Agent Layer** — specialized modules, each independently deployable:

- **Pipeline Tracker** (with Connections) — kanban board, role lifecycle management, contact logging, LinkedIn connection mapping. This is the data backbone that other agents read from.
- **Research Brief Agent** — streams a 10-section interview prep brief from Claude, section-by-section. Caches results. Saves output via Artifacts MCP.
- **Resume Tailor Agent** — generates role-targeted resumes from Claude. Renders preview, exports DOCX/PDF. Saves output via Artifacts MCP.
- **Job Feed Listener** — monitors email and job boards, scores against preferences, auto-creates pipeline entries.
- **Calendar Integration Agent** — links Google Calendar events to pipeline roles, triggers stage transitions, powers time-aware nudges.
- **Outreach Message Generator** — drafts personalized networking messages, cold emails, thank-you notes, and recruiter responses.
- **Post-Interview Debrief Agent** — captures structured feedback after each interview round, identifies patterns, triggers follow-up actions.
- **Comp Intelligence Agent** — benchmarks compensation data from Levels.fyi and job postings, informs positioning and negotiation.
- **Mock Interview Agent** — runs company-calibrated practice sessions with targeted questions, evaluation, and story bank management.

**Presentation Layer** — the user-facing entry point:

- **Dashboard & Launcher** — daily view with streak tracking, nudges, quick actions, and navigation into each agent module.

### 5.3 Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                             │
│                                                                         │
│                      ┌────────────────────────┐                         │
│                      │  Dashboard & Launcher   │                         │
│                      │  (reads from all)       │                         │
│                      └───────────┬────────────┘                         │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────────┐
│                            AGENT LAYER                                  │
│                                  │                                      │
│  ┌───────────────┐  ┌───────────┴────────────┐  ┌───────────────────┐  │
│  │  INBOUND       │  │  DATA BACKBONE         │  │  CONTENT AGENTS   │  │
│  │                │  │                        │  │                   │  │
│  │  Job Feed      │─▶│  Pipeline Tracker      │◀─│  Research Brief   │  │
│  │  Listener      │  │  (+ Connections)       │  │  Resume Tailor    │  │
│  │                │  │                        │  │  Outreach Msgs    │  │
│  │  Calendar      │─▶│  Source of truth       │  │  Comp Intel       │  │
│  │  Integration   │  │  for all agents        │  │                   │  │
│  └───────┬───────┘  └────────────────────────┘  └─────────┬─────────┘  │
│          │                                                │            │
│          │           ┌────────────────────────┐            │            │
│          │           │  INTERVIEW AGENTS      │            │            │
│          │           │                        │            │            │
│          │           │  Mock Interview        │────────────┘            │
│          │           │  Debrief               │  (reads Pipeline,      │
│          │           │  (Story Bank)          │   saves Artifacts)     │
│          │           └────────────────────────┘                        │
└──────────┼─────────────────────────────────────────────────────────────┘
           │
┌──────────┼─────────────────────────────────────────────────────────────┐
│          ▼            SHARED INFRASTRUCTURE                             │
│                                                                         │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ localStorage    │  │ Artifacts MCP    │  │ External Services      │  │
│  │                 │  │ Server           │  │ (MCP)                  │  │
│  │ • pf_roles     │  │                  │  │                        │  │
│  │ • pf_companies │  │ • Research briefs│  │ • Google Calendar      │  │
│  │ • pf_conns     │  │ • Resumes        │  │ • Gmail                │  │
│  │ • pf_prefs     │  │ • Debriefs       │  │ • Indeed / Dice        │  │
│  │ • pf_story_bank│  │ • Mock logs      │  │ • Levels.fyi           │  │
│  │ • pf_bullet_bk │  │ • JD snapshots   │  │ • Greenhouse / Ashby   │  │
│  │ • Caches       │  │                  │  │ • Apollo.io / Aura     │  │
│  └────────────────┘  └──────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data flow:**

- **Inbound agents** (Job Feed Listener, Calendar Integration) bring external data into the system — new roles from job boards/email, interview events from Google Calendar
- **Pipeline Tracker** is the source of truth. Every agent reads from it. Only the Pipeline Tracker and inbound agents write to `pf_roles` and `pf_companies`
- **Content agents** (Research Brief, Resume Tailor, Outreach Messages, Comp Intelligence) read from Pipeline and write to Artifacts MCP
- **Interview agents** (Mock Interview, Debrief) read from Pipeline and Artifacts, write session data back to both
- **Dashboard** reads from everything, writes nothing except UI state (`pf_streak`, `pf_dismissed_nudges`)

### 5.4 Shared Data Layer

Agents share state through two mechanisms:

**localStorage** — structured data with a common key prefix (`pf_`). Each agent reads/writes only the keys it owns, with a published schema so other agents can read them. Key namespaces: `pf_roles` (pipeline), `pf_companies` (tier list), `pf_linkedin_connections` (network), `pf_research_briefs` (brief index), `pf_api_key` (settings), `research_*` (cached brief content), `resume_*` (cached resume data).

**Artifacts MCP Server** — file-based data. Each artifact is tagged with company name, role title, artifact type (research_brief, resume, jd, offer_letter, etc.), and creation date. The MCP server manages a local directory structure and a metadata index. Any agent can save or query artifacts through MCP tool calls.

### 5.5 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| UI | Vanilla HTML/CSS/JS | Zero build step, works anywhere, easy to modify |
| AI | Claude API (streaming) | Direct browser-to-API calls with `anthropic-dangerous-direct-browser-access` |
| Data | localStorage | Privacy-first, no server needed, survives page refreshes |
| File Storage | Artifacts MCP Server | Structured file management, queryable by any agent |
| Skills | Cowork SKILL.md format | Each agent packagable as an invocable skill |
| Deployment | GitHub Pages | Free static hosting, zero infrastructure |
| Agent Protocol | MCP (Model Context Protocol) | Industry-standard agent-to-tool communication |

## 6. Design & UX

Pathfinder is a portfolio piece. It will be demo'd in interviews, screen-shared with hiring managers, and scrutinized by people who build products for a living. The design needs to look like it was built by someone who cares about craft — not like a side project. The bar is Linear, Raycast, and Vercel's dashboard: monochromatic restraint, typographic confidence, and the kind of micro-interaction polish that makes people ask "wait, you built this yourself?"

Pathfinder's decomposed architecture gives each agent its own focused view, and a shared design system makes them feel like one product.

### 6.1 Design Principles

Five principles. Memorize them. Every UI decision should trace back to one of these.

**1. Reduce to the essential.** Every element on screen must earn its pixel. If removing something doesn't hurt comprehension, remove it. Linear's redesign reduced their color usage to near-monochrome and the product got better. Pathfinder should feel like a tool where someone went through and deleted everything that wasn't load-bearing. No decorative borders, no gratuitous icons, no "helpful" labels on things that are already obvious.

**2. Make the next action obvious.** Every screen answers one question: "What should I do now?" The Dashboard leads with an action queue, not a data summary. Pipeline cards surface the recommended next step for each role. The nudge engine pushes time-sensitive tasks to the top. If a user has to think about where to click, we failed.

**3. Keyboard-first, mouse-friendly.** Power users live on the keyboard. Every action has a shortcut. Navigation is instant. But the UI is also fully mouse-navigable with generous click targets and clear affordances — forgiving interactions, not finicky ones. This is the Raycast philosophy: keyboard gets you there faster, but mouse always works.

**4. Show, don't load.** No blank screens while data loads. No spinners hiding slow operations. Research briefs stream section-by-section — you're reading Section 1 while Section 3 is still generating. Resume previews render incrementally. The feed populates card by card. If something takes time, the user watches it happen. This is both good UX and a compelling demo moment.

**5. Sweat the last 10%.** The difference between "nice side project" and "this person builds real products" lives in the details: transitions that ease naturally, empty states that guide instead of dead-ending, focus rings that are visible but not ugly, hover states that respond in under 100ms, consistent spacing that you feel even if you can't articulate it. Every interviewer who opens Pathfinder will unconsciously register whether these details are right.

### 6.2 Visual System

Pathfinder's aesthetic draws from the "Linear design" movement — the dominant visual language for modern developer tools and SaaS products. The defining characteristics: reduced color palette (near-monochrome with selective accent), confident typography, generous whitespace, subtle depth through shadows rather than borders, and dark mode as a first-class experience.

#### 6.2.1 Color Palette

The palette is deliberately restrained. Most of the UI is grayscale. Color is reserved for meaning — when something is colored, it communicates status, priority, or requires attention.

**Core palette (CSS custom properties on `:root`):**

```css
:root {
  /* Backgrounds — layered surfaces */
  --bg-base:        #09090b;    /* Page background (dark) */
  --bg-surface:     #18181b;    /* Card/panel background */
  --bg-elevated:    #27272a;    /* Modals, dropdowns, hover states */
  --bg-subtle:      #3f3f46;    /* Borders, dividers, subtle fills */

  /* Text — three levels of emphasis */
  --text-primary:   #fafafa;    /* Headings, primary content */
  --text-secondary: #a1a1aa;    /* Labels, metadata, timestamps */
  --text-tertiary:  #71717a;    /* Placeholders, disabled, hints */

  /* Accent — used sparingly for interactive elements */
  --accent:         #6366f1;    /* Primary actions, active states, links */
  --accent-hover:   #818cf8;    /* Hover state for accent elements */
  --accent-subtle:  rgba(99, 102, 241, 0.15); /* Accent backgrounds */

  /* Semantic — status colors, used only where meaning requires it */
  --success:        #22c55e;    /* Positive: offer stage, good match, strong score */
  --warning:        #eab308;    /* Attention: nudges, approaching deadlines */
  --danger:         #ef4444;    /* Negative: overdue, rejected, critical */
  --info:           #3b82f6;    /* Informational: new items, updates */
}
```

**Light mode:** Pathfinder ships with dark mode as default (it demos better, reads as more polished, and aligns with developer tool conventions). Light mode is supported via a `[data-theme="light"]` attribute that inverts the surface/text tokens. The accent and semantic colors stay the same in both modes — they're already chosen for sufficient contrast on both backgrounds.

**Tier colors:**

| Tier | Token | Value | Usage |
|------|-------|-------|-------|
| Hot | `--tier-hot` | `#ef4444` | Red dot/badge. Immediate attention. |
| Active | `--tier-active` | `var(--accent)` | Indigo. The default working state. |
| Watching | `--tier-watching` | `#71717a` | Gray. Background monitoring. |
| Dormant | `--tier-dormant` | `#3f3f46` | Dim. Nearly invisible until promoted. |

**Stage colors:** The 8 lifecycle stages follow a temperature gradient — cool at discovery, warm at offer — so a pipeline kanban board reads left-to-right as a visual progression:

| Stage | Color | Hex |
|-------|-------|-----|
| Discovered | Slate | `#64748b` |
| Researching | Sky | `#38bdf8` |
| Outreach | Blue | `#3b82f6` |
| Applied | Indigo | `var(--accent)` |
| Screen | Violet | `#8b5cf6` |
| Interviewing | Amber | `#f59e0b` |
| Offer | Emerald | `#10b981` |
| Closed | Zinc | `#52525b` |

#### 6.2.2 Typography

**Font stack:** `'Geist Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`. Geist Sans (Vercel's typeface, available on Google Fonts) is the primary — it's designed for interfaces and has the right density for data-heavy views. Inter is the fallback. System fonts as a final safety net.

**Monospace:** `'Geist Mono', 'JetBrains Mono', 'SF Mono', 'Consolas', monospace` — used for scores, dates, IDs, code snippets in research briefs, and comp numbers.

**Type scale (based on a 1.200 minor third ratio):**

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | 0.694rem (11px) | 400 | 1.4 | Timestamps, metadata, tertiary labels |
| `--text-sm` | 0.833rem (13px) | 400 | 1.5 | Table cells, badge text, secondary info |
| `--text-base` | 1rem (16px) | 400 | 1.6 | Body text, card content, form inputs |
| `--text-lg` | 1.2rem (19px) | 500 | 1.5 | Card titles, section headers |
| `--text-xl` | 1.44rem (23px) | 600 | 1.3 | Page titles, panel headers |
| `--text-2xl` | 1.728rem (28px) | 700 | 1.2 | Dashboard hero numbers, primary metrics |
| `--text-3xl` | 2.074rem (33px) | 700 | 1.1 | Splash/landing, large score displays |

**Letter spacing:** Slightly tightened at larger sizes (`-0.02em` for xl+, `-0.03em` for 2xl+). Default tracking at base and below. This prevents large headings from looking loose — a detail that separates amateur typography from professional.

#### 6.2.3 Spacing & Layout Grid

**Base unit:** 4px. All spacing uses multiples of 4: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`. No magic numbers. This creates a rhythm that the eye feels even if it can't articulate.

```css
:root {
  --space-1:  0.25rem;   /* 4px  — tight padding, icon gaps */
  --space-2:  0.5rem;    /* 8px  — inline spacing, badge padding */
  --space-3:  0.75rem;   /* 12px — compact card padding */
  --space-4:  1rem;      /* 16px — standard gap, card padding */
  --space-5:  1.25rem;   /* 20px — section gap */
  --space-6:  1.5rem;    /* 24px — card margin, panel gap */
  --space-8:  2rem;      /* 32px — section separation */
  --space-10: 2.5rem;    /* 40px — page margin */
  --space-12: 3rem;      /* 48px — major section break */
  --space-16: 4rem;      /* 64px — page header spacing */
}
```

**Content width:** Max `1280px` for main content area. Pipeline kanban is full-width (needs horizontal space). Agent two-panel views split at 320px sidebar + fluid main panel. Dashboard is single-column, max `720px` centered — scannable without eye-tracking across a wide monitor.

**Border radius:** Consistent `6px` for cards and containers, `4px` for buttons and inputs, `9999px` (full pill) for badges and tags. No mixing of sharp and rounded corners in the same view.

#### 6.2.4 Elevation & Depth

No borders for depth. Pathfinder uses **layered surfaces** (progressively lighter backgrounds) plus subtle shadows to create hierarchy. This is the Linear/Vercel approach — surfaces stack visually without hard edges.

```css
:root {
  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.3);                  /* Cards resting */
  --shadow-md:  0 4px 12px rgba(0, 0, 0, 0.25);                 /* Cards hovered, dropdowns */
  --shadow-lg:  0 8px 24px rgba(0, 0, 0, 0.35);                 /* Modals, command palette */
  --shadow-glow: 0 0 0 1px var(--accent), 0 0 12px var(--accent-subtle); /* Focus rings */
}
```

Borders are used only for data tables and dividers — never as the primary way to separate content areas. When a border is needed, it's `1px solid var(--bg-subtle)` — nearly invisible, just enough to delineate without competing.

### 6.3 Motion & Micro-Interactions

This is where Pathfinder separates from "functional side project" and enters "this person builds products." Every transition and animation serves one of two purposes: it either **communicates state change** (something happened) or **maintains spatial orientation** (something moved).

#### 6.3.1 Timing Tokens

```css
:root {
  --duration-fast:   100ms;   /* Hover states, color changes, opacity */
  --duration-normal: 200ms;   /* Dropdowns, tooltips, small reveals */
  --duration-slow:   300ms;   /* Panel slides, card expand/collapse */
  --duration-enter:  250ms;   /* Elements appearing */
  --duration-exit:   200ms;   /* Elements disappearing (faster = snappier) */

  --ease-default:    cubic-bezier(0.16, 1, 0.3, 1);     /* Deceleration — things settle into place */
  --ease-in:         cubic-bezier(0.55, 0, 1, 0.45);     /* Acceleration — things leave */
  --ease-bounce:     cubic-bezier(0.34, 1.56, 0.64, 1);  /* Slight overshoot — playful emphasis */
}
```

**Rules:** Exits are faster than entrances (things disappear at 200ms, appear at 250ms — this feels snappy). Hover states respond in under 100ms (anything slower feels laggy). Never use `ease` or `linear` — always the custom curves above. No spring/bounce on professional actions (save, submit, transition); reserve `--ease-bounce` for delightful moments (streak counter incrementing, score badge updating).

#### 6.3.2 Signature Interactions

These are the moments people remember after a demo:

**Streaming text.** Research briefs and resume drafts render character-by-character with a subtle cursor pulse — like watching Claude think. Completed sections have full opacity; the active section has a soft indigo left-border glow (`var(--shadow-glow)`); upcoming sections show as skeleton lines at 8% opacity. This turns a loading state into a compelling visual.

**Stage transition.** When a role moves stages (e.g., Applied → Screen), the pipeline card briefly pulses with the new stage color, the badge morphs with a 200ms cross-fade, and a subtle confetti-like particle burst marks the progression. For regressions (Screen → Closed/Rejected), the animation is muted — a quiet fade to gray. Celebrations for forward progress, quiet acknowledgment for setbacks.

**Score reveal.** When the Job Feed calculates a match score, the number counts up from 0 to the final value over 400ms with `--ease-bounce`. The bar fills in sync. A score above 80 gets a brief emerald glow; below 40 gets a subtle red flash. This makes feed review feel dynamic, not like reading a spreadsheet.

**Command palette.** `Cmd+K` (or `/` from anywhere) opens a centered command palette — Linear's signature interaction. Fade-in at 150ms with a 4px upward slide. Type to search across companies, roles, agents, and actions. Results filter in real-time. This is the single most demo-impressive feature: it signals "this is a real application, not a collection of HTML pages."

**Card hover.** Pipeline cards lift on hover: `translateY(-2px)` + `var(--shadow-md)` at 150ms. Subtle but visceral — it communicates interactivity without being distracting. The current card has a faint accent left-border that appears on hover.

**Toast notifications.** Success/error feedback uses a toast system: slides in from bottom-right, auto-dismisses after 4 seconds, manually dismissable. Green left-border for success, red for error, amber for warning. Appears with `--ease-default`, exits with `--ease-in`. Never more than 2 toasts stacked.

### 6.4 Component Library

All agents share a component library defined in `pathfinder.css` (design tokens + base styles) and `pathfinder.js` (interactive behaviors). Each component has three states designed: default, hover/focus, and disabled.

**Cards** — the primary container. Structure: header (title + status badges), body (2-4 key-value pairs), footer (ghost action buttons). Cards use `var(--bg-surface)` background, `var(--shadow-sm)` resting shadow, and lift to `var(--shadow-md)` on hover. Expand/collapse with a 300ms height animation for progressive disclosure. The expanded state reveals full JD, fit assessment, and attached artifacts.

**Badges** — pill-shaped (`border-radius: 9999px`), 13px font, 4px vertical / 8px horizontal padding. Three variants: **filled** (for stages and tiers — colored background, white text), **outlined** (for metadata like positioning, interview type — colored border, colored text, transparent background), **ghost** (for counts and minor labels — `var(--bg-elevated)` background, secondary text). Badges use the semantic and stage color tokens — never ad-hoc colors.

**Buttons** — three tiers: **primary** (filled `var(--accent)`, white text — one per view, the main action), **secondary** (outlined, accent border — supporting actions), **ghost** (text-only, appears on hover within cards — tertiary actions). All buttons have a 100ms background transition on hover. Destructive variants replace accent with `var(--danger)`. Minimum hit target: 36px height, 80px width.

**Tables** — for data-dense views (company profiles, connections, comp benchmarks, story bank). Alternating row backgrounds (`var(--bg-base)` / `var(--bg-surface)`), fixed headers on scroll, sortable columns with a subtle arrow indicator. Left-align text, right-align numbers, monospace for dates and scores. Row hover highlights with `var(--bg-elevated)`.

**Streaming container** — Pathfinder's signature component. Used by Research Brief, Resume Tailor, and Mock Interview agents. Active section: left border glow (`2px solid var(--accent)` with `box-shadow: var(--shadow-glow)`), full opacity. Completed sections: no border, full opacity, checkmark icon in section header. Pending sections: skeleton text lines at 8% opacity, no interaction. The transition from active to completed plays a brief 200ms fade of the glow + checkmark appear.

**Score bar** — horizontal progress bar for match scores (0-100) and interview ratings (1-5). Bar fills from left with the score-appropriate color (emerald ≥80, amber 60-79, red <60). Score number overlaid in monospace font. On initial render, the bar animates from 0% to final width over 400ms with `--ease-bounce`.

**Empty states** — every view has one. Centered vertically, max-width 400px. A single muted icon (from a consistent icon set), a one-line explanation in `--text-secondary`, and a prominent CTA button. Example: Pipeline empty state shows a compass icon, "No roles tracked yet", and a "Paste a job description" primary button that opens the quick-add input. No blank pages, ever.

**Command palette** — modal overlay with `var(--bg-elevated)` background, `var(--shadow-lg)` shadow, 480px max-width centered. Input field with auto-focus. Results grouped by type (Companies, Roles, Actions, Agents) with keyboard navigation (arrow keys + enter). Each result shows an icon, title, and subtitle. `Esc` or click-outside to dismiss.

### 6.5 Layout Patterns

**Dashboard:** Single-column, max `720px` centered. Top: greeting + streak counter with day-count animation. Middle: action queue (cards sorted by urgency — overdue red, due-today amber, suggested blue). Bottom: pipeline summary as a compact horizontal bar chart showing role counts by stage. No sidebar, no grid — vertical scroll, scannable in 10 seconds.

**Pipeline:** Full-width. Default: **kanban** — stage columns scroll horizontally, cards stack vertically within each column, drag-and-drop to transition. Column headers show stage badge + count. Alt view: **table** — sortable by any column, with inline stage-transition dropdowns. Toggle persists in localStorage. Kanban for visual overview, table for power-user scanning at 50+ roles.

**Agent views:** Two-panel. **Left panel** (320px, collapsible): context sidebar — company profile summary, role details, positioning badge, fit assessment snapshot, relevant artifacts list. This is the shared context that every agent consumes. **Right panel** (fluid): the agent's workspace. For Research Brief: streaming sections. For Resume Tailor: JD analysis → generated resume preview. For Mock Interview: Q&A thread. The sidebar collapse gives full-width for focus mode. All agent views share the same sidebar component — built once, used everywhere.

**Feed Review:** Card grid, 3 columns on desktop, 2 on tablet, 1 on mobile. Each card: company name, role title, match score bar, source badge (Gmail/Indeed/Dice), posted date, and quick-action row (Accept / Dismiss / Snooze). Sorted by match score descending by default. Filter bar at top: source, score range, date range. Accept animates the card sliding right and fading; Dismiss slides left.

### 6.6 Keyboard System

Pathfinder is keyboard-navigable end-to-end. This isn't just accessibility — it's a core UX principle and a demo differentiator. When an interviewer sees you navigate an entire job search tool without touching the mouse, that communicates more about your product thinking than any architecture diagram.

**Global shortcuts (work on any page):**

| Key | Action |
|-----|--------|
| `Cmd+K` / `Ctrl+K` | Open command palette |
| `G` then `D` | Go to Dashboard |
| `G` then `P` | Go to Pipeline |
| `G` then `F` | Go to Feed Review |
| `N` | New role (opens quick-add) |
| `?` | Show keyboard shortcut overlay |
| `Cmd+\` / `Ctrl+\` | Toggle dark/light mode |

**Pipeline shortcuts (when Pipeline is active):**

| Key | Action |
|-----|--------|
| `J` / `K` | Move selection down/up through cards |
| `Enter` | Expand selected card |
| `Esc` | Collapse / deselect |
| `R` | Generate research brief for selected role |
| `T` | Generate tailored resume for selected role |
| `M` | Start mock interview for selected role |
| `S` | Change stage (opens stage picker) |
| `1`–`8` | Jump to stage column |
| `/` | Focus search |

**Agent view shortcuts:** Each agent defines its own contextual shortcuts (e.g., Mock Interview: `Space` to submit answer, `N` for next question, `H` for hint). These are shown in a subtle shortcut hint bar at the bottom of the agent view.

### 6.7 Dark Mode & Theming

Dark mode is the default and the primary demo mode. It's not an afterthought — the entire color system is designed dark-first. Light mode is achieved by swapping the surface and text token groups:

```css
[data-theme="light"] {
  --bg-base:       #ffffff;
  --bg-surface:    #f4f4f5;
  --bg-elevated:   #e4e4e7;
  --bg-subtle:     #d4d4d8;
  --text-primary:  #09090b;
  --text-secondary:#52525b;
  --text-tertiary: #a1a1aa;
  /* Accent, semantic, tier, and stage colors stay identical */
}
```

The toggle is a smooth cross-fade (200ms on `background-color` and `color` properties via CSS transitions on `*`). No flash, no FOUC (Flash of Unstyled Content). Theme preference persists in localStorage and respects `prefers-color-scheme` on first visit.

### 6.8 Demo Polish Checklist

These are the specific details that make Pathfinder demo-ready — the things that, individually, are tiny, but collectively signal "this person builds real products":

- [ ] **Focus management:** After every action (add role, generate brief, change stage), focus moves to the logical next element. No lost focus, no "where did my cursor go."
- [ ] **Loading skeletons:** Every data-dependent view has a skeleton state that matches the final layout shape — not a generic spinner, but placeholder rectangles that shimmer and morph into real content.
- [ ] **Responsive at every breakpoint:** Not just "it doesn't break on mobile" but "it's actually usable on a tablet." Dashboard, Pipeline (table view), and Feed Review all work at 768px. See 6.9 Mobile Considerations for the full responsive strategy.
- [ ] **Favicon + page titles:** Each agent page has a descriptive `<title>` ("Pathfinder — Pipeline" / "Pathfinder — Research Brief: Stripe") and a custom favicon. Browser tabs should be identifiable.
- [ ] **Consistent scroll behavior:** `scroll-behavior: smooth` globally. Anchor links in research briefs scroll to sections. Pipeline stage columns scroll independently.
- [ ] **Selection persistence:** When you navigate away from Pipeline and come back, the same card is selected. When you switch agent views and return, your scroll position is preserved. State survives navigation.
- [ ] **Error states:** Network errors, MCP failures, and API timeouts all have designed error states — not raw error text. A friendly message, a retry button, and a "what happened" expandable detail.
- [ ] **Print stylesheet:** Research briefs and resume previews have a `@media print` stylesheet that strips the UI chrome and produces a clean, printable document.
- [ ] **Transition on page load:** The page fades in over 200ms on initial load — no jarring snap from blank to content. Combined with instant static-HTML loading, this feels impossibly smooth.
- [ ] **Consistent iconography:** One icon set (Lucide or Phosphor), one size per context (16px inline, 20px in buttons, 24px in empty states). No mixing icon libraries, no inconsistent stroke weights.

### 6.9 Mobile Considerations

Pathfinder is desktop-first — a serious job search tool used in focused work sessions. But it must be usable on tablets and not broken on phones, both for practical use (quick pipeline checks on the go) and demo credibility (an interviewer pulling it up on their iPad).

**Breakpoint strategy:**

| Breakpoint | Target | Layout Adaptation |
|------------|--------|-------------------|
| `≥1200px` | Desktop (primary) | Full layout: sidebars, multi-column grids, all keyboard shortcuts |
| `768-1199px` | Tablet | Collapsible sidebars (default collapsed), 2-column feed grid, stacked agent views (context above workspace) |
| `<768px` | Phone (read-only graceful) | Single column, simplified cards, no keyboard shortcuts, bottom tab navigation replaces sidebar nav |

**What works well on mobile:**
- Dashboard: action queue as a vertical card list, pipeline summary as compact numbers
- Pipeline: card view (not table), swipe for stage transitions, pull-to-refresh
- Feed Review: single-column cards with swipe-to-accept/dismiss
- Research Briefs: read-only scrollable document, section navigation via floating TOC button

**What stays desktop-only:**
- Resume generation and preview (layout precision requires desktop)
- Mock interview sessions (long-form text interaction)
- Bulk pipeline operations (multi-select, drag-and-drop)
- Command palette (keyboard-dependent)

**Implementation approach:** CSS media queries with the design system's breakpoint tokens. No separate mobile codebase. Touch targets are minimum 44x44px on mobile. Font sizes increase slightly on mobile (`--text-sm` becomes 14px instead of 13px). The `<meta name="viewport">` tag is set correctly on every page.

## 7. Module Specifications

### 7.1 Pipeline Tracker (with Connections)

The Pipeline Tracker is the data backbone of Pathfinder. Every other agent reads from it. It manages two related but distinct entities: **companies** (long-lived, accumulate context over time) and **roles** (specific opportunities at those companies, each with its own lifecycle).

#### 7.1.1 Companies

Companies enter the system through three channels: manual entry, the Job Feed Listener (Phase 3), or as a side effect of adding a role. Each company carries metadata that persists across roles and informs every agent.

A company record serves two purposes: it's the **early-funnel intelligence profile** you build before you ever apply, and it's the **persistent context** that all agents reference throughout the lifecycle. When a company first enters the system (via job feed, referral, or manual add), the profile starts sparse — just a name and maybe a domain. As you research, network, and engage, the profile fills in. The Research Brief agent can auto-populate many of these fields.

**Company Profile fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Company name (canonical, used as key across agents) |
| `url` | string | Company website URL (e.g., `https://stripe.com`) — used for logo fetching and research |
| `logoUrl` | string | Company logo URL, auto-fetched from `{url}/favicon.ico` or Clearbit Logo API (`https://logo.clearbit.com/{domain}`) |
| `tier` | enum | Priority tier (see 7.1.2) |
| `dateAdded` | date | When the company entered the system |
| `connections` | array | Linked contacts at this company (see 7.1.5) |
| `enrichmentStatus` | enum | `pending`, `in_progress`, `complete`, `failed` — tracks auto-enrichment state |

**Company Overview** — early-funnel intelligence that informs positioning and prioritization:

| Field | Type | Description |
|-------|------|-------------|
| `missionStatement` | text | Company mission / what they do, in one sentence |
| `domain` | string | Primary domain: AdTech, AI/ML, Data Platform, Fintech, Enterprise SaaS, Marketplace, Healthcare, Security, etc. |
| `companyType` | enum | `startup`, `scaleup`, `enterprise`, `public`, `government`, `nonprofit` |
| `fundingStage` | string | Seed, Series A/B/C/D, Late-stage, Pre-IPO, Public, Bootstrapped |
| `lastFundingAmount` | string | e.g., "$150M Series D" — helps calibrate comp expectations |
| `totalFunding` | string | Total raised to date, if known |
| `headcount` | string | Approximate employee count or range (e.g., "500-1000") |
| `yearFounded` | number | Founding year — signals maturity and culture |
| `hqLocation` | string | HQ city/region |
| `remotePolicy` | enum | `remote`, `hybrid`, `onsite`, `unknown` |
| `techStack` | array | Known technologies — useful for matching and interview prep |
| `keyProducts` | array | Primary products/platforms — helps frame your experience against their stack |
| `competitors` | array | Known competitors — useful for positioning in interviews |
| `recentNews` | array | `[{date, headline, url}]` — funding rounds, launches, layoffs, pivots |
| `glassdoorRating` | number | Overall rating (1-5), if available |
| `culture` | string | Open, Hierarchical, Fast-Paced, Engineering-Led, Sales-Led |
| `whyInteresting` | text | Your personal notes on why this company is worth pursuing |
| `notes` | text | Freeform notes — intelligence gathered from networking calls, research, etc. |

Many of these fields start empty and get populated over time — through manual research, networking conversations, or eventually by the Research Brief agent auto-filling from public sources. The Pipeline UI should visually indicate **profile completeness** to nudge you toward filling gaps before advancing roles to later stages.

The company list is **not capped**. It grows continuously as the Job Feed Listener surfaces new opportunities, as networking conversations reveal new targets, and as the user discovers roles organically. Tiers control attention allocation, not list size.

**Auto-Enrichment on Funnel Entry:**

The moment a company enters the system — whether through manual add, Job Feed Listener, or as a side effect of adding a role — Pathfinder kicks off automatic data capture. This is not a background process that runs later; it fires immediately on creation:

1. **Logo fetch:** Query `https://logo.clearbit.com/{domain}` (free, no API key) or fall back to `{url}/favicon.ico`. Cache locally via Artifacts MCP. Display on all pipeline cards and company profiles.
2. **Basic profile enrichment:** Use the company URL to extract: mission statement, domain, headcount range, HQ location, funding stage (from Crunchbase/PitchBook data if available). Auto-populate the Company Overview fields.
3. **News scan:** Search for recent news (last 6 months) — funding rounds, product launches, layoffs, leadership changes. Populate the `recentNews` array.
4. **Glassdoor/culture signal:** Search for Glassdoor rating and top culture tags. Populate `glassdoorRating` and `culture`.

This enrichment runs in `discovered` stage. The full Research Brief (10-section deep dive) is reserved for when the role moves to `researching` — that's the trigger for the deeper analysis. But the job seeker should never see a blank company card; the auto-enrichment ensures there's always something useful from the moment a company enters the funnel.

**Company Lookup on Manual Add:**

When adding a company manually, the Pipeline Tracker provides an inline lookup tool. The job seeker starts typing a company name, and Pathfinder searches:

1. **Existing companies** in the pipeline (prevents duplicates)
2. **Web search** for the company to auto-suggest the canonical name, URL, and domain
3. **Known company databases** (if integrated) — Crunchbase, LinkedIn, Apollo

The lookup returns a card preview showing: company name, logo, domain, headcount, funding stage, and HQ location. The job seeker confirms or edits, and the full auto-enrichment kicks off immediately. This reduces the "paste a name and fill in 20 fields manually" friction to "type a name, confirm the match, done."

#### 7.1.2 Priority Tiers

Tiers are purely about **urgency and attention frequency**. They are not company categories — a Series B startup and Google can both be Tier 1 if they're top targets.

| Tier | Label | Check Frequency | Response Time | Description |
|------|-------|----------------|---------------|-------------|
| 1 | **Hot** | 3x/week (Mon/Wed/Fri) | Apply same day | Dream targets. Active roles you'd accept tomorrow. |
| 2 | **Active** | Weekly (Monday) | Apply within 3 days | Strong fit companies. High probability of interview. |
| 3 | **Watching** | Bi-weekly | Apply within 1 week | Good fit but lower priority — waiting for right role to open. |
| 4 | **Dormant** | Monthly | Evaluate when surfaced | Worth monitoring. May promote to higher tier if relevant role appears. |

Tiers are mutable — a Dormant company promoting to Hot when a perfect role posts is expected behavior. The Job Feed Listener can suggest tier promotions based on role match quality.

#### 7.1.3 Roles & Lifecycle Stages

A role is a specific opportunity at a company. It's the primary unit that flows through the pipeline and triggers agent actions. One company can have multiple concurrent roles at different stages.

**Role fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `company` | string | Company name (links to company record) |
| `title` | string | Role title as posted (e.g., "Staff Product Manager, AI Platform") |
| `url` | string | Link to job posting |
| `jdText` | text | Full job description text (pasted or scraped). **This is the atomic input that all agents consume.** |
| `positioning` | enum | `ic` or `management` — how you're framing yourself for this role. Determines resume strategy, seniority calibration, and TMAY pitch. |
| `targetLevel` | string | Seniority you're targeting: Senior PM, Staff PM, Principal PM, Director, VP |
| `source` | enum | `inbound` (recruiter reached out), `outbound` (you found it), `referral`, `job_feed` |
| `referral` | object | If referred: `{name, relationship, date, status}` |
| `stage` | enum | Current lifecycle stage (see below) |
| `stageHistory` | array | Timestamped log of every stage transition |
| `salary` | object | `{min, max, currency, equity, notes}` — comp info as discovered |
| `interviewTypes` | array | Which interview formats are expected: `[execution, strategy, design, sense, behavioral, technical, homework]` |
| `closeReason` | enum | When closed: `offer_accepted`, `offer_declined`, `rejected`, `withdrew`, `ghosted`, `role_frozen`, `down_leveled` |
| `fitAssessment` | object | `{strongMatch: [], gaps: [], borderlineTerms: []}` — from Resume Tailor's JD analysis |
| `dateAdded` | date | When role entered the system |
| `lastActivity` | date | Last stage transition or action taken |

**Lifecycle Stages:**

The pipeline has 8 stages reflecting the real job search lifecycle. Each stage has defined entry criteria, expected actions, and agent suggestions. The original 10-stage model was consolidated: `homework` folds into the `interviewing` stage (it's a sub-activity of the interview loop, not a distinct pipeline phase), and `offer` + `negotiation` merge into a single `offer` stage (negotiation is what you do while in the offer stage, not a separate step).

| Stage | Label | Entry Trigger | Key Actions | Agent Suggestions |
|-------|-------|--------------|-------------|-------------------|
| `discovered` | Discovered | Role found (manual, feed, or referral) | Paste JD, set positioning, assess fit | Resume Tailor: "Run JD analysis?" |
| `researching` | Researching | User decides to pursue | Research company, fill company profile, review connections | Research Brief: "Generate brief?" |
| `outreach` | Outreach | Ready to make contact | Identify referrers, send connection requests, cold emails | Pipeline: "3 connections at this company" |
| `applied` | Applied | Application submitted | Track submission date, follow up with referrer | Pipeline: "Follow up in 5 days?" |
| `screen` | Screen | Recruiter/hiring manager call scheduled | Prep for screen, confirm level + comp band | Research Brief: "Review company sections" |
| `interviewing` | Interviewing | Formal interview loop scheduled | Prep for each interview type, research interviewers, complete take-homes | Research Brief: "Generate interviewer insights" |
| `offer` | Offer | Verbal or written offer received | Log comp details, run negotiation scorecard, track counter-offers, decision timeline | Pipeline: "Run negotiation assessment" |
| `closed` | Closed | Final outcome reached | Log close reason, retrospective notes | Dashboard: update conversion metrics |

**Sub-states within Interviewing:**

The `interviewing` stage is the most complex phase and benefits from internal tracking without inflating the pipeline with extra columns. Each role in `interviewing` tracks:

- `interviewSubState`: `prep`, `in_loop`, `take_home`, `awaiting_decision` — rendered as a badge on the kanban card
- `interviewRounds`: array of `{date, type, interviewers, status, notes}` — logs each round
- `homeworkAssignment`: `{receivedDate, dueDate, submittedDate, artifactId}` — when a take-home is assigned, tracked here and auto-saved via Artifacts MCP

**Sub-states within Offer:**

The `offer` stage covers everything from initial offer through final decision:

- `offerSubState`: `received`, `evaluating`, `negotiating`, `decision_pending`
- `offerDetails`: `{base, bonus, equity, signOn, title, level, startDate, deadline}`
- `counterOffers`: array of `{date, yourAsk, theirResponse, notes}`
- `negotiationScorecard`: 25-point system across five dimensions (compensation, scope, growth, culture, risk factors)

**Stage transition rules:**

Stages are sequential but skippable — a referral might jump from `discovered` directly to `screen`. Every transition is timestamped in `stageHistory`. The system tracks **time-in-stage** for nudges: 3+ weeks in `applied` triggers a "ghosted?" prompt; 48+ hours in `offer` without action triggers a "respond to offer" nudge.

Backward transitions are allowed (e.g., `interviewing` → `screen` if they add another screen round) but logged as unusual.

#### 7.1.4 Positioning & Framing

The `positioning` field on each role is a critical input to the Resume Tailor and Research Brief agents. It controls:

| Positioning | Resume Strategy | TMAY Pitch | Title Framing |
|-------------|----------------|------------|---------------|
| `ic` | Emphasize depth: systems built, technical decisions made, individual ownership. Lead with JPMC agentic AI and Yahoo targeting scale. | "Principal-level Product leader..." Focus on what *you* built. | Match to JD: Principal PM, Staff PM, Senior PM |
| `management` | Emphasize breadth: team leadership, cross-functional influence, organizational outcomes. Lead with Yahoo progression (Principal → Director → Sr. Director) and org-level impact. | "Director-level Product leader..." Focus on what *your teams* delivered. | Match to JD: Director, VP, Head of Product |

This flexibility acknowledges reality: at smaller startups, the comp band for a Director/VP may be necessary to hit target compensation, even though the same person targets IC Principal roles at larger companies. The system should never force a single narrative.

#### 7.1.5 Connections

Connections are linked at the **company level** but can be tagged to specific roles. A connection record represents a person you know (or have reached out to) at a target company.

**Connection fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Contact name |
| `company` | string | Company they work at |
| `title` | string | Their current role |
| `relationship` | enum | `former_colleague`, `linkedin_1st`, `linkedin_2nd`, `cold_outreach`, `recruiter`, `hiring_manager` |
| `linkedRoles` | array | Specific role IDs this connection is relevant to (e.g., they're on the hiring team) |
| `outreachLog` | array | Timestamped sequence: `[{date, method, note}]` — tracks LinkedIn request, email, InMail, calls |
| `referralStatus` | enum | `none`, `asked`, `agreed`, `submitted`, `confirmed` |
| `source` | string | How you found them: LinkedIn import, networking call, recruiter |
| `notes` | text | Key takeaways from conversations (links to takeaway docs in Artifacts MCP) |

The outreach log tracks the recommended networking sequence: LinkedIn connect (day 1) → profile view (day 2) → cold email (days 3-5) → InMail (last resort). The Pipeline Tracker surfaces connection counts on role cards and suggests outreach actions based on stage.

**LinkedIn Connection Prioritization Logic:**

When displaying or suggesting connections at a target company, Pathfinder ranks contacts using a weighted scoring system that favors people most likely to be useful referrers or provide relevant intel:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| **Function: Product Management** | +30 | PMs hire PMs. A PM at the target company is the single most valuable connection. |
| **Function: Engineering / Technical** | +25 | Engineers work closest with PMs and often have referral influence. Eng managers even more so. |
| **Function: Design / Data Science** | +15 | Adjacent functions that frequently collaborate with PM. |
| **Title seniority: Director+** | +20 | Senior people have more hiring influence and broader org visibility. |
| **Title seniority: Manager / Lead** | +10 | Mid-level has less influence but more accessibility. |
| **Relationship: Former colleague** | +25 | Warm connections convert at 5-10x the rate of cold outreach. |
| **Relationship: 1st-degree LinkedIn** | +10 | You're already connected — lower friction. |
| **Relationship: 2nd-degree LinkedIn** | +5 | Reachable through a mutual connection. |
| **Recency: Active in last 90 days** | +5 | Still at the company and engaged. |

**Example:** A Director of Engineering (1st-degree, former colleague) at Stripe scores: 25 (eng) + 20 (director) + 25 (former colleague) + 10 (1st-degree) + 5 (recent) = **85**. A Marketing Associate (2nd-degree, cold) scores: 0 (marketing) + 0 (junior) + 0 (cold) + 5 (2nd-degree) = **5**. The Pipeline Tracker surfaces connections sorted by this score, ensuring the job seeker reaches out to the highest-value contacts first.

Functions outside Product, Engineering, Design, and Data Science (e.g., Marketing, Sales, HR, Legal) receive no function bonus — they're still shown but ranked below relevant contacts. Recruiters at the company are always surfaced separately in a "Recruiting Team" section regardless of score.

**LinkedIn CSV import** — bulk-import 1st-degree connections from a LinkedIn data export and auto-match to companies in the pipeline.

#### 7.1.6 Pipeline UI

The Pipeline Tracker renders as a **kanban board** with columns for each active stage (`discovered` through `negotiation`; `closed` roles accessible via filter). Each card shows: company name, role title, tier color, positioning badge (IC/Mgmt), days-in-stage, connection count, and artifact count. Cards support drag-and-drop for stage transitions.

**Per-role detail view** includes: full JD text, fit assessment, stage history timeline, linked connections with outreach status, linked artifacts (research brief, tailored resume, homework submissions, offer letters), comms log, and notes.

**Resume Sent** — The detail panel includes a "Resume Sent" section where users can upload externally-created resumes (PDF or DOCX) via drag-and-drop or file picker. Each attachment stores: filename, file size, upload date, optional notes (e.g., "tailored for data product focus"), and a pointer to IndexedDB where the actual file blob lives. Users can preview (opens in new tab, works natively for PDFs), download, or remove attached resumes. Multiple resumes can be attached per role (e.g., initial submission + revised version). File metadata lives on the role object in localStorage (`resumesSent[]`); binary content lives in IndexedDB (`pf_resumes` database, `files` object store) to avoid hitting localStorage's ~5MB limit.

| Field | Type | Location | Description |
|-------|------|----------|-------------|
| `resumesSent` | array | Role object (localStorage) | `[{ filename, size, type, date, notes, indexedDbKey }]` |
| File blobs | ArrayBuffer | IndexedDB `pf_resumes.files` | Keyed by `resume-{roleId}-{index}` |

**Comms Log** — A timestamped, free-form interaction log that complements Stage History. Each entry captures: a note (call summary, email exchange, recruiter update), the communication channel (Email, LinkedIn, Phone, Video Call, In Person, Other), an optional link (to the email thread, calendar invite, LinkedIn message), and an optional connection tie (selecting which contact this interaction was with). Entries display newest-first with channel icons, contact name, timestamp, note text, and clickable link. This creates a complete audit trail of every interaction with every contact for every role.

| Field | Type | Location | Description |
|-------|------|----------|-------------|
| `commsLog` | array | Role object (localStorage) | `[{ date, note, link, channel, contactId, contactName }]` |

#### 7.1.7 Opaque Recruiter Outreach (Unknown Company, Unknown Role, or Both)

Recruiters frequently withhold details early in the process. Three common patterns:

1. **Unknown company, described role** — "I'm hiring a Staff PM for a Series D AI company" (you know the role, not who)
2. **Known company, unknown role** — "We have something at Stripe that might be a fit" (you know who, not what)
3. **Both unknown** — "I'm working on a confidential search" (you know neither)

Pathfinder must support all three from first contact through full reveal, without blocking Pipeline tracking.

**Data Model Changes:**

The `Role` record gains a `confidential` object and the `Company` record gains a `knownAttributes` field:

**Role-level fields (new):**

| Field | Type | Description |
|-------|------|-------------|
| `confidential` | object | `{ company: boolean, role: boolean }` — which parts are undisclosed. Default: `{ company: false, role: false }` |
| `roleHints` | object | Partial intel when role is opaque: `{ function, level, scope, teamSize, productArea, techStack, reportingLine, location }` — whatever the recruiter disclosed |
| `knownContext` | array | Chronological log of intel from recruiter conversations: `[{ date, source, channel, note }]` — each entry captures what was learned and when. Source is the person's name, channel is `email` / `call` / `linkedin` / `text`. Feeds into Research Brief Section 0 (Known Context) as a JD substitute |
| `recruiterSource` | object | `{ name, firm, email, firstContact, channel }` — who brought this to you and when |

**Company-level fields (new):**

| Field | Type | Description |
|-------|------|-------------|
| `knownAttributes` | object | Partial intel when company is opaque: `{ industry, stage, headcount, location, fundingHints, productHints, publicPrivate }` |

**Placeholder naming conventions:**

- Unknown company: `"Unknown — [Recruiter Name/Firm]"` (e.g., `"Unknown — Sarah Chen / Greylock"`)
- Unknown role at known company: Company stays as-is, role title = `"TBD — [function hint]"` (e.g., `"TBD — Product Leadership"`)
- Both unknown: Placeholder company name + placeholder role title

**Pipeline UI Behavior:**

- **Kanban cards** for opaque roles show a `?` icon overlay (on company logo if company unknown, on role title if role unknown, or both). Muted/dashed border distinguishes them visually.
- **Role Detail panel** shows an **"Intel Gathered"** section (always visible for opaque roles) with two groups:
  - **Company Intel** — log partial attributes as you learn them: industry, size, funding stage, product hints, location, public/private
  - **Role Intel** — log partial attributes: function, level, scope, team size, product area, tech mentions
  Each attribute is timestamped and cited to the source (usually the recruiter email/call).
- **"Reveal Company" action** — When the company is identified: enter the real name → Pathfinder creates or links to an existing Company record → merges `knownAttributes` into the company profile → flips `confidential.company` to `false` → triggers Research Brief for newly-available sections → logs citation.
- **"Reveal Role" action** — When the role is specified: enter the real title + JD → merges `roleHints` into role record → flips `confidential.role` to `false` → triggers Brief sections that depend on JD → logs citation.
- **Connections** — The recruiter is auto-created as a connection with `relationship: 'recruiter'` and linked to the role on creation.

**Lifecycle Examples:**

```
CASE 1: Unknown company, described role
─────────────────────────────────────────
Recruiter email: "Staff PM role at a Series D AI company, 200-500 people"
    │
    ▼
Create: company = "Unknown — Sarah Chen / Greylock"
        confidential = { company: true, role: false }
        knownAttributes = { industry: "AI", stage: "Series D", headcount: "200-500" }
        role.title = "Staff Product Manager"
        role.jdText = (partial JD if provided)
    │
    ▼
Brief generates in company-degraded mode:
  ✅ Role Decode, Fit Analysis, TMAY, Interview Questions (JD-dependent sections work)
  ⚠ Company Now, Funding, Competitive, Culture (blocked — need company name)
  ⚠ Network & Connections (can't cross-reference without company)
    │
    ▼
Reveal: "It's Anthropic" → full brief unlocks

CASE 2: Known company, unknown role
─────────────────────────────────────
Recruiter: "We have something at Stripe that might interest you"
    │
    ▼
Create: company = "Stripe" (existing or new Company record)
        confidential = { company: false, role: true }
        role.title = "TBD — Product Leadership"
        role.roleHints = { function: "product", level: "senior/staff" }
    │
    ▼
Brief generates in role-degraded mode:
  ✅ Company Now, Funding, Competitive, Culture, Network (company sections work)
  ⚠ Role Decode, Fit Analysis, TMAY, Interview Questions (blocked — need JD)
  ⚠ Strategic Challenges (partial — company context available, role specifics not)
    │
    ▼
Reveal: JD received → full brief unlocks

CASE 3: Both unknown
─────────────────────
Recruiter: "Confidential search, will share more after intro call"
    │
    ▼
Create: company = "Unknown — Recruiter Name"
        confidential = { company: true, role: true }
        role.title = "TBD"
    │
    ▼
Brief in full-degraded mode: most sections blocked, only generic prep available
    │
    ▼
Reveal company first (partial unlock) → reveal role (full unlock)
```

**Research Brief Impact:**

Opaque roles trigger **degraded mode** in the Research Brief — sections that require missing data show a clear message explaining what's blocked and what info would unblock them. See the standalone Research Brief PRD (`docs/research-brief-prd.md`) Section 3.1 for the full degraded-mode specification, including which sections work in each degraded state.

### 7.2 Research Brief Agent

> **Full specification:** [`docs/research-brief-prd.md`](research-brief-prd.md) — standalone PRD (v2.0.0)

The Research Brief is Pathfinder's preparation engine. Before every interview, networking call, or application decision, it generates a comprehensive, role-tailored briefing document with 13 sections — every one anchored to the JD text and the user's actual experience.

**v2 overhaul (v1.3.8):** The Research Brief was rebuilt from the ground up. v1 was a UI shell with hardcoded template strings. v2 generates every section via MCP tool calls (`pf_generate_brief_section`), fed with real data (JD text, company profile, resume bullets, story bank, connections), and sourced with citations per Section 7.12.

#### 7.2.1 Brief Sections (v2)

13 sections, organized as: understand the role → understand the company → understand the people → understand your fit → prepare to perform.

| # | Section | Purpose | Key Inputs |
|---|---------|---------|------------|
| 1 | Role Decode | Parse JD: real problem, explicit/implied requirements, level signals, red flags | JD text |
| 2 | Company Now | What's happening right now relevant to this role — news, launches, leadership changes | Company profile, web enrichment |
| 3 | Funding & Corporate Structure | Funding rounds, investors, board, subsidiaries, acquisitions, financial health | Company profile, web enrichment |
| 4 | Competitive Landscape | Named competitors in this role's product area, market dynamics, moat | JD text, company profile |
| 5 | Team & Org Intelligence | Hiring manager, reporting line, team shape, interviewer research | JD text, interviewer names, connections |
| 6 | Network & Connections | Who you know at this company, second-degree paths, warm intro candidates | `pf_connections` |
| 7 | Fit Analysis | Your bullets vs JD requirements — green/yellow/red with gap positioning strategies | JD text, `pf_bullet_bank`, `pf_resume_log` |
| 8 | Compensation Intelligence | Expected range, equity structure, negotiation leverage signals | `pf_comp_cache`, JD text |
| 9 | Strategic Challenges & First 90 Days | What this role tackles first, your hypotheses for the interview | JD text, company context, Section 1+2+4 outputs |
| 10 | Culture & Values Decode | Stated values vs reality, interview style signals, what gets rewarded | Company profile, culture data |
| 11 | Questions to Ask | Role-specific, organized by round (recruiter, HM, panel, exec) | All previous sections |
| 12 | TMAY Script | "Tell me About Yourself" — 90-sec and 2-min versions from your resume | `pf_bullet_bank`, Section 1 output |
| 13 | Likely Interview Questions | Behavioral + technical from JD, matched to STAR stories from your bank | `pf_story_bank`, `pf_bullet_bank`, Section 1+7 outputs |

#### 7.2.2 Generation Architecture

All generation runs through MCP tool calls — no API keys in the browser. Sections execute in three batches based on dependencies:

- **Batch 1** (parallel): Sections 1, 2, 3, 4, 5, 6, 8, 10 — all independent
- **Batch 2** (parallel, after Batch 1): Sections 7, 9, 12, 13 — depend on earlier outputs
- **Batch 3** (after Batch 2): Section 11 — synthesizes from all other sections

Each section generates citations saved via `pf_save_citation` and content saved as MCP artifacts. See the standalone PRD for full prompt construction, caching/invalidation logic, degraded mode (unknown companies), export formats, and integration points.

### 7.3 Resume Tailor Agent

The Resume Tailor agent is the most rules-heavy module in Pathfinder. It reads a role's JD text and positioning from the Pipeline, performs a structured analysis, then generates a one-page tailored resume. The output is a `.docx` file that can also be rendered as an in-browser preview and exported to PDF. This section is the complete specification — it replaces and supersedes the standalone `resume_customization_agent_spec.md`.

#### 7.3.1 Hard Rules

These rules are inviolable. Every resume generation must satisfy all of them:

- Resume must fit on **one page**, always
- Output filename: `{FirstName}_{LastName}_Resume_{Company}_{RoleTitle}.docx` (e.g., `Jane_Doe_Resume_Stripe_StaffPM.docx`)
- **Never embellish or claim experience the job seeker does not have.** If a JD uses a specific product name (e.g., "Sponsored Ads," "RampID," "UID2") that the job seeker has not directly worked on, do not use that term. Use honest framing of adjacent experience instead.
- **Keywords must be earned, not mirrored.** Do not pattern-match JD language onto the resume unless the job seeker has genuinely done that work. Using a keyword just because it appears in the JD — without real backing — is considered embellishment and is not allowed.
- Never use em dashes in any written content — use a spaced en dash (` – `) instead
- All bullet points must follow the format: **Bold lead phrase** followed by regular text with a specific metric or outcome
- Every role must have a job subtitle in italics beneath the job header
- Output is a `.docx` file generated via Node.js using the `docx` npm library

#### 7.3.2 Two-Phase Process

The agent operates in two distinct phases — analysis first, generation second. This is not just a design choice; it produces dramatically better resumes because the generation phase has explicit constraints from the analysis phase.

**Phase 1: JD Analysis & Fit Assessment**

Before generating anything, the agent extracts and explicitly states:

1. **Target seniority level** — what level is the JD hiring for? (e.g., Principal, Sr. Director, Staff)
2. **Top 5-7 keywords** — the most important domain/skill terms the job seeker legitimately has experience with. Flag any that are borderline or do not apply.
3. **Primary domain** — what is the core domain? (e.g., AdTech, AI/ML, identity, SaaS, data platforms)
4. **Role type** — what kind of PM work is this? (e.g., 0-to-1 product, scaling, platform/infra, GTM-heavy, technical/engineering-facing)
5. **Stakeholder environment** — who does this role work with? (e.g., advertisers, engineers, C-suite, agencies, publishers)
6. **Fit assessment** — strong matches, gaps to note, borderline terms that need careful framing

The fit assessment is output as a structured summary before generation begins:

```
Fit Assessment:
- Strong match: [reasons]
- Gaps to note: [any hard gaps]
- Borderline terms: [keywords that need careful framing]
```

If there are disqualifying gaps, flag them and ask whether to proceed. The fit assessment is written back to the role record's `fitAssessment` field, making it visible on the Pipeline card and available to the Research Brief agent (Section 5: "Why You Fit" uses this data).

**Phase 2: Resume Generation**

Only proceed to generation after completing the Phase 1 analysis. The analysis constrains every generation decision.

#### 7.3.3 What Gets Customized Per JD

Six areas are customized, in priority order:

**1. Summary (highest priority)** — Rewrite for every JD. The summary should open with the seniority level and domain that matches the JD title, use 3-5 keywords pulled verbatim from the JD (only where the job seeker genuinely has that experience), reference signature proof points (scale, impact metrics), close with a cross-functional leadership line tuned to what the JD values. Length: 4-5 sentences, one paragraph, no bullet points.

**2. Skills Bar (high priority)** — 8 skills max, separated by `·`. Mirror JD language directly where the job seeker genuinely has the skill. Order by relevance to the JD (most relevant first). Do not use product-specific terms the job seeker has not worked on. Pull from the canonical skills pool stored in `pf_preferences`.

**3. Role Subtitles (medium priority)** — Each role has a one-line italic subtitle that frames the work for the JD. Adjust the most recent roles to emphasize the aspects most relevant to the JD (e.g., emphasize AI for AI/ML roles, emphasize scale for platform roles). Earlier roles are generally stable anchors.

**4. Bullet Selection and Ordering (medium priority)** — Each role has a master bullet pool (see 7.3.5 Bullet Bank). The agent selects and orders bullets based on JD relevance. Always lead each role with the most JD-relevant bullet. Bullets should collectively tell a coherent story aligned to the JD — pick the most relevant ones, not just the highest-metric ones.

**5. Lead Experience Framing (situational)** — The most recent role's lead bullet can be reframed depending on JD emphasis (e.g., leading with AI for AI roles, with search/ranking for search roles, with automation for workflow roles).

**6. Writing New Bullets (if needed)** — If a JD angle genuinely applies to the job seeker's experience but no existing bullet covers it, a new bullet may be written following the standard formula: **[Action verb phrase]** + context + specific metric or outcome. New bullets must be approved by the job seeker before being added to the canonical bullet bank.

#### 7.3.4 Seniority Calibration

Match the summary's seniority framing to the JD title:

| JD Title Contains | Summary Opens With |
|---|---|
| Sr. Director / VP | "Sr. Director-level Product leader..." |
| Director | "Director-level Product leader..." |
| Principal PM | "Principal-level Product leader..." |
| Staff PM | "Staff-level Product leader..." |
| Senior PM | "Senior Product Manager..." |

#### 7.3.5 Bullet Bank

The agent draws from a curated bullet bank organized by role and by theme (technical depth, leadership, revenue impact, 0-to-1, cross-functional). Each bullet has metadata: `{id, role, theme, metrics, keywords, dateAdded, usageCount}`. The agent selects and orders bullets based on the Phase 1 analysis — maximizing keyword relevance while maintaining narrative coherence.

The bullet bank is stored in `pf_bullet_bank` in localStorage. It ships with a seed set of canonical bullets and **grows over time**: when the agent writes a new bullet for a JD angle not covered by the existing bank and the job seeker approves it, the bullet is added to the bank with full metadata. Bullets track `usageCount` (how many resumes have used them) and `lastUsed` (date), enabling the agent to surface underused bullets and retire stale ones. The bank is exportable as JSON for backup.

**Honest Framing Guidelines**

Keywords must be earned. Only use a JD term if the job seeker has genuinely done that work. If the fit is adjacent rather than direct, use honest alternatives:

| Avoid (if not directly done) | Honest Alternative |
|---|---|
| Product-specific names (e.g., "Sponsored Ads") | Generic category (e.g., "advertiser-facing ad products") |
| "Identity Resolution" (if only consuming, not building) | "Addressability" or "audience identity systems" |
| "Clean Rooms" | "privacy-compliant data collaboration" |
| Specific vendor products (e.g., "UID2," "RampID") | "privacy-preserving identity solutions" |
| Domain terms without direct experience (e.g., "Retail Media") | Omit unless explicitly applicable |
| "Measurement" as a primary skill | "attribution and conversion tracking" (if applicable from earlier work) |

When in doubt: describe what was actually built and let the reader make the connection. Do not reach for the JD's vocabulary if it does not fit naturally.

#### 7.3.6 Positioning-Aware Generation

The `positioning` field from the role record controls the entire framing:

| Aspect | IC (`ic`) | Management (`management`) |
|--------|-----------|---------------------------|
| Summary opener | "Principal-level Product leader..." | "Director-level Product leader..." |
| Bullet selection | Depth: systems built, technical decisions, individual ownership | Breadth: team leadership, org outcomes, cross-functional influence |
| Lead experience | Most recent technical/platform work | Career progression showing increasing scope |
| Skills bar | Technical/domain skills first | Leadership/strategy skills first |

#### 7.3.7 Cover Letter (Optional)

For each application, the agent may also produce a short cover letter:

- 3 paragraphs max, no longer than half a page
- Paragraph 1: Why this role and this company specifically — reference something concrete from the JD or company context
- Paragraph 2: The 1-2 most relevant proof points from the job seeker's background, in plain language
- Paragraph 3: Short close — direct, no filler phrases
- Tone: confident, direct, no fluff. No phrases like "I am excited to apply" or "I believe I would be a great fit"
- Never use em dashes
- Only generate when explicitly requested

#### 7.3.8 Version Log

Every time a resume is generated, log the following to `pf_resume_log`:

```json
{
  "date": "2026-03-09",
  "company": "Stripe",
  "role": "Staff Product Manager",
  "jdSource": "https://stripe.com/jobs/...",
  "keyCustomizations": ["Led with AI platform bullet", "Added identity keyword", "IC positioning"],
  "fitAssessment": "strong",
  "coverLetterGenerated": false,
  "outputFilename": "Jane_Doe_Resume_Stripe_StaffPM.docx"
}
```

This log enables tracking which version was sent where — critical when running multiple applications in parallel.

#### 7.3.9 Output Format

The agent generates a `.docx` file using the Node.js `docx` library with these layout constraints:

- Page: US Letter (12240 x 15840 DXA)
- Margins: top/bottom 780 DXA, left/right 1008 DXA
- Fonts: Arial throughout
- Job headers: borderless two-column table (company+title left, date right-aligned) — never use tab stops, they break in Google Docs
- Bullet indents: left 480 DXA, hanging 280 DXA
- All bullets use `LevelFormat.BULLET` with numbering config — never unicode bullet characters inline

The generated resume is rendered as an in-browser preview (HTML) with DOCX and PDF export buttons. On generation, the resume is auto-saved via the Artifacts MCP server tagged with `{company, roleId, type: 'resume', positioning, date}`. Previous versions are retained, supporting iteration ("generate again with more emphasis on AI").

### 7.4 Artifacts MCP Server

The Artifacts MCP Server is the shared file system for Pathfinder. It provides structured storage, retrieval, and search for every document the system produces or the user uploads. It's implemented as an MCP server — meaning any Claude-powered agent (Cowork skills, Claude Code, future integrations) can interact with it through standard MCP tool calls.

#### 7.4.1 Why MCP?

The core problem the Artifacts MCP solves: without a shared file layer, documents scatter — research briefs cached in localStorage, resumes in Downloads, JD snapshots nowhere, homework submissions in random folders. The MCP server gives every agent a single, structured, queryable place to store and retrieve files.

MCP is the right abstraction because it's Claude-native: any agent that speaks MCP can save, query, and retrieve files without knowing about the server's internal storage. This makes the server usable beyond Pathfinder — it's a general-purpose artifact store.

#### 7.4.2 MCP Tools

| Tool | Parameters | Returns | Description |
|------|-----------|---------|-------------|
| `save_artifact` | `{content, filename, tags, metadata}` | `{artifactId, path}` | Save a file with structured metadata |
| `get_artifact` | `{artifactId}` | `{content, metadata}` | Retrieve a specific artifact by ID |
| `list_artifacts` | `{tags?, company?, roleId?, type?, dateRange?}` | `[{artifactId, filename, tags, date}]` | Query artifacts by any combination of filters |
| `search_artifacts` | `{query}` | `[{artifactId, filename, relevance}]` | Full-text search across artifact content |
| `tag_artifact` | `{artifactId, tags}` | `{updated}` | Add or modify tags on an existing artifact |
| `delete_artifact` | `{artifactId}` | `{deleted}` | Remove an artifact (soft delete — moves to archive) |

#### 7.4.3 Artifact Types

| Type | Produced By | Format | Example |
|------|------------|--------|---------|
| `research_brief` | Research Brief Agent | HTML | Full 10-section brief for Stripe + Staff PM role |
| `resume` | Resume Tailor Agent | DOCX | Tailored resume for Meta, IC positioning |
| `jd_snapshot` | Pipeline Tracker | Text | Saved JD text (preserves the original even if the posting goes down) |
| `fit_assessment` | Resume Tailor Agent | JSON | Structured analysis: strong matches, gaps, borderline terms |
| `homework_submission` | User (uploaded) | Any | Take-home assignment submission |
| `offer_letter` | User (uploaded) | PDF/DOCX | Offer documentation |
| `networking_notes` | User (uploaded/written) | Text/DOCX | Key takeaways from informational interviews |
| `cover_letter` | Future agent | DOCX | Role-specific cover letter |
| `interview_notes` | User (written) | Text | Post-interview debrief notes |
| `debrief` | Debrief Agent | JSON/HTML | Structured post-interview debrief |
| `mock_session` | Mock Interview Agent | JSON/HTML | Mock interview session with questions, answers, and evaluations |
| `outreach_draft` | Outreach Message Generator | Text | Generated networking messages (for reference) |
| `thank_you_note` | Outreach Message Generator | Text | Post-interview thank-you notes |
| `comp_benchmark` | Comp Intelligence Agent | JSON | Compensation benchmark for a specific role |

#### 7.4.4 Storage Architecture

The MCP server manages a local directory:

```
~/.pathfinder/artifacts/
  index.json                    ← metadata index, queried by list/search
  research_briefs/
    stripe-staff-pm-2026-03-09.html
  resumes/
    meta-senior-pm-ic-2026-03-08.docx
  jd_snapshots/
    stripe-staff-pm-2026-03-09.txt
  homework/
    airbnb-case-study-2026-03-15.pdf
  offers/
    ...
  misc/
    ...
```

The `index.json` file is the queryable metadata store. Each entry contains: `artifactId`, `filename`, `type`, `company`, `roleId`, `tags`, `createdAt`, `updatedAt`, `path`, `sizeBytes`. The file-based approach keeps things simple and portable — no database required, easy to back up, easy to inspect manually.

#### 7.4.5 Privacy & Security

All artifacts live on the user's local machine. The MCP server reads/writes only within `~/.pathfinder/artifacts/`. No network calls, no cloud sync, no telemetry. The user owns their data.

### 7.5 Job Feed Listener

The Job Feed Listener is the top-of-funnel agent that grows the pipeline automatically. It monitors email, job boards, and saved searches for new opportunities, scores them against your "What I'm Looking For" profile, deduplicates against your existing pipeline, and feeds qualified discoveries into the Pipeline Tracker. This is the highest-leverage automation in the system — being in the first batch of applicants dramatically increases conversion, and the listener makes that possible at scale.

#### 7.5.1 User Profile — "What I'm Looking For"

The listener needs a structured version of your preferences to score incoming roles. This profile lives in `pf_preferences` and powers the match scoring engine.

**Preference fields:**

| Field | Type | Description | Your Current Values |
|-------|------|-------------|-------------------|
| `targetTitles` | array | Role titles you're targeting | Senior PM, Staff PM, Principal PM, Director of Product, VP Product |
| `targetLevel` | enum | Seniority range | `senior` through `vp` |
| `positioning` | enum | Default framing | `ic` (with `management` for smaller companies where comp requires it) |
| `primaryDomains` | array | Core domain interests | AdTech, AI/ML, Data Platforms, Enterprise SaaS, Fintech, Marketplaces |
| `secondaryDomains` | array | Open to if strong fit | Infrastructure, Security, Healthcare (data-intensive) |
| `excludedDomains` | array | Hard no | Crypto, Gaming, Consumer Social |
| `companyStage` | array | Acceptable stages | Series B+, Late-stage, Pre-IPO, Public |
| `minHeadcount` | number | Minimum company size | 100 (post-PMF signal) |
| `location` | array | Acceptable locations | Remote, Hybrid (SF Bay), San Francisco |
| `excludedLocations` | array | Non-starters | On-site outside SF Bay |
| `compRange` | object | `{minBase, targetBase, maxTotal, currency}` | `{minBase: 285000, targetBase: 350000, maxTotal: 450000, currency: "USD"}` — total comp range $285K-$450K |
| `mustHaveKeywords` | array | Hard requirements in JD | e.g., "product manager", "strategy", "execution" |
| `boostKeywords` | array | Strong positive signals | e.g., "AdTech", "targeting", "ranking", "LLM", "agents", "real-time", "decisioning" |
| `excludeKeywords` | array | Disqualifiers | e.g., "junior", "associate", "intern", "contract", "6-month" |
| `roleQuickCheck` | object | The 6-point filter from Job Search Plan (see 7.5.6) |

The preference profile is editable through a Settings UI and should be versioned — when you tighten or relax criteria, it's useful to see how match rates changed.

#### 7.5.2 Input Sources

The listener monitors multiple channels. Each source has different signal quality and extraction complexity.

| Source | Method | Signal Quality | What It Captures | Frequency |
|--------|--------|---------------|-----------------|-----------|
| **Gmail — Recruiter Outreach** | Gmail MCP connector | High (pre-qualified) | Company, role, recruiter name, sometimes JD text or link | Real-time / on-check |
| **Gmail — Job Alert Emails** | Gmail MCP connector | Medium (keyword-matched) | LinkedIn alerts, Indeed alerts, Glassdoor alerts — role title, company, link | As emails arrive |
| **Gmail — Networking Follow-ups** | Gmail MCP connector | High (warm lead) | Contact name, company, potential role mentions | As emails arrive |
| **Indeed API** | MCP connector (available) | Medium | Full JD text, company, location, salary range, posting date | 3x/week (Mon/Wed/Fri) |
| **Dice API** | MCP connector (available) | Medium (tech-focused) | Full JD text, company, tech requirements | 3x/week |
| **LinkedIn Saved Searches** | Email alert parsing | Medium | Role title, company, link (JD requires click-through) | As alerts arrive |
| **Company Career Pages** | RSS/scraping (Lever, Greenhouse, Ashby) | High (direct from source) | Full JD, team, level | Weekly per Tier 1-2 company |
| **Manual Entry** | Pipeline UI | Highest (human curated) | Full role details entered by user | On-demand |

**Priority order for checking:** Gmail first (recruiter outreach is highest-signal), then job board APIs, then career page RSS. The listener should process inbound before outbound sources.

#### 7.5.3 Processing Pipeline

Every incoming signal follows a five-stage processing pipeline:

**Stage 1: Extract**

Parse the source to extract structured data. Different sources require different extraction strategies:

| Source Type | Extraction Method | Fields Extracted |
|-------------|------------------|-----------------|
| Recruiter email | Claude-powered parsing (classify email as recruiter outreach, extract role details) | Company, role title, recruiter name, JD text/link, comp mention |
| Job alert email | Template-based parsing (LinkedIn/Indeed/Glassdoor have consistent formats) | Role title, company, posting URL |
| Job board API | Structured API response | Full JD text, company, location, salary range, posting date |
| Career page RSS | HTML parsing | Role title, JD text, team, apply link |

For recruiter emails, Claude classification is critical — the system needs to distinguish recruiter outreach from marketing, newsletters, and other noise. A lightweight prompt classifies emails into: `recruiter_outreach`, `job_alert`, `networking_followup`, `irrelevant`. Only the first three proceed.

**Stage 2: Enrich**

For signals that only have a link (e.g., LinkedIn alert emails), the listener attempts to fetch the full JD text. If the posting is behind authentication (LinkedIn), it logs the link and flags for manual JD paste. For public postings (Lever, Greenhouse, company websites), it scrapes and extracts the JD text directly.

If the company is new to the system, the listener auto-creates a sparse company profile (see 7.5.5).

**Stage 3: Deduplicate**

Before creating a pipeline entry, check for duplicates:

- **Exact match**: same company + same role title + same URL → skip, update `lastSeenDate` on existing
- **Fuzzy match**: same company + similar title (edit distance < 3 or shared key terms) + posted within 30 days → flag as potential duplicate, surface for user review
- **Repost detection**: same company + same title but new URL + previous role was `closed` as `ghosted` or `role_frozen` → flag as potential repost, suggest re-engaging

Dedup runs against both active pipeline entries and recently closed roles.

**Stage 4: Score**

Each extracted role is scored against the user profile. The scoring model produces a **match score (0-100)** and a **breakdown** showing which factors contributed.

**Scoring dimensions:**

| Dimension | Weight | Scoring Logic |
|-----------|--------|--------------|
| Title/Level Match | 25% | Does the title map to target titles? Is the seniority in range? |
| Domain Match | 25% | Does the JD's primary domain intersect with `primaryDomains` (full points) or `secondaryDomains` (half points)? |
| Keyword Relevance | 20% | Count of `boostKeywords` found in JD text, penalize for `excludeKeywords` present |
| Location Match | 15% | Does the role's location/remote policy match preferences? |
| Company Stage | 10% | Does the company's stage/size match `companyStage` and `minHeadcount`? |
| Comp Signal | 5% | If salary range is disclosed, does it overlap with `compRange`? |

**Score interpretation:**

| Score | Classification | Action |
|-------|---------------|--------|
| 80-100 | Strong Match | Auto-create in `discovered`, suggest Hot tier, send Dashboard notification |
| 60-79 | Good Match | Auto-create in `discovered`, suggest Active tier |
| 40-59 | Moderate Match | Auto-create in `discovered`, suggest Watching tier, lower priority in Dashboard |
| 20-39 | Weak Match | Hold in feed queue (don't create pipeline entry), available for manual review |
| 0-19 | No Match | Discard silently |

Roles with `excludeKeywords` present get a hard cap at 39 regardless of other scores.

**Stage 5: Create & Notify**

For roles scoring 40+, the listener creates a pipeline entry:

```json
{
  "id": "auto-generated",
  "company": "extracted or matched",
  "title": "extracted",
  "url": "source URL",
  "jdText": "extracted (or empty if behind auth)",
  "positioning": "from user default, adjustable",
  "source": "job_feed",
  "stage": "discovered",
  "feedMetadata": {
    "sourceType": "recruiter_email | job_alert | job_board | career_page",
    "sourceId": "email messageId or posting URL",
    "matchScore": 85,
    "matchBreakdown": { "title": 23, "domain": 25, "keywords": 18, "location": 15, "stage": 4, "comp": 0 },
    "extractedAt": "2026-03-09T10:30:00Z",
    "recruiterName": "Jane Smith (if applicable)",
    "recruiterEmail": "jane@company.com (if applicable)"
  }
}
```

The Dashboard surfaces new feed discoveries in a dedicated **Feed Review** section (see 7.6.1), grouped by match quality. Each card shows the match score with a breakdown tooltip, and one-click actions: Accept (moves to pipeline), Dismiss (archives), or Snooze (hide for 7 days).

#### 7.5.4 Company Auto-Creation

When the listener encounters a company not yet in the system, it auto-creates a company profile with whatever metadata is available from the source:

| Source | Auto-populated Fields |
|--------|----------------------|
| Recruiter email | `name`, recruiter added as connection with `relationship: 'recruiter'` |
| Job board API | `name`, `hqLocation`, sometimes `headcount`, `fundingStage` |
| Career page | `name`, `hqLocation` (from URL domain) |
| Job alert email | `name` only |

The company starts at Dormant tier by default. The match score on the triggering role may suggest a higher tier. The profile completeness indicator (from 7.1.1) immediately flags the sparse profile for enrichment.

For companies that appear frequently (multiple roles posted, recruiter outreach from multiple people), the listener logs a **frequency signal** that can suggest tier promotion even before the user reviews the roles.

#### 7.5.5 Tier Promotion & Demotion Suggestions

The listener doesn't just create entries — it actively manages the funnel:

**Tier promotion triggers:**

- Strong match role (80+) at a Dormant or Watching company → suggest promoting to Hot or Active
- Multiple roles posted at a company within 30 days → suggest promoting (signals they're actively hiring)
- Recruiter outreach from a company already in pipeline → suggest promoting (inbound signal)
- Networking contact mentions a role at a pipeline company → suggest promoting

**Tier demotion signals:**

- No new roles at a Hot company for 60+ days → suggest demoting to Watching
- All roles at a company closed as `rejected` or `ghosted` → suggest demoting to Dormant
- Company in recent layoff news → flag for review (may be hiring freeze)

All suggestions are surfaced as nudges on the Dashboard — the listener never auto-changes tiers.

#### 7.5.6 Role Quick-Check Filter

Before scoring, the listener runs a 6-point quick-check filter. This is a fast binary pass/fail that eliminates clearly unfit roles before the more expensive scoring pipeline runs:

| # | Check | Pass Condition |
|---|-------|---------------|
| 1 | Level appropriate? | Title maps to Senior PM through VP range |
| 2 | Domain relevant? | JD mentions at least one `primaryDomain` or `secondaryDomain` keyword |
| 3 | Location OK? | Remote, or hybrid/on-site in an accepted location |
| 4 | Company stage OK? | Not pre-seed/seed/Series A (unless excluded by user) |
| 5 | No hard blockers? | None of `excludeKeywords` present in JD |
| 6 | Interesting problem? | At least 2 `boostKeywords` present in JD (proxy for genuine interest) |

Roles that pass 5 of 6 checks proceed to scoring. Roles that pass 4 or fewer are discarded unless the company is Tier 1 (dream targets get a pass on the quick-check).

#### 7.5.7 Cadence & Trigger Architecture

The listener follows a tiered cadence framework:

| Action | Frequency | When |
|--------|-----------|------|
| Check Gmail for recruiter outreach | Real-time (or on each Cowork session) | Whenever listener runs |
| Check Gmail for job alert emails | Real-time | Whenever listener runs |
| Scan Indeed for saved searches | 3x/week | Monday, Wednesday, Friday morning |
| Scan Dice for saved searches | 3x/week | Monday, Wednesday, Friday morning |
| Check Tier 1 company career pages | 3x/week | Monday, Wednesday, Friday |
| Check Tier 2 company career pages | Weekly | Monday |
| Check Tier 3-4 company career pages | Monthly | First Monday |

The cadence is configurable per source and per tier. The Dashboard shows when each source was last checked and highlights overdue checks.

**Speed matters:** Early applicants convert at dramatically higher rates. The listener should process new postings within hours, not days. For Tier 1 companies, a strong match role should trigger an immediate Dashboard notification.

#### 7.5.8 Feed Analytics

The listener tracks its own performance:

- **Volume**: roles discovered per week, by source
- **Quality**: average match score by source, accept rate by match score band
- **Speed**: time from posting to discovery, time from discovery to user action
- **Conversion**: what percentage of feed-discovered roles advance past `discovered` stage
- **Source ROI**: which sources yield the best conversion (not just volume)

These metrics help tune the scoring model and identify which sources are worth the monitoring investment.

#### 7.5.9 Implementation Architecture

The listener is a Cowork skill that runs on-demand or on a schedule (via the scheduled tasks system). It:

1. Reads `pf_preferences` for scoring criteria
2. Reads `pf_companies` and `pf_roles` for dedup context
3. Calls Gmail MCP tools to check for new recruiter/alert emails since last run
4. Calls Indeed/Dice MCP tools for saved search results
5. Processes each signal through Extract → Enrich → Dedup → Score → Create
6. Writes new roles to `pf_roles` and new companies to `pf_companies`
7. Logs run metadata to `pf_feed_runs` for analytics

The skill can be invoked manually ("check my feed now") or scheduled to run at the cadence defined in 7.5.7. Each run is idempotent — running twice produces no duplicates because of the dedup stage.

**MCP tools exposed by the listener (for other agents to query):**

| Tool | Parameters | Returns | Description |
|------|-----------|---------|-------------|
| `check_feed` | `{sources?: string[]}` | `{discovered: number, processed: number, errors: string[]}` | Trigger a feed check (all sources or specific ones) |
| `get_feed_status` | `{}` | `{lastRun, nextScheduled, sourceStatus[]}` | Status of each source and last check time |
| `get_feed_queue` | `{minScore?, maxResults?}` | `FeedItem[]` | View pending items that scored below auto-create threshold |
| `update_preferences` | `{...partial preferences}` | `{updated}` | Modify the scoring profile |
| `get_feed_analytics` | `{dateRange?}` | `{volume, quality, speed, conversion}` | Feed performance metrics |

### 7.6 Dashboard & Launcher

The Dashboard is the daily entry point for Pathfinder. It answers the question: "What should I do today?" by synthesizing state from all agents into a single view with prioritized action items.

#### 7.6.1 Daily View

The dashboard renders a focused daily view with three zones:

**Action Queue** — prioritized list of things that need attention today:

- Roles stuck in stage too long (3+ weeks in `applied` → "ghosted?" prompt)
- Offer deadlines approaching (48+ hours → "respond to offer" nudge)
- Outreach sequences due (LinkedIn connect sent 2 days ago → "send cold email")
- Take-home assignments due (deadline within 48 hours)
- Hot-tier companies with new postings (from Job Feed Listener)
- Interview prep not started for upcoming interviews

**Pipeline Summary** — compact stats:

- Roles by stage (bar chart or counts)
- Conversion funnel (discovered → screen → interview → offer rates)
- Activity trend (roles added/advanced this week vs. last)
- Average time-in-stage by stage

**Quick Actions** — one-click launchers:

- Add a new role (opens Pipeline with a blank role form)
- Generate a research brief (opens Research Brief agent with a role selector)
- Generate a resume (opens Resume Tailor with a role selector)
- View artifacts (opens Artifacts browser)

#### 7.6.2 Streak Tracking

The dashboard tracks a daily "search streak" — consecutive days with at least one meaningful action (role added, outreach sent, application submitted, interview completed). The streak is a light motivational mechanic, not a guilt tool. Missing a weekend doesn't break the streak.

#### 7.6.3 Nudge Engine

Nudges are generated by scanning pipeline state against time-based rules. Each nudge has a priority (critical, important, informational) and links directly to the relevant action. Nudges are dismissible and won't repeat for the same trigger within 24 hours.

| Trigger | Priority | Nudge Text | Action Link |
|---------|----------|-----------|-------------|
| Role in `applied` > 21 days | Important | "No response from {company} in 3 weeks — mark as ghosted?" | Open role detail |
| Offer without response > 48h | Critical | "Offer from {company} needs a response" | Open offer sub-state |
| Outreach step due | Important | "Send follow-up email to {contact} at {company}" | Open connection detail |
| Hot-tier company, no active roles | Informational | "{company} is Hot with no active roles — check for openings?" | Open company profile |
| Interview in < 48h, no brief | Critical | "Interview at {company} in 2 days — generate research brief?" | Open Research Brief |
| Company profile < 50% complete | Informational | "{company} profile is sparse — fill in before advancing" | Open company profile |

#### 7.6.4 Module Navigation

The dashboard provides navigation to every agent module. Each module opens as a standalone page (consistent with the zero-build-step, one-HTML-file-per-module architecture). Navigation state (which role was selected, which company was in focus) is preserved in URL parameters and localStorage so you can bookmark deep links.

### 7.7 Calendar Integration Agent

The Calendar Integration agent bridges Pathfinder with Google Calendar to automate interview lifecycle tracking. Google Calendar is already connected via MCP — this agent reads calendar events, matches them to pipeline roles, triggers stage transitions, and powers time-aware nudges.

#### 7.7.1 Event Detection & Matching

The agent scans Google Calendar for events that look like interview-related activities. It uses a combination of keyword matching and Claude-powered classification:

**Detection signals:**

| Signal | Example | Confidence |
|--------|---------|------------|
| Title keywords | "Phone Screen", "Interview", "Hiring Manager Call", "Technical Round" | High |
| Attendee domain | Calendar invite from `@stripe.com` when Stripe is in pipeline | High |
| Recruiter name match | Invite from a person listed as a connection with `relationship: 'recruiter'` | High |
| Description content | Event description mentions role title or "interview loop" | Medium |
| Duration heuristic | 30-60 min meeting with external domain during business hours | Low (needs other signals) |

When a calendar event matches a pipeline role, the agent:

1. **Links** the event to the role record (`interviewRounds` array gets a new entry with `{date, type, interviewers, calendarEventId}`)
2. **Advances stage** if appropriate — a first external meeting with a pipeline company can auto-suggest `applied` → `screen` or `screen` → `interviewing`
3. **Extracts interviewer names** from the attendee list and adds them to the role's interviewer data (feeding Research Brief Section 8: Interviewer Insights)
4. **Schedules nudges** — "Generate research brief?" 48 hours before, "Review prep materials" morning-of, "Write debrief?" 1 hour after event ends

#### 7.7.2 Pre-Interview Nudges

The calendar agent generates time-aware nudges that surface on the Dashboard:

| Timing | Nudge | Action |
|--------|-------|--------|
| 72 hours before | "Interview at {company} in 3 days — research brief not started" | Launch Research Brief |
| 48 hours before | "Review your prep for {company} {round type}" | Open existing brief |
| Morning of | "{company} interview today at {time} — review TMAY script and questions to ask" | Open brief sections 9-10 |
| 1 hour after | "How did your {company} interview go? Capture it while it's fresh" | Launch Debrief Agent |

#### 7.7.3 Post-Event Triggers

After an interview event ends, the agent watches for follow-up signals:

- New calendar event from same company within 1-2 weeks → likely next round, auto-link and update `interviewSubState`
- No follow-up after 2 weeks → surface "No follow-up from {company} — check in with recruiter?" nudge
- Offer-related calendar event (title contains "offer", "compensation", "decision") → suggest advancing to `offer` stage

#### 7.7.4 Implementation

The agent runs as a scheduled Cowork task that checks Google Calendar on each session. It reads `pf_roles` to know which companies/roles to watch for, calls `gcal_list_events` for the relevant time window, classifies events, and writes matched data back to the role records. For real-time awareness, the Dashboard can also call `gcal_list_events` directly on load to populate today's interview schedule.

### 7.8 Outreach Message Generator

The Outreach Message Generator drafts personalized networking messages for each step of the outreach sequence. It reads the company profile, role details, connection record, and positioning to produce messages that are specific, concise, and authentic — never generic templates.

#### 7.8.1 Message Types

| Type | When | Inputs | Output | Length |
|------|------|--------|--------|--------|
| LinkedIn Connection Request | Outreach step 1 (day 1) | Company profile, connection's title, mutual context | Personalized 300-char request | ~2 sentences |
| Cold Email — Initial | Outreach step 3 (days 3-5) | Company profile, role JD, connection info, your positioning | Email with specific hook + ask | 4-6 sentences |
| Cold Email — Follow-up | 5-7 days after initial | Previous message, any response | Brief bump with new angle | 2-3 sentences |
| Referral Request | After warm connection established | Relationship context, specific role, why you're a fit | Direct ask with easy yes | 3-4 sentences |
| InMail | Last resort outreach | Same as cold email, adapted for InMail format | LinkedIn InMail with profile context | 3-5 sentences |
| Thank You — Networking Call | After informational interview | Debrief notes, key takeaways, their advice | Genuine thank you + specific callback | 3-4 sentences |
| Thank You — Interview Round | After each interview round | Debrief notes, interviewer names, discussion topics | Personalized per-interviewer thank you | 4-5 sentences |
| Recruiter Response | Replying to inbound recruiter outreach | Recruiter's email, role details, your interest level | Professional expression of interest or pass | 3-5 sentences |

#### 7.8.2 Personalization Engine

The generator never produces generic templates. Every message must reference at least one of:

- A specific product, initiative, or recent news about the company (from company profile `recentNews`, `keyProducts`)
- The recipient's specific role or team (from connection record)
- A concrete reason your background is relevant (from fit assessment or positioning)
- A mutual connection, shared employer history, or common ground (from connection `source` and `relationship`)

The prompt explicitly forbids: "I came across your profile and was impressed by...", "I'd love to pick your brain...", and any other recruiter-spam patterns. Messages should read like they came from a real person who did their homework.

#### 7.8.3 Workflow Integration

When a connection's outreach log shows the next step is due (tracked by the Pipeline's nudge engine), the Dashboard nudge includes a "Draft message" action. Clicking it opens the Outreach Message Generator pre-loaded with the connection, company, and role context. The generated message is presented for review and editing — never auto-sent. After the user approves and sends (manually), they mark the outreach step as completed in the connection log.

For thank-you notes, the Debrief Agent (5.9) hands off to the Outreach Generator with debrief context pre-loaded.

### 7.9 Post-Interview Debrief Agent

The Debrief Agent captures structured interview feedback immediately after each round, while memory is fresh. It produces a debrief record that feeds back into the Research Brief, informs prep for subsequent rounds, and builds a longitudinal dataset of interview patterns.

#### 7.9.1 Debrief Prompt Structure

The agent walks through a structured debrief using a conversational prompt. It knows the role, company, interview type, and interviewer names (from the calendar integration) and asks targeted questions:

**Standard debrief sections:**

| Section | Prompt | Purpose |
|---------|--------|---------|
| Overall Impression | "How do you feel it went? Quick gut check — 1 to 5." | Calibrate before detailed recall |
| What Landed | "Which of your stories or answers seemed to resonate? What did the interviewer react positively to?" | Identify effective narratives for reuse |
| What Didn't Land | "Any moments where you felt you lost them, rambled, or gave a weak answer?" | Identify prep gaps |
| Questions They Asked | "List the key questions. For each, note what type it was (behavioral, technical, case, etc.) and how well you answered." | Build question bank per company/interview type |
| Their Priorities | "Based on what they asked and emphasized, what does this team/company seem to care most about?" | Refine company intelligence for next rounds |
| Red Flags | "Anything that concerned you about the role, team, or company?" | Feed into role fit assessment |
| Follow-up Items | "Did they mention next steps, timeline, or anything you need to follow up on?" | Create action items |
| Interviewer Notes | "Any personal notes about each interviewer — demeanor, interests, decision-making style?" | Feed into Research Brief Section 8 |

#### 7.9.2 Output & Feedback Loops

The debrief produces:

1. **Debrief artifact** — saved to Artifacts MCP tagged `{company, roleId, type: 'debrief', roundNumber, date}`
2. **Role record updates** — `interviewRounds[n].notes` populated, `interviewSubState` updated
3. **Research Brief refresh trigger** — if the debrief reveals new intelligence about company priorities, Section 6 (Strategic Challenges) and Section 8 (Interviewer Insights) are flagged for refresh
4. **Thank-you note handoff** — passes debrief context to Outreach Message Generator to draft per-interviewer thank-you notes
5. **Question bank entry** — interview questions added to a growing bank, tagged by company, interview type, and difficulty

#### 7.9.3 Pattern Analysis

After 10+ debriefs, the agent can surface patterns:

- Which story types consistently land (revenue impact stories vs. technical depth stories vs. leadership narratives)
- Which interview types you struggle with (e.g., consistently rating design interviews lower)
- Which question categories need more prep (e.g., "scaling" questions get weak-answer flags)
- Stage-specific conversion patterns (strong at screens, weaker at final rounds — suggests different prep needed)

This analysis surfaces on the Dashboard as an "Interview Intelligence" card once enough data accumulates.

### 7.10 Comp Intelligence Agent

The Comp Intelligence agent provides market compensation data to inform positioning decisions, negotiation strategy, and role prioritization. It enriches role records with benchmarked salary data so you can make informed decisions about which roles to pursue and how to negotiate.

#### 7.10.1 Data Sources

| Source | Data Available | Access Method |
|--------|---------------|--------------|
| Levels.fyi | Base, bonus, equity, total comp by company + level + location. PM-specific data. | Public API / scraping via Apify |
| Glassdoor | Salary ranges by company + title. Less granular but broader coverage. | Company profile `glassdoorRating` field, salary data via scraping |
| Job posting salary ranges | Increasingly required by law (CA, NY, CO, WA). Extracted during feed listener processing. | Already captured in `feedMetadata` |
| Recruiter-disclosed ranges | Often shared during screen stage. | Manual entry on role record `salary` field |
| Your own offer data | As offers come in, actual comp data accumulates. | Role record `offerDetails` |

#### 7.10.2 Comp Benchmarking

For each role, the agent can generate a comp benchmark card:

```
Stripe — Staff PM (IC)
  Market range (Levels.fyi, SF Bay):
    Base:   $210-260K (P50: $235K)
    Bonus:  $40-65K
    Equity: $150-300K/yr (4yr vest)
    Total:  $400-625K

  Posted range (if disclosed): $220-280K base
  Your target: $285-450K total comp (from pf_preferences.compRange)

  Positioning note: IC Staff at Stripe benchmarks
  higher than Director at most Series C companies.
  Consider IC positioning for this role.
```

#### 7.10.3 Positioning-Aware Comp Analysis

This is where comp intelligence connects to the IC/management positioning decision. The agent can compare:

- "What does IC Principal pay at this company vs. Director at this company?"
- "What does Director pay at this Series C startup vs. Staff PM at this public company?"

This directly informs the `positioning` field decision on each role — sometimes the data shows that IC at a larger company pays more than management at a smaller one, removing the comp-driven reason to position as management.

#### 7.10.4 Negotiation Support

When a role reaches the `offer` stage, the comp agent provides:

- Market percentile of the offer (e.g., "This base is P35 for Staff PM at comparable companies")
- Specific counter-offer suggestions with market data backing ("Market P50 for this role is $X — consider countering at $Y")
- Equity valuation context (for private companies: funding stage, last valuation if known, typical vest schedules)
- Total comp comparison against other active offers

This feeds into the `negotiationScorecard` on the role record, giving the compensation dimension real numbers instead of gut feel.

### 7.11 Mock Interview Agent

The Mock Interview agent runs practice sessions calibrated to a specific company, role, and interview type. Unlike generic interview prep tools, it uses the full context Pathfinder has accumulated — company profile, JD analysis, fit assessment, positioning, and previous debrief patterns — to generate realistic, targeted practice.

#### 7.11.1 Interview Type Library

The agent supports all standard PM interview formats. Each type has a distinct question bank, evaluation rubric, recommended answer framework, and coaching approach. The frameworks below are drawn from extensive interview prep research and should be embedded in the agent's system prompt so it can evaluate answers against the right structure.

**Type 1: Product Execution**

Four case subtypes, each with a distinct structure:

| Subtype | Prompt Pattern | Framework | Evaluation Focus |
|---------|---------------|-----------|-----------------|
| Debugging | "What happened to metric X?" | Product → Users → Breakdown (MECE) → Diagnose → Prioritize | Metrics skill (most weighted), structured decomposition |
| Goals/Metrics | "What success metrics would you set for X?" | Product → Users → North-star metric → Breakdown (MECE) → Trade-offs & counter-metrics | Metric selection rationale, avoiding gamification |
| Root Cause | "How would you reduce X?" | Product → Users → MECE sub-metrics → Hypotheses (seasonal, internal, external) → 5 Whys | Hypothesis generation breadth, logical depth |
| Trade-offs | "How would you decide between A and B?" | Clarify trade-off → Mission/Goal → Users & stakeholders → Pros/cons → Experiment design → Results framework | Experiment design quality, decision rigor |

**Type 2: Product Strategy**

| Prompt Pattern | Framework Options | Evaluation Focus |
|---------------|-------------------|-----------------|
| "Should X company enter Y market?" / "How would you grow X?" / "Should X acquire Y?" | Option A: The List (pros/cons across factors). Option B: The Matrix (2x2, SWOT, Porter's 5 Forces). Option C: Custom CIRCLES variant (Clarify → Mission → Strategy → Ecosystem → Competition → Problems → Solutions → Vision → Risks → Measurement) | Problem structuring, creative thinking at scale, real tech insight. 80/20 on product insight over GTM. |

Seven strategy categories the agent should draw from: Tech Company Strategy, M&A, Real-World Strategy, Product Improvement, Market Entry, New Tech × Business, Product Monetization.

**Type 3: Product Design (CUPS-PDM Framework)**

| Step | What To Do | Evaluation Criteria |
|------|-----------|-------------------|
| **C**larify | Repeat back the prompt, connect to company mission | Shows listening, strategic framing |
| **U**ser | Identify and prioritize target user segments | User empathy, segmentation quality |
| **P**roblem | Prioritize user problems with interviewer | Collaborative problem selection |
| **S**olutions | Brainstorm variety of product solutions | Creativity, breadth before depth |
| **P**rioritize | Bang-for-buck solution selection | Decision rationale, feasibility awareness |
| **D**esign | Key design choices that drive success | UX intuition, specificity |
| **M**easurement | How to measure success + risk mitigation | Metric selection, edge case awareness |

The agent should watch for: monologuing (answers should be interactive, not 10-minute speeches), only considering one solution (always brainstorm 3+), and forgetting the user (getting lost in business logic).

**Type 4: Product Sense**

Five case subtypes: Product Improvement, Product Growth, Product Launch, Product Design, Product Pricing. Uses a custom variant of the CUPS-PDM framework adapted per subtype. Key principle: **divergent then convergent thinking** — brainstorm wide, then narrow down with the interviewer.

Evaluation focuses on: discussion style (interactive, not monologue), user empathy, business acumen (monetization, strategic alignment), and product vision (creativity, identifying the right levers).

**Type 5: Behavioral (Addressing Weaknesses Framework)**

| Step | What To Do |
|------|-----------|
| 1 | Identify weaknesses in your candidacy (from JD) |
| 2 | Prepare stories that directly address those weaknesses |
| 3 | Show a straight-line narrative connecting your history to this role |
| 4 | Make the role seem like a natural next step |

The 12 most common behavioral questions (the agent should generate variants of these calibrated to the specific company):

1. Tell me about yourself (TMAY — dedicated practice mode in 7.11.5)
2. Why do you want to work here?
3. Why this job?
4. Why are you leaving?
5. What is your greatest weakness?
6. What is your biggest failure?
7. Where do you see yourself in 3 years?
8. What's something everyone takes for granted that you think is wrong?
9. What work accomplishment are you most proud of?
10. Describe a scenario requiring you to say no to a stakeholder
11. What are your compensation expectations? (strategy: flip back, share market-based range with data)
12. Tell me about a conflict with a cross-functional partner

**Type 6: Technical**

Evaluation rubric focuses on three areas:

| Area | What It Tests | Signal |
|------|--------------|--------|
| How you work with engineers | Do you roll up sleeves or stay hands-off? Can you write specs engineers respect? | Concrete examples of eng collaboration |
| Depth of technical knowledge | Do you know what's hard vs. easy to build? Can you discuss architecture? | Accurate technical intuition |
| Bridging tech and user | Can you translate technical constraints into user impact? | Strategic decisions that account for both |

Knowledge areas the agent should draw from: web essentials (APIs, cloud, DNS), performance (latency, caching, throughput), data (sharding, auth, containers), system design (architecture at scale, recommendation engines), and modern tech (AI/ML, autonomous systems, real-time pipelines).

**Type 7: Homework / Case Study**

Four homework types: PRD, Strategy Doc, Roadmap, Problem Prioritization.

| Evaluation Dimension | What Hiring Managers Think |
|---------------------|--------------------------|
| User insight | Does the candidate show genuine user-first thinking with original insights? |
| Data usage | Can they build a financial model and size impact? |
| Business sense | Does the solution work for the business, not just the user? |
| Writing clarity | Is this the quality of writing we'd expect from a PM at this level? |
| Structured thinking | Is there a clear, logical process visible in the work? |

The agent should emphasize: talking to actual customers if possible, building prototypes (even rough ones), including Jobs to Be Done framing, impact sizing with real numbers, and a rollout plan (not just "A/B test it").

#### 7.11.2 Company-Calibrated Questions

The mock agent doesn't generate generic questions. It uses Pathfinder's accumulated context to make questions specific:

**Inputs consumed:**

- Company profile (`domain`, `keyProducts`, `competitors`, `techStack`, `recentNews`)
- JD text (specific responsibilities, required experience, team context)
- Fit assessment (`strongMatch`, `gaps`, `borderlineTerms` — will probe gaps specifically)
- Positioning (`ic` vs `management` — changes question framing)
- Previous debriefs (avoids re-testing areas you've demonstrated strength in; focuses on flagged weaknesses)
- Research Brief (uses company strategic challenges to create realistic scenarios)

**Example calibration:**

For a Staff PM role at Stripe, positioning IC, with fit assessment showing a gap in "payments domain":

> *Execution question:* "You're the PM for Stripe's fraud detection system. A new regulation in the EU requires real-time transaction monitoring with a 500ms latency cap. Your current system does 2-second batch processing. Walk me through how you'd approach migrating to real-time — what would you ship first, what are the risks, and how would you measure success?"

The question is specific to Stripe's domain, tests the candidate's ability to apply their real-time systems experience (strong match) to payments (gap area), and requires the kind of execution detail that a Staff-level IC would need to demonstrate.

#### 7.11.3 Session Structure

A mock interview session follows a realistic format, modeled on the before/during/after framework for real interviews:

**1. Setup (Before)**
- User selects: role, interview type, difficulty (standard / hard / curveball), duration (15 / 30 / 45 min equivalent in question count)
- Agent surfaces: the relevant framework for this interview type (e.g., CUPS-PDM for design, 4-bucket for execution), the role's fit assessment gaps (these become probing areas), and any previous mock/debrief data for this interview type
- Agent reminds: "For this {type} interview, the recommended structure is {framework}. Your previous weakness in this type was {pattern from debriefs}."

**2. Questions (During)**
- Agent presents questions one at a time. User responds in text (free-form, as they would speak)
- The agent asks follow-up probes just like a real interviewer: "Can you be more specific about the metrics?", "What would you have done differently?", "How did you handle pushback from engineering?"
- For framework-based types (execution, design, strategy), the agent tracks whether the candidate is following the recommended structure and probes gaps: "You jumped to solutions without defining the user — who is this for?"
- The agent monitors for common mistakes: monologuing, vague metrics, forgetting the user, forcing a framework that doesn't fit, not engaging interactively

**3. Evaluation (After each answer)**
- **Score** (1-5) across the relevant rubric dimensions for this interview type
- **Framework adherence** — did the answer follow the recommended structure? What steps were skipped?
- **What worked** — specific phrases or points that landed
- **What to improve** — where the answer was vague, lacked metrics, or missed an opportunity
- **Suggested reframe** — how to restructure the answer for more impact, with a concrete example

**4. Session Summary (After all questions)**
- Strongest answer and why
- Weakest answer and what to prep
- Framework usage patterns (e.g., "You consistently skip the Measurement step in CUPS-PDM")
- Patterns across answers (e.g., "Your answers consistently lack quantitative outcomes — add specific metrics")
- Recommended stories to prepare based on gaps revealed
- Comparison to previous sessions for this interview type (improvement tracking)

#### 7.11.4 Story Bank Integration

The mock agent maintains a **story bank** — a collection of STAR-format stories (Situation, Task, Action, Result) tagged by theme and interview type. The story bank is stored in `pf_story_bank` in localStorage and is personal to each job seeker. Stories are seeded from the job seeker's curated STAR stories document and grow over time through mock sessions and debrief insights.

**Seed stories (loaded from the job seeker's personal STAR stories file):**

| Story | Theme Tags | Best For | Status |
|-------|------------|----------|--------|
| AI Platform Build (LLM/RAG) | Technical execution, 0-to-1, AI/ML, agentic | Execution, Technical, Product Sense | Interview-ready |
| Audience Segmentation Lifecycle | Scale, systems thinking, cross-functional | Execution, Strategy | Interview-ready |
| Mail Domain Categories | Technical depth, data-driven, ranking | Execution, Technical | Interview-ready |
| AI Chatbot (LLM/RAG Enterprise) | AI/ML, enterprise, stakeholder mgmt | Technical, Strategy | Interview-ready |
| Brand Safety & Fraud Detection | Data-driven, measurable impact, trust/safety | Execution, Product Sense | Interview-ready |
| Gender Inference Model (Ethics) | Ethics, data science, hard decisions | Behavioral, Product Sense | Interview-ready |
| Cross-Team Conflict (System Consolidation) | Conflict resolution, leadership, influence | Behavioral | Interview-ready |
| Company Description Harvesting (Failure) | Failure story, learning, resilience | Behavioral | Interview-ready |
| Enterprise Search (Saying No) | Prioritization, saying no, stakeholder mgmt | Behavioral, Strategy | Interview-ready |
| Publisher Advocacy (Gemini Native) | GTM, publisher relations, monetization | Strategy, Execution | Interview-ready |

**Story bank schema:**

```json
{
  "id": "story_uuid_1",
  "title": "AI Platform Build (LLM/RAG)",
  "situation": "...",
  "task": "...",
  "action": "...",
  "result": "...",
  "themeTags": ["technical-execution", "0-to-1", "ai-ml", "agentic"],
  "bestForTypes": ["execution", "technical", "product-sense"],
  "status": "interview-ready",
  "lastUsedInMock": "2026-03-08",
  "mockRating": 4.5,
  "timesUsed": 3,
  "coachNotes": "Strong opener — tighten the result section to 2 sentences"
}
```

**Growth and refinement:**

Stories that score well in mocks get flagged as "interview-ready." Stories that consistently underperform get flagged for rewrite. The bank grows through three channels: (1) manual addition from the job seeker's personal experience, (2) discovery during mock sessions when the agent identifies a new story angle, and (3) extraction from debrief sessions when real interviews surface stories that worked well. Each story tracks `timesUsed`, `mockRating` (average across sessions), and `coachNotes` (agent feedback on delivery).

#### 7.11.5 TMAY Practice Mode

A dedicated mode for practicing "Tell Me About Yourself" — the single most important answer in any interview. The agent:

- Generates a TMAY script based on positioning + JD + target level (same as Research Brief Section 10)
- Lets you practice delivering it in text
- Times it (target: 90-120 seconds spoken, ~200-300 words written)
- Evaluates: hook strength, narrative arc, relevance to this specific role, closing strength
- Iterates: "Try again with more emphasis on your AI/ML experience" or "Your closer was weak — end with why this role specifically excites you"

#### 7.11.6 Interview Question Intelligence

The mock agent goes beyond generated questions by sourcing **real reported interview questions** from public review sites. This gives practice sessions the specificity that generic mock tools lack — if Google is known for asking "estimate the number of golf balls in a school bus" or Stripe interviewers tend to focus on payment systems edge cases, the agent should know that.

**Data sources (priority order):**

| Source | What It Provides | Access Method |
|--------|-----------------|---------------|
| **Glassdoor Interview Reviews** | Role-specific questions tagged by difficulty, interview stage, and outcome (offer/reject) | Web search + page extraction per company/role |
| **Blind** | Candid interview experiences, timeline details, and question specifics from verified employees | Web search for `site:teamblind.com {company} interview` |
| **Levels.fyi Interview Section** | Interview questions linked to comp data and offer details | Web search + extraction |
| **Reddit (r/cscareerquestions, r/ProductManagement)** | Community-reported questions, process walkthroughs, and tips | Web search for `site:reddit.com {company} PM interview` |
| **Exponent / IGotAnOffer** | Curated PM question banks by company (may require paid access) | Web search for publicly shared samples |
| **Company career blogs / eng blogs** | Occasionally publish "how we interview" posts with example questions | Research Brief already captures these |

**Collection workflow:**

When preparing a mock session for a specific company + role, the agent runs a pre-session intelligence gathering step:

1. **Search**: Query each source for `{company} + {role level} + interview questions + PM`. Filter results from the last 18 months (interview processes change; stale data is misleading).
2. **Extract**: Pull reported questions, categorize by interview type (execution, design, behavioral, etc.), and note metadata: date reported, interview round, outcome if available.
3. **Deduplicate**: Many Glassdoor reviews report the same standard questions. Cluster similar questions and keep the most detailed version.
4. **Classify**: Tag each question with the interview framework it maps to (e.g., a "How would you improve X?" question maps to Product Sense → Improvement subtype).
5. **Cache**: Store extracted questions in the company's question bank artifact (`{company}_interview_questions.json`) via Artifacts MCP. Re-fetch only if cache is older than 30 days or user requests refresh.

**Question bank schema:**

```json
{
  "company": "Stripe",
  "lastUpdated": "2026-03-09",
  "sources": ["glassdoor", "blind", "reddit"],
  "questions": [
    {
      "text": "You're the PM for Stripe Checkout. Conversion dropped 3% last week. Walk me through your debugging process.",
      "type": "execution",
      "framework": "4-bucket-debugging",
      "round": "onsite",
      "level": "staff",
      "source": "glassdoor",
      "reportedDate": "2025-11",
      "outcome": "offer",
      "difficulty": "hard",
      "tags": ["payments", "metrics", "debugging"]
    }
  ],
  "processNotes": {
    "typicalRounds": 5,
    "format": "phone screen → hiring manager → execution → design → cross-functional",
    "timeline": "3-4 weeks",
    "knownPanelists": [],
    "tips": ["Stripe values specificity over frameworks", "Always tie back to revenue impact"]
  }
}
```

**Integration with mock sessions:**

- During **setup**, the agent surfaces: "I found {N} reported interview questions for {company} PM roles. {X} are execution, {Y} are design, {Z} are behavioral. Want me to use real reported questions, generated questions, or a mix?"
- **Mix mode** (default): Uses 60% real reported questions (adapted to the specific role) + 40% agent-generated questions (targeting fit assessment gaps). This gives the realism of actual questions while still probing the candidate's specific weaknesses.
- **Process notes** are surfaced during setup: "Based on recent reports, {company}'s interview process is typically {N} rounds over {timeline}. The execution round is known for {pattern}."
- Questions sourced from real reports are marked with a 📋 icon in the session, so the user knows they're practicing against real interview data vs. generated scenarios.

**Freshness and trust signals:**

- Questions older than 18 months are deprioritized (still available but flagged as potentially outdated)
- Sources with outcome data (got offer / didn't get offer) are weighted higher — questions asked to candidates who received offers are more likely to represent the current process
- If fewer than 3 questions are found for a company, the agent falls back to generated questions but notes: "Limited interview data available for {company}. Using AI-generated questions based on company profile."
- The agent never presents scraped questions as its own — attribution is preserved: "This question was reported on Glassdoor by a {level} candidate in {month/year}"

#### 7.11.7 Artifacts & Feedback Loops

Each mock session produces:

- **Session artifact** saved to Artifacts MCP: `{company, roleId, type: 'mock_interview', interviewType, date}`
- **Story bank updates**: new stories discovered, existing stories re-rated
- **Prep recommendations**: fed back to Research Brief and Dashboard nudges
- **Pattern data**: aggregated across sessions for the Dashboard's Interview Intelligence card (from Debrief Agent 7.9.3)

### 7.12 Metrics & Analytics Page

The Metrics page provides a longitudinal view of the job search — trends over time, conversion rates, and patterns that aren't visible from the daily Dashboard view. This is both a self-management tool (am I putting in enough effort? where is my funnel leaking?) and a demo piece (shows data visualization and analytical thinking).

#### 7.12.1 Core Metrics

**Funnel metrics (all-time and rolling 30-day):**

| Metric | Calculation | Visualization |
|--------|-------------|---------------|
| **Total roles tracked** | Count of all roles | Large number with sparkline |
| **Active roles** | Roles not in `closed` stage | Number + percentage of total |
| **Conversion by stage** | % of roles that advance from each stage to the next | Horizontal funnel chart |
| **Average time-in-stage** | Mean days spent in each stage | Bar chart by stage |
| **Close reason distribution** | Breakdown of `closeReason` across all closed roles | Donut chart: offer_accepted, rejected, withdrew, ghosted, etc. |
| **Roles added per week** | Time series of new roles entering the pipeline | Line chart |
| **Applications per week** | Roles reaching `applied` stage per week | Line chart overlaid with roles-added |
| **Offer rate** | Roles reaching `offer` / roles reaching `applied` | Percentage with trend arrow |
| **Response rate** | Roles advancing past `applied` / total `applied` | Percentage with benchmark comparison |

**Activity metrics:**

| Metric | Calculation | Visualization |
|--------|-------------|---------------|
| **Research briefs generated** | Count of research brief artifacts | Number with trend |
| **Resumes tailored** | Count of resume artifacts | Number with trend |
| **Mock interviews completed** | Count of mock session artifacts | Number with trend |
| **Outreach messages sent** | Count from outreach log | Number with trend |
| **Connections made** | New connections added | Number with weekly trend |
| **Streak (current / best)** | Consecutive days with pipeline activity | Streak counter with calendar heatmap |

**Pattern analysis (available after 10+ closed roles):**

- **Domain performance:** Which company domains (AdTech, AI/ML, Fintech, etc.) have the highest conversion rate?
- **Source effectiveness:** Do inbound roles, outbound roles, or referrals convert better?
- **Tier accuracy:** Are Hot-tier companies actually converting at a higher rate than Active-tier? If not, tier assignments may need recalibrating.
- **Positioning impact:** Do IC-positioned roles convert differently from management-positioned roles?
- **Time-to-close by company type:** Do startups move faster than enterprise companies?
- **Interview type patterns:** Which interview types (execution, design, behavioral) correlate with offers vs. rejections?

#### 7.12.2 Visualization

All charts use a consistent visual language matching the design system: the stage color gradient for funnel charts, `var(--accent)` for primary trend lines, `var(--text-tertiary)` for secondary lines, and `var(--bg-surface)` card backgrounds. Charts are built with vanilla SVG or a lightweight charting library (Chart.js or Recharts if React is used for this view).

The Metrics page has three time-range tabs: **Last 30 Days**, **Last 90 Days**, and **All Time**. Default is 30 days. Each metric card shows the current value plus a trend indicator (up/down arrow with percentage change from the previous period).

#### 7.12.3 Data Export

The Metrics page includes an **Export** button that generates a CSV of all pipeline data — roles, companies, stages, dates, outcomes. This enables the job seeker to do deeper analysis in a spreadsheet if needed, and provides a backup of all structured data.

### 7.13 Help & Keyboard Reference

Pathfinder includes an in-app help system accessible from any page via `?` (keyboard shortcut overlay) or via the Help link in the navigation bar.

#### 7.13.1 Keyboard Shortcut Overlay

Pressing `?` on any page opens a modal overlay showing all available keyboard shortcuts, grouped by context:

- **Global shortcuts** (available on every page): navigation, command palette, theme toggle, new role
- **Page-specific shortcuts** (e.g., Pipeline: J/K navigation, stage change; Mock Interview: submit, next question, hint)
- **Agent shortcuts** (e.g., Research Brief: refresh section, expand/collapse)

The overlay is a single-page reference — no scrolling through a docs site. It matches the command palette's visual style (centered modal, `var(--bg-elevated)` background, `var(--shadow-lg)`).

#### 7.13.2 Getting Started Guide

A first-run experience for new users (or when the pipeline is empty) that walks through:

1. **Add your first company** — demonstrates the lookup tool and auto-enrichment
2. **Add a role** — paste a JD, set positioning, see the fit assessment
3. **Generate a research brief** — watch the streaming in action
4. **Tailor a resume** — see how positioning changes the output
5. **Explore the dashboard** — understand the action queue and nudge system

The guide is dismissable and can be re-accessed from Help. Each step highlights the relevant UI element with a subtle spotlight effect.

#### 7.13.3 Tooltip System

All non-obvious UI elements have tooltips that appear on hover (300ms delay) with a short explanation. Tooltips are especially important for: tier badges (what does "Hot" mean?), stage badges (what triggers the next stage?), score bars (what does a 75 match score mean?), and keyboard shortcut hints on buttons (small `kbd` element showing the shortcut).

## 7.12 Citations & Source Tracking

> **Design Principle: "Trust but Verify"** — Every piece of data in Pathfinder has a traceable origin. Assertions are useful, but assertions *with sources* are actionable. A research brief claiming "company has 15,000+ employees" is less valuable than "company has 15,000+ employees (per LinkedIn, last updated March 2026)."

> Citations follow two rules: **stored centrally** in the Artifacts MCP server (single source of truth, queryable, durable) and **displayed in context** wherever the cited data appears (Research Briefs, Pipeline detail panel, Outreach messages). The MCP server is the ledger; the UI modules are the readers.

### Source Types

Pathfinder recognizes six categories of sources, each with different trust levels and linking behavior:

| Source Type | Example | Linkable? | Trust Level |
|-------------|---------|-----------|-------------|
| **Manual Entry** | JD pasted into Pipeline, notes written by user | Timestamp only | Highest — user entered it |
| **Email** | Role sourced from recruiter email | Gmail thread deep link | High — first-party communication |
| **Calendar Event** | Interview scheduled on Google Calendar | GCal event deep link | High — confirmed scheduling |
| **Job Board / URL Import** | Role discovered via career page or feed | Link to posting URL | High while posting is live |
| **Company Enrichment** | Auto-populated company profile (logo, headcount, funding) | Link to source site + fetch date | Medium — may be stale |
| **AI-Generated** | Research Brief sections, resume tailoring, outreach messages | Link to input data + generation timestamp | Medium — regenerable, needs verification |

### Citation Data Model (MCP-Stored)

Citations are a new artifact type (`citation`) stored in the Artifacts MCP server. Each citation is a small JSON record that links a **claim** to its **source**. They live alongside research briefs, JD snapshots, and other artifacts — not in localStorage.

**Citation record schema:**

```json
{
  "citationId": "cit_stripe_1710072000",
  "claim": "Stripe has 8,000+ employees across 20+ countries",
  "sourceType": "enrichment_web",
  "sourceRef": {
    "url": "https://linkedin.com/company/stripe",
    "title": "Stripe LinkedIn Company Page",
    "fetchedAt": "2026-03-10T09:15:00Z"
  },
  "trust": "medium",
  "subjectType": "company",
  "subjectId": "Stripe",
  "roleId": null,
  "module": "research-brief",
  "sectionNum": 1,
  "createdAt": "2026-03-10T09:15:00Z",
  "stale": false
}
```

**Key fields:**

- **`claim`** — The specific assertion being cited (one sentence, human-readable)
- **`sourceType`** — One of: `manual_entry`, `email`, `calendar`, `job_board`, `enrichment_web`, `ai_generated`
- **`sourceRef`** — Type-specific reference object (see below)
- **`trust`** — `high`, `medium`, or `low` — derived from source type + freshness
- **`subjectType`** — What the citation is about: `company`, `role`, `connection`, or `stage_transition`
- **`subjectId`** — The company name, role ID, or connection ID being cited
- **`roleId`** — Optional role linkage (for role-specific citations)
- **`module`** — Which module created this citation (research-brief, pipeline, calendar, etc.)
- **`sectionNum`** — For Research Brief citations, which section (1–10)
- **`stale`** — Marked `true` when the source URL is dead or data is >30 days old

**Source ref formats by type:**

- **Email:** `{ threadId, messageId, from, subject, receivedDate, gmailUrl }` — `gmailUrl` is `https://mail.google.com/mail/#inbox/<threadId>`, renders as "View in Gmail" link
- **Calendar:** `{ eventId, calendarId, title, startTime, organizer, gcalUrl }` — `gcalUrl` is `https://calendar.google.com/calendar/event?eid=<base64(eventId)>`, renders as "View in Calendar" link
- **Job board:** `{ url, siteName, fetchedAt, jdSnapshotId }` — clickable link + reference to the JD snapshot artifact if posting goes down
- **Enrichment:** `{ url, siteName, query, fetchedAt }` — source site + query date
- **AI-generated:** `{ agentModule, sectionNum, inputSummary, regenerable }` — which agent, what inputs were used, whether it can be regenerated
- **Manual entry:** `{ enteredBy, enteredVia, note }` — always "user", which module, optional note

### New MCP Tools for Citations

The Artifacts MCP server gets three new tools (see Section 9.2 for full specs):

**`pf_save_citation`** — Write one or more citation records. Called by modules when they create or update data (e.g., Research Brief generates a section → saves citations for each sourced claim). Deduplicates by `claim + subjectId + sourceRef.url`.

**`pf_get_citations`** — Query citations with filters: `subjectId` (company or role), `module`, `sourceType`, `roleId`, `stale`. Returns citation records sorted by `createdAt` descending. This is what the UI modules call to display inline citations.

**`pf_check_freshness`** — Batch-check whether cited URLs are still live. Updates `stale` flag and `trust` level. Called on a schedule or when a user opens a role detail view.

### Where Citations Appear (In Context)

Citations surface wherever their data is used — never hidden behind a separate page:

**Research Briefs** — Each section shows inline citation markers `[1]` `[2]` next to sourced claims. A collapsible "Sources" footer per section lists each citation with its trust badge, source link, and fetch date. When a claim traces back to the user's own email or calendar, it gets a special callout: "ⓘ From your recruiter email (Mar 4): mentioned scaling the AI team."

**Pipeline Role Detail** — The detail panel's stage history timeline includes source attribution on each transition:

```
Mar 5, 10:30 AM — Title set to "Staff PM, AI Platform"
  ✓ Manual entry by you

Mar 7, 2:00 PM — Moved to Screen stage
  ✓ Calendar event: "Stripe screen call – hiring manager"
    → View in Calendar

Mar 8, 9:00 AM — JD imported from career page
  ✓ https://stripe.com/jobs/12345 (fetched Mar 8)
    ⚠ Posting no longer live — JD snapshot preserved
```

Clicking any source link opens the original (Gmail thread, Calendar event, job posting URL).

**Pipeline Cards** — A small trust indicator dot on the card (green = all high-trust, yellow = some stale/medium, no dot = no citations yet). Hover shows summary.

**Outreach Messages** — When personalization references a specific fact, the source is shown as a tooltip: "Based on: Q3 earnings call transcript (Oct 2025)"

### The Source Ledger (Centralized Roll-Up)

All citations roll up into a single **Source Ledger** — a read-only view accessible from the Dashboard nav. This is where you go to answer "where did all this data come from?"

**Layout:** Table view with columns: Claim, Source, Trust, Company/Role, Module, Date, Status (live/stale). Sortable and filterable by any column.

**Filters sidebar:**
- By company (dropdown from `pf_companies`)
- By source type (checkboxes: Email, Calendar, Job Board, Enrichment, AI, Manual)
- By trust level (High / Medium / Low)
- By freshness (Live / Stale / Unknown)
- By module (which Pathfinder module created the citation)
- Date range picker

**Summary stats at top:**
- Total citations, broken down by source type (pie chart)
- Stale citation count with "Refresh All" button
- Trust distribution bar

**Row actions:**
- Click a citation → expands to show full source ref details
- "View Source" → opens the Gmail thread, Calendar event, or URL in a new tab
- "Refresh" → re-checks whether URL is still live, updates stale flag
- "Delete" → soft-deletes the citation from the MCP server

The Source Ledger is read-only in the sense that you don't *create* citations here — they're created by the modules as you use Pathfinder. But you can audit, refresh, and clean up from this centralized view.

### Source Confidence Signals

| Source | Signal | Meaning |
|--------|--------|---------|
| Manual entry / Email / Calendar | ✓ green | First-party, high trust |
| Job posting (live) | ✓ green | Verified available |
| Job posting (removed) | ⚠ yellow | Posting taken down — JD snapshot preserved |
| AI-generated content | ⓘ blue | Regenerable, should be verified |
| Web enrichment (> 7 days old) | ⓘ blue | May be stale, refresh available |
| Any source (> 30 days, no refresh) | ⚠ yellow | Staleness warning |

### Implementation Phases

**Phase 1 (MVP):** Add `citation` artifact type to MCP server. Implement `pf_save_citation` and `pf_get_citations` tools. Pipeline tracks source on role creation (manual entry vs URL import) and saves citation to MCP. Role detail panel renders stage history with source attribution. Research Brief sections show "Source: AI-generated from [company profile + JD text]" footer.

**Phase 2:** Build Source Ledger module (read-only table view with filters). Email/Calendar source refs populate with deep links (Gmail thread URLs, GCal event URLs). Research Brief sections generate per-claim inline citations. `pf_check_freshness` tool implemented with stale flagging.

**Phase 3:** Full inline citation markers `[n]` across all content-generating modules (Research Brief, Outreach, Resume Tailor). Outreach personalization source tooltips. Dashboard widget showing citation health (% stale, % high-trust). Automatic staleness checks on role detail open.

---

## 8. Data Model

### 8.1 localStorage Schema

All structured data lives in localStorage with the `pf_` prefix. Each key stores a JSON string. The schema below is the canonical reference — all agents must read/write these keys in the specified format.

| Key | Type | Owner | Readers | Description |
|-----|------|-------|---------|-------------|
| `pf_companies` | `Company[]` | Pipeline Tracker | Research Brief, Resume Tailor, Dashboard | All company records with profiles |
| `pf_roles` | `Role[]` | Pipeline Tracker | Research Brief, Resume Tailor, Dashboard | All role records with lifecycle state |
| `pf_connections` | `Connection[]` | Pipeline Tracker | Dashboard | Contact records linked to companies |
| `pf_preferences` | `Preferences` | Settings UI | Job Feed Listener, Dashboard | User prefs: target domains, levels, comp range, remote policy |
| `pf_api_key` | `string` | Settings UI | Research Brief, Resume Tailor | Claude API key (never leaves the browser) |
| `pf_streak` | `StreakData` | Dashboard | Dashboard | Streak tracking: dates, count, history |
| `pf_dismissed_nudges` | `string[]` | Dashboard | Dashboard | Nudge IDs dismissed in last 24h |
| `pf_bullet_bank` | `Bullet[]` | Resume Tailor | Resume Tailor | Curated resume bullets with metadata, grows over time |
| `pf_resume_log` | `ResumeLog[]` | Resume Tailor | Resume Tailor, Dashboard | Version log of every resume generated |
| `pf_story_bank` | `Story[]` | Mock Interview | Mock Interview, Debrief | STAR-format interview stories with ratings and themes |
| `pf_question_bank` | `Question[]` | Debrief Agent | Mock Interview | Interview questions collected from debriefs |
| `pf_comp_cache` | `CompData{}` | Comp Intelligence | Pipeline, Dashboard | Cached compensation benchmarks by company+level |
| `pf_feed_runs` | `FeedRun[]` | Job Feed Listener | Dashboard | Feed check history for analytics |
| `pf_calendar_links` | `CalendarLink[]` | Calendar Integration | Dashboard, Pipeline | Mapping of calendar event IDs to role IDs |
| `research_{companySlug}_{roleId}_{sectionNum}` | `string` | Research Brief | Research Brief | Cached brief section content (HTML) |
| `resume_{companySlug}_{roleId}` | `string` | Resume Tailor | Resume Tailor | Cached resume data (JSON with bullet selections) |

### 8.2 Key JSON Shapes

**Company (abbreviated — full fields in 7.1.1):**
```json
{
  "name": "Stripe",
  "tier": "hot",
  "domain": "Fintech",
  "companyType": "scaleup",
  "fundingStage": "Late-stage",
  "missionStatement": "Increase the GDP of the internet",
  "headcount": "8000+",
  "remotePolicy": "hybrid",
  "dateAdded": "2026-03-01",
  "connections": ["conn_uuid_1", "conn_uuid_2"]
}
```

**Role (abbreviated — full fields in 7.1.3):**
```json
{
  "id": "role_uuid_1",
  "company": "Stripe",
  "title": "Staff Product Manager, AI Platform",
  "positioning": "ic",
  "targetLevel": "Staff PM",
  "stage": "researching",
  "source": "referral",
  "jdText": "Full JD text here...",
  "stageHistory": [
    {"stage": "discovered", "date": "2026-03-01T10:00:00Z"},
    {"stage": "researching", "date": "2026-03-03T14:30:00Z"}
  ],
  "fitAssessment": {
    "strongMatch": ["AI/ML", "platform", "0-to-1"],
    "gaps": ["payments domain"],
    "borderlineTerms": ["financial infrastructure"]
  }
}
```

### 8.3 Data Import

Pathfinder supports importing existing job search data from spreadsheets, JSON exports, or other tools. The import flow:

1. **Upload** — accept CSV, JSON, or manual paste of role/company data
2. **Map fields** — match imported columns to the Pathfinder schema (auto-detect common patterns)
3. **Validate** — flag missing required fields, suggest defaults
4. **Preview** — show the imported data in Pipeline view before committing
5. **Import** — write validated data to `pf_roles` and `pf_companies`

The import tool is a standalone HTML page accessible from Settings.

## 9. MCP Server Design

### 9.1 Server Architecture

The Artifacts MCP server is a lightweight Node.js process that runs locally. It exposes MCP tools over stdio (for Claude Code / Cowork integration) and optionally over HTTP (for browser-based agents to call via a local proxy).

```
┌─────────────────────────────────────────┐
│  Claude Code / Cowork                    │
│  (invokes MCP tools via stdio)           │
└──────────────┬──────────────────────────┘
               │ MCP protocol (stdio)
               ▼
┌─────────────────────────────────────────┐
│  Artifacts MCP Server                    │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │  Tools    │  │  Storage Engine      │ │
│  │  Layer    │──│  (fs + index.json)   │ │
│  └──────────┘  └──────────────────────┘ │
└──────────────┬──────────────────────────┘
               │ file system
               ▼
┌─────────────────────────────────────────┐
│  ~/.pathfinder/artifacts/                │
│  (local directory, user-owned)           │
└─────────────────────────────────────────┘
```

### 9.2 Tool Specifications

Each tool follows MCP's tool definition format with JSON Schema input validation.

**`save_artifact`** — the most-used tool. Accepts content (string or base64 for binary), a filename, artifact type, and metadata tags. Generates a unique `artifactId`, writes the file to the type-appropriate subdirectory, and updates `index.json`. Returns the artifactId and full path.

**`list_artifacts`** — queries `index.json` with optional filters. Supports filtering by `company`, `roleId`, `type`, `tags`, and `dateRange`. Returns an array of metadata entries (not file content) for efficiency.

**`get_artifact`** — retrieves a specific artifact by ID. Returns both the file content and its metadata. For binary files (DOCX, PDF), returns base64-encoded content.

**`search_artifacts`** — full-text search across text-based artifacts. Uses a simple substring match on content (Phase 1) with the option to upgrade to a proper search index later.

**`tag_artifact`** — modifies tags on an existing artifact. Used by agents to add context after creation (e.g., the Research Brief agent tags a brief with the interview date once scheduled).

**`delete_artifact`** — soft delete. Moves the file to an `_archive/` subdirectory and marks it as deleted in `index.json`. Recoverable.

#### Citation Tools

These three tools support the Citations & Source Tracking system (Section 7.12). Citations are stored as a dedicated artifact type (`citation`) with their own optimized query and maintenance tools.

**`pf_save_citation`** — Write one or more citation records. Accepts an array of citation objects (see 7.12 schema). Each citation is saved as a JSON file under `citations/` with ID format `cit_{subjectSlug}_{timestamp}`. Deduplicates by matching `claim + subjectId + sourceRef.url` — if a duplicate exists, the existing record is updated with a new `refreshedAt` timestamp instead of creating a new entry. Returns array of `{ citationId, created | updated }`.

**`pf_get_citations`** — Query citations with filters. Accepts optional `subjectId` (company name or role ID), `roleId`, `module` (which Pathfinder module), `sourceType` (manual_entry | email | calendar | job_board | enrichment_web | ai_generated), `stale` (boolean), and `limit` (default 50). Returns citation records sorted by `createdAt` descending. Designed for fast reads — the UI modules call this on every page load to render inline citations.

**`pf_check_freshness`** — Batch staleness check. Accepts optional `subjectId` to scope the check, or runs against all citations if omitted. For each citation with a URL in `sourceRef`, performs a HEAD request to check liveness. Updates `stale` flag to `true` if the URL returns 404/410/timeout, and adjusts `trust` to `low`. Returns `{ checked, staleCount, updatedIds[] }`.

### 9.3 Browser Integration

Browser-based agents (the HTML modules) need to call MCP tools but can't use stdio. Two approaches for Phase 2:

**Option A: Local HTTP proxy** — a thin HTTP wrapper around the MCP server that accepts JSON-RPC calls on `localhost:3847`. The browser agents call this endpoint. Simple to implement, requires the server to be running.

**Option B: Cowork skill bridge** — browser agents save artifacts to localStorage with a `pending_artifact_` prefix. A Cowork skill periodically reads these pending items and routes them through MCP. No additional server needed, but introduces a sync delay.

The initial build uses direct localStorage for caching. The MCP server is added in the Agent Sprint (Days 3-5). The browser modules are designed to work with either backend — a thin storage abstraction layer checks for MCP availability and falls back to localStorage.

## 10. Migration Plan

### 10.1 Foundation Sprint (Days 1-2)

**Goal:** Build the foundational modules — Pipeline Tracker, Research Brief, Resume Tailor, and Dashboard shell. Establish the shared data layer and cross-module navigation.

| Day | Deliverables |
|-----|-------------|
| 1 | Build Pipeline Tracker as standalone HTML. Define company + role data schema. Render kanban with demo data. |
| 1 | Build Research Brief agent as standalone HTML. Implement streaming, caching, and section refresh. |
| 2 | Build Resume Tailor as standalone HTML. Implement JD analysis, generation, DOCX/PDF export. |
| 2 | Build Dashboard shell — module navigation, pipeline summary stats, basic action queue. |
| 2 | Build data import tool. Test with demo dataset. Deploy all modules to GitHub Pages. |

**Success criteria:** Core modules load independently as single HTML files. Pipeline Tracker renders companies and roles. Research Brief streams and caches. Cross-module navigation works via the shared nav bar.

### 10.2 Agent Sprint (Days 3-5)

**Goal:** Add the Artifacts MCP server, wrap modules as Cowork skills, and enable Claude-powered orchestration.

| Day | Deliverables |
|-----|-------------|
| 3 | Build Artifacts MCP server with `save_artifact`, `get_artifact`, `list_artifacts`. Test via Claude Code. |
| 3 | Wire Research Brief agent to auto-save via MCP on completion. |
| 4 | Wire Resume Tailor to auto-save via MCP. Add fit assessment writeback to Pipeline. |
| 4 | Package Pipeline Tracker, Research Brief, and Resume Tailor as Cowork SKILL.md files. |
| 5 | Build Dashboard nudge engine with time-in-stage rules. |
| 5 | Add company profile enrichment — auto-enrichment on funnel entry, lookup tool on manual add. |

**Success criteria:** Artifacts save and query correctly through MCP. Cowork skills invoke correctly. Dashboard nudges fire based on pipeline state.

### 10.3 Intelligence Sprint (Days 6-8)

**Goal:** Build the top-of-funnel automation — the highest-leverage feature for the active search phase.

| Day | Deliverables |
|-----|-------------|
| 6 | Gmail integration — connect via Gmail MCP connector, build Claude-powered email classifier, extract role data. Build User Preferences editor UI. |
| 6 | Job board integration — connect Indeed + Dice MCP connectors. Configure saved searches. Build extraction pipeline. |
| 7 | Career page monitoring — Greenhouse + Ashby public APIs. Lever via JobSpy. RSS watcher for career page feeds. |
| 7 | Build scoring engine — 6-point quick-check filter, weighted match scoring, score breakdown UI. |
| 8 | Build processing pipeline — Extract → Enrich → Dedup → Score → Create. Wire to Pipeline Tracker. |
| 8 | Build Feed Review UI on Dashboard — match score cards, accept/dismiss/snooze actions, source breakdown. Tier promotion/demotion suggestions. |

**Success criteria:** New roles from email and job boards appear in the pipeline automatically. Match scoring is accurate enough that >70% of auto-created entries are worth reviewing. Tier 1 roles surface within hours of posting.

### 10.4 Polish Sprint (Days 9-10)

**Goal:** Build the agents that maximize conversion once roles are in the pipeline.

| Day | Deliverables |
|-----|-------------|
| 9 | Calendar Integration Agent — event detection, role matching, stage auto-advance, pre-interview nudges. |
| 9 | Outreach Message Generator — all 8 message types with personalization engine. Comp Intelligence Agent — Levels.fyi integration, benchmark cards. |
| 10 | Post-Interview Debrief Agent — structured debrief, artifact saving, Research Brief refresh triggers. |
| 10 | Mock Interview Agent — all 7 interview types, company-calibrated questions, story bank, TMAY practice mode. Metrics & Analytics page. Help overlay. |

**Success criteria:** Mock interview questions are specific enough that a user can't tell whether they were written by Claude or a real interviewer at that company. Calendar events auto-link to pipeline roles with >80% accuracy. Outreach messages pass the "would I actually send this?" bar without editing.

### 10.5 Tooling Landscape for Job Feed Listener

The research below informs implementation choices for Phase 3 sources.

**MCP Connectors (available now, plug-and-play):**

| Connector | Status | Tools | Best For |
|-----------|--------|-------|----------|
| Gmail | Connected | `gmail_search_messages`, `gmail_read_message` | Recruiter outreach, job alert emails |
| Indeed | Available | `search_jobs`, `get_job_details` | Job board search with full JD text |
| Dice | Available | `search_jobs` | Tech-focused job board |
| Aura | Available | `find_companies`, `get_monthly_headcount`, `analyze_employee_growth` | Company profile enrichment |
| Apollo.io | Available | `apollo_enrich_organization`, `apollo_search_people`, `apollo_get_job_postings` | Company enrichment + finding connections |

**Official ATS APIs (free, no scraping needed):**

| Platform | API | Auth | Coverage |
|----------|-----|------|----------|
| Greenhouse | Job Board API | None (public boards) | Full JD HTML, departments, locations, compensation |
| Ashby | Public Job Posting API | None | `jobPosting.list` and `jobPosting.info` with full details |
| Lever | Postings API | None (public boards) | Job listings with descriptions for public boards |

**Libraries for broader scraping:**

| Library | Language | Platforms Covered |
|---------|----------|-------------------|
| JobSpy (`python-jobspy`) | Python | LinkedIn, Indeed, Glassdoor, Google, ZipRecruiter — multi-platform in one library |
| Career Site Job Listing API (MCP) | MCP | 175k+ company career sites across 42 ATS platforms (Workday, Greenhouse, Ashby, etc.) |
| `ts-jobspy` | TypeScript/Node | TypeScript port of JobSpy |

**Claude/Cowork community projects:**

| Project | Description | Relevance |
|---------|------------|-----------|
| Proficiently Claude Skills | AI job search, resume tailoring for Greenhouse/Lever/Workday | Reference architecture |
| `cowork-job-search` | Full-funnel job search assistant for Cowork | Directly relevant pattern |
| Claude Jobs Skill | Query job openings at tech companies | Simpler reference |

**Recommended implementation stack:**

- **Email**: Gmail MCP connector (already connected) + Claude-powered classification prompt
- **Job boards**: Indeed + Dice MCP connectors (connect in Phase 3) + JobSpy for LinkedIn/Glassdoor/ZipRecruiter
- **Career pages**: Greenhouse + Ashby APIs (free, structured) + Lever public API for Tier 1-2 companies
- **Company enrichment**: Aura + Apollo.io MCP connectors for auto-populating company profiles
- **Heavy scraping**: Career Site Job Listing API (MCP) as a fallback for ATS platforms not covered by direct APIs

## 11. Interview Showcase Strategy

Pathfinder is designed to be an interview artifact. Here's how to frame it across different interview formats.

### 11.1 System Design Interview

**Frame:** "I'll walk you through a system I built to manage my job search — it demonstrates agent decomposition, MCP server design, and shared state architecture."

**Key talking points:**

- Why agents instead of a monolith (separation of concerns, independent deployability, Claude-native patterns)
- The data flow: JD entered once → flows to Research Brief, Resume Tailor, Dashboard
- MCP server design: tools, metadata indexing, privacy model
- Cache invalidation strategy: how changing a JD triggers selective re-generation
- Tradeoffs made: localStorage vs. database, vanilla JS vs. framework, file-based index vs. SQLite

### 11.2 Execution Interview

**Frame:** "I designed and built a multi-agent system from scratch — scoped the architecture, defined the data model, and shipped it in 10 days."

**Key talking points:**

- How I decomposed the problem: identified the 11 agents, mapped data dependencies, defined the build sequence
- Sprint gating: each sprint has clear success criteria; later sprints build on earlier foundations
- Tradeoffs: what I chose NOT to build (account system, cloud sync, full-text search) and why
- Metrics I'd track: conversion funnel rates, time-in-stage distributions, agent usage frequency

### 11.3 Product Sense / Strategy Interview

**Frame:** "Let me tell you about a product I built for a market of one — me — and the PM decisions I made along the way."

**Key talking points:**

- User research: I am the user. My own job search process defined the requirements.
- The positioning flexibility insight: IC vs. management framing per role, not per person
- Why the 8-stage lifecycle (consolidated from 10) — each stage has a distinct action set; stages that shared actions got merged
- The tier system: attention allocation, not company categorization
- What I'd do differently with more time / a team

### 11.4 Technical / AI Interview

**Frame:** "I'll show you how I used Claude's API and MCP protocol to build a multi-agent system that runs entirely in the browser."

**Key talking points:**

- Streaming architecture: section-by-section rendering, independent caching, selective refresh
- Prompt engineering: how the Research Brief prompt uses structured company data to avoid generic output
- MCP server design: why MCP, tool definitions, storage architecture
- Privacy-first AI: direct browser-to-API calls, no middleware, no data leaving the machine
- The honest resume problem: how the Resume Tailor's fit assessment prevents keyword-stuffing

### 11.5 Demo Script

For interviews that allow a live demo or screen share:

1. Open the Dashboard — show the action queue, pipeline summary, streak
2. Add a new role — paste a JD, set positioning to IC, show the fit assessment
3. Generate a research brief — stream 2-3 sections live, show the caching
4. Generate a tailored resume — show the JD analysis, then the one-page output
5. Walk through the architecture diagram — explain how data flows, where MCP fits
6. Show the Artifacts MCP — query for all artifacts related to one company

Total demo time: 5-8 minutes. Every step demonstrates a different architectural decision.

## 12. Extensibility & Future Personas

### 12.1 Current Scope

Pathfinder v1 is purpose-built for a single user: a senior PM (Director/Principal level) searching for roles in AdTech, AI/ML, and data platforms in the SF Bay Area. Every design decision — the positioning model (IC vs. management), the interview type taxonomy, the scoring dimensions, the story bank themes — is calibrated to this specific search.

This is intentional. Building for one user deeply produces a better product than building for everyone shallowly.

### 12.2 What's Already Generalizable

Despite being built for one, several of Pathfinder's architectural decisions are inherently extensible:

**Agent decomposition.** The core pattern — specialized agents communicating through a shared data layer — works for any job search, any career level, any industry. The agents don't hard-code PM-specific logic; they read from configurable preferences and role records.

**Preference-driven scoring.** The Job Feed Listener scores roles against a user-defined profile (`pf_preferences`). Changing the profile changes the entire funnel behavior — swap AdTech/AI for healthcare/biotech, swap Principal PM for Staff Engineer, and the scoring engine works the same way.

**Positioning as a first-class concept.** The IC/management toggle is PM-specific in its current labels, but the underlying pattern — framing yourself differently for different roles at different companies — applies broadly. An engineer might toggle between "hands-on IC" and "engineering manager." A designer might toggle between "IC design lead" and "design director."

**MCP-based artifact management.** The Artifacts MCP server is completely domain-agnostic. It stores tagged files. Any career field produces artifacts (resumes, portfolios, case studies, writing samples) that benefit from structured storage.

### 12.3 Extension to Other Personas

| Persona | What Changes | What Stays |
|---------|-------------|------------|
| **Software Engineer** | Interview types (system design, coding, behavioral replaces product types). Story bank themes (technical depth, debugging, architecture). Skills bar becomes tech stack. | Pipeline lifecycle, company profiles, calendar integration, outreach, debrief, comp intelligence (Levels.fyi has eng data). |
| **Designer** | Resume becomes portfolio. Fit assessment evaluates design tools, case study quality. Mock interviews focus on portfolio walkthroughs, design critiques. | Pipeline lifecycle, company profiles, outreach, calendar, comp (somewhat — design comp data is sparser). |
| **Data Scientist / ML Engineer** | Interview types add ML system design, statistics, SQL. Story bank includes project impact narratives. Research brief emphasizes tech stack and data infrastructure. | Everything else is structurally identical. |
| **Sales / BD** | Pipeline stages shift (prospect → qualify → pitch → negotiate → close). Outreach becomes the core activity, not a supporting one. Comp structure changes (OTE (On-Target Earnings), quota, accelerators). | Agent architecture, company profiles, calendar integration, artifacts. Pipeline concept translates directly. |
| **Executive (VP+)** | Pipeline shrinks (fewer roles, higher stakes). Networking becomes dominant activity. Board/investor research replaces product research. Comp negotiation is more complex (equity, severance, board seats). | Agent architecture, company intelligence, calendar, artifacts. |

### 12.4 Extension to Career Stages

| Stage | Key Differences | Pathfinder Adaptations |
|-------|----------------|----------------------|
| **Early Career (0-3 yrs)** | Higher volume applications, less networking leverage, simpler comp negotiation, more emphasis on skill matching than positioning. | Scoring weights shift toward keyword match. Positioning simplifies to single framing. Mock interviews emphasize fundamentals. |
| **Mid Career (3-8 yrs)** | Balanced outbound/inbound, growing network, starting to differentiate on specialization. | Current architecture works well. May need fewer interview types (less likely to get case studies at this level). |
| **Senior (8-15 yrs)** | Current target. Heavy networking, positioning flexibility, complex comp, multiple concurrent processes. | This is Pathfinder v1. |
| **Executive (15+ yrs)** | Search is almost entirely network-driven. Fewer roles, longer cycles, board-level decisions. Retained search firms become a channel. | Job Feed Listener deprioritized. Networking and relationship management become primary. Comp agent handles equity/governance. |
| **Career Transition** | Switching industries or functions. Gap analysis and narrative bridging become critical. | Fit assessment becomes central — honestly mapping transferable skills. Research Brief emphasizes domain translation. TMAY scripts explicitly address the transition narrative. |

### 12.5 Productization Path

If Pathfinder were to become a product (not a current goal, but worth thinking through):

**Phase A: Open Source Template.** Release the agent architecture, MCP server, and pipeline tracker as a template. Users bring their own Claude API key and configure their own preferences. The community builds persona-specific extensions.

**Phase B: Persona Packs.** Pre-configured preference profiles, interview type libraries, story bank templates, and scoring weights for specific personas (PM, Engineer, Designer, DS). Users select a pack on first run and customize from there.

**Phase C: Hosted Version.** For users who don't want to run locally. Add authentication, cloud storage (encrypted), and a web UI. Charge $29-49/month — competitive with Teal+ and Careerflow but with dramatically more capability.

**Phase D: Career Coach Integration.** Allow sharing pipeline state and debrief data with a career coach or mentor. The coach sees your pipeline, interview patterns, and story bank — and can add notes, suggest prep strategies, or flag concerns. This is the collaborative use case from Open Questions.

## 13. Open Questions & Future Considerations

### 13.1 Open Questions

| # | Question | Context | Decision Needed By |
|---|----------|---------|-------------------|
| 1 | Should the MCP server support multi-user? | Currently single-user. If open-sourced, others might want their own instance. | Sprint 2 |
| 2 | How should the Job Feed Listener handle email authentication? | Gmail API requires OAuth. MCP connector vs. direct API integration. | Sprint 3 |
| 3 | Should research briefs include real-time data? | Currently uses Claude's training data + company profile. Could integrate web search for latest news. | Sprint 2 |
| 4 | What's the right match scoring algorithm for the Job Feed? | Simple keyword overlap vs. embedding-based similarity vs. Claude-as-judge. | Sprint 3 |
| 5 | Should the system support collaborative use? | E.g., sharing your pipeline with a career coach or mentor. Requires auth and sharing model. | Post-launch |
| 6 | How should we handle job postings that get taken down? | JD snapshots solve the data loss, but should we detect and flag stale postings? | Sprint 2 |
| 7 | Should the Dashboard support mobile? | Addressed in 6.9 — desktop-first with responsive breakpoints for tablet and graceful phone support. Core views (Dashboard, Pipeline cards, Feed Review) work at 768px. | Resolved |

### 13.2 Future Considerations

**Cover Letter Agent** — a natural extension of the Resume Tailor. Same inputs (JD + positioning), different output format. Could share the bullet bank and fit assessment.

**Offer Comparison Tool** — when holding multiple offers, a structured comparison using the 25-point negotiation scorecard. Visualized as a radar chart.

**Networking Intelligence** — cross-reference your LinkedIn connections with target companies. Surface 2nd-degree connections. Suggest warm intro paths.

**Analytics Dashboard** — deeper metrics: application-to-screen rate by domain, average days to offer by company type, which positioning (IC vs. mgmt) converts better, which sources yield the best outcomes.

**Open Source** — if the architecture proves solid, the agent decomposition pattern and MCP server design could be released as a template for others building personal AI tools.

---

## 14. Changelog

Every change to the application triggers a PRD version bump and an entry here. The full changelog with more detail lives in `CHANGELOG.md` at the repo root.

| Version | Date | Summary |
|---------|------|---------|
| v3.6.0 | 2026-03-12 | **Settings live-update + comp sliders** — Replaced comp number inputs with range sliders (instant label update + debounced re-score). Company stage checkboxes now live-update feed cards. Fixed null `role.location` crash in `scoreRole()`. Mock Interview practiced questions now re-render immediately. Research Brief API key no longer exposed in plaintext after save. Default Apify actor changed to `logical_scrapers` (free). Settings Live-Update Pattern documented as mandatory skill rule. |
| v3.5.2 | 2026-03-12 | **Stage date/time manual override** — Stage history timeline now uses `datetime-local` inputs showing full date+time for each stage transition. Fixed bug where editing current stage's date (index -1) had no effect. New `formatDatetimeLocal()` helper handles timestamps and ISO strings. |
| v3.5.1 | 2026-03-12 | **Bug fixes: Accept→Pipeline, dark mode cache, dismiss persist** — Feed `acceptRole()` now creates a full Pipeline role (stage: "discovered") + company entry with Google Favicon logo. `dismissRole()` persists feed queue removal to localStorage. Dark mode cache fix: `data-layer.js` now initializes `data-theme` attribute on `<html>` from `pf_theme` on every page load (all 11 modules). Cache-bust `?v=3.5.1` on shared CSS/JS links. Fixed `companyName` sent as array to valig Apify actor. |
| v3.5.0 | 2026-03-12 | **JD-first scoring engine + Apify actor swap** — Rewrote `scoreRole()` to scan full JD text when available (falls back to title+company for stubs). `mustHaveKeywords` activated as 60% weight in Keyword dimension. Swapped Apify actor from `bebity` (expired) to `valig/linkedin-jobs-scraper` (consumption-based). Configurable actor ID via sidebar settings (`pf_apify_actor`). Improved error handling for 403/401/402. |
| v3.4.0 | 2026-03-12 | **Apify-powered JD enrichment engine** — New `enrichRoleJD()` function calls Apify actor to fetch full JDs from LinkedIn. Per-card "⚡ Enrich" button, batch "Enrich JDs" header button with live progress. JD quality badges (yellow "Stub JD" / green "Full JD"). Apify API token settings in sidebar. Fuzzy matching scores company+title (40+ confidence). Stub JD detection (<300 chars + email patterns). |
| v3.3.1 | 2026-03-12 | **Salary intelligence, light theme default, score transparency, Built In source** — Pipeline extracts salary from JDs (3-pattern regex), displays with color coding (green=in-range, red=below $250K floor, gray=unknown). New `pf_salary_prefs` key (min $250K, target $300K-$450K). Feed gates below-threshold roles with confirm dialog. Theme swapped to light-mode default across all modules. Feed cards show inline score breakdown chips with tier coloring. Built In job alerts parsed as new email source (5 roles added). |
| v3.3.0 | 2026-03-12 | **LinkedIn Network Prioritization + Dashboard Overhaul** — Feed scoring engine adds Network as 7th dimension (15% weight) using `pf_linkedin_network` (2,687 connections) and `pf_connections` (64 tracked). Purple network badges on cards. Pipeline dedup filters out roles already at active stages (5 filtered). Dashboard nudge cards now show company logo (Google Favicon API) and include both role title + company name in all nudge text. Fixed fuzzy company matching false positives (short names like "On"/"CT" no longer match inside "VectorOne" etc.) in Pipeline + Feed. |
| v3.2.1 | 2026-03-12 | **LinkedIn Job Alert Feed Integration** — Feed now parses LinkedIn Job Alert emails (`jobalerts-noreply@linkedin.com`) to extract individual job listings. 12 new roles added from LinkedIn alerts (Intuit, OpenAI, Stripe, Microsoft, SoFi, Salesforce, Adobe, Google, Sigma, Netflix, Uber, Harvey). Dual-link provenance: LinkedIn items show "LinkedIn ↗" (links to job posting) + "✉️" (links to Gmail alert email for full context). Gmail items still show "Gmail ↗" → original email. LinkedIn listed as active source in FEED_SOURCES. Scheduled `pathfinder-gmail-sync` task updated to scan both direct recruiter emails and LinkedIn Job Alert emails. |
| v3.2.0 | 2026-03-12 | **Live Gmail Feed + Source Linking** — Feed now shows real job emails from Gmail inbox instead of sample/demo data. Each feed card has a clickable "Gmail ↗" source badge that links directly to the original email. Referral badges ("🤝 Referred by X") shown on referred roles. Removed all demo data constants (`DEMO_FEED_ITEMS`, `DEMO_FEED_RUNS`). Auto-cleanup purges stale demo items (with `feed-*` IDs) on init. Gmail seed data loaded from `gmail-seed.json` when feed is empty. Auto-refresh timer reloads feed from localStorage every 15 minutes (picks up MCP sync agent updates). Hourly scheduled task scans Gmail for new job emails. "Check Now" button actually reloads and re-scores feed. Research Brief MCP bridge fallback fix: removed blocking check that prevented brief generation when bridge was down — now gracefully falls through to direct Claude API. |
| v3.1.0 | 2026-03-12 | **Inline Comms Per Contact** — Tracked connection cards are now expandable: click to reveal the contact's comms history and a quick-log input. Each card shows last activity date on the collapsed view. Standalone "Comms Log" section removed — contact-specific notes live inside each card, general notes (not tied to a contact) appear in a collapsible "General Notes" section. Quick-log input per card (channel selector + note + log button) for fast note-taking. |
| v3.0.0 | 2026-03-12 | **MCP-Backed Data Layer** — Major architectural change: localStorage is now a cache, MCP server is the source of truth. New shared `data-layer.js` (loaded in all 11 modules) monkey-patches `localStorage.setItem/removeItem` to transparently sync all `pf_*` data keys to the MCP HTTP bridge at `localhost:3456`. On startup, if core data (roles, companies, connections) is missing from localStorage, auto-recovers everything from MCP. HTTP bridge gains 4 new key-level endpoints: `PUT /data/:key`, `GET /data/:key`, `GET /data` (read all), `DELETE /data/:key`. Each key stored as individual JSON file in `~/.pathfinder/data/`. Graceful degradation: if bridge is down, app works via localStorage alone. 1-second debounce on sync writes to avoid flooding. Security: API keys (`pf_anthropic_key`) excluded from sync. UI-only keys (theme, view mode) excluded. 22 data keys synced. |
| v2.7.0 | 2026-03-12 | **LinkedIn Network Import** — Parsed 2,687 LinkedIn 1st-degree connections from data export into `pf_linkedin_network` localStorage key. Pipeline detail panel shows "LinkedIn Network (N)" section with connections sorted by seniority (VP/Director/Senior) and department relevance (Product and Engineering surfaced first). Purple "Product" and blue "Eng" department badges on matching titles. "Show More" button expands from top-10 preview to full list. Each name links to LinkedIn profile. "+ Track" button promotes a LinkedIn connection into active `pf_connections` tracking. Kanban cards show combined connection count (tracked + LinkedIn). Fuzzy company matching handles variants like "Amazon" matching "Amazon Ads". Python parser script normalizes company names (JPMorganChase → JPMorgan Chase). |
| v3.3.1 | 2026-03-12 | **Salary intelligence, light theme default, score transparency, Built In source** — Pipeline extracts salary from JDs (3-pattern regex), displays with color coding (green=in-range, red=below $250K floor, gray=unknown). New `pf_salary_prefs` key (min $250K, target $300K-$450K). Feed gates below-threshold roles with confirm dialog. Theme swapped to light-mode default across all modules. Feed cards show inline score breakdown chips with tier coloring. Built In job alerts parsed as new email source (5 roles added). |
| v2.6.0 | 2026-03-12 | **Remove Demo Mode — single-user architecture** — Deleted `data-switcher.js` and removed Demo/Personal toggle from all 11 modules. App now operates exclusively with real user data (no demo seed). Pipeline, Research Brief, Calendar, and Resume Builder no longer inject demo companies/roles/events on first load. Job Feed Listener reads from `pf_feed_queue` (localStorage, populated by Sync Hub) instead of hardcoded demo items. Empty-state banner updated. Bullet bank starter content preserved for new users. New architectural principle: localStorage will be backed by MCP server (coming in v3.0.0). |
| v2.5.0 | 2026-03-12 | **Pipeline side panel restructure** — Renamed "Resume Sent" to "Artifacts" section with type badges (resume, research, document). Added "Generate Research Brief" button that deep-links to Research Brief module with role pre-selected via URL params. Made Comms Log collapsible with accordion toggle (starts collapsed, shows entry count + latest date summary). Added `role.artifacts` array to data model for non-resume files. Research Brief module now supports `?roleId=X` URL parameter for deep-linking. |
| v2.4.0 | 2026-03-12 | **MCP pipeline backup system** — Added `pf_backup_pipeline` and `pf_restore_pipeline` MCP tools. Backups write timestamped JSON snapshots of all `pf_*` localStorage keys to `~/.pathfinder/backups/` with SHA-256 checksums. Restore tool supports listing all backups and restoring from a specific one. HTTP bridge endpoints added (`POST /backup`, `POST /restore`, `GET /backups`). Sync Hub auto-backs up after every `Sync All` run with localStorage fallback when MCP is unavailable. Max 50 backups with automatic pruning. |
| v2.3.2 | 2026-03-12 | **Migration data sync** — Updated all 3 migration files to match current browser state: 7 real roles (with full JDs, comms logs, resumes), 50 companies (fixed ATS domains → real domains for LiveRamp, RingCentral, Intuit), 63 connections (4 new manual). Bumped MIGRATION_VERSION to 4. Replaced dead Clearbit logoUrl references with Google Favicon API in migration data. |
| v2.3.1 | 2026-03-11 | **Sibling roles in detail panel** — Role detail slide-out now shows "Other Roles at [Company]" section listing all sibling roles at the same company with stage pill, tier, level, and last activity. Clicking a sibling navigates directly to its detail panel. Section only appears when multiple roles exist at the company. |
| v2.3.0 | 2026-03-11 | **Remove bulk-select + restore logos** — Deleted checkbox element and all bulk-select code (CSS, toolbar, JS functions). Switched from dead Clearbit API to Google Favicon API for reliable company logos. Letter-initial fallback for missing favicons. |
| v2.2.2 | 2026-03-11 | **Fix: checkbox white square** — The "checkbox in front of logos" was a literal `<input type="checkbox">` for bulk selection, always visible on every kanban card. Hidden by default now; shows on hover and when checked. |
| v2.2.0 | 2026-03-11 | **Personal data accuracy + logo fix + migration versioning**: Fixed logo "checkbox" appearance (removed white background boxes, switched to circular transparent logos). Corrected pipeline stages: Yahoo and Amazon Ads moved to "applied". Added LiveRamp to companies and roles (applied stage). Added migration version system to data-switcher — bumping `MIGRATION_VERSION` forces re-seed of personal data on next load, solving stale data problem. |
| v2.1.9 | 2026-03-11 | **Personal data integrity + logo polish**: Regenerated pf_roles.json with real outreach stages from spreadsheet (6 Outreach, 1 Screen, 38 Discovered) + personal notes from contact data. Fixed data-switcher to seed-once (backup/restore preserves user edits across mode switches). Polished logos to 32px with border-radius + domain overrides + letter-initial fallback. |
| v2.1.8 | 2026-03-11 | **Logo visibility fix**: Increased Pipeline kanban card logos from 20px→28px with white background + padding so Google Favicon API icons are visible on dark theme. Added letter-initial fallback for broken images. Fixed all 4 logo CSS classes. |
| v2.1.7 | 2026-03-11 | **Personal mode roles + Personal-first principle**: Generated `pf_roles.json` migration (45 roles from existing companies, one per company in "discovered" stage). Updated data-switcher to load roles alongside companies and connections. Fixed role data format to match Pipeline expectations (numeric timestamps, valid stage name, IC positioning). Added "Personal Mode Is the First-Class Citizen" as a core operating principle in build-with-ili skill — Personal mode is tested first, migration completeness is a ship-blocker, every feature must work with real data before it's considered done. |
| v2.1.6 | 2026-03-11 | **Data contract + double-prefix fixes**: Fixed cross-module data contract violation — company objects have `name` but no `id`, roles have `company` (string name) but no `companyId`. Changed all `c.id` lookups to `c.name` across 4 modules (Outreach critical fix — dropdowns showed "undefined"; Debrief, Calendar, Pipeline latent fixes). Fixed Calendar double-prefix bug — `getStorageData()`/`saveStorageData()` prepend `pf_` but all callers also passed `pf_`-prefixed keys, creating `pf_pf_*` keys that were never read back. Fixed dozens of call sites. Added selection restore in Outreach after sidebar rebuild. |
| v3.4.0 | 2026-03-12 | **Apify JD enrichment engine**: Feed roles with stub JDs (from email alerts) can now be enriched with full JD text via Apify's LinkedIn Jobs Scraper. Per-card "⚡ Enrich" button, batch "Enrich JDs" header button, JD quality badges (stub vs full), Apify API token settings in sidebar. Hybrid approach: searches LinkedIn for company+title, fuzzy-matches best result, extracts full JD. Free tier = $5/mo. |
| v2.1.5 | 2026-03-11 | **Data mode consistency**: Added Demo/Personal data-switcher toggle to 3 missing modules (Debrief, Comp Intel, Sync Hub) — all 11 modules now have the toggle. Made `clearAllData()` dynamically scan all `pf_*` localStorage keys instead of using a hardcoded list (protects API key + model). Fixed Resume Builder demo seeding to check `pf_resume_log` existence before overwriting. Removed false-positive double-prefix bug (`pf_pf_*`) from Known Issues — code was already correct. |
| v2.1.4 | 2026-03-11 | **Calendar bug fixes**: Fixed Add Event modal not opening (modal CSS class mismatch — `active` vs shared CSS `open` convention; modal was `display:flex` but `opacity:0`). Fixed Sync Log showing "undefined" for sync type (renderer expected `entry.action` but Sync Hub writes `entry.source`; now handles both data shapes and shows Added/Skipped detail rows). Discovered via Interactive QA workflow testing. |
| v2.1.3 | 2026-03-11 | **User-reported bug fixes + Pipeline view architecture fix**: Replaced dead Clearbit logo API (acquired by HubSpot) with Google Favicon API across 6 files + added one-time localStorage migration for existing data. Fixed Pipeline view toggle — removed conflicting parent-div click handler that destroyed child buttons via `textContent`. Removed scary "MCP bridge not running" notice from Research Brief (direct API works fine). Fixed `renderTable()` calling undefined `applyFilters()` → `filterRoles()`. Fixed Pipeline render/switchView architecture conflict — `render()` used CSS class selectors (`.kanban-view`) that collided with `.page` class, causing blank page. Changed init from `render()` to `switchView(currentViewMode)`, removed inline `display:none` from table-view and companies-view containers, let CSS rules handle visibility. |
| v2.1.2 | 2026-03-10 | **Visual QA bug fixes**: Fixed 4 bugs found during first-ever browser visual QA pass. Dashboard: match score displayed as 5000% instead of 50% (score already stored as percentage, code was multiplying by 100 again). Research Brief: module completely broken — `deleteBtn.aria-label` dot notation on hyphenated attribute caused SyntaxError (introduced during a11y polish). Debrief: module completely broken — 5 missing commas between methods in `DebriefApp` object literal. Calendar: `RangeError: Invalid time value` crash on init from invalid Date objects passed to `Intl.DateTimeFormat.format()`. |
| v2.1.0 | 2026-03-10 | **Perfection pass — all 8 browser modules polished to 100%**: Enterprise-grade error handling (try/catch on all localStorage ops), WCAG accessibility (aria-labels, aria-live, focus management, keyboard nav), visual polish (CSS transitions, hover states, loading spinners, empty states), data validation (form validation, email validation, numeric range checks, input sanitization), code quality (no console.logs, no TODOs, JSDoc on all functions). |
| v2.0.0 | 2026-03-10 | **Batch 2 — System-wide completion milestone**: Sync Hub gains outreach draft push section, richer Gmail parsing (recruiter InMail, interview scheduling, rejections, offers), data freshness indicators (green/yellow/red), sync statistics dashboard, scheduling UI with auto-sync toggle, and sync log export. Dashboard adds Google Calendar integration card (next 3 events with countdown timers and type badges), sync status indicator with stale data warning, quick actions row (4 buttons), debrief pending badge, and outreach queue indicator. Pipeline adds Clay company enrichment display with intelligence section, auto-enrichment status badges on company cards, role stage analytics with conversion rates and funnel chart, and stale role detection (14+ day amber badges). MCP Server upgraded from stubs to full implementations: all 7 tools complete (save, get, list, search, tag, delete, generate-brief), enhanced storage layer with SHA-256 checksums and auto-excerpts, full-text search with relevance scoring, soft/hard delete, comprehensive README and implementation status docs. |
| v3.5.0 | 2026-03-12 | **JD-first scoring engine + Apify actor swap**: Rewrote `scoreRole()` with `searchText` pattern — scans full JD when available, falls back to title+company+domain for stubs. Activated `mustHaveKeywords` in keyword dimension (60/40 composite with boost keywords). Swapped Apify actor from `bebity` (trial expired) to `valig/linkedin-jobs-scraper` (consumption-based, free tier). Made actor ID configurable in sidebar settings (`pf_apify_actor`). Multi-format actor input support (field-based vs searchUrl-based). Specific 403 error handling with actionable guidance. |
| v1.9.0 | 2026-03-10 | **Batch 1 — Six-module feature completion**: Research Brief gains citation system (footnotes, source aggregation) and localStorage artifact save (pf_research_briefs) with saved briefs panel. Job Feed adds career page URL import (Lever/Greenhouse/Ashby/Workday/LinkedIn parsing) and Sources tab with per-source analytics and filtering. Comp Intel adds Indeed salary data integration, bulk import (CSV/JSON/plaintext), market positioning chart with percentile visualization, and enhanced negotiation with BATNA identification. Calendar adds auto-trigger debrief button on past interview events with pending debrief badge count. Debrief auto-populates from Calendar via pf_pending_debrief and shows "Recent Events Needing Debrief" section with cross-module status sync. Mock Interview adds 100+ real question bank across 11 companies/7 types/3 difficulties, Question Bank tab with multi-level filtering, custom questions, practice tracking, and company-calibrated Claude sessions. |
| v1.8.0 | 2026-03-10 | **Resume export + Gmail integration**: Resume Builder now exports to DOCX (via docx.js) and PDF (via html2pdf.js) with ATS-friendly formatting, proper headings/bullets, and auto-naming by company/title. Outreach module gains "Open in Gmail" button (pre-fills Gmail compose URL with subject/body/recipient), "Queue as Draft" button (saves to pf_outreach_gmail_queue for Cowork batch sending), and draft queue viewer with status tracking. |
| v1.7.0 | 2026-03-10 | **Sync Hub — External API integration**: New Sync Hub module (modules/sync/) bridges Google Calendar, Indeed, Gmail, and Clay into Pathfinder. Google Calendar events auto-classify (interview/networking/prep/personal) and sync to Calendar module. Indeed job listings sync to Job Feed with full scoring. Gmail job alerts (Built In, LinkedIn, referrals) extract leads to Job Feed and application confirmations to Pipeline. Clay enrichment placeholder for company data. File upload for fresh sync payloads from Cowork. Dedup engine prevents duplicate syncs. Sync Hub added to all module navbars. |
| v1.6.0 | 2026-03-10 | **Feature completion pass**: 50+ features added across all 9 browser modules. Pipeline: URL import, bulk actions, CSV export, company view, fit assessment, keyboard shortcuts. Dashboard: feed review, interview intelligence, pipeline funnel, activity feed, weekly stats, real-time storage listener. Job Feed: manual entry form, dedup engine, 6-point quick-check filter, auto-pipeline creation, analytics, snooze. Resume Builder: cover letter generation, bullet bank UI, keyword gap detection, version history. Outreach: sequence scheduling, response tracking, message templates, history/analytics. Mock Interview: story bank extraction, question bank, session playback, performance trends. Debrief: pattern analysis, timeline, export, Research Brief triggers. Comp Intel: visualization charts, comparison table, aggregation stats, 25-point negotiation scorecard. Calendar: month view, day view, smart event-role linking. |
| v1.5.0 | 2026-03-10 | **Full system implementation**: All 10 modules rebuilt with real functionality. Shared Claude API utility (direct browser API calls). Dashboard: 12-rule nudge engine with real localStorage data. Job Feed: weighted scoring engine (6 dimensions). Research Brief: direct Claude API fallback. Resume Builder: Phase 2 streaming generation. Outreach: 8 message types via Claude. Mock Interview: multi-turn Claude sessions. Debrief: 8-section form + Claude synthesis. Comp Intelligence: data entry + negotiation strategy. Calendar: manual event tracking + pre/post-interview nudges. MCP server: artifact ID collision fix + search scoring fix. |
| v1.4.4 | 2026-03-10 | Job Feed PRD v1.1.0: credited Abhijay Arora Vuyyuru's AI job search automation work as primary inspiration, expanded Section 13 with specific workflow references |
| v1.4.3 | 2026-03-10 | Complete standalone PRD suite: Pipeline Tracker, Dashboard, Outreach, Mock Interview, Debrief, Comp Intelligence, Calendar, Artifacts MCP Server |
| v1.4.2 | 2026-03-10 | Standalone PRDs for Resume Builder and Job Feed Listener modules |
| v1.4.1 | 2026-03-10 | Bug fixes: markdown-to-HTML sanitization in Research Brief & Resume Builder, auto-analysis on role selection in Resume Builder |
| v1.4.0 | 2026-03-10 | Research Brief v2 engine: MCP server with Claude API integration (14 section-specific prompts), HTTP bridge (localhost:3456), browser-side 3-batch generation engine, API key settings UI, extended keyboard shortcuts |
| v1.3.10 | 2026-03-10 | Pipeline: resume attachment (IndexedDB file storage, drag-and-drop upload, preview/download), comms log (timestamped notes tied to connections with channel + link tracking) |
| v1.3.9 | 2026-03-10 | Pipeline: company logos (Google Favicons, ATS-aware domain extraction), connections section with LinkedIn links, inbound outreach tracking (optional title, contact capture, outreach context logging). Research Brief: company logos in sidebar |
| v1.3.8 | 2026-03-10 | Research Brief v2 overhaul (13 sections, MCP generation, standalone PRD), Opaque Recruiter Outreach (unknown company/role/both with reveal flow), Research Brief degraded mode for partial-info roles |
| v1.3.7 | 2026-03-10 | Citations & Source Tracking PRD redesign — MCP-server-centric architecture (citations as artifact type, 3 new MCP tools), Source Ledger centralized roll-up view, inline citations in context (Research Brief, Pipeline detail, Outreach) |
| v1.3.6 | 2026-03-10 | Pipeline: role detail/edit slide-out panel (full CRUD, stage history timeline, date editing, delete), URL import for Add New Role (CORS proxy chain), Research Brief persistence (auto-restore cached briefs on page load) |
| v1.3.5 | 2026-03-10 | Research Brief & Resume Tailor Personal mode fixes (data normalization, targetLevel inference), Dashboard theme toggle fix, Job Feed sample-data banner |
| v1.3.4 | 2026-03-10 | Fix Research Brief role selector (script parse error), Dashboard nav aligned to shared .nav component |
| v1.3.3 | 2026-03-10 | Fix Personal mode across all 7 modules (demo seeding guard), Debrief role selector grouped by company |
| v1.3.2 | 2026-03-10 | Pipeline search across companies & roles, Personal mode demo data fix, Command Palette shows all companies |
| v1.3.1 | 2026-03-10 | Data migration from Contact-Outreach.xlsx, Demo/Personal toggle, full 10-module nav, narrower Kanban columns |
| v1.3.0 | 2026-03-09 | Calendar Integration Agent + Artifacts MCP Server built — all 11 modules complete |
| v1.2.5 | 2026-03-09 | Mock Interview, Debrief, and Comp Intelligence agents built |
| v1.2.4 | 2026-03-09 | Outreach Message Generator built — 8 message types, 3 tones, sequence tracker |
| v1.2.3 | 2026-03-09 | Job Feed Listener built — preference profile, scoring engine, feed review cards |
| v1.2.2 | 2026-03-09 | Dashboard & Launcher built — greeting + streak, nudge engine, pipeline stats, quick actions, module nav |
| v1.2.1 | 2026-03-09 | Research Brief Agent built — 10-section streaming brief, per-section caching, floating TOC, export/print |
| v1.2.0 | 2026-03-09 | Resume Tailor built — two-phase workflow (JD analysis + resume builder), bullet bank, version log, live preview |
| v1.1.0 | 2026-03-09 | Pipeline Tracker built, design system CSS created, README + CHANGELOG added, code documentation pass |
| v1.0.0 | 2026-03-09 | Initial PRD completed — all 11 agents specified, data schemas, design system spec, repo scaffolded |
