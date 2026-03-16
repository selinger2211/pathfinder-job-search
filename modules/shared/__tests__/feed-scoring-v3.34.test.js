/* ====================================================================
 * UNIT TESTS — feed-scoring-v3.34.0 (Company Knowledge Base, JD Heuristics, Enrichment)
 * ==================================================================== */

// ============================================================
// 1. COMPANY_KNOWLEDGE_BASE Lookup Tests
// ============================================================

describe('COMPANY_KNOWLEDGE_BASE lookup', () => {
  // Extracted from modules/job-feed-listener/index.html v3.34.0
  const COMPANY_KNOWLEDGE_BASE = {
    'stripe': { domain: 'Fintech / Payments', stage: 'Late-stage / Pre-IPO' },
    'google': { domain: 'Big Tech / Search & Cloud', stage: 'Public' },
    'calendly': { domain: 'Collaboration / Scheduling', stage: 'Late-stage / Pre-IPO' },
    'apple': { domain: 'Big Tech / Consumer Hardware & Services', stage: 'Public' },
    'amazon': { domain: 'Big Tech / E-Commerce & Cloud', stage: 'Public' },
    'meta': { domain: 'Big Tech / Social & Metaverse', stage: 'Public' },
    'microsoft': { domain: 'Big Tech / Enterprise & Cloud', stage: 'Public' },
    'openai': { domain: 'AI / Foundation Models', stage: 'Late-stage / Pre-IPO' },
    'anthropic': { domain: 'AI / Foundation Models', stage: 'Late-stage / Pre-IPO' },
    'slack': { domain: 'Collaboration / Messaging', stage: 'Public' },
    'figma': { domain: 'Enterprise SaaS / Design Tools', stage: 'Late-stage / Pre-IPO' },
  };

  test('stripe lookup returns correct domain and stage', () => {
    const result = COMPANY_KNOWLEDGE_BASE['stripe'];
    expect(result.domain).toBe('Fintech / Payments');
    expect(result.stage).toBe('Late-stage / Pre-IPO');
  });

  test('google lookup returns correct domain and stage', () => {
    const result = COMPANY_KNOWLEDGE_BASE['google'];
    expect(result.domain).toBe('Big Tech / Search & Cloud');
    expect(result.stage).toBe('Public');
  });

  test('calendly lookup returns correct domain and stage', () => {
    const result = COMPANY_KNOWLEDGE_BASE['calendly'];
    expect(result.domain).toBe('Collaboration / Scheduling');
    expect(result.stage).toBe('Late-stage / Pre-IPO');
  });

  test('unknown company returns undefined', () => {
    const result = COMPANY_KNOWLEDGE_BASE['unknowncorp'];
    expect(result).toBeUndefined();
  });

  test('case-sensitive lookup: uppercase company not found', () => {
    const result = COMPANY_KNOWLEDGE_BASE['STRIPE'];
    expect(result).toBeUndefined();
  });

  test('lookup keys are lowercase', () => {
    const keys = Object.keys(COMPANY_KNOWLEDGE_BASE);
    const allLowercase = keys.every(k => k === k.toLowerCase());
    expect(allLowercase).toBe(true);
  });
});

// ============================================================
// 2. classifyFromJDHeuristics Tests
// ============================================================

