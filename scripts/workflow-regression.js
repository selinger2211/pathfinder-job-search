#!/usr/bin/env node
/* ====================================================================
 * PATHFINDER — FULL WORKFLOW REGRESSION TEST
 * ====================================================================
 * Comprehensive static analysis across all 11 modules + shared scripts.
 * Tests 8 categories of functional breakage:
 *
 *   1. REMOVED FUNCTIONS    — calls to deleted/renamed functions
 *   2. ONCLICK RESOLUTION   — every onclick/onchange handler resolves
 *   3. DOM ID INTEGRITY     — getElementById targets exist in HTML
 *   4. CONTRADICTORY CALLS  — open+close in same handler
 *   5. SELECTOR AMBIGUITY   — querySelector with generic selectors
 *   6. SCRIPT LOAD ORDER    — shared scripts before inline code
 *   7. URL PARAM CONTRACTS  — sender passes, target handles
 *   8. CROSS-MODULE DATA    — localStorage keys match between modules
 *
 * Run after EVERY code change: node scripts/workflow-regression.js
 *
 * Created v3.30.1 after three Pipeline bugs shipped in one release.
 * ==================================================================== */

const fs = require('fs');
const path = require('path');

const VERBOSE = process.argv.includes('--verbose');
const MODULE_FILTER = process.argv.includes('--module')
  ? process.argv[process.argv.indexOf('--module') + 1]
  : null;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(PROJECT_ROOT, 'modules');
const SHARED_DIR = path.join(MODULES_DIR, 'shared');

/* ====== REMOVED FUNCTIONS REGISTRY ======
 * Maintain this list whenever functions are removed or renamed.
 * Each entry = guaranteed ReferenceError if called.
 */
const REMOVED_FUNCTIONS = [
  { name: 'getCompanyLogoFallbackUrl', removed: 'v3.30.0', replacement: 'handleLogoError()' },
  { name: 'getClearbitLogoUrl',        removed: 'v3.29.0', replacement: 'getCompanyLogoUrl()' },
  { name: 'clearbitLogoUrl',           removed: 'v3.29.0', replacement: 'getCompanyLogoUrl()' },
  /* v3.31.0: Gmail OAuth flow removed — replaced by Cowork MCP scan pipeline */
  { name: 'saveGmailToken',           removed: 'v3.31.0', replacement: 'loadGmailScanResults()' },
  { name: 'getGmailToken',            removed: 'v3.31.0', replacement: 'loadGmailScanResults()' },
  { name: 'isGmailConnected',         removed: 'v3.31.0', replacement: 'updateGmailScanStatus()' },
  { name: 'updateGmailStatus',        removed: 'v3.31.0', replacement: 'updateGmailScanStatus()' },
  { name: 'scanGmailForJobs',         removed: 'v3.31.0', replacement: 'loadGmailScanResults()' },
  { name: 'parseJobEmail',            removed: 'v3.31.0', replacement: 'Cowork scheduled task handles parsing' },
  { name: 'openGmailTokenModal',      removed: 'v3.31.0', replacement: 'Gmail token modal deleted' },
  { name: 'closeGmailTokenModal',     removed: 'v3.31.0', replacement: 'Gmail token modal deleted' },
  { name: 'submitGmailToken',         removed: 'v3.31.0', replacement: 'Gmail token modal deleted' },
  { name: 'handleGmailTokenSubmit',   removed: 'v3.31.0', replacement: 'Gmail token modal deleted' },
  { name: 'triggerGmailScan',         removed: 'v3.31.0', replacement: 'loadGmailScanResults()' },
];

/* ====== KNOWN SHARED FUNCTIONS ======
 * Functions that MUST come from shared scripts (not inline).
 * If a module calls these without importing the right script, it'll break.
 */
const SHARED_FUNCTION_SOURCES = {
  'handleLogoError':    'logos.js',
  'companyLogoHtml':    'logos.js',
  'getCompanyDomain':   'logos.js',
  'guessDomain':        'logos.js',
  'getCompanyColor':    'logos.js',
  'DOMAIN_OVERRIDES':   'logos.js',
};

