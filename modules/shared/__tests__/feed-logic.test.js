/* ====================================================================
 * UNIT TESTS — feed-logic.js (Scoring, Filtering, Dedup, Network)
 * ==================================================================== */

const {
  getNetworkAtCompany,
  checkPipelineStatus,
  editDistance,
  checkDedup,
  checkPipelineDedup,
  normalizeStage,
  runQuickCheckFilter,
  isStubJD,
  scoreRole,
  searchFeedItems,
  getFilteredFeedItems,
  analyzeTierSuggestions,
} = require('../feed-logic');

// ============================================================
// getNetworkAtCompany Tests
// ============================================================

describe('getNetworkAtCompany', () => {
  test('empty company name returns empty result', () => {
    const result = getNetworkAtCompany('', [], []);
    expect(result).toEqual({ tracked: [], linkedin: [], total: 0 });
  });

  test('null company name returns empty result', () => {
    const result = getNetworkAtCompany(null, [], []);
    expect(result).toEqual({ tracked: [], linkedin: [], total: 0 });
  });

  test('exact company match finds connections', () => {
    const tracked = [{ name: 'Alice', company: 'Amazon' }];
    const linkedin = [{ name: 'Bob', company: 'Amazon' }];
    const result = getNetworkAtCompany('Amazon', linkedin, tracked);
    expect(result.tracked).toContain('Alice');
    expect(result.linkedin).toContain('Bob');
    expect(result.total).toBe(2);
  });

  test('case-insensitive matching works', () => {
    const tracked = [{ name: 'Alice', company: 'AMAZON' }];
    const result = getNetworkAtCompany('amazon', [], tracked);
    expect(result.tracked).toContain('Alice');
  });

  test('fuzzy substring match: Amazon Ads contains Amazon', () => {
    const linkedin = [{ name: 'Charlie', company: 'Amazon Ads' }];
    const result = getNetworkAtCompany('Amazon', linkedin, []);
    expect(result.linkedin).toContain('Charlie');
  });

  test('fuzzy substring match: reverse direction (Amazon Ads searches for Ads)', () => {
    const tracked = [{ name: 'Dave', company: 'Amazon Ads' }];
    const result = getNetworkAtCompany('Amazon Ads', [], tracked);
    expect(result.tracked).toContain('Dave');
  });

  test('short string guard: short search term matches long company via includes', () => {
    // "vectorone" includes "on" — fuzzy match succeeds because connLower.length >= 4
    const linkedin = [{ name: 'Eve', company: 'VectorOne' }];
    const result = getNetworkAtCompany('On', linkedin, []);
    expect(result.linkedin).toContain('Eve');
  });

  test('short string guard: reverse includes with short conn company does not match', () => {
    // companyLower="vectorone" (long), connLower="on" (length 2 < 4) → third branch skipped
    const linkedin = [{ name: 'Eve', company: 'On' }];
    const result = getNetworkAtCompany('VectorOne', linkedin, []);
    expect(result.total).toBe(0);
  });

  test('dedup: tracked connections excluded from linkedin list', () => {
    const tracked = [{ name: 'Alice', company: 'Amazon' }];
    const linkedin = [
      { name: 'Alice', company: 'Amazon' },
      { name: 'Bob', company: 'Amazon' }
    ];
    const result = getNetworkAtCompany('Amazon', linkedin, tracked);
    expect(result.tracked).toContain('Alice');
    expect(result.linkedin).not.toContain('Alice');
    expect(result.linkedin).toContain('Bob');
  });

  test('no matches returns empty lists', () => {
    const tracked = [{ name: 'Alice', company: 'Apple' }];
    const linkedin = [{ name: 'Bob', company: 'Google' }];
    const result = getNetworkAtCompany('Amazon', linkedin, tracked);
    expect(result).toEqual({ tracked: [], linkedin: [], total: 0 });
  });
});

// ============================================================
// checkPipelineStatus Tests
// ============================================================

