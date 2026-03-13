# Post-Interview Debrief Agent Module — Standalone PRD

**Parent:** Pathfinder Job Search System
**Module:** `modules/debrief/`
**Version:** v1.0.0
**Last Updated:** 2026-03-10
**Status:** Draft — pending approval

---

## 1. Purpose

The Post-Interview Debrief Agent is the capture and synthesis engine of Pathfinder. It activates immediately after you complete an interview, engages you in a conversational debrief to capture structured feedback while memory is fresh, and produces debrief records that feed back into Research Brief refinement, inform prep for subsequent rounds, and build a longitudinal dataset for pattern analysis. After 10+ debriefs, the system surfaces Interview Intelligence on your Dashboard—which story types land, which interview types you struggle with, which question categories need prep, and stage-specific conversion patterns.

**Why this matters:** Memory fades fast after an interview. Within 2 hours, you forget what you said, what they asked, and how they reacted. This module turns that golden window into structured feedback—not just for you to reflect on, but as a signal to improve every subsequent preparation activity in Pathfinder.

### Design Principles

1. **Conversational, not form-filling.** The debrief happens as a natural conversation with Claude, who knows the role, company, interviewer names (from calendar), and interview type. It asks targeted follow-up questions, not a rigid template.

2. **Immediate activation.** The debrief agent activates in the background within 5 minutes of an interview ending (detected via Calendar sync). A notification appears: "How was the interview?" User clicks and debriefs are captured in real time.

3. **Full context awareness.** The agent reads: `pf_roles` (the role you interviewed for), `pf_companies` (company profile), calendar event details (interview type, interviewer names, duration), `pf_positioning` (your positioning), `pf_research_brief_artifacts` (prior research), and any previous debriefs for the same role to compare patterns.

4. **8 Standard sections.** Every debrief captures: Overall Impression, What Landed, What Didn't Land, Questions They Asked, Their Priorities, Red Flags, Follow-up Items, Interviewer Notes. Structured yet conversational.

5. **Artifacts & feedback loops.** Each debrief is saved as an MCP artifact. Role record is updated with debrief notes and interview state. Research Brief sections 6 (Gaps & Risks) and 8 (Positioning Refinement) are refreshed. Thank-you note generation is handed off to Outreach Generator with debrief context. New questions are tagged and added to your question bank.

6. **Pattern analysis at scale.** After 10+ debriefs, the system detects patterns: which STAR stories resonate most, which interview types you excel or struggle with, which question categories trip you up, stage-specific conversion patterns. These surface on the Dashboard as "Interview Intelligence."

---

## 2. Architecture

### Overall Debrief Flow

```
Interview ends (detected via Calendar)
        │
        ▼
Backend detects end + notifications sent to user
        │
        ▼
User clicks "Start Debrief" OR scheduled auto-prompt (2 hrs after event)
        │
        ▼
Frontend loads debrief context from localStorage
  (pf_roles[roleId], pf_companies, calendar event, positioning, prior debriefs)
        │
        ▼
MCP Tool: pf_initialize_debrief_session
  ├── Loads interview metadata (type, date, duration, interviewer names)
  ├── Loads role & company context
  ├── Loads positioning & research brief
  ├── Detects interview round (phone, first round, final round, etc.)
  └── Returns debrief prompt + initial question to start conversation
        │
        ▼
Frontend displays debrief interface (chat-like)
  "Great! Let's capture your interview feedback."
  [First question from agent]
        │
        ▼
Debrief Loop: for each of 8 sections
  │
  ├─ User types answer (natural language)
  │
  ├─ MCP Tool: pf_process_debrief_response
  │  ├── Extracts key facts from answer
  │  ├── Classifies answer to section category
  │  ├── Generates follow-up question (if needed)
  │  ├── Detects red flags or positive signals
  │  ├── Tags any questions for question bank
  │  └── Returns feedback + next question
  │
  ├─ Frontend displays follow-up or next section prompt
  │
  └─ Repeat until all 8 sections captured
        │
        ▼
Debrief completes (user clicks "Done" or skips remaining sections)
        │
        ▼
MCP Tool: pf_finalize_debrief
  ├── Assembles 8-section debrief artifact
  ├── Updates pf_roles[roleId].interviewRounds[n] with notes & state
  ├── Updates interviewSubState (e.g., "post_round_1_debrief_complete")
  ├── Tags new questions for pf_question_bank
  ├── Triggers pf_refresh_research_brief (sections 6 & 8)
  ├── Hands off context to pf_generate_thank_you_note (Outreach module)
  ├── Analyzes for patterns (if 10+ debriefs exist)
  └── Returns debrief summary + next action recommendations
        │
        ▼
Frontend displays debrief summary
  ├── What went well
  ├── What to work on before next round
  ├── Next-step recommendations
  └── [Proceed to Thank-You Note]  [Return to Pipeline]
```

### Data Inputs & Dependencies

**From Pipeline (pf_roles):**
- Role ID, title, level, company ID
- JD text (if available)
- interviewRounds[n] — which round is this? (phone screen, 1st round, final, etc.)
- interviewHistory — previous debriefs for pattern analysis

