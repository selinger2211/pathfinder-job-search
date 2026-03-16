/* ====================================================================
 * UNIT TESTS — text-utils.js (Text Processing Utilities)
 * ====================================================================
 * Tests HTML stripping, JD validation, ATS detection, LinkedIn JD
 * extraction, text-based salary/location/keyword extraction, and
 * match confidence scoring.
 *
 * Run: npm test -- --testPathPatterns=text-utils
 * Coverage: npm test -- --coverage --testPathPatterns=text-utils
 * ==================================================================== */

const {
  MIN_FULL_JD_LENGTH,
  stripHtmlTags,
  sanitizeHtml,
  isStubJD,
  detectAtsType,
  extractLinkedInJD,
  extractSalaryFromText,
  extractLocationFromText,
  extractKeywordsFromJD,
  matchConfidence,
} = require('../text-utils');

/* ====== MIN_FULL_JD_LENGTH ====== */
describe('MIN_FULL_JD_LENGTH', () => {
  test('is 300 characters', () => {
    expect(MIN_FULL_JD_LENGTH).toBe(300);
  });
});

/* ====== stripHtmlTags ====== */
describe('stripHtmlTags', () => {
  test('strips basic HTML tags', () => {
    expect(stripHtmlTags('<p>Hello</p>')).toBe('Hello');
  });

  test('converts <br> to newlines', () => {
    expect(stripHtmlTags('Line 1<br>Line 2')).toBe('Line 1\nLine 2');
    expect(stripHtmlTags('Line 1<br/>Line 2')).toBe('Line 1\nLine 2');
    expect(stripHtmlTags('Line 1<br />Line 2')).toBe('Line 1\nLine 2');
  });

  test('converts </p> to double newlines', () => {
    expect(stripHtmlTags('<p>Para 1</p><p>Para 2</p>')).toContain('\n\n');
  });

  test('converts <li> to bullet points', () => {
    const result = stripHtmlTags('<ul><li>Item 1</li><li>Item 2</li></ul>');
    expect(result).toContain('• Item 1');
    expect(result).toContain('• Item 2');
  });

  test('converts heading close tags to double newlines', () => {
    const result = stripHtmlTags('<h2>Title</h2>Content');
    expect(result).toContain('Title\n\nContent');
  });

  test('decodes &nbsp; to space', () => {
    expect(stripHtmlTags('Hello&nbsp;World')).toBe('Hello World');
  });

  test('decodes &amp; to &', () => {
    expect(stripHtmlTags('R&amp;D')).toBe('R&D');
  });

  test('decodes &lt; and &gt;', () => {
    expect(stripHtmlTags('3 &lt; 5 &gt; 2')).toBe('3 < 5 > 2');
  });

  test('decodes &quot; and &#39;', () => {
    expect(stripHtmlTags('&quot;quoted&quot; and it&#39;s')).toBe('"quoted" and it\'s');
  });

  test('collapses triple+ newlines to double', () => {
    expect(stripHtmlTags('A<br><br><br><br>B')).toBe('A\n\nB');
  });

  test('trims whitespace', () => {
    expect(stripHtmlTags('  <p>Hello</p>  ')).toBe('Hello');
  });

  test('handles complex nested HTML', () => {
    const html = '<div class="job-desc"><h3>About the Role</h3><p>We are looking for a <strong>Senior PM</strong> to join our team.</p><ul><li>Lead strategy</li><li>Own the roadmap</li></ul></div>';
    const result = stripHtmlTags(html);
    expect(result).toContain('About the Role');
    expect(result).toContain('Senior PM');
    expect(result).toContain('• Lead strategy');
    expect(result).toContain('• Own the roadmap');
    expect(result).not.toContain('<');
  });
});

/* ====== sanitizeHtml ====== */
describe('sanitizeHtml', () => {
  test('strips all tags', () => {
    expect(sanitizeHtml('<p>Hello</p>')).toBe('Hello');
  });

  test('removes script tags and content', () => {
    expect(sanitizeHtml('Before<script>alert("xss")</script>After')).toBe('BeforeAfter');
  });

  test('removes style tags and content', () => {
    expect(sanitizeHtml('Before<style>.red{color:red}</style>After')).toBe('BeforeAfter');
  });

  test('decodes HTML entities', () => {
    expect(sanitizeHtml('&amp; &lt; &gt; &quot; &#39;')).toBe('& < > " \'');
  });

  test('returns empty string for null/undefined', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });
});

