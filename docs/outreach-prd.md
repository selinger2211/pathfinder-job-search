# Outreach Message Generator Module — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/outreach/`
**Version:** v3.29.0
**Last Updated:** 2026-03-15
**Status:** Active — v3.29.0 features live

---

## 1. Purpose

The Outreach Message Generator is the voice module of Pathfinder. Every connection you make in your job search requires a message: a LinkedIn connection request, a cold email, a referral ask, a thank-you note. Each message needs to be personal, concrete, and real — never generic.

**Design Principles:**

1. **Personalization is mandatory.** Every message must reference at least one of: a specific product/initiative/news, the recipient's specific role, a concrete reason your background is relevant, or a mutual connection/shared history. Generic patterns are explicitly forbidden.
2. **Context-rich generation.** The message generator reads the company profile, role details, connection record, and your positioning (resume bullets, story bank) to craft messages that feel like they come from you, not a template.
3. **User control, always.** Messages are never auto-sent. The generator produces a draft. You review it, edit it, and send it yourself. The system tracks that you sent it and marks the outreach sequence step as complete.
4. **Sequence-aware.** Not every message is the same. A connection request is 300 characters. A cold email is 4-6 sentences. A follow-up is shorter. A thank-you note after an interview is specific to that interviewer. The generator knows the step and the structure.
5. **Smart debrief handoff.** When you complete an interview, the Debrief Agent captures what you learned. For thank-you notes, the Outreach Generator reads that debrief and personalizes the note with what you discussed.

---

## 2. Architecture

### High-Level Data Model

```
┌─────────────────────────────────────┐
│  Outreach Message Generator         │
│  (modules/outreach/)                │
└──────────────┬──────────────────────┘
               │ (reads from)
     ┌─────────┼────────┬─────────┬──────────┐
     ▼         ▼        ▼         ▼          ▼
  Pipeline   Research  Resume   Debrief   Positioning
  (roles,    Brief     Builder  Agent     (bullets,
  companies, (company  (bullets, (interview story bank)
  connections) context) stories)  context)
```

### Data Flow

```
User opens Dashboard → sees "Draft message" nudge
        │
        ▼
User clicks → Outreach module opens
        │
        ├── Browser reads pf_roles, pf_companies, pf_connections
        ├── Browser reads pf_bullet_bank, pf_story_bank (for positioning)
        ├── Browser reads pf_outreach_steps (next step in sequence)
        ├── For thank-yous: Browser reads most recent pf_debrief for roleId
        │
        ▼
User confirms context (company, connection, message type)
        │
        ▼
Browser calls MCP tool: pf_generate_outreach_message
  Input: roleId, connectionId, messageType, context
  Returns: draft message text + personalization citations
        │
        ▼
Browser displays draft for editing
        │
        ▼
User reviews, edits (optional), clicks "Copy to clipboard" or "Open in email"
        │
        ▼
User manually sends message (via email, LinkedIn, etc.)
        │
        ▼
User marks "Sent" in Outreach module
        │
        ├── Updates pf_connections[connectionId].outreachLog
        ├── Marks pf_outreach_steps entry as completed
        └── Sets nextStep (if applicable) and nextDueDate
```

### Storage Model

```
┌────────────────────────────────────────┐
│     localStorage keys                  │
├────────────────────────────────────────┤
│ pf_roles: Role[]                       │  ← Read-only
│ pf_companies: Company[]                │  ← Read-only
│ pf_connections: Connection[]           │  ← Read-only (outreachLog in each)
│ pf_bullet_bank: Bullet[]               │  ← Read-only
│ pf_story_bank: Story[]                 │  ← Read-only
│ pf_debrief: Debrief[]                  │  ← Read-only (from Debrief Agent)
│                                        │
│ pf_outreach_steps: {                   │  ← Outreach writes
│   connectionId: string,                │
│   roleId: string,                      │
│   currentStep: string,                 │
│   completedSteps: string[],            │
│   nextDueDate: ISO timestamp,          │
│   stepHistory: {                       │
│     step: string,                      │
│     sentDate: ISO timestamp,           │
│     messageType: string,               │
│   }[]                                  │
│ }                                      │
└────────────────────────────────────────┘
```

---

## 3. UI Specification

### 3.1 Module Entry Point

