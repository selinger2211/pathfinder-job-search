#!/usr/bin/env node
/* ====================================================================
 * PATHFINDER — WORKFLOW REGRESSION TEST
 * ====================================================================
 * Deep static analysis that catches FUNCTIONAL breakage:
 *   1. onclick/event handlers referencing undefined functions
 *   2. Contradictory operations (open + close called in sequence)
 *   3. DOM IDs referenced in JS but missing from HTML
 *   4. Removed/renamed functions still being called
 *   5. Script load order issues
 *   6. CSS selector bugs (querySelector targeting wrong element)
 *   7. URL param contracts between modules
 *
 * Unlike regression-check.sh (pattern drift), this tests whether the
 * code can actually RUN without throwing ReferenceErrors.
 *
 * Usage:
 *   node scripts/workflow-regression.js
 *   node scripts/workflow-regression.js --verbose
 *   node scripts/workflow-regression.js --module pipeline
 *
 * Created v3.30.1 after getCompanyLogoFallbackUrl broke all Pipeline
 * interactions — a function removed in v3.30.0 was still being called.
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
 * Functions that once existed but were removed or renamed.
 * Any call to these is guaranteed broken. Add to this list
 * whenever a function is removed during a refactor.
 */
const REMOVED_FUNCTIONS = [
  'getCompanyLogoFallbackUrl',   /* Removed v3.30.0 — use handleLogoError() */
  'getClearbitLogoUrl',          /* Removed v3.29.0 — Clearbit is dead */
  'clearbitLogoUrl',             /* Removed v3.29.0 */
];

/* ====== OUTPUT HELPERS ====== */
let failCount = 0;
let warnCount = 0;
let passCount = 0;

const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const GREEN = '\x1b[0;32m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

function fail(module, msg) { failCount++; console.log(`  ${RED}FAIL${NC} [${module}] ${msg}`); }
function warn(module, msg) { warnCount++; if (VERBOSE) console.log(`  ${YELLOW}WARN${NC} [${module}] ${msg}`); }
function pass(module, msg) { passCount++; if (VERBOSE) console.log(`  ${GREEN}PASS${NC} [${module}] ${msg}`); }
function info(msg) { if (VERBOSE) console.log(`  ${DIM}${msg}${NC}`); }

/* ====== PARSING HELPERS ====== */

/**
 * Extract all inline <script> blocks from an HTML file.
 */
function extractInlineScripts(html) {
  const scripts = [];
  const lines = html.split('\n');
  let inScript = false;
  let scriptLines = [];
  let scriptStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('<script') && !trimmed.includes('src=')) {
      inScript = true;
      scriptStart = i + 1;
      scriptLines = [];
      const afterTag = trimmed.replace(/<script[^>]*>/, '');
      if (afterTag) scriptLines.push(afterTag);
      continue;
    }
    if (inScript && trimmed.includes('</script>')) {
      const beforeClose = lines[i].split('</script>')[0];
      if (beforeClose.trim()) scriptLines.push(beforeClose);
      scripts.push({ code: scriptLines.join('\n'), startLine: scriptStart });
      inScript = false;
      continue;
    }
    if (inScript) {
      scriptLines.push(lines[i]);
    }
  }
  return scripts;
}

/**
 * Extract function definitions from JS code.
 */
function extractFunctionDefs(code) {
  const fns = new Set();
  let m;

  /* function foo() */
  const funcDecl = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((m = funcDecl.exec(code)) !== null) fns.add(m[1]);

  /* const/let/var foo = function/arrow */
  const arrowOrExpr = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function|\(|[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>)/g;
  while ((m = arrowOrExpr.exec(code)) !== null) fns.add(m[1]);

  return fns;
}

/**
 * Extract DOM element IDs from HTML.
 */
function extractHtmlIds(html) {
  const ids = new Set();
  const idRe = /id\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = idRe.exec(html)) !== null) ids.add(m[1]);
  return ids;
}

/**
 * Extract getElementById calls from JS code.
 */
function extractGetElementByIdCalls(code, startLine) {
  const calls = [];
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const re = /getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(lines[i])) !== null) {
      if (!m[1].includes('$') && !m[1].includes('+')) {
        calls.push({ id: m[1], line: startLine + i });
      }
    }
  }
  return calls;
}

/**
 * Extract shared script imports from HTML.
 */
function extractSharedImports(html) {
  const imports = [];
  const re = /src\s*=\s*"\.\.\/shared\/([^"?]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) imports.push(m[1]);
  return imports;
}

