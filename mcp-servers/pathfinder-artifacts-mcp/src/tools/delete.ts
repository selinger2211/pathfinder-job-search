// delete_artifact tool - Remove an artifact (soft delete to archive)

import { z } from "zod";
import { DeleteArtifactParams } from "../types.js";
import { storageService } from "../services/storage.js";

/**
 * Zod schema for delete_artifact input validation
 */
export const DeleteArtifactInputSchema = z.object({
  artifactId: z
    .string()
    .describe(
      "Artifact ID to delete (e.g., 'research_brief_stripe_1709942400'). Moves to archive instead of permanent deletion."
    ),
});

/**
 * Delete artifact tool handler
 * Soft delete - moves artifact to archive instead of permanent deletion
 */
export async function handleDeleteArtifact(
  params: DeleteArtifactParams
): Promise<{
  deleted: boolean;
  artifactId: string;
  archivedAt: string;
}> {
  try {
    // Soft delete artifact
    const archivedAt = storageService.deleteArtifact(params.artifactId);

    return {
      deleted: true,
      artifactId: params.artifactId,
      archivedAt,
    };
  } catch (error) {
    throw new Error(
      `Failed to delete artifact: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
