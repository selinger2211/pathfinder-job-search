// Storage service for managing artifact files and index
// Handles all file system operations, indexing, and metadata management

import fs from "fs";
import path from "path";
import {
  ArtifactMetadata,
  ArtifactType,
  IndexEntry,
  ArtifactIndex,
} from "../types.js";
import {
  ARTIFACTS_ROOT,
  INDEX_FILE,
  ARCHIVE_DIR,
  TYPE_TO_DIR,
  generateArtifactId,
  sanitizeFilename,
  getCurrentISO,
  compareDates,
  MAX_FILE_SIZE,
} from "../constants.js";

/**
 * StorageService handles all file system operations for artifacts
 * Manages the artifacts directory, index file, and soft deletion
 */
export class StorageService {
  /**
   * Ensure that the artifacts root directory and all type subdirectories exist
   */
  public ensureDirectories(): void {
    try {
      // Create root directory if it doesn't exist
      if (!fs.existsSync(ARTIFACTS_ROOT)) {
        fs.mkdirSync(ARTIFACTS_ROOT, { recursive: true });
      }

      // Create archive directory
      if (!fs.existsSync(ARCHIVE_DIR)) {
        fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
      }

      // Create all type directories
      for (const dir of Object.values(TYPE_TO_DIR)) {
        const dirPath = path.join(ARTIFACTS_ROOT, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to ensure artifact directories: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Read and parse the index file
   * Returns empty index if file doesn't exist
   */
  public readIndex(): ArtifactIndex {
    try {
      if (!fs.existsSync(INDEX_FILE)) {
        // Return empty index if file doesn't exist
        return {
          artifacts: [],
          lastUpdated: getCurrentISO(),
        };
      }

      const content = fs.readFileSync(INDEX_FILE, "utf-8");
      const parsed = JSON.parse(content) as ArtifactIndex;

      // Validate index structure
      if (!Array.isArray(parsed.artifacts)) {
        throw new Error("Index artifacts property is not an array");
      }

      return parsed;
    } catch (error) {
      throw new Error(
        `Failed to read index file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Write the index file to disk
   */
  public writeIndex(index: ArtifactIndex): void {
    try {
      // Update lastUpdated timestamp
      index.lastUpdated = getCurrentISO();

      // Ensure the parent directory exists
      const dir = path.dirname(INDEX_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write index with pretty formatting
      fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
    } catch (error) {
      throw new Error(
        `Failed to write index file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Generate a unique artifact ID based on type, company, and timestamp
   */
  public generateArtifactId(
    type: ArtifactType,
    company: string,
    timestamp?: number
  ): string {
    return generateArtifactId(type, company, timestamp);
  }

  /**
   * Resolve the full file path for an artifact based on its type and filename
   */
  public resolveTypePath(type: ArtifactType, filename: string): string {
    const dir = TYPE_TO_DIR[type];
    if (!dir) {
      throw new Error(`Unknown artifact type: ${type}`);
    }
    return path.join(ARTIFACTS_ROOT, dir, sanitizeFilename(filename));
  }

  /**
   * Save artifact content to disk and update index
   */
  public saveArtifact(
    artifactId: string,
    metadata: ArtifactMetadata,
    content: string
  ): void {
    try {
      // Validate file size
      const contentSize = Buffer.byteLength(content, "utf-8");
      if (contentSize > MAX_FILE_SIZE) {
        throw new Error(
          `Content exceeds maximum file size of ${MAX_FILE_SIZE} bytes`
        );
      }

      // Ensure directories exist
      this.ensureDirectories();

      // Resolve file path
      const filePath = metadata.path;
      const fileDir = path.dirname(filePath);

      // Create type directory if needed
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      // Write content to file
      fs.writeFileSync(filePath, content, "utf-8");

      // Read current index
      const index = this.readIndex();

      // Check if artifact already exists and remove it
      index.artifacts = index.artifacts.filter(
        (entry) => entry.artifactId !== artifactId
      );

      // Add new artifact to index
      index.artifacts.push(metadata);

      // Sort by creation date descending (newest first)
      index.artifacts.sort((a, b) => compareDates(b.createdAt, a.createdAt));

      // Write updated index
      this.writeIndex(index);
    } catch (error) {
      throw new Error(
        `Failed to save artifact: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Read artifact content from disk
   */
  public readArtifactContent(filePath: string): string {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Artifact file not found: ${filePath}`);
      }

      return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to read artifact content: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get metadata for an artifact by ID
   */
  public getArtifactMetadata(artifactId: string): ArtifactMetadata | null {
    const index = this.readIndex();
    return index.artifacts.find((entry) => entry.artifactId === artifactId) || null;
  }

  /**
   * List artifacts with optional filters
   */
  public listArtifacts(filters: {
    tags?: string[];
    company?: string;
    roleId?: string;
    type?: ArtifactType;
    dateRange?: { startDate?: string; endDate?: string };
  }): ArtifactMetadata[] {
    const index = this.readIndex();
    let results = [...index.artifacts];

    // Filter by type
    if (filters.type) {
      results = results.filter((entry) => entry.type === filters.type);
    }

    // Filter by company
    if (filters.company) {
      const companyLower = filters.company.toLowerCase();
      results = results.filter((entry) =>
        entry.company.toLowerCase().includes(companyLower)
      );
    }

    // Filter by roleId
    if (filters.roleId) {
      results = results.filter((entry) => entry.roleId === filters.roleId);
    }

    // Filter by tags (any tag match)
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((entry) =>
        filters.tags!.some((tag) => entry.tags.includes(tag))
      );
    }

    // Filter by date range
    if (filters.dateRange) {
      if (filters.dateRange.startDate) {
        results = results.filter(
          (entry) =>
            compareDates(entry.createdAt, filters.dateRange!.startDate!) >= 0
        );
      }
      if (filters.dateRange.endDate) {
        results = results.filter(
          (entry) =>
            compareDates(entry.createdAt, filters.dateRange!.endDate!) <= 0
        );
      }
    }

    // Sort by creation date descending
    results.sort((a, b) => compareDates(b.createdAt, a.createdAt));

    return results;
  }

  /**
   * Update tags for an artifact
   */
  public updateArtifactTags(artifactId: string, newTags: string[]): string[] {
    try {
      const index = this.readIndex();
      const artifact = index.artifacts.find(
        (entry) => entry.artifactId === artifactId
      );

      if (!artifact) {
        throw new Error(`Artifact not found: ${artifactId}`);
      }

      // Merge new tags with existing tags (deduplicate)
      const updatedTags = Array.from(new Set([...artifact.tags, ...newTags]));
      artifact.tags = updatedTags;
      artifact.updatedAt = getCurrentISO();

      this.writeIndex(index);
      return updatedTags;
    } catch (error) {
      throw new Error(
        `Failed to update artifact tags: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Soft delete an artifact (move to archive)
   */
  public deleteArtifact(artifactId: string): string {
    try {
      const index = this.readIndex();
      const artifact = index.artifacts.find(
        (entry) => entry.artifactId === artifactId
      );

      if (!artifact) {
        throw new Error(`Artifact not found: ${artifactId}`);
      }

      // Save metadata to archive
      const archivedMetadata: ArtifactMetadata & { archivedAt: string } = {
        ...artifact,
        archivedAt: getCurrentISO(),
      };

      const archiveFile = path.join(ARCHIVE_DIR, `${artifactId}.json`);
      fs.writeFileSync(archiveFile, JSON.stringify(archivedMetadata, null, 2));

      // Try to delete the actual artifact file (but don't fail if it's missing)
      try {
        if (fs.existsSync(artifact.path)) {
          fs.unlinkSync(artifact.path);
        }
      } catch {
        // Ignore errors when deleting the file itself
      }

      // Remove from index
      index.artifacts = index.artifacts.filter(
        (entry) => entry.artifactId !== artifactId
      );
      this.writeIndex(index);

      return archivedMetadata.archivedAt;
    } catch (error) {
      throw new Error(
        `Failed to delete artifact: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Search artifact contents by query string
   * Returns metadata with relevance scores
   */
  public searchArtifacts(
    query: string,
    limit: number = 50
  ): Array<{ artifactId: string; filename: string; relevance: number }> {
    try {
      const index = this.readIndex();
      const queryLower = query.toLowerCase();
      const results: Array<{
        artifactId: string;
        filename: string;
        relevance: number;
      }> = [];

      // Search through artifacts
      for (const entry of index.artifacts) {
        try {
          // Skip if file doesn't exist
          if (!fs.existsSync(entry.path)) {
            continue;
          }

          // Read file content
          const content = fs.readFileSync(entry.path, "utf-8");
          const contentLower = content.toLowerCase();

          // Count occurrences of query in content
          const matches = contentLower.split(queryLower).length - 1;

          if (matches > 0) {
            // Calculate relevance score
            // Higher score for more matches, with diminishing returns
            const relevance = Math.min(matches / Math.max(1, matches), 1.0);

            results.push({
              artifactId: entry.artifactId,
              filename: entry.filename,
              relevance,
            });
          }
        } catch {
          // Skip artifacts that can't be read
          continue;
        }
      }

      // Sort by relevance descending
      results.sort((a, b) => b.relevance - a.relevance);

      // Return limited results
      return results.slice(0, limit);
    } catch (error) {
      throw new Error(
        `Failed to search artifacts: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get file size in bytes
   */
  public getFileSizeBytes(filePath: string): number {
    try {
      if (!fs.existsSync(filePath)) {
        return 0;
      }
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
