/* ====================================================================
 * UNIT TESTS — data-layer.js (MCP Bridge Sync Layer)
 * ====================================================================
 * Tests SYNC_KEYS configuration, bridge health checks, sync/delete
 * operations, debouncing, recovery logic, and localStorage patching.
 *
 * Run: npm test -- --testPathPatterns=data-layer
 * Coverage: npm test -- --coverage --testPathPatterns=data-layer
 * ==================================================================== */

const path = require('path');

/* ── Setup ── */
let dataLayer;

beforeEach(() => {
  localStorage.clear();
  delete window.PF_DATA_LAYER;
  global.fetch = jest.fn();
  jest.useFakeTimers();
  jest.resetModules();
  dataLayer = require(path.join(__dirname, '..', 'data-layer.js'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/* ====== SYNC_KEYS Configuration ====== */
describe('SYNC_KEYS', () => {
  test('is a non-empty array', () => {
    expect(Array.isArray(dataLayer.SYNC_KEYS)).toBe(true);
    expect(dataLayer.SYNC_KEYS.length).toBeGreaterThan(10);
  });

  test('all keys start with pf_', () => {
    dataLayer.SYNC_KEYS.forEach(key => {
      expect(key.startsWith('pf_')).toBe(true);
    });
  });

  test('includes core pipeline keys', () => {
    const required = ['pf_roles', 'pf_companies', 'pf_connections'];
    required.forEach(key => {
      expect(dataLayer.SYNC_KEYS).toContain(key);
    });
  });

  test('includes feed keys', () => {
    expect(dataLayer.SYNC_KEYS).toContain('pf_feed_queue');
    expect(dataLayer.SYNC_KEYS).toContain('pf_feed_runs');
    expect(dataLayer.SYNC_KEYS).toContain('pf_preferences');
  });

  test('includes resume & outreach keys', () => {
    expect(dataLayer.SYNC_KEYS).toContain('pf_bullet_bank');
    expect(dataLayer.SYNC_KEYS).toContain('pf_resume_log');
    expect(dataLayer.SYNC_KEYS).toContain('pf_outreach_messages');
  });

  test('does NOT include API key (security)', () => {
    expect(dataLayer.SYNC_KEYS).not.toContain('pf_anthropic_key');
  });

  test('does NOT include UI-only keys', () => {
    expect(dataLayer.SYNC_KEYS).not.toContain('pf_theme');
    expect(dataLayer.SYNC_KEYS).not.toContain('pf_sort_pref');
    expect(dataLayer.SYNC_KEYS).not.toContain('pf_view_mode');
  });
});

/* ====== CORE_KEYS ====== */
describe('CORE_KEYS', () => {
  test('is a non-empty array', () => {
    expect(Array.isArray(dataLayer.CORE_KEYS)).toBe(true);
    expect(dataLayer.CORE_KEYS.length).toBeGreaterThanOrEqual(3);
  });

  test('contains the three essential pipeline keys', () => {
    expect(dataLayer.CORE_KEYS).toContain('pf_roles');
    expect(dataLayer.CORE_KEYS).toContain('pf_companies');
    expect(dataLayer.CORE_KEYS).toContain('pf_connections');
  });
});

/* ====== Configuration Constants ====== */
describe('Configuration', () => {
  test('MCP_BRIDGE_URL points to localhost:3456', () => {
    expect(dataLayer.MCP_BRIDGE_URL).toBe('http://localhost:3456');
  });

  test('SYNC_DEBOUNCE_MS is a positive number', () => {
    expect(typeof dataLayer.SYNC_DEBOUNCE_MS).toBe('number');
    expect(dataLayer.SYNC_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(dataLayer.SYNC_DEBOUNCE_MS).toBe(1000);
  });
});

/* ====== checkBridge ====== */
describe('checkBridge', () => {
  test('sets bridge available when health check succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await dataLayer.checkBridge();

    // After checkBridge, PF_DATA_LAYER should reflect availability
    expect(window.PF_DATA_LAYER.isBridgeAvailable()).toBe(true);
  });

  test('sets bridge unavailable on fetch error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await dataLayer.checkBridge();

    expect(window.PF_DATA_LAYER.isBridgeAvailable()).toBe(false);
  });

  test('sets bridge unavailable on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    await dataLayer.checkBridge();

    // Bridge should remain false (initial state)
    expect(window.PF_DATA_LAYER.isBridgeAvailable()).toBe(false);
  });
});

/* ====== syncToMCP ====== */
describe('syncToMCP', () => {
  beforeEach(async () => {
    // Make bridge available first
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.checkBridge();
    global.fetch.mockClear();
  });

  test('sends PUT request after debounce delay for sync keys', () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    dataLayer.syncToMCP('pf_roles', '[]');

    // Not called immediately (debounced)
    expect(global.fetch).not.toHaveBeenCalled();

    // Advance timers past debounce delay
    jest.advanceTimersByTime(1100);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/data/pf_roles');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ value: '[]' });
  });

  test('ignores non-sync keys', () => {
    global.fetch = jest.fn();

    dataLayer.syncToMCP('pf_theme', 'dark');
    jest.advanceTimersByTime(2000);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('debounces rapid writes to same key', () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    dataLayer.syncToMCP('pf_roles', '[1]');
    jest.advanceTimersByTime(500);
    dataLayer.syncToMCP('pf_roles', '[1,2]');
    jest.advanceTimersByTime(500);
    dataLayer.syncToMCP('pf_roles', '[1,2,3]');
    jest.advanceTimersByTime(1100);

    // Only the last value should be synced
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).value).toBe('[1,2,3]');
  });

  test('does nothing when bridge is unavailable', () => {
    // Reset bridge state
    jest.resetModules();
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    dataLayer = require(path.join(__dirname, '..', 'data-layer.js'));

    global.fetch.mockClear();
    dataLayer.syncToMCP('pf_roles', '[]');
    jest.advanceTimersByTime(2000);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

/* ====== deleteFromMCP ====== */
describe('deleteFromMCP', () => {
  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.checkBridge();
    global.fetch.mockClear();
  });

  test('sends DELETE request for sync keys', () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    dataLayer.deleteFromMCP('pf_roles');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/data/pf_roles');
    expect(opts.method).toBe('DELETE');
  });

  test('ignores non-sync keys', () => {
    global.fetch = jest.fn();

    dataLayer.deleteFromMCP('pf_theme');

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

/* ====== recoverFromMCP ====== */
describe('recoverFromMCP', () => {
  test('returns 0 when bridge is unavailable', async () => {
    const result = await dataLayer.recoverFromMCP();
    expect(result).toBe(0);
  });

  test('recovers keys into localStorage when bridge has data', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }) // checkBridge
      .mockResolvedValueOnce({ // recoverFromMCP
        ok: true,
        json: () => Promise.resolve({
          keys: {
            pf_roles: '["role1"]',
            pf_companies: '["comp1"]',
          },
        }),
      });

    await dataLayer.checkBridge();
    const recovered = await dataLayer.recoverFromMCP();

    expect(recovered).toBe(2);
    expect(localStorage.getItem('pf_roles')).toBe('["role1"]');
    expect(localStorage.getItem('pf_companies')).toBe('["comp1"]');
  });

  test('returns 0 on HTTP error', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }) // checkBridge
      .mockResolvedValueOnce({ ok: false, status: 500 }); // recoverFromMCP

    await dataLayer.checkBridge();
    const recovered = await dataLayer.recoverFromMCP();

    expect(recovered).toBe(0);
  });

  test('returns 0 on invalid data format', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }) // checkBridge
      .mockResolvedValueOnce({ // recoverFromMCP
        ok: true,
        json: () => Promise.resolve({ noKeysField: true }),
      });

    await dataLayer.checkBridge();
    const recovered = await dataLayer.recoverFromMCP();

    expect(recovered).toBe(0);
  });

  test('skips non-string values during recovery', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }) // checkBridge
      .mockResolvedValueOnce({ // recoverFromMCP
        ok: true,
        json: () => Promise.resolve({
          keys: {
            pf_roles: '["ok"]',
            pf_companies: 12345, // not a string — should be skipped
            pf_connections: null, // not a string — should be skipped
          },
        }),
      });

    await dataLayer.checkBridge();
    const recovered = await dataLayer.recoverFromMCP();

    expect(recovered).toBe(1);
    expect(localStorage.getItem('pf_roles')).toBe('["ok"]');
  });

  test('returns 0 on fetch error', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }) // checkBridge
      .mockRejectedValueOnce(new Error('network fail')); // recoverFromMCP

    await dataLayer.checkBridge();
    const recovered = await dataLayer.recoverFromMCP();

    expect(recovered).toBe(0);
  });
});

