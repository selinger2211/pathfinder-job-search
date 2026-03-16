/* ====================================================================
 * Pathfinder State Management Utilities (Shared)
 * ====================================================================
 * Pure localStorage CRUD functions used across all modules.
 * Extracted from job-feed-listener, pipeline, dashboard, and other
 * modules (v3.31.7) to enable unit testing and eliminate duplication.
 *
 * Every module had its own copy of safeJsonParse and load/save pairs.
 * This file provides the canonical implementations.
 * ==================================================================== */

/* ====== CORE PARSE/SAVE ====== */

/**
 * Safely parse JSON from localStorage with fallback.
 * Handles missing keys, null values, and corrupt JSON gracefully.
 * Duplicated in 9+ modules — this is the canonical version.
 * @param {string} key - localStorage key
 * @param {*} fallback - Value to return if key is missing or corrupt
 * @returns {*} Parsed JSON or fallback
 */
function safeJsonParse(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`[Pathfinder] Corrupt localStorage key "${key}", using fallback`, e);
    return fallback;
  }
}

/**
 * Safely save JSON to localStorage with error handling.
 * Catches QuotaExceededError and circular reference errors.
 * @param {string} key - localStorage key
 * @param {*} data - Data to serialize and save
 * @returns {boolean} true if saved successfully, false on error
 */
function safeJsonSave(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn(`[Pathfinder] Failed to save "${key}":`, e);
    return false;
  }
}

/* ====== CORE DATA LOADERS ====== */

/**
 * Load feed queue items from localStorage.
 * These are roles synced from Indeed, Gmail, or added manually.
 * @returns {Array} Array of feed item objects (empty if none)
 */
function loadFeedQueue() {
  return safeJsonParse('pf_feed_queue', []);
}

/**
 * Save feed queue to localStorage.
 * @param {Array} items - Feed item objects
 * @returns {boolean} Success
 */
function saveFeedQueue(items) {
  return safeJsonSave('pf_feed_queue', items);
}

/**
 * Load pipeline roles from localStorage.
 * @returns {Array} Array of role objects (empty if none)
 */
function loadRoles() {
  return safeJsonParse('pf_roles', []);
}

/**
 * Save pipeline roles to localStorage.
 * @param {Array} roles - Role objects
 * @returns {boolean} Success
 */
function saveRoles(roles) {
  return safeJsonSave('pf_roles', roles);
}

/**
 * Load tracked companies from localStorage.
 * @returns {Array} Array of company objects (empty if none)
 */
function loadCompanies() {
  return safeJsonParse('pf_companies', []);
}

/**
 * Save companies to localStorage.
 * @param {Array} companies - Company objects
 * @returns {boolean} Success
 */
function saveCompanies(companies) {
  return safeJsonSave('pf_companies', companies);
}

/**
 * Load tracked connections from localStorage.
 * @returns {Array} Array of connection objects (empty if none)
 */
function loadConnections() {
  return safeJsonParse('pf_connections', []);
}

/**
 * Save connections to localStorage.
 * @param {Array} connections - Connection objects
 * @returns {boolean} Success
 */
function saveConnections(connections) {
  return safeJsonSave('pf_connections', connections);
}

/**
 * Load LinkedIn network (1st-degree connections).
 * @returns {Array} Array of LinkedIn connection objects
 */
function loadLinkedInNetwork() {
  return safeJsonParse('pf_linkedin_network', []);
}

/* ====== FEED RUNS (with date deserialization) ====== */

/**
 * Load feed run history with date deserialization.
 * Converts stored ISO timestamp strings back to Date objects.
 * @returns {Array} Array of feed run records with Date timestamps
 */
function loadFeedRuns() {
  try {
    const stored = localStorage.getItem('pf_feed_runs');
    if (stored) {
      return JSON.parse(stored).map(run => ({
        ...run,
        timestamp: new Date(run.timestamp)
      }));
    }
  } catch (e) {
    console.warn('[Pathfinder] Failed to load feed runs:', e);
  }
  return [];
}

/**
 * Save feed run history to localStorage.
 * @param {Array} runs - Feed run records
 * @returns {boolean} Success
 */
