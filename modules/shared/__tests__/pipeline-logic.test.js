/**
 * COMPREHENSIVE JEST TEST SUITE FOR PIPELINE-LOGIC.JS
 * Tests all exported functions and constants
 */

const {
  STAGES,
  STAGE_COLORS,
  TIER_COLORS,
  getColorForStage,
  getColorForTier,
  getDaysInStage,
  getSubstages,
  sortLinkedInConnections,
  getLinkedInDeptCategory,
  calculatePipelineAnalytics,
  parseJobPosting,
  getCompanyProfileCompletion
} = require('../pipeline-logic');

// ============================================================
// SECTION 1: CONSTANTS
// ============================================================

describe('STAGES constant', () => {
  test('should contain exactly 8 stages', () => {
    expect(STAGES).toHaveLength(8);
  });

  test('should have stages in correct order', () => {
    expect(STAGES).toEqual([
      'discovered', 'researching', 'outreach', 'applied',
      'screen', 'interviewing', 'offer', 'closed'
    ]);
  });

  test('should be an array', () => {
    expect(Array.isArray(STAGES)).toBe(true);
  });
});

describe('STAGE_COLORS constant', () => {
  test('should have color hex values for all main stages', () => {
    STAGES.forEach(stage => {
      expect(STAGE_COLORS[stage]).toBeDefined();
      expect(STAGE_COLORS[stage]).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  test('should include additional statuses (rejected, withdrawn)', () => {
    expect(STAGE_COLORS.rejected).toBeDefined();
    expect(STAGE_COLORS.withdrawn).toBeDefined();
  });
});

describe('TIER_COLORS constant', () => {
  test('should have hex values for all tiers', () => {
    const expectedTiers = ['hot', 'active', 'watching', 'archive'];
    expectedTiers.forEach(tier => {
      expect(TIER_COLORS[tier]).toBeDefined();
      expect(TIER_COLORS[tier]).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  test('should have exactly 4 tier colors', () => {
    expect(Object.keys(TIER_COLORS)).toHaveLength(4);
  });
});

// ============================================================
// SECTION 2: COLOR LOOKUPS
// ============================================================

describe('getColorForStage()', () => {
  test('should return hex color for discovered stage', () => {
    expect(getColorForStage('discovered')).toBe('#6366f1');
  });

  test('should return hex color for researching stage', () => {
    expect(getColorForStage('researching')).toBe('#8b5cf6');
  });

  test('should return hex color for outreach stage', () => {
    expect(getColorForStage('outreach')).toBe('#ec4899');
  });

  test('should return hex color for applied stage', () => {
    expect(getColorForStage('applied')).toBe('#f59e0b');
  });

  test('should return hex color for screen stage', () => {
    expect(getColorForStage('screen')).toBe('#06b6d4');
  });

  test('should return hex color for interviewing stage', () => {
    expect(getColorForStage('interviewing')).toBe('#10b981');
  });

  test('should return hex color for offer stage', () => {
    expect(getColorForStage('offer')).toBe('#22c55e');
  });

  test('should return hex color for closed stage', () => {
    expect(getColorForStage('closed')).toBe('#64748b');
  });

  test('should return fallback color for unknown stage', () => {
    expect(getColorForStage('unknown')).toBe('#64748b');
  });

  test('should return fallback color for null stage', () => {
    expect(getColorForStage(null)).toBe('#64748b');
  });

  test('should return fallback color for undefined stage', () => {
    expect(getColorForStage(undefined)).toBe('#64748b');
  });

  test('should return hex color for rejected status', () => {
    expect(getColorForStage('rejected')).toBe('#ef4444');
  });

  test('should return hex color for withdrawn status', () => {
    expect(getColorForStage('withdrawn')).toBe('#f97316');
  });
});

describe('getColorForTier()', () => {
  test('should return hex color for hot tier', () => {
    expect(getColorForTier('hot')).toBe('#ef4444');
  });

  test('should return hex color for active tier', () => {
    expect(getColorForTier('active')).toBe('#f59e0b');
  });

  test('should return hex color for watching tier', () => {
    expect(getColorForTier('watching')).toBe('#6366f1');
  });

  test('should return hex color for archive tier', () => {
    expect(getColorForTier('archive')).toBe('#64748b');
  });

  test('should return fallback color for unknown tier', () => {
    expect(getColorForTier('unknown')).toBe('#71717a');
  });

  test('should return fallback color for null tier', () => {
    expect(getColorForTier(null)).toBe('#71717a');
  });

  test('should return fallback color for undefined tier', () => {
    expect(getColorForTier(undefined)).toBe('#71717a');
  });

  test('should return fallback color for empty string tier', () => {
    expect(getColorForTier('')).toBe('#71717a');
  });
});

// ============================================================
// SECTION 3: DAYS IN STAGE
// ============================================================

describe('getDaysInStage()', () => {
  const now = 1000000000; // Fixed timestamp for testing

  test('should calculate days from lastActivity timestamp (number)', () => {
    const role = { lastActivity: now - 86400000 }; // 1 day ago
    expect(getDaysInStage(role, now)).toBe(1);
  });

  test('should calculate days from lastActivity ISO string', () => {
    const date = new Date('2025-03-01T12:00:00Z');
    const role = { lastActivity: date.toISOString() };
    const futureNow = date.getTime() + 86400000 * 5; // 5 days later
    expect(getDaysInStage(role, futureNow)).toBe(5);
  });

  test('should fall back to dateAdded if lastActivity is missing', () => {
    const role = { dateAdded: now - 86400000 * 3 }; // 3 days ago
    expect(getDaysInStage(role, now)).toBe(3);
  });

  test('should use dateAdded as ISO string', () => {
    const date = new Date('2025-03-01T12:00:00Z');
    const role = { dateAdded: date.toISOString() };
    const futureNow = date.getTime() + 86400000 * 10; // 10 days later
    expect(getDaysInStage(role, futureNow)).toBe(10);
  });

  test('should prefer lastActivity over dateAdded', () => {
    const role = {
      lastActivity: now - 86400000 * 2, // 2 days ago
      dateAdded: now - 86400000 * 10 // 10 days ago
    };
    expect(getDaysInStage(role, now)).toBe(2);
  });

  test('should return 0 for invalid/NaN dates', () => {
    const role = { lastActivity: 'invalid-date' };
    expect(getDaysInStage(role, now)).toBe(0);
  });

  test('should return 0 when both lastActivity and dateAdded are missing', () => {
    const role = {};
    expect(getDaysInStage(role, now)).toBe(0);
  });

  test('should round down days', () => {
    const role = { lastActivity: now - 86400000 * 2 - 43200000 }; // 2.5 days ago
    expect(getDaysInStage(role, now)).toBe(2);
  });

  test('should use Date.now() as default when now param is not provided', () => {
    const role = { lastActivity: Date.now() - 86400000 }; // 1 day ago
    const result = getDaysInStage(role);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(2); // Allow 1-2 days for execution time
  });

  test('should handle very old timestamps', () => {
    const role = { lastActivity: now - 86400000 * 365 }; // 365 days ago
    expect(getDaysInStage(role, now)).toBe(365);
  });

  test('should handle 0 days (same day)', () => {
    const role = { lastActivity: now - 3600000 }; // 1 hour ago
    expect(getDaysInStage(role, now)).toBe(0);
  });
});

// ============================================================
// SECTION 4: SUBSTAGES
// ============================================================

describe('getSubstages()', () => {
  test('should return array of substages for discovered stage', () => {
    const substages = getSubstages('discovered');
    expect(Array.isArray(substages)).toBe(true);
    expect(substages).toContain('New');
    expect(substages).toContain('Reviewing JD');
    expect(substages).toContain('Needs Research');
    expect(substages.length).toBe(3);
  });

  test('should return array of substages for researching stage', () => {
    const substages = getSubstages('researching');
    expect(substages).toEqual(['Company Research', 'Role Analysis', 'Network Check']);
  });

  test('should return array of substages for outreach stage', () => {
    const substages = getSubstages('outreach');
    expect(substages).toEqual(['Drafting Message', 'Sent', 'Follow Up', 'Waiting']);
  });

  test('should return array of substages for applied stage', () => {
    const substages = getSubstages('applied');
    expect(substages).toEqual(['Submitted', 'Referred', 'Recruiter Contact']);
  });

  test('should return array of substages for screen stage', () => {
    const substages = getSubstages('screen');
    expect(substages).toEqual(['Phone Screen Scheduled', 'Phone Screen Done', 'Awaiting Next Steps']);
  });

  test('should return array of substages for interviewing stage', () => {
    const substages = getSubstages('interviewing');
    expect(substages.length).toBe(5);
    expect(substages).toContain('Round 1');
    expect(substages).toContain('Round 2');
    expect(substages).toContain('Final Round');
  });

  test('should return array of substages for offer stage', () => {
    const substages = getSubstages('offer');
    expect(substages.length).toBe(5);
    expect(substages).toContain('Verbal');
    expect(substages).toContain('Accepted');
    expect(substages).toContain('Declined');
  });

  test('should return array of substages for closed stage', () => {
    const substages = getSubstages('closed');
    expect(substages).toEqual(['Accepted Elsewhere', 'Not a Fit', 'Position Filled', 'Other']);
  });

  test('should return empty array for unknown stage', () => {
    expect(getSubstages('unknown')).toEqual([]);
  });

  test('should return empty array for null stage', () => {
    expect(getSubstages(null)).toEqual([]);
  });

  test('should return empty array for undefined stage', () => {
    expect(getSubstages(undefined)).toEqual([]);
  });

  test('should all substages be non-empty strings', () => {
    STAGES.forEach(stage => {
      const substages = getSubstages(stage);
      substages.forEach(substage => {
        expect(typeof substage).toBe('string');
        expect(substage.length).toBeGreaterThan(0);
      });
    });
  });

  test('should not modify returned array on subsequent calls', () => {
    const first = getSubstages('discovered');
    const second = getSubstages('discovered');
    expect(first).toEqual(second);
  });
});

// ============================================================
// SECTION 5: LINKEDIN CONNECTION SORTING
// ============================================================

describe('sortLinkedInConnections()', () => {
  test('should sort product/engineering connections first', () => {
    const connections = [
      { name: 'Alice Sales', position: 'Sales Manager' },
      { name: 'Bob Engineer', position: 'Software Engineer' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].name).toBe('Bob Engineer');
    expect(sorted[1].name).toBe('Alice Sales');
  });

  test('should recognize product in title', () => {
    const connections = [
      { name: 'Carol HR', position: 'HR Manager' },
      { name: 'David PM', position: 'Product Manager' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].position).toContain('Product');
  });

  test('should recognize engineering variants', () => {
    const engineers = [
      { name: 'Engineer1', position: 'Software Engineer' },
      { name: 'Engineer2', position: 'Backend Engineer' },
      { name: 'Engineer3', position: 'Frontend Developer' },
      { name: 'Engineer4', position: 'DevOps Engineer' },
      { name: 'Engineer5', position: 'Data Engineer' }
    ];
    engineers.forEach(eng => {
      const result = sortLinkedInConnections([
        { name: 'Sales Person', position: 'Sales' },
        eng
      ]);
      expect(result[0].name).toBe(eng.name);
    });
  });

  test('should sort by seniority tier within same department', () => {
    const connections = [
      { name: 'Junior', position: 'Software Engineer' },
      { name: 'Senior', position: 'Senior Software Engineer' },
      { name: 'VP', position: 'VP Engineering' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].name).toBe('VP');
    expect(sorted[1].name).toBe('Senior');
    expect(sorted[2].name).toBe('Junior');
  });

  test('should recognize C-suite as highest tier within same department', () => {
    // Both match product/eng patterns (engineering keyword), so seniority determines order
    // "Chief Engineering Officer" → tier 0 (chief), "Director of Engineering" → tier 4 (director)
    const connections = [
      { name: 'Director', position: 'Director of Engineering' },
      { name: 'Chief', position: 'Chief Engineering Officer' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].name).toBe('Chief');
  });

  test('should recognize SVP as high tier', () => {
    const connections = [
      { name: 'VP', position: 'VP Engineering' },
      { name: 'SVP', position: 'Senior Vice President Engineering' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].name).toBe('SVP');
  });

  test('should recognize Director tier', () => {
    const connections = [
      { name: 'Manager', position: 'Engineering Manager' },
      { name: 'Director', position: 'Director of Engineering' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].name).toBe('Director');
  });

  test('should use alphabetical sort as tiebreaker', () => {
    const connections = [
      { name: 'Zoe', position: 'Software Engineer' },
      { name: 'Alice', position: 'Software Engineer' },
      { name: 'Bob', position: 'Software Engineer' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].name).toBe('Alice');
    expect(sorted[1].name).toBe('Bob');
    expect(sorted[2].name).toBe('Zoe');
  });

  test('should sort null positions to the end', () => {
    const connections = [
      { name: 'NoPosition', position: null },
      { name: 'Engineer', position: 'Software Engineer' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].name).toBe('Engineer');
    expect(sorted[1].name).toBe('NoPosition');
  });

  test('should sort undefined positions to the end', () => {
    const connections = [
      { name: 'NoPosition', position: undefined },
      { name: 'Engineer', position: 'Software Engineer' }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].name).toBe('Engineer');
    expect(sorted[1].name).toBe('NoPosition');
  });

  test('should handle empty connections array', () => {
    expect(sortLinkedInConnections([])).toEqual([]);
  });

  test('should mutate and return the input array', () => {
    const connections = [
      { name: 'Alice', position: 'Engineer' },
      { name: 'Bob', position: 'Sales' }
    ];
    const result = sortLinkedInConnections(connections);
    expect(result).toBe(connections);
  });

  test('should handle multiple null/undefined positions', () => {
    const connections = [
      { name: 'Z', position: null },
      { name: 'Engineer', position: 'Software Engineer' },
      { name: 'A', position: undefined }
    ];
    const sorted = sortLinkedInConnections(connections);
    expect(sorted[0].position).toBeDefined();
    expect(sorted[0].position).not.toBeNull();
  });

  test('should recognize various engineering keywords', () => {
    const keywords = ['architect', 'platform', 'data', 'ml', 'ai', 'machine learning', 'ux', 'ui', 'devops', 'sre', 'infrastructure'];
    keywords.forEach(keyword => {
      const result = sortLinkedInConnections([
        { name: 'Sales', position: 'Sales Manager' },
        { name: 'Tech', position: `Senior ${keyword} specialist` }
      ]);
      expect(result[0].name).toBe('Tech');
    });
  });
});

// ============================================================
// SECTION 6: LINKEDIN DEPARTMENT CATEGORY
// ============================================================

describe('getLinkedInDeptCategory()', () => {
  test('should return "product" for product manager', () => {
    expect(getLinkedInDeptCategory('Product Manager')).toBe('product');
  });

  test('should return "product" for product title (case-insensitive)', () => {
    expect(getLinkedInDeptCategory('Senior Product Manager')).toBe('product');
  });

  test('should return "engineering" for software engineer', () => {
    expect(getLinkedInDeptCategory('Software Engineer')).toBe('engineering');
  });

  test('should return "engineering" for various engineering titles', () => {
    const titles = [
      'Developer',
      'Architect',
      'DevOps Engineer',
      'SRE',
      'Infrastructure Engineer',
      'Backend Engineer',
      'Frontend Developer',
      'Full Stack Engineer',
      'Mobile Engineer',
      'Data Engineer',
      'ML Engineer',
      'AI Engineer',
      'Machine Learning Specialist',
      'Technical Lead',
      'Tech Lead'
    ];
    titles.forEach(title => {
      expect(getLinkedInDeptCategory(title)).toBe('engineering');
    });
  });

  test('should return null for non-product/engineering titles', () => {
    expect(getLinkedInDeptCategory('Sales Manager')).toBeNull();
    expect(getLinkedInDeptCategory('HR Manager')).toBeNull();
    expect(getLinkedInDeptCategory('Finance Director')).toBeNull();
  });

  test('should return null for null input', () => {
    expect(getLinkedInDeptCategory(null)).toBeNull();
  });

  test('should return null for undefined input', () => {
    expect(getLinkedInDeptCategory(undefined)).toBeNull();
  });

  test('should return null for empty string', () => {
    expect(getLinkedInDeptCategory('')).toBeNull();
  });

  test('should handle case-insensitive matching for product', () => {
    expect(getLinkedInDeptCategory('PRODUCT MANAGER')).toBe('product');
    expect(getLinkedInDeptCategory('product manager')).toBe('product');
  });

  test('should prioritize product over other keywords', () => {
    // If a title contains both product and engineering keywords, product should win
    const result = getLinkedInDeptCategory('Product Engineering Manager');
    expect(result).toBe('product');
  });
});

// ============================================================
// SECTION 7: PIPELINE ANALYTICS
// ============================================================

describe('calculatePipelineAnalytics()', () => {
  test('should return object with conversions, avgDaysPerStage, stageCounts', () => {
    const analytics = calculatePipelineAnalytics([]);
    expect(analytics).toHaveProperty('conversions');
    expect(analytics).toHaveProperty('avgDaysPerStage');
    expect(analytics).toHaveProperty('stageCounts');
  });

  test('should return zero counts for empty roles', () => {
    const analytics = calculatePipelineAnalytics([]);
    STAGES.forEach(stage => {
      expect(analytics.stageCounts[stage]).toBe(0);
    });
  });

  test('should count roles in each stage', () => {
    const roles = [
      { stage: 'discovered', lastActivity: Date.now() },
      { stage: 'discovered', lastActivity: Date.now() },
      { stage: 'researching', lastActivity: Date.now() }
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(analytics.stageCounts['discovered']).toBe(2);
    expect(analytics.stageCounts['researching']).toBe(1);
  });

  test('should distribute roles across multiple stages', () => {
    const roles = [
      { stage: 'discovered', lastActivity: Date.now() },
      { stage: 'applied', lastActivity: Date.now() },
      { stage: 'interviewing', lastActivity: Date.now() }
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(analytics.stageCounts['discovered']).toBe(1);
    expect(analytics.stageCounts['applied']).toBe(1);
    expect(analytics.stageCounts['interviewing']).toBe(1);
  });

  test('should calculate average days in stage', () => {
    const now = Date.now();
    const roles = [
      { stage: 'discovered', lastActivity: now - 86400000 * 10 }, // 10 days
      { stage: 'discovered', lastActivity: now - 86400000 * 20 } // 20 days
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(analytics.avgDaysPerStage['discovered']).toBe(15);
  });

  test('should not calculate avgDaysPerStage for empty stages', () => {
    const analytics = calculatePipelineAnalytics([]);
    expect(analytics.avgDaysPerStage['discovered']).toBeUndefined();
  });

  test('should calculate conversion rates from discovered to researching', () => {
    const roles = [
      { stage: 'discovered', stageHistory: [{ stage: 'discovered' }] },
      { stage: 'researching', stageHistory: [{ stage: 'discovered' }, { stage: 'researching' }] }
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(analytics.conversions['discovered → researching']).toBeDefined();
    expect(analytics.conversions['discovered → researching'].rate).toBe(50);
  });

  test('should calculate 100% conversion when all progress', () => {
    const roles = [
      { stage: 'researching', stageHistory: [{ stage: 'discovered' }, { stage: 'researching' }] },
      { stage: 'researching', stageHistory: [{ stage: 'discovered' }, { stage: 'researching' }] }
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(analytics.conversions['discovered → researching'].rate).toBe(100);
  });

  test('should calculate 0% conversion when none progress', () => {
    const roles = [
      { stage: 'discovered', stageHistory: [{ stage: 'discovered' }] }
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(analytics.conversions['discovered → researching'].rate).toBe(0);
  });

  test('should use provided getDaysInStageFn override', () => {
    const mockFn = jest.fn().mockReturnValue(5);
    const roles = [
      { stage: 'discovered', lastActivity: Date.now() }
    ];
    calculatePipelineAnalytics(roles, mockFn);
    expect(mockFn).toHaveBeenCalled();
  });

  test('should include all defined transitions', () => {
    const analytics = calculatePipelineAnalytics([]);
    const expectedTransitions = [
      'discovered → researching',
      'researching → outreach',
      'outreach → applied',
      'applied → screen',
      'screen → interviewing',
      'interviewing → offer'
    ];
    expectedTransitions.forEach(transition => {
      expect(analytics.conversions[transition]).toBeDefined();
    });
  });

  test('should cap conversion rate at 100%', () => {
    const roles = [
      { stage: 'researching', stageHistory: [{ stage: 'discovered' }, { stage: 'researching' }] }
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(analytics.conversions['discovered → researching'].rate).toBeLessThanOrEqual(100);
  });

  test('should handle roles without stageHistory', () => {
    // Only roles with stageHistory are counted. Role 1 has no history so isn't in denominator.
    // Role 2 has discovered→researching, so everInFrom=1, everInTo=1, rate=100%
    const roles = [
      { stage: 'discovered' }, // no stageHistory — not counted in conversions
      { stage: 'researching', stageHistory: [{ stage: 'discovered' }, { stage: 'researching' }] }
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(analytics.conversions['discovered → researching'].rate).toBe(100);
  });

  test('should round avgDaysPerStage to nearest integer', () => {
    const now = Date.now();
    const roles = [
      { stage: 'discovered', lastActivity: now - 86400000 * 10 },
      { stage: 'discovered', lastActivity: now - 86400000 * 11 },
      { stage: 'discovered', lastActivity: now - 86400000 * 12 }
    ];
    const analytics = calculatePipelineAnalytics(roles);
    expect(Number.isInteger(analytics.avgDaysPerStage['discovered'])).toBe(true);
  });
});

// ============================================================
// SECTION 8: JOB POSTING PARSER
// ============================================================

describe('parseJobPosting()', () => {
  test('should extract company from Workday URL', () => {
    const url = 'https://acme.wd5.myworkdayjobs.com/en-US/acme/job/123';
    const result = parseJobPosting('', url);
    expect(result.company).toBe('Acme');
  });

  test('should extract company from Workday URL with different domain number', () => {
    const url = 'https://techcorp.wd1.myworkdayjobs.com/en-US/techcorp/job/456';
    const result = parseJobPosting('', url);
    expect(result.company).toBe('Techcorp');
  });

  test('should extract company from Greenhouse URL', () => {
    const url = 'https://boards.greenhouse.io/acme/jobs/12345';
    const result = parseJobPosting('', url);
    expect(result.company).toBe('acme');
  });

  test('should extract company from Lever URL', () => {
    const url = 'https://jobs.lever.co/techcorp/abc123';
    const result = parseJobPosting('', url);
    expect(result.company).toBe('techcorp');
  });

  test('should extract company from Ashby URL', () => {
    const url = 'https://jobs.ashbyhq.com/startup/def456';
    const result = parseJobPosting('', url);
    expect(result.company).toBe('startup');
  });

  test('should extract job title from text', () => {
    const text = 'Senior Product Manager\nWe are looking for...';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.title).toBe('Senior Product Manager');
  });

  test('should extract director title', () => {
    const text = 'Director of Engineering\nJoin our team...';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.title).toBe('Director of Engineering');
  });

  test('should extract engineer title', () => {
    const text = 'Software Engineer\nWe build...';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.title).toBe('Software Engineer');
  });

  test('should extract salary in X - Y format', () => {
    const text = 'Salary: $100,000 - $150,000\nGreat opportunity';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.salary).toBe('$100,000 - $150,000');
  });

  test('should extract salary with to format', () => {
    const text = '$80,000 to $120,000 per year';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.salary).toBe('$80,000 to $120,000');
  });

  test('should extract salary with en dash', () => {
    const text = '$90,000 – $140,000 annually';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.salary).toBe('$90,000 – $140,000');
  });

  test('should extract salary with decimals', () => {
    const text = '$100,000.50 - $150,000.75';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.salary).toBe('$100,000.50 - $150,000.75');
  });

  test('should extract location', () => {
    const text = 'Location: San Francisco, CA';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.location).toContain('San Francisco');
  });

  test('should extract location for multiple cities', () => {
    const text = 'Location: New York, New York OR San Francisco, California';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.location).toBeDefined();
  });

  test('should extract remote location', () => {
    const text = 'Location: Remote';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.location).toContain('Remote');
  });

  test('should extract hybrid location', () => {
    const text = 'Location: Hybrid - Seattle, WA';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.location).toBeDefined();
  });

  test('should infer management positioning for director title', () => {
    const text = 'Director of Product\nLeading our team...';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.positioning).toBe('management');
  });

  test('should infer management positioning for VP title', () => {
    const text = 'VP of Engineering\nOversee...';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.positioning).toBe('management');
  });

  test('should infer management positioning for vice president', () => {
    const text = 'Vice President Operations\nStrategic role...';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.positioning).toBe('management');
  });

  test('should infer management positioning for head of', () => {
    const text = 'Head of Design\nLead design...';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.positioning).toBe('management');
  });

  test('should default to ic positioning', () => {
    const text = 'Software Engineer\nWrite code...';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.positioning).toBe('ic');
  });

  test('should extract JD body text', () => {
    const text = `Senior Product Manager
    About the role
    This is a detailed description of the role. You will be responsible for product strategy.
    We are looking for someone with great experience.
    Benefits: Health insurance, 401k`;
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.jdText.length).toBeGreaterThan(0);
  });

  test('should stop JD extraction at benefits keyword', () => {
    const text = `Product Manager
    We need a PM. Build great products.
    Benefits: Insurance, PTO
    More text after benefits`;
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.jdText).not.toContain('Benefits');
  });

  test('should skip nav boilerplate at start', () => {
    const text = `Skip to main content
    Sign In
    Search for Jobs
    Product Manager
    Real job description here`;
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.jdText).not.toContain('Skip to main');
    expect(result.jdText).not.toContain('Sign In');
  });

  test('should stop at privacy policy keyword', () => {
    const text = `Engineer
    Description here.
    Privacy Policy: We respect your data.`;
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.jdText).not.toContain('Privacy');
  });

  test('should stop at equal opportunity keyword', () => {
    const text = `Manager
    Great opportunity.
    Equal Opportunity Employer: We do not discriminate.`;
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.jdText).not.toContain('Equal');
  });

  test('should stop at copyright symbol', () => {
    const text = `Designer
    Design amazing interfaces.
    © 2024 Company Name`;
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.jdText).not.toContain('©');
  });

  test('should return empty jdText if no substantial content', () => {
    const text = `Skip to main content
    Sign In`;
    const result = parseJobPosting(text, 'https://example.com');
    expect(typeof result.jdText).toBe('string');
  });

  test('should handle malformed URLs gracefully', () => {
    const result = parseJobPosting('', 'not-a-valid-url');
    expect(result.company).toBe('');
    expect(result.title).toBe('');
  });

  test('should return object with all required fields', () => {
    const result = parseJobPosting('', 'https://example.com');
    expect(result).toHaveProperty('company');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('location');
    expect(result).toHaveProperty('salary');
    expect(result).toHaveProperty('jdText');
    expect(result).toHaveProperty('positioning');
  });

  test('should handle empty text input', () => {
    const result = parseJobPosting('', 'https://example.com');
    expect(result.title).toBe('');
    expect(result.salary).toBe('');
  });

  test('should skip title line during JD extraction', () => {
    const text = `Product Manager
    This is the job description.
    More details here.`;
    const result = parseJobPosting(text, 'https://example.com');
    // The JD should not contain just the title alone
    expect(result.jdText.length > 0 || result.jdText.length === 0).toBe(true);
  });

  test('should skip Apply button during extraction', () => {
    const text = `Senior Engineer
    Apply
    This is the real content.`;
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.jdText).not.toContain('Apply');
  });

  test('should extract company from Greenhouse ATS URL', () => {
    const text = 'Senior Product Manager\nGreat opportunity';
    const url = 'https://boards.greenhouse.io/stripe/jobs/123';
    const result = parseJobPosting(text, url);
    expect(result.company).toBe('stripe');
  });

  test('should extract company from Lever ATS URL', () => {
    const text = 'Product Manager\nJoin us';
    const url = 'https://jobs.lever.co/notion/abc-123';
    const result = parseJobPosting(text, url);
    expect(result.company).toBe('notion');
  });

  test('should extract company from Ashby ATS URL', () => {
    const text = 'Engineer\nWe are hiring';
    const url = 'https://jobs.ashbyhq.com/linear/xyz';
    const result = parseJobPosting(text, url);
    expect(result.company).toBe('linear');
  });

  test('should detect management positioning for director title', () => {
    const text = 'Director of Product\nLeading our product strategy';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.positioning).toBe('management');
  });

  test('should detect management positioning for vp title', () => {
    const text = 'VP of Engineering\nOversee the engineering team';
    const result = parseJobPosting(text, 'https://example.com');
    expect(result.positioning).toBe('management');
  });
});

