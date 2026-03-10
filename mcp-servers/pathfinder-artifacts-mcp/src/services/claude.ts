// Claude API client service for generating research brief sections
// Wraps the Anthropic SDK and handles prompt construction per the Research Brief PRD

import Anthropic from "@anthropic-ai/sdk";

// ================================================================
// SYSTEM PROMPT — shared across all section generation calls
// ================================================================
// This is the "persona" that Claude adopts when generating brief sections.
// It's designed to produce interview-prep content, not generic company overviews.

const SYSTEM_PROMPT = `You are a job search preparation researcher. You generate highly specific, role-tailored research briefs for interview preparation. Every claim must be sourced. Never fabricate company data, funding amounts, names, or metrics. If you don't have specific data, say so clearly and suggest where the user can find it.

CRITICAL: Your output MUST be valid HTML only — never markdown. Use semantic HTML tags: <h3>, <p>, <ul>, <li>, <ol>, <table>, <strong>, <em>. Do NOT use markdown syntax like **bold**, *italic*, ## headers, or - list items. Include citation markers as [n] where n maps to the citations array you return alongside the content.

Be direct. No filler. No "in today's rapidly evolving landscape." Every sentence should give the reader something they can use in an interview or a decision.

When data is sourced from recruiter intel (knownContext entries), clearly label it: "Based on recruiter intel, not confirmed JD."

When data is inferred from your training knowledge, label the source and date: "Based on publicly available information as of [your knowledge cutoff]."

Format citations as a JSON array at the end of your response, wrapped in <citations> tags:
<citations>
[
  {"n": 1, "claim": "brief claim text", "source": "source description", "sourceType": "enrichment_web|job_board|manual_entry|ai_generated", "url": "optional url", "date": "optional date"}
]
</citations>

The HTML content should come first, followed by the citations block. Do not include any other text after the citations block.`;


// ================================================================
// SECTION PROMPTS — one per section, matching the PRD spec
// ================================================================
// Each prompt tells Claude exactly what to generate for that section.
// The prompts reference the {context} block injected before them.