function saveFeedRuns(runs) {
  return safeJsonSave('pf_feed_runs', runs);
}

/* ====== PREFERENCES (with migration logic) ====== */

/**
 * Default preferences — used as fallback and migration source.
 * Modules can pass their own defaults if they differ.
 */
const DEFAULT_PREFERENCES = {
  targetTitles: ['Senior Product Manager', 'Staff Product Manager', 'Principal Product Manager', 'Director of Product', 'Group Product Manager'],
  mustHaveKeywords: ['product', 'strategy', 'roadmap'],
  boostKeywords: ['AI', 'machine learning', 'platform', 'B2B', 'enterprise', 'SaaS', 'data', 'growth'],
  excludeKeywords: ['intern', 'junior', 'associate', 'entry level', 'contract', 'part-time'],
  primaryDomains: ['AI/ML', 'Enterprise SaaS', 'Developer Tools', 'Cloud/Infrastructure', 'Analytics'],
  secondaryDomains: ['Fintech', 'Healthtech', 'Cybersecurity', 'LegalTech', 'Marketplace'],
  excludedDomains: ['Gaming', 'Social Media', 'Crypto/Web3'],
  locations: ['Remote', 'San Francisco', 'New York'],
  excludedLocations: [],
  companyStage: ['Series B', 'Series C+', 'Late-stage / Pre-IPO', 'Public'],
  compRange: { minBase: 180, targetBase: 280 }
};

/**
 * Load preferences from localStorage with two-stage migration.
 *
 * Migration v3.19.4: Merges new default keywords into existing prefs
 * (targetTitles, mustHaveKeywords, boostKeywords). Also removes bare
 * "Product Manager" from target titles.
 *
 * Migration v3.20.1: Merges new default domains into existing prefs
 * (primaryDomains, secondaryDomains, excludedDomains).
 *
 * Each migration runs at most once per installation (guarded by a
 * one-time migration key in localStorage).
 *
 * @param {Object} defaults - Default preferences (falls back to DEFAULT_PREFERENCES)
 * @returns {Object} User preferences object
 */
function loadPreferences(defaults) {
  const DEFAULTS = defaults || DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem('pf_preferences');
    if (!stored) return { ...DEFAULTS };

    const prefs = JSON.parse(stored);

    // v3.19.4 migration: merge new default keywords
    const MIGRATION_KEY = 'pf_prefs_migrated_v3194';
    if (!localStorage.getItem(MIGRATION_KEY)) {
      let changed = false;
      ['targetTitles', 'mustHaveKeywords', 'boostKeywords'].forEach(key => {
        const defs = DEFAULTS[key] || [];
        const existing = prefs[key] || [];
        const existingLower = existing.map(k => k.toLowerCase());
        defs.forEach(d => {
          if (!existingLower.includes(d.toLowerCase())) {
            existing.push(d);
            changed = true;
          }
        });
        prefs[key] = existing;
      });
      // Remove bare "Product Manager" (mid-level noise)
      const bareIdx = (prefs.targetTitles || []).findIndex(t => t.toLowerCase() === 'product manager');
      if (bareIdx !== -1) {
        prefs.targetTitles.splice(bareIdx, 1);
        changed = true;
      }
      if (changed) {
        localStorage.setItem('pf_preferences', JSON.stringify(prefs));
      }
      localStorage.setItem(MIGRATION_KEY, 'true');
    }

    // v3.20.1 migration: merge new default domains
    const DOMAIN_MIGRATION_KEY = 'pf_prefs_migrated_v3201_domains';
    if (!localStorage.getItem(DOMAIN_MIGRATION_KEY)) {
      let domainChanged = false;
      ['primaryDomains', 'secondaryDomains', 'excludedDomains'].forEach(key => {
        const defs = DEFAULTS[key] || [];
        const existing = prefs[key] || [];
        const existingLower = existing.map(d => d.toLowerCase());
        defs.forEach(d => {
          if (!existingLower.includes(d.toLowerCase())) {
            existing.push(d);
            domainChanged = true;
          }
        });
        prefs[key] = existing;
      });
      if (domainChanged) {
        localStorage.setItem('pf_preferences', JSON.stringify(prefs));
      }
      localStorage.setItem(DOMAIN_MIGRATION_KEY, 'true');
    }

    return prefs;
  } catch (e) {
    console.warn('[Pathfinder] Failed to load preferences:', e);
    return { ...DEFAULTS };
  }
}