/* ====== isStubJD ====== */
describe('isStubJD', () => {
  test('returns true for empty JD', () => {
    expect(isStubJD({ jd: '' })).toBe(true);
    expect(isStubJD({})).toBe(true);
  });

  test('returns true for short JD (under 300 chars)', () => {
    expect(isStubJD({ jd: 'A short job description' })).toBe(true);
    expect(isStubJD({ jd: 'x'.repeat(299) })).toBe(true);
  });

  test('returns false for long real JD', () => {
    const realJD = 'We are looking for a Senior Product Manager to lead our payments team. ' +
      'You will own the strategy and roadmap for our core payments infrastructure. ' +
      'Requirements include 5+ years of PM experience, strong technical background. ' +
      'You will work cross-functionally with engineering, design, and data science teams ' +
      'to ship products that delight our customers. Experience with fintech preferred.';
    expect(isStubJD({ jd: realJD })).toBe(false);
  });

  test('detects "posted via job alert" stub pattern', () => {
    const stub = 'x'.repeat(400) + ' posted via LinkedIn job alert';
    expect(isStubJD({ jd: stub })).toBe(true);
  });

  test('detects "application submitted" stub pattern', () => {
    const stub = 'x'.repeat(400) + ' Application submitted successfully';
    expect(isStubJD({ jd: stub })).toBe(true);
  });

  test('detects "interview scheduled" stub pattern', () => {
    const stub = 'x'.repeat(400) + ' Interview scheduled for next week';
    expect(isStubJD({ jd: stub })).toBe(true);
  });

  test('detects "you\'ve been referred" stub pattern', () => {
    const stub = 'x'.repeat(400) + " You've been referred to this position";
    expect(isStubJD({ jd: stub })).toBe(true);
  });

  test('detects "new job matches" stub pattern', () => {
    const stub = 'x'.repeat(400) + ' New PM job matches your profile';
    expect(isStubJD({ jd: stub })).toBe(true);
  });
});

/* ====== detectAtsType ====== */
describe('detectAtsType', () => {
  test('detects Greenhouse from URL', () => {
    expect(detectAtsType('https://boards.greenhouse.io/acme/jobs/12345')).toBe('greenhouse');
    expect(detectAtsType('https://job-boards.greenhouse.io/acme/jobs/12345')).toBe('greenhouse');
  });

  test('detects Lever from URL', () => {
    expect(detectAtsType('https://jobs.lever.co/acme/abc-123')).toBe('lever');
  });

  test('detects Ashby from URL', () => {
    expect(detectAtsType('https://jobs.ashby.com/acme')).toBe('ashby');
  });

  test('returns generic for LinkedIn', () => {
    expect(detectAtsType('https://www.linkedin.com/jobs/view/12345')).toBe('generic');
  });

  test('returns generic for null/undefined', () => {
    expect(detectAtsType(null)).toBe('generic');
    expect(detectAtsType(undefined)).toBe('generic');
  });
});