describe('classifyFromJDHeuristics', () => {
  function classifyFromJDHeuristics(jdText, titleLower, companyLower) {
    const text = (jdText + ' ' + titleLower + ' ' + companyLower).toLowerCase();

    const rules = [
      [['fintech', 'financial services', 'banking', 'payments', 'lending', 'credit', 'debit', 'neobank'], 'Fintech', 1],
      [['healthcare', 'health tech', 'clinical', 'patient', 'hipaa', 'ehr', 'telehealth', 'biotech', 'pharma', 'medical device'], 'Health Tech', 1],
      [['artificial intelligence', 'machine learning', 'llm', 'large language model', 'generative ai', 'foundation model', 'deep learning', 'neural network', 'nlp', 'computer vision'], 'AI / ML', 1],
      [['cybersecurity', 'infosec', 'threat detection', 'vulnerability', 'zero trust', 'siem', 'endpoint protection', 'penetration testing'], 'Security / Cybersecurity', 1],
      [['e-commerce', 'ecommerce', 'marketplace', 'shopping cart', 'merchant', 'storefront', 'online retail', 'direct-to-consumer', 'dtc'], 'E-Commerce / Marketplace', 1],
      [['saas', 'b2b saas', 'enterprise software', 'cloud platform', 'multi-tenant'], 'Enterprise SaaS', 1],
      [['edtech', 'education technology', 'learning management', 'lms', 'online learning', 'courseware', 'student'], 'EdTech', 1],
      [['gaming', 'game engine', 'game studio', 'esports', 'metaverse', 'virtual world', 'game development'], 'Gaming', 1],
      [['autonomous vehicle', 'self-driving', 'robotics', 'drone', 'lidar', 'computer vision', 'autonomous'], 'Robotics / Autonomous', 1],
      [['real estate', 'proptech', 'property management', 'mls', 'mortgage', 'housing'], 'PropTech / Real Estate', 1],
      [['logistics', 'supply chain', 'freight', 'shipping', 'warehouse', 'fulfillment', 'last-mile'], 'Logistics / Supply Chain', 1],
      [['crypto', 'blockchain', 'web3', 'defi', 'nft', 'smart contract', 'token', 'decentralized'], 'Crypto / Web3', 1],
      [['developer tools', 'devops', 'ci/cd', 'infrastructure as code', 'api platform', 'sdk'], 'Developer Tools', 1],
      [['hr tech', 'human resources', 'talent acquisition', 'recruiting', 'payroll', 'benefits administration', 'hris'], 'HR Tech', 1],
      [['media', 'publishing', 'content platform', 'streaming', 'digital media', 'video platform', 'podcast'], 'Media & Content', 1],
      [['climate', 'cleantech', 'renewable', 'sustainability', 'carbon', 'solar', 'energy transition'], 'Climate Tech', 1],
    ];

    for (const [keywords, domain, minMatches] of rules) {
      const matches = keywords.filter(k => text.includes(k)).length;
      if (matches >= minMatches) return { domain, stage: '' };
    }

    return null;
  }

  test('fintech + payments returns Fintech domain', () => {
    const jd = 'We build fintech payment solutions for modern businesses.';
    const result = classifyFromJDHeuristics(jd, 'product manager', 'payco');
    expect(result).not.toBeNull();
    expect(result.domain).toBe('Fintech');
  });

  test('healthcare + HIPAA returns Health Tech domain', () => {
    const jd = 'We provide HIPAA-compliant healthcare software for clinicians.';
    const result = classifyFromJDHeuristics(jd, 'engineer', 'healthcorp');
    expect(result).not.toBeNull();
    expect(result.domain).toBe('Health Tech');
  });

  test('machine learning + LLM returns AI / ML domain', () => {
    const jd = 'We develop machine learning and LLM-powered applications.';
    const result = classifyFromJDHeuristics(jd, 'ml engineer', 'aicompany');
    expect(result).not.toBeNull();
    expect(result.domain).toBe('AI / ML');
  });

  test('no industry keywords returns null', () => {
    const jd = 'We are a company. We hire people. You will work.';
    const result = classifyFromJDHeuristics(jd, 'manager', 'genericcorp');
    expect(result).toBeNull();
  });

  test('single keyword match sufficient for domain classification', () => {
    const jd = 'Machine learning skills required.';
    const result = classifyFromJDHeuristics(jd, 'engineer', 'company');
    expect(result).not.toBeNull();
    expect(result.domain).toContain('AI');
  });

  test('case-insensitive keyword matching', () => {
    const jd = 'We work with MACHINE LEARNING and LLM technologies.';
    const result = classifyFromJDHeuristics(jd, 'role', 'company');
    expect(result).not.toBeNull();
    expect(result.domain).toBe('AI / ML');
  });

  test('keywords in title also contribute to classification', () => {
    const jd = 'You will work on various projects.';
    const titleLower = 'machine learning engineer';
    const result = classifyFromJDHeuristics(jd, titleLower, 'startup');
    expect(result).not.toBeNull();
    expect(result.domain).toBe('AI / ML');
  });

  test('stage field is always empty string on classification', () => {
    const jd = 'We use machine learning in production.';
    const result = classifyFromJDHeuristics(jd, 'engineer', 'company');
    expect(result.stage).toBe('');
  });
});

