/* ====================================================================
 * UNIT TESTS — comp-utils.js (Compensation Estimation Engine)
 * ====================================================================
 * Tests the classification-first comp estimator: stage normalization,
 * comp type detection, role archetype/level inference, calibration,
 * multiplier tables, salary extraction, and full estimation pipeline.
 *
 * Run: npm test -- --testPathPatterns=comp-utils
 * Coverage: npm test -- --coverage --testPathPatterns=comp-utils
 * ==================================================================== */

const {
  normalizeStage,
  detectCompType,
  detectRoleArchetype,
  inferPMLevel,
  getCalibrationMode,
  getBaseTCMultiplier,
  getTCCEquityAddon,
  calculateCompConfidence,
  cleanSalaryDecimals,
  extractSalaryFromJD,
  parseSalaryAndEstimate,
  formatComp,
} = require('../comp-utils');

/* ====== normalizeStage ====== */
describe('normalizeStage', () => {
  test('returns empty string for null/undefined', () => {
    expect(normalizeStage(null)).toBe('');
    expect(normalizeStage(undefined)).toBe('');
    expect(normalizeStage('')).toBe('');
  });

  test('maps "Series B+" to "Series B"', () => {
    expect(normalizeStage('Series B+')).toBe('Series B');
  });

  test('maps "Late-stage" to "Late-stage / Pre-IPO"', () => {
    expect(normalizeStage('Late-stage')).toBe('Late-stage / Pre-IPO');
  });

  test('maps "Pre-IPO" to "Late-stage / Pre-IPO"', () => {
    expect(normalizeStage('Pre-IPO')).toBe('Late-stage / Pre-IPO');
  });

  test('maps "Private" to "Bootstrapped"', () => {
    expect(normalizeStage('Private')).toBe('Bootstrapped');
  });

  test('passes through canonical stages unchanged', () => {
    expect(normalizeStage('Public')).toBe('Public');
    expect(normalizeStage('Seed')).toBe('Seed');
    expect(normalizeStage('Series A')).toBe('Series A');
    expect(normalizeStage('Series C+')).toBe('Series C+');
  });
});

/* ====== detectCompType ====== */
describe('detectCompType', () => {
  test('detects BASE_SALARY from "base salary" text', () => {
    expect(detectCompType('$200K-$300K base salary', '')).toBe('BASE_SALARY');
  });

  test('detects BASE_SALARY from "pay range" text', () => {
    expect(detectCompType('pay range $150K-$250K', '')).toBe('BASE_SALARY');
  });

  test('detects BASE_SALARY from JD text', () => {
    expect(detectCompType('$150K-$200K', 'The base compensation for this role is competitive')).toBe('BASE_SALARY');
  });

  test('detects OTE from strong signals', () => {
    expect(detectCompType('$200K-$400K', 'commission eligible, quota attainment')).toBe('OTE');
  });

  test('strong OTE wins over base salary', () => {
    expect(detectCompType('base salary $200K', 'quota attainment required')).toBe('OTE');
  });

  test('detects TOTAL_TARGET_CASH', () => {
    expect(detectCompType('$200K-$301K total target cash', '')).toBe('TOTAL_TARGET_CASH');
  });

  test('detects TCC from "inclusive of bonus"', () => {
    expect(detectCompType('$200K-$300K', 'inclusive of bonus or commission')).toBe('TOTAL_TARGET_CASH');
  });

  test('base salary overrides weak OTE', () => {
    // " ote " alone is weak; "base salary" should win
    expect(detectCompType('base salary $150K ote possible', '')).toBe('BASE_SALARY');
  });

  test('weak OTE matches when nothing else does', () => {
    expect(detectCompType('$200K ote ', '')).toBe('OTE');
  });

  test('returns UNKNOWN when no patterns match', () => {
    expect(detectCompType('$200K-$300K', '')).toBe('UNKNOWN');
  });

  test('handles null inputs gracefully', () => {
    expect(detectCompType(null, null)).toBe('UNKNOWN');
  });

  // Real-world regression: Zendesk JD mentions OTE in boilerplate
  test('Zendesk: base salary wins over boilerplate OTE mention', () => {
    const jd = 'the base salary range for this role is $148,500 - $313,700. base salary only (or OTE for commissions based roles)';
    expect(detectCompType('$148,500 - $313,700', jd)).toBe('BASE_SALARY');
  });
});

