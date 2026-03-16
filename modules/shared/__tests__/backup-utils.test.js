/* ====================================================================
 * UNIT TESTS — backup-utils.js (Data Export/Import)
 * ====================================================================
 * Tests backup export, import validation, stats, and edge cases.
 *
 * Run: npm test -- --testPathPatterns=backup-utils
 * Coverage: npm test -- --coverage --testPathPatterns=backup-utils
 * ==================================================================== */

const {
  exportBackup,
  importBackup,
  getBackupStats,
  hasBackupBeenCreated,
  getLastBackupTime
} = require('../backup-utils');

beforeEach(() => {
  localStorage.clear();
  // Mock URL.createObjectURL / revokeObjectURL / Blob for export tests
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = jest.fn();
  global.Blob = jest.fn((parts, opts) => ({ parts, opts }));
});

/* ====== exportBackup ====== */
describe('exportBackup', () => {
  test('returns backup object with version and keys', () => {
    localStorage.setItem('pf_roles', '["role1"]');
    localStorage.setItem('pf_companies', '["comp1"]');
    localStorage.setItem('other_key', 'ignored');

    const backup = exportBackup();

    expect(backup.version).toBe('1.0');
    expect(backup.appVersion).toContain('pathfinder');
    expect(backup.exportedAt).toBeTruthy();
    expect(backup.keys.pf_roles).toBe('["role1"]');
    expect(backup.keys.pf_companies).toBe('["comp1"]');
    expect(backup.keys.other_key).toBeUndefined();
  });

  test('only includes pf_* keys', () => {
    localStorage.setItem('pf_roles', '[]');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('session_id', '123');

    const backup = exportBackup();

    expect(Object.keys(backup.keys)).toEqual(['pf_roles']);
  });

  test('triggers download via DOM', () => {
    localStorage.setItem('pf_roles', '[]');
    const clickSpy = jest.fn();
    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    exportBackup();

    expect(global.Blob).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    document.createElement.mockRestore();
  });

  test('sets pf_last_backup timestamp', () => {
    exportBackup();
    expect(localStorage.getItem('pf_last_backup')).toBeTruthy();
  });

  test('handles empty localStorage', () => {
    const backup = exportBackup();
    // Only pf_last_backup should be set (by export itself)
    expect(Object.keys(backup.keys).length).toBe(0);
  });
});

/* ====== importBackup ====== */
describe('importBackup', () => {
  test('restores valid backup keys', () => {
    const json = JSON.stringify({
      version: '1.0',
      keys: { pf_roles: '["r1"]', pf_companies: '["c1"]' }
    });

    const result = importBackup(json);

    expect(result.success).toBe(true);
    expect(result.keysRestored).toBe(2);
    expect(localStorage.getItem('pf_roles')).toBe('["r1"]');
    expect(localStorage.getItem('pf_companies')).toBe('["c1"]');
  });

  test('rejects missing keys object', () => {
    const json = JSON.stringify({ version: '1.0' });
    const result = importBackup(json);

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing keys object');
  });

  test('rejects missing version', () => {
    const json = JSON.stringify({ keys: { pf_roles: '[]' } });
    const result = importBackup(json);

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing version');
  });

  test('rejects invalid JSON', () => {
    const result = importBackup('not json at all');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse');
  });

  test('skips non-pf_ keys', () => {
    const json = JSON.stringify({
      version: '1.0',
      keys: { pf_roles: '[]', other: 'bad' }
    });

    const result = importBackup(json);

    expect(result.keysRestored).toBe(1);
    expect(localStorage.getItem('other')).toBeNull();
  });

  test('skips non-string values', () => {
    const json = JSON.stringify({
      version: '1.0',
      keys: { pf_roles: '[]', pf_companies: 12345, pf_connections: null }
    });

    const result = importBackup(json);

    expect(result.keysRestored).toBe(1);
  });

  test('sets pf_last_backup on successful import', () => {
    const json = JSON.stringify({
      version: '1.0',
      keys: { pf_roles: '[]' }
    });

    importBackup(json);
    expect(localStorage.getItem('pf_last_backup')).toBeTruthy();
  });
});

/* ====== getBackupStats ====== */
describe('getBackupStats', () => {
  test('counts pf_* keys and estimates size', () => {
    localStorage.setItem('pf_roles', 'abcd'); // 4 chars = 8 bytes
    localStorage.setItem('pf_companies', 'ef'); // 2 chars = 4 bytes
    localStorage.setItem('other', 'ignored');

    const stats = getBackupStats();

    expect(stats.keyCount).toBe(2);
    expect(stats.totalSizeBytes).toBe(12);
  });

  test('returns zeros for empty localStorage', () => {
    const stats = getBackupStats();

    expect(stats.keyCount).toBe(0);
    expect(stats.totalSizeBytes).toBe(0);
  });
});

/* ====== hasBackupBeenCreated ====== */
describe('hasBackupBeenCreated', () => {
  test('returns false when no backup exists', () => {
    expect(hasBackupBeenCreated()).toBe(false);
  });

  test('returns true after backup', () => {
    localStorage.setItem('pf_last_backup', '2026-03-16');
    expect(hasBackupBeenCreated()).toBe(true);
  });
});

/* ====== getLastBackupTime ====== */
describe('getLastBackupTime', () => {
  test('returns null when no backup exists', () => {
    expect(getLastBackupTime()).toBeNull();
  });

  test('returns Date when backup exists', () => {
    localStorage.setItem('pf_last_backup', '2026-03-16T12:00:00Z');
    const result = getLastBackupTime();

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-03-16T12:00:00.000Z');
  });
});