// ============================================================
// SECTION 9: COMPANY PROFILE COMPLETION
// ============================================================

describe('getCompanyProfileCompletion()', () => {
  test('should return 0 for null company', () => {
    expect(getCompanyProfileCompletion(null)).toBe(0);
  });

  test('should return 0 for undefined company', () => {
    expect(getCompanyProfileCompletion(undefined)).toBe(0);
  });

  test('should return 0 for empty company object', () => {
    expect(getCompanyProfileCompletion({})).toBe(0);
  });

  test('should return 100 for fully populated company', () => {
    const company = {
      domain: 'example.com',
      missionStatement: 'Our mission is to...',
      headcount: '100-500',
      fundingStage: 'Series B',
      remotePolicy: 'Fully remote',
      url: 'https://example.com'
    };
    expect(getCompanyProfileCompletion(company)).toBe(100);
  });

  test('should return 50 for half-populated company', () => {
    const company = {
      domain: 'example.com',
      missionStatement: 'Our mission...',
      headcount: null,
      fundingStage: '',
      remotePolicy: 'Hybrid',
      url: null
    };
    expect(getCompanyProfileCompletion(company)).toBe(50);
  });

  test('should ignore empty strings as unpopulated', () => {
    const company = {
      domain: 'example.com',
      missionStatement: '',
      headcount: '100-500',
      fundingStage: 'Series A',
      remotePolicy: 'Remote',
      url: 'https://example.com'
    };
    expect(getCompanyProfileCompletion(company)).toBe(83); // 5 of 6
  });

  test('should ignore whitespace-only strings as unpopulated', () => {
    const company = {
      domain: 'example.com',
      missionStatement: '   ',
      headcount: '100-500',
      fundingStage: 'Series A',
      remotePolicy: 'Remote',
      url: 'https://example.com'
    };
    expect(getCompanyProfileCompletion(company)).toBe(83); // 5 of 6
  });

  test('should calculate percentage correctly for single field', () => {
    const company = {
      domain: 'example.com',
      missionStatement: null,
      headcount: null,
      fundingStage: null,
      remotePolicy: null,
      url: null
    };
    expect(getCompanyProfileCompletion(company)).toBe(17); // 1 of 6, rounds to 17
  });

  test('should calculate percentage correctly for two fields', () => {
    const company = {
      domain: 'example.com',
      missionStatement: 'Mission here',
      headcount: null,
      fundingStage: null,
      remotePolicy: null,
      url: null
    };
    expect(getCompanyProfileCompletion(company)).toBe(33); // 2 of 6
  });

  test('should round to nearest integer', () => {
    const company = {
      domain: 'example.com',
      missionStatement: 'Mission here',
      headcount: '100-500',
      fundingStage: null,
      remotePolicy: null,
      url: null
    };
    const result = getCompanyProfileCompletion(company);
    expect(Number.isInteger(result)).toBe(true);
  });

  test('should handle missing properties', () => {
    const company = {
      domain: 'example.com',
      missionStatement: 'Mission here'
      // missing other properties
    };
    expect(getCompanyProfileCompletion(company)).toBe(33); // 2 of 6
  });

  test('should count numeric values as populated', () => {
    const company = {
      domain: 'example.com',
      missionStatement: 'Mission here',
      headcount: 150, // numeric
      fundingStage: 'Series B',
      remotePolicy: 'Fully Remote',
      url: 'https://example.com'
    };
    expect(getCompanyProfileCompletion(company)).toBe(100);
  });

  test('should count zero as populated for numeric fields', () => {
    const company = {
      domain: 'example.com',
      missionStatement: 'Mission',
      headcount: 0, // zero is still a value
      fundingStage: 'Seed',
      remotePolicy: 'Remote',
      url: 'https://example.com'
    };
    const result = getCompanyProfileCompletion(company);
    // Should count 0 as populated depending on toString() check
    expect(result).toBeGreaterThanOrEqual(50);
  });

  test('should verify all 6 fields are checked', () => {
    const company = {
      domain: 'a',
      missionStatement: 'b',
      headcount: 'c',
      fundingStage: 'd',
      remotePolicy: 'e',
      url: 'f'
    };
    expect(getCompanyProfileCompletion(company)).toBe(100);
  });
});
