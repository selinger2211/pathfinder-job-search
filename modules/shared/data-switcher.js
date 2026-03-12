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
 *      - "Personal": fetches migration JSON → writes to pf_connections
 *        and pf_companies → reloads so modules pick up the real data
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

  /** All localStorage keys the Pathfinder app uses.
   *  When switching modes, we dynamically find all pf_* keys
   *  (except pf_data_mode and pf_anthropic_key) so we never
   *  miss a module's data. */
  function getAllPfKeys() {
    const protected_keys = ['pf_data_mode', 'pf_anthropic_key', 'pf_claude_model'];
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('pf_') && !protected_keys.includes(key)) {
        keys.push(key);
      }
    }
    return keys;
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

  /** Clear all Pathfinder data keys so modules re-seed demo data.
   *  Dynamically finds all pf_* keys to ensure nothing is missed. */
  function clearAllData() {
    getAllPfKeys().forEach(key => localStorage.removeItem(key));
  }

  /** Fetch personal data from migration output and write to localStorage */
  async function loadPersonalData() {
    try {
      const [connRes, compRes] = await Promise.all([
        fetch(MIGRATION_BASE + '/pf_connections.json'),
        fetch(MIGRATION_BASE + '/pf_companies.json')
      ]);

      if (!connRes.ok || !compRes.ok) {
        throw new Error('Migration files not found. Run migrate-contacts.py first.');
      }

      const connections = await connRes.json();
      const companies = await compRes.json();

      // Clear existing data first
      clearAllData();

      // Write personal data
      localStorage.setItem('pf_connections', JSON.stringify(connections));
      localStorage.setItem('pf_companies', JSON.stringify(companies));

      // Set empty pf_roles so modules don't re-seed demo data.
      // The user adds real roles via the Pipeline "New Role" button,
      // and their personal companies will appear in the dropdown.
      localStorage.setItem('pf_roles', JSON.stringify([]));

      return { connections: connections.length, companies: companies.length };
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
        const result = await loadPersonalData();
        setMode('personal');
        console.log(`[DataSwitcher] Loaded ${result.connections} connections, ${result.companies} companies`);
      } else {
        clearAllData();
        setMode('demo');
        console.log('[DataSwitcher] Cleared data → modules will re-seed demo data');
      }

      // Reload so modules pick up the new data
      window.location.reload();

    } catch (err) {
      pill.classList.remove('ds-loading');
      alert('Could not load personal data.\n\n' + err.message +
            '\n\nMake sure you ran: python3 scripts/migrate-contacts.py');
    }
  }

  /* ── Init ──────────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggle);
  } else {
    injectToggle();
  }

})();