**From Companies (pf_companies):**
- Company name, domain, funding stage, team size, mission
- Company culture signals (from research brief or Glassdoor)

**From Calendar (via sync):**
- Interview event metadata (date, time, duration, attendees)
- Interviewer names & titles (extracted from event details)
- Interview type hint (if labeled in event, e.g., "Product Execution Round")

**From Positioning (pf_positioning):**
- User's positioning statement for this company/role
- Key differentiators & themes
- Known weaknesses to address

**From Research Brief (pf_research_brief_artifacts):**
- Company strategy, culture, product roadmap
- Known gaps & risks (to validate or update)
- Positioning statement (to see if debrief confirms fit or surfaces misalignment)

**From Question Bank (pf_question_bank):**
- Existing questions (to classify new questions encountered)
- Company-specific question history (to surface patterns: "You've seen this type 3 times")

**From Story Bank (pf_story_bank, implicit):**
- User's STAR stories (debrief may reference which stories were used or how they landed)

### MCP Tools (Detail Below)

1. **pf_initialize_debrief_session** — Set up debrief context & initial prompt
2. **pf_process_debrief_response** — Process user answer, extract facts, generate follow-up
3. **pf_finalize_debrief** — Assemble artifact, update role state, trigger downstream workflows
4. **pf_refresh_research_brief** — Update research brief sections 6 & 8 based on debrief insights
5. **pf_generate_thank_you_note** — Handoff to Outreach module with debrief context
6. **pf_analyze_debrief_patterns** — Background job: after 10+ debriefs, surface Interview Intelligence

---

## 3. Data Model

### Debrief Session Object

Stored in MCP artifacts (type: `debrief_session`), keyed by `{roleId}_{round}_{date}_{timestamp}`.