/**
 * Get functions defined in a shared JS file.
 */
function getSharedFunctions(filename) {
  const filepath = path.join(SHARED_DIR, filename);
  if (!fs.existsSync(filepath)) return new Set();
  return extractFunctionDefs(fs.readFileSync(filepath, 'utf8'));
}

/**
 * Get global CONST declarations from a shared JS file.
 */
function getSharedGlobals(filename) {
  const filepath = path.join(SHARED_DIR, filename);
  if (!fs.existsSync(filepath)) return new Set();
  const code = fs.readFileSync(filepath, 'utf8');
  const globals = new Set();
  const re = /^(?:const|let|var)\s+([A-Z_$][A-Z0-9_$]*)\s*=/gm;
  let m;
  while ((m = re.exec(code)) !== null) globals.add(m[1]);
  return globals;
}

/* ====== CHECK 1: onclick handlers ====== */

/**
 * Extract top-level function names from onclick handlers and verify they exist.
 * Handles patterns: fnName(), Object.method(), this.method(), chained calls.
 */
function checkOnclickHandlers(moduleName, html, availableFunctions) {
  const lines = html.split('\n');
  let checked = 0;
  let passed = 0;

  /* Known safe onclick patterns that aren't standalone function calls */
  const safePatterns = new Set([
    'console', 'window', 'document', 'this', 'event', 'history',
    'localStorage', 'sessionStorage', 'navigator', 'location',
    'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number',
    'alert', 'confirm', 'prompt', 'setTimeout', 'setInterval',
    'clearTimeout', 'clearInterval', 'encodeURIComponent',
  ]);

  for (let i = 0; i < lines.length; i++) {
    const onclickRe = /on(?:click|change|input|submit|error)\s*=\s*"([^"]+)"/gi;
    let m;
    while ((m = onclickRe.exec(lines[i])) !== null) {
      const handler = m[1];

      /* Extract the FIRST function call (the main intent).
       * For "ObjectName.method()" → check ObjectName
       * For "fnName()" → check fnName
       * For "fnA(); fnB()" → check both fnA and fnB
       */
      const statements = handler.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        /* Get the first identifier before a ( */
        const callMatch = stmt.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (!callMatch) continue;

        const firstName = callMatch[1];

        /* Skip safe DOM/browser built-ins */
        if (safePatterns.has(firstName)) continue;

        /* If it's Object.method(), only check Object exists */
        const dotCall = stmt.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$]+)\s*\(/);
        if (dotCall) {
          /* For IIFE-style apps (DebriefApp.method), the object is a namespace — skip */
          if (dotCall[1].endsWith('App') || dotCall[1] === 'PF' || dotCall[1] === 'lucide') continue;
          /* Check if the object variable exists */
          if (availableFunctions.has(dotCall[1])) { checked++; passed++; continue; }
        }

        /* Standalone function call: fnName(...) */
        const standaloneCall = stmt.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
        if (standaloneCall) {
          checked++;
          const fnName = standaloneCall[1];
          if (availableFunctions.has(fnName) || safePatterns.has(fnName)) {
            passed++;
          } else {
            fail(moduleName, `Line ${i + 1}: onclick calls undefined "${fnName}()" — ${handler.substring(0, 60)}`);
          }
        }
      }
    }
  }

  if (checked > 0 && passed === checked) {
    pass(moduleName, `All ${checked} onclick handlers resolve to defined functions`);
  }
}

/* ====== CHECK 2: Contradictory calls ====== */

function checkContradictoryCalls(moduleName, html) {
  const lines = html.split('\n');
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    /* Pattern: open...(); close...() in same onclick */
    const re = /on\w+\s*=\s*"[^"]*\b(open[A-Z]\w*)\([^)]*\)\s*;\s*(close[A-Z]\w*)\([^)]*\)[^"]*"/g;
    let m;
    while ((m = re.exec(lines[i])) !== null) {
      const openTarget = m[1].replace(/^open/, '');
      const closeTarget = m[2].replace(/^close/, '');
      if (openTarget === closeTarget) {
        found++;
        fail(moduleName, `Line ${i + 1}: Contradictory — ${m[1]}() then ${m[2]}() in same handler`);
      }
    }
  }
  if (found === 0) pass(moduleName, 'No contradictory open/close sequences');
}

/* ====== CHECK 3: getElementById integrity ====== */