export const SECTION_PROMPTS: Record<number, { title: string; prompt: string; extraInputs?: string[] }> = {
  0: {
    title: "Known Context",
    prompt: `Generate Section 0: Known Context.

This section only appears when there is NO job description (JD) available. It aggregates everything known about the role from recruiter conversations, emails, and research.

Output structure (use h3 for subsections):
- **Source of This Role** — Who told the candidate about it, when, through what channel.
- **What We Know** — Structured summary of all roleHints fields that have values (function, level, scope, product area, team size, reporting line, tech stack, location). Use a definition-list style.
- **Recruiter Intel Log** — Chronological entries from knownContext[], each with date, source channel, and what was learned.
- **Reconstructed Role Profile** — A synthesized paragraph that downstream sections can use as a JD substitute. Be conservative: only assert what the data supports, flag anything uncertain.
- **What's Still Unknown** — Explicit list of gaps (full JD, explicit requirements, comp range, interview panel). For each gap, note which brief sections it would unlock.

This section is primarily data assembly, not generation. The "Reconstructed Role Profile" paragraph is the only generative part.`,
    extraInputs: ["roleHints", "knownContext", "recruiterSource"]
  },

  1: {
    title: "Role Decode",
    prompt: `Generate Section 1: Role Decode.

Parse the JD (or Reconstructed Role Profile if no JD) and surface what this role actually needs — the stuff between the lines.

Output structure (use h3 for subsections):
- **The Real Problem** — One paragraph: what business problem is this hire solving? Inferred from JD language, team description, and company stage.
- **Explicit Requirements** — Bulleted list of what the JD directly asks for. Tag each as "must-have" or "nice-to-have" based on JD language ("required" vs "preferred").
- **Implied Requirements** — What the JD signals without stating. E.g., "comfortable with ambiguity" → early-stage product, undefined roadmap.
- **Level Signals** — Seniority indicators: scope of ownership, decision-making authority, team size, reporting line hints. Does this match the stated title?
- **Red Flags & Watch Items** — Anything unusual: unrealistic scope, conflicting requirements, buzzword density suggesting the role isn't well-defined.

Read the JD as a hiring manager would write it — with constraints, urgency signals, and organizational context embedded in word choices. This is not a summary; it's an interpretation.

If no JD is available, generate from the Known Context section's "Reconstructed Role Profile" and clearly label: "Based on recruiter intel — will be updated when JD is available."`,
  },

  2: {
    title: "Company Now",
    prompt: `Generate Section 2: Company Now.

What's happening at this company RIGHT NOW that's relevant to THIS role. Not a founding story — a situational briefing.

Output structure (use h3 for subsections):
- **Current Moment** — 2-3 paragraphs on what the company is doing this quarter. Product launches, strategic shifts, market moves, leadership changes. Everything timestamped.
- **Why This Role, Why Now** — Hypothesis: what's driving this hire? New product line? Team scaling? Backfill? Derived from company context + JD language.
- **Key Metrics** (if available) — Revenue signals, growth rate, user base, market share. For public companies: recent earnings highlights. For private: last known fundraise, headcount trajectory.
- **Leadership** — CEO, relevant VP/SVP over this function, CTO (if engineering-adjacent). One line each: name, tenure, background, notable decisions.

Prioritize recency. If your training data is limited for this company, say so and flag sections for manual research. Never fabricate news or metrics.`,
  },

  3: {
    title: "Funding & Corporate Structure",
    prompt: `Generate Section 3: Funding & Corporate Structure.

Follow the money. Who funds this company, what's the cap table story, and what's the corporate family tree.

Output structure (use h3 for subsections):
- **Funding History** — HTML table: Round, Date, Amount, Lead Investor(s), Valuation (if known). Most recent round first.
- **Notable Investors & Board Members** — Names, firms, and why they matter.
- **Corporate Structure** — Parent company (if subsidiary), subsidiaries, recent acquisitions, joint ventures.
- **Financial Health Signals** — For public: market cap, P/E, revenue trend. For private: runway signals. For both: layoffs, hiring freezes, or aggressive hiring signals.
- **What This Means for You** — One paragraph connecting the financial picture to the role.

Use known funding databases (Crunchbase-style knowledge). If you don't have specific data, say "Not found in available data — verify on Crunchbase" rather than guessing. Never fabricate funding amounts or valuations.`,
  },

  4: {
    title: "Competitive Landscape",
    prompt: `Generate Section 4: Competitive Landscape.

Who is this company fighting, specifically in the product area this role touches.

Output structure (use h3 for subsections):
- **Direct Competitors** — 3-5 companies competing in the same product space as this role. For each: one-line description, estimated scale, key differentiator.
- **Indirect / Adjacent Competitors** — 2-3 companies that compete tangentially or could expand into this space.
- **Competitive Dynamics** — Market narrative: consolidating? Land-grab? Feature parity race? Who's winning and why?
- **Target Company's Moat** — Defensible advantage: network effects, data, distribution, brand, switching costs, regulatory?
- **Interview Leverage** — How to reference the competitive landscape in interviews. One example talking point.

Scope competitors to the PRODUCT AREA the role sits in, not the company overall. The JD should provide scoping signals.`,
  },

  5: {
    title: "Team & Org Intelligence",
    prompt: `Generate Section 5: Team & Org Intelligence.

Who would the candidate work with? Who's the hiring manager? What does the org look like?

Output structure (use h3 for subsections):
- **Likely Reporting Line** — Inferred from JD: who does this role report to? What does that imply about scope and visibility?
- **Team Shape** — Estimated team size, composition (PMs, engineers, designers, data), and org model (squad, pod, functional).
- **Adjacent Teams** — Who would this role interact with most? Based on JD's "cross-functional" mentions.
- **Interviewer Profiles** — If interviewer names are provided in the context, generate a brief profile for each. If not, show: "Add interviewer names in the sidebar to unlock this section."
- **Org Observations** — Signals about the org from JD or public info: new team, re-org, rapid growth.

Use only publicly available professional information for interviewer research. Flag uncertainty.`,
    extraInputs: ["interviewerNames", "connections"]
  },

  6: {
    title: "Network & Connections",
    prompt: `Generate Section 6: Network & Connections.

Who does the candidate already know at this company? Turn the network into an advantage.

Output structure (use h3 for subsections):
- **Direct Connections** — People from pf_connections who work at this company. For each: name, title, relationship context, suggested action.
- **Second-Degree Paths** — Connections who previously worked there, or who are connected to known employees.
- **Suggested Outreach** — For each viable connection, a one-liner on what to say — not a full email, just a hook.
- **No Connections?** — If no matches: "No connections found at [Company]. Consider: LinkedIn search for [Company] + [your school/previous employers]."

This section is data-driven. Cross-reference the connections list against the company name. Creative suggestions for second-degree paths are welcome, but the core list must be factual from the user's data.`,
    extraInputs: ["connections"]
  },

  7: {
    title: "Fit Analysis",
    prompt: `Generate Section 7: Fit Analysis.

The honest answer to "why should they hire you?" — mapped requirement by requirement against the candidate's actual experience.

Output structure (use h3 for subsections):
- **Requirements Map** — HTML table with columns: Requirement (from JD), Your Evidence (matched bullet or story), Fit (green check / yellow warning / red X), Notes.
  - Green: direct, demonstrable experience.
  - Yellow: adjacent experience that can be positioned.
  - Red: genuine gap, no relevant experience found.
- **Overall Fit Score** — X/Y requirements matched (green + yellow count). Not a percentage — a concrete count.
- **Gap Positioning Strategies** — For each yellow/red requirement: how to talk about it without lying. Specific framing suggestions.
- **Secret Weapons** — Experience from the bullet bank that the JD doesn't ask for but would be valuable.

This must be HONEST. Never fabricate matches or inflate yellow to green. A brief that tells you "you're perfect" is useless. If the bullet bank is empty, flag it prominently and generate a degraded version using only JD analysis.`,
    extraInputs: ["bulletBank", "storyBank"]
  },

  8: {
    title: "Compensation Intelligence",
    prompt: `Generate Section 8: Compensation Intelligence.

Know your number before they ask.

Output structure (use h3 for subsections):
- **Expected Range** — Base salary range for this title + level + location + company stage. Source your estimates.
- **Total Comp Structure** — How this company typically pays: base + bonus + equity. RSUs vs options. Vesting schedule.
- **JD Comp Signals** — Does the JD state a range? Is it competitive? Does "competitive compensation" mean below-market base?
- **Negotiation Leverage Points** — Urgency language, niche skill requirements, scarce talent market.
- **Your Target** — Suggested ask range (low / target / stretch) with rationale. Caveat: "This is a data-informed starting point, not financial advice."

Use levels.fyi and glassdoor-style knowledge. Never fabricate specific salary numbers — cite the source and date. If no data available, say so.`,
    extraInputs: ["compData"]
  },

  9: {
    title: "Strategic Challenges & First 90 Days",
    prompt: `Generate Section 9: Strategic Challenges & First 90 Days.

Walk into the interview with a hypothesis.

Output structure (use h3 for subsections):
- **Top 3 Strategic Challenges** — Derived from JD priorities, company stage, and competitive landscape. For each: the challenge (one sentence), why it matters now (one paragraph), evidence from JD or company context.
- **Your First 90 Days** — Realistic, phase-based plan:
  - Days 1-30: Listen and learn. What to understand? Who to talk to? What data to look at?
  - Days 31-60: Quick wins. What to ship or unblock?
  - Days 61-90: Strategic bets. What to propose to leadership?
- **Talking Points** — 2-3 specific things to say in the interview to demonstrate strategic thinking about THIS role at THIS company.

The 90-day plan should be realistic for the level. Avoid generic "build relationships" — focus on specifics from the JD and company context.`,
  },

  10: {
    title: "Culture & Values Decode",
    prompt: `Generate Section 10: Culture & Values Decode.

What this company ACTUALLY values — not just what the careers page says.

Output structure (use h3 for subsections):
- **Stated Values** — What the company says it values (careers page, mission statement). Listed with source.
- **Signals from the JD** — What the JD language implies. "Fast-paced" = long hours? "Collaborative" = consensus-driven? Decoded realistically.
- **Interview Style Signals** — What to expect: case study, system design, behavioral, portfolio review? Inferred from company size, stage, industry.
- **What Gets Rewarded** — Shipping fast or careful analysis? Builder or optimizer? Consensus or conviction?
- **Culture Fit Questions for You** — 3-4 questions the candidate should ask themselves.

Be nuanced. "Fast-paced" doesn't always mean burnout. Read signals in context of company stage, size, and industry.`,
  },

  11: {
    title: "Questions to Ask",
    prompt: `Generate Section 11: Questions to Ask.

Role-specific questions organized by interview round that demonstrate the candidate has done the homework.

Output structure (use h3 for subsections):
- **Recruiter Screen** (3-4 questions) — Logistics, process, timeline, team structure validation.
- **Hiring Manager** (4-5 questions) — Role-specific: what does success look like? Biggest challenge? What happened to the last person?
- **Technical / Panel** (3-4 questions) — Product/engineering-focused: tech stack decisions, product process.
- **Executive / Final Round** (3-4 questions) — Company direction, team investment, strategic priorities.
- **Back-pocket Questions** — 2-3 that work in any round.

Every question should be derivable from the brief's other sections. Generic questions ("tell me about the culture") should NEVER appear here. Reference specific JD requirements and company context.`,
  },

  12: {
    title: "TMAY Script",
    prompt: `Generate Section 12: TMAY Script.

A "Tell Me About Yourself" narrative built from the candidate's actual resume, positioned for this specific role.

Output structure (use h3 for subsections):
- **90-Second Version** — Tight version for recruiter screens. Arc: where you've been → what you're great at → why this role. MUST be speakable in 90 seconds (~225 words). Count them.
- **2-Minute Version** — Expanded for hiring manager rounds. Same arc with more detail: specific accomplishments, named companies, quantified impact. ~450 words.
- **Key Beats** — The 4-5 inflection points the script hits. For each: why it's included (maps to which JD requirement).
- **What to Skip** — Experience that should NOT be brought up unprompted for this role.
- **Transition Line** — How to end the TMAY: a bridge sentence connecting story to role.

The script should sound like a person talking, not a resume being read aloud. Use first person. Natural transitions. NOT "Subsequently, I transitioned to..."`,
    extraInputs: ["bulletBank"]
  },

  13: {
    title: "Likely Interview Questions",
    prompt: `Generate Section 13: Likely Interview Questions.

Predict what they'll ask and have an answer ready.

Output structure (use h3 for subsections):
- **Behavioral Questions** (5-7) — Derived from JD requirements and company values. For each: the likely question, why they'd ask it, and a matched STAR story from the story bank (or "No matching story — consider preparing one about [topic]").
- **Technical / Product Questions** (3-5) — Domain-specific: case studies, estimation, system design, strategy.
- **Role-Specific Curveballs** (2-3) — Unique to this role or company. "Why this company specifically?" "How would you handle [specific challenge]?"
- **Questions About Your Gaps** (1-3) — The ones that probe red/yellow items from the Fit Analysis. For each: likely question and a prepared answer that's honest but well-positioned.
- **Your Answer Framework** — For behavioral: STAR structure with specific stories selected. For technical: go-to frameworks.

Questions must be SPECIFIC to this role. Every question needs a "why they'd ask this" rationale tied to the JD or company context.`,
    extraInputs: ["bulletBank", "storyBank"]
  }
};


