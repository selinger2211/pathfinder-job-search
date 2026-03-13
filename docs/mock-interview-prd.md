# Mock Interview Agent Module — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/mock-interview/`
**Version:** v1.0.0
**Last Updated:** 2026-03-10
**Status:** Draft — pending approval

---

## 1. Purpose

The Mock Interview Agent is the practice engine of Pathfinder. It runs calibrated mock interview sessions across seven distinct interview types, using full context from your job search (company profile, JD, fit assessment, positioning, previous debriefs) to generate realistic, company-specific questions. After each session, you receive scored evaluations, pattern analysis, and actionable recommendations.

**Why this matters:** Interview prep is not generic. A product strategy question for Stripe is fundamentally different from one for an early-stage fintech startup. This module knows your target company, your JD, what gaps exist in your fit, and what you've practiced before. It tailors every session.

### Design Principles

1. **Calibrated to your specific role.** Every question uses company profile, JD, fit assessment gaps, positioning statement, previous debriefs, and company-specific interview intelligence (from Glassdoor, Blind, Levels.fyi, Reddit, company blogs). Generic questions are only used as fallback.

2. **Full context awareness.** Mock sessions read from: `pf_roles` (the target role), `pf_companies` (company profile), `pf_positioning` (your positioning), `pf_story_bank` (STAR-format stories with theme tags), `pf_fit_assessment` (gaps you identified), `pf_research_brief_artifacts` (previous debriefs), and cached interview question databases.

3. **Story bank as a live practice tool.** Every practice session discovers new STAR stories (extracted from your answers), tags them by theme, and updates your story bank. You see which stories you're using, how often, mock ratings, and coach notes. The bank grows organically from practice.

4. **Session-level artifacts & continuity.** Each mock session (including TMAY practice) is saved to MCP as an artifact. You can review past sessions, see scoring trends, compare your approach across similar questions, and track improvement.

5. **Real interview questions.** The module scrapes real questions from Glassdoor, Blind, Levels.fyi, Reddit, company blogs. Mix mode combines 60% real questions with 40% Claude-generated (calibrated to the role). Questions older than 18 months are deprioritized.

6. **Evaluation with reason codes.** After each answer, you get a 1–5 score plus specific reason codes (e.g., "Unclear Problem Scope", "Weak Supporting Data", "Closed Loop", "Growth Mindset Shown"). Reasons roll up into session patterns.

---

## 2. Architecture

### Overall Session Flow

```
User clicks "Start Mock Interview" for a specific role
        │
        ▼
Frontend fetches role context from localStorage
  (pf_roles[roleId], pf_companies, pf_positioning, pf_fit_assessment)
        │
        ▼
MCP Tool: pf_generate_mock_session_setup
  ├── Reads interview type & depth (user selects)
  ├── Loads company-specific question database
  ├── Loads user's story bank (pf_story_bank)
  ├── Loads previous debriefs (pf_research_brief_artifacts)
  ├── Loads fit assessment gaps
  └── Returns session brief: company context, focus areas, question pool
        │
        ▼
Frontend displays session setup
  "You're interviewing for [Role] at [Company]"
  "Interview Type: [Type]"
  "Focus Areas: [Gaps from fit assessment]"
  "Ready?"
        │
        ▼
User clicks "Begin"
        │
        ▼
Question Loop: for each question in session
  │
  ├─ MCP Tool: pf_generate_interview_question
  │  ├── Picks from question pool (60% real, 40% generated)
  │  ├── Generates 2-3 follow-up probes (stored, not shown yet)
  │  └── Saves question + probes to session artifact
  │
  ├─ Frontend displays question
  │
  ├─ User speaks/types answer (audio or text)
  │
  ├─ MCP Tool: pf_evaluate_interview_answer
  │  ├── Claude scores answer: 1-5
  │  ├── Extracts STAR story (if present)
  │  ├── Tags story by theme (if new)
  │  ├── Updates pf_story_bank (mockRating, timesUsed, coachNotes)
  │  ├── Generates reason codes (Clarity, Structure, Evidence, etc.)
  │  ├── Checks fit assessment gaps (did answer address weakness?)
  │  ├── Offers follow-up probe or next question
  │  └── Saves evaluation to session artifact
  │
  ├─ Frontend shows score + feedback + probe offer
  │
  └─ User answers probe OR moves to next question
        │
        ▼
Session ends (user exits or completes)
        │
        ▼
MCP Tool: pf_generate_session_summary
  ├── Aggregates scores across all questions
  ├── Identifies strongest answers & weakest answers
  ├── Detects framework patterns (CUPS-PDM adherence, STAR structure, etc.)
  ├── Flags fit assessment gaps that still need work
  ├── Recommends follow-up practice (specific question types or stories)
  ├── Suggests updates to Research Brief (refined positioning, new risks)
  └── Saves summary to artifact
        │
        ▼
Frontend displays session summary
  ├── Overall score
  ├── Strongest / Weakest answers (with scores)
  ├── Framework compliance
  ├── Fit assessment gap progress
  ├── Story bank updates (new stories, themes discovered)
  └── Next-session recommendations
```

### Data Inputs & Dependencies

**From Pipeline (pf_roles):**
- Role ID, title, level, company ID
- JD text (if available)
- roleHints (function, scope, team size, etc.)
- knownContext (recruiter intel)

**From Companies (pf_companies):**
- Company name, domain, funding, headcount, mission
- Glassdoor URL & rating (for question sourcing)
- techStack, remotePolicy

**From Positioning (pf_positioning):**
- User's positioning statement for this company/role
- Key differentiators & themes
- Weaknesses to address

