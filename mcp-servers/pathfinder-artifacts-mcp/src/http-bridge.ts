// HTTP Bridge Server for Pathfinder
// ================================================================
// The browser module can't talk to the MCP server via stdio directly.
// This lightweight HTTP server exposes endpoints so the browser can
// POST/GET requests and receive responses.
//
// v3.0.0: Added key-level data persistence endpoints (/data/*).
// Every pf_* localStorage key is now also stored on disk at
// ~/.pathfinder/data/{key}.json. The browser's data-layer.js
// intercepts localStorage writes and syncs them here automatically.
//
// Runs alongside the MCP server on localhost:3456
// CORS enabled for local development (all origins)
// ================================================================

import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { handleGenerateBriefSection, GenerateBriefSectionInputSchema } from "./tools/generate-brief.js";
import { handleBackupPipeline, BackupPipelineInputSchema } from "./tools/backup.js";
import { handleRestorePipeline, RestorePipelineInputSchema } from "./tools/restore.js";
import {
  handleSaveBrief,
  SaveBriefInputSchema,
  handleGetBrief,
  GetBriefInputSchema,
  handleListBriefs,
  ListBriefsInputSchema,
} from "./tools/research-briefs.js";
import {
  handleExportResume,
  ExportResumeInputSchema,
} from "./tools/resume-builder.js";
import { storageService } from "./services/storage.js";
import { SECTION_PROMPTS } from "./services/claude.js";

// ================================================================
// Key-Level Data Persistence (v3.0.0)
// ================================================================
// Each pf_* key is stored as a separate JSON file in ~/.pathfinder/data/
// This allows granular sync: when the browser writes to localStorage,
// it also POSTs the value here. On startup, if localStorage is empty,
// the browser fetches all keys from here to recover.
// ================================================================

const DATA_DIR = path.join(os.homedir(), ".pathfinder", "data");

/**
 * Ensures the data directory exists. Called once on server start.
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Sanitizes a key name for use as a filename.
 * Only allows alphanumeric, underscore, hyphen characters.
 * INPUT: key = string (e.g., "pf_roles")
 * RETURNS: sanitized string safe for filesystem
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Writes a single key-value pair to disk.
 * INPUT: key = string, value = string (raw JSON string from localStorage)
 * SIDE EFFECTS: writes to ~/.pathfinder/data/{key}.json
 */
function writeDataKey(key: string, value: string): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, `${sanitizeKey(key)}.json`);
  const wrapper = {
    key,
    value,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(value, "utf8"),
  };
  fs.writeFileSync(filePath, JSON.stringify(wrapper), "utf8");
}

/**
 * Reads a single key from disk.
 * INPUT: key = string
 * RETURNS: { key, value, updatedAt } or null if not found
 */
