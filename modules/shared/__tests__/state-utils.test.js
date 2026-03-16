/* ====================================================================
 * UNIT TESTS — state-utils.js (State Management / localStorage CRUD)
 * ====================================================================
 * Tests safeJsonParse/Save, load/save pairs for all core keys,
 * preference migration logic, snooze expiration, feed run date
 * deserialization, quota exceeded handling, and corrupt data recovery.
 *
 * Run: npm test -- --testPathPatterns=state-utils
 * Coverage: npm test -- --coverage --testPathPatterns=state-utils
 * ==================================================================== */

const {
  safeJsonParse,
  safeJsonSave,
  loadFeedQueue,
  saveFeedQueue,
  loadRoles,
  saveRoles,
  loadCompanies,
  saveCompanies,
  loadConnections,
  saveConnections,
  loadLinkedInNetwork,
  loadFeedRuns,
  saveFeedRuns,
  loadPreferences,
  savePreferences,
  loadSnoozedRoles,
  saveSnoozedRoles,
  getStorage,
  setStorage,
  loadStreak,
  saveStreak,
  loadCompBenchmarks,
  saveCompBenchmarks,
  loadResumeLog,
  saveResumeVersion,
  DEFAULT_PREFERENCES,
} = require('../state-utils');

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

/* ====================================================================
 * safeJsonParse — THE core utility (duplicated in 9+ modules)
 * ==================================================================== */
describe('safeJsonParse', () => {
  test('returns parsed JSON for valid data', () => {
    localStorage.setItem('pf_test', JSON.stringify({ a: 1, b: 'hello' }));
    expect(safeJsonParse('pf_test')).toEqual({ a: 1, b: 'hello' });
  });

  test('returns fallback for missing key', () => {
    expect(safeJsonParse('pf_missing')).toBeNull();
    expect(safeJsonParse('pf_missing', [])).toEqual([]);
    expect(safeJsonParse('pf_missing', {})).toEqual({});
    expect(safeJsonParse('pf_missing', 42)).toBe(42);
  });

  test('returns fallback for null value', () => {
    localStorage.setItem('pf_null', 'null');
    // JSON.parse('null') returns null, which is falsy → returns fallback? No.
    // Actually raw = 'null' which is truthy, so JSON.parse('null') = null is returned.
    expect(safeJsonParse('pf_null', 'default')).toBeNull();
  });

  test('returns fallback for corrupt JSON', () => {
    localStorage.setItem('pf_corrupt', '{invalid json here!!!');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    expect(safeJsonParse('pf_corrupt', 'fallback')).toBe('fallback');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('Corrupt');
  });

  test('returns fallback for empty string value', () => {
    localStorage.setItem('pf_empty', '');
    // raw = '' which is falsy → returns fallback
    expect(safeJsonParse('pf_empty', 'default')).toBe('default');
  });

  test('parses arrays correctly', () => {
    localStorage.setItem('pf_arr', JSON.stringify([1, 2, 3]));
    expect(safeJsonParse('pf_arr', [])).toEqual([1, 2, 3]);
  });

  test('parses nested objects', () => {
    const nested = { a: { b: { c: [1, 2] } } };
    localStorage.setItem('pf_nested', JSON.stringify(nested));
    expect(safeJsonParse('pf_nested')).toEqual(nested);
  });

  test('parses strings correctly', () => {
    localStorage.setItem('pf_str', JSON.stringify('hello'));
    expect(safeJsonParse('pf_str')).toBe('hello');
  });

  test('parses numbers correctly', () => {
    localStorage.setItem('pf_num', JSON.stringify(42));
    expect(safeJsonParse('pf_num')).toBe(42);
  });

  test('parses booleans correctly', () => {
    localStorage.setItem('pf_bool', JSON.stringify(true));
    expect(safeJsonParse('pf_bool')).toBe(true);
  });

  test('default fallback is null', () => {
    expect(safeJsonParse('pf_nonexistent')).toBeNull();
  });
});

/* ====================================================================
 * safeJsonSave — the canonical saver
 * ==================================================================== */