**From Fit Assessment (pf_fit_assessment):**
- Identified gaps (skills, experience, company fit)
- Priority areas (which gaps matter most)
- Risk factors (e.g., "No experience with company's stack")

**From Story Bank (pf_story_bank):**
- All STAR-format stories user has created
- Tags by theme (Leadership, Technical Depth, Cross-functional, Impact, Failure Recovery, etc.)
- mockRating, timesUsed, coachNotes for each story

**From Research Brief (pf_research_brief_artifacts):**
- Previous debrief summaries
- Patterns noted in past practice sessions
- Positioning refinements

**From Question Intelligence Cache:**
- `{company}_interview_questions.json` — scraped real questions
- Source tracking (Glassdoor, Blind, Levels.fyi, Reddit, company blogs)
- Question age & frequency (recently asked on Blind = higher priority)

### MCP Tools (Detail Below)

1. **pf_generate_mock_session_setup** — Initialize session with calibrated context
2. **pf_generate_interview_question** — Generate or select next question
3. **pf_evaluate_interview_answer** — Score, extract stories, generate feedback
4. **pf_generate_session_summary** — Aggregate results & recommendations
5. **pf_scrape_interview_questions** — Background job: refresh question cache weekly
6. **pf_update_story_bank_from_session** — Automatic story extraction & tagging

---

## 3. Data Model

### Mock Interview Session Object

Stored in MCP artifacts (type: `mock_interview_session`), keyed by `{roleId}_{sessionType}_{timestamp}`.

```typescript
interface MockInterviewSession {
  // Meta
  id: string;                          // Artifact key
  roleId: string;                      // Link to pf_roles
  companyId: string;                   // Link to pf_companies
  sessionType: InterviewType;          // See Section 4
  depth: 'Light' | 'Standard' | 'Deep'; // Number of questions & follow-ups
  createdAt: string;                   // ISO timestamp
  endedAt?: string;                    // ISO timestamp when session ended
  durationMinutes?: number;            // Actual duration

  // Setup Context (captured at session start)
  companyContext: {
    name: string;
    domain: string;
    fundingStage: string;
    techStack: string[];
    missionStatement: string;
    recentNews?: string;               // From research brief
    interviewReputation?: string;      // e.g., "Friendly but rigorous"
  };
  roleContext: {
    title: string;
    level: string;
    jdSummary: string;
    keyResponsibilities: string[];
    technicalRequirements?: string[];
  };
  positioningSnapshot: {
    positioning: string;               // User's positioning for this role
    keyThemes: string[];
    riskFactors: string[];
    strengthsToHighlight: string[];
  };
  fitAssessmentSnapshot: {
    gaps: string[];                    // Identified gaps
    priorities: string[];              // Which gaps matter most
    progressFromPreviousSessions?: {
      gapId: string;
      previousScore: number;
      trendDirection: 'improving' | 'stable' | 'declining';
    }[];
  };

  // Question Pool
  questionPool: {
    total: number;
    realQuestions: number;             // Count of scraped (60%)
    generatedQuestions: number;        // Count of Claude-generated (40%)
    sourceBreakdown: {
      glassdoor: number;
      blind: number;
      levelsChat: number;
      reddit: number;
      companyBlog: number;
      generated: number;
    };
  };

  // Question & Answer Loop
  questions: InterviewQuestion[];

  // Summary (populated after session ends)
  summary?: {
    totalScore: number;               // Average of all question scores
    scoreDistribution: {
      fiveCount: number;
      fourCount: number;
      threeCount: number;
      twoCount: number;
      oneCount: number;
    };
    strongestAnswers: {
      questionText: string;
      score: number;
      reason: string;
    }[];
    weakestAnswers: {
      questionText: string;
      score: number;
      reason: string;
    }[];
    frameworkCompliance: {
      frameworkUsed: string;           // e.g., "CUPS-PDM", "STAR", "CIRCLES"
      complianceScore: number;         // % of answers that followed framework
      gaps: string[];                  // Where framework broke down
    };
    fitAssessmentProgress: {
      gapId: string;
      previousScore?: number;
      currentScore: number;
      status: 'improved' | 'maintained' | 'regressed';
    }[];
    storiesExtracted: {
      storyId: string;                 // References pf_story_bank
      theme: string;
      mockRating: number;
      source: 'manual_addition' | 'mock_discovery' | 'debrief_extraction';
    }[];
    recommendations: {
      priority: 'high' | 'medium' | 'low';
      type: 'practice_question_type' | 'story_development' | 'framework_refinement' | 'positioning_tweak';
      description: string;
      actionItem: string;
    }[];
    researchBriefUpdates: {
      section: string;                 // e.g., "positioning", "risk_factors"
      suggestedChange: string;
      rationale: string;
    }[];
  };
}

interface InterviewQuestion {
  id: string;                          // Unique in session
  sequenceNum: number;                 // 1, 2, 3, ...
  questionText: string;
  framework?: string;                  // e.g., "CUPS-PDM", "CIRCLES", "STAR"
  source: 'real' | 'generated';        // Did this come from scrape or Claude?
  sourceDetails?: {
    platform: 'glassdoor' | 'blind' | 'levels' | 'reddit' | 'company_blog';
    url?: string;
    dateAsked?: string;
    frequency?: number;                // How many times has this appeared?
  };
  interviewType: InterviewType;        // 1 of 7 types
  subtype?: string;                    // e.g., "Goals/Metrics" under Product Execution
  followUpProbes: string[];            // 2-3 follow-ups (not shown to user until answered)
  answerFromUser?: {
    text?: string;                     // User typed answer
    transcription?: string;            // Audio transcription
    isAudio: boolean;
    durationSeconds: number;
  };
  evaluation?: InterviewQuestionEvaluation;
}

interface InterviewQuestionEvaluation {
  score: number;                       // 1-5
  scoreReasoning: string;              // Why this score?
  reasonCodes: ReasonCode[];           // Specific dimensions
  storyExtracted?: {
    storyId: string;                   // Reference to pf_story_bank (or new entry)
    theme: string;
    startIndex: number;                // Character position in answer
    endIndex: number;
    confidence: 'high' | 'medium' | 'low';
  };
  fitAssessmentAddressed?: {
    gapId: string;
    howItWasAddressed: string;
    effectivenessScore: number;        // 1-5
  };
  feedback: string;                    // Human-readable feedback (2-3 sentences)
  coachNotes: string;                  // Private notes to user about this answer
  followUpProbeUsed?: string;          // Which probe did we ask?
  probeScore?: number;                 // Score on follow-up (if user answered)
}

type InterviewType =
  | 'product_execution'
  | 'product_strategy'
  | 'product_design'
  | 'product_sense'
  | 'behavioral'
  | 'technical'
  | 'homework_case_study';

type ReasonCode =
  | 'Problem Clarity'              // Understood the problem correctly
  | 'Hypothesis Formation'          // Formed testable hypotheses
  | 'Data-Driven Approach'          // Used metrics, numbers, evidence
  | 'Framework Adherence'           // Followed proper framework
  | 'User Empathy'                  // Showed understanding of user needs
  | 'Trade-off Thinking'            // Acknowledged & articulated trade-offs
  | 'Business Acumen'               // Connected to company strategy
  | 'Technical Depth'               // Showed relevant technical knowledge
  | 'Communication Clarity'         // Explained reasoning clearly
  | 'Closed Loop'                   // Validated assumptions & summarized
  | 'Growth Mindset'                // Showed learning orientation
  | 'Leadership Signal'             // Showed cross-functional thinking
  | 'Risk Identification'           // Spotted potential problems
  | 'Pragmatism'                    // Balanced perfectionism with execution
  | 'Company Fit'                   // Understood company's specific context
  | 'Weak Supporting Data'          // Not enough evidence
  | 'Unclear Problem Scope'         // Didn't clarify enough
  | 'Missing Follow-through'        // Didn't validate conclusions
  | 'Generic Answer'                // Could apply to any company
  | 'No STAR Structure'             // (For behavioral) Story not properly framed
  | 'Missing Context'               // Didn't set up situation clearly
```

