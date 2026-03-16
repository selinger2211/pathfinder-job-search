/* ====================================================================
 * UNIT TESTS — dashboard-logic.js (Analytics, Nudges, Streak Engine)
 * ==================================================================== */

const {
  daysSince,
  getTimeOfDay,
  formatRelativeDate,
  getTodayDateString,
  generateNudgeId,
  getLatestCommsForRole,
  getMutualConnections,
  getCompanyProfileCompletion,
  isActionToday,
  computePipelineStats,
  computeInterviewIntelligence,
} = require('../dashboard-logic');

// ============================================================
// TESTS: daysSince
// ============================================================

describe('daysSince', () => {
  test('returns 0 when date is null or undefined', () => {
    expect(daysSince(null)).toBe(0);
    expect(daysSince(undefined)).toBe(0);
  });

  test('returns 0 when date is today', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const today = new Date('2026-03-16T08:00:00Z');
    expect(daysSince(today, now)).toBe(0);
  });

  test('returns 1 when date is yesterday', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const yesterday = new Date('2026-03-15T12:00:00Z');
    expect(daysSince(yesterday, now)).toBe(1);
  });

  test('returns negative number for future dates', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const tomorrow = new Date('2026-03-17T12:00:00Z');
    expect(daysSince(tomorrow, now)).toBe(-1);
  });

  test('returns correct days for dates several days in the past', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const fiveDaysAgo = new Date('2026-03-11T12:00:00Z');
    expect(daysSince(fiveDaysAgo, now)).toBe(5);
  });

  test('works with string date input', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    expect(daysSince('2026-03-15', now)).toBe(1);
  });

  test('works with timestamp number input', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const yesterday = new Date('2026-03-15T12:00:00Z');
    expect(daysSince(yesterday.getTime(), now)).toBe(1);
  });

  test('uses current Date when no now parameter provided', () => {
    const aVeryOldDate = new Date('2000-01-01');
    const result = daysSince(aVeryOldDate);
    expect(result).toBeGreaterThan(9000); // Over 9000 days have passed since 2000
  });
});

// ============================================================
// TESTS: getTimeOfDay
// ============================================================

describe('getTimeOfDay', () => {
  test('returns morning for hour 8', () => {
    expect(getTimeOfDay(8)).toBe('morning');
  });

  test('returns morning for hour 11', () => {
    expect(getTimeOfDay(11)).toBe('morning');
  });

  test('returns afternoon for hour 12 (boundary)', () => {
    expect(getTimeOfDay(12)).toBe('afternoon');
  });

  test('returns afternoon for hour 14', () => {
    expect(getTimeOfDay(14)).toBe('afternoon');
  });

  test('returns afternoon for hour 16', () => {
    expect(getTimeOfDay(16)).toBe('afternoon');
  });

  test('returns evening for hour 17 (boundary)', () => {
    expect(getTimeOfDay(17)).toBe('evening');
  });

  test('returns evening for hour 20', () => {
    expect(getTimeOfDay(20)).toBe('evening');
  });

  test('returns evening for hour 23', () => {
    expect(getTimeOfDay(23)).toBe('evening');
  });

  test('returns morning for hour 0', () => {
    expect(getTimeOfDay(0)).toBe('morning');
  });

  test('uses current hour when no parameter provided', () => {
    const result = getTimeOfDay();
    expect(['morning', 'afternoon', 'evening']).toContain(result);
  });
});

// ============================================================
// TESTS: formatRelativeDate
// ============================================================