/* ====== extractLinkedInJD ====== */
describe('extractLinkedInJD', () => {
  test('returns null for null/empty input', () => {
    expect(extractLinkedInJD(null)).toBeNull();
    expect(extractLinkedInJD('')).toBeNull();
  });

  test('extracts JD from JSON-LD structured data', () => {
    const html = `
      <html>
      <script type="application/ld+json">
        {"@type": "JobPosting", "title": "Senior PM", "description": "<p>Lead our product team.</p>",
         "hiringOrganization": {"name": "Acme Corp"}}
      </script>
      </html>
    `;
    const result = extractLinkedInJD(html);
    expect(result).not.toBeNull();
    expect(result.description).toContain('Lead our product team');
    expect(result.title).toBe('Senior PM');
    expect(result.company).toBe('Acme Corp');
  });

  test('extracts salary from JSON-LD baseSalary', () => {
    const html = `
      <script type="application/ld+json">
        {"@type": "JobPosting", "title": "PM", "description": "Great role",
         "baseSalary": {"currency": "$", "value": {"minValue": 150000, "maxValue": 250000}}}
      </script>
    `;
    const result = extractLinkedInJD(html);
    expect(result.salary).toContain('150000');
    expect(result.salary).toContain('250000');
  });

  test('handles JSON-LD array format', () => {
    const html = `
      <script type="application/ld+json">
        [{"@type": "Organization"}, {"@type": "JobPosting", "title": "PM", "description": "A great PM role with lots of detail here."}]
      </script>
    `;
    const result = extractLinkedInJD(html);
    expect(result).not.toBeNull();
    expect(result.title).toBe('PM');
  });

  test('skips non-JobPosting JSON-LD', () => {
    const html = `
      <script type="application/ld+json">
        {"@type": "Organization", "name": "Acme"}
      </script>
    `;
    expect(extractLinkedInJD(html)).toBeNull();
  });

  test('falls back to show-more-less-html div', () => {
    const longDesc = 'A detailed job description about building products. '.repeat(5);
    const html = `
      <div class="show-more-less-html__markup">${longDesc}</div>
    `;
    const result = extractLinkedInJD(html);
    expect(result).not.toBeNull();
    expect(result.description).toContain('building products');
    expect(result.title).toBeNull();
  });

  test('falls back to meta description', () => {
    const longDesc = 'A very detailed job posting that goes into great depth. '.repeat(10);
    const html = `<meta name="description" content="${longDesc}">`;
    const result = extractLinkedInJD(html);
    expect(result).not.toBeNull();
    expect(result.description).toContain('detailed job posting');
  });

  test('ignores short meta descriptions', () => {
    const html = '<meta name="description" content="Short desc">';
    expect(extractLinkedInJD(html)).toBeNull();
  });

  test('handles malformed JSON-LD gracefully', () => {
    const html = `
      <script type="application/ld+json">{INVALID JSON HERE}</script>
      <div class="show-more-less-html__markup">${'Great role description. '.repeat(10)}</div>
    `;
    const result = extractLinkedInJD(html);
    // Should fall through to strategy B
    expect(result).not.toBeNull();
    expect(result.description).toContain('Great role description');
  });
});

/* ====== extractSalaryFromText ====== */
describe('extractSalaryFromText', () => {
  test('returns null for null/empty input', () => {
    expect(extractSalaryFromText(null)).toBeNull();
    expect(extractSalaryFromText('')).toBeNull();
  });

  test('extracts "$150,000 - $250,000" format', () => {
    const result = extractSalaryFromText('The salary is $150,000 - $250,000 per year');
    expect(result).toContain('$150,000');
  });

  test('extracts "$150K-$250K" format', () => {
    const result = extractSalaryFromText('Comp range: $150K-$250K');
    expect(result).toContain('$150K');
  });

  test('returns null when no salary found', () => {
    expect(extractSalaryFromText('Great benefits and competitive pay')).toBeNull();
  });
});

/* ====== extractLocationFromText ====== */
describe('extractLocationFromText', () => {
  test('returns null for null/empty input', () => {
    expect(extractLocationFromText(null)).toBeNull();
    expect(extractLocationFromText('')).toBeNull();
  });

  test('extracts "Remote" location', () => {
    const result = extractLocationFromText('This is a remote position');
    expect(result.toLowerCase()).toContain('remote');
  });

  test('extracts major city names', () => {
    expect(extractLocationFromText('Based in San Francisco, CA')).toContain('San Francisco');
    expect(extractLocationFromText('Our New York office')).toContain('New York');
    expect(extractLocationFromText('Located in Seattle, WA')).toContain('Seattle');
  });

  test('extracts "City, ST" pattern', () => {
    const result = extractLocationFromText('Office in Denver, CO');
    expect(result).toContain('Denver');
  });

  test('returns null when no location found', () => {
    expect(extractLocationFromText('Great opportunity to grow')).toBeNull();
  });
});