### Story Bank Integration

The **pf_story_bank** is the persistent store of all STAR-format stories you've created. Each story is tagged by theme and tracked for practice usage:

```typescript
interface STARStory {
  id: string;                          // Unique identifier
  title: string;                       // Short name (e.g., "Launched payment flow redesign")
  situation: string;                   // The context
  task: string;                        // What you were asked to do
  action: string;                      // What you actually did
  result: string;                      // Outcome & impact (with metrics)
  themes: string[];                    // Tags: Leadership, Technical, Impact, Failure Recovery, Cross-functional, etc.
  dateCreated: string;                 // ISO timestamp
  source: 'manual_addition' | 'mock_discovery' | 'debrief_extraction';

  // Practice tracking
  timesUsed: number;                   // How many mock sessions used this story?
  mockRatings: number[];               // Array of 1-5 scores from mock sessions
  mockRatingAverage?: number;          // Rolling average
  lastUsedInSession?: string;          // Session artifact ID
  coachNotes: string;                  // Accumulated feedback from sessions
  improvementAreas: string[];          // e.g., "Add more metrics", "Clarify your role"
}
```

The Mock Interview module:
1. **Discovers stories** — extracts STAR structure from user answers (during evaluation)
2. **Tags automatically** — uses NLP to infer themes (Leadership, Growth Mindset, Technical, etc.)
3. **Tracks usage** — increments `timesUsed`, appends score to `mockRatings`
4. **Accumulates feedback** — appends coach notes from evaluations
5. **Suggests refinement** — recommends which stories need development based on weak patterns

---

## 4. Interview Types & Frameworks

### 1. Product Execution (4 Subtypes)

Testing how you execute on product deliverables.

**Subtypes & Frameworks:**
- **Debugging:** "Your product feature has a 2% lower conversion rate than expected. What do you do?" → Systematic diagnosis framework (isolate variable → test hypothesis → measure)
- **Goals/Metrics:** "How would you define success for [Feature]?" → Goal-setting framework (ambition → measurability → achievability)
- **Root Cause Analysis:** "Why did [Launch/Feature] underperform?" → RCA framework (state the problem → gather data → identify root cause → propose fix)
- **Trade-offs:** "Should we optimize for speed or quality?" → Trade-off framework (identify stakeholders → weigh options → explain reasoning)

**Questions sourced from:** Real product execution questions from Blind, Levels.fyi, company blogs. Calibrated to company's product stage (early-stage startups ask more debugging; mature companies ask more metrics/strategy).

**Evaluation focus:** Structured thinking, use of data, hypothesis formation, decision-making logic.

---

### 2. Product Strategy (7 Categories)

Testing strategic thinking. Uses **CIRCLES, List, and Matrix frameworks** depending on the question.

**Categories:**
- Growth (How would you grow DAU by 50%?)
- Competitive (What would you do if competitor X launched?)
- New Market Entry (Should we enter X market?)
- Pricing (What should the price be for X feature?)
- Feature Prioritization (Rank these 5 features to ship next quarter)
- Pivot / Adjacency (Should we expand into X product area?)
- Company-Specific Strategic Challenge (pulled from research brief)

