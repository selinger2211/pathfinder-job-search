// research-briefs.ts - Tools for saving, retrieving, and comparing research briefs
// Provides persistent storage of research briefs with versioning support

import { z } from "zod";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import { getCurrentISO } from "../constants.js";

// ================================================================
// DATABASE SETUP
// ================================================================

const DB_PATH = path.join(os.homedir(), ".pathfinder", "research-briefs.db");

/**
 * Initialize the research briefs database
 * Creates tables if they don't exist
 */
function initializeDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Create research_briefs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_briefs (
      id TEXT PRIMARY KEY,
      roleId TEXT NOT NULL,
      companyName TEXT NOT NULL,
      version INTEGER NOT NULL,
      sections TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(roleId, companyName, version)
    );

    CREATE INDEX IF NOT EXISTS idx_research_briefs_roleId ON research_briefs(roleId);
    CREATE INDEX IF NOT EXISTS idx_research_briefs_company ON research_briefs(companyName);
    CREATE INDEX IF NOT EXISTS idx_research_briefs_version ON research_briefs(roleId, version DESC);
  `);

  return db;
}

// ================================================================
// INPUT SCHEMAS
// ================================================================

/** Schema for saving a research brief */
export const SaveBriefInputSchema = z.object({
  roleId: z.string().describe("Role ID to associate with the brief"),
  companyName: z.string().describe("Company name"),
  sections: z.array(z.object({
    sectionId: z.string(),
    title: z.string(),
    content: z.string(),
    generatedAt: z.string(),
    sourceHash: z.string().optional(),
  })).describe("Array of brief sections with content and metadata"),
});

/** Schema for retrieving a brief */
export const GetBriefInputSchema = z.object({
  roleId: z.string().describe("Role ID to retrieve"),
  version: z.number().optional().describe("Optional version number (defaults to latest)"),
});

/** Schema for listing briefs */
export const ListBriefsInputSchema = z.object({
  roleId: z.string().optional().describe("Optional filter by role ID"),
  companyName: z.string().optional().describe("Optional filter by company name"),
});

/** Schema for comparing briefs */
export const CompareBriefsInputSchema = z.object({
  roleId: z.string().describe("Role ID"),
  versionA: z.number().describe("First version number"),
  versionB: z.number().describe("Second version number"),
});

// ================================================================
// TOOL HANDLERS
// ================================================================

/**
 * Save a research brief to the database
 * Auto-increments version per roleId
 */
export async function handleSaveBrief(params: z.infer<typeof SaveBriefInputSchema>): Promise<{
  id: string;
  roleId: string;
  companyName: string;
  version: number;
  sectionCount: number;
  createdAt: string;
}> {
  const db = initializeDatabase();
  try {
    const now = getCurrentISO();

    // Get next version for this roleId
    const lastVersion = db.prepare(
      "SELECT MAX(version) as maxVersion FROM research_briefs WHERE roleId = ?"
    ).get(params.roleId) as { maxVersion: number | null };

    const newVersion = (lastVersion?.maxVersion || 0) + 1;
    const briefId = `${params.roleId}_${params.companyName}_v${newVersion}_${Date.now()}`;

    // Store sections as JSON
    const sectionsJson = JSON.stringify(params.sections);

    db.prepare(`
      INSERT INTO research_briefs (id, roleId, companyName, version, sections, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(briefId, params.roleId, params.companyName, newVersion, sectionsJson, now, now);

    return {
      id: briefId,
      roleId: params.roleId,
      companyName: params.companyName,
      version: newVersion,
      sectionCount: params.sections.length,
      createdAt: now,
    };
  } finally {
    db.close();
  }
}

/**
 * Retrieve a research brief by role ID and optional version
 */