function readDataKey(key: string): { key: string; value: string; updatedAt: string } | null {
  const filePath = path.join(DATA_DIR, `${sanitizeKey(key)}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Reads ALL keys from disk.
 * RETURNS: object mapping key names to their values
 */
function readAllDataKeys(): Record<string, string> {
  ensureDataDir();
  const result: Record<string, string> = {};
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.key && parsed.value !== undefined) {
        result[parsed.key] = parsed.value;
      }
    } catch {
      // Skip corrupted files
    }
  }
  return result;
}

/**
 * Deletes a single key from disk.
 * INPUT: key = string
 * RETURNS: true if deleted, false if not found
 */
function deleteDataKey(key: string): boolean {
  const filePath = path.join(DATA_DIR, `${sanitizeKey(key)}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

const PORT = parseInt(process.env.PF_BRIDGE_PORT || "3456");

/**
 * Parse JSON body from an incoming HTTP request.
 * Returns parsed object or throws on invalid JSON.
 */
function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON in request body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send a JSON response with proper headers.
 */
function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    // CORS: allow browser requests from localhost (any port)
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle CORS preflight requests
 */
function handleCORS(res: http.ServerResponse): void {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  res.end();
}

/**
 * Create and start the HTTP bridge server.
 * Routes:
 *   POST /api/generate-section  — Generate a single brief section
 *   GET  /api/section-defs      — Return section definitions (titles, nums)
 *   GET  /api/health             — Health check
 *   GET  /api/cached-brief       — Get all cached sections for a role
 */
export function startHttpBridge(): http.Server {
  const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      handleCORS(res);
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${PORT}`);

    try {
      // ============================================================
      // POST /api/generate-section — Main generation endpoint
      // ============================================================
      if (req.method === "POST" && url.pathname === "/api/generate-section") {
        const body = await parseBody(req);

        // Validate input
        const parsed = GenerateBriefSectionInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJSON(res, 400, {
            error: "Invalid input",
            details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
          return;
        }

        // Generate the section
        const result = await handleGenerateBriefSection(parsed.data);
        sendJSON(res, 200, result);
        return;
      }

      // ============================================================
      // GET /api/section-defs — Return section definitions
      // ============================================================
      if (req.method === "GET" && url.pathname === "/api/section-defs") {
        const defs = Object.entries(SECTION_PROMPTS).map(([num, def]) => ({
          num: parseInt(num),
          title: def.title,
          extraInputs: def.extraInputs || [],
        }));
        sendJSON(res, 200, { sections: defs });
        return;
      }

      // ============================================================
      // GET /api/health — Health check
      // ============================================================
      if (req.method === "GET" && url.pathname === "/api/health") {
        sendJSON(res, 200, {
          status: "ok",
          server: "pathfinder-bridge",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // ============================================================
      // GET /api/cached-brief?roleId=X&company=Y — Get cached sections
      // ============================================================
      if (req.method === "GET" && url.pathname === "/api/cached-brief") {
        const roleId = url.searchParams.get("roleId");
        const company = url.searchParams.get("company");

        if (!roleId || !company) {
          sendJSON(res, 400, { error: "roleId and company query params required" });
          return;
        }

        // Find all cached brief sections for this role
        const artifacts = storageService.listArtifacts({
          type: "research_brief",
          company,
          roleId,
          tags: ["brief_section"],
        });

        // Read and parse each artifact
        const sections: Record<number, {
          content: string;
          citations: unknown[];
          generatedAt: string;
          model: string;
        }> = {};

        for (const artifact of artifacts) {
          try {
            const raw = storageService.readArtifactContent(artifact.path);
            const parsed = JSON.parse(raw);
            sections[parsed.sectionNum] = {
              content: parsed.content,
              citations: parsed.citations || [],
              generatedAt: artifact.createdAt,
              model: parsed.model || "unknown",
            };
          } catch {
            // Skip corrupted artifacts
          }
        }

        sendJSON(res, 200, { roleId, company, sections });
        return;
      }

      // ============================================================
      // FEATURE 28: RESEARCH BRIEF PERSISTENCE ENDPOINTS
      // ============================================================

      // POST /api/save-brief — Save a research brief to database
      if (req.method === "POST" && url.pathname === "/api/save-brief") {
        const body = await parseBody(req);

        // Validate input
        const parsed = SaveBriefInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJSON(res, 400, {
            error: "Invalid input",
            details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
          return;
        }

        // Save the brief
        const result = await handleSaveBrief(parsed.data);
        sendJSON(res, 200, result);
        return;
      }

      // GET /api/get-brief — Retrieve a research brief by roleId and version
      if (req.method === "GET" && url.pathname === "/api/get-brief") {
        const roleId = url.searchParams.get("roleId");
        const versionStr = url.searchParams.get("version");

        if (!roleId) {
          sendJSON(res, 400, { error: "roleId query param required" });
          return;
        }

        const version = versionStr ? parseInt(versionStr, 10) : undefined;

        // Validate input
        const parsed = GetBriefInputSchema.safeParse({ roleId, version });
        if (!parsed.success) {
          sendJSON(res, 400, {
            error: "Invalid input",
            details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
          return;
        }

        // Get the brief
        const result = await handleGetBrief(parsed.data);
        sendJSON(res, 200, result);
        return;
      }

      // GET /api/list-briefs — List all saved briefs
      if (req.method === "GET" && url.pathname === "/api/list-briefs") {
        const roleId = url.searchParams.get("roleId") || undefined;
        const companyName = url.searchParams.get("companyName") || undefined;

        // Validate input
        const parsed = ListBriefsInputSchema.safeParse({ roleId, companyName });
        if (!parsed.success) {
          sendJSON(res, 400, {
            error: "Invalid input",
            details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
          return;
        }

        // List the briefs
        const result = await handleListBriefs(parsed.data);
        sendJSON(res, 200, result);
        return;
      }

      // ============================================================
      // FEATURE 49: RESUME BUILDER EXPORT ENDPOINT
      // ============================================================

      // POST /api/export-resume — Export resume in specified format
      if (req.method === "POST" && url.pathname === "/api/export-resume") {
        const body = await parseBody(req);

        // Validate input
        const parsed = ExportResumeInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJSON(res, 400, {
            error: "Invalid input",
            details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
          return;
        }

        // Export the resume
        const result = await handleExportResume(parsed.data);
        sendJSON(res, 200, result);
        return;
      }

      // ============================================================
      // POST /backup — Backup all pf_* localStorage data to disk
      // ============================================================
      if (req.method === "POST" && url.pathname === "/backup") {
        const body = await parseBody(req);

        // Validate input
        const parsed = BackupPipelineInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJSON(res, 400, {
            error: "Invalid input",
            details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
          return;
        }

        // Create the backup
        const result = await handleBackupPipeline(parsed.data);
        sendJSON(res, 200, result);
        return;
      }

      // ============================================================
      // POST /restore — List or restore from a pipeline backup
      // ============================================================
      if (req.method === "POST" && url.pathname === "/restore") {
        const body = await parseBody(req);

        // Validate input
        const parsed = RestorePipelineInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJSON(res, 400, {
            error: "Invalid input",
            details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
          return;
        }

        // List or restore
        const result = await handleRestorePipeline(parsed.data);
        sendJSON(res, 200, result);
        return;
      }

      // ============================================================
      // GET /backups — Shortcut to list all available backups
      // ============================================================
      if (req.method === "GET" && url.pathname === "/backups") {
        const result = await handleRestorePipeline({ action: "list" });
        sendJSON(res, 200, result);
        return;
      }

      // ============================================================
      // PUT /data/:key — Write a single key to persistent storage
      // Used by data-layer.js to sync localStorage writes to disk.
      // Body: { value: "..." } where value is the raw JSON string.
      // ============================================================
      if (req.method === "PUT" && url.pathname.startsWith("/data/")) {
        const key = decodeURIComponent(url.pathname.slice(6)); // strip "/data/"
        if (!key) {
          sendJSON(res, 400, { error: "Key is required in URL path" });
          return;
        }
        const body = await parseBody(req) as { value?: string };
        if (!body || body.value === undefined) {
          sendJSON(res, 400, { error: "Request body must include 'value' field" });
          return;
        }
        writeDataKey(key, body.value);
        sendJSON(res, 200, { ok: true, key, sizeBytes: Buffer.byteLength(body.value, "utf8") });
        return;
      }

      // ============================================================
      // GET /data/:key — Read a single key from persistent storage
      // Returns the stored value, or 404 if key doesn't exist.
      // ============================================================
      if (req.method === "GET" && url.pathname.startsWith("/data/") && url.pathname !== "/data/") {
        const key = decodeURIComponent(url.pathname.slice(6));
        const result = readDataKey(key);
        if (!result) {
          sendJSON(res, 404, { error: "Key not found", key });
          return;
        }
        sendJSON(res, 200, result);
        return;
      }

      // ============================================================
      // GET /data — Read ALL keys from persistent storage
      // Returns an object mapping all stored keys to their values.
      // Used by data-layer.js on startup to recover from empty localStorage.
      // ============================================================
      if (req.method === "GET" && (url.pathname === "/data" || url.pathname === "/data/")) {
        const allKeys = readAllDataKeys();
        sendJSON(res, 200, {
          keys: allKeys,
          count: Object.keys(allKeys).length,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // ============================================================
      // DELETE /data/:key — Remove a single key from persistent storage
      // ============================================================
      if (req.method === "DELETE" && url.pathname.startsWith("/data/")) {
        const key = decodeURIComponent(url.pathname.slice(6));
        if (!key) {
          sendJSON(res, 400, { error: "Key is required in URL path" });
          return;
        }
        const deleted = deleteDataKey(key);
        sendJSON(res, 200, { ok: true, key, deleted });
        return;
      }

      // ============================================================
      // ARTIFACT CRUD ENDPOINTS (v3.35.0)
      // These expose the core artifact storage to browser modules.
      // ============================================================

      // POST /api/artifacts/save — Save an artifact (file upload)
      // Body: { content, filename, type, company, roleId?, tags?, sourceAgent? }
      // For binary files: content should be base64-encoded string
      if (req.method === "POST" && url.pathname === "/api/artifacts/save") {
        const body = await parseBody(req) as {
          content?: string;
          filename?: string;
          type?: string;
          company?: string;
          roleId?: string;
          tags?: string[];
          sourceAgent?: string;
          isBase64?: boolean;
        };

        if (!body || !body.content || !body.filename || !body.type || !body.company) {
          sendJSON(res, 400, { error: "Required: content, filename, type, company" });
          return;
        }

        const validTypes = [
          "research_brief", "resume", "jd_snapshot", "fit_assessment",
          "homework_submission", "offer_letter", "networking_notes",
          "cover_letter", "interview_notes", "debrief", "mock_session",
          "outreach_draft", "thank_you_note", "comp_benchmark"
        ];
        if (!validTypes.includes(body.type)) {
          sendJSON(res, 400, { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
          return;
        }

        const artifactType = body.type as import("./types.js").ArtifactType;
        const artifactId = storageService.generateArtifactId(artifactType, body.company);
        const filePath = storageService.resolveTypePath(artifactType, `${artifactId}/${body.filename}`);

        // If base64, decode for storage
        const content = body.isBase64
          ? Buffer.from(body.content, "base64").toString("utf-8")
          : body.content;

        const now = new Date().toISOString();
        const metadata: import("./types.js").ArtifactMetadata = {
          artifactId,
          filename: body.filename,
          type: artifactType,
          company: body.company,
          roleId: body.roleId,
          tags: body.tags || [],
          createdAt: now,
          updatedAt: now,
          path: filePath,
          sizeBytes: Buffer.byteLength(content, "utf-8"),
          sourceAgent: body.sourceAgent || "pipeline-browser",
        };

        storageService.saveArtifact(artifactId, metadata, content);
        sendJSON(res, 200, {
          artifactId,
          path: filePath,
          filename: body.filename,
          sizeBytes: metadata.sizeBytes,
          created: true,
          createdAt: now,
        });
        return;
      }

      // GET /api/artifacts/:id — Get a specific artifact by ID
      if (req.method === "GET" && url.pathname.startsWith("/api/artifacts/") && url.pathname !== "/api/artifacts/") {
        const artifactId = decodeURIComponent(url.pathname.slice("/api/artifacts/".length));
        const metadata = storageService.getArtifactMetadata(artifactId);
        if (!metadata) {
          sendJSON(res, 404, { error: "Artifact not found", artifactId });
          return;
        }
        const includeContent = url.searchParams.get("content") !== "false";
        let content: string | undefined;
        if (includeContent) {
          try {
            content = storageService.readArtifactContent(metadata.path);
          } catch {
            content = undefined;
          }
        }
        sendJSON(res, 200, { metadata, content });
        return;
      }

      // GET /api/artifacts — List artifacts with optional filters
      // Query params: type, company, roleId, tags (comma-separated), limit, offset
      if (req.method === "GET" && (url.pathname === "/api/artifacts" || url.pathname === "/api/artifacts/")) {
        const type = url.searchParams.get("type") as import("./types.js").ArtifactType | null;
        const company = url.searchParams.get("company") || undefined;
        const roleId = url.searchParams.get("roleId") || undefined;
        const tagsParam = url.searchParams.get("tags");
        const tags = tagsParam ? tagsParam.split(",").map(t => t.trim()) : undefined;
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const results = storageService.listArtifacts({
          type: type || undefined,
          company,
          roleId,
          tags,
        });

        const paged = results.slice(offset, offset + limit);
        sendJSON(res, 200, {
          artifacts: paged.map(a => ({
            artifactId: a.artifactId,
            filename: a.filename,
            type: a.type,
            company: a.company,
            roleId: a.roleId,
            tags: a.tags,
            createdAt: a.createdAt,
            sizeBytes: a.sizeBytes,
            excerpt: a.excerpt,
          })),
          totalCount: results.length,
          limit,
          offset,
          hasMore: offset + limit < results.length,
        });
        return;
      }

      // DELETE /api/artifacts/:id — Delete an artifact
      if (req.method === "DELETE" && url.pathname.startsWith("/api/artifacts/")) {
        const artifactId = decodeURIComponent(url.pathname.slice("/api/artifacts/".length));
        const permanent = url.searchParams.get("permanent") === "true";
        try {
          storageService.deleteArtifact(artifactId, permanent);
          sendJSON(res, 200, { deleted: true, artifactId, permanent });
        } catch (e) {
          sendJSON(res, 404, { error: e instanceof Error ? e.message : String(e) });
        }
        return;
      }

      // ============================================================
      // 404 — Unknown route
      // ============================================================
      sendJSON(res, 404, { error: "Not found", path: url.pathname });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`HTTP Bridge error: ${message}`);
      sendJSON(res, 500, { error: message });
    }
  });

  server.listen(PORT, () => {
    console.error(`Pathfinder HTTP Bridge v3.35.0 running on http://localhost:${PORT}`);
    console.error(`Endpoints:`);
    console.error(`  POST /api/artifacts/save    — Save artifact (file upload)`);
    console.error(`  GET  /api/artifacts/:id     — Get artifact by ID`);
    console.error(`  GET  /api/artifacts         — List artifacts (with filters)`);
    console.error(`  DELETE /api/artifacts/:id   — Delete artifact`);
    console.error(`  POST /api/generate-section  — Generate a brief section`);
    console.error(`  GET  /api/section-defs      — Section definitions`);
    console.error(`  GET  /api/health            — Health check`);
    console.error(`  GET  /api/cached-brief      — Cached brief sections`);
    console.error(`  POST /backup               — Backup pipeline data to disk`);
    console.error(`  POST /restore              — Restore pipeline data from backup`);
    console.error(`  GET  /backups              — List all available backups`);
    console.error(`  PUT  /data/:key            — Write a key to persistent storage`);
    console.error(`  GET  /data/:key            — Read a key from persistent storage`);
    console.error(`  GET  /data                 — Read ALL keys (recovery endpoint)`);
    console.error(`  DELETE /data/:key          — Delete a key from persistent storage`);
    console.error(`Data directory: ${DATA_DIR}`);
  });

  return server;
}