**Frameworks applied:**
- **CIRCLES** — Clarify, Identify, Research, Contextualize, List, Evaluate, Summarize (for open-ended strategy)
- **List** — Simple prioritization (best for feature ranking)
- **Matrix** — Cost/Impact quadrant analysis (best for decision-making)

**Questions sourced from:** Real strategy questions from Glassdoor, Reddit, company interview blogs, plus Claude-generated based on company's product direction (from research brief).

**Evaluation focus:** Framework adherence, creativity, business acumen, ability to explain trade-offs.

---

### 3. Product Design (CUPS-PDM Framework)

Testing design thinking. Uses **CUPS-PDM: Clarify → User → Problem → Solutions → Prioritize → Design → Measurement**.

**Example question types:**
- "Design a feature for [company's product] to address X problem"
- "How would you improve [competitor's feature] for our users?"
- "Design the checkout experience for [use case]"

**Framework breakdown:**
- **Clarify** — Define scope, ask disambiguating questions
- **User** — Define target user, empathize
- **Problem** — Articulate the problem they face
- **Solutions** — Brainstorm 3+ approaches
- **Prioritize** — Pick the best solution and justify
- **Design** — Sketch the flow, UX details
- **Measurement** — How would you measure success?

**Questions sourced from:** Real design questions from Levels.fyi, Glassdoor (product interview sections), company blogs (if company posts design interview questions), plus Claude-generated.

**Evaluation focus:** User empathy, problem clarity, solution breadth, design specificity, metric definition.

---

### 4. Product Sense (5 Subtypes)

Testing intuition about products, markets, and users. Less structured than other types; more about opinion & reasoning.

**Subtypes:**
- **Improvement** ("What's one thing you'd change about [Company's product]?")
- **Growth** ("How would you grow [Feature]?")
- **Launch** ("Should [Company] launch a new product in [market]?")
- **Design** ("Do you like [Company's product] design? Why?")
- **Pricing** ("What would you charge for [Product]?")

**Questions sourced from:** Glassdoor (often labeled "Product Sense"), Blind, Reddit threads (popular opinions), plus Claude-generated.

**Evaluation focus:** Opinion with reasoning, product intuition, knowledge of company's strategy.

---

### 5. Behavioral (Addressing Weaknesses Framework + 12 Common Questions)

Testing interpersonal skills, culture fit, and how you handle challenges.

**12 Common Questions:**
1. Tell me about a time you had a conflict with a teammate.
2. Tell me about a time you failed.
3. Tell me about a time you made a tough decision.
4. Tell me about a time you showed leadership.
5. Tell me about a time you disagreed with your manager.
6. Tell me about a time you learned something new quickly.
7. Tell me about a time you had to influence someone without direct authority.
8. Tell me about a time you received critical feedback.
9. Tell me about a time you worked cross-functionally.
10. Tell me about a time you had to push back on requirements.
11. Tell me about a time you prioritized quality over speed (or vice versa).
12. Tell me about your biggest accomplishment.

**Framework: STAR (Situation, Task, Action, Result)**
- Each answer should follow STAR format
- Fit assessment gaps are mapped to these questions (e.g., if you lack leadership experience, focus on Q4)

**Questions sourced from:** Real behavioral questions from Glassdoor, Blind, Levels.fyi, company career pages. Filtered by role level (Staff-level roles get different Qs than IC roles).

**Evaluation focus:** STAR structure, authenticity, growth mindset, relevant themes (leadership, learning, collaboration).

**"Addressing Weaknesses" framework:** If your fit assessment identified gaps (e.g., "No PM experience at fintech"), behavioral questions are calibrated to highlight strengths in adjacent areas. Coach notes point out which gaps you're addressing.

---

### 6. Technical (Engineering Collaboration, Technical Depth, Tech-User Bridge)

Testing technical knowledge relevant to the role. Varies by role level & company.

**Types:**
- **Engineering Collaboration** — "Walk me through the tech stack. What would you push back on? What would you prioritize?" (Tests understanding of technical trade-offs)
- **Technical Depth** — "Explain [Company's ML/Data/Architecture] to me." (Tests depth of technical knowledge)
- **Tech-User Bridge** — "How would you explain [Technical concept] to a non-technical user?" (Tests ability to translate)

**Questions sourced from:** Company engineering blogs, Stack Overflow discussions, GitHub issues (for companies with OSS), plus Claude-generated based on company's tech stack (from research brief & company profile).

**Evaluation focus:** Technical accuracy, ability to speak both languages (user & engineer), strategic thinking about technical trade-offs.

---

### 7. Homework / Case Study

Multi-part, take-home interview formats (PRD, Strategy Doc, Roadmap, Problem Prioritization).

**Types:**
- **PRD Writing** — "Write a PRD for [feature] given this context"
- **Strategy Document** — "Create a 1-year strategy for [business area]"
- **Roadmap Building** — "Build a quarterly roadmap for [team]"
- **Problem Prioritization** — "Rank these 10 problems by impact. Explain your framework."

**Session structure:** Questions are descriptive (e.g., "You have 48 hours to write a PRD for..."). User doesn't answer in real-time; instead, they upload a document (PDF, Google Doc link, text). The module evaluates the artifact.

**Evaluation focus:** Structure, use of data, clarity, company fit, strategic thinking.

---

## 5. Company-Calibrated Question Generation

### Question Pool Composition

For each session, the module creates a question pool (size based on depth: Light = 3–4 Qs, Standard = 5–7, Deep = 8–10):

1. **60% Real Questions** — sourced from `{company}_interview_questions.json` cache
   - Recently asked (last 6 months) — highest priority
   - Popular on Blind/Levels (multiple reports) — boosted priority
   - From company's career page — verified
   - 18+ months old — deprioritized unless gap

