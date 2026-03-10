// Pathfinder Artifacts MCP Server
// Main entry point - creates MCP server, registers tools, connects via stdio
// Also starts an HTTP bridge for browser-based modules (Research Brief, etc.)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import tool handlers and schemas
import { handleSaveArtifact, SaveArtifactInputSchema } from "./tools/save.js";
import { handleGetArtifact, GetArtifactInputSchema } from "./tools/get.js";
import { handleListArtifacts, ListArtifactsInputSchema } from "./tools/list.js";
import { handleSearchArtifacts, SearchArtifactsInputSchema } from "./tools/search.js";
import { handleTagArtifact, TagArtifactInputSchema } from "./tools/tag.js";
import { handleDeleteArtifact, DeleteArtifactInputSchema } from "./tools/delete.js";
import { handleGenerateBriefSection, GenerateBriefSectionInputSchema } from "./tools/generate-brief.js";

// Import storage service for initialization
import { storageService } from "./services/storage.js";

// Import HTTP bridge for browser communication
import { startHttpBridge } from "./http-bridge.js";

/**
 * Main server class
 * Initializes MCP server, registers all artifact tools, and connects via stdio
 */
class PathfinderArtifactsMcpServer {
  private server: McpServer;

  constructor() {
    // Create MCP server instance
    this.server = new McpServer({
      name: "pathfinder-artifacts-mcp",
      version: "1.0.0",
    });

    // Initialize artifact directories
    storageService.ensureDirectories();

    // Register all artifact tools
    this.registerTools();
  }

  /**
   * Register all MCP tools for artifact management
   */
  private registerTools(): void {
    // pf_save_artifact - Save a file with structured metadata
    this.server.registerTool(
      "pf_save_artifact",
      {
        title: "Save Artifact",
        description:
          "Save a file with structured metadata to the Pathfinder artifacts store. Returns artifact ID and file path.",
        inputSchema: SaveArtifactInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (params) => {
        try {
          const result = await handleSaveArtifact(params);
          return {
            type: "text",
            text: JSON.stringify(result, null, 2),
          };
        } catch (error) {
          throw new Error(
            `save_artifact failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // pf_get_artifact - Retrieve a specific artifact by ID
    this.server.registerTool(
      "pf_get_artifact",
      {
        title: "Get Artifact",
        description:
          "Retrieve a specific artifact by ID, including its full content and metadata.",
        inputSchema: GetArtifactInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (params) => {
        try {
          const result = await handleGetArtifact(params);
          return {
            type: "text",
            text: JSON.stringify(
              {
                metadata: result.metadata,
                contentLength: result.content.length,
                contentPreview: result.content.substring(0, 500),
              },
              null,
              2
            ),
          };
        } catch (error) {
          throw new Error(
            `get_artifact failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // pf_list_artifacts - Query artifacts by filters
    this.server.registerTool(
      "pf_list_artifacts",
      {
        title: "List Artifacts",
        description:
          "Query artifacts by any combination of filters (tags, company, roleId, type, dateRange). Returns matching artifacts sorted by creation date.",
        inputSchema: ListArtifactsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (params) => {
        try {
          const result = await handleListArtifacts(params);
          return {
            type: "text",
            text: JSON.stringify(result, null, 2),
          };
        } catch (error) {
          throw new Error(
            `list_artifacts failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // pf_search_artifacts - Full-text search across artifact content
    this.server.registerTool(
      "pf_search_artifacts",
      {
        title: "Search Artifacts",
        description:
          "Perform full-text search across artifact contents. Returns matching artifacts ranked by relevance.",
        inputSchema: SearchArtifactsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (params) => {
        try {
          const result = await handleSearchArtifacts(params);
          return {
            type: "text",
            text: JSON.stringify(result, null, 2),
          };
        } catch (error) {
          throw new Error(
            `search_artifacts failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // pf_tag_artifact - Add or modify tags on an existing artifact
    this.server.registerTool(
      "pf_tag_artifact",
      {
        title: "Tag Artifact",
        description:
          "Add or modify tags on an existing artifact. New tags are merged with existing tags.",
        inputSchema: TagArtifactInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (params) => {
        try {
          const result = await handleTagArtifact(params);
          return {
            type: "text",
            text: JSON.stringify(result, null, 2),
          };
        } catch (error) {
          throw new Error(
            `tag_artifact failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // pf_delete_artifact - Remove an artifact (soft delete to archive)
    this.server.registerTool(
      "pf_delete_artifact",
      {
        title: "Delete Artifact",
        description:
          "Remove an artifact (soft delete - moves to archive instead of permanent deletion). Archived artifacts can be recovered.",
        inputSchema: DeleteArtifactInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (params) => {
        try {
          const result = await handleDeleteArtifact(params);
          return {
            type: "text",
            text: JSON.stringify(result, null, 2),
          };
        } catch (error) {
          throw new Error(
            `delete_artifact failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // pf_generate_brief_section - Generate a single Research Brief section via Claude API
    this.server.registerTool(
      "pf_generate_brief_section",
      {
        title: "Generate Brief Section",
        description:
          "Generate one section of a Research Brief using Claude. Reads role/company data from the provided context, generates HTML content with inline citations, and saves the result as an artifact. Sections 0-13 are available.",
        inputSchema: GenerateBriefSectionInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true, // Makes external API calls to Claude
        },
      },
      async (params) => {
        try {
          const result = await handleGenerateBriefSection(params);
          return {
            type: "text",
            text: JSON.stringify(result, null, 2),
          };
        } catch (error) {
          throw new Error(
            `generate_brief_section failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );
  }

  /**
   * Start the MCP server and connect via stdio
   */
  public async run(): Promise<void> {
    try {
      // Start HTTP bridge for browser communication (Research Brief, etc.)
      // This runs on localhost:3456 and exposes the generation endpoints
      startHttpBridge();

      // Create stdio transport for MCP protocol
      const transport = new StdioServerTransport();

      // Connect server to transport
      await this.server.connect(transport);

      // Log startup message to stderr (so stdout stays clean for MCP protocol)
      console.error("Pathfinder Artifacts MCP Server started successfully");
      console.error("Listening on stdio transport + HTTP bridge");
    } catch (error) {
      console.error(
        "Failed to start Pathfinder Artifacts MCP Server:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }
}

// Main entry point
async function main(): Promise<void> {
  try {
    const server = new PathfinderArtifactsMcpServer();
    await server.run();
  } catch (error) {
    console.error(
      "Fatal error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