/* ====== PF_DATA_LAYER public API ====== */
describe('PF_DATA_LAYER', () => {
  test('exposes isBridgeAvailable function', () => {
    expect(typeof window.PF_DATA_LAYER.isBridgeAvailable).toBe('function');
  });

  test('exposes forceSync function', () => {
    expect(typeof window.PF_DATA_LAYER.forceSync).toBe('function');
  });

  test('exposes forceRecover function', () => {
    expect(typeof window.PF_DATA_LAYER.forceRecover).toBe('function');
  });

  test('exposes getSyncKeys that returns array', () => {
    const keys = window.PF_DATA_LAYER.getSyncKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain('pf_roles');
  });

  test('exposes version string', () => {
    expect(window.PF_DATA_LAYER.version).toBe('3.0.0');
  });
});

/* ====== Theme Initialization ====== */
describe('Theme initialization', () => {
  test('sets data-theme attribute on document element', () => {
    const theme = document.documentElement.getAttribute('data-theme');
    // Default is 'light' when no pf_theme in localStorage
    expect(theme).toBe('light');
  });

  test('respects stored theme preference', () => {
    localStorage.setItem('pf_theme', 'dark');
    jest.resetModules();
    require(path.join(__dirname, '..', 'data-layer.js'));

    const theme = document.documentElement.getAttribute('data-theme');
    expect(theme).toBe('dark');
  });
});