2. **40% Claude-Generated** — calibrated to:
   - Company's product area, stage, and strategy (from research brief)
   - Your fit assessment gaps (e.g., "No fintech experience" → ask fintech-specific questions)
   - Your positioning statement (e.g., if you emphasize "User-Centric Design", generate design-focused Qs)
   - Interview type & framework
   - Role level

### Question Sourcing & Caching

**Weekly background job: `pf_scrape_interview_questions`**

```
For each company in pf_companies with tier >= 'Active':
  ├─ Scrape Glassdoor interview section
  ├─ Search Blind.com for "[Company] interview" threads
  ├─ Check Levels.fyi for role-specific questions
  ├─ Search Reddit (r/ProductManagement, r/interviews, company subreddit)
  ├─ Fetch company's career page for interview guides
  └─ Save to {company}_interview_questions.json
       {
         company: string;
         lastUpdated: ISO timestamp;
         questions: [{
           text: string;
           type: InterviewType;
           platform: string;
           url: string;
           dateAsked: ISO timestamp;
           frequency: number;   // How many sources reported this?
           reportedBy: string[];
         }];
       }
```

**If no cache exists:** Claude generates from scratch using company profile + JD + research brief context.

**If cache is stale (>1 week old):** Use cache but flag as "may be outdated"; offer refresh on next session.

---

## 6. Session Structure Details

### Setup Phase (Before)

User selects:
- **Interview Type** — dropdown (7 types)
- **Depth** — Light / Standard / Deep (affects question count & follow-up probes)
- **Duration** — estimated (Light = 15 min, Standard = 30 min, Deep = 45 min)
- **Focus Area** (optional) — if you want to drill down on a specific skill or fit gap

MCP returns:
- Session brief (company context, role context, fit assessment snapshot)
- Question pool metadata (real vs. generated count, sources)
- Story bank highlights (stories related to interview type)
- Previous session scores (if any) for trend tracking

### Question Phase (During)

For each question:

1. **Display** — Question text, interview type, framework hint (if applicable)
2. **Capture Answer** — User types or speaks (audio transcription via browser)
3. **First Evaluation** — Score, reason codes, brief feedback
4. **Follow-Up Probe Offer** — "Want to go deeper? Here's a probe:" [Yes/Skip]
5. **Story Detection** — If a STAR story is detected, flag it: "Great story here. Save to story bank?" [Yes/Skip/Edit]

### Evaluation Phase (After Each Answer)

Claude scores on:

1. **Structure** — Did it follow the framework? (1-5)
2. **Clarity** — Would an interviewer understand your reasoning? (1-5)
3. **Evidence** — Did you back up claims with data/examples? (1-5)
4. **Fit** — Did this address any of your positioning or fit assessment gaps? (1-5 or N/A)
5. **Overall** — Aggregate (1-5)

Output:
- Overall score (1-5)
- Reason codes (e.g., "Strong Data-Driven Approach", "Generic Answer", "Unclear Problem Scope")
- Extracted story (if present) with theme suggestion
- Feedback (2-3 sentences; what went well, what to improve)
- Coach notes (private, actionable tips)

### Session Summary (After Session Ends)

Aggregated output:
- **Overall Score** — Average across all questions
- **Score Distribution** — % of 5s, 4s, 3s, 2s, 1s
- **Strongest Answers** — Top 2-3 with scores & why (which reason codes dominated?)
- **Weakest Answers** — Bottom 2-3 with scores & why (which gaps are evident?)
- **Framework Compliance** — Which framework? What % of answers adhered? Where did it break?
- **Fit Assessment Progress** — For each gap you identified, did this session help? Score change vs. last session.
- **Stories Extracted** — Which stories surfaced? Themes? Ratings? Any new stories to add?
- **Recommendations** — Prioritized list (high/medium/low):
  - Practice question type (e.g., "Product Strategy on competitive scenarios")
  - Story development (e.g., "Your Leadership story could use more metrics")
  - Framework refinement (e.g., "STAR structure: focus on Action detail")
  - Positioning tweak (e.g., "Consider emphasizing user research experience")
- **Research Brief Updates** — Did this session reveal positioning weaknesses or risk factors worth updating?

---

## 7. Tell Me About Yourself (TMAY) Practice Mode

A dedicated, focused practice mode for the most-asked interview question.

### Setup

- Duration: 90–120 seconds (user-configurable)
- Framework: Hook → Arc → Relevance → Closing
- Calibration: Uses positioning statement, fit assessment gaps, and role details

### Evaluation Dimensions

1. **Hook** (0-20 pts) — Does it grab attention? Is it relevant to the role?
2. **Arc** (0-30 pts) — Is there a logical flow? Story or description?
3. **Relevance** (0-30 pts) — How well does it map to the role & company?
4. **Closing** (0-20 pts) — Strong finish? Clear call to action ("I'm excited to...")?

### Artifacts

- Saved as a special session type (`mock_interview_session` with `sessionType: 'tmay_practice'`)
- Tracks practice history (past TMAY recordings & scores)
- Offers comparison ("This time: 78/100. Last time: 72/100. Growth: +6%")

---

## 8. Data Model: Interview Question Cache

Cached separately from session artifacts for reuse across sessions.

```typescript
interface CompanyInterviewQuestionCache {
  company: string;                    // Link to pf_companies
  lastUpdated: string;                // ISO timestamp
  expiresAt: string;                  // Cache TTL (typically 1 week)
  questions: {
    text: string;
    interviewType: InterviewType;
    subtype?: string;
    source: {
      platform: 'glassdoor' | 'blind' | 'levels' | 'reddit' | 'company_blog' | 'other';
      url?: string;
      dateAsked?: string;             // When this Q was reported asked
      frequency: number;              // 1 = once, 5 = very popular
      reportedBy: string[];           // Which sources mentioned it?
    };
    ageInDays: number;                // How old is this question?
    priority: number;                 // 1-10; higher = more likely to use
  }[];
}
```