// ================================================================
// CONTEXT BUILDER — assembles the data block injected into each call
// ================================================================

export interface BriefContext {
  role: {
    id: string;
    title: string;
    company: string;
    url?: string;
    jdText?: string;
    positioning?: string;
    targetLevel?: string;
    stage?: string;
    dateAdded?: number;
    roleHints?: Record<string, string>;
    knownContext?: Array<{ date: string; source: string; note: string }>;
    recruiterSource?: string;
    confidential?: { company?: boolean; role?: boolean };
    interviewerNames?: string[];
    salary?: string;
  };
  company: {
    name: string;
    domain?: string;
    companyType?: string;
    fundingStage?: string;
    headcount?: string;
    missionStatement?: string;
    remotePolicy?: string;
    techStack?: string;
    culture?: string;
    glassdoor?: string;
  };
  connections?: Array<{
    name: string;
    company: string;
    title?: string;
    linkedinUrl?: string;
    relationship?: string;
    lastInteraction?: string;
  }>;
  bulletBank?: Array<{
    text: string;
    company?: string;
    impact?: string;
    tags?: string[];
  }>;
  storyBank?: Array<{
    title: string;
    situation?: string;
    task?: string;
    action?: string;
    result?: string;
    tags?: string[];
  }>;
  compData?: Record<string, unknown>;
}

