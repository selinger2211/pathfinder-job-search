#!/usr/bin/env python3
"""
============================================================
PATHFINDER DATA MIGRATION — Contact-Outreach.xlsx → localStorage JSON
Version: 1.0 | March 2026
============================================================

PURPOSE
Converts the Contact-Outreach.xlsx spreadsheet (Sheet4) into JSON files
that Pathfinder modules can load into localStorage. This is a one-time
migration to bootstrap real data into the app.

INPUT
  docs/Contact-Outreach.xlsx  (Sheet4: scored contacts with outreach status)

OUTPUT (written to scripts/migration-output/)
  pf_connections.json    — contacts for Outreach Generator module
  pf_companies.json      — unique companies for cross-module use
  migration-summary.json — stats and validation report

HOW TO USE
  1. Run: python3 scripts/migrate-contacts.py
  2. Open Pathfinder in browser
  3. Open browser console (Cmd+Option+J)
  4. Paste the loader snippet printed at the end

SCHEMA MAPPING
  Spreadsheet Column        → Pathfinder Field
  ─────────────────────────────────────────────
  Name                      → connection.name
  URL                       → connection.linkedinUrl
  Conn                      → connection.connectionDegree
  Title                     → connection.title
  Company                   → connection.company
  Seniority                 → connection.seniority
  AI/ML Relevance           → connection.scores.aiRelevance
  Hiring Influence          → connection.scores.hiringInfluence
  Warmth                    → connection.scores.warmth
  Strategic Leverage         → connection.scores.strategicLeverage
  Response Likelihood       → connection.scores.responseLikelihood
  Total                     → connection.totalScore
  Tier                      → connection.tier
  Notes                     → connection.notes
  Outreach Status           → connection.outreachStatus + lastOutreachDate
============================================================
"""

import pandas as pd
import json
import re
import os
from datetime import datetime

# ── Paths ──────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
INPUT_FILE = os.path.join(PROJECT_DIR, 'docs', 'Contact-Outreach.xlsx')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'migration-output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Read spreadsheet ───────────────────────────────────────
df = pd.read_excel(INPUT_FILE, sheet_name='Sheet4')

# ── Outreach status parser ─────────────────────────────────
def parse_outreach_status(raw):
    """
    Parse the free-text outreach status column into a structured format.

    Examples:
      "LinkedIn Message on 3-2-26"  → { status: 'sent', channel: 'linkedin', date: '2026-03-02' }
      "Meeting scheduled for 3/4/2026" → { status: 'meeting', channel: 'meeting', date: '2026-03-04' }
      datetime(2026, 2, 19) → { status: 'sent', channel: 'unknown', date: '2026-02-19' }
      NaN → { status: 'not-started', channel: null, date: null }
    """
    if pd.isna(raw):
        return {'status': 'not-started', 'channel': None, 'date': None}

    # Handle datetime objects (some cells are raw dates)
    if isinstance(raw, datetime):
        return {'status': 'sent', 'channel': 'unknown', 'date': raw.strftime('%Y-%m-%d')}

    text = str(raw).strip().lower()

    # Determine channel
    channel = 'unknown'
    if 'linkedin' in text:
        channel = 'linkedin'
    elif 'email' in text:
        channel = 'email'
    elif 'meeting' in text or 'call' in text:
        channel = 'meeting'

    # Determine status
    status = 'sent'
    if 'meeting' in text or 'scheduled' in text or 'call' in text:
        status = 'meeting'
    elif 'replied' in text or 'response' in text:
        status = 'replied'
    elif 'message' in text or 'sent' in text:
        status = 'sent'

    # Extract date (multiple formats: 3-2-26, 3/4/2026, etc.)
    date_str = None
    # Try M/D/YYYY or M-D-YYYY
    m = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', text)
    if m:
        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year += 2000
        date_str = f'{year:04d}-{month:02d}-{day:02d}'

    return {'status': status, 'channel': channel, 'date': date_str}


# ── Tier normalizer ────────────────────────────────────────
def normalize_tier(tier_str):
    """Map spreadsheet tiers to Pathfinder tier values."""
    mapping = {
        'A+': 'hot',
        'A':  'hot',
        'B':  'active',
        'C':  'passive'
    }
    return mapping.get(str(tier_str).strip(), 'passive')