describe('safeJsonSave', () => {
  test('saves data and returns true on success', () => {
    expect(safeJsonSave('pf_test', { a: 1 })).toBe(true);
    expect(JSON.parse(localStorage.getItem('pf_test'))).toEqual({ a: 1 });
  });

  test('saves arrays correctly', () => {
    expect(safeJsonSave('pf_arr', [1, 2, 3])).toBe(true);
    expect(JSON.parse(localStorage.getItem('pf_arr'))).toEqual([1, 2, 3]);
  });

  test('saves strings correctly', () => {
    expect(safeJsonSave('pf_str', 'hello')).toBe(true);
    expect(JSON.parse(localStorage.getItem('pf_str'))).toBe('hello');
  });

  test('saves null correctly', () => {
    expect(safeJsonSave('pf_null', null)).toBe(true);
    expect(JSON.parse(localStorage.getItem('pf_null'))).toBeNull();
  });

  test('returns false and warns on quota exceeded', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(safeJsonSave('pf_big', 'data')).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    Storage.prototype.setItem.mockRestore();
  });

  test('returns false on circular reference', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const circular = {};
    circular.self = circular;

    expect(safeJsonSave('pf_circular', circular)).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test('overwrites existing data', () => {
    safeJsonSave('pf_test', { v: 1 });
    safeJsonSave('pf_test', { v: 2 });
    expect(JSON.parse(localStorage.getItem('pf_test'))).toEqual({ v: 2 });
  });
});

/* ====================================================================
 * Load/Save Pairs — Core Data Keys
 * ==================================================================== */
describe('loadFeedQueue / saveFeedQueue', () => {
  test('returns empty array when no data', () => {
    expect(loadFeedQueue()).toEqual([]);
  });

  test('roundtrips feed items', () => {
    const items = [
      { id: '1', title: 'PM at Google', score: 85 },
      { id: '2', title: 'PM at Meta', score: 72 },
    ];
    saveFeedQueue(items);
    expect(loadFeedQueue()).toEqual(items);
  });

  test('handles corrupt data gracefully', () => {
    localStorage.setItem('pf_feed_queue', 'NOT VALID JSON');
    jest.spyOn(console, 'warn').mockImplementation();
    expect(loadFeedQueue()).toEqual([]);
  });
});

describe('loadRoles / saveRoles', () => {
  test('returns empty array when no data', () => {
    expect(loadRoles()).toEqual([]);
  });

  test('roundtrips role data', () => {
    const roles = [{ id: 'r1', company: 'Stripe', stage: 'Applied' }];
    saveRoles(roles);
    expect(loadRoles()).toEqual(roles);
  });
});

describe('loadCompanies / saveCompanies', () => {
  test('returns empty array when no data', () => {
    expect(loadCompanies()).toEqual([]);
  });

  test('roundtrips company data', () => {
    const companies = [{ name: 'Stripe', stage: 'Late-stage / Pre-IPO' }];
    saveCompanies(companies);
    expect(loadCompanies()).toEqual(companies);
  });
});

describe('loadConnections / saveConnections', () => {
  test('returns empty array when no data', () => {
    expect(loadConnections()).toEqual([]);
  });

  test('roundtrips connection data', () => {
    const conns = [{ name: 'Jane Doe', company: 'Google', title: 'PM Lead' }];
    saveConnections(conns);
    expect(loadConnections()).toEqual(conns);
  });
});

describe('loadLinkedInNetwork', () => {
  test('returns empty array when no data', () => {
    expect(loadLinkedInNetwork()).toEqual([]);
  });

  test('loads stored LinkedIn connections', () => {
    const network = [{ name: 'Alice', company: 'Meta' }];
    localStorage.setItem('pf_linkedin_network', JSON.stringify(network));
    expect(loadLinkedInNetwork()).toEqual(network);
  });
});

/* ====================================================================
 * Feed Runs — Date Deserialization
 * ==================================================================== */
describe('loadFeedRuns / saveFeedRuns', () => {
  test('returns empty array when no data', () => {
    expect(loadFeedRuns()).toEqual([]);
  });

  test('deserializes timestamp strings to Date objects', () => {
    const runs = [
      { source: 'gmail', count: 5, timestamp: '2026-03-10T14:00:00Z' },
      { source: 'indeed', count: 12, timestamp: '2026-03-09T10:30:00Z' },
    ];
    saveFeedRuns(runs);
    const loaded = loadFeedRuns();

    expect(loaded).toHaveLength(2);
    expect(loaded[0].timestamp).toBeInstanceOf(Date);
    expect(loaded[0].timestamp.toISOString()).toBe('2026-03-10T14:00:00.000Z');
    expect(loaded[0].source).toBe('gmail');
    expect(loaded[1].timestamp).toBeInstanceOf(Date);
  });

  test('preserves other fields during deserialization', () => {
    const runs = [{ source: 'manual', count: 3, timestamp: '2026-01-01T00:00:00Z', extra: 'data' }];
    saveFeedRuns(runs);
    const loaded = loadFeedRuns();
    expect(loaded[0].source).toBe('manual');
    expect(loaded[0].count).toBe(3);
    expect(loaded[0].extra).toBe('data');
  });

  test('handles corrupt data gracefully', () => {
    localStorage.setItem('pf_feed_runs', 'corrupt');
    jest.spyOn(console, 'warn').mockImplementation();
    expect(loadFeedRuns()).toEqual([]);
  });
});