/**
 * Builds the context block that gets injected into every Claude API call.
 * This is the "data payload" — role info, company info, JD text, connections, etc.
 */
export function buildContextBlock(ctx: BriefContext): string {
  const parts: string[] = [];

  // Role metadata
  parts.push(`<role>
  Title: ${ctx.role.title || "Unknown"}
  Company: ${ctx.role.company || "Unknown"}
  Level: ${ctx.role.targetLevel || "Not specified"}
  Positioning: ${ctx.role.positioning || "ic"}
  Stage: ${ctx.role.stage || "researching"}
  URL: ${ctx.role.url || "Not provided"}
  Date Added: ${ctx.role.dateAdded ? new Date(ctx.role.dateAdded).toISOString().split("T")[0] : "Unknown"}
  Salary Info: ${ctx.role.salary || "Not provided"}
</role>`);

  // Company metadata
  parts.push(`<company>
  Name: ${ctx.company.name || "Unknown"}
  Domain: ${ctx.company.domain || "Unknown"}
  Type: ${ctx.company.companyType || "Unknown"}
  Funding: ${ctx.company.fundingStage || "Unknown"}
  Headcount: ${ctx.company.headcount || "Unknown"}
  Mission: ${ctx.company.missionStatement || "Not provided"}
  Remote Policy: ${ctx.company.remotePolicy || "Not specified"}
  Tech Stack: ${ctx.company.techStack || "Not specified"}
</company>`);

  // JD text (the anchor for most sections)
  if (ctx.role.jdText) {
    parts.push(`<jd>\n${ctx.role.jdText}\n</jd>`);
  } else {
    parts.push(`<jd>No job description available. Use role hints and known context as a substitute.</jd>`);
  }

  // Role hints (when JD is absent, these are critical)
  if (ctx.role.roleHints && Object.keys(ctx.role.roleHints).length > 0) {
    const hints = Object.entries(ctx.role.roleHints)
      .filter(([, v]) => v)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");
    parts.push(`<role_hints>\n${hints}\n</role_hints>`);
  }

  // Known context log (recruiter intel)
  if (ctx.role.knownContext && ctx.role.knownContext.length > 0) {
    const entries = ctx.role.knownContext
      .map((e) => `  [${e.date}] (${e.source}) ${e.note}`)
      .join("\n");
    parts.push(`<known_context>\n${entries}\n</known_context>`);
  }

  // Recruiter source
  if (ctx.role.recruiterSource) {
    parts.push(`<recruiter_source>${ctx.role.recruiterSource}</recruiter_source>`);
  }

  // Confidential flags
  if (ctx.role.confidential) {
    parts.push(`<confidential>
  Company hidden: ${ctx.role.confidential.company ? "yes" : "no"}
  Role hidden: ${ctx.role.confidential.role ? "yes" : "no"}
</confidential>`);
  }

  return parts.join("\n\n");
}