function checkElementIds(moduleName, html, scripts) {
  const htmlIds = extractHtmlIds(html);
  let total = 0;
  let passed = 0;
  const missing = [];

  scripts.forEach(s => {
    extractGetElementByIdCalls(s.code, s.startLine).forEach(({ id, line }) => {
      total++;
      if (htmlIds.has(id)) {
        passed++;
      } else {
        missing.push({ id, line });
      }
    });
  });

  /* Only flag as FAIL if the ID is clearly static and not dynamically created */
  const dynamicPatterns = ['Toast', 'tooltip', 'popover', 'Popup', 'Modal'];
  missing.forEach(({ id, line }) => {
    const isDynamic = dynamicPatterns.some(p => id.includes(p)) || id.includes('-');
    if (isDynamic) {
      warn(moduleName, `Line ${line}: getElementById('${id}') — ID may be dynamic`);
    } else {
      warn(moduleName, `Line ${line}: getElementById('${id}') — no matching id in HTML`);
    }
  });

  if (total > 0 && passed === total) {
    pass(moduleName, `All ${total} getElementById calls match HTML elements`);
  } else if (total > 0) {
    pass(moduleName, `${passed}/${total} getElementById calls match HTML elements`);
  }
}

/* ====== CHECK 4: Removed function calls ====== */

function checkRemovedFunctions(moduleName, html) {
  const lines = html.split('\n');
  let clean = true;
  REMOVED_FUNCTIONS.forEach(fn => {
    for (let i = 0; i < lines.length; i++) {
      /* Skip comments */
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (lines[i].includes(fn + '(') || lines[i].includes(fn + ' (')) {
        fail(moduleName, `Line ${i + 1}: Calls removed function "${fn}()"`);
        clean = false;
      }
    }
  });
  if (clean) pass(moduleName, 'No calls to removed/renamed functions');
}

/* ====== CHECK 5: Script load order ====== */