/* ====== detectRoleArchetype ====== */
describe('detectRoleArchetype', () => {
  test('detects MANAGER_PM from title and JD signals', () => {
    expect(detectRoleArchetype('Senior PM', 'manage a team of 5 engineers')).toBe('MANAGER_PM');
  });

  test('detects IC_PM from signals', () => {
    // Note: "no direct reports" substring-matches "direct reports" (a manager signal),
    // so we use only IC signals that don't contain manager substrings
    expect(detectRoleArchetype('Product Manager', 'this is an individual contributor role, hands-on ic')).toBe('IC_PM');
  });

  test('returns UNKNOWN when both signals present', () => {
    expect(detectRoleArchetype('PM Lead', 'manage a team, individual contributor')).toBe('UNKNOWN');
  });

  test('returns UNKNOWN when no signals', () => {
    expect(detectRoleArchetype('Product Manager', 'Build great products')).toBe('UNKNOWN');
  });

  test('handles null inputs', () => {
    expect(detectRoleArchetype(null, null)).toBe('UNKNOWN');
  });

  test('detects manager from "direct reports"', () => {
    expect(detectRoleArchetype('PM', 'will have 3-5 direct reports')).toBe('MANAGER_PM');
  });

  test('detects IC from "hands-on ic"', () => {
    expect(detectRoleArchetype('Staff PM', 'this is a hands-on ic role')).toBe('IC_PM');
  });
});

/* ====== inferPMLevel ====== */
describe('inferPMLevel', () => {
  test('returns "principal" for principal titles', () => {
    expect(inferPMLevel('Principal Product Manager', '')).toBe('principal');
    expect(inferPMLevel('Staff Product Manager', '')).toBe('principal');
    expect(inferPMLevel('Group PM, Payments', '')).toBe('principal');
    expect(inferPMLevel('Director of Product', '')).toBe('principal');
    expect(inferPMLevel('Head of Product', '')).toBe('principal');
  });

  test('returns "senior" for senior titles', () => {
    expect(inferPMLevel('Senior Product Manager', '')).toBe('senior');
    expect(inferPMLevel('Sr. Product Manager', '')).toBe('senior');
    expect(inferPMLevel('Sr Product Manager', '')).toBe('senior');
  });

  test('bumps senior to principal with reinforcement signals', () => {
    expect(inferPMLevel('Senior PM', 'requires 10+ years experience, multi-product ownership')).toBe('principal');
  });

  test('returns "mid" for generic PM titles', () => {
    expect(inferPMLevel('Product Manager', '')).toBe('mid');
    expect(inferPMLevel('Product Manager II', '')).toBe('mid');
  });

  test('handles null inputs', () => {
    expect(inferPMLevel(null, null)).toBe('mid');
  });
});

/* ====== getCalibrationMode ====== */
describe('getCalibrationMode', () => {
  test('PUBLIC_CALIBRATED for Public companies', () => {
    expect(getCalibrationMode('Public')).toBe('PUBLIC_CALIBRATED');
  });

  test('PUBLIC_CALIBRATED for Late-stage / Pre-IPO', () => {
    expect(getCalibrationMode('Late-stage / Pre-IPO')).toBe('PUBLIC_CALIBRATED');
  });

  test('PUBLIC_CALIBRATED for old "Pre-IPO" (via normalizeStage)', () => {
    expect(getCalibrationMode('Pre-IPO')).toBe('PUBLIC_CALIBRATED');
  });

  test('STARTUP_HEURISTIC for startup stages', () => {
    expect(getCalibrationMode('Seed')).toBe('STARTUP_HEURISTIC');
    expect(getCalibrationMode('Series A')).toBe('STARTUP_HEURISTIC');
    expect(getCalibrationMode('Series B')).toBe('STARTUP_HEURISTIC');
    expect(getCalibrationMode('Series C+')).toBe('STARTUP_HEURISTIC');
    expect(getCalibrationMode('Bootstrapped')).toBe('STARTUP_HEURISTIC');
  });

  test('STARTUP_HEURISTIC for old "Series B+" (via normalizeStage)', () => {
    expect(getCalibrationMode('Series B+')).toBe('STARTUP_HEURISTIC');
  });

  test('GENERIC_FALLBACK for unknown stages', () => {
    expect(getCalibrationMode('Unknown')).toBe('GENERIC_FALLBACK');
    expect(getCalibrationMode('')).toBe('GENERIC_FALLBACK');
  });
});