**Priority Calculation:**
- Recent (< 3 months): +3
- Frequency >= 3: +2
- From company blog (verified): +1
- Age 18+ months: -5

---

## 9. UI Spec

### Main Screen: Mock Interview Dashboard

```
┌─────────────────────────────────────────────────────┐
│ Mock Interview for [Role] at [Company]              │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Quick Links:                                        │
│  [▶ Start New Session]  [📋 Past Sessions]          │
│  [🎤 TMAY Practice]     [📖 Story Bank]             │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Session Setup Panel:                                │
│  Interview Type: [Dropdown: Product Execution...]   │
│  Depth: ⭕ Light  ◯ Standard  ◯ Deep                │
│  Focus Area: [Optional dropdown]                    │
│  [Start Session]                                    │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Recent Sessions Summary:                            │
│  ┌────────────────────┐                             │
│  │ Behavioral (3 Qs)  │ Avg: 3.7/5                  │
│  │ Today, 2 pm        │ 🔗 View Session             │
│  └────────────────────┘                             │
│  ┌────────────────────┐                             │
│  │ Product Strategy   │ Avg: 4.1/5                  │
│  │ Yesterday, 6 pm    │ 🔗 View Session             │
│  └────────────────────┘                             │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### During Session: Question Display

```
┌─────────────────────────────────────────────────────┐
│ Question 2 of 5 — Product Strategy                  │
├─────────────────────────────────────────────────────┤
│                                                       │
│ "How would you grow [Company's feature] in [market]?"│
│                                                       │
│ Framework: CIRCLES                                  │
│ 💡 Hint: Clarify your assumptions first             │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Your Answer:                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │[Textarea] Start typing or [🎤 Record Audio]    │ │
│ │                                                 │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│ [Submit Answer]  [Skip Question]                    │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### After Answer: Evaluation & Feedback

```
┌─────────────────────────────────────────────────────┐
│ Your Answer Evaluated                               │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Score: 4/5 ⭐⭐⭐⭐                                  │
│                                                       │
│ Reason Codes:                                       │
│  ✓ Framework Adherence (CIRCLES)                    │
│  ✓ Data-Driven Approach                             │
│  ⚠ Missing Competitive Analysis                     │
│                                                       │
│ Feedback:                                           │
│ "Strong opening. You clarified assumptions and     │
│  identified metrics. Next time, consider how       │
│  [Competitor] might respond to this move."         │
│                                                       │
│ Coach Notes:                                        │
│ "Your research on [Company's] market is evident.   │
│  This shows company knowledge. Keep it up!"        │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Follow-Up Probe:                                    │
│ "What if a competitor launched first?"             │
│ [Answer Probe]  [Skip Probe] → [Next Question]    │
│                                                       │
├─────────────────────────────────────────────────────┤
│ Story Detected:                                     │
│ "When I was at [Company], I led..."                │
│ Theme: Growth / Impact                              │
│ [Save to Story Bank]  [Skip]  [Edit & Save]       │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Session Summary View

```
┌─────────────────────────────────────────────────────┐
│ Session Summary — Behavioral Interview              │
│ March 10, 2026, 2:15–2:45 pm (30 min)              │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Overall Score: 3.8/5 ⭐⭐⭐🌟                       │
│ Questions Answered: 5 of 5                          │
│                                                       │
│ Score Breakdown:                                    │
│  ⭐⭐⭐⭐⭐ (5/5): 1 answer   20%                    │
│  ⭐⭐⭐⭐ (4/5):  3 answers  60%                    │
│  ⭐⭐⭐ (3/5):   1 answer   20%                    │
│  ⭐⭐ (2/5):     0 answers                         │
│  ⭐ (1/5):      0 answers                         │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Strongest Answers:                                  │
│ 1. "Tell me about your biggest failure"            │
│    Score: 5/5                                       │
│    Reason: Excellent STAR structure, growth mindset│
│                                                       │
│ 2. "Tell me about a time you showed leadership"    │
│    Score: 4/5                                       │
│    Reason: Clear impact, could use more metrics    │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Weakest Answers:                                    │
│ 1. "Tell me about a conflict with a teammate"      │
│    Score: 3/5                                       │
│    Reason: Missing Action detail, unclear resolution│
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Framework Compliance: STAR Format                   │
│  ✓ 4 out of 5 answers followed STAR structure      │
│  ⚠ Weakness: Your "Action" sections were brief     │
│    (How did you actually do the thing?)            │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Fit Assessment Progress:                            │
│ Gap: "Limited leadership experience"                │
│  Session 1 (Feb 28): 2.5/5   └─ Weak              │
│  Session 2 (Mar 10): 3.8/5   └─ Improved! ↗       │
│  Status: Making progress. Continue storytelling.   │
│                                                       │
│ Gap: "No fintech domain knowledge"                  │
│  Not addressed in this session                      │
│  Recommendation: Practice technical domain Qs      │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Stories Extracted:                                  │
│ ✓ New: "Launched redesign with cross-functional   │
│   team" (Theme: Leadership + Impact)               │
│   Added to Story Bank                              │
│                                                       │
│ ✓ Used: "Recovered from failed launch"             │
│   (Theme: Failure Recovery)                        │
│   Reused from Story Bank (3rd time)                │
│   Mock Rating This Session: 4/5 (Avg: 4.2/5)      │
│                                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Recommendations for Next Session:                   │
│                                                       │
│ 🔴 HIGH: Practice conflict resolution (Q1 was weak)│
│  "Conflict with a Teammate" — script Action detail │
│                                                       │
│ 🟡 MEDIUM: Develop technical domain knowledge      │
│  "Product Strategy" session on fintech scenarios   │
│                                                       │
│ 🟢 LOW: STAR structure is strong; focus on metrics │
│  Action detail. Coach Notes from evaluations ↑    │
│                                                       │
│ Research Brief Updates Suggested:                   │
│ • Positioning: "Your leadership growth is evident" │
│   → Consider emphasizing in positioning statement  │
│ • Risk Factors: "Fintech knowledge gap still       │
│   significant" → Priority learning before next     │
│                                                       │
├─────────────────────────────────────────────────────┤
│ [Save to Archive]  [Review Questions Again]        │
│ [Export Summary as PDF]  [← Back to Dashboard]    │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## 10. Implementation Phases