/**
 * Builds extra input blocks for sections that need additional data.
 * Only includes data that the specific section requests.
 */
export function buildExtraInputs(ctx: BriefContext, sectionNum: number): string {
  const sectionDef = SECTION_PROMPTS[sectionNum];
  if (!sectionDef?.extraInputs) return "";

  const parts: string[] = [];

  if (sectionDef.extraInputs.includes("connections") && ctx.connections) {
    const connList = ctx.connections
      .map((c) => `  - ${c.name} | ${c.company} | ${c.title || "?"} | ${c.relationship || "unknown"} | LinkedIn: ${c.linkedinUrl || "N/A"}`)
      .join("\n");
    parts.push(`<connections>\n${connList || "  No connections data provided."}\n</connections>`);
  }

  if (sectionDef.extraInputs.includes("bulletBank") && ctx.bulletBank) {
    const bullets = ctx.bulletBank
      .map((b) => `  - [${b.company || "?"}] ${b.text}${b.impact ? ` (Impact: ${b.impact})` : ""}`)
      .join("\n");
    parts.push(`<bullet_bank>\n${bullets || "  No bullet bank data provided."}\n</bullet_bank>`);
  }

  if (sectionDef.extraInputs.includes("storyBank") && ctx.storyBank) {
    const stories = ctx.storyBank
      .map((s) => `  - "${s.title}" [${(s.tags || []).join(", ")}]`)
      .join("\n");
    parts.push(`<story_bank>\n${stories || "  No story bank data provided."}\n</story_bank>`);
  }

  if (sectionDef.extraInputs.includes("compData") && ctx.compData) {
    parts.push(`<comp_data>\n${JSON.stringify(ctx.compData, null, 2)}\n</comp_data>`);
  }

  if (sectionDef.extraInputs.includes("interviewerNames") && ctx.role.interviewerNames) {
    const names = ctx.role.interviewerNames.join(", ");
    parts.push(`<interviewer_names>${names || "None provided"}</interviewer_names>`);
  }

  if (sectionDef.extraInputs.includes("roleHints") && ctx.role.roleHints) {
    // Already included in base context, but re-emphasize for Section 0
  }

  if (sectionDef.extraInputs.includes("knownContext") && ctx.role.knownContext) {
    // Already included in base context, but re-emphasize for Section 0
  }

  if (sectionDef.extraInputs.includes("recruiterSource") && ctx.role.recruiterSource) {
    // Already included in base context
  }

  return parts.join("\n\n");
}