```typescript
interface DebrriefSession {
  // Meta
  id: string;                          // Artifact key
  roleId: string;                      // Link to pf_roles
  companyId: string;                   // Link to pf_companies
  interviewRound: string;              // e.g., "phone_screen", "round_1", "final_round"
  interviewType?: string;              // e.g., "product_strategy", "behavioral", "technical"
  createdAt: string;                   // ISO timestamp (interview end time)
  completedAt?: string;                // ISO timestamp when debrief finished
  durationMinutes?: number;            // Time spent in debrief conversation

  // Interview Context (captured at debrief start)
  interviewMetadata: {
    date: string;                      // ISO date of interview
    duration: number;                  // Minutes (from calendar)
    interviewerNames: string[];        // Names extracted from calendar
    interviewerTitles?: string[];      // Titles if available
    interviewType: string;             // e.g., "product_execution", "behavioral"
  };

  companyContext: {
    name: string;
    domain: string;
    fundingStage: string;
    missionStatement?: string;
    recentNews?: string;               // From research brief
  };

  roleContext: {
    title: string;
    level: string;
    jdSummary?: string;
  };

  // The 8 Standard Debrief Sections
  sections: {
    // 1. Overall Impression (1-5 gut check)
    overallImpression: {
      score: number;                   // 1-5: "How do you feel about this interview?"
      reasoning: string;               // User's explanation
      confidence: 'high' | 'medium' | 'low';  // How confident in this feeling?
    };

    // 2. What Landed (stories that resonated)
    whatLanded: {
      stories: {
        title?: string;                // User's title for the story/example
        description: string;           // What you said that landed well
        themeTag?: string;             // e.g., "Leadership", "Impact", "Technical"
        interviewer_reaction?: string; // How they reacted ("nodded", "asked follow-up", "looked surprised")
        estimated_impact: 'high' | 'medium' | 'low';
      }[];
      keyThemes: string[];             // Top themes that resonated
      overall_summary: string;         // User's take on what worked
    };

    // 3. What Didn't Land (weak moments)
    whatDidntLand: {
      moments: {
        description: string;           // What you said that didn't land
        themeTag?: string;             // What area (Technical, Behavioral, etc.)
        reason?: string;               // Why it didn't land (nervous, weak knowledge, bad structure)
        interviewer_reaction?: string; // "Silence", "skeptical", "moved on quickly"
        severity: 'high' | 'medium' | 'low';
      }[];
      keyWeaknesses: string[];         // Patterns: knowledge gap, communication, preparation
      overall_summary: string;         // User's take on what didn't work
    };

    // 4. Questions They Asked (list with type classification)
    questionsAsked: {
      questions: {
        text: string;                  // The exact question (as best you remember)
        type: InterviewType;           // Classified: product_strategy, behavioral, technical, etc.
        category?: string;             // Subcategory: e.g., "Growth", "Conflict Resolution"
        difficulty: 'easy' | 'medium' | 'hard';  // Your assessment
        howItWent: 'strong' | 'okay' | 'weak';   // Your performance on this question
        follow_ups?: string[];         // Any follow-up probes they asked
      }[];
      total_count: number;
      type_breakdown: Record<InterviewType, number>;  // "behavioral": 3, "product_strategy": 2
    };

    // 5. Their Priorities (what the team cares about)
    theirPriorities: {
      explicit: string[];              // What they said mattered ("shipping velocity", "user empathy")
      inferred: string[];              // What you inferred from questions & reactions
      skill_priorities: {
        skill: string;                 // e.g., "Leadership", "Technical Depth", "User Advocacy"
        confidence: 'high' | 'medium' | 'low';
      }[];
      culture_signals: string[];       // Team dynamics they revealed ("fast-paced", "data-driven", "collaborative")
      overall_summary: string;         // Your synthesis of what this team values
    };

    // 6. Red Flags (concerns about role/team/company)
    redFlags: {
      flags: {
        description: string;           // What concerned you
        category: 'role' | 'team' | 'company' | 'personal_fit';
        severity: 'high' | 'medium' | 'low';
        interviewer_signal?: string;   // Did the interviewer hint at this?
      }[];
      overall_concerns: string;        // Synthesized view of red flags
      deal_breaker?: boolean;          // Could this be a deal-breaker?
    };

    // 7. Follow-up Items (next steps/timeline)
    followUpItems: {
      items: {
        description: string;           // e.g., "Send take-home case", "Second round scheduled"
        owner: 'you' | 'them';         // Who is responsible?
        deadline?: string;             // ISO date if mentioned
        priority: 'high' | 'medium' | 'low';
      }[];
      nextRound: {
        scheduled?: string;            // ISO datetime if next round is scheduled
        expectedType?: string;         // What round will it be?
        expectedTimeline?: string;     // e.g., "within 3 days"
      };
      overall_timeline: string;        // User's sense of pace & timeline
    };

    // 8. Interviewer Notes (demeanor, interests, decision style)
    interviewerNotes: {
      demeanor: string;                // e.g., "Warm, collaborative, asked lots of follow-ups"
      interests: string[];             // What topics did they lean into?
      decisionStyle: string;           // How did they approach evaluation? ("data-driven", "gut feel", "collaborative")
      connectionLevel: 'high' | 'medium' | 'low';  // How much rapport?
      likelihood_to_advance?: string;  // Your read on whether they'll move you forward
    };
  };

  // Detected Questions (for question bank)
  detectedQuestions: {
    question: string;
    type: InterviewType;
    category?: string;
    source: 'explicit' | 'paraphrased';  // Did they ask this verbatim or is this your interpretation?
    confidence: 'high' | 'medium' | 'low';
  }[];

  // Pattern Analysis (if applicable)
  patterns?: {
    interview_number_for_role: number;  // This is debrief #1, #2, #3 for this role
    comparison_to_previous?: {
      debrief_id: string;              // Previous debrief session ID
      trends: {
        overall_impression_change: 'improved' | 'stable' | 'declined';
        questions_harder_than_last: boolean;
        themes_consistent: boolean;    // Same themes asked?
      };
    };
  };

  // Recommendations & Insights
  recommendations: {
    prep_areas: {
      area: string;                    // e.g., "Product Strategy - Competitive Scenarios"
      priority: 'high' | 'medium' | 'low';
      rationale: string;               // Why this matters for this company
      action: string;                  // What to do (e.g., "Practice 3 competitive scenarios")
    }[];
    research_brief_updates: {
      section: string;                 // e.g., "gaps_and_risks", "positioning"
      change: string;                  // What should change?
      rationale: string;               // Why?
    }[];
    positioning_signals: {
      signal: string;                  // e.g., "Leadership experience resonated"
      confidence: 'high' | 'medium' | 'low';
    }[];
  };

  // State tracking
  state: 'in_progress' | 'completed' | 'abandoned';
  sections_completed: number;          // How many of the 8 sections did user fill in?
}

interface InterviewType {
  type:
    | 'product_execution'
    | 'product_strategy'
    | 'product_design'
    | 'product_sense'
    | 'behavioral'
    | 'technical'
    | 'homework_case_study'
    | 'other';
}
```

### Role Interview Record Update

The debrief updates the `pf_roles` record:

```typescript
// In pf_roles[roleId].interviewRounds[n]:
{
  roundNumber: number;
  roundType: string;                   // "phone", "round_1", "final"
  date: string;
  notes: string;                       // Structured notes from debrief
  debriefArtifactId: string;           // Link to debrief_session artifact
  overallImpression: number;           // 1-5 score
  interviewer_names: string[];
  state: string;                       // e.g., "interviewed", "waiting_for_feedback", "pending_second_round"
  nextSteps: string;
  debrief_completed_at: string;        // ISO timestamp
}

// In pf_roles[roleId]:
{
  ...
  interviewSubState: string;           // e.g., "post_round_1_debrief_complete", "waiting_for_round_2", "offer_received"
  latestDebriefArtifactId: string;     // Most recent debrief
  debriefHistory: string[];            // List of all debrief artifact IDs for this role
}
```

---

## 4. Debrief Prompt Structure

The debrief is conversational. Claude initiates with context and asks targeted questions based on the 8 sections. Each user answer triggers processing, and Claude asks clarifying follow-ups or moves to the next section.

### Example Prompt Template

