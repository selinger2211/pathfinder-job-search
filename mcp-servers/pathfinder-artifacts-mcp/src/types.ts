// Type definitions for Pathfinder Artifacts MCP Server

/** Supported artifact types in the Pathfinder system */
export type ArtifactType =
  | "research_brief"
  | "resume"
  | "jd_snapshot"
  | "fit_assessment"
  | "homework_submission"
  | "offer_letter"
  | "networking_notes"
  | "cover_letter"
  | "interview_notes"
  | "debrief"
  | "mock_session"
  | "outreach_draft"
  | "thank_you_note"
  | "comp_benchmark";

/** Metadata stored for each artifact */
export interface ArtifactMetadata {
  artifactId: string; // Unique identifier (type_company_timestamp)
  filename: string; // Display filename
  type: ArtifactType; // Artifact type
  company: string; // Company name
  roleId?: string; // Optional role ID
  tags: string[]; // List of tags for categorization
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  path: string; // Full file path
  sizeBytes: number; // File size in bytes
}

/** Index entry as stored in index.json */
export interface IndexEntry extends ArtifactMetadata {
  // Same as ArtifactMetadata - used interchangeably
}

/** Response from save_artifact tool */
export interface SaveArtifactResponse {
  artifactId: string;
  path: string;
}

/** Response from get_artifact tool */
export interface GetArtifactResponse {
  content: string;
  metadata: ArtifactMetadata;
}

/** Response from list_artifacts tool */
export interface ListArtifactsResponse {
  artifacts: Array<{
    artifactId: string;
    filename: string;
    type: ArtifactType;
    company: string;
    tags: string[];
    createdAt: string;
  }>;
}

/** Response from search_artifacts tool */
export interface SearchArtifactsResponse {
  results: Array<{
    artifactId: string;
    filename: string;
    relevance: number;
  }>;
  totalMatches: number;
}

/** Response from tag_artifact tool */
export interface TagArtifactResponse {
  updated: boolean;
  artifactId: string;
  tags: string[];
}

/** Response from delete_artifact tool */
export interface DeleteArtifactResponse {
  deleted: boolean;
  artifactId: string;
  archivedAt: string;
}

/** Date range filter for list_artifacts */
export interface DateRange {
  startDate?: string; // ISO 8601 date
  endDate?: string; // ISO 8601 date
}

/** Index file structure stored on disk */
export interface ArtifactIndex {
  artifacts: IndexEntry[];
  lastUpdated: string;
}

/** Tool parameter schemas (for validation) */
export interface SaveArtifactParams {
  content: string;
  filename: string;
  type: ArtifactType;
  company: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  roleId?: string;
}

export interface GetArtifactParams {
  artifactId: string;
}

export interface ListArtifactsParams {
  tags?: string[];
  company?: string;
  roleId?: string;
  type?: ArtifactType;
  dateRange?: DateRange;
}

export interface SearchArtifactsParams {
  query: string;
}

export interface TagArtifactParams {
  artifactId: string;
  tags: string[];
}

export interface DeleteArtifactParams {
  artifactId: string;
}