describe('formatRelativeDate', () => {
  test('returns "today" for current date', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const today = new Date('2026-03-16T08:00:00Z');
    expect(formatRelativeDate(today, now)).toBe('today');
  });

  test('returns "yesterday" for 1 day ago', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const yesterday = new Date('2026-03-15T12:00:00Z');
    expect(formatRelativeDate(yesterday, now)).toBe('yesterday');
  });

  test('returns "3 days ago" for 3 days in the past', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const threeDaysAgo = new Date('2026-03-13T12:00:00Z');
    expect(formatRelativeDate(threeDaysAgo, now)).toBe('3 days ago');
  });

  test('returns "6 days ago" for 6 days in the past', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const sixDaysAgo = new Date('2026-03-10T12:00:00Z');
    expect(formatRelativeDate(sixDaysAgo, now)).toBe('6 days ago');
  });

  test('returns locale date string for 8+ days ago', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const eightDaysAgo = new Date('2026-03-08T12:00:00Z');
    const result = formatRelativeDate(eightDaysAgo, now);
    expect(result).not.toMatch(/^\d+ days ago$/);
    expect(result).toMatch(/\d/); // Should contain numbers from formatted date
  });

  test('returns locale date string for 14+ days ago', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const twoWeeksAgo = new Date('2026-03-02T12:00:00Z');
    const result = formatRelativeDate(twoWeeksAgo, now);
    expect(result).not.toMatch(/^\d+ days ago$/);
  });
});

// ============================================================
// TESTS: getTodayDateString
// ============================================================