```
You are debriefing [Candidate Name] on their interview for [Role Title] at [Company Name].

Interview Details:
- Type: [Product Strategy] Round
- Interviewer(s): [Sarah Chen, Product Director]
- Duration: [45 minutes]
- Date: [March 10, 2026, 2:00 PM PT]

You are warm, conversational, and curious. Your goal is to capture structured feedback in 8 sections:
1. Overall Impression (1-5 gut check)
2. What Landed (stories that resonated)
3. What Didn't Land (weak moments)
4. Questions They Asked (with type classification)
5. Their Priorities (what the team values)
6. Red Flags (concerns)
7. Follow-up Items (next steps)
8. Interviewer Notes (demeanor, interests, decision style)

Known context to help guide your questions:
- Positioning: [User's positioning statement]
- Key gaps from research: [Gap #1, Gap #2]
- Prior debrief patterns: [If prior rounds, mention trends: "Last time you felt stronger on behavioral than strategy..."]

Start by acknowledging the interview and asking a warm opener:
"Hey! How are you feeling about the interview? I'd love to hear your take on how it went."

Then, based on their answer, move through the 8 sections conversationally. After each section, confirm you captured it and move to the next.
```

### Question Examples for Each Section

**Section 1: Overall Impression**
- "On a scale of 1-5, where do you land? How confident are you?"
- "What's your gut feeling—do you think they'll move you forward?"

**Section 2: What Landed**
- "What moment in the interview made you feel most confident?"
- "Did you tell any stories? How did they react?"

**Section 3: What Didn't Land**
- "Was there a moment where you felt like your answer missed the mark?"
- "Any questions where you got stuck or weren't sure how to respond?"

**Section 4: Questions They Asked**
- "Walk me through the questions they asked, in order if you remember."
- "Were there any surprise questions that caught you off-guard?"

**Section 5: Their Priorities**
- "What did it sound like this team cares most about?"
- "Based on the questions and how they reacted, what signals did you pick up?"

**Section 6: Red Flags**
- "Any concerns about the role, team, or company?"
- "Anything that made you pause or worry?"

**Section 7: Follow-up Items**
- "What happens next? When will you hear from them?"
- "Did they ask you to prepare anything for the next round?"

**Section 8: Interviewer Notes**
- "What was the interviewer like as a person? Energy, style, vibe?"
- "How did they seem to evaluate you? Gut feel, data-driven, collaborative?"

---

## 5. Output & Feedback Loops

### 5.1 Debrief Artifact Saved to MCP

After `pf_finalize_debrief` completes, the full debrief_session artifact is stored in MCP, keyed by `{roleId}_{round}_{date}_{timestamp}`. User can access it anytime from the role detail page or Pipeline.

### 5.2 Role Record Updates

`pf_roles[roleId].interviewRounds[n]` and `pf_roles[roleId].interviewSubState` are updated with:
- Overall impression (1-5 score)
- Debrief artifact link
- Next-step summary
- Interviewer names
- State transition (e.g., "interviewed" → "post_debrief_complete", then "awaiting_round_2" or "offer_stage")

### 5.3 Research Brief Refresh Trigger

`pf_refresh_research_brief` is automatically triggered after debrief finalization. It updates:

**Section 6: Gaps & Risks**
- If debrief reveals a skill gap you didn't know about, add it.
- If debrief reveals red flags about company culture or role fit, surface them.
- Example: Debrief says "They asked a ton of questions about iOS. I felt lost." → Research Brief flags: "iOS knowledge gap identified in interview feedback."

**Section 8: Positioning Refinement**
- If debrief shows your positioning statement resonated, note it.
- If debrief shows misalignment, suggest positioning tweaks.
- Example: Debrief says "They kept asking about leadership, and I had no answer." → Research Brief suggests: "Consider emphasizing any leadership experience, no matter how small."

### 5.4 Thank-You Note Handoff to Outreach Generator

After debrief finalizes, `pf_generate_thank_you_note` in the Outreach module is called with:
- Interviewer names & titles
- Key themes they valued
- Any personalization from debrief (e.g., "They lit up when I talked about retention metrics")
- Your overall impression & confidence level

The Outreach module uses this context to generate a personalized, warm thank-you note (not generic).

### 5.5 Question Bank Entry

Any new questions detected in the debrief are tagged and added to `pf_question_bank`:

```typescript
{
  question: string;
  company: string;
  interview_type: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: 'debrief' | 'mock' | 'other';
  encountered_date: string;
  debrief_id: string;                  // Link back to debrief
}
```

Questions are tagged by company and type, so future Mock Interview sessions can use them.

---

## 6. Pattern Analysis (After 10+ Debriefs)

Once you've completed 10+ debriefs across your job search, the system analyzes patterns and surfaces "Interview Intelligence" on the Dashboard.

### Pattern Types

**Story Performance**
- Which STAR story themes land most? (e.g., "Leadership stories score 4.2/5 on average")
- Which stories fall flat? (e.g., "Technical stories average 2.8/5")
- Recommendation: "Develop 2 more Impact stories; retire Technical stories for now."