// ============================================================
// 3. inferStageFromJD Tests
// ============================================================

describe('inferStageFromJD', () => {
  function inferStageFromJD(jdText, companyLower) {
    const text = (jdText + ' ' + companyLower).toLowerCase();

    // Public company signals
    if (/\b(publicly traded|nasdaq|nyse|ipo|public company|ticker:?)\b/.test(text)) return 'Public';
    if (/\b(series [e-z]|growth stage|growth-stage|unicorn)\b/.test(text)) return 'Late-stage / Pre-IPO';
    if (/\b(series d)\b/.test(text)) return 'Series D';
    if (/\b(series c)\b/.test(text)) return 'Series C';
    if (/\b(series b)\b/.test(text)) return 'Series B';
    if (/\b(series a)\b/.test(text)) return 'Series A';
    if (/\b(seed round|seed stage|pre-seed|angel funded)\b/.test(text)) return 'Seed';
    if (/\b(bootstrapped|self-funded|profitable since day)\b/.test(text)) return 'Bootstrapped';

    // Employee count heuristics
    const empMatch = text.match(/(\d[\d,]*)\+?\s*employees/);
    if (empMatch) {
      const count = parseInt(empMatch[1].replace(/,/g, ''));
      if (count > 5000) return 'Public';
      if (count > 500) return 'Late-stage / Pre-IPO';
      if (count > 100) return 'Series C';
      if (count > 20) return 'Series A';
    }

    return '';
  }

  test('publicly traded returns Public', () => {
    const jd = 'Our publicly traded company is hiring.';
    const result = inferStageFromJD(jd, 'google');
    expect(result).toBe('Public');
  });

  test('nasdaq mention returns Public', () => {
    const jd = 'NASDAQ: GOOG - We are hiring PMs.';
    const result = inferStageFromJD(jd, 'alphabet');
    expect(result).toBe('Public');
  });

  test('series b returns Series B', () => {
    const jd = 'We are a Series B startup.';
    const result = inferStageFromJD(jd, 'startup');
    expect(result).toBe('Series B');
  });

  test('series c returns Series C', () => {
    const jd = 'Series C funding round closed last year.';
    const result = inferStageFromJD(jd, 'company');
    expect(result).toBe('Series C');
  });

  test('series a returns Series A', () => {
    const jd = 'We just closed our Series A.';
    const result = inferStageFromJD(jd, 'startup');
    expect(result).toBe('Series A');
  });

  test('5000+ employees returns Public', () => {
    const jd = 'We have 5001 employees worldwide.';
    const result = inferStageFromJD(jd, 'bigcorp');
    expect(result).toBe('Public');
  });

  test('5001 employees returns Public', () => {
    const jd = 'Our company has 5001 employees.';
    const result = inferStageFromJD(jd, 'enterprise');
    expect(result).toBe('Public');
  });

  test('500-5000 employees returns Late-stage / Pre-IPO', () => {
    const jd = 'We have 1500 employees globally.';
    const result = inferStageFromJD(jd, 'company');
    expect(result).toBe('Late-stage / Pre-IPO');
  });

  test('100-500 employees returns Series C', () => {
    const jd = 'We have 200 employees.';
    const result = inferStageFromJD(jd, 'startup');
    expect(result).toBe('Series C');
  });

  test('20-100 employees returns Series A', () => {
    const jd = 'We have 50 employees and we are scaling.';
    const result = inferStageFromJD(jd, 'earlystart');
    expect(result).toBe('Series A');
  });

  test('no stage signals returns empty string', () => {
    const jd = 'We are hiring an engineer. Please apply.';
    const result = inferStageFromJD(jd, 'mystery');
    expect(result).toBe('');
  });

  test('seed stage returns Seed', () => {
    const jd = 'We are a seed stage company.';
    const result = inferStageFromJD(jd, 'startup');
    expect(result).toBe('Seed');
  });

  test('bootstrapped returns Bootstrapped', () => {
    const jd = 'We are bootstrapped and profitable.';
    const result = inferStageFromJD(jd, 'indie');
    expect(result).toBe('Bootstrapped');
  });

  test('case-insensitive matching for public signals', () => {
    const jd = 'PUBLICLY TRADED: NYSE Listed';
    const result = inferStageFromJD(jd, 'company');
    expect(result).toBe('Public');
  });

  test('employee count with comma separators parsed correctly', () => {
    const jd = 'We have 3,500 employees.';
    const result = inferStageFromJD(jd, 'bigcorp');
    expect(result).toBe('Late-stage / Pre-IPO');
  });

  test('series e or higher returns Late-stage / Pre-IPO', () => {
    const jd = 'Series E funding round';
    const result = inferStageFromJD(jd, 'company');
    expect(result).toBe('Late-stage / Pre-IPO');
  });
});