When the Outreach module opens (from Dashboard nudge or direct link), it shows:

**URL pattern:** `/modules/outreach/index.html?connectionId={id}&roleId={id}`

**Layout:**

```
┌─────────────────────────────────────┐
│  Outreach Message Generator         │
│                                     │
│  Drafting message for:              │
│  ┌──────────────────────────────┐   │
│  │ John Chen                    │   │
│  │ Senior PM at Stripe          │   │
│  │ Connected via Greylock       │   │
│  │                              │   │
│  │ Re: Staff Product Manager    │   │
│  │ San Francisco, CA            │   │
│  └──────────────────────────────┘   │
│                                     │
│  Message Type:                      │
│  [ ] Connection Request             │
│  [x] Cold Email Initial             │  ← auto-selected based on step
│  [ ] Cold Email Follow-up           │
│  [ ] Referral Request               │
│  [ ] InMail                         │
│  [ ] Thank You (Networking Call)    │
│  [ ] Thank You (Interview Round)    │
│  [ ] Recruiter Response             │
│                                     │
│  [Generate Draft] [Edit Context]    │
└─────────────────────────────────────┘
```

**Key interactions:**

- **Connection card** — Shows who you're reaching out to, their role, how you know them (relationship context)
- **Role card** — Shows the position you're reaching out about
- **Message Type selector** — Defaults to the next step in the outreach sequence, but user can override (e.g., "I want to send an InMail instead")
- **Edit Context button** — Opens a sidebar where user can add/refine: company mission focus, specific product/initiative, mutual connection details, personal research notes. This enriches the prompt sent to the generator.
- **Generate Draft button** — Calls the MCP tool to generate the message

### 3.2 Draft Display & Editing

After clicking "Generate Draft":

```
┌──────────────────────────────────────────┐
│  DRAFT MESSAGE                           │
│                                          │
│  Type: Cold Email Initial                │
│  To: john.chen@stripe.com                │
│  Length: 142 words (4 sentences)         │
│                                          │
│  ─────────────────────────────────────── │
│                                          │
│  Subject: Stripe's fraud detection work │
│                                          │
│  Hi John,                                │
│                                          │
│  I came across your work on Stripe's     │
│  fraud detection roadmap [^1] and I'm   │
│  genuinely impressed. I've spent the     │
│  last two years building anomaly         │
│  detection systems at AcmeCorp, and      │
│  seeing how Stripe is approaching the    │
│  problem at scale is exactly where I     │
│  want to go next.                        │
│                                          │
│  Would you be open to a 15-minute call   │
│  next week? I'd love to learn more about │
│  the team's priorities and share what    │
│  I'm working on.                         │
│                                          │
│  Best,                                   │
│  [Your Name]                             │
│                                          │
│  [^1] LinkedIn post, Feb 2026            │
│                                          │
│  ─────────────────────────────────────── │
│                                          │
│  Personalization Signals:                │
│  ✓ Specific initiative: fraud detection  │
│  ✓ Recipient's role: VP Product          │
│  ✓ Your background: anomaly detection    │
│  ✓ Mutual connection: None (cold)        │
│                                          │
│  [Edit Message] [Copy to Clipboard]     │
│  [Open in Email] [Discard] [Send Later] │
└──────────────────────────────────────────┘
```

**Features:**

- **Subject line** — Shown prominently if applicable (emails, InMails)
- **Full message text** — Editable inline in a text area
- **Citations** — Footnotes (e.g., `[^1]`) link to sources: LinkedIn post, news article, your bullet bank, story bank, known context
- **Personalization checklist** — Shows which of the 4 personalization pillars are present. Helps user assess quality before sending.
- **Word count / sentence count** — Ensures message fits the type (e.g., "4-6 sentences for cold email")
- **Action buttons:**
  - **Edit Message** — Toggles inline text editing
  - **Copy to Clipboard** — Copies full message for pasting into email/LinkedIn
  - **Open in Email** — Opens user's default email client with draft pre-filled
  - **Discard** — Clears and starts over
  - **Send Later** — Saves draft as a reminder for later (stored in localStorage)

### 3.3 Message Type Specifications

Each message type has a specific structure, length, and purpose. The generator adjusts tone and depth accordingly.

#### 3.3.1 LinkedIn Connection Request (300 characters max)