**Interview Type Strengths & Weaknesses**
- Aggregate scores by interview type across all debriefs.
- Example: "You're stronger on Behavioral (avg 4.1/5) than Product Strategy (avg 3.2/5)."
- Recommendation: "Focus prep on Product Strategy before your next round."

**Question Category Patterns**
- Which question types trip you up? (e.g., "Competitive scenarios: 2.8/5 avg")
- Which do you excel at? (e.g., "Goals & Metrics: 4.4/5 avg")
- Recommendation: "Practice 5 competitive scenarios."

**Stage-Specific Conversion Patterns**
- Phone screens: "You advance 70% of the time; stronger opening than others"
- Round 1 vs. Final: "Your final round scores are lower; practice staying cool under pressure"
- Recommendation: "You're doing well early. Focus on final-round readiness (technical depth, company knowledge)."

**Interviewer Signals**
- Do certain interviewer profiles correlate with your success? (e.g., "You score higher with Engineering leads than Product leads")
- Recommendation: "For future Product lead interviews, practice more product-focused examples."

### Dashboard "Interview Intelligence" Card

```
┌──────────────────────────────────────────┐
│ Interview Intelligence (10 debriefs)     │
├──────────────────────────────────────────┤
│                                          │
│ Strongest Area:                          │
│  Behavioral Questions — 4.2/5 avg       │
│  ✓ "Tell me about failure" → 4.6/5      │
│                                          │
│ Weakest Area:                            │
│  Product Strategy — 3.1/5 avg           │
│  ⚠ "Competitive scenarios" → 2.6/5      │
│                                          │
│ Story Performance:                       │
│  Leadership: 4.2/5 (4 uses)             │
│  Technical: 2.8/5 (5 uses)              │
│  Impact: 3.9/5 (3 uses)                 │
│                                          │
│ Conversion Rate:                         │
│  Phone Screen: 70% → Next Round          │
│  Round 1: 50% → Final Round              │
│  Final Round: 40% → Offer                │
│                                          │
│ Recommended Focus:                       │
│  [1] Product Strategy - Competitive      │
│  [2] Final Round Readiness               │
│  [3] Retire technical-focused stories   │
│                                          │
│ [View Full Analysis →]                   │
└──────────────────────────────────────────┘
```

---

## 7. UI Spec

### Debrief Activation Screen

When an interview ends (detected via Calendar), user receives a notification:

```
┌─────────────────────────────────────┐
│ Interview Complete!                 │
├─────────────────────────────────────┤
│                                     │
│ Interview: [Product Strategy Round] │
│ Company: [Company Name]             │
│ Interviewer: [Sarah Chen]           │
│ Duration: 45 minutes                │
│                                     │
│ Let's capture your feedback while   │
│ it's fresh. Ready to debrief?       │
│                                     │
│ [Start Debrief]  [Remind Me Later]  │
│                                     │
└─────────────────────────────────────┘
```

### Main Debrief Interface (Conversational Chat)

```
┌──────────────────────────────────────────────┐
│ Post-Interview Debrief — Product Strategy    │
│ Company: [Company Name] | 45 min interview   │
├──────────────────────────────────────────────┤
│                                              │
│ Debrief Progress: ████░░░░░░ 4 of 8 sections│
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│ [Chat history]                              │
│                                              │
│ Agent: "What moment in the interview made  │
│         you feel most confident?"           │
│                                              │
│ User: "When I walked through the CIRCLES   │
│       framework for the growth question.   │
│       They nodded and asked a follow-up."  │
│                                              │
│ Agent: "Great! Sounds like your framework  │
│        showed strong structure. Did you    │
│        also bring in data/metrics, or was  │
│        it more conceptual?"                │
│                                              │
│ [User typing...]                            │
│                                              │
├──────────────────────────────────────────────┤
│ [Your Answer]                               │
│ ┌──────────────────────────────────────┐   │
│ │ I included some rough numbers about  │   │
│ │ market size, but I should've been    │   │
│ │ more specific...                     │   │
│ └──────────────────────────────────────┘   │
│ [Send]  [Skip]                              │
│                                              │
└──────────────────────────────────────────────┘
```

### Debrief Summary Screen (After Completion)

