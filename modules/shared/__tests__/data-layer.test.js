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