// ================================================================
// CLAUDE API CLIENT — makes the actual generation calls
// ================================================================

/** Citation record returned alongside generated content */
export interface Citation {
  n: number;
  claim: string;
  source: string;
  sourceType: "enrichment_web" | "job_board" | "manual_entry" | "ai_generated";
  url?: string;
  date?: string;
}

/** Result of generating a single section */
export interface GenerationResult {
  sectionNum: number;
  title: string;
  content: string;           // HTML content with [n] citation markers
  citations: Citation[];
  generatedAt: string;       // ISO timestamp
  inputsUsed: string[];      // Which data sources were available
  inputsMissing: string[];   // Which data sources were missing
  model: string;             // Which Claude model was used
}

/**
 * Parse Claude's response to extract HTML content and citations block.
 * The response format is: HTML content followed by <citations>[...]</citations>
 */
function parseGenerationResponse(text: string): { content: string; citations: Citation[] } {
  // Extract citations block if present
  const citationsMatch = text.match(/<citations>\s*([\s\S]*?)\s*<\/citations>/);
  let citations: Citation[] = [];
  let content = text;

  if (citationsMatch) {
    // Remove citations block from content
    content = text.replace(/<citations>[\s\S]*?<\/citations>/, "").trim();

    // Parse citations JSON
    try {
      citations = JSON.parse(citationsMatch[1]);
    } catch {
      // If citations JSON is malformed, return empty array
      console.error("Failed to parse citations JSON");
      citations = [];
    }
  }

  return { content, citations };
}

/**
 * Determine which inputs are available vs missing for a given context
 */
