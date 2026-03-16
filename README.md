# Pathfinder

**An agentic job search system built on Claude.**

Pathfinder is a system of 11 specialized AI agents that collaborate to manage every stage of a senior PM job search — from discovering roles through closing offers. Each agent is a standalone HTML page, zero build step required.

## Why Pathfinder?

The job search tool market is fragmented: Teal for tracking, Jobscan for ATS optimization, Final Round AI for mock interviews, Apollo for outreach — none of them share context. Pathfinder replaces 4-5 separate subscriptions with a single local system where information is entered once and flows everywhere it's needed.

## The Agents

| Module | What It Does | Status |
|--------|-------------|--------|
| **Pipeline Tracker** | Kanban board + table view for tracking companies and roles through 8 stages | Built |
| **Dashboard & Launcher** | Daily action queue, pipeline summary, streak tracking, nudge engine | Built |
| **Job Feed Listener** | Monitors Gmail alerts, Indeed, Dice; scores roles 0-100 against your preferences | Built |
| **Research Brief** | Streams a 10-section company/role prep brief from Claude | Built |
| **Resume Tailor** | Positioning-aware resume generation (IC vs. management framing) with bullet bank | Built |
| **Calendar Integration** | Links Google Calendar to pipeline, triggers stage transitions | Built |
| **Outreach Generator** | Drafts 8 message types with real personalization signals | Built |
| **Post-Interview Debrief** | Structured feedback capture, pattern detection across interviews | Built |
| **Comp Intelligence** | Benchmarks comp from Levels.fyi, negotiation support | Built |
| **Mock Interview** | Company-calibrated practice across 7 interview types | Built |
| **Artifacts MCP Server** | Shared file layer for research briefs, resumes, JDs, debriefs | Built |

## Architecture

- **Zero build step** — vanilla HTML/CSS/JS, each module is a single `.html` file
- **Shared data layer** — localStorage with `pf_` prefixed keys
- **Design system** — `modules/shared/pathfinder.css` provides all tokens and components
- **Deployment** — GitHub Pages (free), works offline after first load

## Quick Start

1. Clone this repo
2. Open `modules/pipeline/index.html` in your browser
3. That's it. No `npm install`, no build, no server.

## Docs

- **[Full PRD](docs/PRD.md)** — the complete product requirements document (2200+ lines covering every agent, data schema, and design decision)
- **[Resume Customization Agent Spec](docs/resume_customization_agent_spec.md)** — detailed spec for the resume tailor (also integrated into PRD Section 7.3)
- **[Changelog](CHANGELOG.md)** — version history

## Tech Stack

- HTML5 / CSS3 / Vanilla JavaScript
- CSS Custom Properties (design tokens)
- localStorage (data persistence)
- Claude API via Artifacts MCP (agent intelligence)
- Clearbit Logo API (company logos)
- GitHub Pages (deployment)

## Project Structure

```
pathfinder-job-search/
├── README.md
├── CHANGELOG.md
├── docs/
│   ├── PRD.md                           # Full product requirements
│   └── resume_customization_agent_spec.md
├── modules/
│   ├── shared/
│   │   └── pathfinder.css               # Design system
│   ├── pipeline/
│   │   └── index.html                   # Pipeline Tracker
│   ├── dashboard/
│   │   └── index.html                   # Dashboard & Launcher
│   ├── job-feed-listener/
│   │   └── index.html                   # Job Feed Listener
│   ├── research-brief/
│   │   └── index.html                   # Research Brief Agent
│   ├── resume-tailor/
│   │   └── index.html                   # Resume Tailor Agent
│   ├── outreach/
│   │   └── index.html                   # Outreach Message Generator
│   ├── mock-interview/
│   │   └── index.html                   # Mock Interview Agent
│   ├── debrief/
│   │   └── index.html                   # Post-Interview Debrief
│   ├── comp-intel/
│   │   └── index.html                   # Comp Intelligence Agent
│   └── calendar/
│       └── index.html                   # Calendar Integration Agent
├── mcp-servers/
│   └── pathfinder-artifacts-mcp/        # Artifacts MCP server (TypeScript)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                 # Server entry point
│           ├── types.ts                 # Type definitions
│           ├── constants.ts             # Configuration
│           ├── services/storage.ts      # File system + index management
│           └── tools/                   # 6 MCP tools (save, get, list, search, tag, delete)
└── skills/                              # Claude skill definitions
```

## License

Private project by Ili Selinger.