**Purpose:** Get on their radar so you can DM later.

**Structure:**
1. One specific thing about them or their work
2. One concrete reason your background is relevant
3. Soft ask: "I'd love to connect"

**Example:**
```
Hi John, I've followed Stripe's fraud detection
initiatives closely and I've spent 2 years building
anomaly systems. Would love to connect and learn
from your work. Best, [Name]
```

**Citations:** Can reference LinkedIn post, news, or mutual connection.

#### 3.3.2 Cold Email Initial (4-6 sentences)

**Purpose:** Introduce yourself and propose a concrete next step.

**Structure:**
1. Hook: specific thing about them / their work / company moment
2. Your credibility: one concrete sentence about relevant experience
3. Why now: reason this conversation makes sense
4. Soft ask: 15-minute call? Coffee chat? Review something?
5. Closing: signature with optional LinkedIn link

**Example:**
```
Hi John,

I've followed Stripe's pivot into fraud detection
and it aligns perfectly with a problem I solved at
AcmeCorp. I built the detection layer that caught
$2M in fraud per week.

I'd love to chat about how Stripe is approaching
this and explore whether there's a fit. Are you
open to a 15-minute call next week?

Best,
[Name]
[LinkedIn URL]
```

**Constraints:** 4-6 sentences max. No long paragraphs.

#### 3.3.3 Cold Email Follow-up (2-3 sentences)

**Purpose:** Gentle reminder; assume first email landed but they're busy.

