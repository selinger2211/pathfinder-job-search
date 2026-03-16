/* ====================================================================
 * PATHFINDER — SHARED LOGO SYSTEM (logos.js)
 * ====================================================================
 * Single source of truth for company logo rendering across all modules.
 * Extracted v3.30.0 to prevent regression — previously copy-pasted
 * between Pipeline and Feed, causing drift every time one was updated.
 *
 * WHAT THIS FILE PROVIDES:
 *   - DOMAIN_OVERRIDES  — map of company names → correct domains
 *   - getCompanyDomain(name, url) — ATS-aware domain extraction
 *   - guessDomain(name) — backward-compat alias
 *   - getCompanyColor(name) — deterministic color for letter avatars
 *   - getCompanyLogoUrl(name, url) — Google Favicon URL
 *   - handleLogoError(img, name, css) — two-stage fallback (DDG → letter)
 *   - companyLogoHtml(name, css, url) — full <img> tag with onerror
 *
 * HOW TO USE IN A MODULE:
 *   <script src="../shared/logos.js?v=3.30.0"></script>
 *   Then call any of the above functions directly — they're global.
 *
 * TO ADD A NEW DOMAIN OVERRIDE:
 *   Edit DOMAIN_OVERRIDES below. One place, all modules get it.
 * ==================================================================== */

/* ====== DOMAIN OVERRIDES ====== */

/**
 * Known domain overrides for companies whose name doesn't map
 * cleanly to a domain (e.g., "Amazon Ads" → "amazon.com").
 * Add new entries here — this is the ONLY place they need to go.
 */
const DOMAIN_OVERRIDES = {
  'amazon ads': 'amazon.com',
  'bounti.ai': 'bounti.ai',
  'albertsons media': 'albertsons.com',
  'activision blizzard': 'activisionblizzard.com',
  'bc ventures': 'bcventures.com',
  'enriches lab': 'enricheslab.com',
  'notion': 'notion.so',
  'google': 'google.com',
  'meta': 'meta.com',
  'apple': 'apple.com',
  'sofi': 'sofi.com',
  'blackrock': 'blackrock.com',
  'netflix': 'netflix.com',
  'stripe': 'stripe.com',
  'directv': 'directv.com',
  'yahoo': 'yahoo.com',
  'uber': 'uber.com',
  'geico': 'geico.com',
  'ringcentral': 'ringcentral.com',
  'ringcentral inc': 'ringcentral.com',
  'ringcentral inc.': 'ringcentral.com',
};

/* ====== DOMAIN EXTRACTION ====== */

/**
 * Derives a clean company domain for logo lookup.
 * Handles ATS URLs (Workday, Greenhouse, Lever, Ashby, LinkedIn)
 * by extracting the company name from the URL structure.
 * Falls back to companyname.com if no URL or no ATS match.
 *
 * INPUT: companyName (string), optional url (string)
 * OUTPUT: domain string (e.g., "stripe.com")
 */