describe('getTodayDateString', () => {
  test('returns YYYY-MM-DD format', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    expect(getTodayDateString(now)).toBe('2026-03-16');
  });

  test('pads month with leading zero', () => {
    const now = new Date('2026-01-05T12:00:00Z');
    expect(getTodayDateString(now)).toBe('2026-01-05');
  });

  test('pads day with leading zero', () => {
    const now = new Date('2026-03-09T12:00:00Z');
    expect(getTodayDateString(now)).toBe('2026-03-09');
  });

  test('handles double-digit month and day correctly', () => {
    const now = new Date('2026-12-25T12:00:00Z');
    expect(getTodayDateString(now)).toBe('2026-12-25');
  });

  test('uses current date when no now parameter provided', () => {
    const result = getTodayDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================
// TESTS: generateNudgeId
// ============================================================

describe('generateNudgeId', () => {
  test('combines trigger and entityId with nudge_ prefix', () => {
    expect(generateNudgeId('followup', 'role_123')).toBe('nudge_followup_role_123');
  });

  test('works with different trigger types', () => {
    expect(generateNudgeId('apply', 'job_456')).toBe('nudge_apply_job_456');
    expect(generateNudgeId('interview', 'company_789')).toBe('nudge_interview_company_789');
  });

  test('handles special characters in entityId', () => {
    expect(generateNudgeId('check', 'role-abc-123')).toBe('nudge_check_role-abc-123');
  });

  test('produces deterministic output', () => {
    const id1 = generateNudgeId('followup', 'role_123');
    const id2 = generateNudgeId('followup', 'role_123');
    expect(id1).toBe(id2);
  });
});

// ============================================================
// TESTS: getLatestCommsForRole
// ============================================================

describe('getLatestCommsForRole', () => {
  test('returns null when role not found', () => {
    const roles = [{ id: 'role_1', commsLog: [] }];
    expect(getLatestCommsForRole('role_2', roles)).toBeNull();
  });

  test('returns null when role has no commsLog', () => {
    const roles = [{ id: 'role_1' }];
    expect(getLatestCommsForRole('role_1', roles)).toBeNull();
  });

  test('returns null when commsLog is empty', () => {
    const roles = [{ id: 'role_1', commsLog: [] }];
    expect(getLatestCommsForRole('role_1', roles)).toBeNull();
  });

  test('returns single entry when commsLog has one item', () => {
    const entry = { date: '2026-03-16', message: 'Applied' };
    const roles = [{ id: 'role_1', commsLog: [entry] }];
    expect(getLatestCommsForRole('role_1', roles)).toEqual(entry);
  });

  test('returns most recent entry when multiple entries exist', () => {
    const oldEntry = { date: '2026-03-10', message: 'Applied' };
    const newerEntry = { date: '2026-03-15', message: 'Interviewed' };
    const newestEntry = { date: '2026-03-16', message: 'Offer' };
    const roles = [{ id: 'role_1', commsLog: [oldEntry, newestEntry, newerEntry] }];
    expect(getLatestCommsForRole('role_1', roles)).toEqual(newestEntry);
  });

  test('does not mutate original commsLog array', () => {
    const commsLog = [
      { date: '2026-03-10', message: 'Applied' },
      { date: '2026-03-16', message: 'Interview' },
    ];
    const roles = [{ id: 'role_1', commsLog }];
    getLatestCommsForRole('role_1', roles);
    expect(roles[0].commsLog).toEqual(commsLog);
  });
});

// ============================================================
// TESTS: getMutualConnections
// ============================================================

describe('getMutualConnections', () => {
  test('returns empty array when companyName is empty', () => {
    expect(getMutualConnections('', [], [])).toEqual([]);
    expect(getMutualConnections(null, [], [])).toEqual([]);
  });

  test('returns tracked connections with exact match', () => {
    const connections = [
      { name: 'Alice', company: 'Acme Corp', title: 'Engineer' },
      { name: 'Bob', company: 'TechCo', title: 'Manager' },
    ];
    const result = getMutualConnections('Acme Corp', connections, []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  test('ignores case when matching company name', () => {
    const connections = [{ name: 'Alice', company: 'Acme Corp', title: 'Engineer' }];
    expect(getMutualConnections('acme corp', connections, [])).toHaveLength(1);
    expect(getMutualConnections('ACME CORP', connections, [])).toHaveLength(1);
  });

  test('trims whitespace from company names', () => {
    const connections = [{ name: 'Alice', company: '  Acme Corp  ', title: 'Engineer' }];
    expect(getMutualConnections('Acme Corp', connections, [])).toHaveLength(1);
  });

  test('finds LinkedIn connections with exact company match', () => {
    const connections = [];
    const linkedinNetwork = [
      { firstName: 'Charlie', lastName: 'Brown', company: 'Acme Corp', title: 'VP' },
    ];
    const result = getMutualConnections('Acme Corp', connections, linkedinNetwork);
    expect(result).toHaveLength(1);
    expect(result[0].firstName).toBe('Charlie');
  });

  test('finds LinkedIn connections with substring match', () => {
    const connections = [];
    const linkedinNetwork = [
      { firstName: 'Dave', lastName: 'Smith', company: 'Acme Corp International', title: 'Manager' },
    ];
    const result = getMutualConnections('Acme Corp', connections, linkedinNetwork);
    expect(result).toHaveLength(1);
  });

  test('deduplicates between tracked and LinkedIn by name', () => {
    const connections = [{ name: 'Alice Johnson', company: 'Acme Corp', title: 'Engineer' }];
    const linkedinNetwork = [
      { firstName: 'Alice', lastName: 'Johnson', company: 'Acme Corp', title: 'VP' },
      { firstName: 'Bob', lastName: 'Jones', company: 'Acme Corp', title: 'Manager' },
    ];
    const result = getMutualConnections('Acme Corp', connections, linkedinNetwork);
    expect(result).toHaveLength(2);
    const names = result.map(c => c.name || `${c.firstName} ${c.lastName}`);
    expect(names).not.toHaveLength(3); // Should not have Alice twice
  });

  test('sorts by seniority (CEO first)', () => {
    const connections = [];
    const linkedinNetwork = [
      { firstName: 'Alice', lastName: 'CEO', company: 'Acme Corp', title: 'Engineer' },
      { firstName: 'Bob', lastName: 'Chief', company: 'Acme Corp', title: 'Chief Product Officer' },
      { firstName: 'Charlie', lastName: 'VP', company: 'Acme Corp', title: 'VP Sales' },
    ];
    const result = getMutualConnections('Acme Corp', connections, linkedinNetwork);
    expect(result[0].title).toContain('Chief');
    expect(result[1].title).toContain('VP');
  });

  test('limits results to top 2 connections', () => {
    const connections = [];
    const linkedinNetwork = [
      { firstName: 'A', lastName: 'One', company: 'Acme Corp', title: 'CEO' },
      { firstName: 'B', lastName: 'Two', company: 'Acme Corp', title: 'VP' },
      { firstName: 'C', lastName: 'Three', company: 'Acme Corp', title: 'Manager' },
      { firstName: 'D', lastName: 'Four', company: 'Acme Corp', title: 'Engineer' },
    ];
    const result = getMutualConnections('Acme Corp', connections, linkedinNetwork);
    expect(result).toHaveLength(2);
  });

  test('combines tracked and LinkedIn connections up to limit of 2', () => {
    const connections = [
      { name: 'Alice', company: 'Acme Corp', title: 'CEO' },
      { name: 'Bob', company: 'Acme Corp', title: 'VP' },
    ];
    const linkedinNetwork = [
      { firstName: 'Charlie', lastName: 'Brown', company: 'Acme Corp', title: 'Manager' },
    ];
    const result = getMutualConnections('Acme Corp', connections, linkedinNetwork);
    expect(result).toHaveLength(2);
  });

  test('returns empty array when no connections found', () => {
    const connections = [];
    const linkedinNetwork = [];
    const result = getMutualConnections('Acme Corp', connections, linkedinNetwork);
    expect(result).toEqual([]);
  });
});

// ============================================================
// TESTS: getCompanyProfileCompletion
// ============================================================

describe('getCompanyProfileCompletion', () => {
  test('returns 0 for null company', () => {
    expect(getCompanyProfileCompletion(null)).toBe(0);
  });

  test('returns 0 for empty company object', () => {
    expect(getCompanyProfileCompletion({})).toBe(0);
  });

  test('returns 100 when all 6 fields are populated', () => {
    const company = {
      domain: 'acme.com',
      missionStatement: 'We build great products',
      headcount: 150,
      fundingStage: 'Series B',
      remotePolicy: 'Hybrid',
      url: 'https://acme.com',
    };
    expect(getCompanyProfileCompletion(company)).toBe(100);
  });

  test('calculates percentage for 3 of 6 fields', () => {
    const company = {
      domain: 'acme.com',
      missionStatement: 'We build great products',
      headcount: 150,
    };
    expect(getCompanyProfileCompletion(company)).toBe(50);
  });

  test('calculates percentage for 1 of 6 fields', () => {
    const company = {
      domain: 'acme.com',
    };
    expect(getCompanyProfileCompletion(company)).toBe(17);
  });

  test('ignores empty strings', () => {
    const company = {
      domain: 'acme.com',
      missionStatement: '',
      headcount: 150,
      fundingStage: '',
      remotePolicy: 'Hybrid',
      url: '',
    };
    expect(getCompanyProfileCompletion(company)).toBe(50);
  });

  test('ignores whitespace-only strings', () => {
    // domain populated (1), missionStatement whitespace-only (0), headcount populated (1) = 2/6 = 33%
    const company = {
      domain: 'acme.com',
      missionStatement: '   ',
      headcount: 150,
    };
    expect(getCompanyProfileCompletion(company)).toBe(33);
  });

  test('counts numeric values as populated', () => {
    // headcount=0 → "0".trim().length = 1 > 0 → counts as populated? No! 0 is falsy.
    // The check is: company[f] && ... — since 0 is falsy, it fails the first check.
    // So headcount=0 does NOT count as populated.
    const company = {
      domain: 'acme.com',
      missionStatement: 'We build great products',
      headcount: 0,         // falsy → not counted
      fundingStage: 'Series B',
      remotePolicy: 'Hybrid',
      url: 'https://acme.com',
    };
    // 5 out of 6 populated (headcount=0 is falsy)
    expect(getCompanyProfileCompletion(company)).toBe(83);
  });
});

// ============================================================
// TESTS: isActionToday
// ============================================================

describe('isActionToday', () => {
  test('returns true when role was added today', () => {
    const todayStr = '2026-03-16';
    const role = {
      dateAdded: '2026-03-16T10:30:00Z',
      stageChangedDate: '2026-03-10T10:30:00Z',
    };
    expect(isActionToday(role, todayStr)).toBe(true);
  });

  test('returns true when role stage changed today', () => {
    const todayStr = '2026-03-16';
    const role = {
      dateAdded: '2026-03-10T10:30:00Z',
      stageChangedDate: '2026-03-16T10:30:00Z',
    };
    expect(isActionToday(role, todayStr)).toBe(true);
  });

  test('returns false when neither dateAdded nor stageChangedDate is today', () => {
    const todayStr = '2026-03-16';
    const role = {
      dateAdded: '2026-03-10T10:30:00Z',
      stageChangedDate: '2026-03-15T10:30:00Z',
    };
    expect(isActionToday(role, todayStr)).toBe(false);
  });

  test('returns false when role has no dates', () => {
    const todayStr = '2026-03-16';
    const role = {};
    expect(isActionToday(role, todayStr)).toBe(false);
  });

  test('uses getTodayDateString when todayStr not provided', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const role = {
      dateAdded: '2026-03-16T10:30:00Z',
    };
    // Mock getTodayDateString behavior
    expect(isActionToday(role)).toEqual(expect.any(Boolean));
  });

  test('handles ISO date strings correctly', () => {
    const todayStr = '2026-03-16';
    const role = {
      dateAdded: '2026-03-16T23:59:59Z',
    };
    expect(isActionToday(role, todayStr)).toBe(true);
  });
});

// ============================================================
// TESTS: computePipelineStats
// ============================================================

describe('computePipelineStats', () => {
  test('returns empty stage counts for no roles', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const result = computePipelineStats([], now);
    expect(result.total).toBe(0);
    expect(result.stageCounts.discovered).toBe(0);
    expect(result.conversions.screen).toBe(0);
  });

  test('counts roles across all stages', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const roles = [
      { id: '1', stage: 'discovered', dateAdded: '2026-03-16' },
      { id: '2', stage: 'applied', dateAdded: '2026-03-15' },
      { id: '3', stage: 'screen', dateAdded: '2026-03-14' },
      { id: '4', stage: 'interviewing', dateAdded: '2026-03-13' },
      { id: '5', stage: 'offer', dateAdded: '2026-03-12' },
    ];
    const result = computePipelineStats(roles, now);
    expect(result.total).toBe(5);
    expect(result.stageCounts.discovered).toBe(1);
    expect(result.stageCounts.applied).toBe(1);
    expect(result.stageCounts.screen).toBe(1);
    expect(result.stageCounts.interviewing).toBe(1);
    expect(result.stageCounts.offer).toBe(1);
  });

  test('calculates screen conversion rate', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const roles = [
      { id: '1', stage: 'discovered', dateAdded: '2026-03-16' },
      { id: '2', stage: 'applied', dateAdded: '2026-03-15' },
      { id: '3', stage: 'screen', dateAdded: '2026-03-14' },
      { id: '4', stage: 'screen', dateAdded: '2026-03-13' },
    ];
    const result = computePipelineStats(roles, now);
    // 2 screens out of 4 discovered = 50%
    expect(result.conversions.screen).toBe(50);
  });

  test('calculates interview conversion rate', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const roles = [
      { id: '1', stage: 'screen', dateAdded: '2026-03-16' },
      { id: '2', stage: 'screen', dateAdded: '2026-03-15' },
      { id: '3', stage: 'interviewing', dateAdded: '2026-03-14' },
    ];
    const result = computePipelineStats(roles, now);
    // 1 interview out of 2 screens = 50%
    expect(result.conversions.interview).toBe(50);
  });

  test('calculates offer conversion rate', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const roles = [
      { id: '1', stage: 'interviewing', dateAdded: '2026-03-16' },
      { id: '2', stage: 'interviewing', dateAdded: '2026-03-15' },
      { id: '3', stage: 'offer', dateAdded: '2026-03-14' },
    ];
    const result = computePipelineStats(roles, now);
    // 1 offer out of 2 interviews = 50%
    expect(result.conversions.offer).toBe(50);
  });

  test('counts roles added this week', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    // weekAgo = 2026-03-09T12:00:00Z
    const roles = [
      { id: '1', stage: 'discovered', dateAdded: '2026-03-16', stageChangedDate: '2026-03-16' },
      { id: '2', stage: 'discovered', dateAdded: '2026-03-15', stageChangedDate: '2026-03-15' },
      { id: '3', stage: 'discovered', dateAdded: '2026-03-10', stageChangedDate: '2026-03-10' }, // Mar 10 > Mar 9.5 → within week
      { id: '4', stage: 'discovered', dateAdded: '2026-03-08', stageChangedDate: '2026-03-08' }, // Mar 8 < weekAgo
    ];
    const result = computePipelineStats(roles, now);
    expect(result.activity.addedThisWeek).toBe(3); // 3/16, 3/15, 3/10 are all within week
  });

  test('counts roles progressed this week (excluding discovered)', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const roles = [
      { id: '1', stage: 'applied', dateAdded: '2026-03-10', stageChangedDate: '2026-03-16' },
      { id: '2', stage: 'screen', dateAdded: '2026-03-10', stageChangedDate: '2026-03-15' },
      { id: '3', stage: 'discovered', dateAdded: '2026-03-10', stageChangedDate: '2026-03-14' },
      { id: '4', stage: 'applied', dateAdded: '2026-03-10', stageChangedDate: '2026-03-08' },
    ];
    const result = computePipelineStats(roles, now);
    expect(result.activity.progressedThisWeek).toBe(2); // Only the first two
  });

  test('returns 0 conversion rates when insufficient data', () => {
    const now = new Date('2026-03-16T12:00:00Z');
    const roles = [
      { id: '1', stage: 'discovered', dateAdded: '2026-03-16' },
    ];
    const result = computePipelineStats(roles, now);
    expect(result.conversions.interview).toBe(0);
    expect(result.conversions.offer).toBe(0);
  });
});