/* ====== getBaseTCMultiplier ====== */
describe('getBaseTCMultiplier', () => {
  test('returns array of [low, high] multipliers', () => {
    const result = getBaseTCMultiplier('PUBLIC_CALIBRATED', 'senior');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeLessThan(result[1]);
  });

  test('principal > senior > mid multipliers for PUBLIC_CALIBRATED', () => {
    const [pLow] = getBaseTCMultiplier('PUBLIC_CALIBRATED', 'principal');
    const [sLow] = getBaseTCMultiplier('PUBLIC_CALIBRATED', 'senior');
    const [mLow] = getBaseTCMultiplier('PUBLIC_CALIBRATED', 'mid');
    expect(pLow).toBeGreaterThan(sLow);
    expect(sLow).toBeGreaterThan(mLow);
  });

  test('public multipliers are higher than startup', () => {
    const [pubLow] = getBaseTCMultiplier('PUBLIC_CALIBRATED', 'senior');
    const [startLow] = getBaseTCMultiplier('STARTUP_HEURISTIC', 'senior');
    expect(pubLow).toBeGreaterThan(startLow);
  });

  test('all multipliers are > 1.0', () => {
    const modes = ['PUBLIC_CALIBRATED', 'STARTUP_HEURISTIC', 'GENERIC_FALLBACK'];
    const levels = ['mid', 'senior', 'principal'];
    for (const mode of modes) {
      for (const level of levels) {
        const [low, high] = getBaseTCMultiplier(mode, level);
        expect(low).toBeGreaterThan(1.0);
        expect(high).toBeGreaterThan(1.0);
      }
    }
  });
});

/* ====== getTCCEquityAddon ====== */
describe('getTCCEquityAddon', () => {
  test('returns array of [low, high] percentages', () => {
    const result = getTCCEquityAddon('PUBLIC_CALIBRATED', 'senior');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeLessThan(result[1]);
  });

  test('public equity addons are higher than startup', () => {
    const [pubLow] = getTCCEquityAddon('PUBLIC_CALIBRATED', 'senior');
    const [startLow] = getTCCEquityAddon('STARTUP_HEURISTIC', 'senior');
    expect(pubLow).toBeGreaterThan(startLow);
  });

  test('all percentages are between 0 and 1', () => {
    const modes = ['PUBLIC_CALIBRATED', 'STARTUP_HEURISTIC', 'GENERIC_FALLBACK'];
    const levels = ['mid', 'senior', 'principal'];
    for (const mode of modes) {
      for (const level of levels) {
        const [low, high] = getTCCEquityAddon(mode, level);
        expect(low).toBeGreaterThanOrEqual(0);
        expect(high).toBeLessThanOrEqual(1);
      }
    }
  });
});

/* ====== calculateCompConfidence ====== */
describe('calculateCompConfidence', () => {
  test('returns score and label', () => {
    const result = calculateCompConfidence('BASE_SALARY', 'PUBLIC_CALIBRATED', 'senior', 'Senior PM', 'A long JD text '.repeat(50), 'IC_PM');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('label');
  });

  test('High confidence for base salary + public + JD + known archetype', () => {
    const longJD = 'A detailed job description with many sections. '.repeat(20);
    const result = calculateCompConfidence('BASE_SALARY', 'PUBLIC_CALIBRATED', 'senior', 'Senior PM', longJD, 'IC_PM');
    expect(result.label).toBe('High');
    expect(result.score).toBeGreaterThanOrEqual(55);
  });

  test('Low confidence for UNKNOWN comp type + generic + no JD', () => {
    const result = calculateCompConfidence('UNKNOWN', 'GENERIC_FALLBACK', 'mid', 'PM', '', 'UNKNOWN');
    expect(result.label).toBe('Low');
    expect(result.score).toBeLessThan(35);
  });

  test('OTE reduces confidence', () => {
    const result = calculateCompConfidence('OTE', 'PUBLIC_CALIBRATED', 'senior', 'PM', '', 'UNKNOWN');
    expect(result.score).toBeLessThan(
      calculateCompConfidence('BASE_SALARY', 'PUBLIC_CALIBRATED', 'senior', 'PM', '', 'UNKNOWN').score
    );
  });

  test('longer JD adds more confidence than short JD', () => {
    const longJD = 'x'.repeat(500);
    const shortResult = calculateCompConfidence('BASE_SALARY', 'PUBLIC_CALIBRATED', 'senior', 'PM', '', 'IC_PM');
    const longResult = calculateCompConfidence('BASE_SALARY', 'PUBLIC_CALIBRATED', 'senior', 'PM', longJD, 'IC_PM');
    expect(longResult.score).toBeGreaterThan(shortResult.score);
  });
});