export async function handleGetBrief(params: z.infer<typeof GetBriefInputSchema>): Promise<{
  id: string;
  roleId: string;
  companyName: string;
  version: number;
  sections: Array<{
    sectionId: string;
    title: string;
    content: string;
    generatedAt: string;
    sourceHash?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}> {
  const db = initializeDatabase();
  try {
    let query = "SELECT * FROM research_briefs WHERE roleId = ?";
    const args: unknown[] = [params.roleId];

    if (params.version !== undefined) {
      query += " AND version = ?";
      args.push(params.version);
    } else {
      query += " ORDER BY version DESC LIMIT 1";
    }

    const brief = db.prepare(query).get(...args) as {
      id: string;
      roleId: string;
      companyName: string;
      version: number;
      sections: string;
      createdAt: string;
      updatedAt: string;
    } | undefined;

    if (!brief) {
      throw new Error(`No brief found for roleId: ${params.roleId}`);
    }

    return {
      id: brief.id,
      roleId: brief.roleId,
      companyName: brief.companyName,
      version: brief.version,
      sections: JSON.parse(brief.sections),
      createdAt: brief.createdAt,
      updatedAt: brief.updatedAt,
    };
  } finally {
    db.close();
  }
}

/**
 * List all saved briefs with optional filtering
 */
export async function handleListBriefs(params: z.infer<typeof ListBriefsInputSchema>): Promise<Array<{
  roleId: string;
  companyName: string;
  version: number;
  sectionCount: number;
  updatedAt: string;
}>> {
  const db = initializeDatabase();
  try {
    let query = "SELECT id, roleId, companyName, version, sections, updatedAt FROM research_briefs WHERE 1=1";
    const args: unknown[] = [];

    if (params.roleId) {
      query += " AND roleId = ?";
      args.push(params.roleId);
    }

    if (params.companyName) {
      query += " AND companyName = ?";
      args.push(params.companyName);
    }

    query += " ORDER BY updatedAt DESC";

    const briefs = db.prepare(query).all(...args) as Array<{
      id: string;
      roleId: string;
      companyName: string;
      version: number;
      sections: string;
      updatedAt: string;
    }>;

    return briefs.map((b) => ({
      roleId: b.roleId,
      companyName: b.companyName,
      version: b.version,
      sectionCount: JSON.parse(b.sections).length,
      updatedAt: b.updatedAt,
    }));
  } finally {
    db.close();
  }
}

/**
 * Compare two versions of a brief
 * Returns section-level diffs showing what changed
 */
export async function handleCompareBriefs(params: z.infer<typeof CompareBriefsInputSchema>): Promise<Array<{
  sectionId: string;
  changed: boolean;
  oldContent?: string;
  newContent?: string;
}>> {
  const db = initializeDatabase();
  try {
    const briefA = db.prepare(
      "SELECT sections FROM research_briefs WHERE roleId = ? AND version = ?"
    ).get(params.roleId, params.versionA) as { sections: string } | undefined;

    const briefB = db.prepare(
      "SELECT sections FROM research_briefs WHERE roleId = ? AND version = ?"
    ).get(params.roleId, params.versionB) as { sections: string } | undefined;

    if (!briefA || !briefB) {
      throw new Error(`One or both versions not found for roleId: ${params.roleId}`);
    }

    const sectionsA = JSON.parse(briefA.sections) as Array<{ sectionId: string; content: string }>;
    const sectionsB = JSON.parse(briefB.sections) as Array<{ sectionId: string; content: string }>;

    // Create maps for quick lookup
    const mapA = new Map(sectionsA.map((s) => [s.sectionId, s.content]));
    const mapB = new Map(sectionsB.map((s) => [s.sectionId, s.content]));

    // Collect all section IDs
    const allSectionIds = new Set([...mapA.keys(), ...mapB.keys()]);

    // Compare each section
    const diffs: Array<{
      sectionId: string;
      changed: boolean;
      oldContent?: string;
      newContent?: string;
    }> = [];

    for (const sectionId of allSectionIds) {
      const contentA = mapA.get(sectionId);
      const contentB = mapB.get(sectionId);

      if (contentA !== contentB) {
        diffs.push({
          sectionId,
          changed: true,
          oldContent: contentA,
          newContent: contentB,
        });
      } else {
        diffs.push({
          sectionId,
          changed: false,
        });
      }
    }

    return diffs;
  } finally {
    db.close();
  }
}