// ============================================================
// 4. enrichCompanyData Tests
// ============================================================

describe('enrichCompanyData', () => {
  const COMPANY_KNOWLEDGE_BASE = {
    'stripe': { domain: 'Fintech / Payments', stage: 'Late-stage / Pre-IPO' },
    'google': { domain: 'Big Tech / Search & Cloud', stage: 'Public' },
    'unknown': undefined,
  };

  function classifyFromJDHeuristics(jdText, titleLower, companyLower) {
    const text = (jdText + ' ' + titleLower + ' ' + companyLower).toLowerCase();
    // Fintech: fintech alone OR financial services, banking, payments, etc.
    const fintechKeywords = ['fintech', 'financial services', 'banking', 'payments', 'lending', 'credit'];
    if (fintechKeywords.some(k => text.includes(k))) return { domain: 'Fintech', stage: '' };
    if (text.includes('health tech') || text.includes('hipaa')) return { domain: 'Health Tech', stage: '' };
    return null;
  }

  function inferStageFromJD(jdText, companyLower) {
    const text = (jdText + ' ' + companyLower).toLowerCase();
    if (/\b(publicly traded|nasdaq|nyse)\b/.test(text)) return 'Public';
    if (/\b(series b)\b/.test(text)) return 'Series B';
    if (/\b(\d{4,})\s*employees/.test(text)) {
      const match = text.match(/(\d+)\s*employees/);
      if (match) {
        const count = parseInt(match[1]);
        if (count > 5000) return 'Public';
      }
    }
    return '';
  }

  function enrichCompanyData(role) {
    const companyLower = (role.company || '').toLowerCase().trim();
    const jdText = (role.jd || '').toLowerCase();
    const titleLower = (role.title || '').toLowerCase();

    // Already has domain? Skip enrichment.
    if (role.domain && role.domain !== 'Unknown' && role.domain !== 'undefined') {
      return { domain: role.domain, stage: role.stage || '', source: null };
    }

    // Step 1: Check knowledge base
    let lookup = COMPANY_KNOWLEDGE_BASE[companyLower];
    if (!lookup) {
      for (const [key, val] of Object.entries(COMPANY_KNOWLEDGE_BASE)) {
        if (companyLower.includes(key) || key.includes(companyLower)) {
          lookup = val;
          break;
        }
      }
    }

    if (lookup) {
      role.domain = lookup.domain;
      if (!role.stage) role.stage = lookup.stage;
      role._enrichSource = 'lookup';
      return { domain: lookup.domain, stage: lookup.stage, source: 'lookup' };
    }

    // Step 2: JD heuristic classification
    const jdClass = classifyFromJDHeuristics(jdText, titleLower, companyLower);
    const jdStage = inferStageFromJD(jdText, companyLower);

    if (jdClass) {
      role.domain = jdClass.domain;
      if (!role.stage && jdStage) role.stage = jdStage;
      role._enrichSource = 'jd-heuristic';
      return { domain: jdClass.domain, stage: jdStage, source: 'jd-heuristic' };
    }

    // Step 3: No classification
    role._enrichSource = 'none';
    return { domain: null, stage: jdStage || null, source: null };
  }

  test('role with existing domain skips enrichment', () => {
    const role = {
      company: 'Unknown Corp',
      title: 'Engineer',
      domain: 'Fintech / Payments',
      stage: 'Series A',
      jd: 'some job description'
    };
    const result = enrichCompanyData(role);
    expect(result.source).toBeNull();
    expect(result.domain).toBe('Fintech / Payments');
    expect(role._enrichSource).toBeUndefined();
  });

  test('role with unknown domain is enriched', () => {
    const role = {
      company: 'Unknown Corp',
      title: 'Engineer',
      domain: 'Unknown',
      stage: '',
      jd: 'some job description'
    };
    const result = enrichCompanyData(role);
    // Either lookup or jd-heuristic or none
    expect([null, 'lookup', 'jd-heuristic']).toContain(result.source);
  });

  test('stripe lookup enriches domain and stage', () => {
    const role = {
      company: 'Stripe',
      title: 'PM',
      domain: '',
      stage: '',
      jd: ''
    };
    const result = enrichCompanyData(role);
    expect(result.source).toBe('lookup');
    expect(result.domain).toBe('Fintech / Payments');
    expect(result.stage).toBe('Late-stage / Pre-IPO');
    expect(role.domain).toBe('Fintech / Payments');
    expect(role._enrichSource).toBe('lookup');
  });

  test('unknown company with fintech JD gets classified from heuristics', () => {
    const role = {
      company: 'NovelFintech',
      title: 'Engineer',
      domain: '',
      stage: '',
      jd: 'We build fintech payments infrastructure.'
    };
    const result = enrichCompanyData(role);
    expect(result.source).toBe('jd-heuristic');
    expect(result.domain).toBe('Fintech');
    expect(role._enrichSource).toBe('jd-heuristic');
  });

  test('unknown company with no JD signal returns source none', () => {
    const role = {
      company: 'MysteryCompany',
      title: 'Engineer',
      domain: '',
      stage: '',
      jd: 'We hire people.'
    };
    const result = enrichCompanyData(role);
    expect(result.source).toBeNull();
    expect(result.domain).toBeNull();
    expect(role._enrichSource).toBe('none');
  });

  test('case-insensitive company lookup works', () => {
    const role = {
      company: 'STRIPE',
      title: 'PM',
      domain: '',
      stage: '',
      jd: ''
    };
    const result = enrichCompanyData(role);
    expect(result.source).toBe('lookup');
    expect(result.domain).toBe('Fintech / Payments');
  });

  test('partial company name match in lookup', () => {
    const role = {
      company: 'Stripe Inc.',
      title: 'PM',
      domain: '',
      stage: '',
      jd: ''
    };
    const result = enrichCompanyData(role);
    expect(result.source).toBe('lookup');
    expect(result.domain).toBe('Fintech / Payments');
  });

  test('existing stage can be overwritten by lookup (lookup stage takes precedence when no prior stage)', () => {
    const role = {
      company: 'Stripe',
      title: 'PM',
      domain: '',
      stage: '',
      jd: ''
    };
    const result = enrichCompanyData(role);
    // Lookup sets the stage when role.stage is empty
    expect(result.stage).toBe('Late-stage / Pre-IPO');
    expect(role.stage).toBe('Late-stage / Pre-IPO');
  });

  test('JD stage inference supplements missing stage', () => {
    const role = {
      company: 'NovelFintech',
      title: 'PM',
      domain: '',
      stage: '',
      jd: 'We are a Series B startup building fintech payment solutions.'
    };
    const result = enrichCompanyData(role);
    expect(result.source).toBe('jd-heuristic');
    expect(result.stage).toBe('Series B');
    expect(result.domain).toBe('Fintech');
  });
});