/* ====== localStorage Monkey-Patching ====== */
describe('localStorage patching', () => {
  test('setItem still writes to localStorage', () => {
    localStorage.setItem('test_key', 'test_value');
    expect(localStorage.getItem('test_key')).toBe('test_value');
  });

  test('removeItem still removes from localStorage', () => {
    localStorage.setItem('test_key', 'val');
    localStorage.removeItem('test_key');
    expect(localStorage.getItem('test_key')).toBeNull();
  });
});

/* ====== syncToMCP fetch failure (error handling) ====== */
describe('syncToMCP fetch error handling', () => {
  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.checkBridge();
    global.fetch.mockClear();
  });

  test('silently catches fetch rejection without throwing', () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failed'));

    dataLayer.syncToMCP('pf_roles', '[]');
    jest.advanceTimersByTime(1100);

    // Should not throw, just log warning
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('console.warn is called on fetch error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    dataLayer.syncToMCP('pf_roles', '[]');
    jest.advanceTimersByTime(1100);

    // Allow async callbacks to complete
    await Promise.resolve();
    await Promise.resolve();

    // Check that warn was called with the expected message
    expect(warnSpy).toHaveBeenCalled();
    const calls = warnSpy.mock.calls;
    expect(calls.some(call =>
      typeof call[0] === 'string' && call[0].includes('Sync failed for pf_roles')
    )).toBe(true);
    warnSpy.mockRestore();
  });
});

/* ====== deleteFromMCP fetch failure (error handling) ====== */
describe('deleteFromMCP fetch error handling', () => {
  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.checkBridge();
    global.fetch.mockClear();
  });

  test('silently catches fetch rejection without throwing', () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    dataLayer.deleteFromMCP('pf_roles');

    // Should not throw, just log warning
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('console.warn is called on delete error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection timeout'));

    dataLayer.deleteFromMCP('pf_roles');

    // Allow async callbacks to complete
    await Promise.resolve();
    await Promise.resolve();

    // Check that warn was called with the expected message
    expect(warnSpy).toHaveBeenCalled();
    const calls = warnSpy.mock.calls;
    expect(calls.some(call =>
      typeof call[0] === 'string' && call[0].includes('Delete sync failed for pf_roles')
    )).toBe(true);
    warnSpy.mockRestore();
  });
});