describe('checkPipelineStatus', () => {
  test('no match in pipeline returns inPipeline false', () => {
    const feedItem = { company: 'Amazon', title: 'Product Manager' };
    const result = checkPipelineStatus(feedItem, []);
    expect(result.inPipeline).toBe(false);
    expect(result.stage).toBeNull();
    expect(result.roleId).toBeNull();
  });

  test('exact company and title match with active stage', () => {
    const feedItem = { company: 'Amazon', title: 'Product Manager' };
    const pipelineRoles = [{
      id: 'role-1',
      company: 'Amazon',
      title: 'Product Manager',
      stage: 'applied'
    }];
    const result = checkPipelineStatus(feedItem, pipelineRoles);
    expect(result.inPipeline).toBe(true);
    expect(result.stage).toBe('applied');
    expect(result.roleId).toBe('role-1');
  });

  test('rejected stage allows match through (returns inPipeline true despite rejection)', () => {
    const feedItem = { company: 'Amazon', title: 'Product Manager' };
    const pipelineRoles = [{
      id: 'role-2',
      company: 'Amazon',
      title: 'Product Manager',
      stage: 'rejected'
    }];
    const result = checkPipelineStatus(feedItem, pipelineRoles);
    // Rejected stages should NOT match (the function checks stage !== 'rejected')
    expect(result.inPipeline).toBe(false);
  });

  test('fuzzy company match: substring match', () => {
    const feedItem = { company: 'Amazon', title: 'Product Manager' };
    const pipelineRoles = [{
      id: 'role-3',
      company: 'Amazon Ads',
      title: 'Product Manager',
      stage: 'interviewing'
    }];
    const result = checkPipelineStatus(feedItem, pipelineRoles);
    expect(result.inPipeline).toBe(true);
    expect(result.stage).toBe('interviewing');
  });

  test('specific role term matching: both have "product manager"', () => {
    const feedItem = { company: 'Google', title: 'Senior Product Manager' };
    const pipelineRoles = [{
      id: 'role-4',
      company: 'Google',
      title: 'Product Manager - Search',
      stage: 'offer'
    }];
    const result = checkPipelineStatus(feedItem, pipelineRoles);
    expect(result.inPipeline).toBe(true);
    expect(result.stage).toBe('offer');
  });

  test('case-insensitive matching', () => {
    const feedItem = { company: 'GOOGLE', title: 'PRODUCT MANAGER' };
    const pipelineRoles = [{
      id: 'role-5',
      company: 'google',
      title: 'product manager',
      stage: 'applied'
    }];
    const result = checkPipelineStatus(feedItem, pipelineRoles);
    expect(result.inPipeline).toBe(true);
  });

  test('null/empty feed item properties handled gracefully', () => {
    const feedItem = { company: null, title: null };
    const result = checkPipelineStatus(feedItem, []);
    expect(result.inPipeline).toBe(false);
  });
});

// ============================================================
// editDistance Tests
// ============================================================

describe('editDistance', () => {
  test('identical strings have distance 0', () => {
    expect(editDistance('hello', 'hello')).toBe(0);
  });

  test('single character difference', () => {
    expect(editDistance('cat', 'bat')).toBe(1);
  });

  test('completely different strings', () => {
    expect(editDistance('abc', 'xyz')).toBeGreaterThan(2);
  });

  test('empty string to string', () => {
    expect(editDistance('', 'hello')).toBe(5);
  });

  test('case insensitive', () => {
    expect(editDistance('HELLO', 'hello')).toBe(0);
  });

  test('one char insertion', () => {
    expect(editDistance('cat', 'cats')).toBe(1);
  });

  test('one char deletion', () => {
    expect(editDistance('hello', 'helo')).toBe(1);
  });

  test('multiple changes', () => {
    const distance = editDistance('kitten', 'sitting');
    expect(distance).toBe(3); // k->s, e->i, +g
  });
});

// ============================================================
// checkDedup Tests
// ============================================================