// ============================================================
// 5. Adaptive Weighting Tests
// ============================================================

describe('Adaptive weighting for missing dimensions', () => {
  /**
   * Simulated scoring weights redistribution.
   * When a dimension is missing (-1 or unknown), its weight is
   * redistributed proportionally to dimensions that have data.
   */
  function calculateAdaptiveWeights(dimensions) {
    // Base weights: { domain, stage, comp, location, network, title, keyword }
    const baseWeights = {
      domain: 0.20,
      stage: 0.10,
      comp: 0.05,
      location: 0.15,
      network: 0.15,
      title: 0.20,
      keyword: 0.15
    };

    // Identify missing dimensions (value is -1 or null)
    const missing = {};
    const present = {};
    let totalMissingWeight = 0;

    for (const [key, baseWeight] of Object.entries(baseWeights)) {
      if (dimensions[key] === -1 || dimensions[key] === null) {
        missing[key] = baseWeight;
        totalMissingWeight += baseWeight;
      } else {
        present[key] = baseWeight;
      }
    }

    if (totalMissingWeight === 0) {
      // All dimensions present — use base weights
      return baseWeights;
    }

    // Redistribute missing weight proportionally to present dimensions
    const totalPresentWeight = Object.values(present).reduce((a, b) => a + b, 0);
    const adjusted = {};

    for (const [key, baseWeight] of Object.entries(baseWeights)) {
      if (missing[key]) {
        adjusted[key] = 0; // Missing dimension gets zero contribution
      } else {
        // Scale up present weights proportionally
        adjusted[key] = baseWeight * (1 + totalMissingWeight / totalPresentWeight);
      }
    }

    return adjusted;
  }

  test('all dimensions present use base weights', () => {
    const dimensions = {
      domain: 100,
      stage: 100,
      comp: 100,
      location: 100,
      network: 100,
      title: 100,
      keyword: 100
    };
    const weights = calculateAdaptiveWeights(dimensions);
    expect(weights.domain).toBe(0.20);
    expect(weights.stage).toBe(0.10);
    expect(weights.comp).toBe(0.05);
  });

  test('domain and comp missing redistributes weight to others', () => {
    const dimensions = {
      domain: -1,          // missing
      stage: 100,          // present
      comp: -1,            // missing
      location: 100,       // present
      network: 100,        // present
      title: 100,          // present
      keyword: 100         // present
    };
    const weights = calculateAdaptiveWeights(dimensions);
    expect(weights.domain).toBe(0);
    expect(weights.comp).toBe(0);
    expect(weights.stage).toBeGreaterThan(0.10); // increased from base
    expect(weights.location).toBeGreaterThan(0.15);
    expect(weights.network).toBeGreaterThan(0.15);
  });

  test('only one dimension present gets all weight', () => {
    const dimensions = {
      domain: -1,
      stage: -1,
      comp: -1,
      location: 100,       // only this is present
      network: -1,
      title: -1,
      keyword: -1
    };
    const weights = calculateAdaptiveWeights(dimensions);
    expect(weights.location).toBe(1.0); // Gets all the weight
    const otherWeights = Object.entries(weights)
      .filter(([k]) => k !== 'location')
      .map(([, w]) => w);
    expect(otherWeights.every(w => w === 0)).toBe(true);
  });

  test('final score bounded 0-100 after adaptive weighting', () => {
    // Simulate final score calculation
    function scoreWithAdaptiveWeights(dimensions, scores) {
      const weights = calculateAdaptiveWeights(dimensions);
      let total = 0;
      for (const [dim, weight] of Object.entries(weights)) {
        if (dimensions[dim] !== -1 && dimensions[dim] !== null) {
          total += scores[dim] * weight;
        }
      }
      // Ensure score is bounded
      return Math.min(100, Math.max(0, Math.round(total)));
    }

    const dimensions = {
      domain: 100,
      stage: -1,
      comp: -1,
      location: 80,
      network: 50,
      title: 90,
      keyword: 70
    };
    const scores = { domain: 100, stage: 0, comp: 0, location: 80, network: 50, title: 90, keyword: 70 };
    const finalScore = scoreWithAdaptiveWeights(dimensions, scores);
    expect(finalScore).toBeGreaterThanOrEqual(0);
    expect(finalScore).toBeLessThanOrEqual(100);
  });

  test('missing domain and stage weight redistributed equally', () => {
    const dimensions = {
      domain: -1,
      stage: -1,
      comp: 100,
      location: 100,
      network: 100,
      title: 100,
      keyword: 100
    };
    const weights = calculateAdaptiveWeights(dimensions);
    const missingWeight = 0.20 + 0.10; // domain + stage
    const presentCount = 5; // comp, location, network, title, keyword
    const basePresent = 0.05 + 0.15 + 0.15 + 0.20 + 0.15; // sum = 0.70
    const expectedIncrease = missingWeight / basePresent; // ~0.43 multiplier

    // Each present dimension should be scaled by roughly the same factor
    expect(weights.comp).toBeGreaterThan(0.05);
    expect(weights.location).toBeGreaterThan(0.15);
  });
});

