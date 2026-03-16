/* ====================================================================
 * UNIT TESTS — logos.js (Shared Logo System)
 * ====================================================================
 * Tests all 7 public functions + the DOMAIN_OVERRIDES constant.
 * logos.js now has a CommonJS export block at the bottom that activates
 * in Node/Jest (harmless in browser where module is undefined).
 *
 * Run: npm test -- --testPathPatterns=logos
 * Coverage: npm test -- --coverage --testPathPatterns=logos
 * ==================================================================== */

const path = require('path');

/* logos.js has a CommonJS export block at the bottom that activates
 * when running in Node/Jest (harmless in browser). This lets Jest
 * instrument the source for coverage reporting. */
const {
  DOMAIN_OVERRIDES,
  getCompanyDomain,
  guessDomain,
  getCompanyLogoUrl,
  getCompanyColor,
  handleLogoError,
  companyLogoHtml,
} = require(path.join(__dirname, '..', 'logos.js'));

/* ====== DOMAIN_OVERRIDES ====== */
describe('DOMAIN_OVERRIDES', () => {
  test('is a non-empty object', () => {
    expect(typeof DOMAIN_OVERRIDES).toBe('object');
    expect(Object.keys(DOMAIN_OVERRIDES).length).toBeGreaterThan(10);
  });

  test('all keys are lowercase', () => {
    Object.keys(DOMAIN_OVERRIDES).forEach(key => {
      expect(key).toBe(key.toLowerCase());
    });
  });

  test('all values are valid domain strings', () => {
    Object.values(DOMAIN_OVERRIDES).forEach(domain => {
      expect(domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
    });
  });

  test('contains known critical overrides', () => {
    expect(DOMAIN_OVERRIDES['amazon ads']).toBe('amazon.com');
    expect(DOMAIN_OVERRIDES['notion']).toBe('notion.so');
    expect(DOMAIN_OVERRIDES['meta']).toBe('meta.com');
    expect(DOMAIN_OVERRIDES['google']).toBe('google.com');
    expect(DOMAIN_OVERRIDES['uber']).toBe('uber.com');
  });
});

/* ====== getCompanyDomain() ====== */
describe('getCompanyDomain', () => {
  /* Domain overrides take priority */
  test('returns override for known companies (case-insensitive)', () => {
    expect(getCompanyDomain('Amazon Ads')).toBe('amazon.com');
    expect(getCompanyDomain('Notion')).toBe('notion.so');
    expect(getCompanyDomain('GOOGLE')).toBe('google.com');
    expect(getCompanyDomain('meta')).toBe('meta.com');
  });

  /* Workday ATS URLs */
  test('extracts domain from Workday URLs', () => {
    expect(getCompanyDomain('Yahoo', 'https://ouryahoo.wd5.myworkdayjobs.com/jobs/123'))
      .toBe('yahoo.com');
    expect(getCompanyDomain('Uber', 'https://uber.wd5.myworkdayjobs.com/something'))
      .toBe('uber.com');
  });

  /* Greenhouse ATS URLs */
  test('extracts domain from Greenhouse URLs', () => {
    expect(getCompanyDomain('Stripe', 'https://boards.greenhouse.io/stripe/jobs/12345'))
      .toBe('stripe.com');
    expect(getCompanyDomain('Notion', 'https://boards.greenhouse.io/notion/jobs/99'))
      .toBe('notion.so'); // Override takes priority over URL extraction
  });

  /* Lever ATS URLs */
  test('extracts domain from Lever URLs', () => {
    expect(getCompanyDomain('SomeCo', 'https://jobs.lever.co/someco/abc-123'))
      .toBe('someco.com');
  });

  /* Ashby ATS URLs */
  test('extracts domain from Ashby URLs', () => {
    expect(getCompanyDomain('TechCo', 'https://jobs.ashbyhq.com/techco/xyz'))
      .toBe('techco.com');
  });

  /* LinkedIn company URLs */
  test('extracts domain from LinkedIn company URLs', () => {
    expect(getCompanyDomain('Unknown', 'https://www.linkedin.com/company/acme-corp'))
      .toBe('acmecorp.com');
  });

  /* LinkedIn job URLs (no company info — should fall through) */
  test('falls back to name for LinkedIn job URLs', () => {
    expect(getCompanyDomain('Acme Corp', 'https://www.linkedin.com/jobs/view/12345'))
      .toBe('acmecorp.com'); // Falls to name-based
  });

  /* Direct company site */
  test('extracts domain from direct company sites', () => {
    expect(getCompanyDomain('Test', 'https://www.stripe.com/jobs/engineer'))
      .toBe('stripe.com');
    expect(getCompanyDomain('Test', 'https://careers.intuit.com/role/123'))
      .toBe('careers.intuit.com');
  });

  /* Name-based fallback */
  test('derives domain from company name when no URL', () => {
    expect(getCompanyDomain('Stripe')).toBe('stripe.com');
    expect(getCompanyDomain('My Cool Company')).toBe('mycoolcompany.com');
    expect(getCompanyDomain('AI-Powered Corp.')).toBe('aipoweredcorp.com');
  });

  /* Edge cases */
  test('handles null/undefined/empty inputs gracefully', () => {
    expect(getCompanyDomain(null)).toBe('.com');
    expect(getCompanyDomain(undefined)).toBe('.com');
    expect(getCompanyDomain('')).toBe('.com');
    expect(getCompanyDomain('Test', '')).toBe('test.com');
  });

  test('handles invalid URLs without throwing', () => {
    expect(getCompanyDomain('Test', 'not-a-url')).toBe('test.com');
    expect(getCompanyDomain('Test', '://broken')).toBe('test.com');
  });
});

/* ====== guessDomain() ====== */
describe('guessDomain', () => {
  test('is an alias for getCompanyDomain without URL', () => {
    expect(guessDomain('Stripe')).toBe(getCompanyDomain('Stripe'));
    expect(guessDomain('Amazon Ads')).toBe(getCompanyDomain('Amazon Ads'));
    expect(guessDomain('Unknown Corp')).toBe(getCompanyDomain('Unknown Corp'));
  });

  test('handles edge cases', () => {
    expect(guessDomain(null)).toBe('.com');
    expect(guessDomain('')).toBe('.com');
  });
});

/* ====== getCompanyLogoUrl() ====== */
describe('getCompanyLogoUrl', () => {
  test('returns Google Favicon URL with correct domain', () => {
    const url = getCompanyLogoUrl('Stripe');
    expect(url).toBe('https://www.google.com/s2/favicons?domain=stripe.com&sz=128');
  });

  test('uses URL parameter for ATS domain resolution', () => {
    const url = getCompanyLogoUrl('Test', 'https://boards.greenhouse.io/coolco/jobs/123');
    expect(url).toBe('https://www.google.com/s2/favicons?domain=coolco.com&sz=128');
  });

  test('uses domain override when available', () => {
    const url = getCompanyLogoUrl('Notion');
    expect(url).toBe('https://www.google.com/s2/favicons?domain=notion.so&sz=128');
  });

  test('handles empty inputs', () => {
    const url = getCompanyLogoUrl('');
    expect(url).toContain('https://www.google.com/s2/favicons');
  });
});

/* ====== getCompanyColor() ====== */
describe('getCompanyColor', () => {
  test('returns a valid hex color string', () => {
    const color = getCompanyColor('Stripe');
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('is deterministic — same name always returns same color', () => {
    const c1 = getCompanyColor('Acme Corp');
    const c2 = getCompanyColor('Acme Corp');
    expect(c1).toBe(c2);
  });

  test('produces different colors for different names', () => {
    const colors = new Set([
      getCompanyColor('Apple'),
      getCompanyColor('Google'),
      getCompanyColor('Microsoft'),
      getCompanyColor('Amazon'),
      getCompanyColor('Netflix'),
    ]);
    /* With 5 diverse names and a 16-color palette, at least 3 should be unique */
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  test('handles null/undefined/empty gracefully', () => {
    expect(getCompanyColor(null)).toMatch(/^#[0-9a-f]{6}$/);
    expect(getCompanyColor(undefined)).toMatch(/^#[0-9a-f]{6}$/);
    expect(getCompanyColor('')).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('returns a color from the curated palette', () => {
    const PALETTE = [
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
      '#ec4899', '#f43f5e', '#ef4444', '#f97316',
      '#eab308', '#84cc16', '#22c55e', '#14b8a6',
      '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    ];
    expect(PALETTE).toContain(getCompanyColor('Test Corp'));
    expect(PALETTE).toContain(getCompanyColor('Stripe'));
    expect(PALETTE).toContain(getCompanyColor('OpenAI'));
  });
});

/* ====== handleLogoError() ====== */
describe('handleLogoError', () => {
  test('stage 1: switches to DuckDuckGo icon on first error', () => {
    const img = document.createElement('img');
    img.src = 'https://google.com/favicon/stripe.com';

    handleLogoError(img, 'Stripe', 'logo-class');

    expect(img.src).toContain('icons.duckduckgo.com');
    expect(img.src).toContain('stripe.com');
    expect(img.dataset.triedDdg).toBe('true');
  });

  test('stage 2: replaces img with letter avatar on second error', () => {
    const img = document.createElement('img');
    img.dataset.triedDdg = 'true'; // Already tried DDG
    const parent = document.createElement('div');
    parent.appendChild(img);

    handleLogoError(img, 'Stripe', 'card-logo');

    /* img should be replaced with a span */
    const span = parent.querySelector('span');
    expect(span).not.toBeNull();
    expect(span.textContent).toBe('S');
    expect(span.className).toContain('card-logo');
    expect(span.className).toContain('card-logo-fallback');
    expect(span.style.background).toBeTruthy();
  });

  test('uses correct letter initial (uppercase)', () => {
    const img = document.createElement('img');
    img.dataset.triedDdg = 'true';
    const parent = document.createElement('div');
    parent.appendChild(img);

    handleLogoError(img, 'apple', 'cls');

    const span = parent.querySelector('span');
    expect(span.textContent).toBe('A');
  });

  test('handles null company name', () => {
    const img = document.createElement('img');
    img.dataset.triedDdg = 'true';
    const parent = document.createElement('div');
    parent.appendChild(img);

    handleLogoError(img, null, '');

    const span = parent.querySelector('span');
    expect(span.textContent).toBe('?');
  });

  test('uses getCompanyColor for avatar background', () => {
    const img = document.createElement('img');
    img.dataset.triedDdg = 'true';
    const parent = document.createElement('div');
    parent.appendChild(img);

    handleLogoError(img, 'Netflix', 'cls');

    const span = parent.querySelector('span');
    /* DOM style.background converts hex to rgb(), so just verify it's set */
    expect(span.style.background).toBeTruthy();
  });
});

/* ====== companyLogoHtml() ====== */
describe('companyLogoHtml', () => {
  test('returns an img tag string', () => {
    const html = companyLogoHtml('Stripe', 'logo');
    expect(html).toContain('<img');
    expect(html).not.toContain('</img>'); // self-closing tag
    expect(html).toContain('src="');
    expect(html).toContain('onerror="');
  });

  test('includes Google Favicon URL with correct domain', () => {
    const html = companyLogoHtml('Stripe', 'logo');
    expect(html).toContain('google.com/s2/favicons');
    expect(html).toContain('stripe.com');
  });

  test('includes correct CSS class', () => {
    const html = companyLogoHtml('Test', 'my-class');
    expect(html).toContain('class="my-class"');
  });

  test('includes alt text with company name', () => {
    const html = companyLogoHtml('Acme Corp', 'logo');
    expect(html).toContain('alt="Acme Corp"');
  });

  test('includes handleLogoError onerror with escaped name', () => {
    const html = companyLogoHtml("O'Reilly Media", 'logo');
    expect(html).toContain('handleLogoError');
    expect(html).toContain("O\\'Reilly Media"); // escaped single quote
  });

  test('uses URL for domain resolution when provided', () => {
    const html = companyLogoHtml('TestCo', 'logo', 'https://boards.greenhouse.io/coolstartup/jobs/1');
    expect(html).toContain('coolstartup.com');
  });

  test('handles empty inputs gracefully', () => {
    const html = companyLogoHtml('', '');
    expect(html).toContain('<img');
    expect(html).toContain('google.com/s2/favicons');
  });
});