/**
 * Save preferences to localStorage.
 * @param {Object} prefs - Preferences object
 * @returns {boolean} Success
 */
function savePreferences(prefs) {
  return safeJsonSave('pf_preferences', prefs);
}

/* ====== SNOOZED ROLES (with expiration filtering) ====== */

/**
 * Load snoozed roles from localStorage.
 * Filters out expired snoozes and returns only still-active ones.
 * Expired roles are returned separately for the caller to re-add to feed.
 * @returns {Object} { active: Array, expired: Array }
 */
function loadSnoozedRoles() {
  try {
    const stored = localStorage.getItem('pf_snoozed_roles');
    if (!stored) return { active: [], expired: [] };

    const snoozed = JSON.parse(stored);
    const now = new Date();

    const active = snoozed.filter(r => new Date(r.snoozedUntil) > now);
    const expired = snoozed.filter(r => new Date(r.snoozedUntil) <= now);

    // Clean expired from storage
    if (expired.length > 0) {
      safeJsonSave('pf_snoozed_roles', active);
    }

    return { active, expired };
  } catch (e) {
    console.warn('[Pathfinder] Failed to load snoozed roles:', e);
    return { active: [], expired: [] };
  }
}

/**
 * Save snoozed roles to localStorage.
 * @param {Array} roles - Array of snoozed role objects with snoozedUntil
 * @returns {boolean} Success
 */
function saveSnoozedRoles(roles) {
  return safeJsonSave('pf_snoozed_roles', roles);
}

/* ====== GENERIC STORAGE (sync module pattern) ====== */

/**
 * Generic getter with pf_ prefix — used by sync module.
 * @param {string} key - Key WITHOUT pf_ prefix
 * @param {*} fallback - Fallback value
 * @returns {*} Parsed value or fallback
 */
function getStorage(key, fallback = null) {
  return safeJsonParse(`pf_${key}`, fallback);
}

/**
 * Generic setter with pf_ prefix — used by sync module.
 * @param {string} key - Key WITHOUT pf_ prefix
 * @param {*} data - Data to save
 * @returns {boolean} Success
 */
function setStorage(key, data) {
  return safeJsonSave(`pf_${key}`, data);
}

/* ====== STREAK TRACKING ====== */

/**
 * Load streak data (consecutive days of pipeline activity).
 * @returns {Object} { currentStreak, longestStreak, lastActiveDate }
 */
function loadStreak() {
  return safeJsonParse('pf_streak', { currentStreak: 0, longestStreak: 0, lastActiveDate: null });
}

/**
 * Save streak data to localStorage.
 * @param {Object} streakData
 * @returns {boolean} Success
 */
function saveStreak(streakData) {
  return safeJsonSave('pf_streak', streakData);
}

/* ====== COMP DATA ====== */

/**
 * Load compensation benchmarks.
 * @returns {Object|null} Comp benchmark data
 */
function loadCompBenchmarks() {
  return safeJsonParse('pf_comp_benchmarks', null);
}

/**
 * Save compensation benchmarks.
 * @param {Object} data - Benchmark data
 * @returns {boolean} Success
 */
function saveCompBenchmarks(data) {
  return safeJsonSave('pf_comp_benchmarks', data);
}

/* ====== RESUME LOG ====== */

/**
 * Load resume tailoring history.
 * @returns {Array} Array of resume version records
 */
function loadResumeLog() {
  return safeJsonParse('pf_resume_log', []);
}

/**
 * Save a resume version to the log.
 * @param {string} roleId - Pipeline role ID
 * @param {Object} versionData - Resume version data
 * @returns {boolean} Success
 */
function saveResumeVersion(roleId, versionData) {
  const log = loadResumeLog();
  log.push({ roleId, ...versionData, savedAt: new Date().toISOString() });
  return safeJsonSave('pf_resume_log', log);
}

/* ====== NODE.JS / JEST EXPORT ====== */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
  };
}
