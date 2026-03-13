// job-feed.ts - Tools for accessing and searching job feed items
// Provides search and retrieval of job feed data from the queue

import { z } from "zod";
import Database from "better-sqlite3";
import path from "path";
import os from "os";

// ================================================================
// DATABASE SETUP
// ================================================================

const DB_PATH = path.join(os.homedir(), ".pathfinder", "job-feed.db");

/**
 * Initialize the job feed database
 * Uses existing pf_feed_queue table if available
 */
function initializeDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Create pf_feed_queue table if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS pf_feed_queue (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      roleId TEXT,
      score REAL,
      source TEXT,
      sourceUrl TEXT,
      createdAt TEXT NOT NULL,
      processedAt TEXT,
      raw TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_feed_title ON pf_feed_queue(title);
    CREATE INDEX IF NOT EXISTS idx_feed_company ON pf_feed_queue(company);
    CREATE INDEX IF NOT EXISTS idx_feed_score ON pf_feed_queue(score DESC);
  `);

  // Create pf_roles table if needed (for role details)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pf_roles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      level TEXT,
      location TEXT,
      salary TEXT,
      jobDescription TEXT,
      url TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_roles_company ON pf_roles(company);
    CREATE INDEX IF NOT EXISTS idx_roles_title ON pf_roles(title);
  `);

  return db;
}

// ================================================================
// INPUT SCHEMAS
// ================================================================

/** Schema for searching feed items */
export const SearchFeedInputSchema = z.object({
  query: z.string().describe("Search query (matches title or company)"),
  minScore: z.number().optional().describe("Minimum relevance score (0-1)"),
  limit: z.number().optional().default(20).describe("Number of results to return (default 20)"),
});

/** Schema for getting role details */
export const GetRoleInputSchema = z.object({
  roleId: z.string().describe("Role ID to retrieve"),
});

// ================================================================
// TOOL HANDLERS
// ================================================================

/**
 * Search feed items by query, optionally filtered by score
 */
export async function handleSearchFeed(params: z.infer<typeof SearchFeedInputSchema>): Promise<Array<{
  id: string;
  title: string;
  company: string;
  roleId?: string;
  score?: number;
  source?: string;
  sourceUrl?: string;
  createdAt: string;
}>> {
  const db = initializeDatabase();
  try {
    // Build query for title or company match
    let query = `
      SELECT id, title, company, roleId, score, source, sourceUrl, createdAt
      FROM pf_feed_queue
      WHERE (title LIKE ? OR company LIKE ?)
    `;
    const args = [`%${params.query}%`, `%${params.query}%`];

    // Add score filter if provided
    if (params.minScore !== undefined) {
      query += " AND score >= ?";
      args.push(params.minScore);
    }

    query += " ORDER BY score DESC, createdAt DESC LIMIT ?";
    args.push(params.limit || 20);

    const results = db.prepare(query).all(...args) as Array<{
      id: string;
      title: string;
      company: string;
      roleId?: string;
      score?: number;
      source?: string;
      sourceUrl?: string;
      createdAt: string;
    }>;

    return results;
  } finally {
    db.close();
  }
}

/**
 * Get full role details by role ID
 */
export async function handleGetRole(params: z.infer<typeof GetRoleInputSchema>): Promise<{
  id: string;
  title: string;
  company: string;
  level?: string;
  location?: string;
  salary?: string;
  jobDescription?: string;
  url?: string;
  createdAt: string;
}> {
  const db = initializeDatabase();
  try {
    const role = db.prepare(
      "SELECT id, title, company, level, location, salary, jobDescription, url, createdAt FROM pf_roles WHERE id = ?"
    ).get(params.roleId) as {
      id: string;
      title: string;
      company: string;
      level?: string;
      location?: string;
      salary?: string;
      jobDescription?: string;
      url?: string;
      createdAt: string;
    } | undefined;

    if (!role) {
      throw new Error(`Role not found: ${params.roleId}`);
    }

    return role;
  } finally {
    db.close();
  }
}