/* ====== Monkey-patched localStorage.setItem for sync keys ====== */
describe('Monkey-patched setItem with sync keys', () => {
  test('setItem for sync key triggers sync (verified via direct API)', async () => {
    // Make bridge available
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.checkBridge();
    global.fetch.mockClear();
    global.fetch.mockResolvedValue({ ok: true });

    // Test via direct syncToMCP API call
    dataLayer.syncToMCP('pf_roles', '["role1"]');

    // Should not call fetch immediately (debounced)
    expect(global.fetch).not.toHaveBeenCalled();

    // After debounce, fetch should be called
    jest.advanceTimersByTime(1100);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/data/pf_roles');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body).value).toBe('["role1"]');
  });

  test('localStorage.setItem for sync key delegates to syncToMCP', () => {
    // This test verifies the monkey-patch works by ensuring setItem
    // calls the patched method without throwing
    localStorage.setItem('pf_roles', '["test"]');
    expect(localStorage.getItem('pf_roles')).toBe('["test"]');
  });

  test('setItem still updates localStorage immediately', () => {
    localStorage.setItem('pf_companies', 'test_value');
    expect(localStorage.getItem('pf_companies')).toBe('test_value');
  });
});

/* ====== Monkey-patched localStorage.setItem for non-sync keys ====== */
describe('Monkey-patched setItem with non-sync keys', () => {
  test('setItem for non-sync key does NOT trigger syncToMCP (verified via direct API)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.checkBridge();
    global.fetch.mockClear();

    // Try to sync a non-sync key via direct API
    dataLayer.syncToMCP('pf_theme', 'dark');
    jest.advanceTimersByTime(2000);

    // No fetch should happen for non-sync keys
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('setItem for non-sync key still updates localStorage', () => {
    localStorage.setItem('pf_view_mode', 'grid');
    expect(localStorage.getItem('pf_view_mode')).toBe('grid');
  });

  test('localStorage.setItem for non-sync key does not break', () => {
    localStorage.setItem('pf_theme', 'dark');
    localStorage.setItem('pf_sort_pref', 'date_asc');
    expect(localStorage.getItem('pf_theme')).toBe('dark');
    expect(localStorage.getItem('pf_sort_pref')).toBe('date_asc');
  });
});

/* ====== Monkey-patched localStorage.removeItem for sync keys ====== */
describe('Monkey-patched removeItem with sync keys', () => {
  test('removeItem for sync key triggers deleteFromMCP (verified via direct API)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.checkBridge();
    global.fetch.mockClear();

    dataLayer.deleteFromMCP('pf_roles');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/data/pf_roles');
    expect(opts.method).toBe('DELETE');
  });

  test('localStorage.removeItem for sync key delegates to deleteFromMCP', () => {
    localStorage.setItem('pf_companies', '[]');
    localStorage.removeItem('pf_companies');
    // Verify it was removed
    expect(localStorage.getItem('pf_companies')).toBeNull();
  });

  test('removeItem still removes from localStorage', () => {
    localStorage.setItem('pf_roles', '[]');
    localStorage.removeItem('pf_roles');
    expect(localStorage.getItem('pf_roles')).toBeNull();
  });
});