function getCompanyDomain(companyName, url) {
  var override = DOMAIN_OVERRIDES[(companyName || '').toLowerCase()];
  if (override) return override;

  if (url) {
    try {
      var hostname = new URL(url).hostname.toLowerCase();
      // Workday: ouryahoo.wd5.myworkdayjobs.com → yahoo.com
      var wdMatch = hostname.match(/^(?:our)?([a-z]+)\.wd\d+\.myworkdayjobs\.com/);
      if (wdMatch) return wdMatch[1] + '.com';
      // Greenhouse: boards.greenhouse.io/stripe → stripe.com
      if (hostname.includes('greenhouse.io')) {
        var ghMatch = url.match(/greenhouse\.io\/([a-z0-9]+)/i);
        if (ghMatch) return ghMatch[1] + '.com';
      }
      // Lever: jobs.lever.co/stripe → stripe.com
      if (hostname.includes('lever.co')) {
        var lvMatch = url.match(/lever\.co\/([a-z0-9]+)/i);
        if (lvMatch) return lvMatch[1] + '.com';
      }
      // Ashby: jobs.ashbyhq.com/stripe → stripe.com
      if (hostname.includes('ashbyhq.com')) {
        var abMatch = url.match(/ashbyhq\.com\/([a-z0-9]+)/i);
        if (abMatch) return abMatch[1] + '.com';
      }
      // LinkedIn: linkedin.com/company/stripe → stripe.com
      // Job URLs (/jobs/view/...) don't contain company info — skip to name fallback
      if (hostname.includes('linkedin.com')) {
        var liMatch = url.match(/company\/([a-z0-9-]+)/i);
        if (liMatch) return liMatch[1].replace(/-/g, '') + '.com';
      }
      // Direct company site (e.g., stripe.com/jobs → stripe.com)
      if (!hostname.includes('workday') && !hostname.includes('greenhouse') &&
          !hostname.includes('lever') && !hostname.includes('ashby') &&
          !hostname.includes('linkedin.com')) {
        return hostname.replace(/^www\./, '');
      }
    } catch (e) { /* invalid URL, fall through */ }
  }

  // Fallback: derive from company name (strip non-alphanumeric, add .com)
  return (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
}

/** Backward-compat alias — some older code calls guessDomain() */
function guessDomain(companyName) {
  return getCompanyDomain(companyName);
}

/* ====== LOGO URL ====== */

/**
 * Returns the Google Favicon URL for a company.
 * INPUT: companyName (string), optional url (string)
 * OUTPUT: URL string for a 128px favicon
 */
function getCompanyLogoUrl(companyName, url) {
  var domain = getCompanyDomain(companyName, url || '');
  return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=128';
}

/* ====== COLOR PALETTE ====== */

/**
 * Generates a consistent color for a company's letter-initial avatar.
 * Uses a hash of the company name to pick from a curated 16-color palette.
 * INPUT: company name string
 * OUTPUT: hex color string (e.g., "#6366f1")
 */
function getCompanyColor(name) {
  var PALETTE = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',  // purples
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',  // pinks/reds/orange
    '#eab308', '#84cc16', '#22c55e', '#14b8a6',  // greens
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',  // blues
  ];
  var hash = 0;
  for (var i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/* ====== ERROR FALLBACK ====== */

/**
 * Two-stage logo fallback when Google Favicon fails to load.
 * Stage 1: Try DuckDuckGo Icons (better coverage for some companies).
 * Stage 2: Replace <img> with a colored letter-initial circle.
 *
 * Called from onerror on logo <img> tags.
 * INPUT: img element, company name string, CSS class string
 */
function handleLogoError(img, companyName, cssClass) {
  var domain = getCompanyDomain(companyName, '');
  var ddgUrl = 'https://icons.duckduckgo.com/ip3/' + domain + '.ico';

  // Stage 1: try DuckDuckGo icons
  if (!img.dataset.triedDdg) {
    img.dataset.triedDdg = 'true';
    img.src = ddgUrl;
    return;
  }

  // Stage 2: both APIs failed — show letter avatar
  var letter = (companyName || '?').charAt(0).toUpperCase();
  var color = getCompanyColor(companyName);
  var span = document.createElement('span');
  span.className = (cssClass || '') + ' card-logo-fallback';
  span.style.background = color;
  span.textContent = letter;
  img.replaceWith(span);
}

/* ====== HTML GENERATORS ====== */

/**
 * Returns full HTML for a company logo <img> with onerror fallback.
 * Use this in template literals when building card/row/detail HTML.
 *
 * INPUT: companyName (string), cssClass (string), optional url (string)
 * OUTPUT: HTML string — <img> tag with onerror="handleLogoError(...)"
 */
function companyLogoHtml(companyName, cssClass, url) {
  var domain = getCompanyDomain(companyName, url || '');
  var logoUrl = 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=128';
  var safeName = (companyName || '').replace(/'/g, "\\'");
  return '<img src="' + logoUrl + '" alt="' + (companyName || '') + '" class="' + (cssClass || '') + '"'
    + " onerror=\"handleLogoError(this,'" + safeName + "','" + (cssClass || '') + "');\">";
}