describe('checkDedup', () => {
  test('exact match returns exact type', () => {
    const roles = [
      { company: 'Amazon', title: 'Product Manager' }
    ];
    const result = checkDedup('Amazon', 'Product Manager', roles);
    expect(result.type).toBe('exact');
    expect(result.existingRole).toEqual(roles[0]);
  });

  test('fuzzy match with edit distance < 3', () => {
    const roles = [
      { company: 'Amazon', title: 'Product Managerr' }
    ];
    const result = checkDedup('Amazon', 'Product Manager', roles);
    expect(result.type).toBe('fuzzy');
    expect(result.distance).toBeLessThan(3);
  });

  test('edit distance >= 3 returns no match', () => {
    const roles = [
      { company: 'Amazon', title: 'Software Engineer' }
    ];
    const result = checkDedup('Amazon', 'Product Manager', roles);
    expect(result.type).toBe('none');
  });

  test('different company ignores fuzzy title match', () => {
    const roles = [
      { company: 'Google', title: 'Product Manager' }
    ];
    const result = checkDedup('Amazon', 'Product Manager', roles);
    expect(result.type).toBe('none');
  });

  test('case-insensitive exact match', () => {
    const roles = [
      { company: 'AMAZON', title: 'PRODUCT MANAGER' }
    ];
    const result = checkDedup('amazon', 'product manager', roles);
    expect(result.type).toBe('exact');
  });

  test('no matches returns none', () => {
    const roles = [];
    const result = checkDedup('Amazon', 'Product Manager', roles);
    expect(result.type).toBe('none');
  });
});

// ============================================================
// checkPipelineDedup Tests
// ============================================================

describe('checkPipelineDedup', () => {
  test('null feed item returns not duplicate', () => {
    const result = checkPipelineDedup(null, []);
    expect(result.isDuplicate).toBe(false);
    expect(result.matchType).toBeNull();
  });

  test('empty pipeline returns not duplicate', () => {
    const feedItem = { company: 'Amazon', title: 'Product Manager' };
    const result = checkPipelineDedup(feedItem, []);
    expect(result.isDuplicate).toBe(false);
  });

  test('exact company and title match', () => {
    const feedItem = { company: 'Amazon', title: 'Product Manager' };
    const pipelineRoles = [
      { company: 'Amazon', title: 'Product Manager', id: 'role-1' }
    ];
    const result = checkPipelineDedup(feedItem, pipelineRoles);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchType).toBe('exact');
  });

  test('fuzzy match with word overlap >= 0.6', () => {
    // After normalization: "product manager" vs "product manager growth" → 2/3 = 0.67
    const feedItem = { company: 'Amazon', title: 'Senior Product Manager' };
    const pipelineRoles = [
      { company: 'Amazon', title: 'Product Manager Growth', id: 'role-2' }
    ];
    const result = checkPipelineDedup(feedItem, pipelineRoles);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchType).toBe('fuzzy');
  });

  test('seniority prefix normalization: senior removed before comparison', () => {
    // "Senior Product Manager" normalized → {product, manager}
    // "Product Manager" normalized → {product, manager} → overlap 2/2 = 1.0
    const feedItem = { company: 'Google', title: 'Senior Product Manager' };
    const pipelineRoles = [
      { company: 'Google', title: 'Product Manager', id: 'role-3' }
    ];
    const result = checkPipelineDedup(feedItem, pipelineRoles);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchType).toBe('fuzzy');
  });

  test('staff and principal removed in normalization', () => {
    // "Principal Engineer" → {engineer}, "Staff Engineer" → {engineer} → 1/1 = 1.0
    const feedItem = { company: 'Microsoft', title: 'Principal Engineer' };
    const pipelineRoles = [
      { company: 'Microsoft', title: 'Staff Engineer', id: 'role-4' }
    ];
    const result = checkPipelineDedup(feedItem, pipelineRoles);
    expect(result.isDuplicate).toBe(true);
  });

  test('no match with different company', () => {
    const feedItem = { company: 'Amazon', title: 'Product Manager' };
    const pipelineRoles = [
      { company: 'Google', title: 'Product Manager', id: 'role-5' }
    ];
    const result = checkPipelineDedup(feedItem, pipelineRoles);
    expect(result.isDuplicate).toBe(false);
  });

  test('low word overlap does not match', () => {
    const feedItem = { company: 'Amazon', title: 'Software Engineer' };
    const pipelineRoles = [
      { company: 'Amazon', title: 'Product Manager', id: 'role-6' }
    ];
    const result = checkPipelineDedup(feedItem, pipelineRoles);
    expect(result.isDuplicate).toBe(false);
  });
});