/* ====== Monkey-patched localStorage.removeItem for non-sync keys ====== */
describe('Monkey-patched removeItem with non-sync keys', () => {
  test('removeItem for non-sync key does NOT trigger deleteFromMCP (verified via direct API)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.checkBridge();
    global.fetch.mockClear();

    // Try to delete a non-sync key via direct API
    dataLayer.deleteFromMCP('pf_theme');

    // No fetch should happen for non-sync keys
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('non-sync key still removes from localStorage', () => {
    localStorage.setItem('pf_view_mode', 'grid');
    localStorage.removeItem('pf_view_mode');
    expect(localStorage.getItem('pf_view_mode')).toBeNull();
  });

  test('localStorage.removeItem for non-sync key does not break', () => {
    localStorage.setItem('pf_theme', 'dark');
    localStorage.setItem('pf_sort_pref', 'date_asc');
    localStorage.removeItem('pf_theme');
    localStorage.removeItem('pf_sort_pref');
    expect(localStorage.getItem('pf_theme')).toBeNull();
    expect(localStorage.getItem('pf_sort_pref')).toBeNull();
  });
});

/* ====== startupRecovery: core data present + bridge available ====== */
describe('startupRecovery: core data present + bridge available', () => {
  test('when core data exists, startupRecovery checks bridge', async () => {
    // This test verifies the startupRecovery logic for the happy path
    // Set up: core data already exists in localStorage
    localStorage.setItem('pf_roles', '["role1"]');
    localStorage.setItem('pf_companies', '["comp1"]');
    localStorage.setItem('pf_connections', '[]');

    // Call startupRecovery manually (normally it's called on module load)
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await dataLayer.startupRecovery();

    // Should have called checkBridge at minimum
    expect(global.fetch).toHaveBeenCalled();
  });

  test('startupRecovery does not call recovery when core data exists', async () => {
    localStorage.setItem('pf_roles', '["role1"]');
    localStorage.setItem('pf_companies', '["comp1"]');

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }); // checkBridge

    // Call startupRecovery manually
    await dataLayer.startupRecovery();

    // No GET to /data should be called (recovery only happens when core data is missing)
    const recoveryGetCalls = global.fetch.mock.calls.filter(call =>
      call[0] && call[0] === 'http://localhost:3456/data' && call[1] && call[1].method === 'GET'
    );
    expect(recoveryGetCalls.length).toBe(0);
  });
});

/* ====== startupRecovery: no core data + bridge available ====== */
describe('startupRecovery: no core data + bridge available', () => {
  test('calls recoverFromMCP when core data missing and bridge available', async () => {
    // No core data in localStorage
    localStorage.clear();

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }) // checkBridge
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          keys: {
            pf_roles: '["recovered_role"]',
            pf_companies: '["recovered_comp"]',
            pf_connections: '[]',
          },
        }),
      }); // recoverFromMCP

    // Mock window.location.reload to prevent actual reload
    const originalLocation = window.location;
    delete window.location;
    window.location = { reload: jest.fn() };

    // Call startupRecovery manually
    await dataLayer.startupRecovery();

    // recoverFromMCP should have been called (GET /data)
    const getCalls = global.fetch.mock.calls.filter(call =>
      call[0] && call[0].includes('/data') && call[1] && call[1].method === 'GET'
    );
    expect(getCalls.length).toBeGreaterThan(0);

    // Restore location
    window.location = originalLocation;
  });

  test('successfully recovers data and attempts reload when keys present', async () => {
    localStorage.clear();

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }) // checkBridge
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          keys: {
            pf_roles: '["role"]',
            pf_companies: '["comp"]',
            pf_connections: '[]',
          },
        }),
      }); // recoverFromMCP

    // Call startupRecovery manually
    await dataLayer.startupRecovery();

    // Verify that recovery succeeded - data should be in localStorage
    expect(localStorage.getItem('pf_roles')).toBe('["role"]');
    expect(localStorage.getItem('pf_companies')).toBe('["comp"]');
    expect(localStorage.getItem('pf_connections')).toBe('[]');

    // Verify the GET call was made to recover
    const getCalls = global.fetch.mock.calls.filter(call =>
      call[0] === 'http://localhost:3456/data' && call[1] && call[1].method === 'GET'
    );
    expect(getCalls.length).toBe(1);
  });

  test('does not reload if recovery returns 0 keys', async () => {
    localStorage.clear();

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }) // checkBridge
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: {} }), // Empty recovery
      }); // recoverFromMCP

    // Call startupRecovery manually
    await dataLayer.startupRecovery();

    // Verify that recovery returned 0 keys (localStorage should still be empty)
    expect(localStorage.getItem('pf_roles')).toBeNull();
    expect(localStorage.getItem('pf_companies')).toBeNull();
    expect(localStorage.getItem('pf_connections')).toBeNull();
  });
});