/* ====== cleanSalaryDecimals ====== */
describe('cleanSalaryDecimals', () => {
  test('removes .00 from salary strings', () => {
    expect(cleanSalaryDecimals('$148,600.00 - $237,400.00')).toBe('$148,600 - $237,400');
  });

  test('leaves non-.00 decimals alone', () => {
    expect(cleanSalaryDecimals('$148,600.50')).toBe('$148,600.50');
  });

  test('handles strings without decimals', () => {
    expect(cleanSalaryDecimals('$150K - $250K')).toBe('$150K - $250K');
  });
});

/* ====== extractSalaryFromJD ====== */
describe('extractSalaryFromJD', () => {
  test('returns null for short text', () => {
    expect(extractSalaryFromJD('too short')).toBeNull();
    expect(extractSalaryFromJD(null)).toBeNull();
  });

  test('extracts "base salary range...is $X - $Y" pattern', () => {
    const jd = 'x'.repeat(100) + ' The base salary range for this position is $148,500 - $313,700 annually.';
    const result = extractSalaryFromJD(jd);
    expect(result).toBe('$148,500 - $313,700');
  });

  test('extracts "pay range" pattern', () => {
    const jd = 'x'.repeat(100) + ' The pay range for this role is $180,000 - $250,000.';
    const result = extractSalaryFromJD(jd);
    expect(result).toContain('$180,000');
  });

  test('extracts "typical" pattern (Salesforce style)', () => {
    const jd = 'x'.repeat(100) + ' The typical starting salary range for this role is $140,000 - $220,000 annually.';
    const result = extractSalaryFromJD(jd);
    expect(result).toContain('$140,000');
  });

  test('extracts salary near context words', () => {
    const jd = 'x'.repeat(100) + ' Annual compensation $165,000 - $225,000 plus benefits.';
    const result = extractSalaryFromJD(jd);
    expect(result).toContain('$165,000');
  });

  test('strips .00 from extracted values', () => {
    const jd = 'x'.repeat(100) + ' Base salary range: $148,600.00 - $237,400.00';
    const result = extractSalaryFromJD(jd);
    expect(result).not.toContain('.00');
  });

  test('returns null when no salary found', () => {
    const jd = 'x'.repeat(200) + ' This is a great opportunity to work on exciting problems.';
    expect(extractSalaryFromJD(jd)).toBeNull();
  });
});