```
┌──────────────────────────────────────────────────┐
│ Debrief Summary — Product Strategy Round         │
│ Company: [Company Name] | March 10, 2026         │
├──────────────────────────────────────────────────┤
│                                                  │
│ Overall Impression: 4/5 ⭐⭐⭐⭐                 │
│ "Feel pretty good about this one"               │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│ What Went Well:                                 │
│ ✓ CIRCLES framework clarity                     │
│ ✓ Growth metrics discussion                     │
│ ✓ Good rapport with Sarah Chen                  │
│                                                  │
│ What to Work On:                                │
│ ⚠ More specific data examples                   │
│ ⚠ Competitive positioning (didn't ask)          │
│                                                  │
│ Their Priorities:                               │
│ • Shipping velocity                             │
│ • Data-driven decision making                   │
│ • Cross-functional leadership                   │
│                                                  │
│ Red Flags:                                      │
│ 🚩 Team size smaller than expected               │
│    (Only 3 engineers on the team)               │
│                                                  │
│ Next Steps:                                     │
│ → They'll send take-home case by tomorrow       │
│ → Final round likely next week                  │
│ → You should send thank-you by tonight          │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│ Recommended Prep for Next Round:                │
│ 🔴 HIGH: Data storytelling (you hesitated)      │
│ 🟡 MEDIUM: Competitive landscape knowledge      │
│ 🟢 LOW: Framework practice (solid)              │
│                                                  │
│ Research Brief Updates:                         │
│ • "Small team size" added to Risk Factors       │
│ • "Data storytelling" added to Prep Gaps        │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│ [Generate Thank-You Note]  [View Full Debrief]  │
│ [Return to Pipeline]                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Interview Intelligence Dashboard Card

```
┌─────────────────────────────────────────┐
│ 📊 Interview Intelligence (11 debriefs) │
├─────────────────────────────────────────┤
│                                         │
│ Your Strengths:                         │
│  Behavioral → 4.3/5 avg                │
│  Product Design → 4.1/5 avg            │
│                                         │
│ Areas to Practice:                      │
│  Product Strategy → 3.2/5 avg          │
│  Technical → 2.9/5 avg                 │
│                                         │
│ Best-Performing Stories:                │
│  Leadership (5 uses, 4.4 avg rating)   │
│  Impact (4 uses, 4.2 avg rating)       │
│                                         │
│ Conversion by Stage:                    │
│  Phone → Round 1: 70%                  │
│  Round 1 → Final: 60%                  │
│  Final → Offer: 40%                    │
│                                         │
│ → [View Full Analysis]                  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 8. Implementation Phases

### Phase 1: Core Debrief Capture (Week 1–2)

**MCP Tools:**
- `pf_initialize_debrief_session` — Load context, generate initial prompt
- `pf_process_debrief_response` — Process user answers, extract facts, generate follow-ups
- `pf_finalize_debrief` — Assemble artifact, update role state

**UI:**
- Debrief activation notification
- Chat-like debrief interface (text input only)
- Debrief summary screen

**Data:**
- Debrief session artifact schema
- Role record update schema
- Question bank entry schema

**Scope:** Capture all 8 sections conversationally. No pattern analysis yet.

---

### Phase 2: Research Brief & Outreach Integration (Week 3–4)

> **Status: Planned** — Not yet implemented. Spec retained for future development.

**MCP Tools:**
- Enhanced `pf_finalize_debrief` — Trigger research brief refresh
- `pf_refresh_research_brief` — Update sections 6 & 8 based on debrief
- `pf_generate_thank_you_note` — Handoff to Outreach with debrief context

**UI:**
- Show suggested research brief updates on summary screen
- Link to generate thank-you note

**Data:**
- Debrief → Research Brief mapping
- Question bank tagging

**Quality:** Ensure thank-you notes use debrief insights for personalization.

---

### Phase 3: Pattern Analysis & Intelligence (Week 5–6)

> **Status: Planned** — Not yet implemented. Spec retained for future development.

**MCP Tools:**
- `pf_analyze_debrief_patterns` — Background job after 10+ debriefs, analyze trends

**UI:**
- Dashboard "Interview Intelligence" card
- Full analysis view (story performance, interview type breakdown, conversion rates)

**Data:**
- Pattern summary object (appended to debrief artifacts, stored separately)
- Dashboard widget configuration

**Scope:** After 10 debriefs, surface patterns & recommendations.

---

### Phase 4: Polish & Insights Refinement (Week 7–8)

**UI:**
- Debrief archive & history view (browse past debriefs)
- Trend view (chart debrief scores over time, by interview type)
- Interviewer insights (which types of interviewers do you excel with?)

**Quality:**
- User feedback loop (thumbs up/down on debrief questions)
- A/B testing on Claude prompts & question phrasing

---

## 9. Relationship to Other Modules

### Pipeline Tracker (modules/pipeline/)

**Dependency:** Reads `pf_roles`, `pf_companies` to know what to debrief about.

**Data flow:**
```
Pipeline:
  [Interview Logged] → Notification triggers debrief
    ├─ User starts debrief
    ├─ Debrief captures feedback
    └─ Role state updated (interviewed → post_debrief_complete → awaiting_next_round)

Pipeline Role Detail:
  [Displays latest debrief link]
  [Shows interview history with debrief summaries]
```

**Integration point:** Role detail page shows latest debrief summary. Calendar sync detects interview end.

---

### Research Brief (modules/research-brief/)

**Dependency:** Debrief reads research brief context. Debrief feeds back into research brief.

**Data flow:**
```
Research Brief:
  [Generated] → Debrief reads gaps, risks, positioning to calibrate questions

Debrief:
  [Completed] → Triggers research brief refresh
    ├─ Section 6 (Gaps & Risks): Updated with interview findings
    ├─ Section 8 (Positioning): Refined based on how you landed themes
    └─ Dashboard alerts user: "Research Brief updated based on interview"
```