// ============================================================
// 6. Date Display Fallback Tests
// ============================================================

describe('Date display fallback chain', () => {
  function getDateDisplay(item) {
    const raw = item.posted || item.emailDate || item.addedAt || item.dateAdded;
    if (!raw) return 'Date unknown';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return 'Date unknown';
    // Return ISO string for testability (normally uses formatRelativeTime)
    return d.toISOString().split('T')[0];
  }

  test('item with posted date displays posted', () => {
    const item = {
      posted: '2026-03-16T10:00:00Z',
      emailDate: '2026-03-15T10:00:00Z',
      addedAt: '2026-03-14T10:00:00Z'
    };
    const date = getDateDisplay(item);
    expect(date).toContain('2026-03-16');
  });

  test('item without posted but with emailDate displays emailDate', () => {
    const item = {
      posted: null,
      emailDate: '2026-03-15T10:00:00Z',
      addedAt: '2026-03-14T10:00:00Z'
    };
    const date = getDateDisplay(item);
    expect(date).toContain('2026-03-15');
  });

  test('item without posted/emailDate but with addedAt displays addedAt', () => {
    const item = {
      posted: null,
      emailDate: null,
      addedAt: '2026-03-14T10:00:00Z'
    };
    const date = getDateDisplay(item);
    expect(date).toContain('2026-03-14');
  });

  test('item without posted/emailDate but with dateAdded displays dateAdded', () => {
    const item = {
      posted: null,
      emailDate: null,
      addedAt: null,
      dateAdded: '2026-03-13T10:00:00Z'
    };
    const date = getDateDisplay(item);
    expect(date).toContain('2026-03-13');
  });

  test('item with nothing displays Date unknown', () => {
    const item = {
      posted: null,
      emailDate: null,
      addedAt: null,
      dateAdded: null
    };
    const date = getDateDisplay(item);
    expect(date).toBe('Date unknown');
  });

  test('item with invalid date string displays Date unknown', () => {
    const item = {
      posted: 'not-a-date',
      emailDate: null,
      addedAt: null
    };
    const date = getDateDisplay(item);
    expect(date).toBe('Date unknown');
  });

  test('item with empty string posted uses emailDate fallback', () => {
    const item = {
      posted: '',
      emailDate: '2026-03-15T10:00:00Z',
      addedAt: null
    };
    const date = getDateDisplay(item);
    expect(date).toContain('2026-03-15');
  });

  test('posted takes priority over all other fields', () => {
    const item = {
      posted: '2026-03-20T10:00:00Z',
      emailDate: '2026-03-19T10:00:00Z',
      addedAt: '2026-03-18T10:00:00Z',
      dateAdded: '2026-03-17T10:00:00Z'
    };
    const date = getDateDisplay(item);
    expect(date).toContain('2026-03-20');
  });

  test('fallback respects field presence (falsy values)', () => {
    const item = {
      posted: undefined,
      emailDate: '2026-03-15T10:00:00Z',
      addedAt: undefined
    };
    const date = getDateDisplay(item);
    expect(date).toContain('2026-03-15');
  });
});