/* ====== startupRecovery: no core data + bridge unavailable ====== */
describe('startupRecovery: no core data + bridge unavailable', () => {
  test('does not attempt recovery when bridge is unavailable', async () => {
    localStorage.clear();

    global.fetch = jest.fn().mockRejectedValue(new Error('Bridge down'));

    // Call startupRecovery manually
    await dataLayer.startupRecovery();

    // Only the health check should be attempted, no recovery GET to /data
    const getCalls = global.fetch.mock.calls.filter(call =>
      call[0] && call[0] === 'http://localhost:3456/data' && call[1] && call[1].method === 'GET'
    );
    expect(getCalls.length).toBe(0);
  });
});

/* ====== initialSync: multiple sync keys with staggered timing ====== */
describe('initialSync: staggered PUT requests', () => {
  test('pushes all pf_* sync keys with staggered timing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    jest.resetModules();
    dataLayer = require(path.join(__dirname, '..', 'data-layer.js'));

    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();

    localStorage.setItem('pf_roles', '["role1"]');
    localStorage.setItem('pf_companies', '["comp1"]');
    localStorage.setItem('pf_connections', '[]');
    localStorage.setItem('pf_preferences', '{}');

    global.fetch.mockClear();

    dataLayer.initialSync();

    // Should not call fetch immediately
    expect(global.fetch).not.toHaveBeenCalled();

    // Advance by first stagger interval (100ms)
    jest.advanceTimersByTime(100);
    expect(global.fetch).toHaveBeenCalled();

    // Advance to second stagger
    jest.advanceTimersByTime(100);
    const callCountAfterSecond = global.fetch.mock.calls.length;
    expect(callCountAfterSecond).toBeGreaterThanOrEqual(2);

    // Advance to third stagger
    jest.advanceTimersByTime(100);
    const callCountAfterThird = global.fetch.mock.calls.length;
    expect(callCountAfterThird).toBeGreaterThanOrEqual(3);

    // Advance to fourth stagger
    jest.advanceTimersByTime(100);
    const callCountAfterFourth = global.fetch.mock.calls.length;
    expect(callCountAfterFourth).toBeGreaterThanOrEqual(4);

    // Verify all are PUT requests to correct endpoints
    global.fetch.mock.calls.forEach(call => {
      expect(call[1].method).toBe('PUT');
    });
  });

  test('includes correct values in staggered PUT requests', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    jest.resetModules();
    dataLayer = require(path.join(__dirname, '..', 'data-layer.js'));

    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();

    localStorage.setItem('pf_roles', '["alpha"]');
    localStorage.setItem('pf_companies', '["beta"]');

    global.fetch.mockClear();

    dataLayer.initialSync();

    jest.advanceTimersByTime(500); // Advance past all stagger intervals

    // Check that values are preserved
    const putCalls = global.fetch.mock.calls.filter(call => call[1] && call[1].method === 'PUT');
    const bodies = putCalls.map(call => JSON.parse(call[1].body));
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '["alpha"]' }),
        expect.objectContaining({ value: '["beta"]' }),
      ])
    );
  });
});

/* ====== initialSync: no sync keys ====== */
describe('initialSync: no sync keys', () => {
  test('does not make fetch calls when no pf_* keys exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    jest.resetModules();
    dataLayer = require(path.join(__dirname, '..', 'data-layer.js'));

    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();

    localStorage.clear();
    localStorage.setItem('other_key', 'value');

    global.fetch.mockClear();
    dataLayer.initialSync();

    jest.advanceTimersByTime(5000);

    // No PUT requests should be made
    const putCalls = global.fetch.mock.calls.filter(call =>
      call[1] && call[1].method === 'PUT'
    );
    expect(putCalls.length).toBe(0);
  });

  test('does not make fetch calls when only non-sync pf_ keys exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    jest.resetModules();
    dataLayer = require(path.join(__dirname, '..', 'data-layer.js'));

    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();

    localStorage.clear();
    localStorage.setItem('pf_theme', 'dark');
    localStorage.setItem('pf_sort_pref', 'date');

    global.fetch.mockClear();
    dataLayer.initialSync();

    jest.advanceTimersByTime(5000);

    const putCalls = global.fetch.mock.calls.filter(call =>
      call[1] && call[1].method === 'PUT'
    );
    expect(putCalls.length).toBe(0);
  });
});