**Integration point:** Debrief summary shows suggested research brief updates. User clicks to confirm.

---

### Outreach Generator (modules/outreach/)

**Dependency:** Receives debrief context to personalize thank-you notes.

**Data flow:**
```
Debrief:
  [Finalized] → Hands off to Outreach
    ├─ Interviewer names & details
    ├─ Key themes they valued
    ├─ Your impression & confidence
    └─ Specific moments to reference

Outreach:
  [Generates thank-you note] using debrief context
    └─ "Hi Sarah, thanks for taking the time today. I especially enjoyed our discussion about [specific thing from debrief]. It was clear the team values [theme], and I'm excited about [aligned experience]..."
```

**Integration point:** Debrief summary has "Generate Thank-You Note" button. Outreach module is pre-filled with context.

---

### Mock Interview (modules/mock-interview/)

**Dependency:** Debrief feeds question bank; Mock Interview uses debriefed questions for future practice.

**Data flow:**
```
Debrief:
  [Questions captured] → Tagged and stored in pf_question_bank

Mock Interview:
  [Setting up for same company] → Queries pf_question_bank
    ├─ "You've been asked [Question] before in a real interview"
    ├─ Suggests practicing similar questions
    └─ Helps user prepare for patterns they've seen
```

**Integration point:** Mock Interview can flag "real question from interview" if user encounters a debriefed question again.

---

### Dashboard (modules/dashboard/)

**Dependency:** Reads debrief summaries for Interview Intelligence.

**Data flow:**
```
Debrief:
  [Sessions accumulate] → Pattern analysis runs after 10+ debriefs

Dashboard:
  [Displays Interview Intelligence card]
    ├─ Strongest/weakest interview types
    ├─ Story performance breakdown
    ├─ Conversion rate by stage
    ├─ Recommended focus areas
    └─ Trend chart (debrief scores over time)
```

**Integration point:** Dashboard queries `pf_debrief_patterns` artifact (generated after 10+ debriefs).

---

### Question Bank (implicit; part of Debrief)

**Owned by:** Debrief module (reads from, writes to).

**Data flow:**
```
Debrief:
  [Interview questions captured] → Classified and tagged
    ├─ Company: [Company]
    ├─ Type: [product_strategy, behavioral, etc.]
    ├─ Difficulty: [easy, medium, hard]
    └─ Stored in pf_question_bank

Mock Interview & Future Debriefs:
  [Uses question bank] to understand what this company/role asks
    └─ "Based on prior debriefs, this company often asks [Question Type]"
```

---

## 10. Success Metrics

### User-Facing Metrics

1. **Debrief Activation Rate** — % of interviews that trigger a debrief completion (target: >75%)
2. **Average Debrief Duration** — Time spent in debrief conversation (target: 10–15 minutes)
3. **Sections Completed** — % of users who complete all 8 sections (target: >85% complete at least 7/8)
4. **Insight Utility** — Post-survey: Did debrief insights help prep? (target: >80% say "yes, somewhat or very much")
5. **Research Brief Update Acceptance** — % of suggested research brief updates that user confirms (target: >60%)
6. **Thank-You Note Personalization** — % of thank-you notes that reference debrief context (target: 100%)
7. **Pattern Recognition Adoption** — After Interview Intelligence surfaces, % of users who adjust prep (target: >50% within 1 week)
8. **Conversion Rate Improvement** — Do users with Interview Intelligence improve advancement rates? (target: +10% conversion)

### System Metrics

1. **Question Bank Growth** — New questions discovered per debrief (target: 2–4 new questions per debrief)
2. **Pattern Analysis Completeness** — After 10 debriefs, quality of pattern detection (target: >80% of patterns match user intuition)
3. **Artifact Quality** — Debrief artifacts are complete & extractable (target: >95% artifacts have all 8 sections)
4. **Integration Reliability** — Research Brief refresh succeeds (target: >95% success rate)
5. **Outreach Handoff Success** — Thank-you note generation completes (target: >95% success rate)

---

## 11. Open Questions & Future Enhancements

1. **Audio Recording** — Could users record their debrief answer (instead of typing)? Faster entry, less friction.
2. **Interviewer Feedback Loop** — Could we eventually ask interviewers for their feedback (opt-in, via link)? Would validate debrief self-assessments.
3. **Peer Comparison** — After pattern analysis, could we show anonymized comparisons? ("You're stronger on Behavioral than [your percentile] of Pathfinder users")
4. **Debrief Sharing** — Could users share debriefs with a coach or mentor for feedback?
5. **Predictive Advancement** — Could we predict offer likelihood based on debrief score + Interview Intelligence patterns?

---

## 12. Appendix: Example Debrief Conversation

**Setup:** User just finished a Product Strategy round interview at Company X.

---

**Agent:** "Great! Let's capture your interview feedback while it's fresh. How are you feeling about the interview? Any first impressions?"

**User:** "Honestly, I think it went okay. The interviewer was nice, but I definitely stumbled on the competitive question."

**Agent:** "Thanks for that. Sounds like it was a mixed bag. On a scale of 1-5, where would you land overall? How confident are you that they'll move you forward?"