# ── Relationship type inferrer ─────────────────────────────
def infer_relationship_type(title, seniority):
    """
    Guess the relationship type based on the contact's title and seniority.
    This helps the Outreach module generate appropriate message templates.
    """
    t = str(title).lower() if pd.notna(title) else ''
    s = str(seniority).lower() if pd.notna(seniority) else ''

    if any(k in t for k in ['recruiter', 'talent', 'hiring']):
        return 'recruiter'
    if any(k in s for k in ['c-level', 'ceo', 'cto', 'cpo', 'founder', 'board']):
        return 'executive'
    if any(k in s for k in ['vp', 'svp', 'evp', 'exec', 'gm']):
        return 'hiring-manager'
    if any(k in s for k in ['director', 'sr director', 'head']):
        return 'hiring-manager'
    if any(k in s for k in ['manager', 'sr manager', 'lead']):
        return 'peer'
    return 'peer'


# ── Build connections JSON ─────────────────────────────────
connections = []
companies_set = {}

for idx, row in df.iterrows():
    if pd.isna(row.get('Name')):
        continue

    company_name = str(row.get('Company', '')).strip()
    if company_name in ('', 'nan', '—'):
        company_name = 'Unknown'

    # Build company entry if new
    company_key = company_name.lower().replace(' ', '-').replace('.', '')
    if company_key not in companies_set and company_name != 'Unknown':
        # Derive a reasonable domain from the company name
        domain_name = company_name.lower().replace(' ', '').replace('.', '') + '.com'
        # Special-case well-known domains
        domain_overrides = {
            'Amazon': 'amazon.com', 'Amazon Ads': 'amazon.com', 'Apple': 'apple.com',
            'Google': 'google.com', 'Meta': 'meta.com', 'Yahoo': 'yahoo.com',
            'eBay': 'ebay.com', 'Stripe': 'stripe.com', 'Notion': 'notion.so',
            'Square': 'squareup.com', 'Roku': 'roku.com', 'Yelp': 'yelp.com',
            'Indeed': 'indeed.com', 'Okta': 'okta.com', 'Twilio': 'twilio.com',
            'Atlassian': 'atlassian.com', 'Workday': 'workday.com',
            'Best Buy': 'bestbuy.com', 'Calendly': 'calendly.com',
            'Informatica': 'informatica.com', 'Coupang': 'coupang.com',
        }
        domain = domain_overrides.get(company_name, domain_name)

        companies_set[company_key] = {
            'name': company_name,
            'domain': domain,
            'tier': 'active',
            'missionStatement': '',
            'logoUrl': f'https://logo.clearbit.com/{domain}',
            'contactCount': 0
        }
    if company_key in companies_set:
        companies_set[company_key]['contactCount'] += 1

    # Parse outreach status
    outreach = parse_outreach_status(row.get('Outreach Status'))

    # Build connection object
    conn = {
        'id': f'conn-{idx + 1:03d}',
        'name': str(row['Name']).strip(),
        'linkedinUrl': str(row.get('URL', '')).strip(),
        'connectionDegree': str(row.get('Conn', '1st')).strip(),
        'title': str(row.get('Title', '')).strip() if pd.notna(row.get('Title')) else '',
        'company': company_name,
        'seniority': str(row.get('Seniority', '')).strip() if pd.notna(row.get('Seniority')) else '',
        'relationshipType': infer_relationship_type(row.get('Title'), row.get('Seniority')),
        'scores': {
            'aiRelevance': float(row.get('AI/ML Relevance', 0)) if pd.notna(row.get('AI/ML Relevance')) else 0,
            'hiringInfluence': float(row.get('Hiring Influence', 0)) if pd.notna(row.get('Hiring Influence')) else 0,
            'warmth': float(row.get('Warmth', 0)) if pd.notna(row.get('Warmth')) else 0,
            'strategicLeverage': float(row.get('Strategic Leverage', 0)) if pd.notna(row.get('Strategic Leverage')) else 0,
            'responseLikelihood': float(row.get('Response Likelihood', 0)) if pd.notna(row.get('Response Likelihood')) else 0
        },
        'totalScore': float(row.get('Total', 0)) if pd.notna(row.get('Total')) else 0,
        'tier': normalize_tier(row.get('Tier')) if pd.notna(row.get('Tier')) else 'passive',
        'tierLabel': str(row.get('Tier', '')).strip() if pd.notna(row.get('Tier')) else '',
        'notes': str(row.get('Notes', '')).strip() if pd.notna(row.get('Notes')) else '',
        'outreachStatus': outreach['status'],
        'outreachChannel': outreach['channel'],
        'lastOutreachDate': outreach['date'],
        'dateConnected': None,
        'lastContact': outreach['date']
    }

    connections.append(conn)