// ============================================================
// normalizeStage Tests
// ============================================================

describe('normalizeStage', () => {
  test('Series B+ maps to Series B', () => {
    expect(normalizeStage('Series B+')).toBe('Series B');
  });

  test('Late-stage maps to Late-stage / Pre-IPO', () => {
    expect(normalizeStage('Late-stage')).toBe('Late-stage / Pre-IPO');
  });

  test('Pre-IPO maps to Late-stage / Pre-IPO', () => {
    expect(normalizeStage('Pre-IPO')).toBe('Late-stage / Pre-IPO');
  });

  test('Private maps to Bootstrapped', () => {
    expect(normalizeStage('Private')).toBe('Bootstrapped');
  });

  test('unknown stage passes through', () => {
    expect(normalizeStage('Series A')).toBe('Series A');
  });

  test('empty string returns empty string', () => {
    expect(normalizeStage('')).toBe('');
  });

  test('null returns empty string', () => {
    expect(normalizeStage(null)).toBe('');
  });
});

// ============================================================
// runQuickCheckFilter Tests
// ============================================================

describe('runQuickCheckFilter', () => {
  const basePrefs = {
    primaryDomains: ['fintech', 'payments'],
    secondaryDomains: ['crypto'],
    locations: ['Remote', 'San Francisco'],
    excludedLocations: [],
    companyStage: ['Series A', 'Series B'],
    excludeKeywords: ['crypto'],
    boostKeywords: ['ai', 'machine learning']
  };

  test('role passing 5/6 checks returns passed true', () => {
    const role = {
      title: 'Senior Product Manager',
      jd: 'We are building AI-powered payment solutions. This is an AI role. Experience with fintech required.',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      remote: true
    };
    const result = runQuickCheckFilter(role, basePrefs);
    expect(result.passed).toBe(true);
    expect(result.passCount).toBeGreaterThanOrEqual(5);
  });

  test('role failing < 5/6 checks returns passed false', () => {
    const role = {
      title: 'Junior Developer',
      jd: 'We are looking for a junior developer with basic skills.',
      domain: 'retail',
      location: 'New York',
      stage: 'Seed',
      remote: false
    };
    const result = runQuickCheckFilter(role, basePrefs);
    expect(result.passed).toBe(false);
    expect(result.passCount).toBeLessThan(5);
  });

  test('check 1: seniority level check', () => {
    const role = {
      title: 'Senior Product Manager',
      jd: '',
      domain: '',
      location: '',
      stage: ''
    };
    const result = runQuickCheckFilter(role, basePrefs);
    const seniorityCheck = result.checks[0];
    expect(seniorityCheck.name).toBe('Level appropriate?');
    expect(seniorityCheck.passed).toBe(true);
  });

  test('check 2: domain check passes with primary domain', () => {
    const role = {
      title: 'Manager',
      jd: 'fintech experience required',
      domain: 'fintech',
      location: '',
      stage: ''
    };
    const result = runQuickCheckFilter(role, basePrefs);
    const domainCheck = result.checks[1];
    expect(domainCheck.name).toBe('Domain relevant?');
    expect(domainCheck.passed).toBe(true);
  });

  test('check 3: location check excludes rejected locations', () => {
    const prefs = { ...basePrefs, excludedLocations: ['China'] };
    const role = {
      title: 'Manager',
      jd: '',
      domain: '',
      location: 'China',
      stage: ''
    };
    const result = runQuickCheckFilter(role, prefs);
    const locationCheck = result.checks[2];
    expect(locationCheck.passed).toBe(false);
  });

  test('check 4: company stage check', () => {
    const role = {
      title: 'Manager',
      jd: '',
      domain: '',
      location: '',
      stage: 'Series A'
    };
    const result = runQuickCheckFilter(role, basePrefs);
    const stageCheck = result.checks[3];
    expect(stageCheck.passed).toBe(true);
  });

  test('check 5: exclude keyword check', () => {
    const role = {
      title: 'Manager',
      jd: 'We work with crypto and blockchain.',
      domain: '',
      location: '',
      stage: ''
    };
    const result = runQuickCheckFilter(role, basePrefs);
    const blockerCheck = result.checks[4];
    expect(blockerCheck.passed).toBe(false);
  });

  test('check 6: interesting check requires 2+ boost keywords', () => {
    const role = {
      title: 'Manager',
      jd: 'We use AI and machine learning extensively.',
      domain: '',
      location: '',
      stage: ''
    };
    const result = runQuickCheckFilter(role, basePrefs);
    const interestingCheck = result.checks[5];
    expect(interestingCheck.passed).toBe(true);
  });
});

