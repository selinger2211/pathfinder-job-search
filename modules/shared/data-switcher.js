/**
 * ============================================================
 * PATHFINDER DATA SWITCHER
 * ============================================================
 * Provides a toggle in the nav bar to switch between "Demo" and
 * "Personal" data modes. Demo mode uses each module's built-in
 * sample data; Personal mode loads your real data from the
 * migration-output JSON files (produced by migrate-contacts.py).
 *
 * HOW IT WORKS
 *   1. Reads `pf_data_mode` from localStorage ('demo' | 'personal')
 *   2. Injects a small toggle pill into the nav bar
 *   3. On switch:
 *      - "Demo": clears all pf_* keys → modules re-seed demo data on reload
 *      - "Personal": fetches migration JSON → writes to pf_connections,
 *        pf_companies, and pf_roles → reloads so modules pick up the real data
 *
 * USAGE
 *   Just include this script in any module's HTML:
 *   <script src="../shared/data-switcher.js"></script>
 *
 * The toggle appears at the right end of the nav bar.
 * ============================================================
 */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */

  const MODE_KEY = 'pf_data_mode';

  /**
   * MIGRATION VERSION — bump this number whenever pf_roles.json,
   * pf_companies.json, or pf_connections.json change. When the
   * stored version doesn't match, we force-reseed personal data
   * on the next Personal mode load (clearing stale migration data).
   */
  const MIGRATION_VERSION = 3;
  const MIGRATION_VERSION_KEY = 'pf_migration_version';

  /** All localStorage keys the Pathfinder app uses.
   *  When switching modes, we dynamically find all pf_* keys
   *  (except pf_data_mode, pf_anthropic_key, and migration version)
   *  so we never miss a module's data. */
  function getAllPfKeys() {
    const protected_keys = ['pf_data_mode', 'pf_anthropic_key', 'pf_claude_model', MIGRATION_VERSION_KEY];
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('pf_') && !protected_keys.includes(key)) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Check if migration data needs a forced refresh.
   * Returns true if the stored version doesn't match MIGRATION_VERSION.
   */
  function migrationNeedsRefresh() {
    const stored = parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '0', 10);
    return stored < MIGRATION_VERSION;
  }

  /**
   * Mark migration as current version after successful seed.
   */
  function markMigrationCurrent() {
    localStorage.setItem(MIGRATION_VERSION_KEY, String(MIGRATION_VERSION));
  }

  /** Path to migration-output JSON files (relative to any module page) */
  const MIGRATION_BASE = '../../scripts/migration-output';

  /* ── Current mode ──────────────────────────────────────── */

  function getMode() {
    return localStorage.getItem(MODE_KEY) || 'demo';
  }

  function setMode(mode) {
    localStorage.setItem(MODE_KEY, mode);
  }

  /* ── Data switching logic ──────────────────────────────── */

  /** Backup personal data before clearing for demo mode.
   *  Stores copies with a _personal_backup suffix so they survive
   *  a round-trip through demo mode. */
  function backupPersonalData() {
    const keysToBackup = ['pf_connections', 'pf_companies', 'pf_roles'];
    keysToBackup.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) {
        localStorage.setItem(key + '_personal_backup', val);
      }
    });
  }

  /** Restore personal data from backup (after returning from demo mode).
   *  Returns true if backups were found and restored. */
  function restorePersonalBackup() {
    const keysToRestore = ['pf_connections', 'pf_companies', 'pf_roles'];
    let restored = false;
    keysToRestore.forEach(key => {
      const backup = localStorage.getItem(key + '_personal_backup');
      if (backup) {
        localStorage.setItem(key, backup);
        restored = true;
      }
    });
    return restored;
  }

  /** Clear all Pathfinder data keys so modules re-seed demo data.
   *  Dynamically finds all pf_* keys to ensure nothing is missed.
   *  Preserves _personal_backup keys so user edits survive. */
  function clearAllData() {
    getAllPfKeys().forEach(key => {
      if (!key.endsWith('_personal_backup')) {
        localStorage.removeItem(key);
      }
    });
  }

  /** Seed personal data from migration output files.
   *  IMPORTANT: This ONLY writes data that doesn't already exist in localStorage.
   *  If the user has already edited roles, stages, notes, etc., those edits are
   *  preserved. To force a re-import, clear localStorage first (or use the
   *  "Re-import" button if available).
   *
   *  INPUT: reads pf_connections.json, pf_companies.json, pf_roles.json
   *  OUTPUT: populates localStorage with personal data, returns counts */
  async function loadPersonalData() {
    try {
      const [connRes, compRes, rolesRes] = await Promise.all([
        fetch(MIGRATION_BASE + '/pf_connections.json'),
        fetch(MIGRATION_BASE + '/pf_companies.json'),
        fetch(MIGRATION_BASE + '/pf_roles.json')
      ]);

      if (!connRes.ok || !compRes.ok) {
        throw new Error('Migration files not found. Run migrate-contacts.py first.');
      }

      const connections = await connRes.json();
      const companies = await compRes.json();

      // Roles file is optional — if it doesn't exist, default to empty array.
      const roles = rolesRes.ok ? await rolesRes.json() : [];

      // SEED-ONCE strategy with MIGRATION VERSION check:
      // If the migration version has changed (new data in JSON files),
      // force-overwrite the three core keys so the user gets the latest data.
      // Otherwise, only write if the key doesn't already exist (preserving
      // user edits like moved stages, added notes, new roles).
      const forceRefresh = migrationNeedsRefresh();

      if (forceRefresh || !localStorage.getItem('pf_connections')) {
        localStorage.setItem('pf_connections', JSON.stringify(connections));
      }
      if (forceRefresh || !localStorage.getItem('pf_companies')) {
        localStorage.setItem('pf_companies', JSON.stringify(companies));
      }
      if (forceRefresh || !localStorage.getItem('pf_roles')) {
        localStorage.setItem('pf_roles', JSON.stringify(roles));
      }

      // Mark migration as current so we don't force-refresh again
      if (forceRefresh) {
        markMigrationCurrent();
        console.log('[DataSwitcher] Migration data force-refreshed (version', MIGRATION_VERSION, ')');
      }

      // Return what's actually in localStorage now
      const currentConns = JSON.parse(localStorage.getItem('pf_connections') || '[]');
      const currentComps = JSON.parse(localStorage.getItem('pf_companies') || '[]');
      const currentRoles = JSON.parse(localStorage.getItem('pf_roles') || '[]');

      return { connections: currentConns.length, companies: currentComps.length, roles: currentRoles.length };
    } catch (err) {
      console.error('[DataSwitcher]', err.message);
      throw err;
    }
  }

  /* ── UI: inject toggle into the nav ────────────────────── */

  function injectToggle() {
    // Find the nav element (either .nav or .nav-bar class)
    const nav = document.querySelector('.nav') || document.querySelector('.nav-bar');
    if (!nav) return;

    const mode = getMode();

    // Create the toggle container
    const wrapper = document.createElement('div');
    wrapper.className = 'data-switcher';
    wrapper.innerHTML = `
      <div class="ds-pill" role="radiogroup" aria-label="Data source">
        <button class="ds-option ${mode === 'demo' ? 'ds-active' : ''}"
                data-mode="demo" aria-checked="${mode === 'demo'}" role="radio">
          Demo
        </button>
        <button class="ds-option ${mode === 'personal' ? 'ds-active' : ''}"
                data-mode="personal" aria-checked="${mode === 'personal'}" role="radio">
          Personal
        </button>
      </div>
    `;

    // Append to the nav
    nav.appendChild(wrapper);

    // Style it (injected once so it works across all modules)
    if (!document.getElementById('ds-styles')) {
      const style = document.createElement('style');
      style.id = 'ds-styles';
      style.textContent = `
        .data-switcher {
          margin-left: auto;
          flex-shrink: 0;
          padding: 0 var(--space-3, 12px);
        }
        .ds-pill {
          display: inline-flex;
          background: var(--bg-elevated, #1e1e2e);
          border-radius: var(--radius-pill, 999px);
          padding: 2px;
          gap: 2px;
        }
        .ds-option {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: var(--radius-pill, 999px);
          border: none;
          cursor: pointer;
          color: var(--text-tertiary, #666);
          background: transparent;
          transition: all 0.15s ease;
          letter-spacing: 0.02em;
          font-family: var(--font-sans, system-ui);
          white-space: nowrap;
        }
        .ds-option:hover {
          color: var(--text-secondary, #999);
        }
        .ds-option.ds-active {
          background: var(--accent, #6366f1);
          color: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .ds-loading {
          pointer-events: none;
          opacity: 0.6;
        }
      `;
      document.head.appendChild(style);
    }

    // Attach click handlers
    wrapper.querySelectorAll('.ds-option').forEach(btn => {
      btn.addEventListener('click', () => handleSwitch(btn.dataset.mode, wrapper));
    });
  }

  /* ── Switch handler ────────────────────────────────────── */

  async function handleSwitch(newMode, wrapper) {
    const currentMode = getMode();
    if (newMode === currentMode) return;

    const pill = wrapper.querySelector('.ds-pill');
    pill.classList.add('ds-loading');

    try {
      if (newMode === 'personal') {
        // First try to restore from backup (preserves user edits from last Personal session)
        clearAllData();
        const restoredFromBackup = restorePersonalBackup();
        if (restoredFromBackup) {
          console.log('[DataSwitcher] Restored personal data from backup (user edits preserved)');
        }
        // Then seed any missing data from migration files
        const result = await loadPersonalData();
        setMode('personal');
        console.log(`[DataSwitcher] Personal mode: ${result.connections} connections, ${result.companies} companies, ${result.roles} roles`);
      } else {
        // Backup personal data before switching to demo
        backupPersonalData();
        clearAllData();
        setMode('demo');
        console.log('[DataSwitcher] Backed up personal data → modules will re-seed demo data');
      }

      // Reload so modules pick up the new data
      window.location.reload();

    } catch (err) {
      pill.classList.remove('ds-loading');
      alert('Could not load personal data.\n\n' + err.message +
            '\n\nMake sure you ran: python3 scripts/migrate-contacts.py');
    }
  }

  /* ── Auto-seed personal data on page load if needed ───── */
  /**
   * If mode is "personal" but data is missing (e.g. cleared localStorage,
   * or migration version bumped), auto-fetch and seed from migration files.
   * This ensures the page always has data even after a hard refresh.
   */
  async function autoSeedIfNeeded() {
    const mode = getMode();
    if (mode !== 'personal') return;

    const hasRoles = localStorage.getItem('pf_roles');
    const hasCompanies = localStorage.getItem('pf_companies');
    const needsRefresh = migrationNeedsRefresh();

    if (!hasRoles || !hasCompanies || needsRefresh) {
      try {
        const result = await loadPersonalData();
        console.log(`[DataSwitcher] Auto-seeded personal data on load: ${result.connections} connections, ${result.companies} companies, ${result.roles} roles`);
        // Reload to pick up the freshly seeded data
        window.location.reload();
      } catch (err) {
        console.error('[DataSwitcher] Auto-seed failed:', err.message);
      }
    }
  }

  /* ── Init ──────────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectToggle();
      autoSeedIfNeeded();
    });
  } else {
    injectToggle();
    autoSeedIfNeeded();
  }

})();
