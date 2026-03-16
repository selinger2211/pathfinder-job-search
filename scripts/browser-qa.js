#!/usr/bin/env node
/* ====================================================================
 * PATHFINDER — BROWSER QA TEST DEFINITIONS
 * ====================================================================
 * This file defines the real-browser test workflows for each module.
 * It's designed to be read by Claude during Chrome MCP QA sessions,
 * NOT executed directly by Node.js.
 *
 * How it works:
 *   1. User runs: python3 -m http.server 8765
 *      (from ~/Projects/job-search-agents-v2)
 *   2. Claude reads this file to know what to test
 *   3. Claude navigates Chrome to each module via MCP tools
 *   4. Claude executes each test workflow using clicks, screenshots,
 *      and JavaScript evaluation
 *
 * Each module has:
 *   - url: path relative to localhost:8765
 *   - workflows: array of test steps to execute
 *   - Each workflow has: name, steps[], expected outcome
 *
 * Created v3.31.2 as part of the QA infrastructure overhaul.
 * ==================================================================== */

const BROWSER_QA_TESTS = {
  /* ====== PIPELINE TRACKER ====== */
  'pipeline': {
    url: '/modules/pipeline/index.html',
    workflows: [
      {
        name: 'Kanban renders with data',
        steps: [
          'Take screenshot after page load',
          'Verify Kanban columns visible (Discovered through Closed)',
          'Verify role cards appear in columns'
        ],
        expected: 'Kanban board with stage columns and role cards'
      },
      {
        name: 'Role detail panel opens',
        steps: [
          'Click any role card',
          'Take screenshot',
          'Verify detail panel slides in from right',
          'Verify Company, Title, Stage fields visible'
        ],
        expected: 'Detail panel with editable role fields'
      },
      {
        name: 'File upload zone works',
        steps: [
          'In detail panel, scroll to Artifacts section',
          'Verify "Drop a file here or browse" zone is visible',
          'Run JS: check file input is NOT display:none',
          'Run JS: check drop zone has onclick handler',
          'Click the drop zone — file picker should open'
        ],
        jsCheck: `(() => {
          const fi = document.getElementById('resume-file-input');
          const dz = document.getElementById('resume-upload-zone') || document.querySelector('.resume-upload-zone');
          return {
            fileInputExists: !!fi,
            notDisplayNone: fi ? getComputedStyle(fi).display !== 'none' : false,
            opacity0: fi ? getComputedStyle(fi).opacity === '0' : false,
            dropZoneOnclick: dz ? !!dz.getAttribute('onclick') : false
          };
        })()`,
        expected: 'File input exists, opacity:0 (not display:none), drop zone has onclick'
      },
      {
        name: 'View switching (Kanban → Table → Companies)',
        steps: [
          'Click "Table" view button',
          'Take screenshot — verify table rows appear',
          'Click "Companies" view button',
          'Take screenshot — verify company cards appear',
          'Click "Kanban" to return'
        ],
        expected: 'Each view renders without blank page or errors'
      },
      {
        name: 'Stage change via detail panel',
        steps: [
          'Click a role card to open detail',
          'Click a different stage button (e.g., "Researching")',
          'Take screenshot',
          'Verify role card moved to new column after close'
        ],
        expected: 'Role moves to selected stage in Kanban'
      },
      {
        name: 'Console error check',
        steps: ['Read console messages, filter for errors'],
        expected: 'Zero console errors'
      }
    ]
  },

  /* ====== JOB FEED LISTENER ====== */
  'job-feed-listener': {
    url: '/modules/job-feed-listener/index.html',
    workflows: [
      {
        name: 'Feed tab renders with scored roles',
        steps: [
          'Take screenshot after page load',
          'Verify role cards appear with scores (X/100)',
          'Verify Accept/Snooze/Dismiss buttons on each card'
        ],
        expected: 'Feed cards with scores and action buttons'
      },
      {
        name: 'Sources tab switch and content',
        steps: [
          'Click "Sources" tab',
          'Take screenshot',
          'Verify Source Analytics cards visible (counts per source)',
          'Scroll down to verify Gmail Feed Scanner section',
          'Verify "Last scan imported" status shows',
          'Verify source breakdown chips (LinkedIn, Built In, etc.)'
        ],
        expected: 'Sources tab renders with analytics + Gmail scan status'
      },
      {
        name: 'Gmail scan import button works',
        steps: [
          'In Sources tab, find "Import Scan Results" button',
          'Run JS: verify #gmailScanFileInput is not display:none',
          'Click the Import button — file picker should open'
        ],
        jsCheck: `(() => {
          const fi = document.getElementById('gmailScanFileInput');
          return {
            exists: !!fi,
            notDisplayNone: fi ? getComputedStyle(fi).display !== 'none' : false,
            opacity0: fi ? getComputedStyle(fi).opacity === '0' : false
          };
        })()`,
        expected: 'File input exists, not display:none, file picker opens on click'
      },
      {
        name: 'No old Gmail OAuth elements',
        steps: [
          'Run JS: check #gmailTokenModal does not exist',
          'Run JS: check #connectGmailBtn does not exist'
        ],
        jsCheck: `({
          noTokenModal: !document.getElementById('gmailTokenModal'),
          noConnectBtn: !document.getElementById('connectGmailBtn')
        })`,
        expected: 'Old Gmail OAuth modal and button completely removed'
      },
      {
        name: 'Feed sources list shows MCP scan',
        steps: [
          'Scroll to Source Management in Sources tab',
          'Verify LinkedIn Alerts shows "Via Gmail MCP scan"',
          'Verify Built In shows "Via Gmail MCP scan"',
          'Verify Referrals shows "Via Gmail MCP scan"',
          'Verify Recruiter Outreach shows "Via Gmail MCP scan"'
        ],
        expected: 'All scanner sources say "Via Gmail MCP scan"'
      },
      {
        name: 'JD enrichment pipeline health (v3.31.4)',
        steps: [
          'Run JS: verify enrichRoleJD function exists',
          'Run JS: verify enrichAllRoles function exists',
          'Run JS: verify CORS_PROXIES has 3+ entries',
          'Run JS: verify MIN_FULL_JD_LENGTH === 300',
          'Run JS: check JD coverage — count roles with jdEnriched===true',
          'Run JS: verify Enrich All button is not disabled when stubs exist',
          'Click "Enrich JDs" button — verify it starts processing'
        ],
        jsCheck: `(() => {
          const feedItems = JSON.parse(localStorage.getItem('pf_feed_queue') || '[]');
          const enriched = feedItems.filter(r => r.jdEnriched && r.jd && r.jd.length >= 300).length;
          const total = feedItems.length;
          const coverage = total > 0 ? Math.round((enriched / total) * 100) : 0;
          return {
            enrichRoleJDExists: typeof enrichRoleJD === 'function',
            enrichAllRolesExists: typeof enrichAllRoles === 'function',
            corsProxiesExist: typeof CORS_PROXIES !== 'undefined' && Array.isArray(CORS_PROXIES),
            corsProxyCount: typeof CORS_PROXIES !== 'undefined' ? CORS_PROXIES.length : 0,
            minJDLength: typeof MIN_FULL_JD_LENGTH !== 'undefined' ? MIN_FULL_JD_LENGTH : null,
            totalRoles: total,
            enrichedRoles: enriched,
            jdCoveragePercent: coverage,
            coverageOK: coverage >= 60
          };
        })()`,
        expected: 'All enrichment functions exist, CORS proxies configured, JD coverage ≥ 60%'
      },
      {
        name: 'Console error check',
        steps: ['Read console messages, filter for errors'],
        expected: 'Zero console errors'
      }
    ]
  },

  /* ====== DASHBOARD ====== */
  'dashboard': {
    url: '/modules/dashboard/index.html',
    workflows: [
      {
        name: 'Dashboard renders with widgets',
        steps: [
          'Take screenshot after page load',
          'Verify header, pipeline summary visible',
          'Verify action items or nudges render'
        ],
        expected: 'Dashboard with pipeline stats and action items'
      },
      {
        name: 'Navigation links all work',
        steps: [
          'Verify all 11 module links in nav bar',
          'Click each module name — should navigate without 404'
        ],
        expected: 'All nav links resolve to existing pages'
      },
      {
        name: 'Console error check',
        steps: ['Read console messages, filter for errors'],
        expected: 'Zero console errors'
      }
    ]
  },

  /* ====== RESEARCH BRIEF ====== */
  'research-brief': {
    url: '/modules/research-brief/index.html',
    workflows: [
      {
        name: 'Brief generator loads',
        steps: [
          'Take screenshot after page load',
          'Verify role selector dropdown exists',
          'Verify API key input exists',
          'Verify Generate button exists'
        ],
        expected: 'Research brief form with role selector and generate button'
      },
      {
        name: 'Role selector populates from localStorage',
        steps: [
          'Run JS: check if role dropdown has options from pf_roles',
          'If pf_roles has data, dropdown should have matching entries'
        ],
        expected: 'Dropdown populated with pipeline roles'
      },
      {
        name: 'Console error check',
        steps: ['Read console messages, filter for errors'],
        expected: 'Zero console errors'
      }
    ]
  },

  /* ====== RESUME TAILOR ====== */
  'resume-tailor': {
    url: '/modules/resume-tailor/index.html',
    workflows: [
      {
        name: 'Resume builder loads',
        steps: [
          'Take screenshot after page load',
          'Verify JD input area exists',
          'Verify analysis/generate button exists'
        ],
        expected: 'Resume builder form loads without errors'
      },
      {
        name: 'Console error check',
        steps: ['Read console messages, filter for errors'],
        expected: 'Zero console errors'
      }
    ]
  }
};

/* Export for reference — Claude reads this file, doesn't execute it */
if (typeof module !== 'undefined') {
  module.exports = BROWSER_QA_TESTS;
}

/* Print summary if run directly */
if (require.main === module) {
  console.log('Pathfinder Browser QA Test Definitions');
  console.log('======================================');
  console.log('');
  Object.entries(BROWSER_QA_TESTS).forEach(([mod, config]) => {
    console.log(`${mod}: ${config.workflows.length} workflows`);
    config.workflows.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name}`);
    });
    console.log('');
  });
  console.log('To run: have user start "python3 -m http.server 8765"');
  console.log('Then Claude uses Chrome MCP to navigate and test each workflow.');
}