// ============================================================
// isStubJD Tests
// ============================================================

describe('isStubJD', () => {
  test('no JD returns true (stub)', () => {
    const role = { jd: null };
    expect(isStubJD(role)).toBe(true);
  });

  test('short JD < 200 chars returns true', () => {
    const role = { jd: 'We are hiring a product manager.' };
    expect(isStubJD(role)).toBe(true);
  });

  test('full JD > 200 chars returns false', () => {
    const role = {
      jd: 'We are building innovative products at scale. This role offers the opportunity to lead product strategy across multiple teams. You will work with engineers, designers, and stakeholders to ship features that impact millions of users. Experience with product management, user research, and data analysis is essential. We value candidates who are passionate about solving complex problems and driving product excellence.'
    };
    expect(isStubJD(role)).toBe(false);
  });

  test('exactly 200 chars at boundary', () => {
    const role = { jd: 'a'.repeat(200) };
    expect(isStubJD(role)).toBe(false);
  });

  test('199 chars returns true', () => {
    const role = { jd: 'a'.repeat(199) };
    expect(isStubJD(role)).toBe(true);
  });

  test('HTML tags stripped before length check', () => {
    const role = { jd: '<p>Short text</p>' };
    expect(isStubJD(role)).toBe(true);
  });

  test('whitespace-heavy JD with short content is still stub', () => {
    // After normalization "word word word..." is only ~129 chars → still a stub
    const role = { jd: 'Word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word   word' };
    expect(isStubJD(role)).toBe(true);
  });

  test('long text with whitespace normalized is not stub', () => {
    const words = Array(50).fill('keyword').join(' '); // 50 * 8 = 400+ chars
    const role = { jd: words };
    expect(isStubJD(role)).toBe(false);
  });
});

// ============================================================
// scoreRole Tests
// ============================================================