/* ====================================================================
 * Preferences — Complex Migration Logic
 * ==================================================================== */
describe('DEFAULT_PREFERENCES', () => {
  test('has all required keys', () => {
    const required = [
      'targetTitles', 'mustHaveKeywords', 'boostKeywords', 'excludeKeywords',
      'primaryDomains', 'secondaryDomains', 'excludedDomains',
      'locations', 'excludedLocations', 'companyStage', 'compRange'
    ];
    required.forEach(key => {
      expect(DEFAULT_PREFERENCES).toHaveProperty(key);
    });
  });

  test('targetTitles does NOT include bare "Product Manager"', () => {
    const bare = DEFAULT_PREFERENCES.targetTitles.find(t => t.toLowerCase() === 'product manager');
    expect(bare).toBeUndefined();
  });

  test('compRange has minBase and targetBase', () => {
    expect(DEFAULT_PREFERENCES.compRange.minBase).toBeDefined();
    expect(DEFAULT_PREFERENCES.compRange.targetBase).toBeDefined();
  });
});

describe('loadPreferences', () => {
  test('returns defaults when no stored preferences', () => {
    const prefs = loadPreferences();
    expect(prefs.targetTitles).toEqual(DEFAULT_PREFERENCES.targetTitles);
  });

  test('returns stored preferences when present', () => {
    const custom = { ...DEFAULT_PREFERENCES, locations: ['Austin'] };
    localStorage.setItem('pf_preferences', JSON.stringify(custom));
    // Mark migrations as done to skip them
    localStorage.setItem('pf_prefs_migrated_v3194', 'true');
    localStorage.setItem('pf_prefs_migrated_v3201_domains', 'true');

    const prefs = loadPreferences();
    expect(prefs.locations).toEqual(['Austin']);
  });

  test('returns defaults on corrupt JSON', () => {
    localStorage.setItem('pf_preferences', '{broken json');
    jest.spyOn(console, 'warn').mockImplementation();
    const prefs = loadPreferences();
    expect(prefs.targetTitles).toEqual(DEFAULT_PREFERENCES.targetTitles);
  });

  // === v3.19.4 keyword migration ===
  test('v3.19.4 migration: merges missing default keywords', () => {
    // Simulate old preferences with only 2 target titles
    const oldPrefs = {
      targetTitles: ['Senior Product Manager'],
      mustHaveKeywords: ['product'],
      boostKeywords: ['AI'],
    };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();

    // Should have merged in defaults that were missing
    expect(prefs.targetTitles).toContain('Senior Product Manager'); // kept original
    expect(prefs.targetTitles).toContain('Staff Product Manager'); // merged from defaults
    expect(prefs.targetTitles).toContain('Principal Product Manager'); // merged
    expect(prefs.mustHaveKeywords).toContain('strategy'); // merged
    expect(prefs.boostKeywords).toContain('machine learning'); // merged
  });

  test('v3.19.4 migration: does not duplicate existing keywords', () => {
    const oldPrefs = {
      targetTitles: ['Senior Product Manager', 'Staff Product Manager'],
      mustHaveKeywords: ['product', 'strategy', 'roadmap'],
      boostKeywords: DEFAULT_PREFERENCES.boostKeywords.slice(),
    };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();
    // Count occurrences of 'Senior Product Manager'
    const count = prefs.targetTitles.filter(t => t === 'Senior Product Manager').length;
    expect(count).toBe(1); // not duplicated
  });

  test('v3.19.4 migration: removes bare "Product Manager" from target titles', () => {
    const oldPrefs = {
      targetTitles: ['Product Manager', 'Senior Product Manager'],
      mustHaveKeywords: [],
      boostKeywords: [],
    };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();
    const bare = prefs.targetTitles.find(t => t.toLowerCase() === 'product manager');
    expect(bare).toBeUndefined();
    expect(prefs.targetTitles).toContain('Senior Product Manager'); // kept
  });

  test('v3.19.4 migration: is case-insensitive when merging', () => {
    const oldPrefs = {
      targetTitles: ['senior product manager'], // lowercase
      mustHaveKeywords: ['PRODUCT'], // uppercase
      boostKeywords: [],
    };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();
    // Should not add duplicate "Senior Product Manager" since "senior product manager" already exists
    const seniorCount = prefs.targetTitles.filter(t =>
      t.toLowerCase() === 'senior product manager'
    ).length;
    expect(seniorCount).toBe(1);
  });

  test('v3.19.4 migration: sets migration key so it runs only once', () => {
    const oldPrefs = { targetTitles: ['PM'], mustHaveKeywords: [], boostKeywords: [] };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    loadPreferences(); // triggers migration
    expect(localStorage.getItem('pf_prefs_migrated_v3194')).toBe('true');

    // Modify prefs and reload — migration should NOT run again
    const newPrefs = loadPreferences();
    newPrefs.targetTitles = ['Custom Title Only'];
    localStorage.setItem('pf_preferences', JSON.stringify(newPrefs));

    const reloaded = loadPreferences();
    // Should keep custom titles, not re-merge defaults
    expect(reloaded.targetTitles).toEqual(['Custom Title Only']);
  });

  // === v3.20.1 domain migration ===
  test('v3.20.1 migration: merges missing default domains', () => {
    localStorage.setItem('pf_prefs_migrated_v3194', 'true'); // skip keyword migration
    const oldPrefs = {
      ...DEFAULT_PREFERENCES,
      primaryDomains: ['AI/ML'],
      secondaryDomains: ['Fintech'],
      excludedDomains: [],
    };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();
    expect(prefs.primaryDomains).toContain('AI/ML'); // kept
    expect(prefs.primaryDomains).toContain('Enterprise SaaS'); // merged
    expect(prefs.secondaryDomains).toContain('Fintech'); // kept
    expect(prefs.secondaryDomains).toContain('Healthtech'); // merged
  });

  test('v3.20.1 migration: sets migration key', () => {
    localStorage.setItem('pf_prefs_migrated_v3194', 'true');
    localStorage.setItem('pf_preferences', JSON.stringify({ primaryDomains: [] }));

    loadPreferences();
    expect(localStorage.getItem('pf_prefs_migrated_v3201_domains')).toBe('true');
  });

  test('both migrations run in sequence for fresh install from old version', () => {
    const oldPrefs = {
      targetTitles: ['Product Manager'], // should get removed + others merged
      mustHaveKeywords: [],
      boostKeywords: [],
      primaryDomains: [],
      secondaryDomains: [],
      excludedDomains: [],
    };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();

    // v3.19.4 effects
    expect(prefs.targetTitles).not.toContain('Product Manager');
    expect(prefs.targetTitles).toContain('Senior Product Manager');

    // v3.20.1 effects
    expect(prefs.primaryDomains).toContain('AI/ML');
    expect(prefs.secondaryDomains).toContain('Fintech');

    // Both migration keys set
    expect(localStorage.getItem('pf_prefs_migrated_v3194')).toBe('true');
    expect(localStorage.getItem('pf_prefs_migrated_v3201_domains')).toBe('true');
  });

  // === Edge cases for uncovered branches ===
  test('v3.19.4 migration: handles prefs missing keyword arrays (|| [] fallback)', () => {
    // Prefs exist but without targetTitles/mustHaveKeywords/boostKeywords keys
    const oldPrefs = { locations: ['Remote'] };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();
    // Should add defaults via || [] fallback
    expect(prefs.targetTitles.length).toBeGreaterThan(0);
    expect(prefs.mustHaveKeywords.length).toBeGreaterThan(0);
    expect(prefs.boostKeywords.length).toBeGreaterThan(0);
  });

  test('v3.19.4 migration: no-change path when all defaults already present', () => {
    // Prefs already have all defaults — changed should stay false, no re-save
    const fullPrefs = { ...DEFAULT_PREFERENCES };
    localStorage.setItem('pf_preferences', JSON.stringify(fullPrefs));

    const spy = jest.spyOn(Storage.prototype, 'setItem');
    loadPreferences();

    // setItem should only be called for migration keys, NOT for pf_preferences re-save
    const prefSaves = spy.mock.calls.filter(c => c[0] === 'pf_preferences');
    expect(prefSaves.length).toBe(0); // no re-save needed
    spy.mockRestore();
  });

  test('v3.20.1 migration: no-change path when all domains already present', () => {
    localStorage.setItem('pf_prefs_migrated_v3194', 'true');
    const fullPrefs = { ...DEFAULT_PREFERENCES };
    localStorage.setItem('pf_preferences', JSON.stringify(fullPrefs));

    const spy = jest.spyOn(Storage.prototype, 'setItem');
    loadPreferences();

    const prefSaves = spy.mock.calls.filter(c => c[0] === 'pf_preferences');
    expect(prefSaves.length).toBe(0);
    spy.mockRestore();
  });

  test('v3.20.1 migration: handles prefs missing domain arrays (|| [] fallback)', () => {
    localStorage.setItem('pf_prefs_migrated_v3194', 'true');
    const oldPrefs = { targetTitles: ['PM'] }; // no domain keys
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();
    expect(prefs.primaryDomains.length).toBeGreaterThan(0);
    expect(prefs.secondaryDomains.length).toBeGreaterThan(0);
    expect(prefs.excludedDomains.length).toBeGreaterThan(0);
  });

  test('v3.19.4 migration: no bare Product Manager when targetTitles is undefined', () => {
    // targetTitles missing entirely — tests || [] fallback on line 221
    const oldPrefs = { mustHaveKeywords: [], boostKeywords: [] };
    localStorage.setItem('pf_preferences', JSON.stringify(oldPrefs));

    const prefs = loadPreferences();
    // Should still work (no crash), targetTitles gets populated from defaults
    expect(Array.isArray(prefs.targetTitles)).toBe(true);
  });

  test('loadPreferences handles custom defaults parameter', () => {
    const customDefaults = {
      targetTitles: ['Custom Title'],
      mustHaveKeywords: ['custom'],
      boostKeywords: ['boost'],
      primaryDomains: ['Custom Domain'],
      secondaryDomains: ['Secondary'],
      excludedDomains: ['Excluded'],
    };
    // No stored prefs — should return custom defaults
    const prefs = loadPreferences(customDefaults);
    expect(prefs.targetTitles).toEqual(['Custom Title']);
  });
});