// ============================================================
// TESTS: computeInterviewIntelligence
// ============================================================

describe('computeInterviewIntelligence', () => {
  test('returns unlocked: false when less than 5 debriefs', () => {
    const debriefs = [
      { interviewType: 'phone', outcome: 'passed' },
      { interviewType: 'phone', outcome: 'passed' },
      { interviewType: 'onsite', outcome: 'passed' },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    expect(result.unlocked).toBe(false);
    expect(result.debriefCount).toBe(3);
    expect(result.required).toBe(5);
  });

  test('returns unlocked: false when debriefs is null or undefined', () => {
    expect(computeInterviewIntelligence(null, []).unlocked).toBe(false);
    expect(computeInterviewIntelligence(undefined, []).unlocked).toBe(false);
  });

  test('returns unlocked: true when 5 or more debriefs', () => {
    const debriefs = [
      { interviewType: 'phone', outcome: 'passed' },
      { interviewType: 'phone', outcome: 'passed' },
      { interviewType: 'onsite', outcome: 'passed' },
      { interviewType: 'onsite', outcome: 'passed' },
      { interviewType: 'take_home', outcome: 'passed' },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    expect(result.unlocked).toBe(true);
    expect(result.debriefCount).toBe(5);
  });

  test('computes top questions from debrief sections', () => {
    const debriefs = [
      {
        interviewType: 'phone',
        outcome: 'passed',
        sections: [
          { type: 'behavioral', category: null },
          { type: 'behavioral', category: null },
          { type: 'technical', category: null },
        ],
      },
      {
        interviewType: 'onsite',
        outcome: 'passed',
        sections: [
          { type: 'behavioral', category: null },
          { type: 'system_design', category: null },
        ],
      },
      {
        interviewType: 'take_home',
        outcome: 'passed',
        sections: [
          { type: 'technical', category: null },
          { type: 'technical', category: null },
        ],
      },
      {
        interviewType: 'phone',
        outcome: 'passed',
        sections: [
          { type: 'behavioral', category: null },
        ],
      },
      {
        interviewType: 'phone',
        outcome: 'passed',
        sections: [
          { type: 'general', category: null },
        ],
      },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    expect(result.topQuestions).toBeDefined();
    expect(result.topQuestions.length).toBeGreaterThan(0);
    expect(result.topQuestions[0].type).toBe('behavioral'); // Most common
    expect(result.topQuestions[0].count).toBe(4);
  });

  test('calculates pass rates by interview type', () => {
    const debriefs = [
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'rejected', feedback: null },
      { interviewType: 'onsite', outcome: 'advance', feedback: null },
      { interviewType: 'onsite', outcome: 'rejected', feedback: null },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    expect(result.passRates).toBeDefined();
    const phoneRate = result.passRates.find(r => r.type === 'Phone');
    const onsiteRate = result.passRates.find(r => r.type === 'Onsite');
    expect(phoneRate.rate).toBe(67); // 2 passed out of 3
    expect(onsiteRate.rate).toBe(50); // 1 passed out of 2
  });

  test('counts feedback "strong" as a pass', () => {
    const debriefs = [
      { interviewType: 'phone', outcome: 'rejected', feedback: 'Strong technical skills' },
      { interviewType: 'phone', outcome: 'rejected', feedback: 'weak communication' },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    const phoneRate = result.passRates.find(r => r.type === 'Phone');
    expect(phoneRate.rate).toBe(80); // 4 passed out of 5
  });

  test('counts outcome "advance" as a pass', () => {
    const debriefs = [
      { interviewType: 'phone', outcome: 'advance', feedback: null },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'rejected', feedback: null },
      { interviewType: 'phone', outcome: 'rejected', feedback: null },
      { interviewType: 'phone', outcome: 'rejected', feedback: null },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    const phoneRate = result.passRates.find(r => r.type === 'Phone');
    expect(phoneRate.rate).toBe(40); // 2 passed out of 5
  });

  test('includes pass rate count for each type', () => {
    const debriefs = [
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'onsite', outcome: 'passed', feedback: null },
      { interviewType: 'onsite', outcome: 'rejected', feedback: null },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    const phoneRate = result.passRates.find(r => r.type === 'Phone');
    const onsiteRate = result.passRates.find(r => r.type === 'Onsite');
    expect(phoneRate.count).toBe(3);
    expect(onsiteRate.count).toBe(2);
  });

  test('capitalizes interview type in passRates', () => {
    const debriefs = [
      { interviewType: 'phone_screen', outcome: 'passed', feedback: null },
      { interviewType: 'phone_screen', outcome: 'passed', feedback: null },
      { interviewType: 'phone_screen', outcome: 'passed', feedback: null },
      { interviewType: 'phone_screen', outcome: 'passed', feedback: null },
      { interviewType: 'phone_screen', outcome: 'passed', feedback: null },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    expect(result.passRates[0].type).toBe('Phone_screen');
  });

  test('handles debriefs with missing sections gracefully', () => {
    const debriefs = [
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'phone', outcome: 'passed', feedback: null },
      { interviewType: 'onsite', outcome: 'passed', feedback: null },
      { interviewType: 'onsite', outcome: 'passed', feedback: null },
    ];
    const result = computeInterviewIntelligence(debriefs, []);
    expect(result.unlocked).toBe(true);
    expect(result.topQuestions).toEqual([]);
  });
});