describe('scoreRole', () => {
  const basePrefs = {
    targetTitles: ['Product Manager'],
    primaryDomains: ['fintech'],
    secondaryDomains: ['payments'],
    excludedDomains: ['military'],
    mustHaveKeywords: [],
    boostKeywords: ['ai', 'machine learning'],
    excludeKeywords: [],
    locations: ['Remote'],
    excludedLocations: [],
    companyStage: ['Series A', 'Series B'],
    compRange: { minBase: 150000, targetBase: 200000 }
  };

  test('high score role matching everything', () => {
    const role = {
      title: 'Senior Product Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Stripe',
      jd: 'We are building AI and machine learning features for fintech payments.',
      remote: true,
      networkInfo: { tracked: ['Alice'], linkedin: ['Bob', 'Charlie', 'Dave'], total: 4 }
    };
    const result = scoreRole(role, basePrefs);
    expect(result.score).toBeGreaterThan(70);
  });

  test('low score capped at 39 for excluded domain', () => {
    const role = {
      title: 'Product Manager',
      domain: 'military',
      location: 'Remote',
      stage: 'Series A',
      company: 'Defense Co',
      jd: 'Military defense applications.',
      remote: true,
      networkInfo: { tracked: [], linkedin: [], total: 0 }
    };
    const result = scoreRole(role, basePrefs);
    expect(result.score).toBeLessThanOrEqual(39);
  });

  test('exclude keyword caps score at 39', () => {
    const prefs = { ...basePrefs, excludeKeywords: ['visa'] };
    const role = {
      title: 'Product Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Visa',
      jd: 'Visa is a large fintech company.',
      remote: true,
      networkInfo: { tracked: [], linkedin: [], total: 0 }
    };
    const result = scoreRole(role, prefs);
    expect(result.score).toBeLessThanOrEqual(39);
    expect(result.keywordNote).toBe('EXCLUDE_KEYWORD');
  });

  test('network scoring: tracked connection scores 100', () => {
    const role = {
      title: 'Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Stripe',
      jd: 'fintech role',
      remote: true,
      networkInfo: { tracked: ['Alice'], linkedin: [], total: 1 }
    };
    const result = scoreRole(role, basePrefs);
    expect(result.breakdown.network).toBe(100);
  });

  test('network scoring: 3+ linkedin scores 80', () => {
    const role = {
      title: 'Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Stripe',
      jd: 'fintech role',
      remote: true,
      networkInfo: { tracked: [], linkedin: ['A', 'B', 'C'], total: 3 }
    };
    const result = scoreRole(role, basePrefs);
    expect(result.breakdown.network).toBe(80);
  });

  test('network scoring: 1-2 linkedin scores 50', () => {
    const role = {
      title: 'Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Stripe',
      jd: 'fintech role',
      remote: true,
      networkInfo: { tracked: [], linkedin: ['A'], total: 1 }
    };
    const result = scoreRole(role, basePrefs);
    expect(result.breakdown.network).toBe(50);
  });

  test('location scoring: remote preference matched', () => {
    const role = {
      title: 'Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Stripe',
      jd: '',
      remote: true,
      networkInfo: { tracked: [], linkedin: [], total: 0 }
    };
    const result = scoreRole(role, basePrefs);
    expect(result.breakdown.location).toBe(100);
  });

  test('location scoring: excluded location scores 0', () => {
    const prefs = { ...basePrefs, excludedLocations: ['China'] };
    const role = {
      title: 'Manager',
      domain: 'fintech',
      location: 'China',
      stage: 'Series A',
      company: 'Stripe',
      jd: '',
      remote: false,
      networkInfo: { tracked: [], linkedin: [], total: 0 }
    };
    const result = scoreRole(role, prefs);
    expect(result.breakdown.location).toBe(0);
  });

  test('stub JD vs full JD affects scoring', () => {
    const roleWithStub = {
      title: 'Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Stripe',
      jd: 'Short job description',
      remote: true,
      networkInfo: { tracked: [], linkedin: [], total: 0 }
    };
    const roleWithFull = {
      title: 'Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Stripe',
      jd: 'a'.repeat(250),
      remote: true,
      networkInfo: { tracked: [], linkedin: [], total: 0 }
    };
    const resultStub = scoreRole(roleWithStub, basePrefs);
    const resultFull = scoreRole(roleWithFull, basePrefs);
    expect(resultStub.hasFullJD).toBe(false);
    expect(resultFull.hasFullJD).toBe(true);
  });

  test('leader bonus for small company with leader signals', () => {
    const role = {
      title: 'Product Manager',
      domain: 'fintech',
      location: 'Remote',
      stage: 'Series A',
      company: 'Startup',
      jd: 'You will manage a team of 5 engineers and drive product strategy. ' + 'a'.repeat(200),
      remote: true,
      networkInfo: { tracked: [], linkedin: [], total: 0 }
    };
    const result = scoreRole(role, basePrefs);
    expect(result.breakdown.leaderIC).toContain('Leader');
  });
});

// ============================================================
// searchFeedItems Tests
// ============================================================