/* ====== extractKeywordsFromJD ====== */
describe('extractKeywordsFromJD', () => {
  test('returns empty array for null/empty input', () => {
    expect(extractKeywordsFromJD(null)).toEqual([]);
    expect(extractKeywordsFromJD('')).toEqual([]);
  });

  test('extracts tech keywords', () => {
    const result = extractKeywordsFromJD('We use AI and machine learning for our SaaS platform');
    expect(result).toContain('ai');
    expect(result).toContain('machine learning');
    expect(result).toContain('saas');
    expect(result).toContain('platform');
  });

  test('extracts domain keywords', () => {
    const result = extractKeywordsFromJD('Building fintech payments and commerce solutions');
    expect(result).toContain('fintech');
    expect(result).toContain('payments');
    expect(result).toContain('commerce');
  });

  test('is case-insensitive', () => {
    const result = extractKeywordsFromJD('Enterprise B2B SaaS PLATFORM for AI analytics');
    expect(result).toContain('enterprise');
    expect(result).toContain('b2b');
    expect(result).toContain('saas');
    expect(result).toContain('ai');
    expect(result).toContain('analytics');
  });

  test('returns empty for text with no known keywords', () => {
    expect(extractKeywordsFromJD('We make widgets for general purposes')).toEqual([]);
  });
});

/* ====== matchConfidence ====== */
describe('matchConfidence', () => {
  test('returns 0 for null inputs', () => {
    expect(matchConfidence(null, null).score).toBe(0);
    expect(matchConfidence({}, null).score).toBe(0);
  });

  test('returns 100 for exact URL match', () => {
    const job = { url: 'https://example.com/job/123', title: 'PM', company: 'Acme' };
    const role = { url: 'https://example.com/job/123', title: 'PM', company: 'Acme' };
    const result = matchConfidence(job, role);
    expect(result.score).toBe(100);
    expect(result.reason).toBe('Exact URL match');
  });

  test('scores company + title match highly', () => {
    const job = { title: 'Senior Product Manager', company: 'Google' };
    const role = { title: 'Senior Product Manager', company: 'Google' };
    const result = matchConfidence(job, role);
    expect(result.score).toBe(80); // 40 (company) + 40 (title)
  });

  test('scores partial company match', () => {
    const job = { title: 'PM', company: 'Google LLC' };
    const role = { title: 'PM', company: 'Google' };
    const result = matchConfidence(job, role);
    expect(result.score).toBeGreaterThanOrEqual(65);
  });

  test('scores title word overlap', () => {
    const job = { title: 'Senior Product Manager, Payments', company: 'Acme' };
    const role = { title: 'Senior Product Manager', company: 'Acme' };
    const result = matchConfidence(job, role);
    expect(result.score).toBeGreaterThanOrEqual(55);
  });

  test('caps at 100', () => {
    const job = { url: 'http://x.com/1', title: 'PM', company: 'Google' };
    const role = { url: 'http://x.com/1', title: 'PM', company: 'Google' };
    expect(matchConfidence(job, role).score).toBeLessThanOrEqual(100);
  });

  test('returns descriptive reason', () => {
    const job = { title: 'PM', company: 'Acme' };
    const role = { title: 'PM', company: 'Acme' };
    const result = matchConfidence(job, role);
    expect(result.reason).toContain('Company match');
  });

  test('partial title overlap scores 15 points', () => {
    const job = { title: 'Senior Product Manager, Payments', company: 'Acme' };
    const role = { title: 'Product Manager, Analytics', company: 'Acme' };
    const result = matchConfidence(job, role);
    // Both have "Product" and "Manager" (2 overlaps / max(5,4) = 0.4 > 0.25)
    expect(result.score).toBeGreaterThanOrEqual(15);
  });

  test('partial title overlap is detected when word overlap ratio is between 0.25 and 0.5', () => {
    const job = { title: 'Senior Product Manager Engineering', company: 'TechCorp' };
    const role = { title: 'Product Manager', company: 'TechCorp' };
    const result = matchConfidence(job, role);
    // job words: senior, product, manager, engineering (4)
    // role words: product, manager (2)
    // overlap: product, manager (2 words both > 2 chars)
    // ratio: 2 / max(4, 2) = 2/4 = 0.5, which is NOT > 0.5, but is > 0.25
    expect(result.reason).toContain('Partial title overlap');
  });
});