**Structure:**
1. Reference the previous email (don't repeat it)
2. New angle or reason to respond now (slight time pressure, new context)
3. Soft ask: still open? Did you see the first message?

**Example:**
```
Hi John,

Wanted to bump my previous note — I know your
team is scaling fraud detection efforts this quarter.
Would still love to chat. Quick 15-min call?

[Name]
```

**Constraints:** 2-3 sentences. Assume they read the first email.

#### 3.3.4 Referral Request (3-4 sentences)

**Purpose:** Ask an existing connection to refer you to someone new.

**Structure:**
1. Thank them for being in your network
2. Specific person/role/company you're targeting
3. Why you think you're a good fit (one sentence)
4. Ask: "Would you be willing to intro?"

**Example:**
```
Hi Sarah,

Hope you're doing well. I'm exploring Product
Manager roles at Stripe, specifically on their
payments team. I've built payment integrations
that processed $500M+ in volume.

Would you be open to introducing me to someone
on the team? Happy to prep you with my background.

Best,
[Name]
```

**Constraints:** Don't ask them to explain your background — do that yourself.

#### 3.3.5 InMail (3-5 sentences)

> **Status: Planned** — LinkedIn InMail message type not yet implemented.

**Purpose:** LinkedIn InMail to someone you haven't reached out to yet.

**Structure:**
1. Direct, credible hook (research you've done)
2. Your relevant experience (specific, measurable)
3. Why it matters (to them, now)
4. Soft ask: coffee chat, lunch, 15 minutes?

**Example:**
```
Hi John,

I've been impressed by Stripe's product roadmap
and especially the new fraud detection module.
I spent three years building ML-powered detection
systems at AcmeCorp, shipping models that prevented
$2M in fraud annually.

I'd love to chat about what you're building and
explore whether my background is relevant to your team.

Best,
[Name]
```

**Constraints:** InMails have more room (5 sentences OK). Treat like cold email but you can go slightly deeper.

#### 3.3.6 Thank You (Networking Call) (3-4 sentences)

**Purpose:** Follow-up after a call with a potential advisor/mentor/referrer.

**Structure:**
1. Thank them for their time
2. One specific thing you learned or appreciated
3. Concrete next step (if applicable): what you'll do with their advice
4. Optional: offer to stay in touch / reconnect in 3 months

**Example:**
```
Hi Sarah,

Thanks so much for taking the time yesterday.
I really appreciated your insight on how Stripe
is scaling the payments team — that context on
the new fraud initiative is exactly what I needed.

I'm following your advice and will reach out to
John next week. Will let you know how it goes.

Best,
[Name]
```

**Constraints:** Keep it brief and genuine. This is relationship maintenance.

#### 3.3.7 Thank You (Interview Round) (4-5 sentences per interviewer)

**Purpose:** Follow-up after an interview. Personalized per interviewer based on debrief.

**Structure:**
1. Thank them for their time and feedback
2. One specific thing you discussed (from interview notes)
3. How you see yourself contributing (on that specific topic)
4. Next steps: "Looking forward to hearing from you"
5. Optional: reference a concrete question they asked and your follow-up research

**Example (from debrief):**
```
Hi John,

Thank you for the time yesterday and for the deep
dive on the fraud detection roadmap. I really
appreciated your perspective on the ML modeling
challenges ahead.

Thinking about what we discussed, I'm convinced
that my background in anomaly detection at AcmeCorp
maps well to the problem. I've been reading about
Stripe's recent investments in real-time detection
and I have some ideas on how to reduce false positives.

Looking forward to the next conversation.

Best,
[Name]
```

**Constraints:** Pull specific details from the Debrief Agent's notes for this interview. Don't be generic.

> **Status: Implemented (v3.13.0)** — Debrief integration active. Pulls interview context and generates personalized thank-yous.

#### 3.3.8 Recruiter Response (3-5 sentences)

**Purpose:** Reply to a recruiter who reached out to you.

**Structure:**
1. Thank them for reaching out
2. Express interest (genuine + specific)
3. Ask for key info: JD, timeline, process
4. Offer availability: "I'm available for a call Tuesday-Thursday"

**Example:**
```
Hi Alex,

Thanks for reaching out about the Staff PM role
at Stripe. I've been impressed by Stripe's product
strategy and would be interested in learning more.

Can you share the JD and let me know the interview
timeline? I'm available for a call Tuesday-Thursday
this week.

Best,
[Name]
```

**Constraints:** Be responsive but curious. Don't over-commit before knowing more.

---

## 4. Message Generation Logic

### 4.1 Generation Inputs

When the browser calls `pf_generate_outreach_message`, it sends:

```json
{
  "roleId": "role_123",
  "connectionId": "conn_456",
  "messageType": "cold_email_initial",
  "context": {
    "company": {
      "name": "Stripe",
      "mission": "Economic infrastructure for the internet",
      "recentFocus": "AI-powered fraud detection",
      "newsItems": ["Series E funding Mar 2026"]
    },
    "role": {
      "title": "Staff Product Manager",
      "description": "Build fraud detection product from 0-to-1",
      "reportingLine": "VP Product"
    },
    "connection": {
      "name": "John Chen",
      "title": "VP Product at Stripe",
      "howYouKnow": "Met at Greylock partner event (Mar 2025)",
      "lastInteraction": "LinkedIn message (Feb 2026)"
    },
    "userBackground": {
      "bullets": ["Built anomaly detection system processing 10M+ events/day at AcmeCorp"],
      "stories": ["Caught $2M fraud annually with ML model..."],
      "relevantStory": "Anomaly detection system"
    },
    "enrichment": {
      "recipientLinkedInPost": "Stripe fraud detection roadmap, Feb 2026",
      "mutualConnection": null
    }
  }
}
```

### 4.2 Personalization Engine

The generator must ensure at least ONE of the following is present:

1. **Specific product/initiative/news** — Reference a concrete thing the company is doing or the recipient is working on. Not "I'm impressed by Stripe" but "I followed your fraud detection roadmap announcement."
2. **Recipient's specific role** — Reference their job, their level, their scope. "As VP Product, you're probably thinking about..."
3. **Concrete reason your background is relevant** — Not "I have 5 years in PM" but "I built the anomaly detection layer that caught $2M/year in fraud."
4. **Mutual connection/shared history** — "We met at Greylock's partner summit" or "We both worked at AcmeCorp" or "Sarah Chen suggested I reach out."

The generator should aim for 2-3 of these signals in every message.

### 4.3 Forbidden Patterns

The generator MUST NOT produce:

- "I came across your profile and was impressed by..."
- "I'd love to pick your brain..."
- "I'm very interested in your company because..."
- "I think I would be a great fit for this role..."
- "I'm reaching out because I'm looking for..."
- Any generic opening that could work for 100 different recipients

These patterns indicate the message is not personalized and will be rejected by the user (or worse, ignored by the recipient).

### 4.4 Tone & Voice

The message should sound like the user writing, not a chatbot. Guidance:

- **Professional but casual** — "Hi John" not "Dear Mr. Chen"
- **Specific not flowery** — "I shipped a model that..." not "I have deep expertise in..."
- **One idea, clearly stated** — Not 3 different asks or overexplained reasons
- **Short paragraphs** — Emails: 2-4 sentences per paragraph
- **Signature** — First name + link to LinkedIn (optional but recommended for cold outreach)

### 4.5 Citations

Every factual claim should be cited:

- Recipient's LinkedIn post → footnote linking to post + date
- Company news → footnote to source + date
- User's bullet/story → footnote: "From your bullet bank"
- Mutual connection → footnote: "Your connection history"
- Company info from company profile → footnote: "Company profile"

Citations are shown as `[^1]` in the message and resolved in a "Sources" section at the end. This lets the user verify the message is based on real research, not hallucinated facts.

---

## 5. Workflow Integration

### 5.1 Dashboard Nudge Entry Point

When the Dashboard nudge engine detects that an outreach step is due, it shows:

```
📧 Important

Send follow-up email to John Chen at Stripe
(Due today, 5 days after your initial message)

[View Outreach] [Dismiss for 24h]
```

Clicking "View Outreach" navigates to:
```
/modules/outreach/index.html?connectionId=conn_456&roleId=role_123
```

The module pre-loads the connection, role, and next step in the sequence.

### 5.2 Outreach Sequence Logic

Each connection + role combo has an outreach sequence. The sequence is defined by:

1. **Initial contact** — LinkedIn request OR cold email (user's choice)
2. **Follow-up 1** — 5 days later (if no response): follow-up email
3. **Follow-up 2** — 10 days later (if no response): second follow-up email
4. **Terminal** — Mark as "no response" or "responded" (user manually logs outcome)

**For connections that advance to interviews:**

5. **Thank you (call)** — After a networking call: thank-you note
6. **Thank you (interview round 1)** — After first round: personalized thank-you
7. **Thank you (interview round 2+)** — After each subsequent round: thank-you
8. **Recruiter response** — If recruiter reached out and user wants to reply: response message

### 5.3 Debrief Handoff

When the Post-Interview Debrief Agent captures notes from an interview (who was in the room, what was discussed, how it went), it stores:

```json
{
  "roleId": "role_123",
  "interviewRound": 1,
  "interviewers": [
    {
      "name": "John Chen",
      "title": "VP Product",
      "discussion": ["Fraud detection roadmap", "Team structure", "First 90 days"]
    }
  ],
  "keyMoments": ["Discussed your anomaly detection experience"],
  "timestamp": "2026-03-10T14:00:00Z"
}
```

When the Outreach module generates a "Thank You (Interview Round)" message, it reads this debrief and pulls specific discussion points to make the thank-you feel genuine:

```
Hi John,

Thank you for taking the time yesterday.
I really appreciated your perspective on
the fraud detection roadmap and how the
team is structured. [← pulled from debrief]
```

This ensures every thank-you references what was actually discussed, making it personal and valuable.

### 5.4 Send & Mark Complete

After the user sends a message (manually, outside the app):

```
┌──────────────────────────────────────┐
│  Message Sent?                       │
│                                      │
│  John Chen                           │
│  Cold Email Initial sent at 9:47 AM  │
│                                      │
│  [x] I've sent this message          │
│                                      │
│  Response?                           │
│  [ ] Not yet                         │
│  [ ] Yes, they responded             │
│  [ ] No response (mark ghosted)      │
│                                      │
│  [Mark Sent] [Cancel]                │
└──────────────────────────────────────┘
```

When user clicks "Mark Sent":

- `pf_connections[connectionId].outreachLog` is updated with a new entry:
  ```json
  {
    "step": "cold_email_initial",
    "sentDate": "2026-03-10T09:47:00Z",
    "messageType": "cold_email_initial",
    "messageSnapshot": "Hi John...",
    "dueDate": "2026-03-15T00:00:00Z"  // 5 days later
  }
  ```
- Next step (follow-up) is calculated and next due date is set
- Dashboard nudge updates to show next step or "awaiting response"

---

## 6. Data Model: Connection & Outreach Log

### 6.1 Connection Record

Each connection in `pf_connections` has:

```json
{
  "id": "conn_456",
  "name": "John Chen",
  "title": "VP Product",
  "company": "Stripe",
  "email": "john.chen@stripe.com",
  "linkedinUrl": "https://linkedin.com/in/johnchen",
  "howYouKnow": "Greylock partner event, Mar 2025",
  "status": "active",  // or "inactive", "no_response"
  "dateAdded": "2026-02-15T00:00:00Z",
  "lastInteraction": "2026-02-28T00:00:00Z",
  "outreachLog": [
    {
      "roleId": "role_123",
      "step": "cold_email_initial",
      "sentDate": "2026-03-10T09:47:00Z",
      "messageType": "cold_email_initial",
      "messageSnapshot": "Full message text saved here",
      "outcome": "awaiting_response",  // or "responded", "no_response"
      "nextStep": "cold_email_followup",
      "nextDueDate": "2026-03-15T00:00:00Z",
      "responseDate": null,
      "responseMessage": null
    }
  ]
}
```

### 6.2 Outreach Steps (Global State)

```json
[
  {
    "connectionId": "conn_456",
    "roleId": "role_123",
    "currentStep": "cold_email_initial",
    "completedSteps": [],
    "nextDueDate": "2026-03-15T00:00:00Z",
    "stepHistory": [
      {
        "step": "cold_email_initial",
        "sentDate": "2026-03-10T09:47:00Z",
        "messageType": "cold_email_initial"
      }
    ]
  }
]
```

---

## 7. Implementation Phases

### Phase 1: Core Generation (v1.0)

What will be implemented:

- [x] Message generation for all 8 message types
- [x] Personalization engine (ensure 1+ signals present)
- [x] Citation support (footnotes linking to sources)
- [x] Draft display & inline editing
- [x] Copy to clipboard / Open in email
- [x] Connection + role pre-loading from URL params
- [x] Message type selector and sequence logic
- [x] Send & mark complete workflow
- [x] Outreach log updates in pf_connections

### Phase 2: Debrief Integration & Refinement (v1.1)

> **Status: Implemented (v3.15.0)** — Debrief-aware drafting, quality scorer, edit sidebar.

- [x] Read debrief notes and pull specific discussion points for interview thank-yous
- [x] Message quality scorer (checks for personalization signals, flags generic patterns as 1-10 with breakdown)
- [x] Edit context sidebar (320px, tone/length selectors, regenerate button)
- [ ] Message templates as starting points (for power users)
- [ ] Save draft for later feature (store in localStorage)
- [ ] Bulk messaging (generate multiple messages in one session)

### Phase 3: Intelligence & Optimization (v1.2+)

> **Status: Planned** — Response rate analytics and smart timing suggestions not yet implemented.

- [ ] A/B insights after 10+ messages (response patterns by type/channel)
- [ ] Response rate analytics by message type / company tier / connection type
- [ ] Smart timing suggestions ("Send this message on Tuesday at 9am for higher response rates")
- [ ] Scheduled sends capability (send message at optimal time)
- [ ] Conversation threading (track entire email/LinkedIn thread in connection record)
- [ ] Suggested follow-up timing based on response patterns
- [ ] Integration with email/LinkedIn API for auto-logging sends (if user opts in)

### Phase 4: Voice & Personalization (v1.3+)

- [ ] Voice profile: let user upload writing samples so generator learns their style
- [ ] Tone selector: "Professional", "Casual", "Warm"
- [ ] Story bank integration: auto-suggest relevant stories for each message
- [ ] Company research mode: auto-find recent news/funding/key hires to reference
- [ ] Competitor intelligence: reference how target company competes vs. user's previous experience

---

## 8. UI Specification

### 8.1 Layout

**Overall structure:**

- **Header** — Module title, back link to Dashboard
- **Connection & Role Context** — Card showing who and what
- **Message Type Selector** — Radio buttons for 8 types
- **Action buttons** — Generate Draft, Edit Context
- **Draft Display** — Full message, editable, with citations
- **Send Confirmation** — After user manually sends, modal to mark complete

### 8.2 Color & Typography

- **Connection card** — Subtle gray background, name in lg semibold
- **Message type label** — sm text, muted
- **Draft message** — Monospace font, base size (16px), 1.6 line height for readability
- **Citation markers** — Blue text `[^1]`, clickable
- **Buttons** — Primary (blue), secondary (gray), cancel (light)

### 8.3 Responsiveness

- **Desktop (1024px+):** Two-column layout (context on left, draft on right)
- **Tablet (768px-1023px):** Single column, context above draft
- **Mobile (< 768px):** Full width, stacked sections

---

## 9. Module Navigation

### 9.1 Entry Points

| Source | URL Pattern | Pre-loaded State |
|--------|-------------|------------------|
| Dashboard nudge | `/modules/outreach/index.html?connectionId={id}&roleId={id}` | Connection, role, next step |
| Pipeline connection detail | `/modules/outreach/index.html?connectionId={id}` | Connection, no role pre-selected |
| Direct navigation | `/modules/outreach/` | Blank; user selects connection + role |

### 9.2 Exit Navigation

- **Back to Dashboard** — Button in header
- **Back to Pipeline** — Button in connection card
- **Back to Role Detail** — Button in role card
- **Open in Email** — Opens default email client (external)
- **Copy to Clipboard** — Stays in module, copies draft

---

## 10. Relationship to Other Modules

```
       ┌──────────────────────────┐
       │  Outreach Message Gen    │
       │  (modules/outreach/)     │
       └──────────────┬───────────┘
                      │ (reads from)
        ┌─────────────┼─────────────┬──────────────┬───────────┐
        ▼             ▼             ▼              ▼           ▼
    Pipeline       Resume       Debrief      Positioning    Company
    (roles,        Builder      Agent        (bullets,      Research
    companies,     (story bank)  (interview   story bank)    (context)
    connections)               notes)
```

**Data Dependencies:**

| Module | What It Provides | How Outreach Uses It |
|--------|-----------------|----------------------|
| **Pipeline Tracker** | pf_roles, pf_companies, pf_connections | Pre-loads connection, role, company context |
| **Resume Builder** | pf_bullet_bank, pf_story_bank | Pulls relevant bullets/stories for personalization |
| **Post-Interview Debrief** | pf_debrief (notes per interview) | Enriches interview thank-you messages with discussion points |
| **Research Brief** | Company enrichment data (news, mission, structure) | References recent news/initiatives for personalization |
| **Dashboard** | Nudge engine state | Receives outreach due notifications |

**Outbound Dependencies:**

- Outreach writes to `pf_connections[].outreachLog` (read by Pipeline, Dashboard)
- Outreach reads from all modules above but doesn't write to them

---

## 11. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Message generation time | < 3 seconds | Performance monitoring |
| User satisfaction with drafts | 80%+ "good" or "minimal edits needed" | User feedback rating |
| Personalization compliance | 100% messages have 1+ signals | Validation on generation |
| Forbidden pattern avoidance | 0% generic patterns | Automated content check |
| Citation accuracy | 100% factual sources verified | Spot checks of citations |
| Sequence adherence | 90%+ follow-ups due within 2 days of suggested date | Outreach log tracking |
| Response rate by message type | LinkedIn requests: 30%+, cold emails: 10%+, referrals: 50%+ | Connection outcome tracking |

---

## 12. Technical Notes

### 12.1 MCP Tool: pf_generate_outreach_message

**Input:**
```json
{
  "roleId": "string",
  "connectionId": "string",
  "messageType": "cold_email_initial" | "cold_email_followup" | "linkedin_request" | ... [8 types],
  "context": { ... }
}
```

**Output:**
```json
{
  "message": "string (full message with citations)",
  "subject": "string (if applicable)",
  "personalizationSignals": {
    "initiative": boolean,
    "recipientRole": boolean,
    "userBackground": boolean,
    "mutualConnection": boolean,
    "signalCount": number
  },
  "citations": [
    {
      "marker": "[^1]",
      "source": "LinkedIn post: Fraud detection roadmap",
      "date": "2026-02-15",
      "url": "https://..."
    }
  ]
}
```

**Validation:**

The tool must validate:
- At least 1 personalization signal present
- No forbidden patterns detected
- Message length within acceptable range for type
- All citations resolvable
- Tone appropriate for message type

If validation fails, tool returns error with suggestions for fixing context (e.g., "Add a specific company initiative the recipient is working on").

### 12.2 Browser-Side Editing

The draft is fully editable after generation. User can:
- Remove or modify sentences
- Add new sentences
- Change tone or word choice
- Delete citations (though shown as warning)

The module tracks that the message was edited before sending and does NOT require re-validation (user is responsible for quality after edits).

### 12.3 Message Snapshot Storage

Every time a message is sent, the full text is saved in `pf_connections[].outreachLog[].messageSnapshot`. This lets the user:
- Review what they actually sent (vs. what was drafted)
- Pull exact text for follow-ups ("As I mentioned in my last email...")
- Analyze their own patterns over time

### 12.4 No Auto-Send

Messages are NEVER auto-sent. The system generates a draft, displays it for review, and requires the user to manually send via email, LinkedIn, or their tool of choice. User then returns to the module to mark it sent.

This respects user agency and prevents accidental sends (especially important for cold emails that set the tone).

---

## 13. Design Philosophy

The Outreach Message Generator embodies four principles from the main Pathfinder spec:

1. **Personalization is non-negotiable.** Every message must be specific to the recipient and the moment. Generic patterns are forbidden. The system enforces this via the personalization engine.
2. **Context is everything.** The generator reads your background (bullets, stories), the company's context (news, mission, recent moves), and the recipient's profile to craft messages that feel informed, not automated.
3. **User control, not automation.** Messages are drafts. Users review, edit, and send them manually. This maintains voice and prevents accidents.
4. **Sequence + structure.** Not all messages are the same. A connection request is different from a cold email, which is different from a thank-you note. The generator knows the difference and adjusts accordingly.

---

## 14. Risk / Failure Modes / Guardrails

Outreach generates personalized messages sent under the user's real name. Failure modes are reputation-damaging.

**Risk 1: Hallucinated recipient facts** (High impact)
- Example: Message says "I know you led the Platform Rewrite at Stripe" when the recipient didn't.
- Mitigation: Generator output must cite every specific claim about the recipient. Unverified claims prefixed with hedging language ("I understand you may be involved in..."). User reviews and edits before sending.
- Guardrail: If context data is incomplete (no connection details, no company intel), show warning: "This draft has limited personalization. Review carefully before sending."
- Acceptance: ≥2 of 4 personalization pillars must be present: (1) specific initiative/product, (2) recipient's role/background, (3) user's relevant experience, (4) mutual connection or shared context.

**Risk 2: Generic template masquerading as personal** (Medium impact)
- Example: Message looks personalized but is actually a template with "[Company]" swapped in.
- Mitigation: All messages generated from specific context (JD, company intel, connection data). If generator returns placeholder text (e.g., "[Your background here]"), show error and ask user to add context.
- Guardrail: Scan output for bracket placeholders `[...]` before allowing send.

**Risk 3: Message sent to wrong recipient** (High impact)
- Mitigation: If recipient email is not in `pf_connections`, show confirmation: "This person isn't in your tracked connections. Email: {email}. Correct?"
- Guardrail: Draft Queue feature — messages saved as drafts with 24h window before user manually triggers send. No auto-send ever.

**Risk 4: Email bounces silently** (Medium impact)
- Mitigation: If using Gmail integration, check for bounce-back emails within 24h. If detected, surface in Dashboard: "Email to {name} bounced. Try LinkedIn instead?"
- Guardrail: Log all outreach send events with delivery status.

**Risk 5: Spam filter triggers** (Low impact)
- Mitigation: If user queues 5+ messages in one session, show warning: "Sending many emails at once may trigger spam filters. Consider spacing them 1-2 hours apart."
- Guardrail: Draft Queue supports scheduled sends with configurable delays.

**Risk 6: Tone mismatch** (Medium impact)
- Example: Casual tone for a formal C-suite outreach, or overly formal for a peer connection.
- Mitigation: Message type selector (cold email, warm intro, LinkedIn request, etc.) sets tone parameters in prompt. User selects recipient seniority/relationship before generation.

---

## Conclusion

The Outreach Message Generator is the voice of Pathfinder's networking engine. By combining real data (company profiles, your background, interview notes) with a personalization engine that forbids generic patterns, it produces messages that sound like you and land with recipients. Messages are never auto-sent — you review, edit, and send them manually, maintaining control and authenticity. Together with the Pipeline's connection tracking and the Dashboard's nudges, the Outreach module turns networking from a painful chore into a structured, trackable workflow.