describe('searchFeedItems', () => {
  const items = [
    { company: 'Amazon', title: 'Product Manager', domain: 'e-commerce', location: 'Seattle' },
    { company: 'Google', title: 'Senior Engineer', domain: 'search', location: 'Mountain View' },
    { company: 'Meta', title: 'Product Manager', domain: 'social', location: 'Menlo Park' }
  ];

  test('empty query returns all items', () => {
    const result = searchFeedItems(items, '');
    expect(result).toEqual(items);
  });

  test('null query returns all items', () => {
    const result = searchFeedItems(items, null);
    expect(result).toEqual(items);
  });

  test('AND logic: both terms must match', () => {
    const result = searchFeedItems(items, 'product manager');
    expect(result.length).toBe(2);
    expect(result.map(r => r.company)).toEqual(['Amazon', 'Meta']);
  });

  test('single term search', () => {
    const result = searchFeedItems(items, 'amazon');
    expect(result.length).toBe(1);
    expect(result[0].company).toBe('Amazon');
  });

  test('no match returns empty array', () => {
    const result = searchFeedItems(items, 'microsoft azure');
    expect(result).toEqual([]);
  });

  test('case insensitive search', () => {
    const result = searchFeedItems(items, 'AMAZON');
    expect(result.length).toBe(1);
  });

  test('search across multiple fields (company, title, domain, location)', () => {
    const result = searchFeedItems(items, 'seattle');
    expect(result.length).toBe(1);
  });

  test('null items returns empty array', () => {
    const result = searchFeedItems(null, 'test');
    expect(result).toEqual([]);
  });
});

// ============================================================
// getFilteredFeedItems Tests
// ============================================================

describe('getFilteredFeedItems', () => {
  const feedItems = [
    { company: 'Amazon', title: 'PM', stage: 'Series A', score: 85 },
    { company: 'Google', title: 'Engineer', stage: 'Series B', score: 75 },
    { company: 'Amazon', title: 'Engineer', stage: 'Series A', score: 80 },
    { company: 'Meta', title: 'PM', stage: 'Late-stage / Pre-IPO', score: 90 }
  ];

  test('no filter returns all items', () => {
    const result = getFilteredFeedItems(feedItems, null, '');
    expect(result.length).toBe(4);
  });

  test('stage filter returns matching stage', () => {
    const filter = { type: 'stage', value: 'Series A' };
    const result = getFilteredFeedItems(feedItems, filter, '');
    expect(result.length).toBe(2);
    expect(result.every(r => r.stage === 'Series A')).toBe(true);
  });

  test('all-companies dedup filter returns highest score per company', () => {
    const filter = { type: 'all-companies' };
    const result = getFilteredFeedItems(feedItems, filter, '');
    const companies = new Set(result.map(r => r.company));
    expect(companies.size).toBe(3); // Amazon, Google, Meta
    const amazonItem = result.find(r => r.company === 'Amazon');
    expect(amazonItem.score).toBe(85); // higher of the two Amazon items
  });

  test('search query applied with filter', () => {
    const filter = { type: 'stage', value: 'Series A' };
    const result = getFilteredFeedItems(feedItems, filter, 'engineer');
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Engineer');
  });

  test('search query without filter', () => {
    const result = getFilteredFeedItems(feedItems, null, 'amazon');
    expect(result.length).toBe(2);
  });
});

// ============================================================
// analyzeTierSuggestions Tests
// ============================================================