**User:** "I'd say a 3.5, maybe 4. They seemed engaged, especially in the first half. But that competitive question really threw me."

**Agent:** "Got it—so 4/5, with some concern about the competitive moment. Let's talk about what went well first. Was there a specific moment where you felt really confident or where they seemed impressed?"

**User:** "Yeah, the opening. I walked through the CIRCLES framework, clarified their assumptions, and they asked a follow-up on my research approach. That felt good."

**Agent:** "Excellent. That's a strong signal. So you used a framework, showed structure, and they engaged. Did you share any specific examples or stories to back up your thinking?"

**User:** "I mentioned a growth project I led at my last company where we used similar research. They seemed interested."

**Agent:** "Perfect. So you brought a concrete example that landed well. Can you tell me a bit more about that story—what was the situation, what did you do, and what was the outcome?"

**User:** "We were trying to grow DAU by 15%. I proposed a retention-first strategy instead of new user acquisition. Defined metrics, tested it, and it worked—we hit 18% growth in 2 months."

**Agent:** "That's a great story—goal, approach, data, and outcome. This could go in your story bank as a 'Growth' or 'Data-Driven' story for future prep. We can save that. Now, let's talk about where things got tricky. You mentioned the competitive question. Walk me through that one."

**User:** "They asked, 'If [Competitor] launched a similar feature, how would you respond?' And I just froze. I don't know their product well enough, and I didn't know how to start thinking about it."

**Agent:** "That's tough. In that moment, did you say anything, or did you ask for clarification?"

**User:** "I said something like, 'I'd need to understand their positioning and user base better,' but then I kind of stalled. I think I should've asked them more questions or worked through a framework."

**Agent:** "Ah, so you identified the gap (need more info) but didn't execute a framework to work through it. That's actually a common pattern in competitive questions—jumping to conclusions instead of scaffolding your thinking. We'll flag this as a practice area. What was their reaction?"

**User:** "They seemed a bit disappointed. Nodded but didn't follow up. Just moved to the next question."

**Agent:** "OK—so they disengaged. That's useful feedback. Now, let's talk about the other questions. Can you walk me through all the questions they asked, in order?"

**User:** "Sure. First was the growth question (CIRCLES, the one that went well). Then competitive (the one that flopped). Then they asked about pricing—like, what should we charge for X feature. And then behavioral—tell me about a time I disagreed with a manager."

**Agent:** "Great. So 4 questions total: Growth (product strategy), Competitive (product strategy), Pricing (product sense), and Behavioral. How did you feel about pricing and the behavioral one?"

**User:** "Pricing was okay, not great. I walked through some frameworks but didn't have strong data. The behavioral one was solid—I have a good story about pushing back on a timeline."

**Agent:** "Perfect. So let's track: Growth = strong, Competitive = weak, Pricing = medium, Behavioral = strong. Now, stepping back, what did you infer about what this team values? What signals did you pick up from the questions and the interviewer's reactions?"

**User:** "They definitely care about shipping speed and data. The interviewer kept drilling into metrics and timeline. And they seemed interested in my cross-functional experience."

**Agent:** "Excellent synthesis. So: Speed, Data, and Cross-functional collaboration. Did anything concern you about the role or team?"

**User:** "Actually, yeah. The team is only 3 people for the whole product area. That seems small. And the interviewer mentioned they ship 'weekly,' which is fast but also sounds chaotic."

**Agent:** "Good observations. Small team size and high velocity—those are useful data points for you to reflect on. Are those deal-breakers, or just things to keep in mind?"

**User:** "Probably not deal-breakers, but I'd want to know more about the team structure and how sustainable the pace is."

**Agent:** "Great. So next steps: Did they mention what happens now?"

**User:** "They said they'd send a take-home case by tomorrow and let me know if I advance within a week."

**Agent:** "OK, so take-home case + week timeline. Last question: What was the interviewer like as a person? Energy, style, vibe?"

**User:** "Smart, direct, but friendly. Definitely data-driven. Asked a lot of probing questions. I felt like they were genuinely curious, even when I stumbled."

**Agent:** "Sounds like a thoughtful evaluator. OK, I think I have the picture. Let me summarize:

**Overall Impression:** 4/5. You felt strong on opening (CIRCLES framework), struggled on competitive, and recovered well on behavioral.

**What Landed:** Growth question, story about retention project, behavioral question.

**What Didn't Land:** Competitive question (framework breakdown).

**Their Priorities:** Speed, data, cross-functional collab.

**Red Flag:** Small team size + high pace (not a deal-breaker, but worth exploring).

**Next Steps:** Take-home case tomorrow, answer within a week.

**Before your next round, we'd recommend:**
- Practice competitive scenarios with a framework (escalation, positioning, etc.)
- Learn more about their competitor & product

**We'll also update your Research Brief with 'small team' risk factor, save your retention story, and have you write a thank-you note tonight referencing your CIRCLES discussion.**

How does that sound?"

**User:** "Perfect. That's super helpful."

---

**End Debrief**

