// HTTP Bridge Server for Pathfinder Research Brief
// ================================================================
// The browser module can't talk to the MCP server via stdio directly.
// This lightweight HTTP server exposes the brief generation endpoint
// so the browser can POST requests and receive generated sections.
//
// Runs alongside the MCP server on localhost:3456
// CORS enabled for local development (localhost origins only)
// ================================================================

import http from "http";
import { handleGenerateBriefSection, GenerateBriefSectionInputSchema } from "./tools/generate-brief.js";
import { storageService } from "./services/storage.js";
import { SECTION_PROMPTS } from "./services/claude.js";

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
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
    console.error(`Pathfinder HTTP Bridge running on http://localhost:${PORT}`);
    console.error(`Endpoints:`);
    console.error(`  POST /api/generate-section  — Generate a brief section`);
    console.error(`  GET  /api/section-defs      — Section definitions`);
    console.error(`  GET  /api/health            — Health check`);
    console.error(`  GET  /api/cached-brief      — Cached brief sections`);
  });

  return server;
}