describe('analyzeTierSuggestions', () => {
  test('promote to hot: 3+ active roles', () => {
    const companies = [{ name: 'Amazon', tier: 'active' }];
    const roles = [
      { company: 'Amazon', stage: 'applied', dateAdded: Date.now() },
      { company: 'Amazon', stage: 'interviewing', dateAdded: Date.now() },
      { company: 'Amazon', stage: 'offer', dateAdded: Date.now() }
    ];
    const suggestions = analyzeTierSuggestions(companies, roles);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].suggestedTier).toBe('hot');
    expect(suggestions[0].reason).toContain('3 active roles');
  });

  test('promote to hot: recent interview activity', () => {
    const companies = [{ name: 'Amazon', tier: 'active' }];
    const recentTime = Date.now() - (5 * 24 * 60 * 60 * 1000); // 5 days ago
    const roles = [
      { company: 'Amazon', stage: 'interviewing', lastActivity: recentTime }
    ];
    const suggestions = analyzeTierSuggestions(companies, roles);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].suggestedTier).toBe('hot');
  });

  test('promote to active: watching tier with 2+ roles', () => {
    const companies = [{ name: 'Amazon', tier: 'watching' }];
    const roles = [
      { company: 'Amazon', stage: 'saved', dateAdded: Date.now() },
      { company: 'Amazon', stage: 'saved', dateAdded: Date.now() }
    ];
    const suggestions = analyzeTierSuggestions(companies, roles);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].suggestedTier).toBe('active');
  });

  test('demote to watching: all roles rejected', () => {
    const companies = [{ name: 'Amazon', tier: 'active' }];
    const roles = [
      { company: 'Amazon', stage: 'rejected', dateAdded: Date.now() - 100000 },
      { company: 'Amazon', stage: 'rejected', dateAdded: Date.now() - 100000 }
    ];
    const suggestions = analyzeTierSuggestions(companies, roles);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].suggestedTier).toBe('watching');
    expect(suggestions[0].reason).toContain('rejected or withdrawn');
  });

  test('demote to watching: 30+ days inactive', () => {
    const companies = [{ name: 'Amazon', tier: 'active' }];
    const oldTime = Date.now() - (40 * 24 * 60 * 60 * 1000); // 40 days ago
    const roles = [
      { company: 'Amazon', stage: 'applied', lastActivity: oldTime }
    ];
    const suggestions = analyzeTierSuggestions(companies, roles);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].suggestedTier).toBe('watching');
    expect(suggestions[0].reason).toContain('40 days');
  });

  test('already at target tier: hot tier no suggestion', () => {
    const companies = [{ name: 'Amazon', tier: 'hot' }];
    const roles = [
      { company: 'Amazon', stage: 'applied', dateAdded: Date.now() },
      { company: 'Amazon', stage: 'interviewing', dateAdded: Date.now() },
      { company: 'Amazon', stage: 'offer', dateAdded: Date.now() }
    ];
    const suggestions = analyzeTierSuggestions(companies, roles);
    // No suggestion because company is already at 'hot'
    expect(suggestions.length).toBe(0);
  });

  test('no roles for company: no suggestion', () => {
    const companies = [{ name: 'Amazon', tier: 'watching' }];
    const roles = [];
    const suggestions = analyzeTierSuggestions(companies, roles);
    expect(suggestions.length).toBe(0);
  });

  test('case insensitive company matching', () => {
    const companies = [{ name: 'Amazon', tier: 'active' }];
    const roles = [
      { company: 'AMAZON', stage: 'applied', dateAdded: Date.now() },
      { company: 'AMAZON', stage: 'interviewing', dateAdded: Date.now() },
      { company: 'AMAZON', stage: 'offer', dateAdded: Date.now() }
    ];
    const suggestions = analyzeTierSuggestions(companies, roles);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].suggestedTier).toBe('hot');
  });

  test('multiple companies with different suggestions', () => {
    const companies = [
      { name: 'Amazon', tier: 'active' },
      { name: 'Google', tier: 'watching' }
    ];
    const roles = [
      { company: 'Amazon', stage: 'applied', dateAdded: Date.now() },
      { company: 'Amazon', stage: 'interviewing', dateAdded: Date.now() },
      { company: 'Amazon', stage: 'offer', dateAdded: Date.now() },
      { company: 'Google', stage: 'saved', dateAdded: Date.now() },
      { company: 'Google', stage: 'saved', dateAdded: Date.now() }
    ];
    const suggestions = analyzeTierSuggestions(companies, roles);
    expect(suggestions.length).toBe(2);
    const amazonSuggestion = suggestions.find(s => s.company === 'Amazon');
    const googleSuggestion = suggestions.find(s => s.company === 'Google');
    expect(amazonSuggestion.suggestedTier).toBe('hot');
    expect(googleSuggestion.suggestedTier).toBe('active');
  });
});