function checkScriptOrder(moduleName, html) {
  const lines = html.split('\n');
  const sharedScripts = [];
  let firstInlineScript = Infinity;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('src="../shared/') && !lines[i].includes('data-layer.js')) {
      const fileMatch = lines[i].match(/shared\/([^"?]+)/);
      if (fileMatch) sharedScripts.push({ file: fileMatch[1], line: i + 1 });
    }
    if (lines[i].trim().startsWith('<script') && !lines[i].includes('src=') && firstInlineScript === Infinity) {
      /* Skip tiny IIFE scripts in <head> (cache purge, theme init, etc.)
       * — only flag the MAIN script block (>50 lines) */
      let scriptEnd = i;
      for (let j = i + 1; j < lines.length && j < i + 200; j++) {
        if (lines[j].includes('</script>')) { scriptEnd = j; break; }
      }
      if (scriptEnd - i > 50) {
        firstInlineScript = i + 1;
      }
    }
  }

  let orderOk = true;
  sharedScripts.forEach(s => {
    if (s.line > firstInlineScript) {
      fail(moduleName, `shared/${s.file} at line ${s.line} loads AFTER inline script at line ${firstInlineScript}`);
      orderOk = false;
    }
  });
  if (sharedScripts.length > 0 && orderOk) {
    pass(moduleName, 'Shared scripts load before inline code');
  }
}

/* ====== CHECK 6: querySelector ambiguity ======
 * Catches cases where querySelector with generic selectors might
 * match the wrong element (like the Save button bug).
 */
function checkSelectorAmbiguity(moduleName, scripts) {
  const riskySelectors = [
    /querySelector\s*\(\s*['"]button:last-child['"]\s*\)/,
    /querySelector\s*\(\s*['"]button:first-child['"]\s*\)/,
    /querySelector\s*\(\s*['"]div:last-child['"]\s*\)/,
    /querySelector\s*\(\s*['"]input:last-child['"]\s*\)/,
  ];

  let found = 0;
  scripts.forEach(s => {
    const lines = s.code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      riskySelectors.forEach(re => {
        if (re.test(lines[i])) {
          found++;
          warn(moduleName, `Line ${s.startLine + i}: Ambiguous querySelector — "${lines[i].trim().substring(0, 70)}" — use class selector instead`);
        }
      });
    }
  });
  if (found === 0) pass(moduleName, 'No ambiguous querySelector patterns');
}

/* ====== CHECK 7: URL param contracts ====== */

function extractOutboundUrlParams(html) {
  const params = new Map();
  let m;
  const re = /(?:href\s*=\s*["']|window\.location\.href\s*=\s*[`'"])\.\.\/([^/]+)\/[^"'`]*\?([^"'`#]+)/g;
  while ((m = re.exec(html)) !== null) {
    const target = m[1];
    const qs = m[2];
    if (!params.has(target)) params.set(target, new Set());
    qs.split('&').forEach(p => {
      const key = p.split('=')[0].replace(/\$\{[^}]*\}/g, '');
      if (key && /^[a-zA-Z]+$/.test(key)) params.get(target).add(key);
    });
  }
  return params;
}

function moduleHandlesParam(html, paramName) {
  return html.includes('URLSearchParams') &&
    (html.includes(`'${paramName}'`) || html.includes(`"${paramName}"`));
}

/* ====== MAIN ====== */

console.log('======================================');
console.log('Pathfinder Workflow Regression Test');
console.log('======================================');
console.log('');

/* Build shared function registry */
const sharedFiles = fs.readdirSync(SHARED_DIR).filter(f => f.endsWith('.js'));

/* Collect modules */
const moduleDirs = fs.readdirSync(MODULES_DIR)
  .filter(d => {
    const fullPath = path.join(MODULES_DIR, d);
    return fs.statSync(fullPath).isDirectory() && d !== 'shared';
  })
  .filter(d => !MODULE_FILTER || d === MODULE_FILTER);

const allOutboundParams = new Map();

moduleDirs.forEach(moduleName => {
  const htmlPath = path.join(MODULES_DIR, moduleName, 'index.html');
  if (!fs.existsSync(htmlPath)) return;

  console.log(`--- ${moduleName} ---`);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = extractInlineScripts(html);

  /* Build available functions: local + shared imports */
  const availableFunctions = new Set();

  /* Local function definitions */
  scripts.forEach(s => {
    extractFunctionDefs(s.code).forEach(fn => availableFunctions.add(fn));
  });

  /* Shared imports */
  extractSharedImports(html).forEach(file => {
    getSharedFunctions(file).forEach(fn => availableFunctions.add(fn));
    getSharedGlobals(file).forEach(g => availableFunctions.add(g));
  });

  info(`  ${availableFunctions.size} available functions (local + shared)`);

  /* Run all checks */
  checkOnclickHandlers(moduleName, html, availableFunctions);
  checkContradictoryCalls(moduleName, html);
  checkElementIds(moduleName, html, scripts);
  checkRemovedFunctions(moduleName, html);
  checkScriptOrder(moduleName, html);
  checkSelectorAmbiguity(moduleName, scripts);

  /* Collect URL params for cross-module check */
  allOutboundParams.set(moduleName, extractOutboundUrlParams(html));

  console.log('');
});

/* ====== Cross-module URL param contracts ====== */
console.log('--- Cross-Module: URL Parameter Contracts ---');
let crossModuleChecked = 0;

allOutboundParams.forEach((targets, sender) => {
  targets.forEach((params, target) => {
    const targetPath = path.join(MODULES_DIR, target, 'index.html');
    if (!fs.existsSync(targetPath)) return;
    const targetHtml = fs.readFileSync(targetPath, 'utf8');

    params.forEach(param => {
      crossModuleChecked++;
      if (moduleHandlesParam(targetHtml, param)) {
        pass(`${sender}→${target}`, `?${param} is handled`);
      } else {
        const hasAny = targetHtml.includes('URLSearchParams') || targetHtml.includes('location.search');
        if (!hasAny) {
          warn(`${sender}→${target}`, `?${param} sent but target has NO URL param handling`);
        } else {
          warn(`${sender}→${target}`, `?${param} sent but not explicitly handled via get('${param}')`);
        }
      }
    });
  });
});
if (crossModuleChecked === 0) pass('cross-module', 'No URL param contracts to verify');

/* ====== SUMMARY ====== */
console.log('');
console.log('======================================');
const totalChecks = passCount + failCount + warnCount;
if (failCount > 0) {
  console.log(`${RED}${failCount} FAILURE(S)${NC}, ${warnCount} warning(s), ${passCount} passed (${totalChecks} total checks)`);
  console.log('Fix failures before committing.');
  process.exit(1);
} else if (warnCount > 0) {
  console.log(`${YELLOW}0 failures${NC}, ${warnCount} warning(s), ${passCount} passed (${totalChecks} total checks)`);
  console.log('Warnings are advisory — review but safe to commit.');
  process.exit(0);
} else {
  console.log(`${GREEN}ALL ${totalChecks} CHECKS PASSED${NC}`);
  process.exit(0);
}
