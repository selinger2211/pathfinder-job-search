// tag_artifact tool - Add or modify tags on an existing artifact

import { z } from "zod";
import { TagArtifactParams } from "../types.js";
import { storageService } from "../services/storage.js";

/**
 * Zod schema for tag_artifact input validation
 */
export const TagArtifactInputSchema = z.object({
  artifactId: z
    .string()
    .describe("Artifact ID to add tags to (e.g., 'research_brief_stripe_1709942400')"),

  tags: z
    .array(z.string().min(1))
    .min(1)
    .describe("Tags to add to the artifact (merged with existing tags)"),
});

/**
 * Tag artifact tool handler
 * Add or modify tags on an existing artifact
 */
export async function handleTagArtifact(
  params: TagArtifactParams
): Promise<{
  updated: boolean;
  artifactId: string;
  tags: string[];
}> {
  try {
    // Update artifact tags
    const updatedTags = storageService.updateArtifactTags(params.artifactId, params.tags);

    return {
      updated: true,
      artifactId: params.artifactId,
      tags: updatedTags,
    };
  } catch (error) {
    throw new Error(
      `Failed to tag artifact: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
