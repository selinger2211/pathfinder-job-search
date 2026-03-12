#!/usr/bin/env python3
"""
Parse LinkedIn Connections CSV → pf_linkedin_network.json

Reads the Connections.csv from a LinkedIn data export and produces a
clean JSON array of connection records. Each record has:
  - firstName, lastName, name (combined)
  - linkedinUrl
  - email (if available)
  - company (current company)
  - position (current title)
  - connectedOn (ISO date string)

The output is stored in scripts/migration-output/pf_linkedin_network.json
and can be loaded into localStorage by Pathfinder modules.

USAGE:
  python3 scripts/parse-linkedin-connections.py

INPUT:  scripts/linkedin-connections.csv
OUTPUT: scripts/migration-output/pf_linkedin_network.json
"""

import csv
import json
import os
from datetime import datetime

# Paths relative to project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
CSV_PATH = os.path.join(SCRIPT_DIR, 'linkedin-connections.csv')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'migration-output')
OUTPUT_PATH = os.path.join(OUTPUT_DIR, 'pf_linkedin_network.json')


def parse_date(date_str):
    """Convert LinkedIn date format ('08 Mar 2026') to ISO date string."""
    try:
        dt = datetime.strptime(date_str.strip(), '%d %b %Y')
        return dt.strftime('%Y-%m-%d')
    except (ValueError, AttributeError):
        return None


def normalize_company(company):
    """
    Normalize company names so lookups work consistently.
    LinkedIn data has variations like 'JPMorganChase' vs 'JPMorgan Chase & Co.'
    """
    if not company:
        return ''

    # Common normalizations (add more as needed)
    COMPANY_MAP = {
        'JPMorganChase': 'JPMorgan Chase',
        'JPMorgan Chase & Co.': 'JPMorgan Chase',
        'J.P. Morgan': 'JPMorgan Chase',
        'Amazon Web Services (AWS)': 'Amazon',
        'New Relic': 'New Relic',
        'Yahoo DSP': 'Yahoo',
        'Reddit, Inc.': 'Reddit',
        'Roku Inc.': 'Roku',
    }

    return COMPANY_MAP.get(company.strip(), company.strip())


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    connections = []
    skipped = 0

    with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
        # LinkedIn CSV has a notes header on line 1, skip it
        first_line = f.readline()
        if 'First Name' not in first_line:
            # The actual header is on line 3 (after the notes paragraph)
            for line in f:
                if line.startswith('First Name,'):
                    break
            reader = csv.DictReader(f, fieldnames=['First Name', 'Last Name', 'URL', 'Email Address', 'Company', 'Position', 'Connected On'])
        else:
            # Header was on the first line we read
            f.seek(0)
            # Re-skip the notes line
            f.readline()
            # Skip the blank line after notes
            next_line = f.readline().strip()
            if 'First Name' in next_line:
                reader = csv.DictReader(f, fieldnames=['First Name', 'Last Name', 'URL', 'Email Address', 'Company', 'Position', 'Connected On'])
            else:
                f.seek(0)
                f.readline()  # skip notes
                reader = csv.reader(f)
                # Find header row
                for row in reader:
                    if row and 'First Name' in row[0]:
                        break
                reader = csv.DictReader(f, fieldnames=['First Name', 'Last Name', 'URL', 'Email Address', 'Company', 'Position', 'Connected On'])

    # Simpler approach: just re-read and find the header
    with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()

    # Find the header line
    header_idx = None
    for i, line in enumerate(lines):
        if line.startswith('First Name,'):
            header_idx = i
            break

    if header_idx is None:
        print("ERROR: Could not find CSV header row")
        return

    # Parse from header onward
    import io
    csv_text = ''.join(lines[header_idx:])
    reader = csv.DictReader(io.StringIO(csv_text))

    for row in reader:
        first = (row.get('First Name') or '').strip()
        last = (row.get('Last Name') or '').strip()

        # Skip empty rows
        if not first and not last:
            skipped += 1
            continue

        name = f"{first} {last}".strip()
        company = normalize_company(row.get('Company', ''))
        position = (row.get('Position') or '').strip()
        url = (row.get('URL') or '').strip()
        email = (row.get('Email Address') or '').strip()
        connected_on = parse_date(row.get('Connected On', ''))

        connections.append({
            'firstName': first,
            'lastName': last,
            'name': name,
            'linkedinUrl': url,
            'email': email if email else None,
            'company': company,
            'position': position,
            'connectedOn': connected_on,
        })

    # Sort by company (for efficient lookup) then by name
    connections.sort(key=lambda c: (c['company'].lower(), c['name'].lower()))

    # Write output
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(connections, f, indent=2, ensure_ascii=False)

    # Stats
    companies = set(c['company'] for c in connections if c['company'])
    with_email = sum(1 for c in connections if c.get('email'))

    print(f"✓ Parsed {len(connections)} connections ({skipped} skipped)")
    print(f"  {len(companies)} unique companies")
    print(f"  {with_email} with email addresses")
    print(f"  Output: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