/* ====== parseSalaryAndEstimate ====== */
describe('parseSalaryAndEstimate', () => {
  test('returns null for empty salary', () => {
    expect(parseSalaryAndEstimate('', 'Public', 'PM', '')).toBeNull();
    expect(parseSalaryAndEstimate('Salary not listed', 'Public', 'PM', '')).toBeNull();
    expect(parseSalaryAndEstimate(null, 'Public', 'PM', '')).toBeNull();
  });

  test('returns null for unparseable salary', () => {
    expect(parseSalaryAndEstimate('competitive', 'Public', 'PM', '')).toBeNull();
  });

  test('parses "$200K-$300K" format correctly', () => {
    const result = parseSalaryAndEstimate('$200K-$300K', 'Public', 'Senior PM', '');
    expect(result).not.toBeNull();
    expect(result.rawMin).toBe(200000);
    expect(result.rawMax).toBe(300000);
  });

  test('parses "$148,600 - $237,400" format correctly', () => {
    const result = parseSalaryAndEstimate('$148,600 - $237,400', 'Public', 'PM', '');
    expect(result).not.toBeNull();
    expect(result.rawMin).toBe(148600);
    expect(result.rawMax).toBe(237400);
  });

  test('parses "$148,600.00 - $237,400.00" (decimal) format', () => {
    const result = parseSalaryAndEstimate('$148,600.00 - $237,400.00', 'Public', 'PM', '');
    expect(result).not.toBeNull();
    expect(result.rawMin).toBe(148600);
    expect(result.rawMax).toBe(237400);
  });

  test('normalizes K values (148 → 148000)', () => {
    const result = parseSalaryAndEstimate('$148K-$237K', 'Public', 'PM', '');
    expect(result.rawMin).toBe(148000);
    expect(result.rawMax).toBe(237000);
  });

  test('base salary estimation applies TC multiplier', () => {
    const result = parseSalaryAndEstimate('$200K-$300K base salary', 'Public', 'Senior PM', '');
    expect(result.compType).toBe('BASE_SALARY');
    expect(result.formulaUsed).toBe('base_to_tc');
    expect(result.estLow).toBeGreaterThan(200000);
    expect(result.estHigh).toBeGreaterThan(300000);
  });

  test('TCC estimation adds equity only (not full multiplier)', () => {
    const result = parseSalaryAndEstimate('$200K-$300K total target cash', 'Public', 'Senior PM', '');
    expect(result.compType).toBe('TOTAL_TARGET_CASH');
    expect(result.formulaUsed).toBe('tcc_plus_equity');
    // TCC + equity should be less than base * full TC multiplier
    const baseResult = parseSalaryAndEstimate('$200K-$300K base salary', 'Public', 'Senior PM', '');
    expect(result.estHigh).toBeLessThan(baseResult.estHigh);
  });

  test('OTE passes through unchanged', () => {
    const result = parseSalaryAndEstimate('$200K-$400K', 'Public', 'PM', 'on-target earnings, commission eligible');
    expect(result.compType).toBe('OTE');
    expect(result.formulaUsed).toBe('ote_passthrough');
    expect(result.estLow).toBe(200000);
    expect(result.estHigh).toBe(400000);
  });

  test('guardrail caps estimate at 1.65x posted max', () => {
    const result = parseSalaryAndEstimate('$100K-$150K base salary', 'Public', 'Principal PM', 'org-wide, 10+ years');
    // 150K * 1.65 = 247,500 — estHigh should not exceed this
    expect(result.estHigh).toBeLessThanOrEqual(Math.round(150000 * 1.65));
  });

  test('returns full metadata object', () => {
    const result = parseSalaryAndEstimate('$200K-$300K base salary', 'Series A', 'Senior PM', '');
    expect(result).toHaveProperty('rawMin');
    expect(result).toHaveProperty('rawMax');
    expect(result).toHaveProperty('estLow');
    expect(result).toHaveProperty('estHigh');
    expect(result).toHaveProperty('midpoint');
    expect(result).toHaveProperty('compType');
    expect(result).toHaveProperty('roleArchetype');
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('calibrationMode');
    expect(result).toHaveProperty('formulaUsed');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('stage');
  });

  test('midpoint is average of estLow and estHigh', () => {
    const result = parseSalaryAndEstimate('$200K-$300K base salary', 'Public', 'Senior PM', '');
    expect(result.midpoint).toBe(Math.round((result.estLow + result.estHigh) / 2));
  });

  test('stage normalization flows through', () => {
    const result = parseSalaryAndEstimate('$200K-$300K', 'Pre-IPO', 'PM', '');
    expect(result.stage).toBe('Late-stage / Pre-IPO');
    expect(result.calibrationMode).toBe('PUBLIC_CALIBRATED');
  });

  // Real-world regression test
  test('Zillow: handles decimal salary format', () => {
    const result = parseSalaryAndEstimate('$148,600.00 - $237,400.00', 'Public', 'Senior Product Manager', 'base salary range');
    expect(result).not.toBeNull();
    expect(result.compType).toBe('BASE_SALARY');
    expect(result.rawMin).toBe(148600);
    expect(result.rawMax).toBe(237400);
    expect(result.estHigh).toBeGreaterThan(237400);
  });
});

/* ====== formatComp ====== */
describe('formatComp', () => {
  test('formats number as $XK', () => {
    expect(formatComp(285)).toBe('$285K');
    expect(formatComp(150)).toBe('$150K');
    expect(formatComp(0)).toBe('$0K');
  });
});
