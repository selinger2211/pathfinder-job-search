/* ====================================================================
 * UNIT TESTS — date-utils.js (Date/Time Utilities)
 * ====================================================================
 * Tests relative time formatting, absolute date formatting, date
 * comparisons, freshness calculation, file size formatting, and
 * currency formatting.
 *
 * Run: npm test -- --testPathPatterns=date-utils
 * Coverage: npm test -- --coverage --testPathPatterns=date-utils
 * ==================================================================== */

const {
  formatRelativeTime,
  formatRelativeDate,
  formatTimestamp,
  formatDateShort,
  formatTime,
  formatDate,
  formatDatetimeLocal,
  isToday,
  getTodayDateString,
  getTimeUntil,
  calculateFreshness,
  formatFileSize,
  formatCurrency,
} = require('../date-utils');

/* ====== formatRelativeTime ====== */
describe('formatRelativeTime', () => {
  test('returns "just now" for dates within the last minute', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  test('returns "X minutes ago" for recent dates', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 minutes ago');
  });

  test('returns "1 minute ago" (singular)', () => {
    const oneMinAgo = new Date(Date.now() - 90 * 1000); // 90 seconds = 1 min
    expect(formatRelativeTime(oneMinAgo)).toBe('1 minute ago');
  });

  test('returns "X hours ago"', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe('3 hours ago');
  });

  test('returns "1 hour ago" (singular)', () => {
    const oneHourAgo = new Date(Date.now() - 3700 * 1000);
    expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });

  test('returns "X days ago"', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe('2 days ago');
  });

  test('returns "X weeks ago"', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000);
    expect(formatRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
  });

  test('returns "X months ago"', () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 86400 * 1000);
    expect(formatRelativeTime(twoMonthsAgo)).toBe('2 months ago');
  });

  test('returns "X years ago"', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 86400 * 1000);
    expect(formatRelativeTime(twoYearsAgo)).toBe('2 years ago');
  });
});

/* ====== formatRelativeDate ====== */
describe('formatRelativeDate', () => {
  test('returns "today" for today', () => {
    expect(formatRelativeDate(new Date())).toBe('today');
  });

  test('returns "yesterday" for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000);
    expect(formatRelativeDate(yesterday)).toBe('yesterday');
  });

  test('returns "X days ago" for 2-6 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    expect(formatRelativeDate(threeDaysAgo)).toBe('3 days ago');
  });

  test('returns "1 week ago" for 7-13 days', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
    expect(formatRelativeDate(tenDaysAgo)).toBe('1 week ago');
  });

  test('returns "X weeks ago" for 14-29 days', () => {
    const threeWeeksAgo = new Date(Date.now() - 21 * 86400000);
    expect(formatRelativeDate(threeWeeksAgo)).toBe('3 weeks ago');
  });

  test('returns "1 month ago" for 30-59 days', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 86400000);
    expect(formatRelativeDate(fortyDaysAgo)).toBe('1 month ago');
  });

  test('returns "X months ago" for 60+ days', () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
    expect(formatRelativeDate(ninetyDaysAgo)).toBe('3 months ago');
  });

  test('accepts string dates', () => {
    const todayStr = new Date().toISOString();
    expect(formatRelativeDate(todayStr)).toBe('today');
  });
});

/* ====== formatTimestamp ====== */
describe('formatTimestamp', () => {
  test('returns formatted string with month/day and time', () => {
    const date = new Date(2026, 2, 9, 14, 32); // Mar 9, 2026 14:32
    const result = formatTimestamp(date);
    expect(result).toContain('03');
    expect(result).toContain('09');
    expect(result).toContain('14');
    expect(result).toContain('32');
  });
});

/* ====== formatDateShort ====== */
describe('formatDateShort', () => {
  test('returns short date format', () => {
    const date = new Date(2026, 2, 9); // Mar 9, 2026
    const result = formatDateShort(date);
    expect(result).toContain('Mon');
    expect(result).toContain('Mar');
    expect(result).toContain('9');
  });
});

/* ====== formatTime ====== */
describe('formatTime', () => {
  test('formats morning time', () => {
    const date = new Date(2026, 2, 9, 9, 30);
    const result = formatTime(date);
    expect(result).toContain('9');
    expect(result).toContain('30');
    expect(result).toContain('AM');
  });

  test('formats afternoon time', () => {
    const date = new Date(2026, 2, 9, 14, 30);
    const result = formatTime(date);
    expect(result).toContain('2');
    expect(result).toContain('30');
    expect(result).toContain('PM');
  });
});

/* ====== formatDate ====== */
describe('formatDate', () => {
  test('formats date as "Mon D, YYYY"', () => {
    const date = new Date(2026, 2, 10); // Mar 10, 2026
    const result = formatDate(date);
    expect(result).toContain('Mar');
    expect(result).toContain('10');
    expect(result).toContain('2026');
  });

  test('accepts string dates', () => {
    const result = formatDate('2026-03-10');
    expect(result).toContain('Mar');
    expect(result).toContain('2026');
  });
});