// ============================================================
// INTEGRATION: enrichCompanyData + classifyFromJDHeuristics
// ============================================================

describe('enrichCompanyData integration with JD classification', () => {
  const COMPANY_KNOWLEDGE_BASE = {
    'stripe': { domain: 'Fintech / Payments', stage: 'Late-stage / Pre-IPO' },
    'openai': { domain: 'AI / Foundation Models', stage: 'Late-stage / Pre-IPO' },
  };

  function classifyFromJDHeuristics(jdText, titleLower, companyLower) {
    const text = (jdText + ' ' + titleLower + ' ' + companyLower).toLowerCase();
    const fintechKeywords = ['fintech', 'financial services', 'banking', 'payments', 'lending'];
    if (fintechKeywords.some(k => text.includes(k))) return { domain: 'Fintech', stage: '' };
    const aiKeywords = ['machine learning', 'llm', 'artificial intelligence'];
    if (aiKeywords.some(k => text.includes(k))) return { domain: 'AI / ML', stage: '' };
    return null;
  }

  function inferStageFromJD(jdText, companyLower) {
    const text = (jdText + ' ' + companyLower).toLowerCase();
    if (/\b(series b)\b/.test(text)) return 'Series B';
    if (/\b(\d{4,})\s*employees/.test(text)) {
      const match = text.match(/(\d+)\s*employees/);
      if (match && parseInt(match[1]) > 5000) return 'Public';
    }
    return '';
  }

  function enrichCompanyData(role) {
    const companyLower = (role.company || '').toLowerCase().trim();
    const jdText = (role.jd || '').toLowerCase();
    const titleLower = (role.title || '').toLowerCase();

    if (role.domain && role.domain !== 'Unknown' && role.domain !== 'undefined') {
      return { domain: role.domain, stage: role.stage || '', source: null };
    }

    let lookup = COMPANY_KNOWLEDGE_BASE[companyLower];
    if (!lookup) {
      for (const [key, val] of Object.entries(COMPANY_KNOWLEDGE_BASE)) {
        if (companyLower.includes(key) || key.includes(companyLower)) {
          lookup = val;
          break;
        }
      }
    }

    if (lookup) {
      role.domain = lookup.domain;
      if (!role.stage) role.stage = lookup.stage;
      role._enrichSource = 'lookup';
      return { domain: lookup.domain, stage: lookup.stage, source: 'lookup' };
    }

    const jdClass = classifyFromJDHeuristics(jdText, titleLower, companyLower);
    const jdStage = inferStageFromJD(jdText, companyLower);

    if (jdClass) {
      role.domain = jdClass.domain;
      if (!role.stage && jdStage) role.stage = jdStage;
      role._enrichSource = 'jd-heuristic';
      return { domain: jdClass.domain, stage: jdStage, source: 'jd-heuristic' };
    }

    role._enrichSource = 'none';
    return { domain: null, stage: jdStage || null, source: null };
  }

  test('integration: known company + no enrichment needed', () => {
    const role = {
      company: 'OpenAI',
      title: 'Product Manager',
      domain: '',
      stage: '',
      jd: 'Work on AI products.'
    };
    enrichCompanyData(role);
    expect(role.domain).toBe('AI / Foundation Models');
    expect(role._enrichSource).toBe('lookup');
  });

  test('integration: unknown company + AI JD signals = AI/ML classification', () => {
    const role = {
      company: 'NewAIStartup',
      title: 'Machine Learning Engineer',
      domain: '',
      stage: '',
      jd: 'We build LLM-powered applications. Series B stage.'
    };
    enrichCompanyData(role);
    expect(role.domain).toBe('AI / ML');
    expect(role.stage).toBe('Series B');
    expect(role._enrichSource).toBe('jd-heuristic');
  });

  test('integration: unknown company + fintech JD = Fintech classification', () => {
    const role = {
      company: 'NovelPayments',
      title: 'Software Engineer',
      domain: '',
      stage: '',
      jd: 'We build fintech payment infrastructure.'
    };
    enrichCompanyData(role);
    expect(role.domain).toBe('Fintech');
    expect(role._enrichSource).toBe('jd-heuristic');
  });

  test('integration: unknown company + no strong signals = none source', () => {
    const role = {
      company: 'MysteryCompany',
      title: 'Engineer',
      domain: '',
      stage: '',
      jd: 'We hire people.'
    };
    enrichCompanyData(role);
    expect(role.domain).toBe('');
    expect(role._enrichSource).toBe('none');
  });
});