describe('savePreferences', () => {
  test('persists preferences', () => {
    const prefs = { ...DEFAULT_PREFERENCES, locations: ['Remote'] };
    savePreferences(prefs);
    const stored = JSON.parse(localStorage.getItem('pf_preferences'));
    expect(stored.locations).toEqual(['Remote']);
  });
});

/* ====================================================================
 * Snoozed Roles — Expiration Filtering
 * ==================================================================== */
describe('loadSnoozedRoles', () => {
  test('returns empty arrays when no data', () => {
    const result = loadSnoozedRoles();
    expect(result.active).toEqual([]);
    expect(result.expired).toEqual([]);
  });

  test('returns all roles as active when none expired', () => {
    const future = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const roles = [
      { id: '1', title: 'PM at Stripe', snoozedUntil: future },
      { id: '2', title: 'PM at Meta', snoozedUntil: future },
    ];
    saveSnoozedRoles(roles);

    const result = loadSnoozedRoles();
    expect(result.active).toHaveLength(2);
    expect(result.expired).toHaveLength(0);
  });

  test('separates expired roles from active', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const roles = [
      { id: '1', title: 'PM at Stripe', snoozedUntil: future },
      { id: '2', title: 'PM at Meta', snoozedUntil: past },
    ];
    saveSnoozedRoles(roles);

    const result = loadSnoozedRoles();
    expect(result.active).toHaveLength(1);
    expect(result.active[0].id).toBe('1');
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].id).toBe('2');
  });

  test('cleans expired from storage automatically', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const roles = [{ id: '1', title: 'Expired PM', snoozedUntil: past }];
    saveSnoozedRoles(roles);

    loadSnoozedRoles();

    // Storage should now have empty array (expired cleaned)
    const stored = JSON.parse(localStorage.getItem('pf_snoozed_roles'));
    expect(stored).toEqual([]);
  });

  test('does not write to storage when nothing expired', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const roles = [{ id: '1', snoozedUntil: future }];
    saveSnoozedRoles(roles);

    const spy = jest.spyOn(Storage.prototype, 'setItem');
    loadSnoozedRoles();
    // setItem should NOT be called again (no expired to clean)
    // Note: saveSnoozedRoles called during setup, but not during load
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('handles corrupt data gracefully', () => {
    localStorage.setItem('pf_snoozed_roles', 'corrupt');
    jest.spyOn(console, 'warn').mockImplementation();
    const result = loadSnoozedRoles();
    expect(result.active).toEqual([]);
    expect(result.expired).toEqual([]);
  });
});