### Phase 1: Foundations (Week 1–2)

**MCP Tools:**
- `pf_generate_mock_session_setup` — Initialize session context
- `pf_generate_interview_question` — Basic question generation (no caching yet; real questions from API if available)
- `pf_evaluate_interview_answer` — Score and extract stories (basic STAR detection)

**UI:**
- Session setup screen (type, depth)
- Question display + answer capture (text only, no audio yet)
- Basic evaluation display (score + feedback)
- Session summary view (aggregated scores, strongest/weakest)

**Data:**
- Mock session artifact schema
- Story bank integration (basic save/load)

**Stories:** STAR extraction is basic (regex-based or simple NLP)

---

### Phase 2: Intelligence & Calibration (Week 3–4)

> **Status: Planned** — Not yet implemented. Spec retained for future development.

**MCP Tools:**
- `pf_scrape_interview_questions` — Weekly background job to cache company questions
- Enhanced `pf_generate_interview_question` — Use cached questions (60/40 split)
- Enhanced `pf_evaluate_interview_answer` — Reason codes, fit assessment mapping

**UI:**
- Show question source (real vs. generated)
- Follow-up probe offer
- Story detection & save workflow

**Data:**
- Interview question cache schema
- Story bank tracking (mockRating, timesUsed, coachNotes)

**Stories:** Story detection improved; theme tagging automated

---

### Phase 3: Audio & TMAY (Week 5–6)

**UI:**
- Audio recording (browser Web Audio API)
- Audio transcription (via MCP or third-party)
- TMAY practice mode (dedicated UI, timer, arc/hook/relevance/closing evaluation)

**Data:**
- Audio transcription stored in answer object
- TMAY session type variant

---

### Phase 4: Polish & Analytics (Week 7–8)

> **Status: Planned** — Not yet implemented. Spec retained for future development.

**MCP Tools:**
- `pf_generate_session_summary` — Full summary with trend analysis

**UI:**
- Session archive & trend view (score history, pattern analysis)
- Story bank UI (browse, edit, reuse in future sessions)
- Recommendations dashboard

**Data:**
- Artifact linking (session → story bank → fit assessment)
- Trend tracking (score history, gap progress)

**Quality:**
- User feedback loop (thumbs up/down on evaluations)
- A/B testing on question phrasing

---

## 11. Relationship to Other Modules

### Pipeline Tracker (modules/pipeline/)

**Dependency:** Reads `pf_roles`, `pf_companies` to know what to interview for.

**Data flow:**
```
Pipeline:
  [Role A] → Mock Interview sesssion starts
    ├─ Reads role details (title, level, JD, company)
    ├─ Reads company profile
    └─ Stores session result as artifact

  [Role A] → Interview note logged
    ├─ Mock Interview updates pf_roles[roleId].interviewHistory
    └─ Session scores feed into role's "Readiness" score
```

**Integration point:** Role detail page has "Start Mock Interview" button.

---

### Research Brief (modules/research-brief/)

**Dependency:** Reads previous debriefs to inform question calibration and provide session recommendations.

**Data flow:**
```
Research Brief:
  [Brief generated] → Sections include interview prep tips

Mock Interview:
  [Session completes] → Research Brief section updates suggested
    ├─ Positioning refinements (did this session reveal gaps?)
    ├─ Risk factors identified (e.g., "Fintech knowledge weak")
    └─ Recommendations for next prep (e.g., "Practice 3 more strategy Qs")
```

**Integration point:** Session summary has "Update Research Brief" link.

---

### Story Bank (implicit; part of Mock Interview)

**Owned by:** Mock Interview module (but could be browsable from other places).

**Data flow:**
```
Mock Interview:
  [Session runs] → Stories extracted & tagged
    ├─ New stories created in pf_story_bank
    ├─ Existing stories updated (timesUsed++, mockRatings.push())
    └─ Coach notes accumulated

Resume Builder (future):
  [Building resume] → Could suggest stories from story bank
    └─ "You used this story well in mocks. Consider highlighting it?"

Outreach (future):
  [Writing recruiting email] → Could reference stories
    └─ "Your impact on [project] matches their needs..."
```

---

### Positioning (modules/positioning/, if separate)

**Dependency:** Reads user's positioning statement to calibrate questions.

**Data flow:**
```
Positioning:
  [Statement created] → Mock Interview uses it as context
    └─ Question generation considers positioning themes

Mock Interview:
  [Session runs] → Feedback may suggest positioning tweaks
    └─ "Your data storytelling is strong. Emphasize this?"
```

---

### Dashboard (modules/dashboard/)

**Dependency:** Reads session summaries for high-level insights.