/* ====== OUTPUT ====== */
let failCount = 0, warnCount = 0, passCount = 0;
const RED = '\x1b[31m', YELLOW = '\x1b[33m', GREEN = '\x1b[32m';
const DIM = '\x1b[2m', BOLD = '\x1b[1m', NC = '\x1b[0m';

function fail(mod, msg) { failCount++; console.log(`  ${RED}FAIL${NC} [${mod}] ${msg}`); }
function warn(mod, msg) { warnCount++; console.log(`  ${YELLOW}WARN${NC} [${mod}] ${msg}`); }
function pass(mod, msg) { passCount++; if (VERBOSE) console.log(`  ${GREEN}PASS${NC} [${mod}] ${msg}`); }
function section(name) { console.log(`\n${BOLD}--- ${name} ---${NC}`); }

/* ====== PARSING ====== */

function extractInlineScripts(html) {
  const scripts = [];
  const lines = html.split('\n');
  let inScript = false, buf = [], start = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('<script') && !t.includes('src=')) {
      inScript = true; start = i + 1; buf = [];
      const after = t.replace(/<script[^>]*>/, '');
      if (after) buf.push(after);
    } else if (inScript && t.includes('</script>')) {
      const before = lines[i].split('</script>')[0];
      if (before.trim()) buf.push(before);
      scripts.push({ code: buf.join('\n'), startLine: start, lineCount: buf.length });
      inScript = false;
    } else if (inScript) {
      buf.push(lines[i]);
    }
  }
  return scripts;
}

function extractFunctionDefs(code) {
  const fns = new Set();
  let m;
  const re1 = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((m = re1.exec(code))) fns.add(m[1]);
  const re2 = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>)/g;
  while ((m = re2.exec(code))) fns.add(m[1]);
  return fns;
}

function extractHtmlIds(html) {
  const ids = new Set();
  let m;
  const re = /id\s*=\s*"([^"]+)"/g;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

function getSharedFunctions(filename) {
  const fp = path.join(SHARED_DIR, filename);
  if (!fs.existsSync(fp)) return new Set();
  const code = fs.readFileSync(fp, 'utf8');
  const fns = extractFunctionDefs(code);
  /* Also grab top-level const/var declarations */
  let m;
  const re = /^(?:const|let|var)\s+([A-Z_$][A-Z0-9_$]*)\s*=/gm;
  while ((m = re.exec(code))) fns.add(m[1]);
  return fns;
}

function extractSharedImports(html) {
  const imports = [];
  let m;
  const re = /src\s*=\s*"\.\.\/shared\/([^"?]+)/g;
  while ((m = re.exec(html))) imports.push(m[1]);
  return imports;
}

/* ====== CHECK 1: REMOVED FUNCTIONS ====== */

function checkRemovedFunctions(mod, html) {
  const lines = html.split('\n');
  let clean = true;
  REMOVED_FUNCTIONS.forEach(({ name, removed, replacement }) => {
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
      if (lines[i].includes(name + '(') || lines[i].includes(name + ' (')) {
        fail(mod, `Line ${i + 1}: Calls removed "${name}()" (removed ${removed}) → use ${replacement}`);
        clean = false;
      }
    }
  });
  if (clean) pass(mod, `No calls to ${REMOVED_FUNCTIONS.length} removed functions`);
}

/* ====== CHECK 2: ONCLICK RESOLUTION ====== */