/* ====== formatDatetimeLocal ====== */
describe('formatDatetimeLocal', () => {
  test('formats timestamp to full datetime', () => {
    const date = new Date(2026, 2, 10, 14, 30);
    const result = formatDatetimeLocal(date);
    expect(result).toContain('Mar');
    expect(result).toContain('10');
    expect(result).toContain('2026');
    expect(result).toContain('2');
    expect(result).toContain('30');
    expect(result).toContain('PM');
  });

  test('accepts numeric timestamps', () => {
    const ts = new Date(2026, 2, 10).getTime();
    const result = formatDatetimeLocal(ts);
    expect(result).toContain('Mar');
    expect(result).toContain('10');
  });
});

/* ====== isToday ====== */
describe('isToday', () => {
  test('returns true for today', () => {
    expect(isToday(new Date())).toBe(true);
  });

  test('returns false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });

  test('returns false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isToday(tomorrow)).toBe(false);
  });
});

/* ====== getTodayDateString ====== */
describe('getTodayDateString', () => {
  test('returns YYYY-MM-DD format', () => {
    const result = getTodayDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('matches actual today', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(getTodayDateString()).toBe(expected);
  });
});

/* ====== getTimeUntil ====== */
describe('getTimeUntil', () => {
  test('returns "passed" for past dates', () => {
    const past = new Date(Date.now() - 86400000);
    expect(getTimeUntil(past)).toBe('passed');
  });

  test('returns "now" for very near future', () => {
    const soon = new Date(Date.now() + 30 * 1000); // 30 seconds
    expect(getTimeUntil(soon)).toBe('now');
  });

  test('returns "in X minutes" for minutes away', () => {
    const fifteenMin = new Date(Date.now() + 15 * 60 * 1000);
    expect(getTimeUntil(fifteenMin)).toContain('minute');
  });

  test('returns "in X hours" for hours away', () => {
    const threeHours = new Date(Date.now() + 3 * 3600 * 1000);
    expect(getTimeUntil(threeHours)).toBe('in 3 hours');
  });

  test('returns "in 1 day" (singular)', () => {
    const oneDay = new Date(Date.now() + 1.5 * 86400 * 1000);
    expect(getTimeUntil(oneDay)).toBe('in 1 day');
  });

  test('returns "in X days" for days away', () => {
    const fiveDays = new Date(Date.now() + 5 * 86400 * 1000);
    expect(getTimeUntil(fiveDays)).toBe('in 5 days');
  });

  test('singular day', () => {
    const future = new Date(Date.now() + 1.5 * 86400000);
    expect(getTimeUntil(future)).toBe('in 1 day');
  });

  test('singular hour', () => {
    const future = new Date(Date.now() + 1.5 * 3600000);
    expect(getTimeUntil(future)).toBe('in 1 hour');
  });

  test('singular minute', () => {
    const future = new Date(Date.now() + 90000);
    expect(getTimeUntil(future)).toBe('in 1 minute');
  });
});

/* ====== calculateFreshness ====== */
describe('calculateFreshness', () => {
  test('returns "fresh" for recent data (< 24h)', () => {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const result = calculateFreshness(oneHourAgo);
    expect(result.status).toBe('fresh');
    expect(result.hours).toBeLessThan(24);
  });

  test('returns "stale" for 24-72h old data', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600000);
    const result = calculateFreshness(twoDaysAgo);
    expect(result.status).toBe('stale');
    expect(result.hours).toBeGreaterThanOrEqual(24);
    expect(result.hours).toBeLessThan(72);
  });

  test('returns "expired" for > 72h old data', () => {
    const fiveDaysAgo = new Date(Date.now() - 120 * 3600000);
    const result = calculateFreshness(fiveDaysAgo);
    expect(result.status).toBe('expired');
    expect(result.hours).toBeGreaterThanOrEqual(72);
  });

  test('accepts string timestamps', () => {
    const result = calculateFreshness(new Date().toISOString());
    expect(result.status).toBe('fresh');
  });

  test('accepts numeric timestamps', () => {
    const result = calculateFreshness(Date.now());
    expect(result.status).toBe('fresh');
  });
});

/* ====== formatFileSize ====== */
describe('formatFileSize', () => {
  test('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  test('formats KB', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  test('formats MB', () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  test('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  test('formats exactly 1 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });
});

/* ====== formatCurrency ====== */
describe('formatCurrency', () => {
  test('formats whole dollar amount', () => {
    const result = formatCurrency(250000);
    expect(result).toContain('250,000');
    expect(result).toContain('$');
  });

  test('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('$');
    expect(result).toContain('0');
  });

  test('no decimal places', () => {
    const result = formatCurrency(250000);
    expect(result).not.toContain('.');
  });

  test('formats large numbers with commas', () => {
    const result = formatCurrency(1250000);
    expect(result).toContain('1,250,000');
  });
});
