/* ====================================================================
 * FEED LOGIC — Scoring, filtering, dedup, and network matching
 * ====================================================================
 * Extracted from job-feed-listener/index.html for unit testing.
 * These are pure functions (no DOM, no localStorage) that drive the
 * feed's core business logic: how roles are scored, filtered, searched,
 * and deduplicated against the pipeline.
 *
 * IMPORTANT: The original inline versions in index.html remain
 * untouched to avoid regressions. These are testable copies only.
 * ==================================================================== */

// ============================================================
// NETWORK MATCHING
// ============================================================

/**
 * Find network connections at a given company.
 * Uses fuzzy matching (substring with min-length guard) to handle
 * "Amazon" matching "Amazon Ads", etc.
 *
 * @param {string} companyName - Target company name
 * @param {Array} linkedinNetwork - LinkedIn connections array
 * @param {Array} trackedConnections - Actively tracked connections array
 * @returns {{ tracked: string[], linkedin: string[], total: number }}
 */
function getNetworkAtCompany(companyName, linkedinNetwork, trackedConnections) {
  if (!companyName) return { tracked: [], linkedin: [], total: 0 };

  const companyLower = companyName.toLowerCase().trim();
  const MIN_SUBSTR_LEN = 4;

  const fuzzyMatch = (connCompany) => {
    if (!connCompany) return false;
    const connLower = connCompany.toLowerCase().trim();
    if (connLower === companyLower) return true;
    if (connLower.length >= MIN_SUBSTR_LEN && connLower.includes(companyLower)) return true;
    if (companyLower.length >= MIN_SUBSTR_LEN && connLower.length >= MIN_SUBSTR_LEN && companyLower.includes(connLower)) {
      const regex = new RegExp(`\\b${connLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(companyLower);
    }
    return false;
  };

  const tracked = trackedConnections
    .filter(c => fuzzyMatch(c.company))
    .map(c => c.name);

  const linkedin = linkedinNetwork
    .filter(c => fuzzyMatch(c.company))
    .map(c => c.name)
    .filter(name => !tracked.includes(name));

  return {
    tracked,
    linkedin,
    total: tracked.length + linkedin.length
  };
}

// ============================================================
// PIPELINE STATUS CHECK
// ============================================================

/**
 * Check if a feed item already exists in the Pipeline at a non-rejected stage.
 * Uses fuzzy company matching + specific role term matching.
 *
 * @param {Object} feedItem - Feed item with .company and .title
 * @param {Array} pipelineRoles - Array of pipeline role objects
 * @returns {{ inPipeline: boolean, stage: string|null, roleId: string|null }}
 */
function checkPipelineStatus(feedItem, pipelineRoles) {
  const companyLower = (feedItem.company || '').toLowerCase().trim();
  const titleLower = (feedItem.title || '').toLowerCase().trim();

  for (const role of pipelineRoles) {
    const roleCompanyLower = (role.company || '').toLowerCase().trim();
    const roleTitleLower = (role.title || '').toLowerCase().trim();

    const companyMatch = roleCompanyLower === companyLower ||
      (companyLower.length >= 4 && roleCompanyLower.includes(companyLower)) ||
      (roleCompanyLower.length >= 4 && companyLower.includes(roleCompanyLower));
    if (!companyMatch) continue;

    const specificRoleTerms = ['product manager', 'product management', 'head of product',
      'director of product', 'group product', 'data product',
      'technical product', 'principal product'];
    const sharedRoleTerm = specificRoleTerms.some(term =>
      titleLower.includes(term) && roleTitleLower.includes(term));
    const titleMatch = roleTitleLower.includes(titleLower) ||
      titleLower.includes(roleTitleLower) ||
      sharedRoleTerm;
    if (!titleMatch) continue;

    if (role.stage !== 'rejected') {
      return { inPipeline: true, stage: role.stage, roleId: role.id };
    }
  }

  return { inPipeline: false, stage: null, roleId: null };
}

// ============================================================
// DEDUP ENGINE (Levenshtein-based)
// ============================================================

/**
 * Edit distance (Levenshtein) for fuzzy title matching.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function editDistance(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check for duplicate roles across pipeline and feed.
 * Returns exact match, fuzzy match (edit distance < 3), or none.
 *
 * @param {string} company - Company name to check
 * @param {string} title - Title to check
 * @param {Array} allRoles - Combined pipeline + feed roles
 * @returns {{ type: 'exact'|'fuzzy'|'none', existingRole?: Object, distance?: number }}
 */
function checkDedup(company, title, allRoles) {
  const exactMatch = allRoles.find(r =>
    r.company.toLowerCase() === company.toLowerCase() &&
    r.title.toLowerCase() === title.toLowerCase()
  );

  if (exactMatch) {
    return { type: 'exact', existingRole: exactMatch };
  }

  const fuzzyMatch = allRoles.find(r => {
    const sameCompany = r.company.toLowerCase() === company.toLowerCase();
    const distance = editDistance(r.title, title);
    return sameCompany && distance < 3;
  });

  if (fuzzyMatch) {
    return {
      type: 'fuzzy',
      existingRole: fuzzyMatch,
      distance: editDistance(fuzzyMatch.title, title)
    };
  }

  return { type: 'none' };
}

// ============================================================
// PIPELINE DEDUP (word-overlap based)
// ============================================================

/**
 * Check if a feed item duplicates a pipeline role using word overlap.
 * Different from checkDedup — uses normalized word sets instead of edit distance.
 *
 * @param {Object} feedItem - Feed item with .company and .title
 * @param {Array} pipelineRoles - Pipeline roles array
 * @returns {{ isDuplicate: boolean, matchType: 'exact'|'fuzzy'|null, matchedRole: Object|null }}
 */
function checkPipelineDedup(feedItem, pipelineRoles) {
  if (!feedItem || !pipelineRoles || pipelineRoles.length === 0) {
    return { isDuplicate: false, matchType: null, matchedRole: null };
  }

  const feedCompany = (feedItem.company || '').toLowerCase().trim();
  const feedTitle = (feedItem.title || '').toLowerCase().trim();

  // Exact match
  for (const role of pipelineRoles) {
    const roleCompany = (role.company || '').toLowerCase().trim();
    const roleTitle = (role.title || '').toLowerCase().trim();

    if (feedCompany === roleCompany && feedTitle === roleTitle) {
      return { isDuplicate: true, matchType: 'exact', matchedRole: role };
    }
  }

  // Fuzzy match via word overlap
  const normalizeTitleForFuzzy = (title) => {
    return title
      .toLowerCase()
      .replace(/\b(senior|staff|lead|principal|junior|jr|sr|v\.p|vp|vice president)\b/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);
  };

  const feedWords = new Set(normalizeTitleForFuzzy(feedTitle));
  for (const role of pipelineRoles) {
    const roleCompany = (role.company || '').toLowerCase().trim();
    if (feedCompany !== roleCompany) continue;

    const roleWords = new Set(normalizeTitleForFuzzy(role.title));
    if (feedWords.size === 0 || roleWords.size === 0) continue;

    const intersection = new Set([...feedWords].filter(w => roleWords.has(w)));
    const overlap = intersection.size / Math.max(feedWords.size, roleWords.size);

    if (overlap >= 0.6) {
      return { isDuplicate: true, matchType: 'fuzzy', matchedRole: role };
    }
  }

  return { isDuplicate: false, matchType: null, matchedRole: null };
}

// ============================================================
// QUICK-CHECK FILTER
// ============================================================

/**
 * Helper: normalize company stage strings to canonical values.
 */
function normalizeStage(stage) {
  if (!stage) return '';
  const map = {
    'Series B+': 'Series B',
    'Late-stage': 'Late-stage / Pre-IPO',
    'Pre-IPO': 'Late-stage / Pre-IPO',
    'Private': 'Bootstrapped'
  };
  return map[stage] || stage;
}

/**
 * Quick-check filter: 6-point binary filter. Must pass 5/6.
 * Tier 1 companies bypass this filter in practice (not enforced here).
 *
 * @param {Object} role - Role with .title, .jd, .domain, .location, .stage, .remote
 * @param {Object} prefs - User preferences
 * @returns {{ passed: boolean, passCount: number, totalChecks: number, checks: Array }}
 */
function runQuickCheckFilter(role, prefs) {
  const jdLower = role.jd ? role.jd.toLowerCase() : '';
  const titleLower = role.title ? role.title.toLowerCase() : '';
  const domainLower = role.domain ? role.domain.toLowerCase() : '';

  const checks = [];

  // Check 1: Level appropriate?
  const seniorityWords = ['senior', 'staff', 'principal', 'director', 'vp', 'head'];
  const hasTargetSeniority = seniorityWords.some(word => titleLower.includes(word));
  checks.push({ name: 'Level appropriate?', passed: hasTargetSeniority, description: titleLower });

  // Check 2: Domain relevant?
  const primaryDomainsLower = (prefs.primaryDomains || []).map(d => d.toLowerCase());
  const secondaryDomainsLower = (prefs.secondaryDomains || []).map(d => d.toLowerCase());
  const hasDomainMatch = primaryDomainsLower.some(d => jdLower.includes(d) || domainLower.includes(d)) ||
    secondaryDomainsLower.some(d => jdLower.includes(d) || domainLower.includes(d));
  checks.push({ name: 'Domain relevant?', passed: hasDomainMatch, description: domainLower || role.domain });

  // Check 3: Location OK?
  const prefsLocations = prefs.locations || [];
  const excludedLocations = prefs.excludedLocations || [];
  const inExcludedLocation = excludedLocations.some(loc =>
    role.location ? role.location.toLowerCase().includes(loc.toLowerCase()) : false
  );
  const qcRoleLocation = (role.location || '').toLowerCase();
  const qcJdText = (role.jd || '').toLowerCase();
  const qcIsRemote = role.remote ||
    qcRoleLocation.includes('remote') ||
    /\b(remote|work from home|wfh|fully remote|remote-first)\b/i.test(qcJdText);
  const locationOK = !inExcludedLocation && (
    (prefsLocations.includes('Remote') && qcIsRemote) ||
    (role.location && prefsLocations.some(loc =>
      role.location.toLowerCase().includes(loc.toLowerCase())
    ))
  );
  checks.push({ name: 'Location OK?', passed: locationOK, description: role.location || 'Not specified' });

  // Check 4: Company stage OK?
  const preferredStages = prefs.companyStage || [];
  const stageOK = preferredStages.length === 0 || preferredStages.includes(normalizeStage(role.stage));
  checks.push({ name: 'Company stage OK?', passed: stageOK, description: role.stage || 'Not specified' });

  // Check 5: No hard blockers?
  const excludeKeywordsLower = (prefs.excludeKeywords || []).map(k => k.toLowerCase());
  const hasExcludeKeyword = excludeKeywordsLower.some(k =>
    jdLower.includes(k) || titleLower.includes(k)
  );
  checks.push({ name: 'No hard blockers?', passed: !hasExcludeKeyword, description: hasExcludeKeyword ? 'Found exclude keyword' : 'Clear' });

  // Check 6: Interesting problem?
  const boostKeywordsLower = (prefs.boostKeywords || []).map(k => k.toLowerCase());
  const boostCount = boostKeywordsLower.filter(k => jdLower.includes(k)).length;
  const isInteresting = boostCount >= 2;
  checks.push({ name: 'Interesting? (2+ boost keywords)', passed: isInteresting, description: `Found ${boostCount} boost keywords` });

  const passCount = checks.filter(c => c.passed).length;
  return { passed: passCount >= 5, passCount, totalChecks: checks.length, checks };
}

// ============================================================
// SCORING ENGINE
// ============================================================

/**
 * Helper: detect if a role has only a stub JD (< 200 chars meaningful text).
 */
function isStubJD(role) {
  if (!role.jd) return true;
  const stripped = role.jd.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return stripped.length < 200;
}

/**
 * Score a role against user preferences (0-100).
 * JD-first scoring: when a full JD is available, all keyword matching
 * scans the JD text. With stub JD, falls back to title-only.
 *
 * Dimensions: Title(20%), Domain(20%), Keywords(15%), Location(15%),
 * Network(15%), Stage(10%), Comp(5%) + Leader/IC bonus.
 *
 * @param {Object} role - Role object
 * @param {Object} prefs - User preferences
 * @param {Function} [parseSalaryAndEstimate] - Optional comp estimation function
 * @returns {Object|null} { score, breakdown, hasFullJD, keywordNote, quickCheck }
 */
function scoreRole(role, prefs, parseSalaryAndEstimate) {
  const hasFullJD = !isStubJD(role);
  const jdText = (role.jd || '').toLowerCase();
  const titleLower = (role.title || '').toLowerCase();
  const domainLower = (role.domain || '').toLowerCase();
  const searchText = hasFullJD
    ? jdText
    : (titleLower + ' ' + (role.company || '').toLowerCase() + ' ' + domainLower);

  // DIMENSION 1: Role Fit (20%)
  let titleScore = 0;
  const targetTitlesLower = (prefs.targetTitles || []).map(t => t.toLowerCase());
  const seniorityWords = ['senior', 'staff', 'principal', 'director', 'vp', 'head'];

  if (hasFullJD) {
    const titleInTitle = targetTitlesLower.some(t => titleLower.includes(t));
    const titleInJD = targetTitlesLower.some(t => searchText.includes(t));
    const hasSeniority = seniorityWords.some(w => titleLower.includes(w) || searchText.includes(w));
    if (titleInTitle) titleScore = 100;
    else if (titleInJD) titleScore = 75;
    else if (hasSeniority) titleScore = 50;
  } else {
    const exactTitleMatch = targetTitlesLower.some(t => titleLower.includes(t));
    const hasTargetSeniority = seniorityWords.some(word => titleLower.includes(word));
    if (exactTitleMatch) titleScore = 100;
    else if (hasTargetSeniority) titleScore = 50;
  }
  const titleDim = titleScore * 0.20;

  // DIMENSION 2: Domain Match (20%)
  let domainScore = 0;
  const primaryDomainsLower = (prefs.primaryDomains || []).map(d => d.toLowerCase());
  const secondaryDomainsLower = (prefs.secondaryDomains || []).map(d => d.toLowerCase());
  const excludedDomainsLower = (prefs.excludedDomains || []).map(d => d.toLowerCase());

  const hasExcludedDomain = excludedDomainsLower.some(d =>
    domainLower.includes(d) || searchText.includes(d)
  );
  if (hasExcludedDomain) {
    domainScore = 0;
  } else {
    const hasPrimaryDomain = primaryDomainsLower.some(d => domainLower.includes(d) || searchText.includes(d));
    const hasSecondaryDomain = secondaryDomainsLower.some(d => domainLower.includes(d) || searchText.includes(d));
    if (hasPrimaryDomain) domainScore = 100;
    else if (hasSecondaryDomain) domainScore = 50;
  }
  const domainDim = domainScore * 0.20;

  // DIMENSION 3: Keyword Relevance (15%)
  let keywordScore = 0;
  let keywordNote = '';
  const excludeKeywordsLower = (prefs.excludeKeywords || []).map(k => k.toLowerCase());
  const hasExcludeKeyword = excludeKeywordsLower.some(k =>
    searchText.includes(k) || titleLower.includes(k)
  );

  if (hasExcludeKeyword) {
    keywordScore = 0;
    keywordNote = 'EXCLUDE_KEYWORD';
  } else {
    const mustHaveKWLower = (prefs.mustHaveKeywords || []).map(k => k.toLowerCase());
    const mustHaveMatches = mustHaveKWLower.filter(k =>
      searchText.includes(k) || titleLower.includes(k)
    ).length;
    const mustHaveTotal = mustHaveKWLower.length;
    const mustHaveRatio = mustHaveTotal > 0 ? mustHaveMatches / mustHaveTotal : 1;

    const boostKeywordsLower = (prefs.boostKeywords || []).map(k => k.toLowerCase());
    const boostCount = boostKeywordsLower.filter(k =>
      searchText.includes(k) || titleLower.includes(k)
    ).length;
    const boostScore = boostCount === 0 ? 0 : Math.min(boostCount * 20, 100);

    keywordScore = Math.round((mustHaveRatio * 100 * 0.6) + (boostScore * 0.4));
    if (mustHaveTotal > 0 && mustHaveMatches < mustHaveTotal) {
      keywordNote = 'MISSING_MUST_HAVE';
    }
  }
  const keywordDim = keywordScore * 0.15;

  // DIMENSION 4: Location Match (15%)
  let locationScore = 0;
  const prefsLocations = prefs.locations || [];
  const excludedLocations = prefs.excludedLocations || [];
  const roleLocation = (role.location || '').toLowerCase();
  const inExcludedLocation = excludedLocations.some(loc =>
    roleLocation.includes(loc.toLowerCase())
  );
  const isRemoteRole = role.remote ||
    roleLocation.includes('remote') ||
    (hasFullJD && /\b(remote|work from home|wfh|fully remote|remote-first)\b/i.test(jdText));

  if (inExcludedLocation) {
    locationScore = 0;
  } else if (prefsLocations.includes('Remote') && isRemoteRole) {
    locationScore = 100;
  } else if (roleLocation && prefsLocations.some(loc =>
    roleLocation.includes(loc.toLowerCase())
  )) {
    locationScore = 100;
  } else if (isRemoteRole) {
    locationScore = 50;
  }
  const locationDim = locationScore * 0.15;

  // DIMENSION 5: Company Stage (10%)
  let stageScore = 0;
  const preferredStages = prefs.companyStage || [];
  const normalizedRoleStage = normalizeStage(role.stage);
  if (preferredStages.includes(normalizedRoleStage)) stageScore = 100;
  else if (preferredStages.length === 0) stageScore = 100;
  else stageScore = 30;
  const stageDim = stageScore * 0.10;

  // DIMENSION 6: Compensation Signal (5%)
  let compScore = 50; // default: neutral
  if (parseSalaryAndEstimate) {
    const compEstimate = parseSalaryAndEstimate(role.salary, normalizedRoleStage, role.title, role.jd);
    const minBase = prefs.compRange?.minBase || 0;
    const targetTotal = prefs.compRange?.targetBase || 0;
    if (!compEstimate) {
      compScore = 50;
    } else {
      const estimatedMaxTotal = compEstimate.estHigh;
      if (estimatedMaxTotal >= targetTotal) compScore = 100;
      else if (estimatedMaxTotal >= minBase) compScore = 70;
      else compScore = 0;
    }
  }
  const compDim = compScore * 0.05;

  // DIMENSION 7: Network Signal (15%)
  let networkScore = 0;
  const networkInfo = role.networkInfo;
  if (networkInfo && networkInfo.total > 0) {
    if (networkInfo.tracked.length > 0) networkScore = 100;
    else if (networkInfo.linkedin.length >= 3) networkScore = 80;
    else networkScore = 50;
  }
  const networkDim = networkScore * 0.15;

  // BONUS: Leader vs IC
  let leaderICBonus = 0;
  let leaderICNote = '';
  const leaderSignals = [
    'manage a team', 'direct reports', 'lead a team', 'people management',
    'hire and develop', 'org building', 'team of', 'build the team',
    'player-coach', 'people leader', 'manage engineers', 'manage designers',
    'manage product managers', 'growing the team', 'staff management',
    'mentor and coach', 'reporting to you', 'build and lead'
  ];
  const icSignals = [
    'individual contributor', ' ic role', ' ic position', 'no direct reports',
    'hands-on ic', 'deep technical', 'principal ic', 'staff-level ic'
  ];

  const isSmallCompany = ['Seed', 'Series A', 'Series B'].includes(normalizedRoleStage);
  const hasLeaderSignals = leaderSignals.some(s => searchText.includes(s) || titleLower.includes(s));
  const hasICSignals = icSignals.some(s => searchText.includes(s) || titleLower.includes(s));

  if (isSmallCompany && hasLeaderSignals) { leaderICBonus = 5; leaderICNote = 'Leader@Small'; }
  else if (isSmallCompany && hasICSignals) { leaderICBonus = 0; leaderICNote = 'IC@Small'; }
  else if (hasLeaderSignals) { leaderICBonus = 2; leaderICNote = 'Leader'; }
  else if (hasICSignals) { leaderICBonus = 0; leaderICNote = 'IC'; }

  // FINAL SCORE
  let finalScore = titleDim + domainDim + keywordDim + locationDim + networkDim + stageDim + compDim + leaderICBonus;
  finalScore = Math.round(finalScore);

  // Hard caps
  if (hasExcludedDomain || keywordNote === 'EXCLUDE_KEYWORD') {
    finalScore = Math.min(finalScore, 39);
  }

  const quickCheck = runQuickCheckFilter(role, prefs);

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    breakdown: {
      title: Math.round(titleScore),
      domain: Math.round(domainScore),
      keywords: Math.round(keywordScore),
      location: Math.round(locationScore),
      network: Math.round(networkScore),
      stage: Math.round(stageScore),
      comp: Math.round(compScore),
      leaderIC: leaderICNote
    },
    hasFullJD,
    keywordNote,
    quickCheck
  };
}

// ============================================================
// SEARCH
// ============================================================

/**
 * Search feed items by query (AND logic across terms).
 *
 * @param {Array} items - Feed items to search
 * @param {string} query - Search query
 * @returns {Array} Filtered items
 */
function searchFeedItems(items, query) {
  if (!query || !items) return items || [];

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;

  return items.filter(item => {
    const blob = [
      item.company, item.title, item.domain, item.location,
      item.source, item.salary, item.stage,
      item.jd ? item.jd.substring(0, 2000) : '',
      item.scoring?.leaderIC,
      ...(item.scoring?.matchedKeywords || []),
    ].filter(Boolean).join(' ').toLowerCase();

    return terms.every(term => blob.includes(term));
  });
}

// ============================================================
// FILTERED FEED ITEMS
// ============================================================

/**
 * Get filtered feed items after applying stat filter + search.
 *
 * @param {Array} feedItems - All feed items
 * @param {Object|null} activeFilter - { type, value } or null
 * @param {string} searchQuery - Current search query
 * @returns {Array} Filtered items
 */
function getFilteredFeedItems(feedItems, activeFilter, searchQuery) {
  let items = feedItems;

  if (searchQuery) {
    items = searchFeedItems(items, searchQuery);
  }

  if (!activeFilter) return items;

  if (activeFilter.type === 'stage') {
    return items.filter(item => {
      const stage = normalizeStage(item.stage) || 'Unknown';
      return stage === activeFilter.value;
    });
  }

  if (activeFilter.type === 'all-companies') {
    const seen = new Map();
    items.forEach(item => {
      const key = (item.company || '').toLowerCase().trim();
      if (!seen.has(key) || item.score > seen.get(key).score) {
        seen.set(key, item);
      }
    });
    return Array.from(seen.values());
  }

  return items;
}

// ============================================================
// TIER SUGGESTIONS
// ============================================================

/**
 * Analyze company activity and suggest tier promotions/demotions.
 *
 * @param {Array} companies - Company objects with .name, .tier
 * @param {Array} roles - Pipeline role objects
 * @returns {Array} Suggestion objects with {company, currentTier, suggestedTier, reason, action}
 */
function analyzeTierSuggestions(companies, roles) {
  const suggestions = [];
  const now = new Date().getTime();

  companies.forEach(company => {
    const companyRoles = roles.filter(r =>
      r.company.toLowerCase() === company.name.toLowerCase()
    );

    const activeRoles = companyRoles.filter(r =>
      ['applied', 'interviewing', 'offer'].includes(r.stage)
    );
    const discardedRoles = companyRoles.filter(r =>
      ['rejected', 'withdrawn'].includes(r.stage)
    );

    const recentRole = companyRoles.length > 0
      ? companyRoles.reduce((latest, role) =>
        (role.lastActivity || role.dateAdded || 0) > (latest.lastActivity || latest.dateAdded || 0)
          ? role : latest
      )
      : null;
    const lastActivityMs = recentRole ? (recentRole.lastActivity || recentRole.dateAdded || 0) : 0;
    const daysSinceActivity = Math.floor((now - lastActivityMs) / (24 * 60 * 60 * 1000));

    let suggestion = null;

    // PROMOTION TRIGGERS
    if (company.tier !== 'hot') {
      if (activeRoles.length >= 3) {
        suggestion = {
          company: company.name, currentTier: company.tier,
          suggestedTier: 'hot', reason: `${activeRoles.length} active roles in progress`,
          action: 'promoteToHot'
        };
      } else if (activeRoles.some(r => r.stage === 'interviewing') && daysSinceActivity <= 7) {
        suggestion = {
          company: company.name, currentTier: company.tier,
          suggestedTier: 'hot', reason: 'Recent interview activity',
          action: 'promoteToHot'
        };
      } else if (company.tier === 'watching' && companyRoles.length >= 2) {
        suggestion = {
          company: company.name, currentTier: company.tier,
          suggestedTier: 'active', reason: `${companyRoles.length} roles at this company`,
          action: 'promoteToActive'
        };
      }
    }

    // DEMOTION TRIGGERS
    if (!suggestion && company.tier !== 'watching') {
      if (companyRoles.length > 0 && discardedRoles.length === companyRoles.length) {
        suggestion = {
          company: company.name, currentTier: company.tier,
          suggestedTier: 'watching', reason: 'All roles rejected or withdrawn',
          action: 'demoteToWatching'
        };
      } else if (daysSinceActivity > 30 && companyRoles.length > 0) {
        suggestion = {
          company: company.name, currentTier: company.tier,
          suggestedTier: 'watching', reason: `No activity for ${daysSinceActivity} days`,
          action: 'demoteToWatching'
        };
      }
    }

    if (suggestion) suggestions.push(suggestion);
  });

  return suggestions;
}

// ============================================================
// EXPORTS
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
  };
}