# Sort by total score descending (highest-value contacts first)
connections.sort(key=lambda c: c['totalScore'], reverse=True)

# ── Write output files ─────────────────────────────────────
with open(os.path.join(OUTPUT_DIR, 'pf_connections.json'), 'w') as f:
    json.dump(connections, f, indent=2)

# Convert companies dict to array (Outreach module expects an array)
companies_list = list(companies_set.values())
companies_list.sort(key=lambda c: c['contactCount'], reverse=True)

with open(os.path.join(OUTPUT_DIR, 'pf_companies.json'), 'w') as f:
    json.dump(companies_list, f, indent=2)

# ── Migration summary ──────────────────────────────────────
tier_counts = {}
status_counts = {}
for c in connections:
    tier_counts[c['tierLabel'] or 'Untiered'] = tier_counts.get(c['tierLabel'] or 'Untiered', 0) + 1
    status_counts[c['outreachStatus']] = status_counts.get(c['outreachStatus'], 0) + 1

summary = {
    'migrationDate': datetime.now().isoformat(),
    'source': 'Contact-Outreach.xlsx (Sheet4)',
    'totalContacts': len(connections),
    'totalCompanies': len(companies_list),
    'tierBreakdown': tier_counts,
    'outreachStatusBreakdown': status_counts,
    'scoreRange': {
        'min': min(c['totalScore'] for c in connections) if connections else 0,
        'max': max(c['totalScore'] for c in connections) if connections else 0,
        'avg': round(sum(c['totalScore'] for c in connections) / len(connections), 1) if connections else 0
    }
}

with open(os.path.join(OUTPUT_DIR, 'migration-summary.json'), 'w') as f:
    json.dump(summary, f, indent=2)

# ── Print results ──────────────────────────────────────────
print("=" * 60)
print("PATHFINDER DATA MIGRATION — COMPLETE")
print("=" * 60)
print(f"Contacts migrated:  {summary['totalContacts']}")
print(f"Companies found:    {summary['totalCompanies']}")
print(f"Score range:        {summary['scoreRange']['min']} – {summary['scoreRange']['max']} (avg {summary['scoreRange']['avg']})")
print()
print("Tier breakdown:")
for tier, count in sorted(tier_counts.items()):
    print(f"  {tier:>10}: {count}")
print()
print("Outreach status:")
for status, count in sorted(status_counts.items()):
    print(f"  {status:>12}: {count}")
print()
print(f"Output written to: {OUTPUT_DIR}/")
print(f"  - pf_connections.json  ({len(connections)} contacts)")
print(f"  - pf_companies.json    ({len(companies_list)} companies)")
print(f"  - migration-summary.json")
print()
print("=" * 60)
print("TO LOAD INTO PATHFINDER:")
print("=" * 60)
print("Open your browser console on localhost:8080 and paste:\n")

# Generate compact loader snippet
loader = f"""fetch('/scripts/migration-output/pf_connections.json').then(r=>r.json()).then(d=>{{localStorage.setItem('pf_connections',JSON.stringify(d));console.log('Loaded '+d.length+' connections')}});fetch('/scripts/migration-output/pf_companies.json').then(r=>r.json()).then(d=>{{localStorage.setItem('pf_companies',JSON.stringify(d));console.log('Loaded '+d.length+' companies')}});"""

print(loader)
print()