**Data flow:**
```
Mock Interview:
  [Sessions accumulate] → Dashboard queries for:
    ├─ Average score across all sessions
    ├─ Strongest interview type (where you score highest)
    ├─ Weakest area (where you need practice)
    └─ Stories in story bank (count, themes)

Dashboard widget:
  "Interview Readiness: 3.8/5 | 12 sessions | 8 stories"
  [Open Mock Interview →]
```

---

## 12. Success Metrics

### User-Facing Metrics

1. **Session Completion Rate** — % of started sessions that are completed (target: >80%)
2. **Score Improvement Trend** — Average session score change over time (target: +0.3 points per week)
3. **Story Bank Growth** — New stories discovered per session (target: 0.5–1 new story per session)
4. **Fit Gap Progress** — How many identified fit assessment gaps improve after sessions? (target: 40% of gaps show improvement within 2 weeks)
5. **Time to Next Session** — How long until user runs another mock? (target: re-engagement within 3 days)
6. **Real Interview Correlation** — Post-hire feedback: Do mock scores correlate with real interview performance? (target: >0.7 correlation)

### System Metrics

1. **Question Cache Freshness** — % of questions < 2 weeks old (target: >90%)
2. **Story Extraction Accuracy** — % of STAR stories extracted correctly (target: >85% by Phase 4)
3. **Evaluation Speed** — Time from answer submission to evaluation display (target: <5 sec)
4. **Audio Transcription Accuracy** — Word error rate on transcriptions (target: <10% WER by Phase 3)

---

## 13. Open Questions & Future Enhancements

1. **Live Interview Simulation** — Could a future version use a voice model to conduct two-way dialog (user asks clarifying Qs, model responds realistically)?

2. **Peer Comparison (Anonymized)** — Show how your scores on strategy Qs compare to other users at your level interviewing for similar roles (with privacy controls).

3. **Interview Coach Integration** — Could user upload a real interview recording for blind evaluation, then compare to mock scores?

4. **Blind Prep Sync** — Sync questions & strategies with Blind.com for crowd-sourced insights.

5. **Company Interview Process Guide** — Generate a guide based on scraped interview questions that shows "typical order of interview types at [Company]" (e.g., "Phone screen is usually behavioral; on-site is 3 strategy + 1 technical").

---

## 14. Artifacts & Outputs

### MCP Artifacts

- **Type: `mock_interview_session`** — One artifact per session, keyed by `{roleId}_{sessionType}_{timestamp}`
  - Contains: full question/answer/evaluation loop, session summary

- **Type: `interview_question_cache`** — One per company, keyed by `{companyId}_interview_questions`
  - Contains: scraped questions, metadata, priority scores
  - TTL: 7 days

- **Type: `story_bank`** — Implicit (stored in localStorage as `pf_story_bank`)
  - Contains: STAR stories with theme tags, usage tracking, mock ratings

### Browser Artifacts

- **localStorage keys:**
  - `pf_story_bank` — Story Bank (R/W by Mock Interview)
  - `pf_positioning` — User's positioning statement (R by Mock Interview)
  - `pf_fit_assessment` — Fit gaps (R by Mock Interview)

- **MCP reads/writes:**
  - `pf_roles`, `pf_companies` — Read only
  - `mock_interview_session` artifacts — Write new sessions & summaries
  - `interview_question_cache` artifacts — Write cached questions (background job)
  - `pf_story_bank` — R/W story updates

---

## 15. Error Handling & Edge Cases

### What if there's no JD?

Use `role.roleHints` + `role.knownContext` as proxy. Questions marked "Based on recruiter intel, not confirmed JD."

### What if there's no question cache?

Generate from scratch using company profile + JD + research brief. Mark as "No real questions available; using generated questions."

### What if user quits mid-session?

Session is auto-saved (questions answered so far). User can resume next time. In summary: "2 of 5 questions completed."

### What if story extraction fails?

Offer manual story save workflow: "Did you share a story? [Yes] → Manual STAR form."

### What if user disagrees with score?

"Give us feedback" button saves user's disagreement + their reasoning to artifact. Used to tune evaluation over time.

---

## 16. Technical Considerations

### Performance

- **Question generation:** Pre-generate next 2 questions while user answers current (optimistic loading)
- **Story extraction:** Run async, show progress spinner
- **Session summary:** Can be generated async; show partial results as they complete

### Privacy

- Mock sessions stored in user's MCP space (encrypted at rest)
- Story bank is personal; never shared anonymously
- Audio transcriptions deleted after evaluation (configurable retention)

### Accessibility

- Audio playback available for all text (for TMAY playback)
- Keyboard navigation throughout
- High contrast mode for evaluation scores

---

## Appendix: Interview Type Decision Tree

```
User starts Mock Interview
  │
  ├─ Select Interview Type
  │   │
  │   ├─ Product Execution?
  │   │   └─ Subtype: Debugging / Goals-Metrics / RCA / Trade-offs
  │   │
  │   ├─ Product Strategy?
  │   │   └─ Category: Growth / Competitive / New Market / etc.
  │   │
  │   ├─ Product Design?
  │   │   └─ Framework: CUPS-PDM
  │   │
  │   ├─ Product Sense?
  │   │   └─ Subtype: Improvement / Growth / Launch / Design / Pricing
  │   │
  │   ├─ Behavioral?
  │   │   └─ Framework: STAR (12 common Qs or custom)
  │   │
  │   ├─ Technical?
  │   │   └─ Type: Eng Collab / Tech Depth / Tech-User Bridge
  │   │
  │   └─ Homework / Case Study?
  │       └─ Type: PRD / Strategy / Roadmap / Prioritization
  │
  └─ [Start Session]
```

---

**Document End**

---

### Change Log

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2026-03-10 | Initial standalone PRD for Mock Interview Agent module |

