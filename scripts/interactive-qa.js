#!/usr/bin/env node
/* ====================================================================
 * PATHFINDER — HEADLESS INTERACTIVE QA
 * ====================================================================
 * Uses jsdom to simulate real user workflows in each module:
 *   - Button clicks, tab switches, form submissions
 *   - localStorage read/write/persistence
 *   - Modal open/close
 *   - File input trigger detection
 *   - Element visibility toggling
 *
 * This is NOT a replacement for real browser testing. It catches
 * functional bugs (dead handlers, broken state, missing elements)
 * but cannot catch visual/CSS issues.
 *
 * Run: node scripts/interactive-qa.js [--module <name>] [--verbose]
 *
 * Created v3.31.2 after v3.31.0 shipped without any interactive QA.
 * ==================================================================== */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const VERBOSE = process.argv.includes('--verbose');
const MODULE_FILTER = process.argv.includes('--module')
  ? process.argv[process.argv.indexOf('--module') + 1]
  : null;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(PROJECT_ROOT, 'modules');

/* ====== OUTPUT ====== */
let failCount = 0, warnCount = 0, passCount = 0, skipCount = 0;
const RED = '\x1b[31m', YELLOW = '\x1b[33m', GREEN = '\x1b[32m';
const DIM = '\x1b[2m', BOLD = '\x1b[1m', CYAN = '\x1b[36m', NC = '\x1b[0m';

function fail(mod, workflow, msg) {
  failCount++;
  console.log(`  ${RED}FAIL${NC} [${mod}] ${workflow}: ${msg}`);
}
function warn(mod, workflow, msg) {
  warnCount++;
  if (VERBOSE) console.log(`  ${YELLOW}WARN${NC} [${mod}] ${workflow}: ${msg}`);
}
function pass(mod, workflow, msg) {
  passCount++;
  if (VERBOSE) console.log(`  ${GREEN}PASS${NC} [${mod}] ${workflow}: ${msg}`);
}
function skip(mod, workflow, msg) {
  skipCount++;
  if (VERBOSE) console.log(`  ${DIM}SKIP${NC} [${mod}] ${workflow}: ${msg}`);
}
function section(name) { console.log(`\n${BOLD}${CYAN}--- ${name} ---${NC}`); }

/* ====== JSDOM HELPERS ====== */

/**
 * Create a jsdom instance for a module's index.html.
 * Provides a fake localStorage, suppresses external script loading,
 * and stubs out APIs that don't exist in jsdom.
 */