function analyzeInputs(ctx: BriefContext, sectionNum: number): { used: string[]; missing: string[] } {
  const used: string[] = [];
  const missing: string[] = [];

  // Core inputs
  if (ctx.role.jdText) used.push("jdText");
  else missing.push("jdText");

  if (ctx.role.title && ctx.role.title !== "Exploratory") used.push("roleTitle");
  else missing.push("roleTitle");

  if (ctx.company.name) used.push("companyName");
  else missing.push("companyName");

  if (ctx.company.fundingStage) used.push("fundingStage");
  else missing.push("fundingStage");

  // Section-specific inputs
  const sectionDef = SECTION_PROMPTS[sectionNum];
  if (sectionDef?.extraInputs) {
    if (sectionDef.extraInputs.includes("connections")) {
      if (ctx.connections && ctx.connections.length > 0) used.push("connections");
      else missing.push("connections");
    }
    if (sectionDef.extraInputs.includes("bulletBank")) {
      if (ctx.bulletBank && ctx.bulletBank.length > 0) used.push("bulletBank");
      else missing.push("bulletBank");
    }
    if (sectionDef.extraInputs.includes("storyBank")) {
      if (ctx.storyBank && ctx.storyBank.length > 0) used.push("storyBank");
      else missing.push("storyBank");
    }
    if (sectionDef.extraInputs.includes("compData")) {
      if (ctx.compData && Object.keys(ctx.compData).length > 0) used.push("compData");
      else missing.push("compData");
    }
    if (sectionDef.extraInputs.includes("interviewerNames")) {
      if (ctx.role.interviewerNames && ctx.role.interviewerNames.length > 0) used.push("interviewerNames");
      else missing.push("interviewerNames");
    }
  }

  return { used, missing };
}


/**
 * Generate a single research brief section using the Claude API.
 *
 * @param apiKey - Anthropic API key
 * @param sectionNum - Section number (0-13)
 * @param ctx - Full context (role, company, connections, bullets, stories, comp data)
 * @param previousSections - Output from previously generated sections (for dependent sections)
 * @param model - Claude model to use (default: claude-sonnet-4-20250514)
 * @returns GenerationResult with HTML content, citations, and metadata
 */
export async function generateBriefSection(
  apiKey: string,
  sectionNum: number,
  ctx: BriefContext,
  previousSections?: Record<number, string>,
  model: string = "claude-sonnet-4-20250514"
): Promise<GenerationResult> {
  const sectionDef = SECTION_PROMPTS[sectionNum];
  if (!sectionDef) {
    throw new Error(`Unknown section number: ${sectionNum}. Valid sections are 0-13.`);
  }

  // Build the user message: context block + extra inputs + section prompt
  const contextBlock = buildContextBlock(ctx);
  const extraInputs = buildExtraInputs(ctx, sectionNum);

  // Include previously generated sections if this section depends on them
  let previousSectionsBlock = "";
  if (previousSections && Object.keys(previousSections).length > 0) {
    const prevEntries = Object.entries(previousSections)
      .map(([num, content]) => {
        const prevDef = SECTION_PROMPTS[parseInt(num)];
        return `<previous_section num="${num}" title="${prevDef?.title || "Unknown"}">\n${content}\n</previous_section>`;
      })
      .join("\n\n");
    previousSectionsBlock = `\n\n<previously_generated_sections>\n${prevEntries}\n</previously_generated_sections>`;
  }

  const userMessage = `${contextBlock}\n\n${extraInputs}${previousSectionsBlock}\n\n---\n\n${sectionDef.prompt}`;

  // Analyze inputs
  const { used, missing } = analyzeInputs(ctx, sectionNum);

  // Make the API call
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userMessage }
    ]
  });

  // Extract text from response
  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Parse HTML content and citations
  const { content, citations } = parseGenerationResponse(responseText);

  return {
    sectionNum,
    title: sectionDef.title,
    content,
    citations,
    generatedAt: new Date().toISOString(),
    inputsUsed: used,
    inputsMissing: missing,
    model,
  };
}