function checkOnclickHandlers(mod, html, availableFns) {
  const lines = html.split('\n');
  let checked = 0, passed = 0;

  /* These are accessed via dot notation (Object.method) or are browser built-ins */
  const safe = new Set([
    'console','window','document','this','event','history','location',
    'localStorage','sessionStorage','navigator','JSON','Math','Date',
    'Array','Object','String','Number','alert','confirm','prompt',
    'setTimeout','setInterval','clearTimeout','clearInterval',
    'encodeURIComponent','decodeURIComponent','parseInt','parseFloat',
  ]);

  for (let i = 0; i < lines.length; i++) {
    const re = /on(?:click|change|input|submit|error|load|focus|blur|keydown|keyup|mouseover|mouseout)\s*=\s*"([^"]+)"/gi;
    let m;
    while ((m = re.exec(lines[i]))) {
      const handler = m[1];
      /* Split by ; and check each statement's first function call */
      handler.split(';').map(s => s.trim()).filter(Boolean).forEach(stmt => {
        /* Get first identifier */
        const call = stmt.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (!call) return;
        const name = call[1];
        if (safe.has(name)) return;
        /* Skip Object.method() patterns (namespaced calls) */
        if (/^[a-zA-Z_$]+\.[a-zA-Z_$]+\s*\(/.test(stmt)) {
          /* Check if it's a known app namespace (DebriefApp, MockInterviewApp, etc.) */
          if (name.endsWith('App') || name === 'PF' || name === 'lucide') return;
          /* Otherwise check the object name exists */
          if (availableFns.has(name)) { checked++; passed++; return; }
        }
        /* Standalone: fnName(...) */
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(stmt)) {
          checked++;
          if (availableFns.has(name) || safe.has(name)) { passed++; }
          else { fail(mod, `Line ${i+1}: onclick→"${name}()" not defined — handler: "${handler.substring(0,60)}"`); }
        }
      });
    }
  }
  if (checked > 0 && passed === checked) pass(mod, `${checked} onclick handlers all resolve`);
  return { checked, passed };
}

/* ====== CHECK 3: DOM ID INTEGRITY ====== */

function checkElementIds(mod, html, scripts) {
  const htmlIds = extractHtmlIds(html);
  let total = 0, ok = 0;
  const missing = [];

  scripts.forEach(s => {
    const lines = s.code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const re = /getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      let m;
      while ((m = re.exec(lines[i]))) {
        if (m[1].includes('$') || m[1].includes('{')) continue; /* dynamic */
        total++;
        if (htmlIds.has(m[1])) { ok++; }
        else { missing.push({ id: m[1], line: s.startLine + i }); }
      }
    }
  });

  missing.forEach(({ id, line }) => {
    warn(mod, `Line ${line}: getElementById('${id}') — no matching id in HTML (may be dynamic)`);
  });

  if (total > 0) {
    if (ok === total) pass(mod, `All ${total} getElementById calls match HTML elements`);
    else pass(mod, `${ok}/${total} getElementById calls match (${missing.length} may be dynamic)`);
  }
}

/* ====== CHECK 4: CONTRADICTORY CALLS ====== */

function checkContradictoryCalls(mod, html) {
  const lines = html.split('\n');
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    /* open...(); close...() in same event handler */
    const re = /on\w+\s*=\s*"[^"]*\b(open[A-Z]\w*)\([^)]*\)\s*;\s*(close[A-Z]\w*)\([^)]*\)[^"]*"/g;
    let m;
    while ((m = re.exec(lines[i]))) {
      if (m[1].replace('open','') === m[2].replace('close','')) {
        fail(mod, `Line ${i+1}: ${m[1]}() immediately followed by ${m[2]}() — panel opens then closes`);
        found++;
      }
    }
  }
  if (!found) pass(mod, 'No contradictory open/close sequences');
}

/* ====== CHECK 5: SELECTOR AMBIGUITY ====== */

