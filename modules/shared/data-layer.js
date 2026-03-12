// ================================================================
// Pathfinder Data Layer (v3.0.0)
// ================================================================
// Makes localStorage durable by syncing every pf_* key to the MCP
// HTTP bridge at localhost:3456. If localStorage is ever cleared,
// the data auto-recovers from MCP on next page load.
//
// HOW IT WORKS:
// 1. Monkey-patches localStorage.setItem and localStorage.removeItem
// 2. On every write to a pf_* key, fires a background PUT to MCP
// 3. On page load, checks if core data exists in localStorage
// 4. If empty, fetches everything from MCP and populates localStorage
//
// IMPORTANT: This script must be loaded BEFORE any module code runs.
// Include it as the FIRST <script> in every module's <head> section.
//
// The MCP bridge is optional — if it's not running, the app works
// normally via localStorage alone. When the bridge comes back online,
// future writes will sync. The "sync on startup" recovery only
// fires if localStorage is actually empty.
// ================================================================

(function() {
  'use strict';

  // ============================================================
  // Configuration
  // ============================================================

  /** MCP HTTP bridge URL */
  const MCP_BRIDGE_URL = 'http://localhost:3456';

  /**
   * Keys that should sync to MCP (the important data).
   * UI-only keys (theme, view mode, sort prefs) are excluded.
   * API keys are excluded for security — they stay local only.
   */
  const SYNC_KEYS = new Set([
    // Core pipeline data
    'pf_roles',
    'pf_companies',
    'pf_connections',
    'pf_linkedin_network',

    // Feed & preferences
    'pf_preferences',
    'pf_feed_queue',
    'pf_feed_runs',

    // Resume & outreach
    'pf_bullet_bank',
    'pf_resume_log',
    'pf_outreach_messages',
    'pf_outreach_sequences',

    // Mock interview & debrief
    'pf_mock_sessions',
    'pf_story_bank',
    'pf_debriefs',

    // Comp intel
    'pf_comp_data',

    // Calendar
    'pf_calendar_events',
    'pf_calendar_nudges',

    // Sync log
    'pf_sync_log',

    // Dashboard state (important, not just UI)
    'pf_streak',
    'pf_dismissed_nudges',
  ]);

  /**
   * Keys that indicate "core data exists" — if ALL of these are
   * missing from localStorage, we trigger a full recovery from MCP.
   * We don't recover if just one key is missing (could be normal).
   */
  const CORE_KEYS = ['pf_roles', 'pf_companies', 'pf_connections'];

  /** Whether the MCP bridge is reachable (set after health check) */
  let bridgeAvailable = false;

  /** Debounce timers for each key (prevents flooding MCP with rapid writes) */
  const syncTimers = {};

  /** Debounce delay in ms — writes are batched per key */
  const SYNC_DEBOUNCE_MS = 1000;

  // ============================================================
  // MCP Bridge Communication
  // ============================================================

  /**
   * Checks if the MCP bridge is reachable.
   * Called once on page load. Sets bridgeAvailable flag.
   * Non-blocking — app works without the bridge.
   */
  async function checkBridge() {
    try {
      const resp = await fetch(`${MCP_BRIDGE_URL}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      if (resp.ok) {
        bridgeAvailable = true;
        console.log('[DataLayer] MCP bridge connected');
      }
    } catch {
      bridgeAvailable = false;
      console.warn('[DataLayer] MCP bridge not available — localStorage only mode');
    }
  }

  /**
   * Syncs a single key's value to the MCP bridge (fire-and-forget).
   * Uses debouncing to avoid flooding the bridge during rapid updates.
   * INPUT: key = string, value = string (raw localStorage value)
   * SIDE EFFECTS: PUTs data to MCP bridge in background
   */
  function syncToMCP(key, value) {
    if (!bridgeAvailable || !SYNC_KEYS.has(key)) return;

    // Clear any pending timer for this key (debounce)
    if (syncTimers[key]) {
      clearTimeout(syncTimers[key]);
    }

    // Schedule the sync after debounce delay
    syncTimers[key] = setTimeout(() => {
      delete syncTimers[key];

      fetch(`${MCP_BRIDGE_URL}/data/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      }).catch(err => {
        // Silently fail — localStorage still has the data
        console.warn(`[DataLayer] Sync failed for ${key}:`, err.message);
      });
    }, SYNC_DEBOUNCE_MS);
  }

  /**
   * Deletes a key from MCP bridge (fire-and-forget).
   * INPUT: key = string
   */
  function deleteFromMCP(key) {
    if (!bridgeAvailable || !SYNC_KEYS.has(key)) return;

    fetch(`${MCP_BRIDGE_URL}/data/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }).catch(err => {
      console.warn(`[DataLayer] Delete sync failed for ${key}:`, err.message);
    });
  }

  /**
   * Recovers all data from MCP bridge into localStorage.
   * Called on startup when core keys are missing from localStorage.
   * This is the magic that makes "clear localStorage" recoverable.
   * RETURNS: number of keys recovered
   */
  async function recoverFromMCP() {
    if (!bridgeAvailable) return 0;

    try {
      console.log('[DataLayer] Recovering data from MCP bridge...');
      const resp = await fetch(`${MCP_BRIDGE_URL}/data`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout for full recovery
      });

      if (!resp.ok) {
        console.warn('[DataLayer] Recovery failed — HTTP', resp.status);
        return 0;
      }

      const data = await resp.json();
      if (!data.keys || typeof data.keys !== 'object') {
        console.warn('[DataLayer] Recovery returned invalid data');
        return 0;
      }

      let recovered = 0;
      // Use the ORIGINAL setItem (not our patched version) to avoid
      // re-syncing data we just fetched from MCP
      for (const [key, value] of Object.entries(data.keys)) {
        if (typeof value === 'string') {
          originalSetItem.call(localStorage, key, value);
          recovered++;
        }
      }

      console.log(`[DataLayer] Recovered ${recovered} keys from MCP bridge`);
      return recovered;
    } catch (err) {
      console.warn('[DataLayer] Recovery error:', err.message);
      return 0;
    }
  }

  // ============================================================
  // localStorage Monkey-Patching
  // ============================================================
  // We intercept setItem and removeItem to transparently sync
  // pf_* keys to MCP. Module code doesn't change at all —
  // it still calls localStorage.setItem() as before.
  // ============================================================

  /** Save references to the original methods */
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  /**
   * Patched localStorage.setItem — writes to localStorage AND syncs to MCP.
   * Only pf_* keys in the SYNC_KEYS set are synced.
   */
  localStorage.setItem = function(key, value) {
    // Always write to localStorage first (fast, synchronous)
    originalSetItem(key, value);

    // Then sync to MCP in background (async, non-blocking)
    syncToMCP(key, value);
  };

  /**
   * Patched localStorage.removeItem — removes from localStorage AND MCP.
   */
  localStorage.removeItem = function(key) {
    // Always remove from localStorage first
    originalRemoveItem(key);

    // Then delete from MCP
    deleteFromMCP(key);
  };

  // ============================================================
  // Startup Recovery
  // ============================================================
  // On page load: check if core data exists. If not, and the
  // MCP bridge is available, recover everything from disk.
  // This handles the "user cleared localStorage" scenario.
  // ============================================================

  /**
   * Checks if localStorage has core data. If all core keys are
   * missing, attempts recovery from MCP bridge.
   */
  async function startupRecovery() {
    // First, check if the bridge is even available
    await checkBridge();

    // Check if core data exists in localStorage
    const hasData = CORE_KEYS.some(key => localStorage.getItem(key) !== null);

    if (hasData) {
      // Core data exists — do an initial sync of any locally-changed keys
      // to MCP (in case the bridge was down when changes were made)
      if (bridgeAvailable) {
        initialSync();
      }
      return;
    }

    // Core data is MISSING — try to recover from MCP
    if (bridgeAvailable) {
      const recovered = await recoverFromMCP();
      if (recovered > 0) {
        // Reload the page so module code picks up the recovered data
        console.log('[DataLayer] Data recovered — reloading page...');
        window.location.reload();
      }
    }
  }

  /**
   * Initial sync: pushes any localStorage data to MCP that might
   * not have been synced yet (e.g., if bridge was down during writes).
   * Runs in background, non-blocking.
   */
  function initialSync() {
    // Collect all pf_* keys from localStorage
    const keysToSync = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && SYNC_KEYS.has(key)) {
        keysToSync.push(key);
      }
    }

    if (keysToSync.length === 0) return;

    // Sync each key (with debouncing, so they don't all fire at once)
    let delay = 0;
    for (const key of keysToSync) {
      setTimeout(() => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          fetch(`${MCP_BRIDGE_URL}/data/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          }).catch(() => {}); // Silently fail
        }
      }, delay);
      delay += 100; // Stagger requests 100ms apart
    }

    console.log(`[DataLayer] Initial sync: ${keysToSync.length} keys queued`);
  }

  // ============================================================
  // Expose Utilities for Module Code (optional)
  // ============================================================
  // Modules can call these directly if they need explicit control,
  // but they don't need to — the monkey-patch handles everything.
  // ============================================================

  window.PF_DATA_LAYER = {
    /** Check if MCP bridge is available */
    isBridgeAvailable: () => bridgeAvailable,

    /** Force a full sync of all localStorage keys to MCP */
    forceSync: initialSync,

    /** Force recovery from MCP (overwrites localStorage) */
    forceRecover: recoverFromMCP,

    /** Get the set of keys being synced */
    getSyncKeys: () => [...SYNC_KEYS],

    /** Version identifier */
    version: '3.0.0',
  };

  // ============================================================
  // Initialize
  // ============================================================
  // Run startup recovery. This is async but non-blocking — the
  // page continues loading while recovery happens in background.
  // The only time it blocks is if recovery succeeds and triggers
  // a page reload (which is intentional).
  // ============================================================

  startupRecovery();

})();
