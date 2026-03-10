# Pathfinder Artifacts MCP Server

The Artifacts MCP Server is the shared file system for the Pathfinder job search system. It provides structured storage, retrieval, and search for every document the system produces or the user uploads.

## Overview

Pathfinder is a system of 11 specialized AI agents managing a senior PM job search. The Artifacts MCP Server handles all artifact storage, indexing, searching, and tagging.

- **Storage Location**: `~/.pathfinder/artifacts/`
- **Index File**: `~/.pathfinder/artifacts/index.json`
- **Transport**: stdio (local integration only)
- **No cloud sync**, no network calls, no telemetry — all data stays on the user's machine

## Features

- **Structured Storage**: Artifacts organized by type (research_briefs, resumes, jd_snapshots, etc.)
- **Full-Text Search**: Search artifact contents by query string
- **Flexible Filtering**: Filter by tags, company, roleId, type, or date range
- **Soft Delete**: Move artifacts to archive instead of permanent deletion
- **Auto-Indexing**: Maintain a queryable metadata index (index.json)
- **Automatic Directory Creation**: Type directories created on first save

## Setup

```bash
npm install
npm run build
node dist/index.js
```

## MCP Tools

All tools are prefixed with `pf_` (Pathfinder):

### `pf_save_artifact`

Save a file with structured metadata.

**Parameters:**
- `content` (string): File content
- `filename` (string): Display filename (e.g., "stripe-staff-pm-brief.html")
- `type` (string): Artifact type (research_brief, resume, jd_snapshot, fit_assessment, homework_submission, offer_letter, networking_notes, cover_letter, interview_notes, debrief, mock_session, outreach_draft, thank_you_note, comp_benchmark)
- `company` (string): Company name (e.g., "Stripe", "Meta")
- `tags` (string[]): Optional tags for categorization
- `metadata` (object, optional): Additional metadata object

**Returns:**
```json
{
  "artifactId": "research_brief_stripe_1709942400",
  "path": "/Users/username/.pathfinder/artifacts/research_briefs/stripe-staff-pm-2026-03-09.html"
}
```

### `pf_get_artifact`

Retrieve a specific artifact by ID.

**Parameters:**
- `artifactId` (string): Artifact ID to retrieve

**Returns:**
```json
{
  "content": "...",
  "metadata": {
    "artifactId": "research_brief_stripe_1709942400",
    "filename": "stripe-staff-pm-brief.html",
    "type": "research_brief",
    "company": "Stripe",
    "tags": ["research", "staff-pm"],
    "createdAt": "2026-03-09T10:30:00Z",
    "updatedAt": "2026-03-09T10:30:00Z"
  }
}
```

### `pf_list_artifacts`

Query artifacts by filters.

**Parameters:**
- `tags` (string[], optional): Filter by tags (any match)
- `company` (string, optional): Filter by company
- `roleId` (string, optional): Filter by role ID
- `type` (string, optional): Filter by artifact type
- `dateRange` (object, optional): Filter by date range `{ startDate?: string, endDate?: string }`

**Returns:**
```json
[
  {
    "artifactId": "research_brief_stripe_1709942400",
    "filename": "stripe-staff-pm-brief.html",
    "type": "research_brief",
    "company": "Stripe",
    "tags": ["research", "staff-pm"],
    "createdAt": "2026-03-09T10:30:00Z"
  }
]
```

### `pf_search_artifacts`

Full-text search across artifact content.

**Parameters:**
- `query` (string): Search query

**Returns:**
```json
[
  {
    "artifactId": "research_brief_stripe_1709942400",
    "filename": "stripe-staff-pm-brief.html",
    "relevance": 0.85
  }
]
```

### `pf_tag_artifact`

Add or modify tags on an existing artifact.

**Parameters:**
- `artifactId` (string): Artifact ID to tag
- `tags` (string[]): Tags to add (merged with existing)

**Returns:**
```json
{
  "updated": true,
  "artifactId": "research_brief_stripe_1709942400",
  "tags": ["research", "staff-pm", "new-tag"]
}
```

### `pf_delete_artifact`

Remove an artifact (soft delete — moves to archive).

**Parameters:**
- `artifactId` (string): Artifact ID to delete

**Returns:**
```json
{
  "deleted": true,
  "artifactId": "research_brief_stripe_1709942400",
  "archivedAt": "2026-03-09T10:31:00Z"
}
```

## Artifact Types

Supported artifact types and their typical sources:

| Type | Source | Format | Purpose |
|------|--------|--------|---------|
| `research_brief` | Research Brief Agent | HTML | Company and role research |
| `resume` | Resume Tailor Agent | DOCX | Tailored resume for target role |
| `jd_snapshot` | Pipeline Tracker | Text | Saved job description |
| `fit_assessment` | Resume Tailor Agent | JSON | Structured role fit analysis |
| `homework_submission` | User upload | Any | Take-home assignment |
| `offer_letter` | User upload | PDF/DOCX | Offer documentation |
| `networking_notes` | User written | Text/DOCX | Networking conversation notes |
| `cover_letter` | Cover Letter Agent (future) | DOCX | Role-specific cover letter |
| `interview_notes` | User written | Text | Post-interview debrief |
| `debrief` | Debrief Agent | JSON/HTML | Structured post-interview analysis |
| `mock_session` | Mock Interview Agent | JSON/HTML | Mock interview transcript |
| `outreach_draft` | Outreach Message Generator | Text | Networking/cold outreach draft |
| `thank_you_note` | Outreach Message Generator | Text | Post-interview thank-you |
| `comp_benchmark` | Comp Intelligence Agent | JSON | Compensation research data |

## Storage Structure

```
~/.pathfinder/artifacts/
├── index.json                    # Queryable metadata index
├── research_briefs/
│   └── stripe-staff-pm-2026-03-09.html
├── resumes/
│   └── meta-senior-pm-ic-2026-03-08.docx
├── jd_snapshots/
│   └── stripe-staff-pm-2026-03-09.txt
├── homework/
│   └── airbnb-case-study-2026-03-15.pdf
├── offers/
├── networking_notes/
├── cover_letters/
├── interview_notes/
├── debrief/
├── mock_sessions/
├── outreach/
├── thank_you/
├── comp_benchmarks/
├── fit_assessments/
├── misc/
└── .archive/                     # Soft-deleted artifacts
    └── research_brief_stripe_1709942400.json
```

## Implementation Details

### Artifact ID Format

Generated as `{type}_{company-slug}_{unix-timestamp}`:
- Example: `research_brief_stripe_1709942400`
- Characters: lowercase letters, numbers, underscores only
- Ensures uniqueness and readability

### Index File Structure

The `index.json` maintains all artifact metadata:

```json
{
  "artifacts": [
    {
      "artifactId": "research_brief_stripe_1709942400",
      "filename": "stripe-staff-pm-brief.html",
      "type": "research_brief",
      "company": "Stripe",
      "roleId": null,
      "tags": ["research", "staff-pm"],
      "createdAt": "2026-03-09T10:30:00Z",
      "updatedAt": "2026-03-09T10:30:00Z",
      "path": "/Users/username/.pathfinder/artifacts/research_briefs/stripe-staff-pm-2026-03-09.html",
      "sizeBytes": 45320
    }
  ]
}
```

### Full-Text Search

The search tool reads artifact contents and performs simple string matching. For better performance on large artifact stores, the search limits results to 50 matches.

### Soft Delete

When an artifact is deleted, it is moved to `~/.pathfinder/artifacts/.archive/` with a snapshot of its metadata. This allows for recovery without permanent loss.

## Integration with Claude

Add to your `claude_desktop_config.json` (or Cowork MCP settings):

```json
{
  "mcpServers": {
    "pathfinder-artifacts": {
      "command": "node",
      "args": ["/path/to/pathfinder-job-search/mcp-servers/pathfinder-artifacts-mcp/dist/index.js"]
    }
  }
}
```

After adding, restart Claude Desktop. The 6 `pf_*` tools will be available in any conversation.

## Development

```bash
# Type checking
npm run type-check

# Watch mode for development
npm run dev

# Build production code
npm run build
```

## Error Handling

The server handles the following error cases gracefully:

- **File system errors**: Directory creation failures, permission issues
- **Invalid inputs**: Missing required fields, invalid artifact types
- **Not found**: Artifact ID doesn't exist in index
- **Corrupted index**: index.json is invalid or missing
- **Invalid date ranges**: End date before start date

All errors return descriptive MCP error responses that tools can handle.

## Security & Privacy

- All artifacts stored locally in `~/.pathfinder/artifacts/`
- No network calls, no cloud sync, no external APIs
- No telemetry or tracking
- User has full control over storage directory
- Can be backed up, encrypted, or synced with user's preferred tool