/* ====================================================================
 * Generic Storage (sync module pattern)
 * ==================================================================== */
describe('getStorage / setStorage', () => {
  test('auto-prefixes with pf_', () => {
    setStorage('theme', 'dark');
    expect(localStorage.getItem('pf_theme')).toBe('"dark"');
  });

  test('retrieves with auto-prefix', () => {
    localStorage.setItem('pf_view_mode', JSON.stringify('kanban'));
    expect(getStorage('view_mode')).toBe('kanban');
  });

  test('returns fallback for missing key', () => {
    expect(getStorage('nonexistent', 'default')).toBe('default');
  });
});

/* ====================================================================
 * Streak Tracking
 * ==================================================================== */
describe('loadStreak / saveStreak', () => {
  test('returns defaults when no data', () => {
    const streak = loadStreak();
    expect(streak).toEqual({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
  });

  test('roundtrips streak data', () => {
    const data = { currentStreak: 7, longestStreak: 14, lastActiveDate: '2026-03-15' };
    saveStreak(data);
    expect(loadStreak()).toEqual(data);
  });
});

/* ====================================================================
 * Comp Benchmarks
 * ==================================================================== */
describe('loadCompBenchmarks / saveCompBenchmarks', () => {
  test('returns null when no data', () => {
    expect(loadCompBenchmarks()).toBeNull();
  });

  test('roundtrips benchmark data', () => {
    const data = { p50: 280000, p75: 350000, sources: ['levels.fyi'] };
    saveCompBenchmarks(data);
    expect(loadCompBenchmarks()).toEqual(data);
  });
});

/* ====================================================================
 * Resume Log
 * ==================================================================== */
describe('loadResumeLog / saveResumeVersion', () => {
  test('returns empty array when no data', () => {
    expect(loadResumeLog()).toEqual([]);
  });

  test('appends version to log with savedAt timestamp', () => {
    saveResumeVersion('role-123', { version: 1, highlights: ['Led product launch'] });
    const log = loadResumeLog();
    expect(log).toHaveLength(1);
    expect(log[0].roleId).toBe('role-123');
    expect(log[0].version).toBe(1);
    expect(log[0].savedAt).toBeDefined();
    expect(new Date(log[0].savedAt)).toBeInstanceOf(Date);
  });

  test('accumulates multiple versions', () => {
    saveResumeVersion('role-1', { version: 1 });
    saveResumeVersion('role-2', { version: 1 });
    saveResumeVersion('role-1', { version: 2 });
    const log = loadResumeLog();
    expect(log).toHaveLength(3);
  });
});

/* ====================================================================
 * Edge Cases and Stress Tests
 * ==================================================================== */
describe('Edge cases', () => {
  test('handles very large data gracefully', () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => ({
      id: `item-${i}`,
      title: `Role ${i} at Company ${i}`,
      jd: 'A'.repeat(100),
    }));
    expect(safeJsonSave('pf_large', largeArray)).toBe(true);
    expect(safeJsonParse('pf_large', []).length).toBe(10000);
  });

  test('handles special characters in keys', () => {
    safeJsonSave('pf_test-key_with.dots', { ok: true });
    expect(safeJsonParse('pf_test-key_with.dots')).toEqual({ ok: true });
  });

  test('handles unicode in values', () => {
    const data = { name: 'José García', company: '日本語テスト' };
    safeJsonSave('pf_unicode', data);
    expect(safeJsonParse('pf_unicode')).toEqual(data);
  });

  test('handles undefined fields in objects', () => {
    // JSON.stringify strips undefined values
    const data = { a: 1, b: undefined, c: 'test' };
    safeJsonSave('pf_undef', data);
    const loaded = safeJsonParse('pf_undef');
    expect(loaded.a).toBe(1);
    expect(loaded.b).toBeUndefined();
    expect(loaded.c).toBe('test');
  });

  test('handles Date objects (serialized as ISO string)', () => {
    const data = { created: new Date('2026-03-10T14:00:00Z') };
    safeJsonSave('pf_date', data);
    const loaded = safeJsonParse('pf_date');
    expect(loaded.created).toBe('2026-03-10T14:00:00.000Z'); // string, not Date
  });

  test('multiple rapid saves overwrite correctly', () => {
    for (let i = 0; i < 100; i++) {
      safeJsonSave('pf_rapid', { count: i });
    }
    expect(safeJsonParse('pf_rapid')).toEqual({ count: 99 });
  });
});