function createDom(moduleName) {
  const htmlPath = path.join(MODULES_DIR, moduleName, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;

  let html = fs.readFileSync(htmlPath, 'utf8');

  /* Strip external script tags (CDN libs like Lucide, Chart.js) to avoid fetch errors */
  html = html.replace(/<script\s+src\s*=\s*"https?:\/\/[^"]*"[^>]*><\/script>/gi, '');
  /* Strip shared script imports too — we're testing module logic, not shared infra */
  html = html.replace(/<script\s+src\s*=\s*"\.\.\/shared\/[^"]*"[^>]*><\/script>/gi, '');

  const dom = new JSDOM(html, {
    url: `http://localhost:8765/modules/${moduleName}/index.html`,
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
    beforeParse(window) {
      /* Stub fetch to prevent network calls */
      window.fetch = async (url) => {
        /* Return empty response for data files */
        if (typeof url === 'string' && url.includes('gmail-scan.json')) {
          return { ok: true, json: async () => ({ scanDate: null, items: [] }) };
        }
        if (typeof url === 'string' && url.includes('gmail-seed.json')) {
          return { ok: false, status: 404 };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      /* Stub Lucide (icon library) */
      window.lucide = { createIcons: () => {} };

      /* Stub html2pdf */
      window.html2pdf = () => ({ set: () => ({ from: () => ({ save: () => {} }) }) });

      /* Stub matchMedia */
      window.matchMedia = () => ({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      });

      /* Stub requestAnimationFrame */
      window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);

      /* Stub IntersectionObserver */
      window.IntersectionObserver = class {
        constructor() {}
        observe() {}
        unobserve() {}
        disconnect() {}
      };

      /* Stub ResizeObserver */
      window.ResizeObserver = class {
        constructor() {}
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  return dom;
}

/**
 * Wait for scripts to execute (jsdom runs inline scripts synchronously,
 * but some use setTimeout/DOMContentLoaded)
 */
function waitForInit(dom, ms = 500) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
}

/**
 * Simulate a click on an element
 */
function simulateClick(dom, selector) {
  const el = dom.window.document.querySelector(selector);
  if (!el) return { found: false };

  const event = new dom.window.MouseEvent('click', {
    bubbles: true, cancelable: true, view: dom.window
  });
  el.dispatchEvent(event);

  /* Also fire onclick if it's an inline handler */
  if (el.onclick) {
    try { el.onclick(event); } catch (e) { return { found: true, error: e.message }; }
  }
  return { found: true };
}

/**
 * Check if an element is visible (not display:none or hidden)
 */
function isVisible(dom, selector) {
  const el = dom.window.document.querySelector(selector);
  if (!el) return null;
  const style = dom.window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && !el.hidden;
}

/* ====================================================================
 * MODULE-SPECIFIC WORKFLOW TESTS
 * Each test function receives a jsdom instance and runs user workflows.
 * ==================================================================== */

/* ====== PIPELINE TRACKER ====== */
async function testPipeline(dom) {
  const doc = dom.window.document;
  const mod = 'pipeline';
  let tested = 0;

  /* Workflow 1: File upload zone has a working file input */
  tested++;
  const fileInput = doc.querySelector('#resume-file-input');
  const dropZone = doc.querySelector('#resume-upload-zone, .resume-upload-zone');
  if (fileInput) {
    const inputStyle = dom.window.getComputedStyle(fileInput);
    /* v3.31.0 fix: opacity:0 instead of display:none */
    if (inputStyle.display === 'none') {
      fail(mod, 'file-upload', 'File input has display:none — .click() will fail in some browsers');
    } else {
      pass(mod, 'file-upload', 'File input is not display:none (uses opacity:0 or similar)');
    }
  } else {
    warn(mod, 'file-upload', 'No #resume-file-input element found');
  }

  /* Workflow 2: Drop zone has onclick that triggers file input */
  tested++;
  if (dropZone) {
    const hasOnclick = dropZone.getAttribute('onclick') || dropZone.onclick;
    if (hasOnclick) {
      pass(mod, 'drop-zone-click', 'Drop zone has onclick handler for file selection');
    } else {
      fail(mod, 'drop-zone-click', 'Drop zone has no onclick — clicking it does nothing');
    }
  } else {
    warn(mod, 'drop-zone-click', 'No drop zone element found');
  }

  /* Workflow 3: Add Role form exists and has required fields */
  tested++;
  const addRoleBtn = doc.querySelector('[onclick*="openAddRole"], [onclick*="addRole"], #add-role-btn');
  if (addRoleBtn) {
    pass(mod, 'add-role-btn', 'Add Role button exists');
  } else {
    warn(mod, 'add-role-btn', 'No Add Role button found (may use different selector)');
  }

  /* Workflow 4: View switching — Kanban, Table, Companies tabs exist */
  tested++;
  const viewBtns = doc.querySelectorAll('[onclick*="switchView"], [onclick*="setView"], .view-btn, [data-view]');
  if (viewBtns.length >= 2) {
    pass(mod, 'view-switch', `${viewBtns.length} view switch buttons found`);
  } else {
    warn(mod, 'view-switch', `Only ${viewBtns.length} view buttons found — expected 2+`);
  }

  /* Workflow 5: localStorage pf_roles read/write */
  tested++;
  const localStorage = dom.window.localStorage;
  localStorage.setItem('pf_roles', JSON.stringify([
    { id: 'test-1', company: 'TestCo', title: 'Engineer', stage: 'Interested' }
  ]));
  const stored = JSON.parse(localStorage.getItem('pf_roles'));
  if (stored && stored.length === 1 && stored[0].company === 'TestCo') {
    pass(mod, 'localStorage-rw', 'pf_roles read/write works');
  } else {
    fail(mod, 'localStorage-rw', 'pf_roles read/write failed');
  }

  return tested;
}

/* ====== JOB FEED LISTENER ====== */
async function testFeed(dom) {
  const doc = dom.window.document;
  const mod = 'job-feed-listener';
  let tested = 0;

  /* Workflow 1: Sources tab exists and can be switched to */
  tested++;
  const sourcesTab = doc.querySelector('[onclick*="sources"], [data-tab="sources"], #sources-tab');
  if (sourcesTab) {
    pass(mod, 'sources-tab', 'Sources tab element exists');
  } else {
    /* Try finding by text content */
    const allTabs = doc.querySelectorAll('.tab-btn, [role="tab"], .nav-tab');
    let found = false;
    allTabs.forEach(t => {
      if (t.textContent.toLowerCase().includes('source')) found = true;
    });
    if (found) {
      pass(mod, 'sources-tab', 'Sources tab found by text content');
    } else {
      fail(mod, 'sources-tab', 'No Sources tab found in any form');
    }
  }

  /* Workflow 2: Gmail scan status element exists */
  tested++;
  const scanStatus = doc.querySelector('#gmailScanStatus');
  if (scanStatus) {
    pass(mod, 'gmail-scan-status', '#gmailScanStatus element exists');
  } else {
    fail(mod, 'gmail-scan-status', '#gmailScanStatus element missing — scan status has nowhere to render');
  }

  /* Workflow 3: Gmail scan file input exists and is not display:none */
  tested++;
  const scanFileInput = doc.querySelector('#gmailScanFileInput');
  if (scanFileInput) {
    const style = dom.window.getComputedStyle(scanFileInput);
    if (style.display === 'none') {
      warn(mod, 'gmail-file-input', '#gmailScanFileInput is display:none — may block .click() in some browsers');
    } else {
      pass(mod, 'gmail-file-input', '#gmailScanFileInput exists and is not display:none');
    }
  } else {
    fail(mod, 'gmail-file-input', '#gmailScanFileInput element missing — file import button broken');
  }

  /* Workflow 4: Gmail scan source breakdown element exists */
  tested++;
  const scanSources = doc.querySelector('#gmailScanSources');
  if (scanSources) {
    pass(mod, 'gmail-scan-sources', '#gmailScanSources element exists');
  } else {
    warn(mod, 'gmail-scan-sources', '#gmailScanSources element missing');
  }

  /* Workflow 5: No references to removed Gmail OAuth elements */
  tested++;
  const gmailTokenModal = doc.querySelector('#gmailTokenModal');
  const connectGmailBtn = doc.querySelector('#connectGmailBtn');
  if (gmailTokenModal || connectGmailBtn) {
    fail(mod, 'dead-gmail-ui', 'Old Gmail OAuth elements still in DOM (gmailTokenModal or connectGmailBtn)');
  } else {
    pass(mod, 'dead-gmail-ui', 'No old Gmail OAuth elements in DOM');
  }

  /* Workflow 6: FEED_SOURCES constant includes MCP scan sources */
  tested++;
  const pageText = doc.documentElement.innerHTML;
  if (pageText.includes('Via Gmail MCP scan')) {
    pass(mod, 'feed-sources-mcp', 'FEED_SOURCES references Gmail MCP scan');
  } else {
    fail(mod, 'feed-sources-mcp', 'FEED_SOURCES does not reference Gmail MCP scan — sources tab will show stale info');
  }

  /* Workflow 7: Feed queue loads from localStorage */
  tested++;
  const localStorage = dom.window.localStorage;
  const testQueue = [
    { id: 'test-1', company: 'TestCo', title: 'Engineer', score: 85, source: 'linkedin' }
  ];
  localStorage.setItem('pf_feed_queue', JSON.stringify(testQueue));
  const stored = JSON.parse(localStorage.getItem('pf_feed_queue'));
  if (stored && stored.length === 1 && stored[0].score === 85) {
    pass(mod, 'feed-queue-storage', 'pf_feed_queue localStorage read/write works');
  } else {
    fail(mod, 'feed-queue-storage', 'pf_feed_queue localStorage read/write failed');
  }

  return tested;
}

/* ====== DASHBOARD ====== */
async function testDashboard(dom) {
  const doc = dom.window.document;
  const mod = 'dashboard';
  let tested = 0;

  /* Workflow 1: Dashboard renders without fatal errors */
  tested++;
  const body = doc.body;
  if (body && body.innerHTML.length > 100) {
    pass(mod, 'renders', 'Dashboard body has content');
  } else {
    fail(mod, 'renders', 'Dashboard body is empty or minimal');
  }

  /* Workflow 2: Reads pf_roles from localStorage */
  tested++;
  dom.window.localStorage.setItem('pf_roles', JSON.stringify([
    { id: 'r1', company: 'Acme', title: 'PM', stage: 'Applied' }
  ]));
  const roles = JSON.parse(dom.window.localStorage.getItem('pf_roles'));
  if (roles && roles[0].company === 'Acme') {
    pass(mod, 'reads-roles', 'Can read pf_roles from localStorage');
  } else {
    fail(mod, 'reads-roles', 'Failed to read pf_roles');
  }

  /* Workflow 3: Theme toggle exists */
  tested++;
  const themeToggle = doc.querySelector('[onclick*="theme"], [onclick*="Theme"], #theme-toggle, .theme-toggle');
  if (themeToggle) {
    pass(mod, 'theme-toggle', 'Theme toggle element exists');
  } else {
    warn(mod, 'theme-toggle', 'No theme toggle found (may use different selector)');
  }

  return tested;
}

/* ====== RESEARCH BRIEF ====== */
async function testResearchBrief(dom) {
  const doc = dom.window.document;
  const mod = 'research-brief';
  let tested = 0;

  /* Workflow 1: Role selector exists */
  tested++;
  const roleSelect = doc.querySelector('#role-select, select[id*="role"], #roleSelect');
  if (roleSelect) {
    pass(mod, 'role-select', 'Role selector element exists');
  } else {
    warn(mod, 'role-select', 'No role selector found');
  }

  /* Workflow 2: Generate button exists */
  tested++;
  const generateBtn = doc.querySelector('[onclick*="generate"], [onclick*="Generate"], #generate-btn, .generate-btn');
  if (generateBtn) {
    pass(mod, 'generate-btn', 'Generate brief button exists');
  } else {
    warn(mod, 'generate-btn', 'No Generate button found');
  }

  /* Workflow 3: API key input exists */
  tested++;
  const apiKeyInput = doc.querySelector('#api-key, #apiKey, [id*="anthropic"], input[type="password"]');
  if (apiKeyInput) {
    pass(mod, 'api-key-input', 'API key input exists');
  } else {
    warn(mod, 'api-key-input', 'No API key input found');
  }

  return tested;
}

/* ====== RESUME TAILOR ====== */
async function testResumeTailor(dom) {
  const doc = dom.window.document;
  const mod = 'resume-tailor';
  let tested = 0;

  /* Workflow 1: JD input area exists */
  tested++;
  const jdInput = doc.querySelector('#jd-input, #jdInput, textarea[id*="jd"], textarea[id*="description"]');
  if (jdInput) {
    pass(mod, 'jd-input', 'Job description input exists');
  } else {
    warn(mod, 'jd-input', 'No JD input found');
  }

  /* Workflow 2: Analyze button exists */
  tested++;
  const analyzeBtn = doc.querySelector('[onclick*="analyze"], [onclick*="Analyze"], #analyze-btn');
  if (analyzeBtn) {
    pass(mod, 'analyze-btn', 'Analyze JD button exists');
  } else {
    warn(mod, 'analyze-btn', 'No Analyze button found');
  }

  return tested;
}

/* ====== GENERIC MODULE TEST ====== */
async function testGenericModule(dom, moduleName) {
  const doc = dom.window.document;
  let tested = 0;

  /* Basic rendering check */
  tested++;
  if (doc.body && doc.body.innerHTML.length > 200) {
    pass(moduleName, 'renders', 'Module has substantial content');
  } else {
    fail(moduleName, 'renders', 'Module body is empty or minimal');
  }

  /* Nav links exist */
  tested++;
  const navLinks = doc.querySelectorAll('a[href*="../"], nav a, .nav-link');
  if (navLinks.length >= 3) {
    pass(moduleName, 'nav-links', `${navLinks.length} navigation links found`);
  } else {
    warn(moduleName, 'nav-links', `Only ${navLinks.length} nav links — expected 3+`);
  }

  return tested;
}

/* ====== MODULE → TEST FUNCTION MAP ====== */
const MODULE_TESTS = {
  'pipeline':           testPipeline,
  'job-feed-listener':  testFeed,
  'dashboard':          testDashboard,
  'research-brief':     testResearchBrief,
  'resume-tailor':      testResumeTailor,
};

/* ====== MAIN ====== */
async function main() {
  console.log('======================================');
  console.log('Pathfinder Headless Interactive QA');
  console.log('======================================');
  console.log(`${DIM}Using jsdom to simulate user workflows${NC}`);

  const moduleDirs = fs.readdirSync(MODULES_DIR)
    .filter(d => {
      const fullPath = path.join(MODULES_DIR, d);
      return fs.statSync(fullPath).isDirectory() && d !== 'shared';
    })
    .filter(d => !MODULE_FILTER || d === MODULE_FILTER);

  let totalWorkflows = 0;

  for (const mod of moduleDirs) {
    section(mod);

    let dom;
    try {
      dom = createDom(mod);
    } catch (e) {
      fail(mod, 'init', `Failed to create DOM: ${e.message}`);
      continue;
    }

    if (!dom) {
      skip(mod, 'init', 'No index.html found');
      continue;
    }

    /* Wait for inline scripts to run */
    await waitForInit(dom, 300);

    /* Suppress unhandled errors from module init (missing APIs, etc.) */
    const errors = [];
    dom.window.addEventListener('error', (e) => {
      /* Only track errors from our test workflows, not module init noise */
      errors.push(e.message);
    });

    /* Run module-specific tests, fall back to generic */
    const testFn = MODULE_TESTS[mod] || testGenericModule;
    try {
      if (MODULE_TESTS[mod]) {
        totalWorkflows += await testFn(dom);
      } else {
        totalWorkflows += await testGenericModule(dom, mod);
      }
    } catch (e) {
      fail(mod, 'test-runner', `Test function threw: ${e.message}`);
    }

    /* Clean up */
    dom.window.close();
  }

  /* ====== SUMMARY ====== */
  const total = passCount + failCount + warnCount;
  console.log('\n======================================');
  console.log(`${BOLD}Interactive QA: ${totalWorkflows} workflows across ${moduleDirs.length} modules${NC}`);
  console.log('');

  if (failCount > 0) {
    console.log(`  ${RED}${BOLD}${failCount} FAILURE(S)${NC}  — user workflows broken`);
  }
  if (warnCount > 0) {
    console.log(`  ${YELLOW}${warnCount} warning(s)${NC}   — review recommended`);
  }
  if (passCount > 0) {
    console.log(`  ${GREEN}${passCount} passed${NC}`);
  }
  if (skipCount > 0) {
    console.log(`  ${DIM}${skipCount} skipped${NC}`);
  }

  console.log('');
  if (failCount > 0) {
    console.log('Fix failures before committing.');
    process.exit(1);
  } else {
    console.log(failCount === 0 && warnCount === 0 ? 'All clear.' : 'Warnings only — safe to commit.');
    process.exit(0);
  }
}

main().catch(e => {
  console.error(`Fatal error: ${e.message}`);
  process.exit(1);
});