function checkSelectorAmbiguity(mod, scripts) {
  const risky = [
    { re: /querySelector\s*\(\s*['"]button:last-child['"]\s*\)/, desc: 'button:last-child' },
    { re: /querySelector\s*\(\s*['"]button:first-child['"]\s*\)/, desc: 'button:first-child' },
    { re: /querySelector\s*\(\s*['"]div:last-child['"]\s*\)/, desc: 'div:last-child' },
    { re: /querySelector\s*\(\s*['"]input:first-child['"]\s*\)/, desc: 'input:first-child' },
    { re: /\.previousElementSibling/, desc: '.previousElementSibling (fragile DOM traversal)' },
  ];

  let found = 0;
  scripts.forEach(s => {
    const lines = s.code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      risky.forEach(({ re, desc }) => {
        if (re.test(lines[i])) {
          warn(mod, `Line ${s.startLine+i}: Ambiguous selector "${desc}" — use class selector`);
          found++;
        }
      });
    }
  });
  if (!found) pass(mod, 'No ambiguous querySelector patterns');
}

/* ====== CHECK 6: SCRIPT LOAD ORDER ====== */

function checkScriptOrder(mod, html) {
  const lines = html.split('\n');
  const shared = [];
  let mainScript = Infinity;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('src="../shared/') && !lines[i].includes('data-layer.js')) {
      const m = lines[i].match(/shared\/([^"?]+)/);
      if (m) shared.push({ file: m[1], line: i + 1 });
    }
    /* Find the MAIN inline script (>50 lines), not tiny IIFEs */
    if (lines[i].trim().startsWith('<script') && !lines[i].includes('src=') && mainScript === Infinity) {
      let end = i;
      for (let j = i + 1; j < lines.length && j < i + 200; j++) {
        if (lines[j].includes('</script>')) { end = j; break; }
      }
      if (end - i > 50) mainScript = i + 1;
    }
  }

  let ok = true;
  shared.forEach(s => {
    if (s.line > mainScript) {
      fail(mod, `shared/${s.file} (line ${s.line}) loads AFTER main script (line ${mainScript})`);
      ok = false;
    }
  });
  if (shared.length > 0 && ok) pass(mod, 'Shared scripts load before main inline code');
}

/* ====== CHECK 7: SHARED FUNCTION IMPORTS ====== */

function checkSharedFunctionImports(mod, html) {
  const imports = extractSharedImports(html);
  let clean = true;

  Object.entries(SHARED_FUNCTION_SOURCES).forEach(([fn, srcFile]) => {
    /* Check if the module uses this function */
    if (!html.includes(fn)) return;

    /* If it defines the function locally (Calendar/Dashboard have their own getCompanyLogoUrl), skip */
    const defRe = new RegExp(`function\\s+${fn}\\s*\\(`);
    if (defRe.test(html)) return;

    /* Check if the required shared file is imported */
    if (!imports.includes(srcFile)) {
      fail(mod, `Uses "${fn}" but doesn't import shared/${srcFile}`);
      clean = false;
    }
  });

  if (clean) pass(mod, 'All shared function dependencies imported');
}

/* ====== CHECK 8: CROSS-MODULE URL PARAMS ====== */

function extractOutboundParams(html) {
  const params = new Map();
  let m;
  const re = /(?:href\s*=\s*["']|window\.location\.href\s*=\s*[`'"])\.\.\/([a-z-]+)\/[^"'`]*\?([^"'`#]+)/g;
  while ((m = re.exec(html))) {
    const target = m[1];
    if (!params.has(target)) params.set(target, new Set());
    m[2].split('&').forEach(p => {
      const key = p.split('=')[0].replace(/\$\{[^}]*\}/g, '');
      if (key && /^[a-zA-Z]+$/.test(key)) params.get(target).add(key);
    });
  }
  return params;
}

function moduleHandlesParam(html, param) {
  return html.includes('URLSearchParams') &&
    (html.includes(`'${param}'`) || html.includes(`"${param}"`));
}

/* ====== CHECK 9: LOCALSTORAGE KEY CONSISTENCY ====== */

function extractLocalStorageKeys(code) {
  const keys = new Set();
  let m;
  const re = /localStorage\.(?:get|set|remove)Item\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = re.exec(code))) keys.add(m[1]);
  /* Also catch safeJsonParse('key', ...) */
  const re2 = /safeJsonParse\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = re2.exec(code))) keys.add(m[1]);
  return keys;
}

/* ====== CHECK 10: JD ENRICHMENT ENGINE INTEGRITY ======
 * v3.31.4: Ensures the JD enrichment pipeline hasn't been accidentally
 * deleted, broken, or degraded. These are the critical functions and
 * infrastructure that MUST exist in the Feed module for JD acquisition.
 *
 * This check exists because 81% of roles lost their JDs in a prior release
 * when enrichment code was accidentally removed. Never again.
 */

function checkJDEnrichmentIntegrity(mod, html) {
  if (mod !== 'job-feed-listener') return; // Only applies to Feed

  const requiredFunctions = [
    { name: 'enrichRoleJD',          desc: 'Main JD enrichment orchestrator' },
    { name: 'enrichSingleRole',      desc: 'Single-role enrichment handler' },
    { name: 'enrichAllRoles',        desc: 'Batch enrichment handler' },
    { name: 'fetchViaCorsProxy',     desc: 'CORS proxy fetcher' },
    { name: 'extractLinkedInJD',     desc: 'LinkedIn JD extractor' },
    { name: 'fetchFromAtsApi',       desc: 'ATS API fetcher (Greenhouse/Lever/Ashby)' },
    { name: 'isStubJD',             desc: 'Stub JD detector' },
    { name: 'updateEnrichmentStatus', desc: 'Enrichment status UI updater' },
    { name: 'matchConfidence',       desc: 'JD match confidence scorer' },
    { name: 'stripHtmlTags',         desc: 'HTML tag stripper for JD text' },
  ];

  const requiredConstants = [
    { name: 'MIN_FULL_JD_LENGTH',    desc: 'Minimum JD length threshold' },
    { name: 'CORS_PROXIES',          desc: 'CORS proxy URL list' },
  ];

  const requiredElements = [
    { id: 'enrichAllBtn',            desc: 'Enrich All JDs button' },
    { id: 'enrichProgress',          desc: 'Enrichment progress indicator' },
    { id: 'enrichmentStatus',        desc: 'Enrichment status display' },
  ];

  const requiredStrategies = [
    { pattern: 'linkedin-direct',     desc: 'LinkedIn CORS proxy strategy' },
    { pattern: 'ats-api',            desc: 'ATS public API strategy' },
    { pattern: 'web-search',         desc: 'DuckDuckGo web search fallback' },
    { pattern: 'ats-api-via-search', desc: 'ATS API discovered via web search' },
  ];

  let allPresent = true;

  /* Check required functions exist */
  requiredFunctions.forEach(({ name, desc }) => {
    const fnRegex = new RegExp(`function\\s+${name}\\s*\\(`);
    const arrowRegex = new RegExp(`(?:const|let|var)\\s+${name}\\s*=`);
    if (fnRegex.test(html) || arrowRegex.test(html)) {
      pass(mod, `JD enrichment function "${name}" exists (${desc})`);
    } else {
      fail(mod, `JD enrichment function "${name}" MISSING (${desc}) — enrichment pipeline broken!`);
      allPresent = false;
    }
  });

  /* Check required constants */
  requiredConstants.forEach(({ name, desc }) => {
    if (html.includes(name)) {
      pass(mod, `JD enrichment constant "${name}" exists (${desc})`);
    } else {
      fail(mod, `JD enrichment constant "${name}" MISSING (${desc}) — enrichment pipeline broken!`);
      allPresent = false;
    }
  });

  /* Check required DOM elements */
  const htmlIds = extractHtmlIds(html);
  requiredElements.forEach(({ id, desc }) => {
    if (htmlIds.has(id)) {
      pass(mod, `JD enrichment element #${id} exists (${desc})`);
    } else {
      fail(mod, `JD enrichment element #${id} MISSING (${desc}) — enrichment UI broken!`);
      allPresent = false;
    }
  });

  /* Check all enrichment strategies are still in the code */
  requiredStrategies.forEach(({ pattern, desc }) => {
    if (html.includes(`'${pattern}'`) || html.includes(`"${pattern}"`)) {
      pass(mod, `JD enrichment strategy "${pattern}" present (${desc})`);
    } else {
      fail(mod, `JD enrichment strategy "${pattern}" MISSING (${desc}) — enrichment fallback chain broken!`);
      allPresent = false;
    }
  });

  /* Check auto-enrichment on page load */
  if (html.includes('Auto-enrich') || html.includes('auto-enrich') || html.includes('Auto-enriching')) {
    pass(mod, 'Auto-enrichment on page load is present');
  } else {
    fail(mod, 'Auto-enrichment on page load MISSING — new roles won\'t get JDs automatically!');
    allPresent = false;
  }

  /* Summary */
  if (allPresent) {
    pass(mod, `JD enrichment pipeline intact: ${requiredFunctions.length} functions, ${requiredConstants.length} constants, ${requiredElements.length} UI elements, ${requiredStrategies.length} strategies`);
  }
}

/* ====== MAIN ====== */

console.log('======================================');
console.log('Pathfinder Full Workflow Regression');
console.log('======================================');

const moduleDirs = fs.readdirSync(MODULES_DIR)
  .filter(d => fs.statSync(path.join(MODULES_DIR, d)).isDirectory() && d !== 'shared')
  .filter(d => !MODULE_FILTER || d === MODULE_FILTER);

const allOutbound = new Map();
const allStorageKeys = new Map(); /* module → Set of keys */

/* Per-module checks */
moduleDirs.forEach(mod => {
  const htmlPath = path.join(MODULES_DIR, mod, 'index.html');
  if (!fs.existsSync(htmlPath)) return;

  section(mod);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = extractInlineScripts(html);

  /* Build available functions */
  const available = new Set();
  scripts.forEach(s => extractFunctionDefs(s.code).forEach(fn => available.add(fn)));
  extractSharedImports(html).forEach(file => {
    getSharedFunctions(file).forEach(fn => available.add(fn));
  });
  /* Browser globals and common helpers */
  ['lucide','html2pdf','mammoth','Chart','PF','escapeHTML','escapeHtml'].forEach(b => available.add(b));

  /* Run all 8 per-module checks */
  checkRemovedFunctions(mod, html);
  checkOnclickHandlers(mod, html, available);
  checkElementIds(mod, html, scripts);
  checkContradictoryCalls(mod, html);
  checkSelectorAmbiguity(mod, scripts);
  checkScriptOrder(mod, html);
  checkSharedFunctionImports(mod, html);
  checkJDEnrichmentIntegrity(mod, html); /* v3.31.4: JD enrichment regression guard */

  /* Collect for cross-module checks */
  allOutbound.set(mod, extractOutboundParams(html));
  const moduleKeys = new Set();
  scripts.forEach(s => extractLocalStorageKeys(s.code).forEach(k => moduleKeys.add(k)));
  allStorageKeys.set(mod, moduleKeys);
});

/* ====== CROSS-MODULE: URL PARAM CONTRACTS ====== */
section('Cross-Module: URL Parameter Contracts');

let urlChecks = 0;
allOutbound.forEach((targets, sender) => {
  targets.forEach((params, target) => {
    const tp = path.join(MODULES_DIR, target, 'index.html');
    if (!fs.existsSync(tp)) return;
    const th = fs.readFileSync(tp, 'utf8');
    params.forEach(param => {
      urlChecks++;
      if (moduleHandlesParam(th, param)) {
        pass(`${sender}→${target}`, `?${param} handled`);
      } else {
        const hasAny = th.includes('URLSearchParams') || th.includes('location.search');
        if (!hasAny) {
          warn(`${sender}→${target}`, `?${param} sent but target has NO URL param handling`);
        } else {
          warn(`${sender}→${target}`, `?${param} sent but not explicitly handled`);
        }
      }
    });
  });
});
if (urlChecks === 0) pass('cross-module', 'No URL param contracts to verify');

/* ====== CROSS-MODULE: SHARED LOCALSTORAGE KEYS ====== */
section('Cross-Module: localStorage Key Consistency');

/* Canonical keys that MUST be spelled correctly across modules */
const CANONICAL_KEYS = {
  'pf_roles': 'Pipeline Tracker writes, all modules read',
  'pf_companies': 'Pipeline Tracker writes, many modules read',
  'pf_connections': 'Pipeline Tracker writes, Dashboard/Outreach read',
  'pf_preferences': 'Feed writes, scoring reads',
  'pf_feed_queue': 'Feed writes, Dashboard reads',
  'pf_streak': 'Dashboard writes and reads',
  'pf_dismissed_nudges': 'Dashboard writes and reads',
  'pf_theme': 'Any module writes, all read',
  'pf_anthropic_key': 'Any Claude-using module reads',
  'pf_claude_model': 'Any Claude-using module reads',
  'pf_debriefs': 'Debrief writes, Dashboard reads',
  'pf_comp_data': 'Comp Intel writes and reads',
  'pf_calendar_events': 'Calendar writes and reads',
  'pf_outreach_messages': 'Outreach writes and reads',
  'pf_mock_sessions': 'Mock Interview writes and reads',
  'pf_story_bank': 'Mock Interview writes and reads',
};

/* Check that modules reading canonical keys spell them correctly */
const allKeysFlat = new Set();
allStorageKeys.forEach(keys => keys.forEach(k => allKeysFlat.add(k)));

/* Look for near-misses (typos) */
const pfKeys = [...allKeysFlat].filter(k => k.startsWith('pf_'));
pfKeys.forEach(key => {
  if (!CANONICAL_KEYS[key] && !key.startsWith('pf_brief_') && !key.startsWith('pf_resume_') &&
      !key.startsWith('pf_sync_') && !key.startsWith('pf_nudge_') && !key.startsWith('pf_feed_') &&
      !key.startsWith('pf_linkedin_') && !key.startsWith('pf_tavily') && !key.startsWith('pf_career_') &&
      !key.startsWith('pf_outreach_') && !key.startsWith('pf_gmail') && !key.startsWith('pf_comp_') &&
      !key.startsWith('pf_bullet') && !key.startsWith('pf_mock_') && !key.startsWith('pf_story_') &&
      !key.startsWith('pf_calendar_') && !key.startsWith('pf_auto_') && !key.startsWith('pf_brief_app')) {
    /* Check if it's close to a canonical key (edit distance ≤ 2) */
    const canonicalNames = Object.keys(CANONICAL_KEYS);
    const close = canonicalNames.find(c => {
      if (Math.abs(c.length - key.length) > 2) return false;
      let diff = 0;
      for (let i = 0; i < Math.max(c.length, key.length); i++) {
        if (c[i] !== key[i]) diff++;
        if (diff > 2) return false;
      }
      return diff > 0 && diff <= 2;
    });
    if (close) {
      warn('storage', `Key "${key}" is close to canonical "${close}" — possible typo?`);
    }
  }
});

/* Verify cross-module key agreement */
const keyUsers = new Map(); /* key → [modules] */
allStorageKeys.forEach((keys, mod) => {
  keys.forEach(key => {
    if (!keyUsers.has(key)) keyUsers.set(key, []);
    keyUsers.get(key).push(mod);
  });
});

let sharedKeyCount = 0;
keyUsers.forEach((modules, key) => {
  if (modules.length >= 2 && key.startsWith('pf_')) {
    sharedKeyCount++;
    pass('storage', `"${key}" shared by ${modules.length} modules: ${modules.join(', ')}`);
  }
});
if (sharedKeyCount > 0 && !VERBOSE) {
  console.log(`  ${GREEN}PASS${NC} ${sharedKeyCount} localStorage keys shared consistently across modules`);
}

/* ====== SUMMARY ====== */
const total = passCount + failCount + warnCount;
console.log('\n======================================');
console.log(`${BOLD}Results: ${total} checks across ${moduleDirs.length} modules${NC}`);
console.log('');

if (failCount > 0) {
  console.log(`  ${RED}${BOLD}${failCount} FAILURE(S)${NC}  — code will break at runtime`);
}
if (warnCount > 0) {
  console.log(`  ${YELLOW}${warnCount} warning(s)${NC}   — review recommended`);
}
if (passCount > 0) {
  console.log(`  ${GREEN}${passCount} passed${NC}`);
}

console.log('');
if (failCount > 0) {
  console.log('Fix failures before committing.');
  process.exit(1);
} else {
  console.log(failCount === 0 && warnCount === 0 ? 'All clear.' : 'Warnings only — safe to commit.');
  process.exit(0);
}
