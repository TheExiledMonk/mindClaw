import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { requireNodeSqlite } from "../memory/sqlite.js";
import type { ContextEngineRuntimeContext } from "./types.js";

export const MEMORY_SYSTEM_DIRNAME = ".openclaw-memory";
const SESSIONS_DIRNAME = "sessions";
const LONG_TERM_FILENAME = "long-term.json";
const PENDING_FILENAME = "pending-significance.json";
const PERMANENT_TREE_FILENAME = "permanent-tree.json";
const GRAPH_FILENAME = "memory-graph.json";
const STORE_METADATA_FILENAME = "store-metadata.json";
const SQLITE_STORE_FILENAME = "memory-store.sqlite";
const MAX_WORKING_ITEMS = 6;
const MAX_LONG_TERM_ITEMS = 48;
const MAX_PENDING_ITEMS = 64;
const MAX_PACKET_ITEMS = 4;
const RECURRENCE_PROMOTION_OVERLAP = 4;
const COMPRESS_AFTER_MS = 1000 * 60 * 60 * 24 * 7;
const LATENT_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

export type MemoryCategory =
  | "fact"
  | "preference"
  | "decision"
  | "strategy"
  | "entity"
  | "episode"
  | "pattern";

export type MemoryOntologyKind =
  | "constraint"
  | "pattern"
  | "outcome"
  | "entity"
  | "preference"
  | "fact";

export type MemoryTaskMode =
  | "coding"
  | "debugging"
  | "support"
  | "planning"
  | "conceptual"
  | "research";

export type MemorySourceType =
  | "user_stated"
  | "direct_observation"
  | "summary_derived"
  | "system_inferred";

export type MemoryImportanceClass = "critical" | "useful" | "temporary" | "discardable";
export type MemoryCompressionState = "active" | "stable" | "compressed" | "latent";
export type MemoryActiveStatus = "active" | "pending" | "stale" | "superseded" | "archived";
export type MemoryAdjudicationStatus = "authoritative" | "contested" | "superseded";
export type MemoryRevisionKind = "new" | "reasserted" | "updated" | "narrowed" | "contested";
export type MemoryPermanenceStatus = "eligible" | "deferred" | "blocked";
export type MemoryTrend = "rising" | "stable" | "fading";
export type PermanentNodeType =
  | "root"
  | "entity"
  | "pattern"
  | "rule"
  | "lesson"
  | "goal"
  | "artifact"
  | "task"
  | "context";
export type PermanentNodeRelation =
  | "contains"
  | "derived_from"
  | "relevant_to"
  | "superseded_by"
  | "supports"
  | "linked_to";
export type MemoryRelationType =
  | "derived_from"
  | "relevant_to"
  | "superseded_by"
  | "contradicts"
  | "confirmed_by"
  | "linked_to";

export type MemoryProvenanceRecord = {
  kind: "message" | "compaction" | "derived";
  detail: string;
  recordedAt: number;
  derivedFromMemoryIds?: string[];
};

export type MemoryRelation = {
  sourceMemoryId?: string;
  type: MemoryRelationType;
  targetMemoryId: string;
  weight: number;
};

export type MemoryGraphNode = {
  id: string;
  kind: "memory" | "artifact";
  category: MemoryCategory;
  summary: string;
  confidence: number;
  activeStatus: MemoryActiveStatus;
  artifactRef?: string;
  updatedAt: number;
};

export type MemoryGraphEdge = {
  from: string;
  to: string;
  type: MemoryRelationType;
  weight: number;
  updatedAt: number;
};

export type MemoryGraphSnapshot = {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  updatedAt: number;
};

export type WorkingMemorySnapshot = {
  sessionId: string;
  updatedAt: number;
  rollingSummary: string;
  carryForwardSummary?: string;
  lastWorkspaceBranch?: string;
  activeFacts: string[];
  activeGoals: string[];
  openLoops: string[];
  recentEvents: string[];
  recentDecisions: string[];
  lastCompactionSummary?: string;
};

export type LongTermMemoryEntry = {
  id: string;
  semanticKey: string;
  conceptKey: string;
  canonicalText: string;
  conceptAliases: string[];
  entityAliases?: string[];
  entityIds?: string[];
  ontologyKind: MemoryOntologyKind;
  category: MemoryCategory;
  text: string;
  strength: number;
  evidence: string[];
  provenance: MemoryProvenanceRecord[];
  sourceType: MemorySourceType;
  confidence: number;
  importanceClass: MemoryImportanceClass;
  compressionState: MemoryCompressionState;
  activeStatus: MemoryActiveStatus;
  adjudicationStatus: MemoryAdjudicationStatus;
  revisionCount: number;
  lastRevisionKind: MemoryRevisionKind;
  permanenceStatus: MemoryPermanenceStatus;
  permanenceReasons: string[];
  trend: MemoryTrend;
  accessCount: number;
  createdAt: number;
  lastAccessedAt?: number;
  lastConfirmedAt?: number;
  contradictionCount: number;
  relatedMemoryIds: string[];
  relations: MemoryRelation[];
  supersededById?: string;
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  environmentTags: string[];
  artifactRefs: string[];
  updatedAt: number;
};

export type PendingMemoryEntry = LongTermMemoryEntry & {
  pendingReason: string;
};

export type PermanentMemoryNode = {
  id: string;
  label: string;
  nodeType: PermanentNodeType;
  relationToParent?: PermanentNodeRelation;
  summary?: string;
  evidence: string[];
  sourceMemoryIds: string[];
  confidence: number;
  activeStatus: MemoryActiveStatus;
  updatedAt: number;
  children: PermanentMemoryNode[];
};

export type MemoryStoreSnapshot = {
  workingMemory: WorkingMemorySnapshot;
  longTermMemory: LongTermMemoryEntry[];
  pendingSignificance: PendingMemoryEntry[];
  permanentMemory: PermanentMemoryNode;
  graph: MemoryGraphSnapshot;
};

export type MemoryStoreBackendKind = "fs-json" | "sqlite-doc" | "sqlite-graph";

export type MemoryStoreMetadata = {
  backend: MemoryStoreBackendKind;
  version: 1;
  updatedAt: number;
  schemaVersion?: number;
  lastAppliedMigration?: string;
  lastIntegrityCheckAt?: number;
  lastIntegrityCheckResult?: "ok";
  longTermCount?: number;
  conceptCount?: number;
  contestedConceptCount?: number;
  permanentNodeCount?: number;
  graphNodeCount?: number;
  graphEdgeCount?: number;
};

export type MemoryStoreExportBundle = {
  version: 1;
  exportedAt: number;
  sessionId: string;
  backendKind: MemoryStoreBackendKind;
  metadata: MemoryStoreMetadata;
  snapshot: MemoryStoreSnapshot;
};

export type MemoryStoreHealthReport = {
  backendKind: MemoryStoreBackendKind;
  sessionId: string;
  metadata: MemoryStoreMetadata;
  issues: string[];
  recommendations: string[];
  summary: string;
  contestedConceptCount: number;
  contestedEntityConflictCount: number;
  scopedAlternativeConceptCount: number;
  entityLinkedConceptCount: number;
  weakEvidenceWinnerCount: number;
  fragileWinnerCount: number;
  sourceTypeCounts: Record<MemorySourceType, number>;
  authoritativeSourceTypeCounts: Record<MemorySourceType, number>;
  supersededMemoryCount: number;
  permanentEligibleCount: number;
  staleMemoryCount: number;
  backupAvailable: boolean;
  recoveryRecommended: boolean;
};

export type MemoryCompilerStageName =
  | "extract"
  | "runtime"
  | "pending"
  | "pattern"
  | "merge"
  | "review"
  | "permanent"
  | "graph";

export type MemoryCompilerStageReport = {
  stage: MemoryCompilerStageName;
  note: string;
  candidateCount: number;
  conceptCount?: number;
};

export type MemoryCompileResult = MemoryStoreSnapshot & {
  compilerNotes: string[];
  compilerStages: MemoryCompilerStageReport[];
  review: MemoryReviewResult;
};

export type MemoryReviewResult = {
  carryForwardSummary?: string;
  archivedMemoryIds: string[];
  staleMemoryIds: string[];
  reviewedPendingIds: string[];
  contradictoryMemoryIds: string[];
  contradictoryConceptIds: string[];
  scopedAlternativeConceptIds: string[];
  supersededMemoryIds: string[];
  supersededConceptIds: string[];
  contestedRevisionConceptIds: string[];
  revisedConceptIds: string[];
  permanentEligibleIds: string[];
  permanentEligibleConceptIds: string[];
  permanentDeferredIds: string[];
  permanentDeferredConceptIds: string[];
  permanentBlockedIds: string[];
  permanentBlockedConceptIds: string[];
};

export type MemoryRetrievalItem = {
  kind: "working" | "long-term" | "pending" | "permanent" | "contradiction";
  text: string;
  reason: string;
  memoryId?: string;
  conceptId?: string;
};

export type MemoryContextPacket = {
  text?: string;
  taskMode: MemoryTaskMode;
  accessedLongTermIds: string[];
  accessedConceptIds: string[];
  sections: string[];
  retrievalItems: MemoryRetrievalItem[];
};

export type MemoryRetrievalObservabilityReport = {
  taskMode: MemoryTaskMode;
  retrievalItemCount: number;
  longTermItemCount: number;
  permanentItemCount: number;
  contradictionItemCount: number;
  downgradedItemCount: number;
  contestedItemCount: number;
  scopedAlternativeItemCount: number;
  artifactAnchoredItemCount: number;
  entityMatchedItemCount: number;
  authoritativeWinnerItemCount: number;
  summaryDerivedItemCount: number;
  accessedConceptCount: number;
  topReasons: string[];
  summary: string;
};

export type MemoryAcceptanceScenarioResult = {
  scenario:
    | "drift_stability"
    | "scope_isolation"
    | "contested_visibility"
    | "entity_resolution"
    | "evidence_priority"
    | "weak_evidence_governance"
    | "session_handoff_continuity"
    | "backend_parity"
    | "runtime_lifecycle"
    | "permanence_invalidation"
    | "store_recovery"
    | "mixed_lifecycle_soak"
    | "project_lifecycle_long_run"
    | "scope_matrix_resilience"
    | "rivalry_governance"
    | "multi_tenant_release_handoff";
  passed: boolean;
  summary: string;
  details: string[];
};

export type MemoryAcceptanceReport = {
  passed: boolean;
  scenarioCount: number;
  passedCount: number;
  failedCount: number;
  scenarios: MemoryAcceptanceScenarioResult[];
  summary: string;
};

export type MemoryAcceptanceReportFormat = "json" | "summary" | "markdown";

export type MemoryDiagnosticsReport = {
  generatedAt: number;
  workspaceDir: string;
  sessionId: string;
  backendKind: MemoryStoreBackendKind;
  health: MemoryStoreHealthReport;
  retrieval?: MemoryRetrievalObservabilityReport;
  acceptance?: MemoryAcceptanceReport;
  agenticTrends?: MemoryAgenticTrendReport;
  failedAcceptanceScenarios: string[];
  maintenance?: {
    repair?: MemoryStoreMaintenanceReport;
    recovery?: MemoryStoreMaintenanceReport;
  };
  recommendations: string[];
  summary: string;
};

export type MemoryDiagnosticsReportFormat = "json" | "summary" | "markdown";

export type MemoryAgenticTrendReport = {
  totalSignals: number;
  observabilitySignals: number;
  soakSignals: number;
  qualityGateSignals: number;
  missingFallbackSignals: number;
  escalationSignals: number;
  failingSoakSignals: number;
  failingQualityGateSignals: number;
  qualityFailureReasons: string[];
  effectiveSkills: string[];
  effectiveFamilies: string[];
  weakeningSkills: string[];
  recoveringSkills: string[];
  latestSummaries: string[];
  trend: "stable" | "watch" | "regressing";
  summary: string;
};

export type MemoryStoreMaintenanceReport = {
  action: "repair" | "recovery";
  backendKind: MemoryStoreBackendKind;
  sessionId: string;
  success: boolean;
  issuesBefore: string[];
  issuesAfter: string[];
  backupAvailableBefore: boolean;
  backupAvailableAfter: boolean;
  longTermCountBefore?: number;
  longTermCountAfter?: number;
  summary: string;
};

type MemoryStorePaths = {
  rootDir: string;
  sessionsDir: string;
  backupFile: string;
  metadataFile: string;
  workingFile: string;
  longTermFile: string;
  pendingFile: string;
  permanentTreeFile: string;
  graphFile: string;
};

function resolveStorePaths(workspaceDir: string, sessionId: string): MemoryStorePaths {
  const rootDir = path.join(workspaceDir, MEMORY_SYSTEM_DIRNAME);
  const sessionsDir = path.join(rootDir, SESSIONS_DIRNAME);
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return {
    rootDir,
    sessionsDir,
    backupFile: path.join(sessionsDir, `${safeSessionId}.bundle.json`),
    metadataFile: path.join(rootDir, STORE_METADATA_FILENAME),
    workingFile: path.join(sessionsDir, `${safeSessionId}.json`),
    longTermFile: path.join(rootDir, LONG_TERM_FILENAME),
    pendingFile: path.join(rootDir, PENDING_FILENAME),
    permanentTreeFile: path.join(rootDir, PERMANENT_TREE_FILENAME),
    graphFile: path.join(rootDir, GRAPH_FILENAME),
  };
}

async function ensureStoreDirs(paths: MemoryStorePaths): Promise<void> {
  await fs.mkdir(paths.sessionsDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function removeDirectoryRobustly(dirPath: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        !["ENOTEMPTY", "EBUSY", "EPERM"].includes(String((error as NodeJS.ErrnoException).code))
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  await fs.rm(dirPath, { recursive: true, force: true });
}

type MemoryStoreBackend = {
  kind: MemoryStoreBackendKind;
  readJson: <T>(filePath: string, fallback: T) => Promise<T>;
  writeJson: (filePath: string, value: unknown) => Promise<void>;
};

const fsJsonMemoryStoreBackend: MemoryStoreBackend = {
  kind: "fs-json",
  readJson: readJsonFile,
  writeJson: writeJsonFile,
};

function resolveSqliteStoreLocation(filePath: string): { dbPath: string; key: string } {
  const fileDir = path.dirname(filePath);
  const rootDir = path.basename(fileDir) === SESSIONS_DIRNAME ? path.dirname(fileDir) : fileDir;
  return {
    dbPath: path.join(rootDir, SQLITE_STORE_FILENAME),
    key: path.relative(rootDir, filePath),
  };
}

function ensureSqliteStoreSchema(db: import("node:sqlite").DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_store_documents (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

async function readSqliteJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const { DatabaseSync } = requireNodeSqlite();
  const { dbPath, key } = resolveSqliteStoreLocation(filePath);
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    ensureSqliteStoreSchema(db);
    const row = db.prepare("SELECT value FROM memory_store_documents WHERE key = ?").get(key) as
      | { value?: string }
      | undefined;
    if (!row?.value) {
      return fallback;
    }
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  } finally {
    db.close();
  }
}

async function writeSqliteJsonFile(filePath: string, value: unknown): Promise<void> {
  const { DatabaseSync } = requireNodeSqlite();
  const { dbPath, key } = resolveSqliteStoreLocation(filePath);
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    ensureSqliteStoreSchema(db);
    db.prepare(
      `
        INSERT INTO memory_store_documents (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
    ).run(key, JSON.stringify(value), Date.now());
  } finally {
    db.close();
  }
}

const sqliteDocMemoryStoreBackend: MemoryStoreBackend = {
  kind: "sqlite-doc",
  readJson: readSqliteJsonFile,
  writeJson: writeSqliteJsonFile,
};

const sqliteGraphMemoryStoreBackend: MemoryStoreBackend = {
  kind: "sqlite-graph",
  readJson: readSqliteJsonFile,
  writeJson: writeSqliteJsonFile,
};

const SQLITE_GRAPH_SCHEMA_VERSION = 3;

function resolveMemoryStoreBackend(kind?: MemoryStoreBackendKind): MemoryStoreBackend {
  switch (kind ?? "fs-json") {
    case "sqlite-graph":
      return sqliteGraphMemoryStoreBackend;
    case "sqlite-doc":
      return sqliteDocMemoryStoreBackend;
    case "fs-json":
    default:
      return fsJsonMemoryStoreBackend;
  }
}

function defaultMemoryStoreMetadata(kind: MemoryStoreBackendKind = "fs-json"): MemoryStoreMetadata {
  return {
    backend: kind,
    version: 1,
    updatedAt: Date.now(),
    schemaVersion: kind === "sqlite-graph" ? SQLITE_GRAPH_SCHEMA_VERSION : 1,
  };
}

function sanitizeMemoryStoreMetadata(
  value: unknown,
  expectedBackend: MemoryStoreBackendKind,
): MemoryStoreMetadata {
  const candidate = value as Partial<MemoryStoreMetadata> | null | undefined;
  return {
    backend:
      candidate?.backend === "fs-json" ||
      candidate?.backend === "sqlite-doc" ||
      candidate?.backend === "sqlite-graph"
        ? candidate.backend
        : expectedBackend,
    version: 1,
    updatedAt:
      typeof candidate?.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : Date.now(),
    schemaVersion:
      typeof candidate?.schemaVersion === "number" && Number.isFinite(candidate.schemaVersion)
        ? candidate.schemaVersion
        : expectedBackend === "sqlite-graph"
          ? SQLITE_GRAPH_SCHEMA_VERSION
          : 1,
    lastAppliedMigration:
      typeof candidate?.lastAppliedMigration === "string" &&
      candidate.lastAppliedMigration.trim().length > 0
        ? candidate.lastAppliedMigration
        : undefined,
    lastIntegrityCheckAt:
      typeof candidate?.lastIntegrityCheckAt === "number" &&
      Number.isFinite(candidate.lastIntegrityCheckAt)
        ? candidate.lastIntegrityCheckAt
        : undefined,
    lastIntegrityCheckResult:
      candidate?.lastIntegrityCheckResult === "ok" ? candidate.lastIntegrityCheckResult : undefined,
    longTermCount:
      typeof candidate?.longTermCount === "number" && Number.isFinite(candidate.longTermCount)
        ? candidate.longTermCount
        : undefined,
    conceptCount:
      typeof candidate?.conceptCount === "number" && Number.isFinite(candidate.conceptCount)
        ? candidate.conceptCount
        : undefined,
    contestedConceptCount:
      typeof candidate?.contestedConceptCount === "number" &&
      Number.isFinite(candidate.contestedConceptCount)
        ? candidate.contestedConceptCount
        : undefined,
    permanentNodeCount:
      typeof candidate?.permanentNodeCount === "number" &&
      Number.isFinite(candidate.permanentNodeCount)
        ? candidate.permanentNodeCount
        : undefined,
    graphNodeCount:
      typeof candidate?.graphNodeCount === "number" && Number.isFinite(candidate.graphNodeCount)
        ? candidate.graphNodeCount
        : undefined,
    graphEdgeCount:
      typeof candidate?.graphEdgeCount === "number" && Number.isFinite(candidate.graphEdgeCount)
        ? candidate.graphEdgeCount
        : undefined,
  };
}

function countPermanentNodes(root: PermanentMemoryNode): number {
  return 1 + root.children.reduce((sum, child) => sum + countPermanentNodes(child), 0);
}

function buildSnapshotStoreMetadata(params: {
  backend: MemoryStoreBackendKind;
  snapshot: MemoryStoreSnapshot;
  previous?: MemoryStoreMetadata;
}): MemoryStoreMetadata {
  const conceptIds = new Set(
    params.snapshot.longTermMemory.map((entry) => getEntryConceptId(entry)),
  );
  const contestedConceptIds = new Set(
    params.snapshot.longTermMemory
      .filter((entry) => entry.adjudicationStatus === "contested")
      .map((entry) => getEntryConceptId(entry)),
  );
  return {
    ...sanitizeMemoryStoreMetadata(params.previous, params.backend),
    backend: params.backend,
    version: 1,
    updatedAt: Date.now(),
    schemaVersion:
      params.backend === "sqlite-graph"
        ? SQLITE_GRAPH_SCHEMA_VERSION
        : (params.previous?.schemaVersion ?? 1),
    lastAppliedMigration:
      params.backend === "sqlite-graph"
        ? (params.previous?.lastAppliedMigration ?? `003_sqlite_graph_indexes`)
        : params.previous?.lastAppliedMigration,
    longTermCount: params.snapshot.longTermMemory.length,
    conceptCount: conceptIds.size,
    contestedConceptCount: contestedConceptIds.size,
    permanentNodeCount: countPermanentNodes(params.snapshot.permanentMemory),
    graphNodeCount: params.snapshot.graph.nodes.length,
    graphEdgeCount: params.snapshot.graph.edges.length,
  };
}

async function loadPersistedStoreMetadata(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
}): Promise<MemoryStoreMetadata> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  if (params.backendKind === "sqlite-graph") {
    const { DatabaseSync } = requireNodeSqlite();
    await ensureStoreDirs(paths);
    const dbPath = path.join(paths.rootDir, SQLITE_STORE_FILENAME);
    const db = new DatabaseSync(dbPath);
    try {
      const migrationState = applySqliteGraphMigrations(db);
      const row = db.prepare("SELECT value FROM memory_store_metadata WHERE key = 'store'").get() as
        | { value?: string }
        | undefined;
      return sanitizeMemoryStoreMetadata(
        row?.value
          ? {
              ...(JSON.parse(row.value) as MemoryStoreMetadata),
              schemaVersion: migrationState.schemaVersion,
              lastAppliedMigration: migrationState.lastAppliedMigration,
            }
          : {
              ...defaultMemoryStoreMetadata("sqlite-graph"),
              schemaVersion: migrationState.schemaVersion,
              lastAppliedMigration: migrationState.lastAppliedMigration,
            },
        "sqlite-graph",
      );
    } finally {
      db.close();
    }
  }
  const backend = resolveMemoryStoreBackend(params.backendKind);
  await ensureStoreDirs(paths);
  return sanitizeMemoryStoreMetadata(
    await backend.readJson<MemoryStoreMetadata>(
      paths.metadataFile,
      defaultMemoryStoreMetadata(backend.kind),
    ),
    backend.kind,
  );
}

function buildMemoryStoreExportBundle(params: {
  sessionId: string;
  backendKind: MemoryStoreBackendKind;
  metadata: MemoryStoreMetadata;
  snapshot: MemoryStoreSnapshot;
}): MemoryStoreExportBundle {
  return {
    version: 1,
    exportedAt: Date.now(),
    sessionId: params.sessionId,
    backendKind: params.backendKind,
    metadata: params.metadata,
    snapshot: params.snapshot,
  };
}

function clipText(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function deriveSkillFamilyGuidanceLine(entry: LongTermMemoryEntry): string | undefined {
  const familyTags = (entry.environmentTags ?? [])
    .filter((tag) => tag.startsWith("procedural:skill-family:"))
    .map((tag) => tag.replace("procedural:skill-family:", "").trim())
    .filter(Boolean);
  if (familyTags.length === 0) {
    return undefined;
  }
  const family = familyTags[0];
  const consolidation =
    (entry.environmentTags ?? [])
      .find((tag) => tag.startsWith("procedural:consolidation-action:"))
      ?.replace("procedural:consolidation-action:", "")
      .trim() || "none";
  const preferredFallback =
    (entry.environmentTags ?? [])
      .find((tag) => tag.startsWith("procedural:suggested-skill:"))
      ?.replace("procedural:suggested-skill:", "")
      .trim() ||
    (entry.environmentTags ?? [])
      .find((tag) => tag.startsWith("procedural:workflow-step:") && tag.includes(":fallback:"))
      ?.split(":")
      .at(-1)
      ?.trim() ||
    (entry.environmentTags ?? [])
      .find((tag) => tag.startsWith("procedural:ranked-skill:2:"))
      ?.replace(/^procedural:ranked-skill:2:/, "")
      .trim();
  const trend =
    (entry.environmentTags ?? []).includes("procedural:no-viable-fallback") ||
    (entry.environmentTags ?? []).some((tag) => tag.startsWith("procedural:escalate:")) ||
    (entry.environmentTags ?? []).includes("procedural:outcome:failed") ||
    (entry.environmentTags ?? []).includes("procedural:outcome:blocked")
      ? "regressing"
      : (entry.environmentTags ?? []).includes("procedural:near-miss")
        ? "watch"
        : "stable";
  const primarySkill =
    (entry.environmentTags ?? [])
      .find((tag) => tag.startsWith("procedural:primary-skill:"))
      ?.replace("procedural:primary-skill:", "")
      .trim() || "";
  return [
    `family=${family}`,
    `trend=${trend}`,
    consolidation !== "none" ? `consolidation=${consolidation}` : "",
    preferredFallback ? `preferred_fallback=${preferredFallback}` : "",
    primarySkill ? `primary=${primarySkill}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function inferSkillFamilyFromName(skill: string): string {
  const normalized = skill.toLowerCase();
  if (normalized.includes("diagnostic")) {
    return "diagnostics";
  }
  if (
    normalized.includes("acceptance") ||
    normalized.includes("validation") ||
    normalized.includes("report")
  ) {
    return "verification";
  }
  if (normalized.includes("release") || normalized.includes("deploy")) {
    return "release";
  }
  if (normalized.includes("migration")) {
    return "migration";
  }
  const parts = normalized.split(/[^a-z0-9]+/).filter((part) => part.length >= 4);
  return parts[0] ?? normalized;
}

type ProceduralSkillSignal = {
  skill: string;
  family: string;
  taskMode: string;
  workspaceKind: string;
  env: string;
  validation: string;
  score: number;
  updatedAt: number;
};

function collectProceduralSkillSignals(entries: LongTermMemoryEntry[]): ProceduralSkillSignal[] {
  const signals: ProceduralSkillSignal[] = [];
  for (const entry of entries) {
    const rankedSkills = (entry.environmentTags ?? [])
      .filter((tag) => tag.startsWith("procedural:ranked-skill:"))
      .map((tag) => tag.split(":").at(-1)?.trim())
      .filter((skill): skill is string => Boolean(skill));
    const primarySkill =
      (entry.environmentTags ?? [])
        .find((tag) => tag.startsWith("procedural:primary-skill:"))
        ?.replace("procedural:primary-skill:", "")
        .trim() || rankedSkills[0];
    const suggestedSkill =
      (entry.environmentTags ?? [])
        .find((tag) => tag.startsWith("procedural:suggested-skill:"))
        ?.replace("procedural:suggested-skill:", "")
        .trim() || undefined;
    const taskMode =
      (entry.environmentTags ?? [])
        .find((tag) => tag.startsWith("task-mode:"))
        ?.replace("task-mode:", "")
        .trim() || "general";
    const workspaceKind =
      (entry.environmentTags ?? [])
        .find((tag) => tag.startsWith("procedural:workspace:"))
        ?.replace("procedural:workspace:", "")
        .trim() || "unknown";
    const env =
      (entry.environmentTags ?? [])
        .find((tag) => tag.startsWith("procedural:skill-env:"))
        ?.replace("procedural:skill-env:", "")
        .trim() || "unknown";
    const validation =
      (entry.environmentTags ?? [])
        .find((tag) => tag.startsWith("procedural:validation-tool:"))
        ?.replace("procedural:validation-tool:", "")
        .trim() || "unknown";
    const candidateSkills = uniqueStrings(
      [primarySkill, suggestedSkill, ...rankedSkills].filter(
        (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
      ),
    );
    if (candidateSkills.length === 0) {
      continue;
    }
    const outcomeWeight = (entry.environmentTags ?? []).includes("procedural:outcome:verified")
      ? 2
      : (entry.environmentTags ?? []).includes("procedural:outcome:partial")
        ? 0.9
        : (entry.environmentTags ?? []).includes("procedural:outcome:failed") ||
            (entry.environmentTags ?? []).includes("procedural:outcome:blocked")
          ? -1
          : 0;
    const goalWeight = (entry.environmentTags ?? []).includes(
      "procedural:goal-satisfaction:satisfied",
    )
      ? 1
      : (entry.environmentTags ?? []).includes("procedural:goal-satisfaction:partial")
        ? 0.35
        : (entry.environmentTags ?? []).includes("procedural:goal-satisfaction:uncertain")
          ? -0.2
          : 0;
    const fallbackPenalty = (entry.environmentTags ?? []).includes("procedural:no-viable-fallback")
      ? -0.6
      : 0;
    const escalationPenalty = (entry.environmentTags ?? []).some((tag) =>
      tag.startsWith("procedural:escalate:"),
    )
      ? -0.5
      : 0;
    const nearMissPenalty = (entry.environmentTags ?? []).includes("procedural:near-miss")
      ? -0.25
      : 0;
    const baseScore =
      outcomeWeight + goalWeight + fallbackPenalty + escalationPenalty + nearMissPenalty;
    const updatedAt = entry.updatedAt ?? entry.createdAt ?? 0;
    for (const skill of candidateSkills) {
      signals.push({
        skill,
        family: inferSkillFamilyFromName(skill),
        taskMode,
        workspaceKind,
        env,
        validation,
        score: baseScore,
        updatedAt,
      });
    }
  }
  return signals;
}

function deriveSkillEffectivenessGuidance(entries: LongTermMemoryEntry[]): Array<{
  skill: string;
  family: string;
  taskMode: string;
  workspaceKind: string;
  env: string;
  validation: string;
  score: number;
  evidenceCount: number;
}> {
  const scores = new Map<
    string,
    {
      skill: string;
      family: string;
      taskMode: string;
      workspaceKind: string;
      env: string;
      validation: string;
      score: number;
      evidenceCount: number;
    }
  >();
  for (const signal of collectProceduralSkillSignals(entries)) {
    const key = [
      signal.skill,
      signal.taskMode,
      signal.workspaceKind,
      signal.env,
      signal.validation,
    ].join("|");
    const bucket = scores.get(key) ?? {
      skill: signal.skill,
      family: signal.family,
      taskMode: signal.taskMode,
      workspaceKind: signal.workspaceKind,
      env: signal.env,
      validation: signal.validation,
      score: 0,
      evidenceCount: 0,
    };
    bucket.score += signal.score;
    bucket.evidenceCount += 1;
    scores.set(key, bucket);
  }
  return [...scores.values()]
    .map((value) => ({
      skill: value.skill,
      family: value.family,
      taskMode: value.taskMode,
      workspaceKind: value.workspaceKind,
      env: value.env,
      validation: value.validation,
      score: Math.round(value.score * 100) / 100,
      evidenceCount: value.evidenceCount,
    }))
    .toSorted(
      (a, b) =>
        b.score - a.score || b.evidenceCount - a.evidenceCount || a.skill.localeCompare(b.skill),
    )
    .slice(0, 6);
}

function deriveRecoveringScopedSkills(entries: LongTermMemoryEntry[]): string[] {
  const signalsByKey = new Map<string, ProceduralSkillSignal[]>();
  for (const signal of collectProceduralSkillSignals(entries)) {
    const key = `${signal.skill}@${signal.taskMode}/${signal.env}`;
    const bucket = signalsByKey.get(key) ?? [];
    bucket.push(signal);
    signalsByKey.set(key, bucket);
  }
  return [...signalsByKey.entries()]
    .flatMap(([key, signals]) => {
      const sortedSignals = signals.toSorted((a, b) => b.updatedAt - a.updatedAt);
      const latestSignal = sortedSignals[0];
      const earlierNegative = sortedSignals.slice(1).some((signal) => signal.score < 0);
      return latestSignal && latestSignal.score > 0 && earlierNegative ? [key] : [];
    })
    .slice(0, 3);
}

function normalizeComparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CANONICAL_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "for",
  "with",
  "when",
  "while",
  "into",
  "from",
  "that",
  "this",
  "these",
  "those",
  "during",
  "after",
  "before",
  "then",
  "than",
  "each",
  "every",
  "should",
  "would",
  "could",
  "because",
  "through",
  "current",
  "active",
  "session",
  "sessions",
]);

function singularizeToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

const CANONICAL_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bmemory system\b/g, "memory-system"],
  [/\bmemory system path\b/g, "memory-system-path"],
  [/\bpath for memory-system integration\b/g, "memory-system-path"],
  [/\bpermanent path\b/g, "permanent memory-system-path"],
  [/\bcarry forward\b/g, "carry-forward"],
  [/\blong term\b/g, "long-term"],
  [/\bnode tree\b/g, "node-tree"],
  [/\bold workaround\b/g, "legacy-workaround"],
  [/\bshould be used\b/g, "use"],
  [/\bbe used\b/g, "use"],
  [/\bneed to use\b/g, "use"],
  [/\bneeds to use\b/g, "use"],
  [/\bhas to use\b/g, "use"],
  [/\bmust use\b/g, "use"],
  [/\bshould use\b/g, "use"],
  [/\bcontinue using\b/g, "use"],
  [/\bcontinue with\b/g, "use"],
  [/\bis required\b/g, "required"],
  [/\bdo not use\b/g, "avoid use"],
  [/\bmust not use\b/g, "avoid use"],
  [/\bshould not use\b/g, "avoid use"],
  [/\bno longer use\b/g, "stop using"],
  [/\bshould continue from\b/g, "continue"],
  [/\bcontinue from\b/g, "continue"],
  [/\bused for\b/g, "use"],
  [/\busing\b/g, "use"],
  [/\bcompleted\b/g, "complete"],
  [/\bfinished\b/g, "complete"],
  [/\bresolved\b/g, "resolve"],
  [/\bfixed\b/g, "fix"],
];

function normalizeConceptPhraseText(text: string): string {
  let normalized = normalizeComparable(text);
  for (const [pattern, replacement] of CANONICAL_PHRASE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

function buildCanonicalTokenSignature(text: string): string[] {
  return uniqueStrings(
    normalizeConceptPhraseText(text)
      .split(/\s+/)
      .map((token) => singularizeToken(token))
      .filter((token) => token && !CANONICAL_STOP_WORDS.has(token) && token.length >= 3),
  ).toSorted();
}

function canonicalizeComparable(text: string): string {
  return buildCanonicalTokenSignature(text).join(" ").trim();
}

function stableHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function tokenize(text: string): string[] {
  return normalizeComparable(text)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function mergeProvenance(
  existing: MemoryProvenanceRecord[],
  incoming: MemoryProvenanceRecord[],
): MemoryProvenanceRecord[] {
  const seen = new Set<string>();
  const merged: MemoryProvenanceRecord[] = [];
  for (const item of [...existing, ...incoming]) {
    const key = `${item.kind}:${normalizeComparable(item.detail)}:${(item.derivedFromMemoryIds ?? []).join(",")}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({
      ...item,
      derivedFromMemoryIds: uniqueIds(item.derivedFromMemoryIds ?? []),
    });
  }
  return merged.slice(-MAX_WORKING_ITEMS);
}

function cloneLongTermEntry(entry: LongTermMemoryEntry): LongTermMemoryEntry {
  return {
    ...entry,
    conceptAliases: [...(entry.conceptAliases ?? [])],
    entityAliases: [...(entry.entityAliases ?? [])],
    entityIds: [...(entry.entityIds ?? [])],
    evidence: [...entry.evidence],
    permanenceReasons: [...(entry.permanenceReasons ?? [])],
    provenance: entry.provenance.map((item) => ({
      ...item,
      derivedFromMemoryIds: [...(item.derivedFromMemoryIds ?? [])],
    })),
    relatedMemoryIds: [...entry.relatedMemoryIds],
    relations: (entry.relations ?? []).map((relation) => ({ ...relation })),
  };
}

function clonePendingEntry(entry: PendingMemoryEntry): PendingMemoryEntry {
  return {
    ...entry,
    evidence: [...entry.evidence],
    provenance: entry.provenance.map((item) => ({
      ...item,
      derivedFromMemoryIds: [...(item.derivedFromMemoryIds ?? [])],
    })),
    relatedMemoryIds: [...entry.relatedMemoryIds],
    relations: (entry.relations ?? []).map((relation) => ({ ...relation })),
  };
}

function mergeRelations(existing: MemoryRelation[], incoming: MemoryRelation[]): MemoryRelation[] {
  const merged = new Map<string, MemoryRelation>();
  for (const relation of [...existing, ...incoming]) {
    const key = `${relation.sourceMemoryId ?? ""}:${relation.type}:${relation.targetMemoryId}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...relation });
      continue;
    }
    current.weight = Math.max(current.weight, relation.weight);
  }
  return [...merged.values()].toSorted((a, b) => b.weight - a.weight).slice(0, MAX_WORKING_ITEMS);
}

function dedupeLongTermCandidates(entries: LongTermMemoryEntry[]): LongTermMemoryEntry[] {
  const bySemanticKey = new Map<string, LongTermMemoryEntry>();
  for (const entry of entries) {
    const key = entry.semanticKey || normalizeComparable(entry.text);
    const current = bySemanticKey.get(key);
    if (!current) {
      bySemanticKey.set(key, cloneLongTermEntry(entry));
      continue;
    }
    current.evidence = dedupeTexts([...current.evidence, ...entry.evidence], MAX_WORKING_ITEMS);
    current.provenance = mergeProvenance(current.provenance, entry.provenance);
    current.strength = Math.max(current.strength, entry.strength);
    current.confidence = Math.max(current.confidence, entry.confidence);
    current.conceptAliases = uniqueStrings([
      ...(current.conceptAliases ?? []),
      ...(entry.conceptAliases ?? []),
      entry.text,
    ]);
    current.entityAliases = uniqueStrings([
      ...(current.entityAliases ?? []),
      ...(entry.entityAliases ?? []),
      ...buildResolvedEntityAliases(entry),
    ]);
    current.entityIds = uniqueIds([...(current.entityIds ?? []), ...(entry.entityIds ?? [])]);
    current.updatedAt = Math.max(current.updatedAt, entry.updatedAt);
  }
  return [...bySemanticKey.values()].toSorted((a, b) => b.updatedAt - a.updatedAt);
}

function createEmptyGraph(): MemoryGraphSnapshot {
  return {
    nodes: [],
    edges: [],
    updatedAt: Date.now(),
  };
}

function createProvenanceRecord(
  kind: MemoryProvenanceRecord["kind"],
  detail: string,
  derivedFromMemoryIds?: string[],
): MemoryProvenanceRecord {
  return {
    kind,
    detail: clipText(detail, 180),
    recordedAt: Date.now(),
    derivedFromMemoryIds: uniqueIds(derivedFromMemoryIds ?? []),
  };
}

function inferOntologyKind(category: MemoryCategory, text: string): MemoryOntologyKind {
  const normalizedText = normalizeConceptPhraseText(text);
  if (
    category === "decision" ||
    /\b(must|required|always|never|constraint|preserve|keep|use|used|preferred)\b/i.test(
      normalizedText,
    )
  ) {
    return "constraint";
  }
  if (
    category === "episode" ||
    /\b(fixed|resolved|preserved|restored|regression|outcome|result|workaround)\b/i.test(
      normalizedText,
    )
  ) {
    return "outcome";
  }
  if (category === "pattern" || category === "strategy") {
    return "pattern";
  }
  if (category === "entity") {
    return "entity";
  }
  if (category === "preference") {
    return "preference";
  }
  return "fact";
}

function inferAdjudicationStatus(params: {
  activeStatus: MemoryActiveStatus;
  contradictionCount: number;
}): MemoryAdjudicationStatus {
  if (params.activeStatus === "superseded") {
    return "superseded";
  }
  if (params.contradictionCount > 0 || params.activeStatus === "pending") {
    return "contested";
  }
  return "authoritative";
}

function areCompatibleMemoryCategories(left: MemoryCategory, right: MemoryCategory): boolean {
  if (left === right) {
    return true;
  }
  const instructionFamily = new Set<MemoryCategory>(["decision", "strategy"]);
  if (instructionFamily.has(left) && instructionFamily.has(right)) {
    return true;
  }
  const observationalFamily = new Set<MemoryCategory>(["fact", "episode"]);
  if (observationalFamily.has(left) && observationalFamily.has(right)) {
    return true;
  }
  return false;
}

function areCompatibleOntologyKinds(left: MemoryOntologyKind, right: MemoryOntologyKind): boolean {
  if (left === right) {
    return true;
  }
  const instructionFamily = new Set<MemoryOntologyKind>(["constraint", "pattern"]);
  if (instructionFamily.has(left) && instructionFamily.has(right)) {
    return true;
  }
  return false;
}

function classifyRevisionKind(
  current: Pick<LongTermMemoryEntry, "text" | "category">,
  incoming: Pick<LongTermMemoryEntry, "text" | "category">,
): MemoryRevisionKind {
  if (normalizeComparable(current.text) === normalizeComparable(incoming.text)) {
    return "reasserted";
  }
  if (isContradictoryPair(current as LongTermMemoryEntry, incoming as LongTermMemoryEntry)) {
    return "contested";
  }
  const currentTokens = tokenize(current.text);
  const incomingTokens = tokenize(incoming.text);
  const shared = incomingTokens.filter((token) => currentTokens.includes(token));
  if (
    incomingTokens.length > currentTokens.length &&
    shared.length >= Math.max(3, Math.floor(currentTokens.length * 0.6))
  ) {
    return "narrowed";
  }
  return "updated";
}

function sourceTypeReliabilityScore(sourceType: MemorySourceType): number {
  switch (sourceType) {
    case "direct_observation":
      return 4;
    case "user_stated":
      return 3;
    case "system_inferred":
      return 2;
    case "summary_derived":
      return 1;
    default:
      return 0;
  }
}

function createSourceTypeCounts(): Record<MemorySourceType, number> {
  return {
    user_stated: 0,
    direct_observation: 0,
    summary_derived: 0,
    system_inferred: 0,
  };
}

function isWeakEvidenceSource(sourceType: MemorySourceType): boolean {
  return sourceType === "summary_derived" || sourceType === "system_inferred";
}

function inferMessageSourceType(text: string): MemorySourceType {
  if (
    /\b(i|we)\s+(observed|verified|confirmed|saw|tested)\b/i.test(text) ||
    /\bobserved directly\b/i.test(text) ||
    /\bdirect observation\b/i.test(text)
  ) {
    return "direct_observation";
  }
  if (/\bsummary says\b/i.test(text) || /\bsummar(?:y|ized)\b/i.test(text)) {
    return "summary_derived";
  }
  return "user_stated";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMemorySemanticKey(params: {
  category: MemoryCategory;
  text: string;
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  artifactRefs?: string[];
}): string {
  return [
    inferOntologyKind(params.category, params.text),
    params.category,
    normalizeComparable(params.text),
    normalizeComparable(params.versionScope ?? ""),
    normalizeComparable(params.installProfileScope ?? ""),
    normalizeComparable(params.customerScope ?? ""),
    uniqueStrings(params.artifactRefs ?? [])
      .map((item) => normalizeComparable(item))
      .join("|"),
  ].join("::");
}

function buildMemoryConceptKey(params: {
  category: MemoryCategory;
  ontologyKind?: MemoryOntologyKind;
  text: string;
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  artifactRefs?: string[];
}): string {
  return [
    params.ontologyKind ?? inferOntologyKind(params.category, params.text),
    params.category,
    canonicalizeComparable(params.text),
    normalizeComparable(params.versionScope ?? ""),
    normalizeComparable(params.installProfileScope ?? ""),
    normalizeComparable(params.customerScope ?? ""),
    uniqueStrings(params.artifactRefs ?? [])
      .map((item) => normalizeComparable(item))
      .join("|"),
  ].join("::");
}

function buildMemoryConceptFamilyKey(params: {
  category: MemoryCategory;
  ontologyKind?: MemoryOntologyKind;
  text: string;
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  artifactRefs?: string[];
}): string {
  let familyText = normalizeConceptPhraseText(params.text)
    .replace(/\bv\d+(?:\.\d+)+(?:-\d+)?\b/gi, " ")
    .replace(/\binstall profile\s+[a-z0-9._-]+\b/gi, " ")
    .replace(/\bprofile\s+[a-z0-9._-]+\b/gi, " ")
    .replace(/\bcustomer\s+[a-z0-9._-]+\b/gi, " ")
    .replace(/\buser\s+[a-z0-9._-]+\b/gi, " ");
  if (params.versionScope) {
    familyText = familyText.replace(
      new RegExp(`\\b${escapeRegExp(params.versionScope)}\\b`, "gi"),
      " ",
    );
    for (const token of tokenize(params.versionScope)) {
      familyText = familyText.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi"), " ");
    }
  }
  if (params.installProfileScope) {
    familyText = familyText.replace(
      new RegExp(`\\b${escapeRegExp(params.installProfileScope)}\\b`, "gi"),
      " ",
    );
    for (const token of tokenize(params.installProfileScope)) {
      familyText = familyText.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi"), " ");
    }
  }
  if (params.customerScope) {
    familyText = familyText.replace(
      new RegExp(`\\b${escapeRegExp(params.customerScope)}\\b`, "gi"),
      " ",
    );
    for (const token of tokenize(params.customerScope)) {
      familyText = familyText.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi"), " ");
    }
  }
  const normalizedFamilyText = canonicalizeComparable(familyText);
  return [
    params.ontologyKind ?? inferOntologyKind(params.category, params.text),
    params.category,
    normalizedFamilyText,
    uniqueStrings(params.artifactRefs ?? [])
      .map((item) => normalizeComparable(item))
      .join("|"),
  ].join("::");
}

function getEntryConceptFamilyKey(
  entry: Pick<
    LongTermMemoryEntry,
    | "category"
    | "ontologyKind"
    | "canonicalText"
    | "text"
    | "artifactRefs"
    | "versionScope"
    | "installProfileScope"
    | "customerScope"
  >,
): string {
  return buildMemoryConceptFamilyKey({
    category: entry.category,
    ontologyKind: entry.ontologyKind,
    text: entry.text,
    versionScope: entry.versionScope,
    installProfileScope: entry.installProfileScope,
    customerScope: entry.customerScope,
    artifactRefs: entry.artifactRefs,
  });
}

function buildScopeSignature(
  entry: Pick<LongTermMemoryEntry, "versionScope" | "installProfileScope" | "customerScope">,
): string {
  return [
    normalizeComparable(entry.versionScope ?? ""),
    normalizeComparable(entry.installProfileScope ?? ""),
    normalizeComparable(entry.customerScope ?? ""),
  ].join("::");
}

function countExplicitScopeMatches(
  entry: Pick<LongTermMemoryEntry, "versionScope" | "installProfileScope" | "customerScope">,
  scopeContext?: MemoryScopeContext,
): number {
  if (!scopeContext) {
    return 0;
  }
  let matches = 0;
  if (scopeContext.versionScope && entry.versionScope === scopeContext.versionScope) {
    matches += 1;
  }
  if (
    scopeContext.installProfileScope &&
    entry.installProfileScope === scopeContext.installProfileScope
  ) {
    matches += 1;
  }
  if (scopeContext.customerScope && entry.customerScope === scopeContext.customerScope) {
    matches += 1;
  }
  return matches;
}

function countExplicitScopeConflicts(
  entry: Pick<LongTermMemoryEntry, "versionScope" | "installProfileScope" | "customerScope">,
  scopeContext?: MemoryScopeContext,
): number {
  if (!scopeContext) {
    return 0;
  }
  let conflicts = 0;
  if (
    scopeContext.versionScope &&
    entry.versionScope &&
    entry.versionScope !== scopeContext.versionScope
  ) {
    conflicts += 1;
  }
  if (
    scopeContext.installProfileScope &&
    entry.installProfileScope &&
    entry.installProfileScope !== scopeContext.installProfileScope
  ) {
    conflicts += 1;
  }
  if (
    scopeContext.customerScope &&
    entry.customerScope &&
    entry.customerScope !== scopeContext.customerScope
  ) {
    conflicts += 1;
  }
  return conflicts;
}

function hasExplicitEnvironmentConflict(
  entry: Pick<LongTermMemoryEntry, "environmentTags">,
  scopeContext?: MemoryScopeContext,
): boolean {
  if (!scopeContext?.environmentTags?.length || !entry.environmentTags?.length) {
    return false;
  }
  const relevantQueryTags = scopeContext.environmentTags.filter((tag) =>
    ["linux", "macos", "windows", "docker", "pnpm", "npm", "node", "typescript"].includes(tag),
  );
  const relevantEntryTags = entry.environmentTags.filter((tag) =>
    ["linux", "macos", "windows", "docker", "pnpm", "npm", "node", "typescript"].includes(tag),
  );
  if (relevantQueryTags.length === 0 || relevantEntryTags.length === 0) {
    return false;
  }
  return !relevantEntryTags.some((tag) => relevantQueryTags.includes(tag));
}

function hasExplicitScopeContext(scopeContext?: MemoryScopeContext): boolean {
  return Boolean(
    scopeContext?.versionScope || scopeContext?.installProfileScope || scopeContext?.customerScope,
  );
}

function resolveEntryAdjudication(
  entry: Pick<LongTermMemoryEntry, "conceptKey" | "semanticKey">,
  adjudications?: PersistedMemoryAdjudication[],
): PersistedMemoryAdjudication | undefined {
  return adjudications?.find((item) => item.conceptId === getEntryConceptId(entry));
}

function shouldIncludeScopedEntry(params: {
  entry: LongTermMemoryEntry;
  taskMode: MemoryTaskMode;
  scopeContext?: MemoryScopeContext;
  adjudications?: PersistedMemoryAdjudication[];
}): boolean {
  const adjudication = resolveEntryAdjudication(params.entry, params.adjudications);
  if (
    adjudication?.status === "contested" &&
    params.taskMode !== "debugging" &&
    params.taskMode !== "support"
  ) {
    return false;
  }
  if (
    hasExplicitScopeContext(params.scopeContext) &&
    countExplicitScopeConflicts(params.entry, params.scopeContext) > 0 &&
    params.taskMode !== "debugging"
  ) {
    return false;
  }
  if (
    hasExplicitScopeContext(params.scopeContext) &&
    countExplicitScopeMatches(params.entry, params.scopeContext) === 0 &&
    (params.entry.versionScope || params.entry.installProfileScope || params.entry.customerScope) &&
    params.taskMode !== "debugging"
  ) {
    return false;
  }
  if (
    hasExplicitEnvironmentConflict(params.entry, params.scopeContext) &&
    params.taskMode !== "debugging"
  ) {
    return false;
  }
  if (
    adjudication?.resolutionKind === "scoped_alternative" &&
    hasExplicitScopeContext(params.scopeContext) &&
    countExplicitScopeMatches(params.entry, params.scopeContext) === 0 &&
    params.taskMode !== "debugging"
  ) {
    return false;
  }
  return true;
}

function evaluatePermanenceStatus(
  entry: Pick<
    LongTermMemoryEntry,
    | "importanceClass"
    | "confidence"
    | "strength"
    | "revisionCount"
    | "adjudicationStatus"
    | "activeStatus"
    | "category"
    | "ontologyKind"
    | "contradictionCount"
    | "artifactRefs"
  >,
): { status: MemoryPermanenceStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (entry.activeStatus === "superseded") {
    return {
      status: "blocked",
      reasons: ["superseded memory is not eligible for permanent truth"],
    };
  }
  if (entry.adjudicationStatus === "contested" || entry.contradictionCount > 0) {
    return {
      status: "blocked",
      reasons: ["contested memory requires adjudication before permanence"],
    };
  }
  if (entry.importanceClass === "temporary") {
    return {
      status: "blocked",
      reasons: ["temporary memory should remain outside permanent memory"],
    };
  }
  if (
    entry.importanceClass === "critical" ||
    entry.ontologyKind === "constraint" ||
    entry.category === "decision"
  ) {
    reasons.push("constraint or critical memory qualifies for permanent retention");
  }
  if (entry.revisionCount >= 1) {
    reasons.push("memory has recurrence or revision support");
  }
  if ((entry.artifactRefs ?? []).length > 0) {
    reasons.push("memory is anchored to a durable artifact");
  }
  if (entry.confidence >= 0.9 || entry.strength >= 0.9) {
    reasons.push("memory has high confidence or strength");
  }
  if (reasons.length > 0) {
    return { status: "eligible", reasons };
  }
  return {
    status: "deferred",
    reasons: ["memory remains durable but lacks enough evidence for permanent promotion"],
  };
}

function buildStableMemoryId(prefix: "ltm" | "pattern", semanticKey: string): string {
  return `${prefix}-${stableHash(semanticKey)}`;
}

function buildStableConceptId(conceptKey: string): string {
  return `concept-${stableHash(conceptKey)}`;
}

function getEntryConceptId(entry: Pick<LongTermMemoryEntry, "conceptKey" | "semanticKey">): string {
  return buildStableConceptId(entry.conceptKey || entry.semanticKey);
}

function countSharedEntityIds(
  a: Pick<LongTermMemoryEntry, "entityIds">,
  b: Pick<LongTermMemoryEntry, "entityIds">,
): number {
  if (!a.entityIds?.length || !b.entityIds?.length) {
    return 0;
  }
  const right = new Set(b.entityIds);
  return a.entityIds.filter((id) => right.has(id)).length;
}

function countSharedResolvedEntityAliases(
  a: Pick<
    LongTermMemoryEntry,
    | "text"
    | "versionScope"
    | "installProfileScope"
    | "customerScope"
    | "environmentTags"
    | "artifactRefs"
    | "entityAliases"
  >,
  b: Pick<
    LongTermMemoryEntry,
    | "text"
    | "versionScope"
    | "installProfileScope"
    | "customerScope"
    | "environmentTags"
    | "artifactRefs"
    | "entityAliases"
  >,
): number {
  const left = new Set(
    uniqueStrings([...(a.entityAliases ?? []), ...buildResolvedEntityAliases(a)]).map((alias) =>
      normalizeComparable(alias),
    ),
  );
  const right = new Set(
    uniqueStrings([...(b.entityAliases ?? []), ...buildResolvedEntityAliases(b)]).map((alias) =>
      normalizeComparable(alias),
    ),
  );
  let overlap = 0;
  for (const alias of left) {
    if (right.has(alias)) {
      overlap += 1;
    }
  }
  return overlap;
}

function countCanonicalEntityKindOverlap(
  a: Pick<
    LongTermMemoryEntry,
    | "text"
    | "versionScope"
    | "installProfileScope"
    | "customerScope"
    | "environmentTags"
    | "artifactRefs"
    | "entityAliases"
  >,
  b: Pick<
    LongTermMemoryEntry,
    | "text"
    | "versionScope"
    | "installProfileScope"
    | "customerScope"
    | "environmentTags"
    | "artifactRefs"
    | "entityAliases"
  >,
): number {
  const left = new Set(buildCanonicalEntityKinds(a));
  const right = new Set(buildCanonicalEntityKinds(b));
  let overlap = 0;
  for (const kind of left) {
    if (right.has(kind)) {
      overlap += 1;
    }
  }
  return overlap;
}

function findConceptMatch(
  entries: Iterable<LongTermMemoryEntry>,
  incoming: LongTermMemoryEntry,
): LongTermMemoryEntry | undefined {
  if (
    /\b(replaced|replace|no longer|obsolete|superseded)\b/i.test(incoming.text) ||
    /\bfixed permanently\b/i.test(incoming.text) ||
    /\binstead\s+of\b/i.test(incoming.text)
  ) {
    return undefined;
  }
  let best: LongTermMemoryEntry | undefined;
  let bestScore = 0;
  const incomingCanonicalTokens = new Set(tokenize(incoming.canonicalText || incoming.text));
  const incomingSignature = new Set(buildCanonicalTokenSignature(incoming.text));
  const incomingEntityAliases = new Set(
    buildResolvedEntityAliases(incoming).map((alias) => normalizeComparable(alias)),
  );
  const incomingCanonicalEntityKeys = new Set(buildCanonicalEntityKeys(incoming));
  const incomingCanonicalEntityKinds = new Set(buildCanonicalEntityKinds(incoming));
  const incomingEntities = buildMemoryEntitySignature({
    text: incoming.text,
    versionScope: incoming.versionScope,
    installProfileScope: incoming.installProfileScope,
    customerScope: incoming.customerScope,
    environmentTags: incoming.environmentTags,
    artifactRefs: incoming.artifactRefs,
  });
  for (const candidate of entries) {
    if (
      candidate.conceptKey &&
      incoming.conceptKey &&
      candidate.conceptKey === incoming.conceptKey
    ) {
      return candidate;
    }
    if (!areCompatibleMemoryCategories(candidate.category, incoming.category)) {
      continue;
    }
    if (!areCompatibleOntologyKinds(candidate.ontologyKind, incoming.ontologyKind)) {
      continue;
    }
    if (
      candidate.versionScope &&
      incoming.versionScope &&
      candidate.versionScope !== incoming.versionScope
    ) {
      continue;
    }
    if (
      candidate.installProfileScope &&
      incoming.installProfileScope &&
      candidate.installProfileScope !== incoming.installProfileScope
    ) {
      continue;
    }
    if (
      candidate.customerScope &&
      incoming.customerScope &&
      candidate.customerScope !== incoming.customerScope
    ) {
      continue;
    }
    if (isContradictoryPair(candidate, incoming)) {
      continue;
    }
    const overlap = computeOverlapScore(candidate.text, new Set(tokenize(incoming.text)));
    const canonicalOverlap = computeOverlapScore(
      candidate.canonicalText || candidate.text,
      incomingCanonicalTokens,
    );
    const signatureOverlap = [...buildCanonicalTokenSignature(candidate.text)].filter((token) =>
      incomingSignature.has(token),
    ).length;
    const signatureCoverage =
      incomingSignature.size > 0 ? signatureOverlap / incomingSignature.size : 0;
    const entityOverlap = countEntitySignatureOverlap(
      buildMemoryEntitySignature({
        text: candidate.text,
        versionScope: candidate.versionScope,
        installProfileScope: candidate.installProfileScope,
        customerScope: candidate.customerScope,
        environmentTags: candidate.environmentTags,
        artifactRefs: candidate.artifactRefs,
      }),
      incomingEntities,
    );
    const entityAliasOverlap = uniqueStrings([
      ...(candidate.entityAliases ?? []),
      ...buildResolvedEntityAliases(candidate),
    ]).filter((alias) => incomingEntityAliases.has(normalizeComparable(alias))).length;
    const entityAliasCoverage =
      incomingEntityAliases.size > 0 ? entityAliasOverlap / incomingEntityAliases.size : 0;
    const canonicalEntityOverlap = buildCanonicalEntityKeys(candidate).filter((key) =>
      incomingCanonicalEntityKeys.has(key),
    ).length;
    const canonicalEntityCoverage =
      incomingCanonicalEntityKeys.size > 0
        ? canonicalEntityOverlap / incomingCanonicalEntityKeys.size
        : 0;
    const canonicalEntityKindOverlap = countCanonicalEntityKindOverlap(candidate, incoming);
    const canonicalEntityKindCoverage =
      incomingCanonicalEntityKinds.size > 0
        ? canonicalEntityKindOverlap / incomingCanonicalEntityKinds.size
        : 0;
    const aliasOverlap = Math.max(
      0,
      ...(candidate.conceptAliases ?? []).map((alias) =>
        computeOverlapScore(alias, incomingCanonicalTokens),
      ),
    );
    const candidateRuntimeTags = (candidate.environmentTags ?? []).filter((tag) =>
      /^(runtime:|checkpoint:|diff:)/.test(tag),
    );
    const incomingRuntimeTags = (incoming.environmentTags ?? []).filter((tag) =>
      /^(runtime:|checkpoint:|diff:)/.test(tag),
    );
    const runtimeTagOverlap = candidateRuntimeTags.filter((tag) =>
      incomingRuntimeTags.includes(tag),
    ).length;
    const artifactOverlap = (candidate.artifactRefs ?? []).filter((ref) =>
      (incoming.artifactRefs ?? []).includes(ref),
    ).length;
    if (
      candidateRuntimeTags.length > 0 &&
      incomingRuntimeTags.length > 0 &&
      runtimeTagOverlap === 0
    ) {
      continue;
    }
    if (
      artifactOverlap === 0 &&
      Boolean((candidate.artifactRefs ?? []).length) !==
        Boolean((incoming.artifactRefs ?? []).length)
    ) {
      continue;
    }
    const scopeOverlap =
      Number(candidate.versionScope === incoming.versionScope && Boolean(candidate.versionScope)) +
      Number(
        candidate.installProfileScope === incoming.installProfileScope &&
          Boolean(candidate.installProfileScope),
      ) +
      Number(
        candidate.customerScope === incoming.customerScope && Boolean(candidate.customerScope),
      );
    const score =
      overlap +
      canonicalOverlap * 2 +
      signatureOverlap * 2 +
      aliasOverlap +
      entityAliasOverlap * 2 +
      canonicalEntityOverlap * 2.5 +
      canonicalEntityKindOverlap * 1.25 +
      entityOverlap +
      artifactOverlap * 3 +
      scopeOverlap * 2 +
      runtimeTagOverlap * 2;
    if (
      score >= 6 &&
      (signatureCoverage >= 0.45 ||
        entityAliasCoverage >= 0.5 ||
        canonicalEntityCoverage >= 0.5 ||
        canonicalEntityKindCoverage >= 0.75) &&
      (score > bestScore ||
        (score === bestScore &&
          ((candidate.updatedAt ?? 0) > (best?.updatedAt ?? 0) ||
            candidate.confidence > (best?.confidence ?? 0))))
    ) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function dedupeTexts(items: string[], limit = MAX_WORKING_ITEMS): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const clipped = clipText(item);
    if (!clipped) {
      continue;
    }
    const key = normalizeComparable(clipped);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(clipped);
    if (output.length >= limit) {
      break;
    }
  }
  return output;
}

export function extractMessageText(message: AgentMessage): string {
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const typedBlock = block as { type?: unknown; text?: unknown };
    if (typedBlock.type === "text" && typeof typedBlock.text === "string") {
      parts.push(typedBlock.text);
    }
  }
  return parts.join("\n").trim();
}

function gatherRelevantLines(messages: AgentMessage[]): string[] {
  const lines: string[] = [];
  for (const message of messages) {
    const text = extractMessageText(message);
    if (!text) {
      continue;
    }
    for (const line of text.split(/\n+/)) {
      const trimmed = line.trim();
      if (trimmed) {
        lines.push(trimmed);
      }
    }
  }
  return lines;
}

function filterByPattern(lines: string[], pattern: RegExp): string[] {
  return lines.filter((line) => pattern.test(line));
}

function computeOverlapScore(target: string, queryTokens: Set<string>): number {
  if (queryTokens.size === 0) {
    return 0;
  }
  let score = 0;
  for (const token of tokenize(target)) {
    if (queryTokens.has(token)) {
      score += 1;
    }
  }
  return score;
}

export function buildWorkingMemorySnapshot(params: {
  sessionId: string;
  messages: AgentMessage[];
  previous?: WorkingMemorySnapshot;
  compactionSummary?: string;
  runtimeContext?: ContextEngineRuntimeContext;
}): WorkingMemorySnapshot {
  const lines = gatherRelevantLines(params.messages);
  const recentEvents = dedupeTexts(lines.slice(-MAX_WORKING_ITEMS).toReversed()).toReversed();
  const activeFacts = dedupeTexts(
    filterByPattern(
      lines,
      /\b(my|our|we are|i am|this bot|the bot|memory system|context|long[- ]term|permanent)\b/i,
    ).toReversed(),
  ).toReversed();
  const activeGoals = dedupeTexts(
    filterByPattern(
      lines,
      /\b(build|implement|need to|going to|plan to|want to|next|todo|integrate|adjust|revert|create)\b/i,
    ).toReversed(),
  ).toReversed();
  const openLoops = dedupeTexts(
    lines
      .filter((line) => line.endsWith("?") || /\b(how|what|should|need to|next)\b/i.test(line))
      .toReversed(),
  ).toReversed();
  const recentDecisions = dedupeTexts(
    filterByPattern(
      lines,
      /\b(decided|will use|use .* as|revert|remove \.git|create a new git repo|slot|context-engine)\b/i,
    ).toReversed(),
  ).toReversed();
  const rollingSummary = clipText(
    [
      activeGoals[activeGoals.length - 1],
      recentDecisions[recentDecisions.length - 1],
      recentEvents[recentEvents.length - 1],
    ]
      .filter(Boolean)
      .join(" | "),
    320,
  );

  return {
    sessionId: params.sessionId,
    updatedAt: Date.now(),
    rollingSummary,
    carryForwardSummary: params.previous?.carryForwardSummary,
    lastWorkspaceBranch:
      params.runtimeContext &&
      typeof params.runtimeContext.workspaceState === "object" &&
      params.runtimeContext.workspaceState &&
      typeof (params.runtimeContext.workspaceState as { gitBranch?: unknown }).gitBranch ===
        "string"
        ? ((params.runtimeContext.workspaceState as { gitBranch?: string }).gitBranch ?? undefined)
        : params.previous?.lastWorkspaceBranch,
    activeFacts,
    activeGoals,
    openLoops,
    recentEvents,
    recentDecisions,
    lastCompactionSummary: params.compactionSummary ?? params.previous?.lastCompactionSummary,
  };
}

function detectCandidateCategory(text: string): MemoryCategory | null {
  if (/\b(prefer|do not want|don't want|always|never)\b/i.test(text)) {
    return "preference";
  }
  if (/\b(decided|will use|revert|remove \.git|create a new git repo|use .* as)\b/i.test(text)) {
    return "decision";
  }
  if (
    /\b(memory system|context compression|node tree|context-engine|long[- ]term|permanent)\b/i.test(
      text,
    )
  ) {
    return "strategy";
  }
  if (/\b(project|repo|bot|agent)\b/i.test(text)) {
    return "entity";
  }
  if (/\b(is|are|has|have|must)\b/i.test(text)) {
    return "fact";
  }
  return null;
}

function baseStrengthForCategory(category: MemoryCategory): number {
  switch (category) {
    case "decision":
      return 0.92;
    case "strategy":
      return 0.86;
    case "preference":
      return 0.82;
    case "entity":
      return 0.78;
    case "fact":
      return 0.72;
    default:
      return 0.66;
  }
}

function detectImportanceClass(category: MemoryCategory, text: string): MemoryImportanceClass {
  if (
    category === "decision" ||
    /\b(must|required|critical|always|never|revert to tag|remove \.git|new git repo)\b/i.test(text)
  ) {
    return "critical";
  }
  if (category === "strategy" || category === "preference" || category === "entity") {
    return "useful";
  }
  if (category === "episode") {
    return "temporary";
  }
  return "temporary";
}

function detectTaskMode(
  messages: AgentMessage[],
  workingMemory?: WorkingMemorySnapshot,
): MemoryTaskMode {
  const corpus = [
    ...messages.map((message) => extractMessageText(message)).filter(Boolean),
    workingMemory?.rollingSummary ?? "",
    ...(workingMemory?.activeGoals ?? []),
  ]
    .join(" ")
    .toLowerCase();
  if (/\b(code|coding|repo|file|refactor|typescript|test|compile|context engine)\b/.test(corpus)) {
    return "coding";
  }
  if (/\b(bug|debug|error|issue|fail|broken|trace|diagnose)\b/.test(corpus)) {
    return "debugging";
  }
  if (/\b(customer|support|ticket|install|user issue|profile)\b/.test(corpus)) {
    return "support";
  }
  if (/\b(plan|roadmap|next|architecture|design|implement)\b/.test(corpus)) {
    return "planning";
  }
  if (/\b(why|concept|theory|define|meaning|model)\b/.test(corpus)) {
    return "conceptual";
  }
  return "research";
}

function extractVersionScope(text: string): string | undefined {
  const match =
    text.match(/\bv\d+(?:\.\d+)+(?:-\d+)?\b/i) ??
    text.match(/\bversion\s+([0-9]+(?:\.[0-9]+)+)\b/i);
  return match?.[0]?.trim();
}

function extractInstallProfileScope(text: string): string | undefined {
  const match =
    text.match(/\binstall profile\s+([a-z0-9._-]+)/i) ?? text.match(/\bprofile\s+([a-z0-9._-]+)/i);
  return match?.[1]?.trim().replace(/[.,;:!?]+$/, "");
}

function extractCustomerScope(text: string): string | undefined {
  const match =
    text.match(/\bcustomer\s+([a-z0-9._-]+)/i) ?? text.match(/\buser\s+([a-z0-9._-]+)/i);
  return match?.[1]?.trim().replace(/[.,;:!?]+$/, "");
}

function extractEnvironmentTags(text: string): string[] {
  const tags = [
    "linux",
    "macos",
    "windows",
    "docker",
    "pnpm",
    "npm",
    "node",
    "typescript",
    "slack",
    "discord",
    "telegram",
  ];
  const normalized = text.toLowerCase();
  return tags.filter((tag) => normalized.includes(tag));
}

function extractArtifactRefs(text: string): string[] {
  const matches = text.match(/\b[\w./-]+\.(?:ts|tsx|js|json|jsonl|md|yml|yaml|toml|lock)\b/g) ?? [];
  const pathLike = text.match(/\b(?:src|docs|config|packages|apps)\/[\w./-]+\b/g) ?? [];
  return uniqueStrings([...matches, ...pathLike]).slice(0, MAX_WORKING_ITEMS);
}

type MemoryEntitySignature = {
  versions: string[];
  installProfiles: string[];
  customers: string[];
  environments: string[];
  artifacts: string[];
  artifactBasenames: string[];
};

function buildMemoryEntitySignature(params: {
  text?: string;
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  environmentTags?: string[];
  artifactRefs?: string[];
}): MemoryEntitySignature {
  const text = params.text ?? "";
  const artifactRefs = uniqueStrings([
    ...(params.artifactRefs ?? []),
    ...extractArtifactRefs(text),
  ]);
  const artifactBasenames = uniqueStrings(
    artifactRefs
      .map((ref) => path.basename(ref))
      .flatMap((basename) => {
        const extension = path.extname(basename);
        const withoutExtension =
          extension.length > 0 ? basename.slice(0, -extension.length) : basename;
        return uniqueStrings([basename, withoutExtension]);
      }),
  );
  return {
    versions: uniqueStrings([params.versionScope ?? "", extractVersionScope(text) ?? ""]),
    installProfiles: uniqueStrings([
      params.installProfileScope ?? "",
      extractInstallProfileScope(text) ?? "",
    ]),
    customers: uniqueStrings([params.customerScope ?? "", extractCustomerScope(text) ?? ""]),
    environments: uniqueStrings([
      ...(params.environmentTags ?? []),
      ...extractEnvironmentTags(text),
    ]),
    artifacts: artifactRefs,
    artifactBasenames,
  };
}

function buildResolvedEntityAliases(params: {
  text?: string;
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  environmentTags?: string[];
  artifactRefs?: string[];
}): string[] {
  const signature = buildMemoryEntitySignature(params);
  const branchAliases = uniqueStrings([
    ...(params.environmentTags ?? [])
      .filter((tag) => tag.startsWith("git-branch:"))
      .map((tag) => tag.slice("git-branch:".length)),
    ...(params.text?.match(/\bbranch\s+([a-z0-9/_-]+)/gi) ?? []).map((match) =>
      match.replace(/\bbranch\s+/i, "").trim(),
    ),
  ]);
  return uniqueStrings([
    ...signature.versions,
    ...signature.installProfiles,
    ...signature.customers,
    ...signature.environments,
    ...signature.artifacts,
    ...signature.artifactBasenames,
    ...branchAliases,
  ]);
}

function buildCanonicalEntityKeys(params: {
  text?: string;
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  environmentTags?: string[];
  artifactRefs?: string[];
  entityAliases?: string[];
}): string[] {
  return uniqueStrings([
    ...(params.entityAliases ?? []),
    ...buildResolvedEntityAliases(params),
  ]).map((alias) => {
    const classified = classifyResolvedEntityAlias(alias);
    return `${classified.kind}:${normalizeComparable(classified.canonicalName)}`;
  });
}

function buildCanonicalEntityKinds(params: {
  text?: string;
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  environmentTags?: string[];
  artifactRefs?: string[];
  entityAliases?: string[];
}): string[] {
  return uniqueStrings(
    uniqueStrings([...(params.entityAliases ?? []), ...buildResolvedEntityAliases(params)]).map(
      (alias) => classifyResolvedEntityAlias(alias).kind,
    ),
  );
}

type MemoryEntityKind =
  | "artifact"
  | "branch"
  | "profile"
  | "version"
  | "customer"
  | "environment"
  | "generic";

type PersistedMemoryEntity = {
  id: string;
  sessionId: string;
  kind: MemoryEntityKind;
  canonicalName: string;
  aliases: string[];
  conceptIds: string[];
  updatedAt: number;
};

function classifyResolvedEntityAlias(alias: string): {
  kind: MemoryEntityKind;
  canonicalName: string;
} {
  const trimmed = alias.trim();
  const normalized = normalizeComparable(trimmed);
  if (!normalized) {
    return { kind: "generic", canonicalName: trimmed };
  }
  if (/^git branch[:/ -]|^feature\/|^main$|^develop$|^release\//i.test(trimmed)) {
    return {
      kind: "branch",
      canonicalName: trimmed
        .replace(/^git-branch:/i, "")
        .replace(/^branch\s+/i, "")
        .trim(),
    };
  }
  if (/^profile[-_/a-z0-9.]+$/i.test(trimmed) || /^profile\s+/i.test(trimmed)) {
    return {
      kind: "profile",
      canonicalName: trimmed.replace(/^profile\s+/i, "").trim(),
    };
  }
  if (/^v\d+(?:\.\d+)+(?:-\d+)?$/i.test(trimmed)) {
    return { kind: "version", canonicalName: trimmed };
  }
  if (
    new Set(["linux", "macos", "windows", "docker", "pnpm", "npm", "node", "typescript"]).has(
      normalized,
    )
  ) {
    return { kind: "environment", canonicalName: normalized };
  }
  if (trimmed.includes("/") || /\.[a-z0-9]+$/i.test(trimmed)) {
    return { kind: "artifact", canonicalName: trimmed };
  }
  if (/^customer[-_/a-z0-9.]+$/i.test(trimmed)) {
    return { kind: "customer", canonicalName: trimmed.replace(/^customer[-_\s]*/i, "").trim() };
  }
  return { kind: "generic", canonicalName: trimmed };
}

function countEntitySignatureOverlap(
  left: MemoryEntitySignature,
  right: MemoryEntitySignature,
): number {
  const overlap = (a: string[], b: string[]): number => a.filter((item) => b.includes(item)).length;
  return (
    overlap(left.versions, right.versions) * 3 +
    overlap(left.installProfiles, right.installProfiles) * 2 +
    overlap(left.customers, right.customers) * 2 +
    overlap(left.environments, right.environments) +
    overlap(left.artifacts, right.artifacts) * 3 +
    overlap(left.artifactBasenames, right.artifactBasenames)
  );
}

function formatScopeContextSummary(scopeContext?: MemoryScopeContext): string | undefined {
  if (!scopeContext) {
    return undefined;
  }
  const parts = [
    scopeContext.versionScope ? `version=${scopeContext.versionScope}` : "",
    scopeContext.installProfileScope ? `profile=${scopeContext.installProfileScope}` : "",
    scopeContext.customerScope ? `customer=${scopeContext.customerScope}` : "",
    scopeContext.environmentTags[0]
      ? `env=${scopeContext.environmentTags.slice(0, 2).join(",")}`
      : "",
    scopeContext.artifactRefs[0]
      ? `artifact=${scopeContext.artifactRefs.slice(0, 2).join(",")}`
      : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function formatEntryScopeSummary(
  entry: Pick<
    LongTermMemoryEntry,
    "versionScope" | "installProfileScope" | "customerScope" | "artifactRefs" | "environmentTags"
  >,
): string | undefined {
  const parts = [
    entry.versionScope ? `version=${entry.versionScope}` : "",
    entry.installProfileScope ? `profile=${entry.installProfileScope}` : "",
    entry.customerScope ? `customer=${entry.customerScope}` : "",
    entry.environmentTags[0] ? `env=${entry.environmentTags.slice(0, 2).join(",")}` : "",
    entry.artifactRefs[0] ? `artifact=${entry.artifactRefs.slice(0, 2).join(",")}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

type MemoryScopeContext = {
  versionScope?: string;
  installProfileScope?: string;
  customerScope?: string;
  environmentTags: string[];
  artifactRefs: string[];
};

function buildMemoryScopeContext(text: string): MemoryScopeContext {
  return {
    versionScope: extractVersionScope(text),
    installProfileScope: extractInstallProfileScope(text),
    customerScope: extractCustomerScope(text),
    environmentTags: extractEnvironmentTags(text),
    artifactRefs: extractArtifactRefs(text),
  };
}

function mergeScopeContexts(
  primary: MemoryScopeContext,
  secondary?: Partial<MemoryScopeContext>,
): MemoryScopeContext {
  return {
    versionScope: primary.versionScope ?? secondary?.versionScope,
    installProfileScope: primary.installProfileScope ?? secondary?.installProfileScope,
    customerScope: primary.customerScope ?? secondary?.customerScope,
    environmentTags: uniqueStrings([
      ...primary.environmentTags,
      ...(secondary?.environmentTags ?? []),
    ]),
    artifactRefs: uniqueStrings([...primary.artifactRefs, ...(secondary?.artifactRefs ?? [])]),
  };
}

function buildRuntimeScopeContext(params?: {
  runtimeContext?: ContextEngineRuntimeContext;
  sessionFile?: string;
}): MemoryScopeContext {
  const runtime = params?.runtimeContext;
  const workspaceState =
    runtime?.workspaceState && typeof runtime.workspaceState === "object"
      ? (runtime.workspaceState as Record<string, unknown>)
      : undefined;
  const stringValue = (key: string): string | undefined => {
    const value = runtime?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const workspaceStateString = (key: string): string | undefined => {
    const value = workspaceState?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const stringArray = (key: string): string[] => {
    const value = runtime?.[key];
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  };
  const extraPrompt = stringValue("extraSystemPrompt") ?? "";
  return {
    versionScope: extractVersionScope(extraPrompt),
    installProfileScope: stringValue("authProfileId"),
    customerScope: undefined,
    environmentTags: uniqueStrings(
      [
        stringValue("provider") ? `provider:${stringValue("provider")}` : "",
        stringValue("model") ? `model:${stringValue("model")}` : "",
        stringValue("messageProvider") ? `channel:${stringValue("messageProvider")}` : "",
        workspaceStateString("gitBranch") ? `git-branch:${workspaceStateString("gitBranch")}` : "",
        workspaceStateString("gitCommit") ? `git-commit:${workspaceStateString("gitCommit")}` : "",
        runtime?.bashElevated === true ? "bash-elevated" : "",
        ...stringArray("workspaceTags"),
      ].filter(Boolean),
    ),
    artifactRefs: uniqueStrings([
      ...extractArtifactRefs(extraPrompt),
      ...stringArray("activeArtifacts"),
      workspaceStateString("sessionRelativePath") ?? "",
      params?.sessionFile ? path.basename(params.sessionFile) : "",
    ]),
  };
}

export function deriveLongTermMemoryCandidates(params: {
  messages: AgentMessage[];
  compactionSummary?: string;
  scopeContext?: Partial<MemoryScopeContext>;
}): { durable: LongTermMemoryEntry[]; pending: PendingMemoryEntry[] } {
  const durable: LongTermMemoryEntry[] = [];
  const pending: PendingMemoryEntry[] = [];

  for (const message of params.messages) {
    if (message.role !== "user") {
      continue;
    }
    const text = extractMessageText(message);
    if (!text) {
      continue;
    }
    const normalized = clipText(text, 260);
    const category = detectCandidateCategory(normalized);
    if (!category) {
      continue;
    }
    const scope = mergeScopeContexts(buildMemoryScopeContext(normalized), params.scopeContext);
    const semanticKey = buildMemorySemanticKey({
      category,
      text: normalized,
      versionScope: scope.versionScope,
      installProfileScope: scope.installProfileScope,
      customerScope: scope.customerScope,
      artifactRefs: scope.artifactRefs,
    });
    const sourceType = inferMessageSourceType(normalized);

    const entryBase: LongTermMemoryEntry = {
      id: buildStableMemoryId("ltm", semanticKey),
      semanticKey,
      conceptKey: buildMemoryConceptKey({
        category,
        ontologyKind: inferOntologyKind(category, normalized),
        text: normalized,
        versionScope: scope.versionScope,
        installProfileScope: scope.installProfileScope,
        customerScope: scope.customerScope,
        artifactRefs: scope.artifactRefs,
      }),
      canonicalText: canonicalizeComparable(normalized),
      conceptAliases: [normalized],
      ontologyKind: inferOntologyKind(category, normalized),
      category,
      text: normalized,
      strength: baseStrengthForCategory(category),
      evidence: [normalized],
      provenance: [createProvenanceRecord("message", normalized)],
      sourceType,
      confidence:
        sourceType === "direct_observation"
          ? category === "decision"
            ? 0.96
            : 0.84
          : category === "decision"
            ? 0.95
            : sourceType === "summary_derived"
              ? 0.72
              : 0.78,
      importanceClass: detectImportanceClass(category, normalized),
      compressionState: "active",
      activeStatus: "active",
      adjudicationStatus: "authoritative",
      revisionCount: 0,
      lastRevisionKind: "new",
      permanenceStatus: "deferred",
      permanenceReasons: [],
      trend: "rising",
      accessCount: 0,
      createdAt: Date.now(),
      lastConfirmedAt: Date.now(),
      contradictionCount: 0,
      relatedMemoryIds: [],
      relations: [],
      versionScope: scope.versionScope,
      installProfileScope: scope.installProfileScope,
      customerScope: scope.customerScope,
      environmentTags: scope.environmentTags,
      artifactRefs: scope.artifactRefs,
      updatedAt: Date.now(),
    };

    if (entryBase.importanceClass === "temporary") {
      pending.push({
        ...entryBase,
        activeStatus: "pending",
        pendingReason: "needs recurrence or stronger confirmation before durable promotion",
      });
    } else {
      durable.push(entryBase);
    }
  }

  const compactionSummary = params.compactionSummary?.trim();
  if (compactionSummary) {
    const scope = mergeScopeContexts(
      buildMemoryScopeContext(compactionSummary),
      params.scopeContext,
    );
    const normalizedSummary = clipText(compactionSummary, 260);
    const semanticKey = buildMemorySemanticKey({
      category: "episode",
      text: normalizedSummary,
      versionScope: scope.versionScope,
      installProfileScope: scope.installProfileScope,
      customerScope: scope.customerScope,
      artifactRefs: scope.artifactRefs,
    });
    durable.push({
      id: buildStableMemoryId("ltm", semanticKey),
      semanticKey,
      conceptKey: buildMemoryConceptKey({
        category: "episode",
        ontologyKind: inferOntologyKind("episode", normalizedSummary),
        text: normalizedSummary,
        versionScope: scope.versionScope,
        installProfileScope: scope.installProfileScope,
        customerScope: scope.customerScope,
        artifactRefs: scope.artifactRefs,
      }),
      canonicalText: canonicalizeComparable(normalizedSummary),
      conceptAliases: [normalizedSummary],
      ontologyKind: inferOntologyKind("episode", normalizedSummary),
      category: "episode",
      text: normalizedSummary,
      strength: 0.88,
      evidence: [clipText(compactionSummary, 180)],
      provenance: [createProvenanceRecord("compaction", compactionSummary)],
      sourceType: "summary_derived",
      confidence: 0.84,
      importanceClass: "useful",
      compressionState: "compressed",
      activeStatus: "active",
      adjudicationStatus: "authoritative",
      revisionCount: 0,
      lastRevisionKind: "new",
      permanenceStatus: "deferred",
      permanenceReasons: [],
      trend: "stable",
      accessCount: 0,
      createdAt: Date.now(),
      lastConfirmedAt: Date.now(),
      contradictionCount: 0,
      relatedMemoryIds: [],
      relations: [],
      versionScope: scope.versionScope,
      installProfileScope: scope.installProfileScope,
      customerScope: scope.customerScope,
      environmentTags: scope.environmentTags,
      artifactRefs: scope.artifactRefs,
      updatedAt: Date.now(),
    });
  }

  return {
    durable: dedupeLongTermCandidates(durable),
    pending: mergePendingSignificance([], pending),
  };
}

function deriveRuntimeSignalCandidates(params: {
  runtimeContext?: ContextEngineRuntimeContext;
  scopeContext?: Partial<MemoryScopeContext>;
  previousWorkingMemory?: WorkingMemorySnapshot;
}): LongTermMemoryEntry[] {
  const runtime = params.runtimeContext;
  if (!runtime || typeof runtime !== "object") {
    return [];
  }

  const toolSignals = Array.isArray(runtime.toolSignals) ? runtime.toolSignals : [];
  const candidates: LongTermMemoryEntry[] = [];
  const pushRuntimeCandidate = (input: {
    category: MemoryCategory;
    text: string;
    evidence: string[];
    environmentTags?: string[];
    artifactRefs?: string[];
    confidence: number;
    strength: number;
    importanceClass: LongTermMemoryEntry["importanceClass"];
    trend: LongTermMemoryEntry["trend"];
  }) => {
    const scope = mergeScopeContexts(buildMemoryScopeContext(input.text), {
      ...params.scopeContext,
      artifactRefs: uniqueStrings([
        ...(params.scopeContext?.artifactRefs ?? []),
        ...(input.artifactRefs ?? []),
      ]),
      environmentTags: uniqueStrings([
        ...(params.scopeContext?.environmentTags ?? []),
        ...(input.environmentTags ?? []),
      ]),
    });
    const ontologyKind = inferOntologyKind(input.category, input.text);
    const semanticKey = buildMemorySemanticKey({
      category: input.category,
      text: input.text,
      versionScope: scope.versionScope,
      installProfileScope: scope.installProfileScope,
      customerScope: scope.customerScope,
      artifactRefs: scope.artifactRefs,
    });
    const now = Date.now();
    candidates.push({
      id: buildStableMemoryId("ltm", semanticKey),
      semanticKey,
      conceptKey: buildMemoryConceptKey({
        category: input.category,
        ontologyKind,
        text: input.text,
        versionScope: scope.versionScope,
        installProfileScope: scope.installProfileScope,
        customerScope: scope.customerScope,
        artifactRefs: scope.artifactRefs,
      }),
      canonicalText: canonicalizeComparable(input.text),
      conceptAliases: [input.text, ...input.evidence].filter(Boolean),
      ontologyKind,
      category: input.category,
      text: input.text,
      strength: input.strength,
      evidence: input.evidence,
      provenance: [createProvenanceRecord("derived", input.evidence[0] ?? input.text)],
      sourceType: "direct_observation",
      confidence: input.confidence,
      importanceClass: input.importanceClass,
      compressionState: "stable",
      activeStatus: "active",
      adjudicationStatus: "authoritative",
      revisionCount: 0,
      lastRevisionKind: "new",
      permanenceStatus: "deferred",
      permanenceReasons: [],
      trend: input.trend,
      accessCount: 0,
      createdAt: now,
      lastConfirmedAt: now,
      contradictionCount: 0,
      relatedMemoryIds: [],
      relations: [],
      versionScope: scope.versionScope,
      installProfileScope: scope.installProfileScope,
      customerScope: scope.customerScope,
      environmentTags: scope.environmentTags,
      artifactRefs: scope.artifactRefs,
      updatedAt: now,
    });
  };

  for (const signal of toolSignals) {
    if (!signal || typeof signal !== "object") {
      continue;
    }
    const toolName =
      typeof signal.toolName === "string" && signal.toolName.trim().length > 0
        ? signal.toolName.trim()
        : undefined;
    const status =
      signal.status === "success" || signal.status === "error" ? signal.status : undefined;
    const summary =
      typeof signal.summary === "string" && signal.summary.trim().length > 0
        ? signal.summary.trim()
        : undefined;
    if (!toolName || !status || !summary) {
      continue;
    }

    const artifactRefs = uniqueStrings(
      Array.isArray(signal.artifactRefs)
        ? signal.artifactRefs.filter(
            (ref: unknown): ref is string => typeof ref === "string" && ref.trim().length > 0,
          )
        : [],
    );
    if (status === "success" && artifactRefs.length === 0 && tokenize(summary).length < 5) {
      continue;
    }

    pushRuntimeCandidate({
      category:
        status === "error" || toolName === "write" || toolName === "exec" ? "episode" : "fact",
      text:
        status === "error"
          ? `Tool ${toolName} failed during runtime: ${summary}`
          : `Tool ${toolName} observed during runtime: ${summary}`,
      evidence: [summary],
      artifactRefs,
      environmentTags: [`tool:${toolName}`, `tool-status:${status}`],
      confidence: status === "error" ? 0.9 : 0.72,
      strength: status === "error" ? 0.92 : 0.76,
      importanceClass: status === "error" ? "critical" : "useful",
      trend: status === "error" ? "rising" : "stable",
    });
  }

  const diffSignals = Array.isArray(runtime.diffSignals) ? runtime.diffSignals : [];
  for (const signal of diffSignals) {
    if (!signal || typeof signal !== "object") {
      continue;
    }
    const artifactRef =
      typeof signal.artifactRef === "string" && signal.artifactRef.trim().length > 0
        ? signal.artifactRef.trim()
        : undefined;
    const changeKind =
      signal.changeKind === "created" ||
      signal.changeKind === "deleted" ||
      signal.changeKind === "modified"
        ? signal.changeKind
        : undefined;
    const summary =
      typeof signal.summary === "string" && signal.summary.trim().length > 0
        ? signal.summary.trim()
        : undefined;
    if (!artifactRef || !changeKind || !summary) {
      continue;
    }
    pushRuntimeCandidate({
      category: "episode",
      text: `Artifact ${artifactRef} was ${changeKind} during runtime: ${summary}`,
      evidence: [summary],
      artifactRefs: [artifactRef],
      environmentTags: ["runtime:artifact-diff", `diff:${changeKind}`],
      confidence: 0.88,
      strength: 0.84,
      importanceClass: "useful",
      trend: "rising",
    });
  }

  const checkpointSignals = Array.isArray(runtime.checkpointSignals)
    ? runtime.checkpointSignals
    : [];
  for (const signal of checkpointSignals) {
    if (!signal || typeof signal !== "object") {
      continue;
    }
    const kind =
      signal.kind === "completion" || signal.kind === "handoff" || signal.kind === "failure"
        ? signal.kind
        : undefined;
    const summary =
      typeof signal.summary === "string" && signal.summary.trim().length > 0
        ? signal.summary.trim()
        : undefined;
    const artifactRefs = uniqueStrings(
      Array.isArray(signal.artifactRefs)
        ? signal.artifactRefs.filter(
            (ref: unknown): ref is string => typeof ref === "string" && ref.trim().length > 0,
          )
        : [],
    );
    if (!kind || !summary) {
      continue;
    }
    pushRuntimeCandidate({
      category: "episode",
      text:
        kind === "handoff"
          ? `Runtime handoff checkpoint recorded: ${summary}`
          : kind === "failure"
            ? `Runtime failure checkpoint recorded: ${summary}`
            : `Runtime completion checkpoint recorded: ${summary}`,
      evidence: [summary],
      artifactRefs,
      environmentTags: ["runtime:checkpoint", `checkpoint:${kind}`],
      confidence: kind === "failure" ? 0.93 : 0.86,
      strength: kind === "failure" ? 0.94 : 0.82,
      importanceClass: kind === "failure" ? "critical" : "useful",
      trend: "rising",
    });
  }

  const retrySignals = Array.isArray(runtime.retrySignals) ? runtime.retrySignals : [];
  for (const signal of retrySignals) {
    if (!signal || typeof signal !== "object") {
      continue;
    }
    const phase =
      signal.phase === "overflow" || signal.phase === "compaction" || signal.phase === "prompt"
        ? signal.phase
        : undefined;
    const outcome =
      signal.outcome === "recovered" || signal.outcome === "failed" ? signal.outcome : undefined;
    const summary =
      typeof signal.summary === "string" && signal.summary.trim().length > 0
        ? signal.summary.trim()
        : undefined;
    const attempt =
      typeof signal.attempt === "number" && Number.isFinite(signal.attempt)
        ? signal.attempt
        : undefined;
    const maxAttempts =
      typeof signal.maxAttempts === "number" && Number.isFinite(signal.maxAttempts)
        ? signal.maxAttempts
        : undefined;
    if (!phase || !outcome || !summary) {
      continue;
    }
    pushRuntimeCandidate({
      category: "episode",
      text: `Runtime ${phase} retry ${outcome}: ${summary}${
        attempt ? ` (attempt ${attempt}${maxAttempts ? `/${maxAttempts}` : ""})` : ""
      }`,
      evidence: [summary],
      environmentTags: ["runtime:retry", `retry:${phase}`, `retry-outcome:${outcome}`],
      confidence: outcome === "failed" ? 0.93 : 0.84,
      strength: outcome === "failed" ? 0.94 : 0.8,
      importanceClass: outcome === "failed" ? "critical" : "useful",
      trend: "rising",
    });
  }

  const currentBranch =
    runtime.workspaceState &&
    typeof runtime.workspaceState === "object" &&
    typeof (runtime.workspaceState as { gitBranch?: unknown }).gitBranch === "string"
      ? ((runtime.workspaceState as { gitBranch?: string }).gitBranch ?? undefined)
      : undefined;
  const previousBranch = params.previousWorkingMemory?.lastWorkspaceBranch;
  if (currentBranch && previousBranch && currentBranch !== previousBranch) {
    pushRuntimeCandidate({
      category: "episode",
      text: `Workspace git branch changed from ${previousBranch} to ${currentBranch}.`,
      evidence: [`branch transition ${previousBranch} -> ${currentBranch}`],
      environmentTags: ["runtime:branch-transition", `git-branch:${currentBranch}`],
      confidence: 0.94,
      strength: 0.9,
      importanceClass: "useful",
      trend: "rising",
    });
  }

  const promptErrorSummary =
    typeof runtime.promptErrorSummary === "string" && runtime.promptErrorSummary.trim().length > 0
      ? runtime.promptErrorSummary.trim()
      : undefined;
  if (promptErrorSummary) {
    pushRuntimeCandidate({
      category: "episode",
      text: `Prompt construction failed during runtime: ${promptErrorSummary}`,
      evidence: [promptErrorSummary],
      environmentTags: ["runtime:prompt-error"],
      confidence: 0.95,
      strength: 0.96,
      importanceClass: "critical",
      trend: "rising",
    });
  }

  const governanceState =
    runtime.governanceState && typeof runtime.governanceState === "object"
      ? (runtime.governanceState as {
          autonomyMode?: unknown;
          riskLevel?: unknown;
          approvalRequired?: unknown;
          secretPromptDetected?: unknown;
          destructiveActionDetected?: unknown;
          reasons?: unknown;
        })
      : undefined;
  if (governanceState) {
    const autonomyMode =
      governanceState.autonomyMode === "continue" ||
      governanceState.autonomyMode === "fallback" ||
      governanceState.autonomyMode === "approval_required" ||
      governanceState.autonomyMode === "escalate"
        ? governanceState.autonomyMode
        : "continue";
    const riskLevel =
      governanceState.riskLevel === "low" ||
      governanceState.riskLevel === "medium" ||
      governanceState.riskLevel === "high"
        ? governanceState.riskLevel
        : "low";
    const reasons = uniqueStrings(
      Array.isArray(governanceState.reasons)
        ? governanceState.reasons.filter(
            (reason): reason is string => typeof reason === "string" && reason.trim().length > 0,
          )
        : [],
    );
    pushRuntimeCandidate({
      category: "strategy",
      text: [
        `Governance state for current execution: autonomy mode ${autonomyMode}`,
        `risk ${riskLevel}`,
        governanceState.approvalRequired === true ? "approval required" : "",
        governanceState.secretPromptDetected === true ? "secret extraction request detected" : "",
        governanceState.destructiveActionDetected === true
          ? "destructive action request detected"
          : "",
        reasons.length > 0 ? `reasons ${reasons.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(", "),
      evidence: reasons.length > 0 ? reasons : [`autonomy=${autonomyMode}`, `risk=${riskLevel}`],
      environmentTags: uniqueStrings([
        "runtime:governance",
        `governance:mode:${autonomyMode}`,
        `governance:risk:${riskLevel}`,
        governanceState.approvalRequired === true ? "governance:approval-required" : "",
        governanceState.secretPromptDetected === true ? "governance:secret-detected" : "",
        governanceState.destructiveActionDetected === true ? "governance:destructive-detected" : "",
      ]),
      confidence: 0.92,
      strength: 0.9,
      importanceClass: riskLevel === "high" ? "critical" : "useful",
      trend: "stable",
    });
  }

  const environmentState =
    runtime.environmentState && typeof runtime.environmentState === "object"
      ? (runtime.environmentState as {
          workspaceKind?: unknown;
          gitBranch?: unknown;
          gitCommit?: unknown;
          capabilitySignals?: unknown;
          preferredValidationTools?: unknown;
          skillEnvironments?: unknown;
        })
      : undefined;
  if (environmentState) {
    const workspaceKind =
      environmentState.workspaceKind === "project" ||
      environmentState.workspaceKind === "temporary" ||
      environmentState.workspaceKind === "unknown"
        ? environmentState.workspaceKind
        : "unknown";
    const capabilitySignals = uniqueStrings(
      Array.isArray(environmentState.capabilitySignals)
        ? environmentState.capabilitySignals.filter(
            (signal): signal is string => typeof signal === "string" && signal.trim().length > 0,
          )
        : [],
    );
    const preferredValidationTools = uniqueStrings(
      Array.isArray(environmentState.preferredValidationTools)
        ? environmentState.preferredValidationTools.filter(
            (tool): tool is string => typeof tool === "string" && tool.trim().length > 0,
          )
        : [],
    );
    const skillEnvironments = uniqueStrings(
      Array.isArray(environmentState.skillEnvironments)
        ? environmentState.skillEnvironments.filter(
            (env): env is string => typeof env === "string" && env.trim().length > 0,
          )
        : [],
    );
    pushRuntimeCandidate({
      category: "fact",
      text: [
        `Execution environment is ${workspaceKind}`,
        typeof environmentState.gitBranch === "string"
          ? `branch ${environmentState.gitBranch}`
          : "",
        typeof environmentState.gitCommit === "string"
          ? `commit ${environmentState.gitCommit}`
          : "",
        capabilitySignals.length > 0 ? `capabilities ${capabilitySignals.join(", ")}` : "",
        preferredValidationTools.length > 0
          ? `preferred validation ${preferredValidationTools.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
      evidence: uniqueStrings([
        ...capabilitySignals,
        ...preferredValidationTools.map((tool) => `validate:${tool}`),
        ...skillEnvironments.map((env) => `env:${env}`),
      ]),
      environmentTags: uniqueStrings([
        "runtime:environment",
        `environment:workspace:${workspaceKind}`,
        ...(capabilitySignals.map((signal) => `environment:${signal}`) ?? []),
        ...(skillEnvironments.map((env) => `environment:skill-env:${env}`) ?? []),
      ]),
      confidence: 0.86,
      strength: 0.78,
      importanceClass: "useful",
      trend: "stable",
    });
  }

  const failureLearningState =
    runtime.failureLearningState && typeof runtime.failureLearningState === "object"
      ? (runtime.failureLearningState as {
          failurePattern?: unknown;
          learnFromFailure?: unknown;
          failureReasons?: unknown;
          missingCapabilities?: unknown;
        })
      : undefined;
  if (failureLearningState) {
    const failurePattern =
      failureLearningState.failurePattern === "clean_success" ||
      failureLearningState.failurePattern === "near_miss" ||
      failureLearningState.failurePattern === "blocked_path" ||
      failureLearningState.failurePattern === "hard_failure"
        ? failureLearningState.failurePattern
        : "hard_failure";
    const failureReasons = uniqueStrings(
      Array.isArray(failureLearningState.failureReasons)
        ? failureLearningState.failureReasons.filter(
            (reason): reason is string => typeof reason === "string" && reason.trim().length > 0,
          )
        : [],
    );
    const missingCapabilities = uniqueStrings(
      Array.isArray(failureLearningState.missingCapabilities)
        ? failureLearningState.missingCapabilities.filter(
            (gap): gap is string => typeof gap === "string" && gap.trim().length > 0,
          )
        : [],
    );
    pushRuntimeCandidate({
      category: "pattern",
      text: [
        `Failure learning state: ${failurePattern}`,
        failureReasons.length > 0 ? `reasons ${failureReasons.join(", ")}` : "",
        missingCapabilities.length > 0
          ? `missing capabilities ${missingCapabilities.join(", ")}`
          : "",
        failureLearningState.learnFromFailure === true ? "retain for retry adaptation" : "",
      ]
        .filter(Boolean)
        .join(", "),
      evidence: uniqueStrings([...failureReasons, ...missingCapabilities]),
      environmentTags: uniqueStrings([
        "runtime:failure-learning",
        `failure-pattern:${failurePattern}`,
        failureLearningState.learnFromFailure === true ? "failure-learning:retain" : "",
        ...(missingCapabilities.map((gap) => `failure-gap:${gap}`) ?? []),
      ]),
      confidence: failurePattern === "clean_success" ? 0.7 : 0.9,
      strength: failurePattern === "clean_success" ? 0.6 : 0.88,
      importanceClass:
        failurePattern === "blocked_path" || failurePattern === "near_miss"
          ? "useful"
          : "temporary",
      trend: failureLearningState.learnFromFailure === true ? "rising" : "stable",
    });
  }

  const agenticObservability =
    runtime.agenticObservability && typeof runtime.agenticObservability === "object"
      ? (runtime.agenticObservability as {
          retryClass?: unknown;
          autonomyMode?: unknown;
          riskLevel?: unknown;
          failurePattern?: unknown;
          suggestedSkill?: unknown;
          rankedSkills?: unknown;
          capabilityGaps?: unknown;
          hasViableFallback?: unknown;
          escalationRequired?: unknown;
          goalSatisfaction?: unknown;
          recommendations?: unknown;
        })
      : undefined;
  if (agenticObservability) {
    const retryClass =
      agenticObservability.retryClass === "same_path_retry" ||
      agenticObservability.retryClass === "skill_fallback" ||
      agenticObservability.retryClass === "environment_fix" ||
      agenticObservability.retryClass === "clarify" ||
      agenticObservability.retryClass === "escalate"
        ? agenticObservability.retryClass
        : "same_path_retry";
    const autonomyMode =
      agenticObservability.autonomyMode === "continue" ||
      agenticObservability.autonomyMode === "fallback" ||
      agenticObservability.autonomyMode === "approval_required" ||
      agenticObservability.autonomyMode === "escalate"
        ? agenticObservability.autonomyMode
        : "continue";
    const riskLevel =
      agenticObservability.riskLevel === "low" ||
      agenticObservability.riskLevel === "medium" ||
      agenticObservability.riskLevel === "high"
        ? agenticObservability.riskLevel
        : "low";
    const failurePattern =
      agenticObservability.failurePattern === "clean_success" ||
      agenticObservability.failurePattern === "near_miss" ||
      agenticObservability.failurePattern === "blocked_path" ||
      agenticObservability.failurePattern === "hard_failure"
        ? agenticObservability.failurePattern
        : "hard_failure";
    const goalSatisfaction =
      agenticObservability.goalSatisfaction === "satisfied" ||
      agenticObservability.goalSatisfaction === "uncertain" ||
      agenticObservability.goalSatisfaction === "unsatisfied"
        ? agenticObservability.goalSatisfaction
        : "uncertain";
    const suggestedSkill =
      typeof agenticObservability.suggestedSkill === "string" &&
      agenticObservability.suggestedSkill.trim().length > 0
        ? agenticObservability.suggestedSkill.trim()
        : undefined;
    const rankedSkills = uniqueStrings(
      Array.isArray(agenticObservability.rankedSkills)
        ? agenticObservability.rankedSkills.filter(
            (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
          )
        : [],
    );
    const capabilityGaps = uniqueStrings(
      Array.isArray(agenticObservability.capabilityGaps)
        ? agenticObservability.capabilityGaps.filter(
            (gap): gap is string => typeof gap === "string" && gap.trim().length > 0,
          )
        : [],
    );
    const recommendations = uniqueStrings(
      Array.isArray(agenticObservability.recommendations)
        ? agenticObservability.recommendations.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0,
          )
        : [],
    );
    const hasViableFallback = agenticObservability.hasViableFallback !== false;
    const escalationRequired = agenticObservability.escalationRequired === true;
    pushRuntimeCandidate({
      category: "pattern",
      text: [
        "Agentic observability",
        `retry ${retryClass}`,
        `autonomy ${autonomyMode}`,
        `risk ${riskLevel}`,
        `goal satisfaction ${goalSatisfaction}`,
        `failure pattern ${failurePattern}`,
        suggestedSkill ? `suggested skill ${suggestedSkill}` : "",
        rankedSkills.length > 0 ? `ranked skills ${rankedSkills.join(" > ")}` : "",
        capabilityGaps.length > 0 ? `capability gaps ${capabilityGaps.join(", ")}` : "",
        !hasViableFallback ? "missing viable fallback" : "",
        escalationRequired ? "escalation required" : "",
      ]
        .filter(Boolean)
        .join(", "),
      evidence: uniqueStrings([
        `retry=${retryClass}`,
        `autonomy=${autonomyMode}`,
        `risk=${riskLevel}`,
        `goal=${goalSatisfaction}`,
        `failure=${failurePattern}`,
        ...recommendations,
      ]),
      environmentTags: uniqueStrings([
        "runtime:agentic-observability",
        `agentic:retry:${retryClass}`,
        `agentic:autonomy:${autonomyMode}`,
        `agentic:risk:${riskLevel}`,
        `agentic:goal:${goalSatisfaction}`,
        `agentic:failure:${failurePattern}`,
        hasViableFallback ? "agentic:viable-fallback" : "agentic:missing-fallback",
        escalationRequired ? "agentic:escalation-required" : "",
        ...(capabilityGaps.map((gap) => `agentic:capability-gap:${gap}`) ?? []),
      ]),
      confidence: escalationRequired || !hasViableFallback ? 0.9 : 0.78,
      strength: escalationRequired || !hasViableFallback ? 0.88 : 0.72,
      importanceClass: escalationRequired || !hasViableFallback ? "useful" : "temporary",
      trend: escalationRequired || !hasViableFallback ? "rising" : "stable",
    });
  }

  const agenticSoak =
    runtime.agenticSoak && typeof runtime.agenticSoak === "object"
      ? (runtime.agenticSoak as {
          passed?: unknown;
          failedScenarioIds?: unknown;
          totalScenarios?: unknown;
          passedScenarios?: unknown;
          scenarios?: unknown;
          summary?: unknown;
        })
      : undefined;
  if (agenticSoak) {
    const passed = agenticSoak.passed === true;
    const failedScenarioIds = uniqueStrings(
      Array.isArray(agenticSoak.failedScenarioIds)
        ? agenticSoak.failedScenarioIds.filter(
            (id): id is string => typeof id === "string" && id.trim().length > 0,
          )
        : [],
    );
    const scenarioIds = Array.isArray(agenticSoak.scenarios)
      ? agenticSoak.scenarios
          .map((scenario) =>
            scenario &&
            typeof scenario === "object" &&
            typeof (scenario as { id?: unknown }).id === "string"
              ? (scenario as { id: string }).id
              : undefined,
          )
          .filter((id): id is string => Boolean(id))
      : [];
    const summary =
      typeof agenticSoak.summary === "string" && agenticSoak.summary.trim().length > 0
        ? agenticSoak.summary.trim()
        : `agentic soak ${passed ? "passed" : "failed"}`;
    pushRuntimeCandidate({
      category: "episode",
      text: `Agentic soak report: ${summary}`,
      evidence: uniqueStrings([
        `total=${typeof agenticSoak.totalScenarios === "number" ? agenticSoak.totalScenarios : scenarioIds.length}`,
        `passed=${typeof agenticSoak.passedScenarios === "number" ? agenticSoak.passedScenarios : scenarioIds.length - failedScenarioIds.length}`,
        ...scenarioIds,
        ...failedScenarioIds,
      ]),
      environmentTags: uniqueStrings([
        "runtime:agentic-soak",
        passed ? "agentic:soak:pass" : "agentic:soak:fail",
        ...(failedScenarioIds.map((id) => `agentic:soak-failure:${id}`) ?? []),
      ]),
      confidence: passed ? 0.8 : 0.92,
      strength: passed ? 0.74 : 0.9,
      importanceClass: passed ? "useful" : "critical",
      trend: passed ? "stable" : "rising",
    });
  }

  const agenticQualityGate =
    runtime.agenticQualityGate && typeof runtime.agenticQualityGate === "object"
      ? (runtime.agenticQualityGate as {
          passed?: unknown;
          acceptancePassed?: unknown;
          soakPassed?: unknown;
          diagnosticsPassed?: unknown;
          failReasons?: unknown;
          summary?: unknown;
        })
      : undefined;
  if (agenticQualityGate) {
    const passed = agenticQualityGate.passed === true;
    const acceptancePassed = agenticQualityGate.acceptancePassed !== false;
    const soakPassed = agenticQualityGate.soakPassed !== false;
    const diagnosticsPassed = agenticQualityGate.diagnosticsPassed !== false;
    const failReasons = uniqueStrings(
      Array.isArray(agenticQualityGate.failReasons)
        ? agenticQualityGate.failReasons.filter(
            (reason): reason is string => typeof reason === "string" && reason.trim().length > 0,
          )
        : [],
    );
    const summary =
      typeof agenticQualityGate.summary === "string" && agenticQualityGate.summary.trim().length > 0
        ? agenticQualityGate.summary.trim()
        : `agentic quality gate ${passed ? "passed" : "failed"}`;
    const summaryWithReasons =
      failReasons.length > 0 ? `${summary} (reasons=${failReasons.join(",")})` : summary;
    pushRuntimeCandidate({
      category: "decision",
      text: `Agentic quality gate: ${summaryWithReasons}`,
      evidence: uniqueStrings([
        `acceptance=${acceptancePassed ? "pass" : "fail"}`,
        `soak=${soakPassed ? "pass" : "fail"}`,
        `diagnostics=${diagnosticsPassed ? "pass" : "fail"}`,
        ...failReasons,
      ]),
      environmentTags: uniqueStrings([
        "runtime:agentic-quality-gate",
        passed ? "agentic:quality:pass" : "agentic:quality:fail",
        acceptancePassed ? "agentic:quality:acceptance-pass" : "agentic:quality:acceptance-fail",
        soakPassed ? "agentic:quality:soak-pass" : "agentic:quality:soak-fail",
        diagnosticsPassed ? "agentic:quality:diagnostics-pass" : "agentic:quality:diagnostics-fail",
        ...(failReasons.map((reason) => `agentic:quality-failure:${reason}`) ?? []),
      ]),
      confidence: passed ? 0.84 : 0.94,
      strength: passed ? 0.8 : 0.92,
      importanceClass: passed ? "useful" : "critical",
      trend: passed ? "stable" : "rising",
    });
  }

  const proceduralExecution =
    runtime.proceduralExecution && typeof runtime.proceduralExecution === "object"
      ? (runtime.proceduralExecution as {
          availableSkills?: unknown;
          likelySkills?: unknown;
          alternativeSkills?: unknown;
          toolChain?: unknown;
          changedArtifacts?: unknown;
          outcome?: unknown;
          goalSatisfaction?: unknown;
          taskMode?: unknown;
          templateCandidate?: unknown;
          consolidationCandidate?: unknown;
          consolidationAction?: unknown;
          overlappingSkills?: unknown;
          skillFamilies?: unknown;
          nearMissCandidate?: unknown;
          retryClass?: unknown;
          suggestedSkill?: unknown;
          shouldEscalate?: unknown;
          escalationReason?: unknown;
          autonomyMode?: unknown;
          riskLevel?: unknown;
          governanceReasons?: unknown;
          primarySkill?: unknown;
          fallbackSkills?: unknown;
          skillChain?: unknown;
          workflowSteps?: unknown;
          rankedSkills?: unknown;
          prerequisiteWarnings?: unknown;
          capabilityGaps?: unknown;
          hasViableFallback?: unknown;
          multiSkillCandidate?: unknown;
          chainedWorkflow?: unknown;
          workspaceKind?: unknown;
          capabilitySignals?: unknown;
          preferredValidationTools?: unknown;
          skillEnvironments?: unknown;
          failurePattern?: unknown;
          learnFromFailure?: unknown;
          failureReasons?: unknown;
          nextImprovement?: unknown;
        })
      : undefined;
  if (proceduralExecution) {
    const likelySkills = uniqueStrings(
      Array.isArray(proceduralExecution.likelySkills)
        ? proceduralExecution.likelySkills.filter(
            (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
          )
        : [],
    );
    const availableSkills = uniqueStrings(
      Array.isArray(proceduralExecution.availableSkills)
        ? proceduralExecution.availableSkills.filter(
            (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
          )
        : [],
    );
    const alternativeSkills = uniqueStrings(
      Array.isArray(proceduralExecution.alternativeSkills)
        ? proceduralExecution.alternativeSkills.filter(
            (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
          )
        : [],
    );
    const toolChain = uniqueStrings(
      Array.isArray(proceduralExecution.toolChain)
        ? proceduralExecution.toolChain.filter(
            (tool): tool is string => typeof tool === "string" && tool.trim().length > 0,
          )
        : [],
    );
    const changedArtifacts = uniqueStrings(
      Array.isArray(proceduralExecution.changedArtifacts)
        ? proceduralExecution.changedArtifacts.filter(
            (artifact): artifact is string =>
              typeof artifact === "string" && artifact.trim().length > 0,
          )
        : [],
    );
    const outcome =
      proceduralExecution.outcome === "verified" ||
      proceduralExecution.outcome === "partial" ||
      proceduralExecution.outcome === "failed" ||
      proceduralExecution.outcome === "blocked" ||
      proceduralExecution.outcome === "unverified"
        ? proceduralExecution.outcome
        : "unverified";
    const goalSatisfaction =
      proceduralExecution.goalSatisfaction === "satisfied" ||
      proceduralExecution.goalSatisfaction === "uncertain" ||
      proceduralExecution.goalSatisfaction === "unsatisfied"
        ? proceduralExecution.goalSatisfaction
        : "uncertain";
    const taskMode =
      proceduralExecution.taskMode === "coding" ||
      proceduralExecution.taskMode === "debugging" ||
      proceduralExecution.taskMode === "support" ||
      proceduralExecution.taskMode === "planning" ||
      proceduralExecution.taskMode === "conceptual" ||
      proceduralExecution.taskMode === "research"
        ? proceduralExecution.taskMode
        : "research";
    const nextImprovement =
      typeof proceduralExecution.nextImprovement === "string" &&
      proceduralExecution.nextImprovement.trim().length > 0
        ? proceduralExecution.nextImprovement.trim()
        : undefined;
    const consolidationAction =
      proceduralExecution.consolidationAction === "none" ||
      proceduralExecution.consolidationAction === "extend_existing" ||
      proceduralExecution.consolidationAction === "generalize_existing" ||
      proceduralExecution.consolidationAction === "create_new"
        ? proceduralExecution.consolidationAction
        : "none";
    const overlappingSkills = uniqueStrings(
      Array.isArray(proceduralExecution.overlappingSkills)
        ? proceduralExecution.overlappingSkills.filter(
            (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
          )
        : [],
    );
    const skillFamilies = uniqueStrings(
      Array.isArray(proceduralExecution.skillFamilies)
        ? proceduralExecution.skillFamilies.filter(
            (family): family is string => typeof family === "string" && family.trim().length > 0,
          )
        : [],
    );
    const retryClass =
      proceduralExecution.retryClass === "same_path_retry" ||
      proceduralExecution.retryClass === "skill_fallback" ||
      proceduralExecution.retryClass === "environment_fix" ||
      proceduralExecution.retryClass === "clarify" ||
      proceduralExecution.retryClass === "escalate"
        ? proceduralExecution.retryClass
        : "same_path_retry";
    const suggestedSkill =
      typeof proceduralExecution.suggestedSkill === "string" &&
      proceduralExecution.suggestedSkill.trim().length > 0
        ? proceduralExecution.suggestedSkill.trim()
        : undefined;
    const shouldEscalate = proceduralExecution.shouldEscalate === true;
    const escalationReason =
      proceduralExecution.escalationReason === "repeated_failure" ||
      proceduralExecution.escalationReason === "environment_mismatch" ||
      proceduralExecution.escalationReason === "missing_information" ||
      proceduralExecution.escalationReason === "low_confidence" ||
      proceduralExecution.escalationReason === "unknown"
        ? proceduralExecution.escalationReason
        : undefined;
    const autonomyMode =
      proceduralExecution.autonomyMode === "continue" ||
      proceduralExecution.autonomyMode === "fallback" ||
      proceduralExecution.autonomyMode === "approval_required" ||
      proceduralExecution.autonomyMode === "escalate"
        ? proceduralExecution.autonomyMode
        : "continue";
    const riskLevel =
      proceduralExecution.riskLevel === "low" ||
      proceduralExecution.riskLevel === "medium" ||
      proceduralExecution.riskLevel === "high"
        ? proceduralExecution.riskLevel
        : "low";
    const governanceReasons = uniqueStrings(
      Array.isArray(proceduralExecution.governanceReasons)
        ? proceduralExecution.governanceReasons.filter(
            (reason): reason is string => typeof reason === "string" && reason.trim().length > 0,
          )
        : [],
    );
    const primarySkill =
      typeof proceduralExecution.primarySkill === "string" &&
      proceduralExecution.primarySkill.trim().length > 0
        ? proceduralExecution.primarySkill.trim()
        : undefined;
    const fallbackSkills = uniqueStrings(
      Array.isArray(proceduralExecution.fallbackSkills)
        ? proceduralExecution.fallbackSkills.filter(
            (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
          )
        : [],
    );
    const skillChain = uniqueStrings(
      Array.isArray(proceduralExecution.skillChain)
        ? proceduralExecution.skillChain.filter(
            (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
          )
        : [],
    );
    const workflowSteps = Array.isArray(proceduralExecution.workflowSteps)
      ? proceduralExecution.workflowSteps
          .map((step) => {
            if (!step || typeof step !== "object") {
              return undefined;
            }
            const skill =
              typeof (step as { skill?: unknown }).skill === "string" &&
              (step as { skill?: string }).skill!.trim().length > 0
                ? (step as { skill?: string }).skill!.trim()
                : undefined;
            const role =
              (step as { role?: unknown }).role === "primary" ||
              (step as { role?: unknown }).role === "supporting" ||
              (step as { role?: unknown }).role === "verification" ||
              (step as { role?: unknown }).role === "fallback"
                ? (step as { role: "primary" | "supporting" | "verification" | "fallback" }).role
                : undefined;
            if (!skill || !role) {
              return undefined;
            }
            return { skill, role };
          })
          .filter(
            (
              step,
            ): step is {
              skill: string;
              role: "primary" | "supporting" | "verification" | "fallback";
            } => Boolean(step),
          )
      : [];
    const rankedSkills = uniqueStrings(
      Array.isArray(proceduralExecution.rankedSkills)
        ? proceduralExecution.rankedSkills.filter(
            (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
          )
        : [],
    );
    const prerequisiteWarnings = uniqueStrings(
      Array.isArray(proceduralExecution.prerequisiteWarnings)
        ? proceduralExecution.prerequisiteWarnings.filter(
            (warning): warning is string =>
              typeof warning === "string" && warning.trim().length > 0,
          )
        : [],
    );
    const capabilityGaps = uniqueStrings(
      Array.isArray(proceduralExecution.capabilityGaps)
        ? proceduralExecution.capabilityGaps.filter(
            (gap): gap is string => typeof gap === "string" && gap.trim().length > 0,
          )
        : [],
    );
    const hasViableFallback = proceduralExecution.hasViableFallback !== false;
    const multiSkillCandidate = proceduralExecution.multiSkillCandidate === true;
    const chainedWorkflow = proceduralExecution.chainedWorkflow === true;
    const workspaceKind =
      proceduralExecution.workspaceKind === "project" ||
      proceduralExecution.workspaceKind === "temporary" ||
      proceduralExecution.workspaceKind === "unknown"
        ? proceduralExecution.workspaceKind
        : "unknown";
    const capabilitySignals = uniqueStrings(
      Array.isArray(proceduralExecution.capabilitySignals)
        ? proceduralExecution.capabilitySignals.filter(
            (signal): signal is string => typeof signal === "string" && signal.trim().length > 0,
          )
        : [],
    );
    const preferredValidationTools = uniqueStrings(
      Array.isArray(proceduralExecution.preferredValidationTools)
        ? proceduralExecution.preferredValidationTools.filter(
            (tool): tool is string => typeof tool === "string" && tool.trim().length > 0,
          )
        : [],
    );
    const skillEnvironments = uniqueStrings(
      Array.isArray(proceduralExecution.skillEnvironments)
        ? proceduralExecution.skillEnvironments.filter(
            (env): env is string => typeof env === "string" && env.trim().length > 0,
          )
        : [],
    );
    const failurePattern =
      proceduralExecution.failurePattern === "clean_success" ||
      proceduralExecution.failurePattern === "near_miss" ||
      proceduralExecution.failurePattern === "blocked_path" ||
      proceduralExecution.failurePattern === "hard_failure"
        ? proceduralExecution.failurePattern
        : "hard_failure";
    const failureReasons = uniqueStrings(
      Array.isArray(proceduralExecution.failureReasons)
        ? proceduralExecution.failureReasons.filter(
            (reason): reason is string => typeof reason === "string" && reason.trim().length > 0,
          )
        : [],
    );
    const proceduralEvidence = uniqueStrings([
      likelySkills.length > 0 ? `skills=${likelySkills.join(",")}` : "",
      alternativeSkills.length > 0 ? `alt_skills=${alternativeSkills.join(",")}` : "",
      toolChain.length > 0 ? `tools=${toolChain.join(",")}` : "",
      changedArtifacts.length > 0 ? `artifacts=${changedArtifacts.join(",")}` : "",
      primarySkill ? `primary_skill=${primarySkill}` : "",
      fallbackSkills.length > 0 ? `fallback_skills=${fallbackSkills.join(",")}` : "",
      skillChain.length > 0 ? `skill_chain=${skillChain.join(",")}` : "",
      workflowSteps.length > 0
        ? `workflow_steps=${workflowSteps.map((step) => `${step.role}:${step.skill}`).join(",")}`
        : "",
      rankedSkills.length > 0 ? `ranked_skills=${rankedSkills.join(",")}` : "",
      prerequisiteWarnings.length > 0 ? `skill_prereqs=${prerequisiteWarnings.join(",")}` : "",
      capabilityGaps.length > 0 ? `capability_gaps=${capabilityGaps.join(",")}` : "",
      hasViableFallback ? "viable_fallback=true" : "viable_fallback=false",
      multiSkillCandidate ? "multi_skill_candidate=true" : "",
      chainedWorkflow ? "chained_workflow=true" : "",
      `workspace_kind=${workspaceKind}`,
      capabilitySignals.length > 0 ? `capabilities=${capabilitySignals.join(",")}` : "",
      preferredValidationTools.length > 0
        ? `preferred_validation=${preferredValidationTools.join(",")}`
        : "",
      skillEnvironments.length > 0 ? `skill_envs=${skillEnvironments.join(",")}` : "",
      `retry=${retryClass}`,
      `autonomy=${autonomyMode}`,
      `risk=${riskLevel}`,
      `goal_satisfaction=${goalSatisfaction}`,
      `failure_pattern=${failurePattern}`,
      suggestedSkill ? `suggested_skill=${suggestedSkill}` : "",
      shouldEscalate ? `escalate=${escalationReason ?? "unknown"}` : "",
      governanceReasons.length > 0 ? `governance=${governanceReasons.join(",")}` : "",
      failureReasons.length > 0 ? `failure_reasons=${failureReasons.join(",")}` : "",
      nextImprovement ?? "",
      consolidationAction !== "none" ? `consolidation_action=${consolidationAction}` : "",
      overlappingSkills.length > 0 ? `overlap_skills=${overlappingSkills.join(",")}` : "",
      skillFamilies.length > 0 ? `skill_families=${skillFamilies.join(",")}` : "",
    ]).filter(Boolean);
    const proceduralText = [
      `Procedural workflow for ${taskMode} work`,
      likelySkills.length > 0 ? `uses skill path ${likelySkills.join(", ")}` : "",
      alternativeSkills.length > 0 ? `fallback skills ${alternativeSkills.join(", ")}` : "",
      primarySkill ? `primary skill ${primarySkill}` : "",
      fallbackSkills.length > 0 ? `fallback chain ${fallbackSkills.join(" -> ")}` : "",
      workflowSteps.length > 0
        ? `workflow chain ${workflowSteps.map((step) => `${step.role}:${step.skill}`).join(" -> ")}`
        : "",
      rankedSkills.length > 0 ? `ranked skills ${rankedSkills.join(" > ")}` : "",
      prerequisiteWarnings.length > 0
        ? `skill prerequisites ${prerequisiteWarnings.join(", ")}`
        : "",
      capabilityGaps.length > 0 ? `capability gaps ${capabilityGaps.join(", ")}` : "",
      !hasViableFallback ? "no viable fallback identified" : "",
      multiSkillCandidate ? "multi-skill orchestration candidate" : "",
      chainedWorkflow ? "chained workflow active" : "",
      consolidationAction !== "none" ? `consolidation action ${consolidationAction}` : "",
      overlappingSkills.length > 0 ? `overlapping skills ${overlappingSkills.join(", ")}` : "",
      skillFamilies.length > 0 ? `skill families ${skillFamilies.join(", ")}` : "",
      `workspace ${workspaceKind}`,
      capabilitySignals.length > 0 ? `capabilities ${capabilitySignals.join(", ")}` : "",
      preferredValidationTools.length > 0
        ? `preferred validation ${preferredValidationTools.join(", ")}`
        : "",
      toolChain.length > 0 ? `tool chain ${toolChain.join(" -> ")}` : "",
      changedArtifacts.length > 0 ? `on ${changedArtifacts.join(", ")}` : "",
      `with outcome ${outcome}`,
      `goal satisfaction ${goalSatisfaction}`,
      `failure pattern ${failurePattern}`,
      `retry class ${retryClass}`,
      `autonomy mode ${autonomyMode}`,
      `risk ${riskLevel}`,
      suggestedSkill ? `suggested fallback ${suggestedSkill}` : "",
      shouldEscalate ? `requires escalation ${escalationReason ?? "unknown"}` : "",
      nextImprovement ? `Next improvement: ${nextImprovement}` : "",
    ]
      .filter(Boolean)
      .join(": ")
      .replace(/: :/g, ":");

    pushRuntimeCandidate({
      category: "strategy",
      text: proceduralText,
      evidence: proceduralEvidence.length > 0 ? proceduralEvidence : [proceduralText],
      artifactRefs: changedArtifacts,
      environmentTags: uniqueStrings([
        "runtime:procedural",
        `procedural:outcome:${outcome}`,
        `procedural:goal-satisfaction:${goalSatisfaction}`,
        `procedural:retry:${retryClass}`,
        `procedural:autonomy:${autonomyMode}`,
        `procedural:risk:${riskLevel}`,
        `task-mode:${taskMode}`,
        ...(likelySkills.map((skill) => `skill:${skill}`) ?? []),
        ...(toolChain.map((tool) => `tool:${tool}`) ?? []),
        ...(alternativeSkills.map((skill) => `skill:${skill}`) ?? []),
        ...(fallbackSkills.map((skill) => `skill:${skill}`) ?? []),
        ...(workflowSteps.map(
          (step, index) => `procedural:workflow-step:${index + 1}:${step.role}:${step.skill}`,
        ) ?? []),
        ...(rankedSkills.map((skill, index) => `procedural:ranked-skill:${index + 1}:${skill}`) ??
          []),
        ...(prerequisiteWarnings.map((warning) => `procedural:prereq:${warning}`) ?? []),
        ...(capabilityGaps.map((gap) => `procedural:capability-gap:${gap}`) ?? []),
        hasViableFallback ? "procedural:viable-fallback" : "procedural:no-viable-fallback",
        ...(capabilitySignals.map((signal) => `procedural:capability:${signal}`) ?? []),
        ...(preferredValidationTools.map((tool) => `procedural:validation-tool:${tool}`) ?? []),
        ...(skillEnvironments.map((env) => `procedural:skill-env:${env}`) ?? []),
        primarySkill ? `procedural:primary-skill:${primarySkill}` : "",
        `procedural:workspace:${workspaceKind}`,
        `procedural:failure-pattern:${failurePattern}`,
        suggestedSkill ? `procedural:suggested-skill:${suggestedSkill}` : "",
        shouldEscalate ? `procedural:escalate:${escalationReason ?? "unknown"}` : "",
        multiSkillCandidate ? "procedural:multi-skill-candidate" : "",
        chainedWorkflow ? "procedural:chained-workflow" : "",
        consolidationAction !== "none"
          ? `procedural:consolidation-action:${consolidationAction}`
          : "",
        ...(overlappingSkills.map((skill) => `procedural:overlap-skill:${skill}`) ?? []),
        ...(skillFamilies.map((family) => `procedural:skill-family:${family}`) ?? []),
        proceduralExecution.templateCandidate === true ? "procedural:template-candidate" : "",
        proceduralExecution.consolidationCandidate === true
          ? "procedural:consolidation-candidate"
          : "",
        proceduralExecution.nearMissCandidate === true ? "procedural:near-miss" : "",
      ]),
      confidence: outcome === "verified" ? 0.88 : outcome === "partial" ? 0.78 : 0.7,
      strength: outcome === "verified" ? 0.9 : outcome === "partial" ? 0.8 : 0.72,
      importanceClass:
        outcome === "verified" || likelySkills.length > 0 || toolChain.length > 1 || shouldEscalate
          ? "useful"
          : "temporary",
      trend:
        proceduralExecution.templateCandidate === true ||
        proceduralExecution.consolidationCandidate === true ||
        proceduralExecution.nearMissCandidate === true
          ? "rising"
          : "stable",
    });

    if (availableSkills.length > 0 && availableSkills.length <= 8) {
      pushRuntimeCandidate({
        category: "strategy",
        text: `Available skill surface for current execution: ${availableSkills.join(", ")}`,
        evidence: [availableSkills.join(", ")],
        artifactRefs: changedArtifacts,
        environmentTags: [
          "runtime:procedural",
          "procedural:available-skills",
          `task-mode:${taskMode}`,
        ],
        confidence: 0.68,
        strength: 0.64,
        importanceClass: "temporary",
        trend: "stable",
      });
    }
  }

  return candidates;
}

export function mergeLongTermMemory(
  existing: LongTermMemoryEntry[],
  incoming: LongTermMemoryEntry[],
): LongTermMemoryEntry[] {
  const byIdentity = new Map<string, LongTermMemoryEntry>();
  for (const item of existing) {
    byIdentity.set(item.semanticKey || normalizeComparable(item.text), cloneLongTermEntry(item));
  }
  for (const item of incoming) {
    const key = item.semanticKey || normalizeComparable(item.text);
    const current = byIdentity.get(key) ?? findConceptMatch(byIdentity.values(), item);
    if (!current) {
      const permanence = evaluatePermanenceStatus(item);
      byIdentity.set(key, {
        ...item,
        entityAliases: uniqueStrings([
          ...(item.entityAliases ?? []),
          ...buildResolvedEntityAliases(item),
        ]),
        entityIds: uniqueIds(item.entityIds ?? []),
        evidence: dedupeTexts(item.evidence, MAX_WORKING_ITEMS),
        permanenceStatus: permanence.status,
        permanenceReasons: permanence.reasons,
      });
      continue;
    }
    current.updatedAt = Date.now();
    const revisionKind = classifyRevisionKind(current, item);
    current.semanticKey = current.semanticKey || item.semanticKey || key;
    current.conceptKey =
      current.conceptKey ||
      item.conceptKey ||
      buildMemoryConceptKey({
        category: current.category,
        ontologyKind: current.ontologyKind,
        text: current.text,
        versionScope: current.versionScope,
        installProfileScope: current.installProfileScope,
        customerScope: current.customerScope,
        artifactRefs: current.artifactRefs,
      });
    current.canonicalText = current.canonicalText || canonicalizeComparable(current.text);
    current.conceptAliases = uniqueStrings([
      ...(current.conceptAliases ?? []),
      ...(item.conceptAliases ?? []),
      current.text,
      item.text,
    ]);
    current.entityAliases = uniqueStrings([
      ...(current.entityAliases ?? []),
      ...(item.entityAliases ?? []),
      ...buildResolvedEntityAliases(current),
      ...buildResolvedEntityAliases(item),
    ]);
    current.entityIds = uniqueIds([...(current.entityIds ?? []), ...(item.entityIds ?? [])]);
    current.ontologyKind = item.ontologyKind ?? current.ontologyKind;
    current.strength = Math.min(1, Math.max(current.strength, item.strength) + 0.03);
    current.confidence = Math.min(1, Math.max(current.confidence, item.confidence) + 0.02);
    current.revisionCount = (current.revisionCount ?? 0) + 1;
    current.lastRevisionKind = revisionKind;
    current.evidence = dedupeTexts([...current.evidence, ...item.evidence], MAX_WORKING_ITEMS);
    current.provenance = mergeProvenance(current.provenance, item.provenance);
    current.relatedMemoryIds = uniqueIds([...current.relatedMemoryIds, ...item.relatedMemoryIds]);
    current.relations = mergeRelations(current.relations, item.relations);
    current.versionScope = current.versionScope ?? item.versionScope;
    current.installProfileScope = current.installProfileScope ?? item.installProfileScope;
    current.customerScope = current.customerScope ?? item.customerScope;
    current.environmentTags = uniqueStrings([
      ...(current.environmentTags ?? []),
      ...(item.environmentTags ?? []),
    ]);
    current.artifactRefs = uniqueStrings([
      ...(current.artifactRefs ?? []),
      ...(item.artifactRefs ?? []),
    ]);
    current.lastConfirmedAt = Date.now();
    current.trend = "rising";
    if (revisionKind === "updated" || revisionKind === "narrowed") {
      current.text = item.text;
      current.canonicalText = canonicalizeComparable(item.text);
      if (
        sourceTypeReliabilityScore(item.sourceType) >=
        sourceTypeReliabilityScore(current.sourceType)
      ) {
        current.sourceType = item.sourceType;
      }
      current.evidence = dedupeTexts([item.text, ...current.evidence], MAX_WORKING_ITEMS);
    }
    if (revisionKind === "contested") {
      current.activeStatus = "pending";
      current.adjudicationStatus = "contested";
      current.contradictionCount = Math.max(1, current.contradictionCount);
      current.confidence = Math.max(0.35, current.confidence - 0.08);
      current.provenance = mergeProvenance(current.provenance, [
        createProvenanceRecord("derived", `contested revision: ${item.text}`, [item.id]),
      ]);
    }
    current.importanceClass =
      current.importanceClass === "critical" || item.importanceClass === "critical"
        ? "critical"
        : current.importanceClass === "useful" || item.importanceClass === "useful"
          ? "useful"
          : item.importanceClass;
    current.compressionState =
      item.compressionState === "compressed" ? item.compressionState : current.compressionState;
    current.activeStatus =
      current.activeStatus === "superseded" && item.activeStatus !== "superseded"
        ? item.activeStatus
        : current.activeStatus;
    if (baseStrengthForCategory(item.category) > baseStrengthForCategory(current.category)) {
      current.category = item.category;
    }
    if (revisionKind !== "contested") {
      current.adjudicationStatus = inferAdjudicationStatus({
        activeStatus: current.activeStatus,
        contradictionCount: current.contradictionCount,
      });
    }
    const permanence = evaluatePermanenceStatus(current);
    current.permanenceStatus = permanence.status;
    current.permanenceReasons = permanence.reasons;
  }
  return [...byIdentity.values()]
    .toSorted((a, b) => b.strength - a.strength || b.updatedAt - a.updatedAt)
    .slice(0, MAX_LONG_TERM_ITEMS);
}

export function mergePendingSignificance(
  existing: PendingMemoryEntry[],
  incoming: PendingMemoryEntry[],
): PendingMemoryEntry[] {
  const byText = new Map<string, PendingMemoryEntry>();
  for (const item of existing) {
    byText.set(normalizeComparable(item.text), clonePendingEntry(item));
  }
  for (const item of incoming) {
    const key = normalizeComparable(item.text);
    const current = byText.get(key);
    if (!current) {
      byText.set(key, {
        ...item,
        evidence: dedupeTexts(item.evidence, MAX_WORKING_ITEMS),
      });
      continue;
    }
    current.updatedAt = Date.now();
    current.strength = Math.min(1, Math.max(current.strength, item.strength) + 0.02);
    current.confidence = Math.min(1, Math.max(current.confidence, item.confidence) + 0.02);
    current.evidence = dedupeTexts([...current.evidence, ...item.evidence], MAX_WORKING_ITEMS);
    current.provenance = mergeProvenance(current.provenance, item.provenance);
    current.relatedMemoryIds = uniqueIds([...current.relatedMemoryIds, ...item.relatedMemoryIds]);
    current.relations = mergeRelations(current.relations, item.relations);
    current.versionScope = current.versionScope ?? item.versionScope;
    current.installProfileScope = current.installProfileScope ?? item.installProfileScope;
    current.customerScope = current.customerScope ?? item.customerScope;
    current.environmentTags = uniqueStrings([
      ...(current.environmentTags ?? []),
      ...(item.environmentTags ?? []),
    ]);
    current.artifactRefs = uniqueStrings([
      ...(current.artifactRefs ?? []),
      ...(item.artifactRefs ?? []),
    ]);
    current.lastConfirmedAt = Date.now();
  }
  return [...byText.values()]
    .toSorted((a, b) => b.strength - a.strength || b.updatedAt - a.updatedAt)
    .slice(0, MAX_PENDING_ITEMS);
}

function isContradictoryPair(a: LongTermMemoryEntry, b: LongTermMemoryEntry): boolean {
  if (a.category !== b.category) {
    return false;
  }
  const overlap = computeOverlapScore(a.text, new Set(tokenize(b.text)));
  if (overlap < 3) {
    return false;
  }
  return (
    (/\b(use|enable|always|must|keep|preserve)\b/i.test(a.text) &&
      /\b(not|avoid|disable|never|remove|drop)\b/i.test(b.text)) ||
    (/\b(use|enable|always|must|keep|preserve)\b/i.test(b.text) &&
      /\b(not|avoid|disable|never|remove|drop)\b/i.test(a.text))
  );
}

function annotateContradictions(entries: LongTermMemoryEntry[]): LongTermMemoryEntry[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.id, entry.contradictionCount ?? 0);
  }
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      if (!isContradictoryPair(entries[i], entries[j])) {
        continue;
      }
      counts.set(entries[i].id, (counts.get(entries[i].id) ?? 0) + 1);
      counts.set(entries[j].id, (counts.get(entries[j].id) ?? 0) + 1);
    }
  }

  return entries.map((entry) => {
    const contradictionCount = counts.get(entry.id) ?? 0;
    const activeStatus =
      contradictionCount > 0 && entry.activeStatus !== "superseded"
        ? "pending"
        : entry.activeStatus;
    const permanence = evaluatePermanenceStatus({
      ...entry,
      activeStatus,
      contradictionCount,
    });
    return {
      ...entry,
      contradictionCount,
      activeStatus,
      adjudicationStatus: inferAdjudicationStatus({
        activeStatus,
        contradictionCount,
      }),
      permanenceStatus: permanence.status,
      permanenceReasons: permanence.reasons,
      confidence:
        contradictionCount > 0
          ? Math.max(0.35, entry.confidence - contradictionCount * 0.08)
          : entry.confidence,
    };
  });
}

function promotePendingMemories(params: {
  pending: PendingMemoryEntry[];
  messages: AgentMessage[];
}): { durable: LongTermMemoryEntry[]; remaining: PendingMemoryEntry[]; reactivated: string[] } {
  const lines = gatherRelevantLines(params.messages);
  const promoted: LongTermMemoryEntry[] = [];
  const remaining: PendingMemoryEntry[] = [];
  const reactivated: string[] = [];

  for (const item of params.pending) {
    const overlap = Math.max(
      ...[item.text, ...lines].map((line) =>
        computeOverlapScore(line, new Set(tokenize(item.text))),
      ),
      0,
    );
    const shouldPromote =
      overlap >= RECURRENCE_PROMOTION_OVERLAP || item.strength >= 0.8 || item.confidence >= 0.86;
    if (!shouldPromote) {
      remaining.push(item);
      continue;
    }
    const { pendingReason: _pendingReason, ...baseEntry } = item;
    promoted.push({
      ...baseEntry,
      activeStatus: "active",
      adjudicationStatus: inferAdjudicationStatus({
        activeStatus: "active",
        contradictionCount: item.contradictionCount,
      }),
      revisionCount: item.revisionCount,
      lastRevisionKind: item.lastRevisionKind,
      importanceClass: item.importanceClass === "temporary" ? "useful" : item.importanceClass,
      strength: Math.min(1, item.strength + 0.08),
      confidence: Math.min(1, item.confidence + 0.06),
    });
    reactivated.push(item.text);
  }

  return {
    durable: promoted,
    remaining,
    reactivated,
  };
}

function refreshLongTermLifecycle(
  entries: LongTermMemoryEntry[],
  messages: AgentMessage[],
): { entries: LongTermMemoryEntry[]; reactivated: string[] } {
  const now = Date.now();
  const queryTokens = new Set(tokenize(gatherRelevantLines(messages).join(" ")));
  const reactivated: string[] = [];

  const refreshed = entries.map((entry) => {
    const lastTouch = entry.lastAccessedAt ?? entry.updatedAt;
    const age = now - lastTouch;
    const overlap = computeOverlapScore(entry.text, queryTokens);
    let compressionState = entry.compressionState;
    let activeStatus = entry.activeStatus;
    let strength = entry.strength;
    let confidence = entry.confidence;
    let trend: MemoryTrend = entry.trend;

    if (age >= LATENT_AFTER_MS && entry.accessCount <= 1) {
      compressionState = "latent";
      if (activeStatus === "active") {
        activeStatus = "stale";
      }
      trend = "fading";
    } else if (age >= COMPRESS_AFTER_MS && entry.accessCount <= 2) {
      compressionState = "compressed";
      trend = "fading";
    } else if (entry.accessCount > 0 || age < COMPRESS_AFTER_MS) {
      compressionState = "stable";
      trend = "stable";
    }

    if (compressionState === "latent" && overlap >= 2) {
      compressionState = "stable";
      activeStatus = "active";
      strength = Math.min(1, strength + 0.05);
      confidence = Math.min(1, confidence + 0.03);
      trend = "rising";
      reactivated.push(entry.text);
    }

    if (entry.contradictionCount === 0 && activeStatus === "pending") {
      activeStatus = "active";
    }

    return {
      ...entry,
      compressionState,
      activeStatus,
      adjudicationStatus: inferAdjudicationStatus({
        activeStatus,
        contradictionCount: entry.contradictionCount,
      }),
      ...(() => {
        const permanence = evaluatePermanenceStatus({
          ...entry,
          activeStatus,
        });
        return {
          permanenceStatus: permanence.status,
          permanenceReasons: permanence.reasons,
        };
      })(),
      strength,
      confidence,
      trend,
    };
  });

  return {
    entries: annotateContradictions(refreshed),
    reactivated: dedupeTexts(reactivated, MAX_PACKET_ITEMS),
  };
}

function createPermanentRoot(): PermanentMemoryNode {
  const now = Date.now();
  return {
    id: "root",
    label: "permanent-memory",
    nodeType: "root",
    updatedAt: now,
    evidence: [],
    sourceMemoryIds: [],
    confidence: 1,
    activeStatus: "active",
    children: [
      {
        id: "identity",
        label: "identity",
        nodeType: "entity",
        relationToParent: "contains",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
      {
        id: "projects",
        label: "projects",
        nodeType: "context",
        relationToParent: "contains",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
      {
        id: "preferences",
        label: "preferences",
        nodeType: "rule",
        relationToParent: "contains",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
      {
        id: "operating-rules",
        label: "operating-rules",
        nodeType: "rule",
        relationToParent: "contains",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
      {
        id: "facts",
        label: "facts",
        nodeType: "context",
        relationToParent: "contains",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
      {
        id: "constraints",
        label: "constraints",
        nodeType: "rule",
        relationToParent: "contains",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
      {
        id: "outcomes",
        label: "outcomes",
        nodeType: "lesson",
        relationToParent: "contains",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
      {
        id: "patterns",
        label: "patterns",
        nodeType: "pattern",
        relationToParent: "contains",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
    ],
  };
}

function ensureChildNode(
  parent: PermanentMemoryNode,
  label: string,
  nodeType: PermanentNodeType = "context",
): PermanentMemoryNode {
  const existing = parent.children.find((child) => child.label === label);
  if (existing) {
    return existing;
  }
  const next: PermanentMemoryNode = {
    id: `${parent.id}/${label}`,
    label,
    nodeType,
    relationToParent: "contains",
    updatedAt: Date.now(),
    evidence: [],
    sourceMemoryIds: [],
    confidence: 0.7,
    activeStatus: "active",
    children: [],
  };
  parent.children.push(next);
  return next;
}

function flattenPermanentNodes(root: PermanentMemoryNode): PermanentMemoryNode[] {
  const output: PermanentMemoryNode[] = [];
  const visit = (node: PermanentMemoryNode) => {
    output.push(node);
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return output;
}

function permanentTreeHasMemoryId(
  root: PermanentMemoryNode | undefined,
  memoryId: string,
): boolean {
  if (!root) {
    return false;
  }
  return flattenPermanentNodes(root).some((node) => node.sourceMemoryIds.includes(memoryId));
}

function shouldSurfacePermanentNode(node: PermanentMemoryNode, taskMode: MemoryTaskMode): boolean {
  if (node.activeStatus === "archived") {
    return taskMode === "debugging";
  }
  if (node.activeStatus === "superseded") {
    return taskMode === "debugging";
  }
  return true;
}

function clonePermanentNodeForHistory(node: PermanentMemoryNode): PermanentMemoryNode {
  return {
    ...node,
    id: `${node.id}/history`,
    children: node.children.map(clonePermanentNodeForHistory),
  };
}

function shouldKeepStructuralPermanentNode(
  node: PermanentMemoryNode,
  parent: PermanentMemoryNode | undefined,
): boolean {
  if (!parent) {
    return true;
  }
  if (parent.id === "root") {
    return new Set([
      "identity",
      "projects",
      "preferences",
      "operating-rules",
      "facts",
      "constraints",
      "outcomes",
      "patterns",
      "history",
    ]).has(node.label);
  }
  if (parent.label === "history") {
    return node.label === "retired";
  }
  return false;
}

function reconcilePermanentMemoryTree(params: {
  root: PermanentMemoryNode;
  longTermMemory: LongTermMemoryEntry[];
  adjudications?: PersistedMemoryAdjudication[];
}): PermanentMemoryNode {
  const sourceById = new Map(params.longTermMemory.map((entry) => [entry.id, entry]));
  const historyBranch = ensureChildNode(params.root, "history", "context");
  const retiredBranch = ensureChildNode(historyBranch, "retired", "context");

  const reconcileNode = (
    node: PermanentMemoryNode,
    parent: PermanentMemoryNode | undefined,
  ): PermanentMemoryNode | undefined => {
    const isHistoryNode = Boolean(parent?.label === "history" || parent?.label === "retired");
    node.children = node.children
      .filter((child) => child.id !== historyBranch.id)
      .map((child) => reconcileNode(child, node))
      .filter((child): child is PermanentMemoryNode => Boolean(child));

    const sourceEntries = node.sourceMemoryIds
      .map((id) => sourceById.get(id))
      .filter((entry): entry is LongTermMemoryEntry => Boolean(entry));
    if (sourceEntries.length > 0 && !isHistoryNode) {
      const sourceAdjudications = sourceEntries
        .map((entry) => resolveEntryAdjudication(entry, params.adjudications))
        .filter((item): item is PersistedMemoryAdjudication => Boolean(item));
      const allRetired = sourceEntries.every(
        (entry) =>
          entry.activeStatus === "superseded" ||
          entry.activeStatus === "archived" ||
          entry.permanenceStatus === "blocked",
      );
      const allSuperseded = sourceEntries.every(
        (entry) => entry.activeStatus === "superseded" || entry.activeStatus === "archived",
      );
      const allBlocked = sourceEntries.every((entry) => entry.permanenceStatus === "blocked");
      const hasScopedAlternatives = sourceAdjudications.some(
        (item) => item.resolutionKind === "scoped_alternative",
      );

      node.sourceMemoryIds = uniqueIds(sourceEntries.map((entry) => entry.id));
      node.confidence = Math.max(
        node.confidence,
        ...sourceEntries.map((entry) => entry.confidence),
      );
      node.updatedAt = Math.max(node.updatedAt, ...sourceEntries.map((entry) => entry.updatedAt));
      node.activeStatus = allSuperseded ? "superseded" : allRetired ? "archived" : "active";
      if (allSuperseded) {
        node.relationToParent = "superseded_by";
      }
      node.evidence = dedupeTexts(
        [
          ...node.evidence,
          allBlocked ? "Archived after permanent invalidation review." : "",
          hasScopedAlternatives ? "Permanent branch has scoped alternatives." : "",
        ].filter(Boolean),
        MAX_WORKING_ITEMS,
      );

      if (
        parent &&
        node.summary &&
        node.activeStatus !== "active" &&
        parent.id !== retiredBranch.id
      ) {
        const historyKey = normalizeComparable(node.summary);
        const existingHistory = retiredBranch.children.find(
          (child) => normalizeComparable(child.summary ?? child.label) === historyKey,
        );
        const historyNode = existingHistory ?? clonePermanentNodeForHistory(node);
        historyNode.id =
          existingHistory?.id ?? `${retiredBranch.id}/${retiredBranch.children.length + 1}`;
        historyNode.label = node.label;
        historyNode.summary = node.summary;
        historyNode.nodeType = node.nodeType;
        historyNode.relationToParent =
          node.activeStatus === "superseded" ? "superseded_by" : "derived_from";
        historyNode.evidence = dedupeTexts(
          [...node.evidence, "Retained in permanent history after invalidation review."],
          MAX_WORKING_ITEMS,
        );
        historyNode.sourceMemoryIds = [...node.sourceMemoryIds];
        historyNode.confidence = node.confidence;
        historyNode.activeStatus = "archived";
        historyNode.updatedAt = node.updatedAt;
        historyNode.children = [];
        if (!existingHistory) {
          retiredBranch.children.push(historyNode);
        }
      }
    }

    const isStructural = !node.summary && node.sourceMemoryIds.length === 0;
    if (
      node.id !== params.root.id &&
      node.id !== historyBranch.id &&
      node.id !== retiredBranch.id &&
      isStructural &&
      node.children.length === 0 &&
      !shouldKeepStructuralPermanentNode(node, parent)
    ) {
      return undefined;
    }
    return node;
  };

  params.root.children = params.root.children
    .map((child) => reconcileNode(child, params.root))
    .filter((child): child is PermanentMemoryNode => Boolean(child));
  return params.root;
}

function collectRelevantPermanentNodes(params: {
  permanentMemory: PermanentMemoryNode;
  longTermMemory: LongTermMemoryEntry[];
  queryTokens: Set<string>;
  taskMode: MemoryTaskMode;
  scopeContext?: MemoryScopeContext;
  adjudications?: PersistedMemoryAdjudication[];
}): PermanentMemoryNode[] {
  const entriesById = new Map(params.longTermMemory.map((entry) => [entry.id, entry]));
  return flattenPermanentNodes(params.permanentMemory)
    .filter((node) => node.summary)
    .filter((node) => shouldSurfacePermanentNode(node, params.taskMode))
    .filter((node) => {
      if (node.sourceMemoryIds.length === 0) {
        return true;
      }
      const sourceEntries = node.sourceMemoryIds
        .map((id) => entriesById.get(id))
        .filter((entry): entry is LongTermMemoryEntry => Boolean(entry));
      if (sourceEntries.length === 0) {
        return true;
      }
      return sourceEntries.some((entry) =>
        shouldIncludeScopedEntry({
          entry,
          taskMode: params.taskMode,
          scopeContext: params.scopeContext,
          adjudications: params.adjudications,
        }),
      );
    })
    .toSorted((a, b) => {
      const aSourceEntries = a.sourceMemoryIds
        .map((id) => entriesById.get(id))
        .filter((entry): entry is LongTermMemoryEntry => Boolean(entry));
      const bSourceEntries = b.sourceMemoryIds
        .map((id) => entriesById.get(id))
        .filter((entry): entry is LongTermMemoryEntry => Boolean(entry));
      const aScope = Math.max(
        0,
        ...aSourceEntries.map((entry) => countExplicitScopeMatches(entry, params.scopeContext)),
      );
      const bScope = Math.max(
        0,
        ...bSourceEntries.map((entry) => countExplicitScopeMatches(entry, params.scopeContext)),
      );
      return (
        bScope - aScope ||
        computeOverlapScore(b.summary ?? "", params.queryTokens) -
          computeOverlapScore(a.summary ?? "", params.queryTokens)
      );
    })
    .slice(0, MAX_PACKET_ITEMS);
}

function selectPermanentBranch(
  entry: Pick<LongTermMemoryEntry, "category" | "ontologyKind">,
): string[] {
  switch (entry.ontologyKind) {
    case "preference":
      return ["preferences"];
    case "constraint":
      return ["constraints", entry.category === "decision" ? "decisions" : "rules"];
    case "pattern":
      return ["patterns", entry.category === "pattern" ? "generalized" : "strategies"];
    case "entity":
      return ["identity"];
    case "outcome":
      return ["outcomes", entry.category === "episode" ? "episodes" : "lessons"];
    case "fact":
    default:
      return ["facts"];
  }
}

function selectPermanentNodeType(category: MemoryCategory): PermanentNodeType {
  switch (category) {
    case "entity":
      return "entity";
    case "decision":
    case "preference":
      return "rule";
    case "pattern":
      return "pattern";
    case "episode":
      return "lesson";
    case "strategy":
      return "lesson";
    default:
      return "context";
  }
}

function buildPatternMemoryEntries(entries: LongTermMemoryEntry[]): LongTermMemoryEntry[] {
  const eligible = entries.filter(
    (entry) =>
      entry.activeStatus !== "superseded" &&
      entry.category !== "pattern" &&
      entry.category !== "entity" &&
      entry.category !== "preference",
  );
  const groups = new Map<string, LongTermMemoryEntry[]>();

  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const a = eligible[i];
      const b = eligible[j];
      const shared = tokenize(a.text).filter((token) => tokenize(b.text).includes(token));
      if (shared.length < 3) {
        continue;
      }
      const key = shared.slice(0, 4).toSorted().join("-");
      const bucket = groups.get(key) ?? [];
      bucket.push(a, b);
      groups.set(key, bucket);
    }
  }

  const patterns: LongTermMemoryEntry[] = [];
  for (const [key, group] of groups.entries()) {
    const deduped = [...new Map(group.map((entry) => [entry.id, entry])).values()];
    if (deduped.length < 2) {
      continue;
    }
    const sharedTokens = key.split("-").filter(Boolean);
    const summary = clipText(
      `Pattern memory: repeated ${sharedTokens.join(" ")} signals across ${deduped.length} related memories.`,
      220,
    );
    const semanticKey = buildMemorySemanticKey({
      category: "pattern",
      text: summary,
      versionScope: deduped.find((entry) => entry.versionScope)?.versionScope,
      installProfileScope: deduped.find((entry) => entry.installProfileScope)?.installProfileScope,
      customerScope: deduped.find((entry) => entry.customerScope)?.customerScope,
      artifactRefs: uniqueStrings(deduped.flatMap((entry) => entry.artifactRefs ?? [])),
    });
    const patternId = buildStableMemoryId("pattern", semanticKey);
    patterns.push({
      id: patternId,
      semanticKey,
      conceptKey: buildMemoryConceptKey({
        category: "pattern",
        ontologyKind: "pattern",
        text: summary,
        versionScope: deduped.find((entry) => entry.versionScope)?.versionScope,
        installProfileScope: deduped.find((entry) => entry.installProfileScope)
          ?.installProfileScope,
        customerScope: deduped.find((entry) => entry.customerScope)?.customerScope,
        artifactRefs: uniqueStrings(deduped.flatMap((entry) => entry.artifactRefs ?? [])),
      }),
      canonicalText: canonicalizeComparable(summary),
      conceptAliases: [summary, ...deduped.map((entry) => entry.text)],
      ontologyKind: "pattern",
      category: "pattern",
      text: summary,
      strength: Math.min(
        0.96,
        deduped.reduce((max, entry) => Math.max(max, entry.strength), 0.78) + 0.04,
      ),
      evidence: dedupeTexts(
        deduped.flatMap((entry) => entry.evidence),
        MAX_WORKING_ITEMS,
      ),
      provenance: [
        createProvenanceRecord(
          "derived",
          summary,
          deduped.map((entry) => entry.id),
        ),
      ],
      sourceType: "system_inferred",
      confidence:
        Math.min(
          0.95,
          deduped.reduce((sum, entry) => sum + entry.confidence, 0) / deduped.length,
        ) || 0.8,
      importanceClass: "useful",
      compressionState: "stable",
      activeStatus: "active",
      adjudicationStatus: "authoritative",
      revisionCount: 0,
      lastRevisionKind: "new",
      permanenceStatus: "deferred",
      permanenceReasons: [],
      trend: "rising",
      accessCount: 0,
      createdAt: Date.now(),
      lastConfirmedAt: Date.now(),
      contradictionCount: 0,
      relatedMemoryIds: deduped.map((entry) => entry.id),
      relations: deduped.map((entry) => ({
        sourceMemoryId: patternId,
        type: "derived_from" as const,
        targetMemoryId: entry.id,
        weight: 0.88,
      })),
      versionScope: deduped.find((entry) => entry.versionScope)?.versionScope,
      installProfileScope: deduped.find((entry) => entry.installProfileScope)?.installProfileScope,
      customerScope: deduped.find((entry) => entry.customerScope)?.customerScope,
      environmentTags: uniqueStrings(deduped.flatMap((entry) => entry.environmentTags ?? [])),
      artifactRefs: uniqueStrings(deduped.flatMap((entry) => entry.artifactRefs ?? [])),
      updatedAt: Date.now(),
    });
  }

  return patterns;
}

function annotateRelations(entries: LongTermMemoryEntry[]): LongTermMemoryEntry[] {
  const next = entries.map(cloneLongTermEntry);
  for (let i = 0; i < next.length; i += 1) {
    for (let j = i + 1; j < next.length; j += 1) {
      const a = next[i];
      const b = next[j];
      const overlap = computeOverlapScore(a.text, new Set(tokenize(b.text)));
      if (overlap < 3) {
        continue;
      }
      const relationType = isContradictoryPair(a, b) ? "contradicts" : "relevant_to";
      const weight = Math.min(0.95, 0.45 + overlap * 0.08);
      a.relations = mergeRelations(a.relations, [
        { sourceMemoryId: a.id, type: relationType, targetMemoryId: b.id, weight },
      ]);
      b.relations = mergeRelations(b.relations, [
        { sourceMemoryId: b.id, type: relationType, targetMemoryId: a.id, weight },
      ]);
      a.relatedMemoryIds = uniqueIds([...a.relatedMemoryIds, b.id]);
      b.relatedMemoryIds = uniqueIds([...b.relatedMemoryIds, a.id]);
    }
  }
  return next;
}

function applySupersession(entries: LongTermMemoryEntry[]): {
  entries: LongTermMemoryEntry[];
  supersededCount: number;
} {
  const next = entries.map(cloneLongTermEntry);
  let supersededCount = 0;

  for (let i = 0; i < next.length; i += 1) {
    const newer = next[i];
    if (
      !(
        /\b(replaced|replace|no longer|obsolete|superseded)\b/i.test(newer.text) ||
        /\bfixed permanently\b/i.test(newer.text) ||
        /\binstead\s+of\b/i.test(newer.text)
      )
    ) {
      continue;
    }
    for (let j = 0; j < next.length; j += 1) {
      if (i === j) {
        continue;
      }
      const older = next[j];
      if (older.updatedAt > newer.updatedAt || older.activeStatus === "superseded") {
        continue;
      }
      if (computeOverlapScore(older.text, new Set(tokenize(newer.text))) < 3) {
        continue;
      }
      older.activeStatus = "superseded";
      older.adjudicationStatus = "superseded";
      older.supersededById = newer.id;
      older.trend = "fading";
      older.provenance = mergeProvenance(older.provenance, [
        createProvenanceRecord("derived", `superseded by ${newer.text}`, [newer.id]),
      ]);
      older.permanenceStatus = "blocked";
      older.permanenceReasons = ["superseded memory is not eligible for permanent truth"];
      older.relatedMemoryIds = uniqueIds([...older.relatedMemoryIds, newer.id]);
      older.relations = mergeRelations(older.relations, [
        { sourceMemoryId: older.id, type: "superseded_by", targetMemoryId: newer.id, weight: 0.96 },
      ]);
      newer.relations = mergeRelations(newer.relations, [
        { sourceMemoryId: newer.id, type: "confirmed_by", targetMemoryId: older.id, weight: 0.62 },
      ]);
      newer.adjudicationStatus = inferAdjudicationStatus({
        activeStatus: newer.activeStatus,
        contradictionCount: newer.contradictionCount,
      });
      {
        const permanence = evaluatePermanenceStatus(newer);
        newer.permanenceStatus = permanence.status;
        newer.permanenceReasons = permanence.reasons;
      }
      supersededCount += 1;
    }
  }

  return { entries: next, supersededCount };
}

function reviewMemoryState(params: {
  workingMemory: WorkingMemorySnapshot;
  longTermMemory: LongTermMemoryEntry[];
  pendingSignificance: PendingMemoryEntry[];
  revisions?: PersistedMemoryRevision[];
  adjudications?: PersistedMemoryAdjudication[];
}): MemoryReviewResult {
  const longTermMemory = reviseReviewInputsFromHistory({
    entries: params.longTermMemory,
    revisions: params.revisions ?? [],
    adjudications: params.adjudications ?? [],
  });
  const conceptIdsFor = (entries: LongTermMemoryEntry[]) =>
    uniqueIds(entries.map((entry) => getEntryConceptId(entry))).slice(0, MAX_WORKING_ITEMS);
  const archivedMemoryIds = longTermMemory
    .filter(
      (entry) =>
        ((entry.activeStatus === "superseded" && entry.compressionState === "latent") ||
          entry.activeStatus === "archived") &&
        entry.accessCount === 0,
    )
    .map((entry) => entry.id);
  const staleMemoryIds = longTermMemory
    .filter((entry) => entry.activeStatus === "stale" || entry.compressionState === "latent")
    .map((entry) => entry.id)
    .slice(0, MAX_WORKING_ITEMS);
  const reviewedPendingIds = params.pendingSignificance
    .map((entry) => entry.id)
    .slice(0, MAX_WORKING_ITEMS);
  const contradictoryMemoryIds = longTermMemory
    .filter((entry) => entry.contradictionCount > 0)
    .map((entry) => entry.id)
    .slice(0, MAX_WORKING_ITEMS);
  const contradictoryConceptIds = conceptIdsFor(
    longTermMemory.filter((entry) => entry.contradictionCount > 0),
  );
  const scopedAlternativeConceptIds = uniqueIds(
    (params.adjudications ?? [])
      .filter((adjudication) => adjudication.resolutionKind === "scoped_alternative")
      .map((adjudication) => adjudication.conceptId),
  ).slice(0, MAX_WORKING_ITEMS);
  const supersededMemoryIds = longTermMemory
    .filter((entry) => entry.activeStatus === "superseded")
    .map((entry) => entry.id)
    .slice(0, MAX_WORKING_ITEMS);
  const supersededConceptIds = conceptIdsFor(
    longTermMemory.filter((entry) => entry.activeStatus === "superseded"),
  );
  const contestedRevisionConceptIds = uniqueIds(
    (params.revisions ?? [])
      .filter((revision) => revision.adjudicationStatus === "contested")
      .map((revision) => revision.conceptId),
  ).slice(0, MAX_WORKING_ITEMS);
  const contestedAdjudicationConceptIds = uniqueIds(
    (params.adjudications ?? [])
      .filter((adjudication) => adjudication.status === "contested")
      .map((adjudication) => adjudication.conceptId),
  ).slice(0, MAX_WORKING_ITEMS);
  const revisedConceptIds = uniqueIds(
    (params.revisions ?? [])
      .filter(
        (revision) => revision.revisionKind !== "new" && revision.revisionKind !== "reasserted",
      )
      .map((revision) => revision.conceptId),
  ).slice(0, MAX_WORKING_ITEMS);
  const permanentEligibleIds = longTermMemory
    .filter((entry) => entry.permanenceStatus === "eligible")
    .map((entry) => entry.id)
    .slice(0, MAX_WORKING_ITEMS);
  const permanentEligibleConceptIds = conceptIdsFor(
    longTermMemory.filter((entry) => entry.permanenceStatus === "eligible"),
  );
  const permanentDeferredIds = longTermMemory
    .filter((entry) => entry.permanenceStatus === "deferred")
    .map((entry) => entry.id)
    .slice(0, MAX_WORKING_ITEMS);
  const permanentDeferredConceptIds = conceptIdsFor(
    longTermMemory.filter((entry) => entry.permanenceStatus === "deferred"),
  );
  const permanentBlockedIds = longTermMemory
    .filter((entry) => entry.permanenceStatus === "blocked")
    .map((entry) => entry.id)
    .slice(0, MAX_WORKING_ITEMS);
  const permanentBlockedConceptIds = conceptIdsFor(
    longTermMemory.filter((entry) => entry.permanenceStatus === "blocked"),
  );
  const carryForwardSummary = clipText(
    [
      params.workingMemory.rollingSummary,
      params.workingMemory.activeGoals[0] ? `Top goal: ${params.workingMemory.activeGoals[0]}` : "",
      params.workingMemory.openLoops[0] ? `Open loop: ${params.workingMemory.openLoops[0]}` : "",
      params.pendingSignificance[0] ? `Pending review: ${params.pendingSignificance[0].text}` : "",
      contradictoryMemoryIds[0]
        ? `Contradictions need resolution: ${contradictoryMemoryIds.length}`
        : "",
      contestedRevisionConceptIds[0]
        ? `Concepts with contested revision history: ${contestedRevisionConceptIds.length}`
        : contestedAdjudicationConceptIds[0]
          ? `Concepts with contested adjudication: ${contestedAdjudicationConceptIds.length}`
          : "",
      scopedAlternativeConceptIds[0]
        ? `Scope-specific concept variants available: ${scopedAlternativeConceptIds.length}`
        : "",
      supersededMemoryIds[0] ? `Superseded memories to retire: ${supersededMemoryIds.length}` : "",
      permanentDeferredIds[0]
        ? `Durable memories waiting for permanence: ${permanentDeferredIds.length}`
        : "",
      permanentBlockedIds[0]
        ? `Permanent-memory blocks to review: ${permanentBlockedIds.length}`
        : "",
    ]
      .filter(Boolean)
      .join(" | "),
    320,
  );

  return {
    carryForwardSummary: carryForwardSummary || undefined,
    archivedMemoryIds,
    staleMemoryIds,
    reviewedPendingIds,
    contradictoryMemoryIds,
    contradictoryConceptIds,
    scopedAlternativeConceptIds,
    supersededMemoryIds,
    supersededConceptIds,
    contestedRevisionConceptIds,
    revisedConceptIds,
    permanentEligibleIds,
    permanentEligibleConceptIds,
    permanentDeferredIds,
    permanentDeferredConceptIds,
    permanentBlockedIds,
    permanentBlockedConceptIds,
  };
}

function selectArtifactRelationType(entry: LongTermMemoryEntry): MemoryRelationType {
  if (
    entry.category === "episode" ||
    /\b(fixed|resolved|preserved|restored|regression|outcome|result|workaround)\b/i.test(entry.text)
  ) {
    return "confirmed_by";
  }
  if (entry.category === "pattern" || entry.category === "strategy") {
    return "derived_from";
  }
  if (
    entry.category === "decision" ||
    entry.category === "preference" ||
    /\b(must|required|always|never|constraint|preserve|keep|use)\b/i.test(entry.text)
  ) {
    return "relevant_to";
  }
  return "linked_to";
}

function buildMemoryGraphSnapshot(entries: LongTermMemoryEntry[]): MemoryGraphSnapshot {
  const nodes: MemoryGraphNode[] = entries.map((entry) => ({
    id: entry.id,
    kind: "memory",
    category: entry.category,
    summary: clipText(entry.text, 180),
    confidence: entry.confidence,
    activeStatus: entry.activeStatus,
    updatedAt: entry.updatedAt,
  }));
  const artifactNodes = new Map<string, MemoryGraphNode>();
  const edges = entries.flatMap((entry) => {
    const relationEdges = entry.relations.map((relation) => ({
      from: relation.sourceMemoryId ?? entry.id,
      to: relation.targetMemoryId,
      type: relation.type,
      weight: relation.weight,
      updatedAt: entry.updatedAt,
    }));
    const artifactEdges = (entry.artifactRefs ?? []).flatMap((ref) => {
      const artifactId = `artifact:${ref}`;
      const relationType = selectArtifactRelationType(entry);
      const relationWeight =
        relationType === "derived_from"
          ? 0.9
          : relationType === "confirmed_by"
            ? 0.88
            : relationType === "relevant_to"
              ? 0.86
              : 0.82;
      if (!artifactNodes.has(artifactId)) {
        artifactNodes.set(artifactId, {
          id: artifactId,
          kind: "artifact",
          category: "entity",
          summary: ref,
          artifactRef: ref,
          confidence: entry.confidence,
          activeStatus: "active",
          updatedAt: entry.updatedAt,
        });
      }
      return [
        {
          from: entry.id,
          to: artifactId,
          type: relationType,
          weight: relationWeight,
          updatedAt: entry.updatedAt,
        },
        {
          from: artifactId,
          to: entry.id,
          type: relationType,
          weight: relationWeight,
          updatedAt: entry.updatedAt,
        },
      ];
    });
    return [...relationEdges, ...artifactEdges];
  });
  const uniqueEdges = new Map<string, MemoryGraphEdge>();
  for (const edge of edges) {
    const key = `${edge.from}:${edge.type}:${edge.to}`;
    const current = uniqueEdges.get(key);
    if (!current || current.weight < edge.weight) {
      uniqueEdges.set(key, edge);
    }
  }
  return {
    nodes: [...nodes, ...artifactNodes.values()],
    edges: [...uniqueEdges.values()].toSorted((a, b) => b.weight - a.weight),
    updatedAt: Date.now(),
  };
}

function selectArtifactFacetLabel(entry: LongTermMemoryEntry): {
  label: "constraints" | "patterns" | "outcomes";
  nodeType: PermanentNodeType;
  relationToParent: PermanentNodeRelation;
} {
  if (
    entry.category === "episode" ||
    /\b(fixed|resolved|preserved|restored|regression|outcome|result|workaround)\b/i.test(entry.text)
  ) {
    return {
      label: "outcomes",
      nodeType: "lesson",
      relationToParent: "supports",
    };
  }
  if (entry.category === "pattern" || entry.category === "strategy") {
    return {
      label: "patterns",
      nodeType: "pattern",
      relationToParent: "derived_from",
    };
  }
  return {
    label: "constraints",
    nodeType: "rule",
    relationToParent: "relevant_to",
  };
}

export function mergePermanentMemoryTree(
  root: PermanentMemoryNode | undefined,
  candidates: LongTermMemoryEntry[],
): PermanentMemoryNode {
  const nextRoot: PermanentMemoryNode = root
    ? (JSON.parse(JSON.stringify(root)) as PermanentMemoryNode)
    : createPermanentRoot();
  for (const candidate of candidates) {
    const branch = selectPermanentBranch(candidate);
    let cursor = nextRoot;
    for (let index = 0; index < branch.length; index += 1) {
      const segment = branch[index];
      const nodeType =
        index === branch.length - 1 ? selectPermanentNodeType(candidate.category) : "context";
      cursor = ensureChildNode(cursor, segment, nodeType);
    }
    const leafKey = normalizeComparable(candidate.text);
    const existing = cursor.children.find(
      (child: PermanentMemoryNode) =>
        normalizeComparable(child.summary ?? child.label) === leafKey ||
        normalizeComparable(child.label) === leafKey,
    );
    if (existing) {
      existing.summary = candidate.text;
      existing.updatedAt = Date.now();
      existing.evidence = dedupeTexts(
        [...existing.evidence, ...candidate.evidence],
        MAX_WORKING_ITEMS,
      );
      existing.sourceMemoryIds = uniqueIds([...existing.sourceMemoryIds, candidate.id]);
      existing.confidence = Math.min(1, Math.max(existing.confidence, candidate.confidence));
      existing.activeStatus = candidate.activeStatus;
      if (candidate.activeStatus === "superseded" && candidate.supersededById) {
        existing.relationToParent = "superseded_by";
      }
      continue;
    }
    cursor.children.push({
      id: `${cursor.id}/${cursor.children.length + 1}`,
      label: clipText(candidate.text, 80),
      nodeType: selectPermanentNodeType(candidate.category),
      relationToParent: candidate.activeStatus === "superseded" ? "superseded_by" : "derived_from",
      summary: candidate.text,
      evidence: dedupeTexts(
        [
          ...candidate.evidence,
          candidate.supersededById
            ? `Superseded by durable memory ${candidate.supersededById}.`
            : "",
          candidate.contradictionCount > 0
            ? `Contradicted durable memory count: ${candidate.contradictionCount}.`
            : "",
        ].filter(Boolean),
        MAX_WORKING_ITEMS,
      ),
      sourceMemoryIds: [candidate.id],
      confidence: candidate.confidence,
      activeStatus: candidate.activeStatus,
      updatedAt: Date.now(),
      children: [],
    });

    if ((candidate.artifactRefs ?? []).length > 0) {
      let artifactCursor = nextRoot;
      for (const segment of ["projects", "current-bot", "artifacts"]) {
        artifactCursor = ensureChildNode(
          artifactCursor,
          segment,
          segment === "artifacts" ? "artifact" : "context",
        );
      }
      for (const ref of candidate.artifactRefs) {
        const artifactKey = normalizeComparable(ref);
        let artifactNode = artifactCursor.children.find(
          (child) => normalizeComparable(child.summary ?? child.label) === artifactKey,
        );
        if (artifactNode) {
          artifactNode.updatedAt = Date.now();
          artifactNode.evidence = dedupeTexts(
            [...artifactNode.evidence, candidate.text, ...candidate.evidence],
            MAX_WORKING_ITEMS,
          );
          artifactNode.sourceMemoryIds = uniqueIds([...artifactNode.sourceMemoryIds, candidate.id]);
          artifactNode.confidence = Math.min(
            1,
            Math.max(artifactNode.confidence, candidate.confidence),
          );
        } else {
          artifactNode = {
            id: `${artifactCursor.id}/${artifactCursor.children.length + 1}`,
            label: path.basename(ref),
            nodeType: "artifact",
            relationToParent: "linked_to",
            summary: ref,
            evidence: dedupeTexts([candidate.text, ...candidate.evidence], MAX_WORKING_ITEMS),
            sourceMemoryIds: [candidate.id],
            confidence: candidate.confidence,
            activeStatus: candidate.activeStatus,
            updatedAt: Date.now(),
            children: [],
          };
          artifactCursor.children.push(artifactNode);
        }
        const facet = selectArtifactFacetLabel(candidate);
        const facetNode = ensureChildNode(artifactNode, facet.label, facet.nodeType);
        facetNode.nodeType = facet.nodeType;
        facetNode.relationToParent = facet.relationToParent;
        facetNode.evidence = dedupeTexts(
          [...facetNode.evidence, candidate.text, ...candidate.evidence],
          MAX_WORKING_ITEMS,
        );
        facetNode.sourceMemoryIds = uniqueIds([...facetNode.sourceMemoryIds, candidate.id]);
        facetNode.confidence = Math.min(1, Math.max(facetNode.confidence, candidate.confidence));
        facetNode.activeStatus = candidate.activeStatus;
        if (candidate.activeStatus === "superseded") {
          facetNode.relationToParent = "superseded_by";
        }
        facetNode.updatedAt = Date.now();

        const facetLeafKey = normalizeComparable(candidate.text);
        const existingFacetLeaf = facetNode.children.find(
          (child) => normalizeComparable(child.summary ?? child.label) === facetLeafKey,
        );
        if (existingFacetLeaf) {
          existingFacetLeaf.summary = candidate.text;
          existingFacetLeaf.evidence = dedupeTexts(
            [...existingFacetLeaf.evidence, ...candidate.evidence],
            MAX_WORKING_ITEMS,
          );
          existingFacetLeaf.sourceMemoryIds = uniqueIds([
            ...existingFacetLeaf.sourceMemoryIds,
            candidate.id,
          ]);
          existingFacetLeaf.confidence = Math.min(
            1,
            Math.max(existingFacetLeaf.confidence, candidate.confidence),
          );
          existingFacetLeaf.activeStatus = candidate.activeStatus;
          if (candidate.activeStatus === "superseded") {
            existingFacetLeaf.relationToParent = "superseded_by";
          }
          existingFacetLeaf.updatedAt = Date.now();
          continue;
        }
        facetNode.children.push({
          id: `${facetNode.id}/${facetNode.children.length + 1}`,
          label: clipText(candidate.text, 80),
          nodeType: selectPermanentNodeType(candidate.category),
          relationToParent:
            candidate.activeStatus === "superseded" ? "superseded_by" : facet.relationToParent,
          summary: candidate.text,
          evidence: dedupeTexts(
            [
              ...candidate.evidence,
              candidate.supersededById
                ? `Superseded by durable memory ${candidate.supersededById}.`
                : "",
              candidate.contradictionCount > 0
                ? `Contradicted durable memory count: ${candidate.contradictionCount}.`
                : "",
            ].filter(Boolean),
            MAX_WORKING_ITEMS,
          ),
          sourceMemoryIds: [candidate.id],
          confidence: candidate.confidence,
          activeStatus: candidate.activeStatus,
          updatedAt: Date.now(),
          children: [],
        });
      }
    }
  }
  return nextRoot;
}

export function compileMemoryState(params: {
  sessionId: string;
  previous?: MemoryStoreSnapshot;
  messages: AgentMessage[];
  compactionSummary?: string;
  runtimeContext?: ContextEngineRuntimeContext;
  sessionFile?: string;
}): MemoryCompileResult {
  const previous = params.previous;
  const runtimeScope = buildRuntimeScopeContext({
    runtimeContext: params.runtimeContext,
    sessionFile: params.sessionFile,
  });
  const nextWorkingMemory = buildWorkingMemorySnapshot({
    sessionId: params.sessionId,
    messages: params.messages,
    previous: previous?.workingMemory,
    compactionSummary: params.compactionSummary,
    runtimeContext: params.runtimeContext,
  });
  const candidates = deriveLongTermMemoryCandidates({
    messages: params.messages,
    compactionSummary: params.compactionSummary,
    scopeContext: runtimeScope,
  });
  const runtimeSignalCandidates = deriveRuntimeSignalCandidates({
    runtimeContext: params.runtimeContext,
    scopeContext: runtimeScope,
    previousWorkingMemory: previous?.workingMemory,
  });
  const mergedPending = mergePendingSignificance(
    previous?.pendingSignificance ?? [],
    candidates.pending,
  );
  const promotedPending = promotePendingMemories({
    pending: mergedPending,
    messages: params.messages,
  });
  const patternCandidates = buildPatternMemoryEntries([
    ...(previous?.longTermMemory ?? []),
    ...candidates.durable,
    ...runtimeSignalCandidates,
    ...promotedPending.durable,
  ]);
  const lifecycle = refreshLongTermLifecycle(
    mergeLongTermMemory(previous?.longTermMemory ?? [], [
      ...candidates.durable,
      ...runtimeSignalCandidates,
      ...promotedPending.durable,
      ...patternCandidates,
    ]),
    params.messages,
  );
  const related = annotateRelations(lifecycle.entries);
  const supersession = applySupersession(related);
  const nextLongTerm = supersession.entries;
  const nextPending = promotedPending.remaining;
  const review = reviewMemoryState({
    workingMemory: nextWorkingMemory,
    longTermMemory: nextLongTerm,
    pendingSignificance: nextPending,
    revisions: collectPersistedMemoryRevisions(nextLongTerm),
    adjudications: buildPersistedMemoryAdjudications({
      sessionId: params.sessionId,
      entries: nextLongTerm,
      revisions: collectPersistedMemoryRevisions(nextLongTerm),
    }),
  });
  const reviewedWorkingMemory: WorkingMemorySnapshot = {
    ...nextWorkingMemory,
    carryForwardSummary: review.carryForwardSummary,
  };
  const previousById = new Map((previous?.longTermMemory ?? []).map((entry) => [entry.id, entry]));
  const permanentCandidates = nextLongTerm.filter((entry) => {
    if (entry.permanenceStatus === "eligible") {
      return true;
    }
    if (
      entry.activeStatus === "superseded" &&
      didDurableStateChange(previousById.get(entry.id), entry)
    ) {
      return true;
    }
    if (
      permanentTreeHasMemoryId(previous?.permanentMemory, entry.id) &&
      didDurableStateChange(previousById.get(entry.id), entry)
    ) {
      return true;
    }
    return false;
  });
  const nextPermanent = reconcilePermanentMemoryTree({
    root: mergePermanentMemoryTree(previous?.permanentMemory, permanentCandidates),
    longTermMemory: nextLongTerm,
    adjudications: buildPersistedMemoryAdjudications({
      sessionId: params.sessionId,
      entries: nextLongTerm,
      revisions: collectPersistedMemoryRevisions(nextLongTerm),
    }),
  });
  const nextGraph = buildMemoryGraphSnapshot(nextLongTerm);

  const compilerNotes: string[] = [];
  const compilerStages: MemoryCompilerStageReport[] = [];
  const recordStage = (
    stage: MemoryCompilerStageName,
    note: string,
    candidateCount: number,
    conceptCount?: number,
  ): void => {
    compilerStages.push({ stage, note, candidateCount, conceptCount });
  };
  recordStage(
    "extract",
    "extracted candidate durable and pending memories from conversation content",
    candidates.durable.length + candidates.pending.length,
    new Set(candidates.durable.map((entry) => getEntryConceptId(entry))).size,
  );
  recordStage(
    "runtime",
    "captured runtime-derived observations and workspace signals",
    runtimeSignalCandidates.length,
    new Set(runtimeSignalCandidates.map((entry) => getEntryConceptId(entry))).size,
  );
  recordStage(
    "pending",
    "reviewed pending-significance memories for recurrence-based promotion",
    promotedPending.durable.length + promotedPending.remaining.length,
    new Set(promotedPending.durable.map((entry) => getEntryConceptId(entry))).size,
  );
  recordStage(
    "pattern",
    "synthesized generalized pattern memories from related durable observations",
    patternCandidates.length,
    new Set(patternCandidates.map((entry) => getEntryConceptId(entry))).size,
  );
  recordStage(
    "merge",
    "merged, reactivated, and supersession-reviewed the durable memory set",
    nextLongTerm.length,
    new Set(nextLongTerm.map((entry) => getEntryConceptId(entry))).size,
  );
  recordStage(
    "review",
    "reviewed adjudication, permanence, contradiction, and carry-forward outcomes",
    review.contradictoryMemoryIds.length +
      review.supersededMemoryIds.length +
      review.permanentEligibleIds.length +
      review.permanentDeferredIds.length +
      review.permanentBlockedIds.length,
    new Set([
      ...review.contradictoryConceptIds,
      ...review.supersededConceptIds,
      ...review.permanentEligibleConceptIds,
      ...review.permanentDeferredConceptIds,
      ...review.permanentBlockedConceptIds,
    ]).size,
  );
  recordStage(
    "permanent",
    "reconciled eligible durable memories into the permanent memory tree",
    permanentCandidates.length,
    new Set(permanentCandidates.map((entry) => getEntryConceptId(entry))).size,
  );
  recordStage(
    "graph",
    "rebuilt the memory graph snapshot for retrieval traversal",
    nextGraph.nodes.length + nextGraph.edges.length,
    nextGraph.nodes.filter((node) => node.kind === "memory").length,
  );
  if (candidates.durable.length > 0) {
    compilerNotes.push(`promoted ${candidates.durable.length} durable memories`);
  }
  if (candidates.pending.length > 0) {
    compilerNotes.push(`held ${candidates.pending.length} memories pending significance`);
  }
  if (runtimeSignalCandidates.length > 0) {
    compilerNotes.push(`captured ${runtimeSignalCandidates.length} runtime signal memories`);
  }
  if (promotedPending.durable.length > 0) {
    compilerNotes.push(
      `promoted ${promotedPending.durable.length} pending memories after recurrence`,
    );
  }
  if (patternCandidates.length > 0) {
    compilerNotes.push(`extracted ${patternCandidates.length} generalized pattern memories`);
  }
  if (lifecycle.reactivated.length > 0) {
    compilerNotes.push(`reactivated ${lifecycle.reactivated.length} latent or compressed memories`);
  }
  if (supersession.supersededCount > 0) {
    compilerNotes.push(`marked ${supersession.supersededCount} memories as superseded`);
  }
  if (params.compactionSummary?.trim()) {
    compilerNotes.push("reconsolidated compaction summary");
  }
  if (nextWorkingMemory.activeGoals.length > 0) {
    compilerNotes.push("refreshed active-goal working set");
  }
  if (review.carryForwardSummary) {
    compilerNotes.push("prepared next-session carry-forward summary");
  }
  if (review.contradictoryMemoryIds.length > 0) {
    compilerNotes.push(
      `review flagged ${review.contradictoryMemoryIds.length} contradictory memories`,
    );
  }
  if (review.supersededMemoryIds.length > 0) {
    compilerNotes.push(`review flagged ${review.supersededMemoryIds.length} superseded memories`);
  }
  if (review.permanentEligibleIds.length > 0) {
    compilerNotes.push(
      `review marked ${review.permanentEligibleIds.length} memories eligible for permanent retention`,
    );
  }
  if (review.permanentDeferredIds.length > 0) {
    compilerNotes.push(
      `review deferred ${review.permanentDeferredIds.length} durable memories from permanent retention`,
    );
  }
  if (review.permanentBlockedIds.length > 0) {
    compilerNotes.push(
      `review blocked ${review.permanentBlockedIds.length} memories from permanent retention`,
    );
  }

  return {
    workingMemory: reviewedWorkingMemory,
    longTermMemory: nextLongTerm,
    pendingSignificance: nextPending,
    permanentMemory: nextPermanent,
    graph: nextGraph,
    compilerNotes,
    compilerStages,
    review,
  };
}

function selectWorkingContext(snapshot: MemoryStoreSnapshot): MemoryRetrievalItem[] {
  const items: MemoryRetrievalItem[] = [];
  if (snapshot.workingMemory.rollingSummary) {
    items.push({
      kind: "working",
      text: snapshot.workingMemory.rollingSummary,
      reason: "current task summary",
    });
  }
  for (const goal of snapshot.workingMemory.activeGoals.slice(0, MAX_PACKET_ITEMS)) {
    items.push({ kind: "working", text: goal, reason: "active goal" });
  }
  for (const loop of snapshot.workingMemory.openLoops.slice(0, MAX_PACKET_ITEMS)) {
    items.push({ kind: "working", text: loop, reason: "open unresolved loop" });
  }
  return items;
}

function detectContradictions(entries: LongTermMemoryEntry[]): MemoryRetrievalItem[] {
  const items: MemoryRetrievalItem[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (!isContradictoryPair(a, b)) {
        continue;
      }
      items.push({
        kind: "contradiction",
        text: `${clipText(a.text, 120)} <> ${clipText(b.text, 120)}`,
        reason: "contradictory durable memory requires resolution",
      });
      if (items.length >= MAX_PACKET_ITEMS) {
        return items;
      }
    }
  }
  return items;
}

function describeMemoryStateDowngrade(entry: LongTermMemoryEntry): string[] {
  const notes: string[] = [];
  if ((entry.revisionCount ?? 0) > 0 && entry.lastRevisionKind !== "new") {
    notes.push(`revision ${entry.lastRevisionKind}`);
  }
  if (entry.activeStatus === "superseded") {
    notes.push("superseded");
  } else if (entry.activeStatus === "stale") {
    notes.push("stale");
  } else if (entry.activeStatus === "pending") {
    notes.push("pending");
  }
  if (entry.compressionState === "latent") {
    notes.push("latent");
  } else if (entry.compressionState === "compressed") {
    notes.push("compressed");
  }
  if (entry.contradictionCount > 0) {
    notes.push(`contradicted x${entry.contradictionCount}`);
  }
  return notes;
}

function formatMemoryWithState(entry: LongTermMemoryEntry): string {
  const notes = describeMemoryStateDowngrade(entry);
  return notes.length === 0
    ? `[${entry.category}] ${entry.text}`
    : `[${entry.category}] ${entry.text} (downgraded: ${notes.join(", ")})`;
}

function includeMemoryForContext(entry: LongTermMemoryEntry, taskMode: MemoryTaskMode): boolean {
  if (entry.activeStatus === "archived") {
    return false;
  }
  if (entry.activeStatus === "superseded") {
    return (
      taskMode === "planning" ||
      taskMode === "debugging" ||
      taskMode === "support" ||
      Boolean(entry.supersededById)
    );
  }
  return true;
}

function didDurableStateChange(
  previous: LongTermMemoryEntry | undefined,
  next: LongTermMemoryEntry,
): boolean {
  if (!previous) {
    return true;
  }
  return (
    previous.activeStatus !== next.activeStatus ||
    previous.compressionState !== next.compressionState ||
    previous.contradictionCount !== next.contradictionCount ||
    previous.supersededById !== next.supersededById ||
    previous.permanenceStatus !== next.permanenceStatus ||
    previous.confidence !== next.confidence ||
    previous.strength !== next.strength
  );
}

function rankLongTermEntries(
  entries: LongTermMemoryEntry[],
  queryTokens: Set<string>,
  taskMode: MemoryTaskMode,
  scopeContext?: MemoryScopeContext,
  queryEntityAliases?: Set<string>,
  adjudications?: PersistedMemoryAdjudication[],
): LongTermMemoryEntry[] {
  const taskBonus = (entry: LongTermMemoryEntry): number => {
    if (taskMode === "coding" && (entry.category === "strategy" || entry.category === "decision")) {
      return 3;
    }
    if (taskMode === "planning" && (entry.category === "decision" || entry.category === "entity")) {
      return 2;
    }
    if (taskMode === "support" && (entry.category === "episode" || entry.category === "fact")) {
      return 2;
    }
    return 0;
  };
  const scopeBonus = (entry: LongTermMemoryEntry): number => {
    let bonus = 0;
    if (scopeContext?.versionScope && entry.versionScope === scopeContext.versionScope) {
      bonus += 3;
    }
    if (
      scopeContext?.installProfileScope &&
      entry.installProfileScope === scopeContext.installProfileScope
    ) {
      bonus += 2.5;
    }
    if (scopeContext?.customerScope && entry.customerScope === scopeContext.customerScope) {
      bonus += 2;
    }
    if ((entry.environmentTags ?? []).some((tag) => scopeContext?.environmentTags.includes(tag))) {
      bonus += 1.5;
    }
    if ((entry.artifactRefs ?? []).some((ref) => scopeContext?.artifactRefs.includes(ref))) {
      bonus += 2;
    }
    return bonus;
  };
  const ranked = [...entries]
    .filter((entry) => {
      if (!includeMemoryForContext(entry, taskMode)) {
        return false;
      }
      return shouldIncludeScopedEntry({
        entry,
        taskMode,
        scopeContext,
        adjudications,
      });
    })
    .toSorted((a, b) => {
      const statePenalty = (entry: LongTermMemoryEntry): number => {
        if (entry.activeStatus === "superseded") {
          return 6;
        }
        if (entry.compressionState === "latent") {
          return 2.5;
        }
        if (entry.activeStatus === "pending") {
          return 1.5;
        }
        return 0;
      };
      const contradictionPenalty = (entry: LongTermMemoryEntry): number =>
        entry.contradictionCount * 1.2;
      const entityBonus = (entry: LongTermMemoryEntry): number => {
        if (!queryEntityAliases || queryEntityAliases.size === 0) {
          return 0;
        }
        const entryAliases = uniqueStrings([
          ...(entry.entityAliases ?? []),
          ...buildResolvedEntityAliases(entry),
        ]);
        const overlap = entryAliases.filter((alias) =>
          queryEntityAliases.has(normalizeComparable(alias)),
        ).length;
        return overlap * 1.5;
      };
      const adjudicationBonus = (entry: LongTermMemoryEntry): number => {
        const adjudication = resolveEntryAdjudication(entry, adjudications);
        if (!adjudication) {
          return 0;
        }
        if (adjudication.winningMemoryId === entry.id && adjudication.status === "authoritative") {
          return 2.5;
        }
        if (adjudication.resolutionKind === "scoped_alternative") {
          return countExplicitScopeMatches(entry, scopeContext) > 0 ? 1.75 : -0.75;
        }
        if (adjudication.status === "contested") {
          return -1.5;
        }
        if (adjudication.status === "superseded") {
          return -2;
        }
        return 0;
      };
      const aScore =
        computeOverlapScore(a.text, queryTokens) +
        a.strength * 10 +
        a.confidence * 4 +
        taskBonus(a) -
        statePenalty(a) -
        contradictionPenalty(a) +
        entityBonus(a) +
        scopeBonus(a) +
        adjudicationBonus(a);
      const bScore =
        computeOverlapScore(b.text, queryTokens) +
        b.strength * 10 +
        b.confidence * 4 +
        taskBonus(b) -
        statePenalty(b) -
        contradictionPenalty(b) +
        entityBonus(b) +
        scopeBonus(b) +
        adjudicationBonus(b);
      return bScore - aScore;
    });
  const seenConcepts = new Set<string>();
  const deduped: LongTermMemoryEntry[] = [];
  for (const entry of ranked) {
    const conceptId = getEntryConceptId(entry);
    if (seenConcepts.has(conceptId)) {
      continue;
    }
    seenConcepts.add(conceptId);
    deduped.push(entry);
  }
  return deduped;
}

function classifyArtifactAnchorBucket(
  entry: LongTermMemoryEntry,
): "constraint" | "pattern" | "outcome" | undefined {
  if (
    entry.category === "episode" ||
    /\b(fixed|resolved|preserved|restored|regression|outcome|result|workaround)\b/i.test(entry.text)
  ) {
    return "outcome";
  }
  if (entry.category === "pattern" || entry.category === "strategy") {
    return "pattern";
  }
  if (
    entry.category === "decision" ||
    entry.category === "preference" ||
    /\b(must|required|always|never|constraint|preserve|keep|use)\b/i.test(entry.text)
  ) {
    return "constraint";
  }
  return undefined;
}

function collectArtifactAnchoredMemories(params: {
  selectedArtifactRefs: string[];
  longTermMemory: LongTermMemoryEntry[];
  taskMode: MemoryTaskMode;
  scopeContext?: MemoryScopeContext;
  adjudications?: PersistedMemoryAdjudication[];
  graph?: MemoryGraphSnapshot;
}): {
  constraints: LongTermMemoryEntry[];
  patterns: LongTermMemoryEntry[];
  outcomes: LongTermMemoryEntry[];
} {
  if (params.selectedArtifactRefs.length === 0 || !params.graph) {
    return { constraints: [], patterns: [], outcomes: [] };
  }

  const byId = new Map(params.longTermMemory.map((entry) => [entry.id, entry]));
  const selectedArtifacts = new Set(params.selectedArtifactRefs.map((ref) => `artifact:${ref}`));
  const buckets = {
    constraint: [] as LongTermMemoryEntry[],
    pattern: [] as LongTermMemoryEntry[],
    outcome: [] as LongTermMemoryEntry[],
  };
  const seen = new Set<string>();

  for (const edge of params.graph.edges) {
    if (!selectedArtifacts.has(edge.from)) {
      continue;
    }
    const related = byId.get(edge.to);
    if (
      !related ||
      !includeMemoryForContext(related, params.taskMode) ||
      !shouldIncludeScopedEntry({
        entry: related,
        taskMode: params.taskMode,
        scopeContext: params.scopeContext,
        adjudications: params.adjudications,
      }) ||
      seen.has(related.id)
    ) {
      continue;
    }
    const bucket = classifyArtifactAnchorBucket(related);
    if (!bucket) {
      continue;
    }
    seen.add(related.id);
    buckets[bucket].push(related);
  }

  const sortEntries = (entries: LongTermMemoryEntry[]) =>
    [...entries]
      .toSorted((a, b) => b.confidence - a.confidence || b.strength - a.strength)
      .slice(0, MAX_PACKET_ITEMS);

  return {
    constraints: sortEntries(buckets.constraint),
    patterns: sortEntries(buckets.pattern),
    outcomes: sortEntries(buckets.outcome),
  };
}

type ArtifactAnchorFacet = "constraint" | "pattern" | "outcome";

function artifactTraversalConfig(
  taskMode: MemoryTaskMode,
  facet: ArtifactAnchorFacet,
): {
  allowedTypes: Set<MemoryRelationType>;
  maxHops: number;
  maxItems: number;
} {
  if (facet === "constraint") {
    switch (taskMode) {
      case "planning":
        return {
          allowedTypes: new Set<MemoryRelationType>([
            "relevant_to",
            "superseded_by",
            "derived_from",
          ]),
          maxHops: 2,
          maxItems: 2,
        };
      case "debugging":
        return {
          allowedTypes: new Set<MemoryRelationType>(["contradicts", "relevant_to", "confirmed_by"]),
          maxHops: 2,
          maxItems: 2,
        };
      default:
        return {
          allowedTypes: new Set<MemoryRelationType>([
            "relevant_to",
            "derived_from",
            "confirmed_by",
          ]),
          maxHops: 2,
          maxItems: 2,
        };
    }
  }
  if (facet === "pattern") {
    switch (taskMode) {
      case "support":
        return {
          allowedTypes: new Set<MemoryRelationType>([
            "confirmed_by",
            "derived_from",
            "relevant_to",
          ]),
          maxHops: 2,
          maxItems: 2,
        };
      default:
        return {
          allowedTypes: new Set<MemoryRelationType>([
            "derived_from",
            "confirmed_by",
            "relevant_to",
          ]),
          maxHops: 2,
          maxItems: 2,
        };
    }
  }
  switch (taskMode) {
    case "debugging":
      return {
        allowedTypes: new Set<MemoryRelationType>(["confirmed_by", "superseded_by", "contradicts"]),
        maxHops: 2,
        maxItems: 2,
      };
    case "support":
      return {
        allowedTypes: new Set<MemoryRelationType>(["confirmed_by", "contradicts", "superseded_by"]),
        maxHops: 2,
        maxItems: 2,
      };
    case "planning":
      return {
        allowedTypes: new Set<MemoryRelationType>(["superseded_by", "confirmed_by", "relevant_to"]),
        maxHops: 2,
        maxItems: 2,
      };
    case "coding":
      return {
        allowedTypes: new Set<MemoryRelationType>([
          "confirmed_by",
          "superseded_by",
          "derived_from",
        ]),
        maxHops: 2,
        maxItems: 2,
      };
    default:
      return {
        allowedTypes: new Set<MemoryRelationType>([
          "confirmed_by",
          "superseded_by",
          "derived_from",
        ]),
        maxHops: 2,
        maxItems: 2,
      };
  }
}

function collectArtifactTraversalExpansion(params: {
  anchors: {
    constraints: LongTermMemoryEntry[];
    patterns: LongTermMemoryEntry[];
    outcomes: LongTermMemoryEntry[];
  };
  taskMode: MemoryTaskMode;
  longTermMemory: LongTermMemoryEntry[];
  scopeContext?: MemoryScopeContext;
  adjudications?: PersistedMemoryAdjudication[];
  graph?: MemoryGraphSnapshot;
  excludeIds?: string[];
}): Array<{ entry: LongTermMemoryEntry; via: MemoryRelationType; facet: ArtifactAnchorFacet }> {
  if (!params.graph) {
    return [];
  }

  const byId = new Map(params.longTermMemory.map((entry) => [entry.id, entry]));
  const outgoing = new Map<string, MemoryGraphEdge[]>();
  for (const edge of params.graph.edges) {
    const current = outgoing.get(edge.from) ?? [];
    current.push(edge);
    outgoing.set(edge.from, current);
  }

  const seenMemoryIds = new Set(params.excludeIds ?? []);
  const collected: Array<{
    entry: LongTermMemoryEntry;
    depth: number;
    via: MemoryRelationType;
    weight: number;
    facet: ArtifactAnchorFacet;
  }> = [];
  const facetSeeds: Array<{ facet: ArtifactAnchorFacet; entries: LongTermMemoryEntry[] }> = [
    { facet: "constraint", entries: params.anchors.constraints },
    { facet: "pattern", entries: params.anchors.patterns },
    { facet: "outcome", entries: params.anchors.outcomes },
  ];

  for (const seedGroup of facetSeeds) {
    const config = artifactTraversalConfig(params.taskMode, seedGroup.facet);
    const queue = seedGroup.entries.map((entry) => ({
      nodeId: entry.id,
      depth: 0,
    }));
    const visitedNodes = new Set(queue.map((item) => item.nodeId));
    while (
      queue.length > 0 &&
      collected.filter((item) => item.facet === seedGroup.facet).length < config.maxItems
    ) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      const nextEdges = (outgoing.get(current.nodeId) ?? [])
        .filter((edge) => config.allowedTypes.has(edge.type) && edge.weight >= 0.5)
        .toSorted((a, b) => b.weight - a.weight);

      for (const edge of nextEdges) {
        const entry = byId.get(edge.to);
        if (
          entry &&
          includeMemoryForContext(entry, params.taskMode) &&
          shouldIncludeScopedEntry({
            entry,
            taskMode: params.taskMode,
            scopeContext: params.scopeContext,
            adjudications: params.adjudications,
          }) &&
          !seenMemoryIds.has(entry.id)
        ) {
          seenMemoryIds.add(entry.id);
          collected.push({
            entry,
            depth: current.depth + 1,
            via: edge.type,
            weight: edge.weight,
            facet: seedGroup.facet,
          });
          if (
            collected.filter((item) => item.facet === seedGroup.facet).length >= config.maxItems
          ) {
            break;
          }
        }

        if (current.depth + 1 >= config.maxHops || visitedNodes.has(edge.to)) {
          continue;
        }
        visitedNodes.add(edge.to);
        queue.push({ nodeId: edge.to, depth: current.depth + 1 });
      }
    }
  }

  return collected
    .toSorted(
      (a, b) => a.depth - b.depth || b.weight - a.weight || b.entry.confidence - a.entry.confidence,
    )
    .slice(0, MAX_PACKET_ITEMS)
    .map((item) => ({ entry: item.entry, via: item.via, facet: item.facet }));
}

function expandRelatedMemories(
  selected: LongTermMemoryEntry[],
  allEntries: LongTermMemoryEntry[],
  taskMode: MemoryTaskMode,
  scopeContext?: MemoryScopeContext,
  graph?: MemoryGraphSnapshot,
  adjudications?: PersistedMemoryAdjudication[],
): Array<{ entry: LongTermMemoryEntry; via: string }> {
  const byId = new Map(allEntries.map((entry) => [entry.id, entry]));
  const graphNodeById = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
  const expanded: Array<{ entry: LongTermMemoryEntry; via: string }> = [];
  const seen = new Set<string>(selected.map((entry) => entry.id));
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const allowedRelationTypes = (() => {
    switch (taskMode) {
      case "coding":
        return new Set<MemoryRelationType>([
          "derived_from",
          "relevant_to",
          "confirmed_by",
          "linked_to",
        ]);
      case "support":
        return new Set<MemoryRelationType>([
          "contradicts",
          "confirmed_by",
          "relevant_to",
          "linked_to",
        ]);
      case "planning":
        return new Set<MemoryRelationType>([
          "relevant_to",
          "superseded_by",
          "derived_from",
          "linked_to",
        ]);
      case "debugging":
        return new Set<MemoryRelationType>([
          "contradicts",
          "confirmed_by",
          "derived_from",
          "linked_to",
        ]);
      default:
        return new Set<MemoryRelationType>([
          "derived_from",
          "relevant_to",
          "superseded_by",
          "contradicts",
          "confirmed_by",
          "linked_to",
        ]);
    }
  })();
  const relationPriority = (type: MemoryRelationType): number => {
    switch (type) {
      case "contradicts":
        return taskMode === "debugging" || taskMode === "support" ? 4 : 1;
      case "confirmed_by":
        return taskMode === "support" ? 4 : 2;
      case "derived_from":
        return taskMode === "coding" ? 4 : 2;
      case "superseded_by":
        return taskMode === "planning" ? 3 : 1;
      case "relevant_to":
        return 3;
      default:
        return 1;
    }
  };
  const candidateRelations = selected.flatMap((entry) =>
    entry.relations
      .filter((relation) => allowedRelationTypes.has(relation.type))
      .map((relation) => ({ source: entry.id, relation })),
  );
  candidateRelations.sort(
    (a, b) =>
      relationPriority(b.relation.type) - relationPriority(a.relation.type) ||
      b.relation.weight - a.relation.weight,
  );

  for (const candidate of candidateRelations) {
    const relation = candidate.relation;
    if (relation.weight < 0.5 || seen.has(relation.targetMemoryId)) {
      continue;
    }
    const related = byId.get(relation.targetMemoryId);
    if (
      !related ||
      !includeMemoryForContext(related, taskMode) ||
      !shouldIncludeScopedEntry({
        entry: related,
        taskMode,
        scopeContext,
        adjudications,
      })
    ) {
      continue;
    }
    seen.add(related.id);
    expanded.push({ entry: related, via: relation.type });
    if (expanded.length >= MAX_PACKET_ITEMS) {
      return expanded;
    }
  }

  if (expanded.length >= MAX_PACKET_ITEMS || !graph) {
    return expanded;
  }

  for (const edge of graph.edges) {
    if (
      !selectedIds.has(edge.from) ||
      seen.has(edge.to) ||
      edge.weight < 0.5 ||
      !allowedRelationTypes.has(edge.type)
    ) {
      continue;
    }
    const artifactNode = graphNodeById.get(edge.to);
    if (artifactNode?.kind === "artifact" && artifactNode.artifactRef) {
      if (!scopeContext?.artifactRefs.includes(artifactNode.artifactRef)) {
        continue;
      }
      for (const artifactEdge of graph?.edges ?? []) {
        if (artifactEdge.from !== artifactNode.id || seen.has(artifactEdge.to)) {
          continue;
        }
        const artifactRelated = byId.get(artifactEdge.to);
        if (
          !artifactRelated ||
          !includeMemoryForContext(artifactRelated, taskMode) ||
          !shouldIncludeScopedEntry({
            entry: artifactRelated,
            taskMode,
            scopeContext,
            adjudications,
          })
        ) {
          continue;
        }
        seen.add(artifactRelated.id);
        expanded.push({ entry: artifactRelated, via: artifactEdge.type });
        if (expanded.length >= MAX_PACKET_ITEMS) {
          return expanded;
        }
      }
      continue;
    }
    const related = byId.get(edge.to);
    if (
      !related ||
      !includeMemoryForContext(related, taskMode) ||
      !shouldIncludeScopedEntry({
        entry: related,
        taskMode,
        scopeContext,
        adjudications,
      })
    ) {
      continue;
    }
    seen.add(related.id);
    expanded.push({ entry: related, via: edge.type });
    if (expanded.length >= MAX_PACKET_ITEMS) {
      break;
    }
  }

  if (expanded.length >= MAX_PACKET_ITEMS) {
    return expanded;
  }

  const entityLinked = allEntries
    .filter((entry) => !seen.has(entry.id))
    .map((entry) => {
      const sharedEntityCount = Math.max(
        ...selected.map((candidate) => countSharedEntityIds(candidate, entry)),
      );
      const sharedAliasCount = Math.max(
        ...selected.map((candidate) => countSharedResolvedEntityAliases(candidate, entry)),
      );
      const textSupport = Math.max(
        ...selected.map((candidate) =>
          computeOverlapScore(entry.canonicalText || entry.text, new Set(tokenize(candidate.text))),
        ),
      );
      return {
        entry,
        score: sharedEntityCount * 3 + sharedAliasCount * 1.5 + textSupport,
        sharedEntityCount,
        sharedAliasCount,
      };
    })
    .filter((candidate) => candidate.sharedEntityCount > 0 || candidate.sharedAliasCount > 0)
    .filter(
      (candidate) =>
        includeMemoryForContext(candidate.entry, taskMode) &&
        shouldIncludeScopedEntry({
          entry: candidate.entry,
          taskMode,
          scopeContext,
          adjudications,
        }),
    )
    .toSorted(
      (a, b) =>
        b.score - a.score ||
        b.entry.confidence - a.entry.confidence ||
        b.entry.updatedAt - a.entry.updatedAt,
    );
  for (const candidate of entityLinked) {
    if (seen.has(candidate.entry.id)) {
      continue;
    }
    seen.add(candidate.entry.id);
    expanded.push({
      entry: candidate.entry,
      via:
        candidate.sharedEntityCount > 0
          ? `entity-link:${candidate.sharedEntityCount}`
          : `entity-alias:${candidate.sharedAliasCount}`,
    });
    if (expanded.length >= MAX_PACKET_ITEMS) {
      break;
    }
  }

  return expanded;
}

function recommendProceduralSkillsFromEntries(entries: LongTermMemoryEntry[]): string[] {
  const weights = new Map<string, number>();
  for (const entry of entries) {
    const baseWeight =
      entry.activeStatus === "superseded" || entry.activeStatus === "stale"
        ? 0.35
        : entry.activeStatus === "archived"
          ? 0.15
          : 1;
    const tags = entry.environmentTags ?? [];
    for (const tag of tags) {
      if (!tag.startsWith("skill:")) {
        continue;
      }
      const skill = tag.slice("skill:".length).trim();
      if (!skill) {
        continue;
      }
      const suggestedBoost = tags.includes(`procedural:suggested-skill:${skill}`) ? 0.75 : 0;
      const rankTag = tags.find(
        (candidate) =>
          candidate.startsWith("procedural:ranked-skill:") && candidate.endsWith(`:${skill}`),
      );
      const rankBoost = rankTag
        ? Math.max(
            0,
            0.9 - 0.2 * Math.max(0, Number.parseInt(rankTag.split(":")[2] ?? "9", 10) - 1),
          )
        : 0;
      const score =
        baseWeight + suggestedBoost + rankBoost + entry.strength * 0.35 + entry.confidence * 0.25;
      weights.set(skill, (weights.get(skill) ?? 0) + score);
    }
  }
  return [...weights.entries()]
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([skill]) => skill);
}

export function retrieveMemoryContextPacket(
  snapshot: MemoryStoreSnapshot,
  params?: { messages?: AgentMessage[] },
): MemoryContextPacket {
  const currentText = [
    snapshot.workingMemory.rollingSummary,
    ...snapshot.workingMemory.activeGoals,
    ...snapshot.workingMemory.recentEvents,
    ...(params?.messages ?? []).map((message) => extractMessageText(message)).filter(Boolean),
  ].join(" ");
  const queryTokens = new Set(tokenize(currentText));
  const taskMode = detectTaskMode(params?.messages ?? [], snapshot.workingMemory);
  const scopeContext = buildMemoryScopeContext(currentText);
  const queryEntityAliases = new Set(
    buildResolvedEntityAliases({
      text: currentText,
      versionScope: scopeContext.versionScope,
      installProfileScope: scopeContext.installProfileScope,
      customerScope: scopeContext.customerScope,
      environmentTags: scopeContext.environmentTags,
      artifactRefs: scopeContext.artifactRefs,
    }).map((alias) => normalizeComparable(alias)),
  );
  const adjudications = buildPersistedMemoryAdjudications({
    sessionId: snapshot.workingMemory.sessionId || "runtime",
    entries: snapshot.longTermMemory,
    revisions: collectPersistedMemoryRevisions(snapshot.longTermMemory),
  });
  const retrievalItems: MemoryRetrievalItem[] = [];
  const sections: string[] = [];
  const accessedLongTermIds: string[] = [];
  const accessedConceptIds: string[] = [];

  const workingItems = selectWorkingContext(snapshot);
  if (workingItems.length > 0) {
    retrievalItems.push(...workingItems);
    sections.push(`Current task summary:\n- ${workingItems.map((item) => item.text).join("\n- ")}`);
  }

  const longTerm = rankLongTermEntries(
    snapshot.longTermMemory,
    queryTokens,
    taskMode,
    scopeContext,
    queryEntityAliases,
    adjudications,
  ).slice(0, MAX_PACKET_ITEMS);
  if (longTerm.length > 0) {
    retrievalItems.push(
      ...longTerm.map((item) => {
        const adjudication = adjudications.find(
          (entry) => entry.conceptId === getEntryConceptId(item),
        );
        const itemScopeSummary = formatEntryScopeSummary(item);
        const entitySummary = (item.entityAliases ?? []).slice(0, 2).join(",");
        return {
          kind: "long-term" as const,
          text: formatMemoryWithState(item),
          reason: `concept=${getEntryConceptId(item).slice(0, 10)} relevance=${computeOverlapScore(item.text, queryTokens)} strength=${item.strength.toFixed(2)} confidence=${item.confidence.toFixed(2)} source=${item.sourceType}${itemScopeSummary ? ` scope=${itemScopeSummary}` : ""}${entitySummary ? ` entities=${entitySummary}` : ""}${adjudication ? ` adjudication=${adjudication.status}:${adjudication.resolutionKind}${typeof adjudication.winningScore === "number" ? ` score=${adjudication.winningScore.toFixed(2)}` : ""}${typeof adjudication.scoreGap === "number" ? ` gap=${adjudication.scoreGap.toFixed(2)}` : ""}${adjudication.rationale ? ` rationale=${clipText(adjudication.rationale, 80)}` : ""}` : ""}${describeMemoryStateDowngrade(item).length > 0 ? ` downgraded=${describeMemoryStateDowngrade(item).join(",")}` : ""}`,
          memoryId: item.id,
          conceptId: getEntryConceptId(item),
        };
      }),
    );
    accessedLongTermIds.push(...longTerm.map((item) => item.id));
    accessedConceptIds.push(...longTerm.map((item) => getEntryConceptId(item)));
    sections.push(
      `Relevant long-term facts and patterns:\n- ${longTerm.map((item) => formatMemoryWithState(item)).join("\n- ")}`,
    );
  }

  const proceduralGuidance = longTerm.filter((item) =>
    (item.environmentTags ?? []).includes("runtime:procedural"),
  );
  if (proceduralGuidance.length > 0) {
    const recommendedSkills = recommendProceduralSkillsFromEntries(proceduralGuidance);
    const effectivenessGuidance = deriveSkillEffectivenessGuidance(proceduralGuidance);
    if (recommendedSkills.length > 0) {
      sections.push(`Recommended procedural skills:\n- ${recommendedSkills.join("\n- ")}`);
    }
    if (effectivenessGuidance.length > 0) {
      sections.push(
        `Skill effectiveness guidance:\n- ${effectivenessGuidance
          .map(
            (item) =>
              `skill=${item.skill} family=${item.family} task_mode=${item.taskMode} workspace=${item.workspaceKind} env=${item.env} validation=${item.validation} score=${item.score.toFixed(2)} evidence=${item.evidenceCount}`,
          )
          .join("\n- ")}`,
      );
    }
    sections.push(
      `Procedural guidance:\n- ${proceduralGuidance.map((item) => formatMemoryWithState(item)).join("\n- ")}`,
    );
  }

  const agenticRegressionGuidance = rankLongTermEntries(
    snapshot.longTermMemory.filter((entry) =>
      (entry.environmentTags ?? []).some(
        (tag) => tag === "runtime:agentic-observability" || tag === "runtime:agentic-quality-gate",
      ),
    ),
    queryTokens,
    taskMode,
    scopeContext,
    queryEntityAliases,
    adjudications,
  ).slice(0, 3);
  if (agenticRegressionGuidance.length > 0) {
    retrievalItems.push(
      ...agenticRegressionGuidance.map((item) => ({
        kind: "long-term" as const,
        text: formatMemoryWithState(item),
        reason: `agentic regression guidance source=${item.sourceType}${describeMemoryStateDowngrade(item).length > 0 ? ` downgraded=${describeMemoryStateDowngrade(item).join(",")}` : ""}`,
        memoryId: item.id,
        conceptId: getEntryConceptId(item),
      })),
    );
    accessedLongTermIds.push(...agenticRegressionGuidance.map((item) => item.id));
    accessedConceptIds.push(...agenticRegressionGuidance.map((item) => getEntryConceptId(item)));
    sections.push(
      `Agentic regression guidance:\n- ${agenticRegressionGuidance.map((item) => formatMemoryWithState(item)).join("\n- ")}`,
    );
  }
  const skillFamilyGuidance = rankLongTermEntries(
    snapshot.longTermMemory.filter((entry) =>
      (entry.environmentTags ?? []).some(
        (tag) =>
          tag.startsWith("procedural:skill-family:") ||
          tag.startsWith("procedural:consolidation-action:") ||
          tag === "procedural:no-viable-fallback",
      ),
    ),
    queryTokens,
    taskMode,
    scopeContext,
    queryEntityAliases,
    adjudications,
  )
    .map((entry) => ({ entry, line: deriveSkillFamilyGuidanceLine(entry) }))
    .filter((item): item is { entry: LongTermMemoryEntry; line: string } => Boolean(item.line))
    .slice(0, 3);
  if (skillFamilyGuidance.length > 0) {
    retrievalItems.push(
      ...skillFamilyGuidance.map(({ entry, line }) => ({
        kind: "long-term" as const,
        text: line,
        reason: `skill family guidance source=${entry.sourceType}${describeMemoryStateDowngrade(entry).length > 0 ? ` downgraded=${describeMemoryStateDowngrade(entry).join(",")}` : ""}`,
        memoryId: entry.id,
        conceptId: getEntryConceptId(entry),
      })),
    );
    accessedLongTermIds.push(...skillFamilyGuidance.map(({ entry }) => entry.id));
    accessedConceptIds.push(...skillFamilyGuidance.map(({ entry }) => getEntryConceptId(entry)));
    sections.push(
      `Skill family guidance:\n- ${skillFamilyGuidance.map(({ line }) => line).join("\n- ")}`,
    );
  }

  const artifactEntries = longTerm
    .filter((item) => (item.artifactRefs ?? []).length > 0)
    .flatMap((item) => item.artifactRefs.map((ref) => `${ref} (${item.id.slice(0, 8)})`))
    .slice(0, MAX_PACKET_ITEMS);
  if (artifactEntries.length > 0) {
    sections.push(`Relevant files and artifacts:\n- ${artifactEntries.join("\n- ")}`);
  }
  const artifactAnchors = collectArtifactAnchoredMemories({
    selectedArtifactRefs: scopeContext.artifactRefs,
    longTermMemory: snapshot.longTermMemory,
    taskMode,
    scopeContext,
    adjudications,
    graph: snapshot.graph,
  });
  const artifactAnchorLines = [
    ...artifactAnchors.constraints.map((item) => `constraint: ${item.text}`),
    ...artifactAnchors.patterns.map((item) => `pattern: ${item.text}`),
    ...artifactAnchors.outcomes.map((item) => `outcome: ${item.text}`),
  ].slice(0, MAX_PACKET_ITEMS * 2);
  if (artifactAnchorLines.length > 0) {
    const anchoredEntries = [
      ...artifactAnchors.constraints,
      ...artifactAnchors.patterns,
      ...artifactAnchors.outcomes,
    ];
    retrievalItems.push(
      ...anchoredEntries.map((item) => ({
        kind: "long-term" as const,
        text: formatMemoryWithState(item),
        reason: `artifact anchor for ${item.artifactRefs[0] ?? "current scope"}${describeMemoryStateDowngrade(item).length > 0 ? ` downgraded=${describeMemoryStateDowngrade(item).join(",")}` : ""}`,
        memoryId: item.id,
        conceptId: getEntryConceptId(item),
      })),
    );
    accessedLongTermIds.push(...anchoredEntries.map((item) => item.id));
    accessedConceptIds.push(...anchoredEntries.map((item) => getEntryConceptId(item)));
    sections.push(
      `Artifact-anchored constraints, patterns, and outcomes:\n- ${artifactAnchorLines.join("\n- ")}`,
    );
  }
  const artifactTraversal = collectArtifactTraversalExpansion({
    anchors: artifactAnchors,
    taskMode,
    longTermMemory: snapshot.longTermMemory,
    scopeContext,
    adjudications,
    graph: snapshot.graph,
    excludeIds: [...accessedLongTermIds],
  });
  if (artifactTraversal.length > 0) {
    retrievalItems.push(
      ...artifactTraversal.map((item) => ({
        kind: "long-term" as const,
        text: formatMemoryWithState(item.entry),
        reason: `artifact ${item.facet} traversal via ${item.via}${describeMemoryStateDowngrade(item.entry).length > 0 ? ` downgraded=${describeMemoryStateDowngrade(item.entry).join(",")}` : ""}`,
        memoryId: item.entry.id,
        conceptId: getEntryConceptId(item.entry),
      })),
    );
    accessedLongTermIds.push(...artifactTraversal.map((item) => item.entry.id));
    accessedConceptIds.push(...artifactTraversal.map((item) => getEntryConceptId(item.entry)));
    sections.push(
      `Artifact traversal expansion:\n- ${artifactTraversal.map((item) => formatMemoryWithState(item.entry)).join("\n- ")}`,
    );
  }
  const relatedExpansion = expandRelatedMemories(
    longTerm,
    snapshot.longTermMemory,
    taskMode,
    scopeContext,
    snapshot.graph,
    adjudications,
  );
  if (relatedExpansion.length > 0) {
    retrievalItems.push(
      ...relatedExpansion.map((item) => ({
        kind: "long-term" as const,
        text: formatMemoryWithState(item.entry),
        reason: `concept=${getEntryConceptId(item.entry).slice(0, 10)} related expansion via ${item.via}${describeMemoryStateDowngrade(item.entry).length > 0 ? ` downgraded=${describeMemoryStateDowngrade(item.entry).join(",")}` : ""}`,
        memoryId: item.entry.id,
        conceptId: getEntryConceptId(item.entry),
      })),
    );
    accessedLongTermIds.push(...relatedExpansion.map((item) => item.entry.id));
    accessedConceptIds.push(...relatedExpansion.map((item) => getEntryConceptId(item.entry)));
    sections.push(
      `Related memory expansion:\n- ${relatedExpansion.map((item) => formatMemoryWithState(item.entry)).join("\n- ")}`,
    );
  }

  const pending = [...snapshot.pendingSignificance]
    .toSorted(
      (a, b) => computeOverlapScore(b.text, queryTokens) - computeOverlapScore(a.text, queryTokens),
    )
    .slice(0, MAX_PACKET_ITEMS);
  if (pending.length > 0) {
    retrievalItems.push(
      ...pending.map((item) => ({
        kind: "pending" as const,
        text: item.text,
        reason: `pending significance: ${item.pendingReason}`,
        memoryId: item.id,
        conceptId: getEntryConceptId(item),
      })),
    );
    sections.push(
      `Open uncertainty notes:\n- ${pending.map((item) => `${item.text} (${item.pendingReason})`).join("\n- ")}`,
    );
  }

  const permanentNodes = collectRelevantPermanentNodes({
    permanentMemory: snapshot.permanentMemory,
    longTermMemory: snapshot.longTermMemory,
    queryTokens,
    taskMode,
    scopeContext,
    adjudications,
  });
  const permanent = permanentNodes.map((node) => node.summary as string);
  if (permanent.length > 0) {
    retrievalItems.push(
      ...permanentNodes.map((node) => ({
        kind: "permanent" as const,
        text: node.summary as string,
        reason:
          node.sourceMemoryIds.length > 0
            ? `stable permanent node tree branch (${node.sourceMemoryIds.length} source memories)`
            : "stable permanent node tree branch",
      })),
    );
    sections.push(
      `Relevant entities, constraints, and structural memory:\n- ${permanent.join("\n- ")}`,
    );
  }

  const contradictions = detectContradictions(snapshot.longTermMemory);
  if (contradictions.length > 0) {
    retrievalItems.push(...contradictions);
    sections.push(
      `Contradictions or caution notes:\n- ${contradictions.map((item) => item.text).join("\n- ")}`,
    );
  }

  if (snapshot.workingMemory.lastCompactionSummary) {
    sections.push(
      `Relevant recent context:\n- ${clipText(snapshot.workingMemory.lastCompactionSummary, 220)}`,
    );
  }
  if (snapshot.workingMemory.carryForwardSummary) {
    sections.push(
      `Session continuity output:\n- ${clipText(snapshot.workingMemory.carryForwardSummary, 220)}`,
    );
  }
  const scopeSummary = formatScopeContextSummary(scopeContext);
  if (scopeSummary) {
    sections.push(`Scope notes:\n- ${scopeSummary.replace(/\s+/g, "\n- ")}`);
  }

  const confidenceNotes = longTerm
    .slice(0, MAX_PACKET_ITEMS)
    .map(
      (item) =>
        `${item.id.slice(0, 8)} confidence=${item.confidence.toFixed(2)} source=${item.sourceType} status=${item.activeStatus} provenance=${item.provenance.length}`,
    );
  if (confidenceNotes.length > 0) {
    sections.push(`Confidence notes:\n- ${confidenceNotes.join("\n- ")}`);
  }

  const text =
    sections.length === 0
      ? undefined
      : [
          "Integrated memory packet",
          "Memory hierarchy: short-term context is freshest, long-term memory is distilled, permanent memory is structural. Prefer the current transcript when memories conflict, and treat stale memory as update-needed rather than authoritative.",
          `Detected task mode: ${taskMode}.`,
          ...sections,
          "\nRetrieval audit:",
          ...retrievalItems.map(
            (item) => `- [${item.kind}] ${item.reason}: ${clipText(item.text, 140)}`,
          ),
        ].join("\n\n");

  return {
    text,
    taskMode,
    sections,
    retrievalItems,
    accessedLongTermIds: uniqueIds(accessedLongTermIds),
    accessedConceptIds: uniqueIds(accessedConceptIds),
  };
}

export function buildMemoryContextPacket(
  snapshot: MemoryStoreSnapshot,
  params?: { messages?: AgentMessage[] },
): string | undefined {
  return retrieveMemoryContextPacket(snapshot, params).text;
}

export function inspectMemoryRetrievalObservability(
  snapshot: MemoryStoreSnapshot,
  params?: { messages?: AgentMessage[] },
): MemoryRetrievalObservabilityReport {
  const packet = retrieveMemoryContextPacket(snapshot, params);
  const entriesById = new Map(snapshot.longTermMemory.map((entry) => [entry.id, entry]));
  const downgradedItemCount = packet.retrievalItems.filter((item) =>
    item.reason.includes("downgraded="),
  ).length;
  const contestedItemCount = packet.retrievalItems.filter((item) =>
    item.reason.includes("adjudication=contested"),
  ).length;
  const scopedAlternativeItemCount = packet.retrievalItems.filter((item) =>
    item.reason.includes("adjudication=authoritative:scoped_alternative"),
  ).length;
  const artifactAnchoredItemCount = packet.retrievalItems.filter(
    (item) => item.reason.startsWith("artifact anchor") || item.reason.startsWith("artifact "),
  ).length;
  const entityMatchedItemCount = packet.retrievalItems.filter((item) =>
    item.reason.includes("entities="),
  ).length;
  const authoritativeWinnerItemCount = packet.retrievalItems.filter((item) =>
    item.reason.includes("adjudication=authoritative:winner"),
  ).length;
  const summaryDerivedItemCount = packet.retrievalItems.filter(
    (item) => item.memoryId && entriesById.get(item.memoryId)?.sourceType === "summary_derived",
  ).length;
  const longTermItemCount = packet.retrievalItems.filter(
    (item) => item.kind === "long-term",
  ).length;
  const permanentItemCount = packet.retrievalItems.filter(
    (item) => item.kind === "permanent",
  ).length;
  const contradictionItemCount = packet.retrievalItems.filter(
    (item) => item.kind === "contradiction",
  ).length;
  const topReasons = packet.retrievalItems.slice(0, 6).map((item) => clipText(item.reason, 120));
  const summary = clipText(
    [
      `task=${packet.taskMode}`,
      `items=${packet.retrievalItems.length}`,
      `long-term=${longTermItemCount}`,
      `permanent=${permanentItemCount}`,
      `contradictions=${contradictionItemCount}`,
      `downgraded=${downgradedItemCount}`,
      `contested=${contestedItemCount}`,
      `scoped-alternatives=${scopedAlternativeItemCount}`,
      `artifact-anchors=${artifactAnchoredItemCount}`,
      `entity-matched=${entityMatchedItemCount}`,
      `authoritative-winners=${authoritativeWinnerItemCount}`,
      `summary-derived=${summaryDerivedItemCount}`,
      `concepts=${packet.accessedConceptIds.length}`,
    ].join(" | "),
    320,
  );
  return {
    taskMode: packet.taskMode,
    retrievalItemCount: packet.retrievalItems.length,
    longTermItemCount,
    permanentItemCount,
    contradictionItemCount,
    downgradedItemCount,
    contestedItemCount,
    scopedAlternativeItemCount,
    artifactAnchoredItemCount,
    entityMatchedItemCount,
    authoritativeWinnerItemCount,
    summaryDerivedItemCount,
    accessedConceptCount: packet.accessedConceptIds.length,
    topReasons,
    summary,
  };
}

export async function runMemoryAcceptanceSuite(params: {
  workspaceDir: string;
  sessionIdPrefix?: string;
  backendKinds?: MemoryStoreBackendKind[];
}): Promise<MemoryAcceptanceReport> {
  const sessionIdPrefix = params.sessionIdPrefix ?? "acceptance";
  const backendKinds = params.backendKinds ?? ["fs-json", "sqlite-graph"];
  const scenarios: MemoryAcceptanceScenarioResult[] = [];
  for (const dirname of [
    `${MEMORY_SYSTEM_DIRNAME}-acceptance-${sessionIdPrefix}-fs-json`,
    `${MEMORY_SYSTEM_DIRNAME}-acceptance-${sessionIdPrefix}-sqlite-graph`,
    `${MEMORY_SYSTEM_DIRNAME}-recovery-${sessionIdPrefix}`,
    `${MEMORY_SYSTEM_DIRNAME}-handoff-${sessionIdPrefix}`,
    `${MEMORY_SYSTEM_DIRNAME}-handoff-target-${sessionIdPrefix}`,
  ]) {
    await removeDirectoryRobustly(path.join(params.workspaceDir, dirname));
  }
  const findPermanentNodeByText = (
    node: PermanentMemoryNode,
    pattern: string,
  ): PermanentMemoryNode | undefined => {
    if (node.summary?.includes(pattern) || node.label.includes(pattern)) {
      return node;
    }
    for (const child of node.children) {
      const match = findPermanentNodeByText(child, pattern);
      if (match) {
        return match;
      }
    }
    return undefined;
  };

  const driftTurns = [
    "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
    "The permanent path for the memory system in src/context-engine/memory-system.ts should be used.",
    "We need to use the permanent memory-system path in src/context-engine/memory-system.ts.",
    "The required path for memory-system integration in src/context-engine/memory-system.ts is the permanent one.",
    "Use that permanent memory-system path in src/context-engine/memory-system.ts for this rollout.",
    "The permanent path in src/context-engine/memory-system.ts is the path we should continue with.",
  ];
  let driftCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:drift`,
    messages: [userMessageForSuite(driftTurns[0])],
  });
  for (const turn of driftTurns.slice(1)) {
    driftCompiled = compileMemoryState({
      sessionId: `${sessionIdPrefix}:drift`,
      previous: driftCompiled,
      messages: [userMessageForSuite(turn)],
    });
  }
  const driftConstraints = driftCompiled.longTermMemory.filter(
    (entry) =>
      entry.ontologyKind === "constraint" &&
      entry.artifactRefs.includes("src/context-engine/memory-system.ts"),
  );
  const driftConceptCount = new Set(driftConstraints.map((entry) => entry.conceptKey)).size;
  scenarios.push({
    scenario: "drift_stability",
    passed: driftConstraints.length > 0 && driftConceptCount === 1,
    summary: `drift constraints=${driftConstraints.length} concepts=${driftConceptCount}`,
    details: driftConstraints.map(
      (entry) => `${entry.id}:${entry.conceptKey}:${entry.conceptAliases.length}`,
    ),
  });

  const scopeTurns = [
    "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a.",
    "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-b.",
    "For install profile profile-a, continue using the permanent memory-system path in src/context-engine/memory-system.ts.",
    "For install profile profile-b, the permanent memory-system path in src/context-engine/memory-system.ts should be used.",
  ];
  let scopeCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:scope`,
    messages: [userMessageForSuite(scopeTurns[0])],
  });
  for (const turn of scopeTurns.slice(1)) {
    scopeCompiled = compileMemoryState({
      sessionId: `${sessionIdPrefix}:scope`,
      previous: scopeCompiled,
      messages: [userMessageForSuite(turn)],
    });
  }
  const scopePacket = retrieveMemoryContextPacket(scopeCompiled, {
    messages: [
      userMessageForSuite(
        "For install profile profile-b, use the permanent memory-system path in src/context-engine/memory-system.ts.",
      ),
    ],
  });
  const leakedScopeItems = scopePacket.retrievalItems.filter(
    (item) => item.reason.includes("profile=profile-a") && item.text.includes("profile-a"),
  );
  scenarios.push({
    scenario: "scope_isolation",
    passed: leakedScopeItems.length === 0,
    summary: `scope query returned ${scopePacket.retrievalItems.length} items; leaked=${leakedScopeItems.length}`,
    details: scopePacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const contestedFirst = compileMemoryState({
    sessionId: `${sessionIdPrefix}:contested`,
    messages: [
      userMessageForSuite(
        "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
      ),
    ],
  });
  const contestedSecond = compileMemoryState({
    sessionId: `${sessionIdPrefix}:contested`,
    previous: contestedFirst,
    messages: [
      userMessageForSuite(
        "Do not use the permanent memory-system path in src/context-engine/memory-system.ts.",
      ),
    ],
  });
  const contestedPacket = retrieveMemoryContextPacket(contestedSecond, {
    messages: [
      userMessageForSuite(
        "What should we do with the permanent memory-system path in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  const contestedVisible = contestedPacket.retrievalItems.some(
    (item) => item.reason.includes("adjudication=contested") || item.kind === "contradiction",
  );
  scenarios.push({
    scenario: "contested_visibility",
    passed: contestedVisible,
    summary: `contested retrieval visible=${contestedVisible}`,
    details: contestedPacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const entityFirst = compileMemoryState({
    sessionId: `${sessionIdPrefix}:entity`,
    messages: [
      userMessageForSuite(
        "Use the permanent memory-system path in src/context-engine/memory-system.ts on branch feature/memory-v2.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const entitySecond = compileMemoryState({
    sessionId: `${sessionIdPrefix}:entity`,
    previous: entityFirst,
    messages: [
      userMessageForSuite("Use the permanent path in memory-system.ts on feature/memory-v2."),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const entityPacket = retrieveMemoryContextPacket(entitySecond, {
    messages: [userMessageForSuite("On feature/memory-v2, what should we do in memory-system.ts?")],
  });
  const entityConstraintCount = new Set(
    entitySecond.longTermMemory
      .filter(
        (entry) =>
          entry.artifactRefs.includes("src/context-engine/memory-system.ts") &&
          entry.ontologyKind === "constraint",
      )
      .map((entry) => entry.conceptKey),
  ).size;
  const entityVisible = entityPacket.retrievalItems.some(
    (item) =>
      item.reason.includes("entities=") &&
      item.reason.includes("memory-system.ts") &&
      item.text.includes("permanent"),
  );
  scenarios.push({
    scenario: "entity_resolution",
    passed: entityConstraintCount === 1 && entityVisible,
    summary: `entity concepts=${entityConstraintCount} entity-visible=${entityVisible}`,
    details: entityPacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const evidenceCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:evidence`,
    previous: {
      workingMemory: buildWorkingMemorySnapshot({
        sessionId: `${sessionIdPrefix}:evidence`,
        messages: [],
      }),
      longTermMemory: [
        {
          id: "ltm-evidence-summary",
          semanticKey: "evidence::summary::memory-system",
          conceptKey: "concept::evidence::memory-system",
          category: "decision",
          ontologyKind: "constraint",
          text: "Use the old workaround in src/context-engine/memory-system.ts on feature/memory-v2.",
          canonicalText:
            "use old workaround src context-engine memory-system ts on feature memory v2",
          conceptAliases: [
            "Use the old workaround in src/context-engine/memory-system.ts on feature/memory-v2.",
          ],
          sourceType: "summary_derived",
          artifactRefs: ["src/context-engine/memory-system.ts"],
          environmentTags: ["git-branch:feature/memory-v2"],
          entityAliases: ["feature/memory-v2", "src/context-engine/memory-system.ts"],
          entityIds: ["entity-branch-evidence", "entity-artifact-evidence"],
          confidence: 0.72,
          strength: 0.74,
          evidence: ["summary evidence"],
          provenance: [],
          importanceClass: "useful",
          compressionState: "stable",
          activeStatus: "active",
          adjudicationStatus: "authoritative",
          revisionCount: 0,
          lastRevisionKind: "new",
          permanenceStatus: "deferred",
          permanenceReasons: [],
          trend: "stable",
          accessCount: 0,
          createdAt: Date.now() - 5_000,
          lastConfirmedAt: Date.now() - 5_000,
          contradictionCount: 0,
          relatedMemoryIds: [],
          relations: [],
          updatedAt: Date.now() - 5_000,
        },
      ],
      pendingSignificance: [],
      permanentMemory: createPermanentRoot(),
      graph: { nodes: [], edges: [], updatedAt: Date.now() },
    },
    messages: [
      userMessageForSuite(
        "I observed directly that we should use the permanent memory-system path in src/context-engine/memory-system.ts on feature/memory-v2.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const evidencePacket = retrieveMemoryContextPacket(evidenceCompiled, {
    messages: [
      userMessageForSuite(
        "On feature/memory-v2, what should we use in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  const evidenceWinner = evidencePacket.retrievalItems.find(
    (item) => item.kind === "long-term" && item.reason.includes("adjudication="),
  );
  scenarios.push({
    scenario: "evidence_priority",
    passed:
      Boolean(evidenceWinner?.text.includes("permanent memory-system path")) &&
      Boolean(evidenceWinner?.reason.includes("adjudication=authoritative:winner")),
    summary: `evidence winner=${evidenceWinner?.text.includes("permanent memory-system path") ? "direct" : "other"}`,
    details: evidencePacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const weakEvidenceFirst = compileMemoryState({
    sessionId: `${sessionIdPrefix}:weak-evidence`,
    messages: [
      userMessageForSuite(
        "Summary says to use the old workaround in src/context-engine/memory-system.ts on feature/memory-v2 for install profile profile-a.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const weakEvidenceSecond = compileMemoryState({
    sessionId: `${sessionIdPrefix}:weak-evidence`,
    previous: weakEvidenceFirst,
    messages: [
      userMessageForSuite(
        "Summary says to keep using the old workaround in src/context-engine/memory-system.ts on feature/memory-v2 for install profile profile-a.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const weakEvidenceThird = compileMemoryState({
    sessionId: `${sessionIdPrefix}:weak-evidence`,
    previous: weakEvidenceSecond,
    messages: [
      userMessageForSuite(
        "I observed directly that we should use the permanent memory-system path in src/context-engine/memory-system.ts on feature/memory-v2 for install profile profile-a.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const weakEvidenceAdjudications = buildPersistedMemoryAdjudications({
    sessionId: `${sessionIdPrefix}:weak-evidence`,
    entries: weakEvidenceThird.longTermMemory,
    revisions: collectPersistedMemoryRevisions(weakEvidenceThird.longTermMemory),
  });
  const weakEvidenceWinnerCount = countWeakEvidenceWinners(
    weakEvidenceThird.longTermMemory,
    weakEvidenceAdjudications,
  );
  const weakEvidenceContested = weakEvidenceAdjudications.some(
    (item) =>
      item.status === "contested" &&
      item.rationale.includes("weak-evidence winner") &&
      item.entityIds.length > 0,
  );
  const weakEvidencePacket = retrieveMemoryContextPacket(weakEvidenceThird, {
    messages: [
      userMessageForSuite(
        "For install profile profile-a on feature/memory-v2, what should we use in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  scenarios.push({
    scenario: "weak_evidence_governance",
    passed:
      weakEvidenceWinnerCount === 0 &&
      weakEvidencePacket.retrievalItems.some(
        (item) =>
          item.kind === "long-term" &&
          item.text.includes("permanent memory-system path") &&
          item.reason.includes("source=direct_observation") &&
          item.reason.includes("adjudication=authoritative:winner"),
      ),
    summary: `weak-evidence contested=${weakEvidenceContested} weak-winners=${weakEvidenceWinnerCount} packet-items=${weakEvidencePacket.retrievalItems.length}`,
    details: weakEvidencePacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const rivalryFirst = compileMemoryState({
    sessionId: `${sessionIdPrefix}:rivalry`,
    messages: [
      userMessageForSuite(
        "Use the old workaround in src/context-engine/memory-system.ts on feature/memory-v2 for install profile profile-a.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const rivalrySecond = compileMemoryState({
    sessionId: `${sessionIdPrefix}:rivalry`,
    previous: rivalryFirst,
    messages: [
      userMessageForSuite(
        "Do not use the old workaround in src/context-engine/memory-system.ts on feature/memory-v2 for install profile profile-a.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const rivalryThird = compileMemoryState({
    sessionId: `${sessionIdPrefix}:rivalry`,
    previous: rivalrySecond,
    messages: [
      userMessageForSuite(
        "Avoid using the old workaround in src/context-engine/memory-system.ts on feature/memory-v2 for install profile profile-a.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
      },
    },
  });
  const rivalryAdjudications = buildPersistedMemoryAdjudications({
    sessionId: `${sessionIdPrefix}:rivalry`,
    entries: rivalryThird.longTermMemory,
    revisions: collectPersistedMemoryRevisions(rivalryThird.longTermMemory),
  });
  const rivalryFragileWinnerCount = countFragileWinners(
    rivalryThird.longTermMemory,
    rivalryAdjudications,
  );
  const rivalryPacket = retrieveMemoryContextPacket(rivalryThird, {
    messages: [
      userMessageForSuite(
        "For install profile profile-a on feature/memory-v2, should we keep the old workaround in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  scenarios.push({
    scenario: "rivalry_governance",
    passed:
      rivalryFragileWinnerCount === 0 &&
      rivalryAdjudications.some((item) => item.status === "contested") &&
      rivalryPacket.retrievalItems.some(
        (item) => item.reason.includes("adjudication=contested") || item.kind === "contradiction",
      ),
    summary: `rivalry contested=${rivalryAdjudications.some((item) => item.status === "contested")} fragile-winners=${rivalryFragileWinnerCount}`,
    details: rivalryPacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const handoffWorkspaceDir = path.join(
    params.workspaceDir,
    `${MEMORY_SYSTEM_DIRNAME}-handoff-${sessionIdPrefix}`,
  );
  const handoffTargetWorkspaceDir = path.join(
    params.workspaceDir,
    `${MEMORY_SYSTEM_DIRNAME}-handoff-target-${sessionIdPrefix}`,
  );
  await fs.mkdir(handoffWorkspaceDir, { recursive: true });
  await fs.mkdir(handoffTargetWorkspaceDir, { recursive: true });
  const handoffFirst = compileMemoryState({
    sessionId: `${sessionIdPrefix}:handoff-source`,
    messages: [
      userMessageForSuite(
        "Use the permanent memory-system path in src/context-engine/memory-system.ts for the handoff path.",
      ),
    ],
  });
  await persistMemoryStoreSnapshot({
    workspaceDir: handoffWorkspaceDir,
    sessionId: `${sessionIdPrefix}:handoff-source`,
    backendKind: "sqlite-graph",
    workingMemory: handoffFirst.workingMemory,
    longTermMemory: handoffFirst.longTermMemory,
    pendingSignificance: handoffFirst.pendingSignificance,
    permanentMemory: handoffFirst.permanentMemory,
    graph: handoffFirst.graph,
  });
  const handoffBundle = await exportMemoryStoreBundle({
    workspaceDir: handoffWorkspaceDir,
    sessionId: `${sessionIdPrefix}:handoff-source`,
    backendKind: "sqlite-graph",
  });
  await importMemoryStoreBundle({
    workspaceDir: handoffTargetWorkspaceDir,
    bundle: handoffBundle,
    targetSessionId: `${sessionIdPrefix}:handoff-target`,
    backendKind: "sqlite-graph",
  });
  const handoffLoaded = await loadMemoryStoreSnapshot({
    workspaceDir: handoffTargetWorkspaceDir,
    sessionId: `${sessionIdPrefix}:handoff-target`,
    backendKind: "sqlite-graph",
  });
  const handoffNext = compileMemoryState({
    sessionId: `${sessionIdPrefix}:handoff-target`,
    previous: handoffLoaded,
    messages: [
      userMessageForSuite(
        "Continue the handoff and confirm the permanent memory-system path in src/context-engine/memory-system.ts.",
      ),
    ],
  });
  const handoffPacket = retrieveMemoryContextPacket(handoffNext, {
    messages: [
      userMessageForSuite(
        "During handoff, what should we keep using in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  const handoffVisible = handoffPacket.retrievalItems.some((item) =>
    item.text.includes("permanent memory-system path"),
  );
  scenarios.push({
    scenario: "session_handoff_continuity",
    passed:
      handoffNext.longTermMemory.length >= handoffLoaded.longTermMemory.length &&
      handoffVisible &&
      Boolean(handoffNext.review.carryForwardSummary),
    summary: `handoff long-term=${handoffNext.longTermMemory.length} visible=${handoffVisible}`,
    details: handoffPacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const parityCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:parity`,
    messages: [
      userMessageForSuite(
        "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a.",
      ),
      userMessageForSuite(
        "Do not use the old workaround in src/context-engine/memory-system.ts for install profile profile-a.",
      ),
    ],
  });
  const paritySessionId = `${sessionIdPrefix}:parity-store`;
  const paritySnapshots: Array<{ backend: MemoryStoreBackendKind; snapshot: MemoryStoreSnapshot }> =
    [];
  for (const backendKind of backendKinds) {
    const backendWorkspaceDir = path.join(
      params.workspaceDir,
      `${MEMORY_SYSTEM_DIRNAME}-acceptance-${sessionIdPrefix}-${backendKind}`,
    );
    await fs.mkdir(backendWorkspaceDir, { recursive: true });
    await persistMemoryStoreSnapshot({
      workspaceDir: backendWorkspaceDir,
      sessionId: `${paritySessionId}:${backendKind}`,
      backendKind,
      workingMemory: parityCompiled.workingMemory,
      longTermMemory: parityCompiled.longTermMemory,
      pendingSignificance: parityCompiled.pendingSignificance,
      permanentMemory: parityCompiled.permanentMemory,
      graph: parityCompiled.graph,
    });
    const loaded = await loadMemoryStoreSnapshot({
      workspaceDir: backendWorkspaceDir,
      sessionId: `${paritySessionId}:${backendKind}`,
      backendKind,
    });
    paritySnapshots.push({ backend: backendKind, snapshot: loaded });
  }
  const parityReference = paritySnapshots[0];
  const parityPassed = paritySnapshots.every(({ snapshot }) => {
    const refConcepts = new Set(
      parityReference.snapshot.longTermMemory.map((entry) => entry.conceptKey),
    );
    const currentConcepts = new Set(snapshot.longTermMemory.map((entry) => entry.conceptKey));
    return (
      snapshot.longTermMemory.length === parityReference.snapshot.longTermMemory.length &&
      snapshot.pendingSignificance.length === parityReference.snapshot.pendingSignificance.length &&
      snapshot.graph.nodes.length === parityReference.snapshot.graph.nodes.length &&
      snapshot.graph.edges.length === parityReference.snapshot.graph.edges.length &&
      refConcepts.size === currentConcepts.size &&
      [...refConcepts].every((item) => currentConcepts.has(item))
    );
  });
  scenarios.push({
    scenario: "backend_parity",
    passed: parityPassed,
    summary: `backends=${backendKinds.join(",")} parity=${parityPassed}`,
    details: paritySnapshots.map(
      ({ backend, snapshot }) =>
        `${backend}: long-term=${snapshot.longTermMemory.length} pending=${snapshot.pendingSignificance.length} graph=${snapshot.graph.nodes.length}/${snapshot.graph.edges.length}`,
    ),
  });

  const lifecycleFirst = compileMemoryState({
    sessionId: `${sessionIdPrefix}:runtime`,
    messages: [
      userMessageForSuite("Start the memory-system migration on branch feature/memory-v1."),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v1",
        workspaceName: "openclaw",
        sessionRelativePath: "sessions/runtime.jsonl",
      },
    },
  });
  const lifecycleSecond = compileMemoryState({
    sessionId: `${sessionIdPrefix}:runtime`,
    previous: lifecycleFirst,
    messages: [
      userMessageForSuite(
        "Continue the memory-system migration on branch feature/memory-v2 after retry recovery.",
      ),
    ],
    runtimeContext: {
      workspaceState: {
        gitBranch: "feature/memory-v2",
        workspaceName: "openclaw",
        sessionRelativePath: "sessions/runtime.jsonl",
      },
      checkpointSignals: [
        {
          kind: "failure",
          summary: "Prompt assembly failed before retrying the migration step.",
          artifactRefs: ["src/context-engine/memory-system.ts"],
        },
        {
          kind: "handoff",
          summary: "Hand off the recovered migration state to the next turn.",
          artifactRefs: ["src/context-engine/memory-system.ts"],
        },
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          summary: "Recovered from prompt overflow during migration.",
          attempt: 2,
          maxAttempts: 3,
        },
      ],
    },
  });
  const lifecycleTexts = lifecycleSecond.longTermMemory.map((entry) => entry.text);
  const lifecyclePassed =
    lifecycleSecond.workingMemory.lastWorkspaceBranch === "feature/memory-v2" &&
    lifecycleTexts.some((text) =>
      text.includes("Workspace git branch changed from feature/memory-v1 to feature/memory-v2."),
    ) &&
    lifecycleTexts.some((text) => text.includes("Runtime prompt retry recovered")) &&
    lifecycleTexts.some(
      (text) =>
        text.includes("Runtime failure checkpoint recorded") ||
        text.includes("Runtime handoff checkpoint recorded"),
    );
  scenarios.push({
    scenario: "runtime_lifecycle",
    passed: lifecyclePassed,
    summary: `runtime lifecycle branch=${lifecycleSecond.workingMemory.lastWorkspaceBranch} captured=${lifecycleTexts.length}`,
    details: lifecycleTexts.filter((text) =>
      /Workspace git branch changed|Runtime prompt retry recovered|Runtime failure checkpoint recorded|Runtime handoff checkpoint recorded/.test(
        text,
      ),
    ),
  });

  const invalidationFirst = compileMemoryState({
    sessionId: `${sessionIdPrefix}:permanence`,
    messages: [
      userMessageForSuite(
        "Use the old memory-system workaround in src/context-engine/memory-system.ts for migration planning.",
      ),
    ],
  });
  const invalidationSecond = compileMemoryState({
    sessionId: `${sessionIdPrefix}:permanence`,
    previous: invalidationFirst,
    messages: [
      userMessageForSuite(
        "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the old workaround.",
      ),
    ],
  });
  const retiredOldNode = findPermanentNodeByText(
    invalidationSecond.permanentMemory,
    "old memory-system workaround",
  );
  const currentReplacementNode = findPermanentNodeByText(
    invalidationSecond.permanentMemory,
    "permanent memory-system path",
  );
  const invalidationPassed =
    invalidationSecond.review.supersededMemoryIds.length > 0 &&
    Boolean(currentReplacementNode) &&
    (retiredOldNode?.activeStatus === "superseded" || retiredOldNode?.activeStatus === "archived");
  scenarios.push({
    scenario: "permanence_invalidation",
    passed: invalidationPassed,
    summary: `superseded=${invalidationSecond.review.supersededMemoryIds.length} old-status=${retiredOldNode?.activeStatus ?? "missing"}`,
    details: [
      ...invalidationSecond.review.supersededMemoryIds,
      retiredOldNode
        ? `retired-node:${retiredOldNode.label}:${retiredOldNode.activeStatus}`
        : "retired-node:missing",
      currentReplacementNode
        ? `replacement-node:${currentReplacementNode.label}:${currentReplacementNode.activeStatus}`
        : "replacement-node:missing",
    ],
  });

  const recoveryWorkspaceDir = path.join(
    params.workspaceDir,
    `${MEMORY_SYSTEM_DIRNAME}-recovery-${sessionIdPrefix}`,
  );
  await fs.mkdir(recoveryWorkspaceDir, { recursive: true });
  const recoveryCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:recovery`,
    messages: [
      userMessageForSuite(
        "Persist the permanent memory-system path in src/context-engine/memory-system.ts for recovery validation.",
      ),
    ],
  });
  await persistMemoryStoreSnapshot({
    workspaceDir: recoveryWorkspaceDir,
    sessionId: `${sessionIdPrefix}:recovery`,
    backendKind: "sqlite-graph",
    workingMemory: recoveryCompiled.workingMemory,
    longTermMemory: recoveryCompiled.longTermMemory,
    pendingSignificance: recoveryCompiled.pendingSignificance,
    permanentMemory: recoveryCompiled.permanentMemory,
    graph: recoveryCompiled.graph,
  });
  const recoveryPaths = resolveStorePaths(recoveryWorkspaceDir, `${sessionIdPrefix}:recovery`);
  await fs.writeFile(path.join(recoveryPaths.rootDir, SQLITE_STORE_FILENAME), "broken");
  const recoveredSnapshot = await loadMemoryStoreSnapshot({
    workspaceDir: recoveryWorkspaceDir,
    sessionId: `${sessionIdPrefix}:recovery`,
    backendKind: "sqlite-graph",
  });
  const recoveryHealth = await inspectMemoryStoreHealth({
    workspaceDir: recoveryWorkspaceDir,
    sessionId: `${sessionIdPrefix}:recovery`,
    backendKind: "sqlite-graph",
  });
  scenarios.push({
    scenario: "store_recovery",
    passed:
      recoveredSnapshot.longTermMemory.length > 0 &&
      recoveryHealth.backupAvailable &&
      recoveryHealth.metadata.lastIntegrityCheckResult === "ok",
    summary: `recovered-long-term=${recoveredSnapshot.longTermMemory.length} integrity=${recoveryHealth.metadata.lastIntegrityCheckResult ?? "missing"}`,
    details: [
      recoveredSnapshot.longTermMemory.map((entry) => entry.id).join(","),
      recoveryHealth.summary,
      ...recoveryHealth.issues,
      ...recoveryHealth.recommendations,
    ].filter(Boolean),
  });

  const soakTurns = [
    {
      text: "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a on branch feature/memory-v1.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v1",
        },
      },
    },
    {
      text: "Continue using the permanent path in memory-system.ts for install profile profile-b on branch feature/memory-v2.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
        retrySignals: [
          {
            phase: "prompt",
            outcome: "recovered",
            summary: "Recovered while continuing the permanent path update.",
            attempt: 2,
            maxAttempts: 3,
          },
        ],
      },
    },
    {
      text: "For install profile profile-a, confirm the permanent memory-system path during handoff.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
        checkpointSignals: [
          {
            kind: "handoff",
            summary: "Hand off the permanent path state for profile-a.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    },
    {
      text: "I observed directly that install profile profile-b still uses the permanent memory-system path in src/context-engine/memory-system.ts.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
      },
    },
    {
      text: "Do not use the old workaround in src/context-engine/memory-system.ts for install profile profile-b.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
        checkpointSignals: [
          {
            kind: "completion",
            summary: "Completed the profile-b permanent path migration.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    },
  ] as const;
  let soakCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:soak`,
    messages: [userMessageForSuite(soakTurns[0].text)],
    runtimeContext: soakTurns[0].runtimeContext as never,
  });
  for (const turn of soakTurns.slice(1)) {
    soakCompiled = compileMemoryState({
      sessionId: `${sessionIdPrefix}:soak`,
      previous: soakCompiled,
      messages: [userMessageForSuite(turn.text)],
      runtimeContext: turn.runtimeContext as never,
    });
  }
  const soakPacket = retrieveMemoryContextPacket(soakCompiled, {
    messages: [
      userMessageForSuite(
        "For install profile profile-b on branch feature/memory-v2, what should we use in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  const soakConstraintConceptCount = new Set(
    soakCompiled.longTermMemory
      .filter(
        (entry) =>
          entry.ontologyKind === "constraint" &&
          entry.artifactRefs.includes("src/context-engine/memory-system.ts"),
      )
      .map((entry) => entry.conceptKey),
  ).size;
  const soakProfileBVisible = soakPacket.retrievalItems.some(
    (item) => item.reason.includes("profile=profile-b") && item.text.includes("profile-b"),
  );
  const soakProfileALeaked = soakPacket.retrievalItems.some(
    (item) => item.reason.includes("profile=profile-a") && item.text.includes("profile-a"),
  );
  scenarios.push({
    scenario: "mixed_lifecycle_soak",
    passed:
      soakConstraintConceptCount <= 2 &&
      soakProfileBVisible &&
      !soakProfileALeaked &&
      soakCompiled.review.contestedRevisionConceptIds.length <= 2,
    summary: `soak constraints=${soakConstraintConceptCount} profile-b-visible=${soakProfileBVisible} profile-a-leaked=${soakProfileALeaked} contested=${soakCompiled.review.contestedRevisionConceptIds.length}`,
    details: soakPacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const longRunTurns = [
    {
      text: "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a on branch feature/memory-v1.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v1",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
      },
    },
    {
      text: "Summary says the old workaround is still in use in src/context-engine/memory-system.ts for install profile profile-a.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v1",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
      },
    },
    {
      text: "I observed directly that the permanent memory-system path in src/context-engine/memory-system.ts is working for install profile profile-a.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v1",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
        checkpointSignals: [
          {
            kind: "completion",
            summary: "Validated the permanent path rollout for profile-a.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    },
    {
      text: "Continue using the permanent path in memory-system.ts for install profile profile-b on branch feature/memory-v2.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
        retrySignals: [
          {
            phase: "prompt",
            outcome: "recovered",
            summary: "Recovered while moving to profile-b rollout.",
            attempt: 2,
            maxAttempts: 3,
          },
        ],
      },
    },
    {
      text: "Do not use the old workaround in src/context-engine/memory-system.ts for install profile profile-b.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
      },
    },
    {
      text: "Hand off the permanent memory-system rollout status for install profile profile-b.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
        checkpointSignals: [
          {
            kind: "handoff",
            summary: "Hand off the profile-b permanent rollout state.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    },
    {
      text: "For install profile profile-a on release/memory-v3, keep using the permanent memory-system path in src/context-engine/memory-system.ts.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
      },
    },
    {
      text: "I observed directly that install profile profile-a on release/memory-v3 still uses the permanent memory-system path in src/context-engine/memory-system.ts.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
      },
    },
    {
      text: "Runtime prompt assembly failed while reviewing the permanent memory-system rollout for install profile profile-a.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
        checkpointSignals: [
          {
            kind: "failure",
            summary: "Prompt assembly failed while reviewing rollout state.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    },
    {
      text: "For install profile profile-b on release/memory-v3, continue using the permanent memory-system path in src/context-engine/memory-system.ts.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
      },
    },
    {
      text: "I observed directly that install profile profile-b on release/memory-v3 no longer needs the old workaround in src/context-engine/memory-system.ts.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/project-lifecycle.jsonl",
        },
        checkpointSignals: [
          {
            kind: "completion",
            summary: "Completed the release/memory-v3 rollout review.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    },
  ] as const;
  let longRunCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:project-long-run`,
    messages: [userMessageForSuite(longRunTurns[0].text)],
    runtimeContext: longRunTurns[0].runtimeContext as never,
  });
  for (const turn of longRunTurns.slice(1)) {
    longRunCompiled = compileMemoryState({
      sessionId: `${sessionIdPrefix}:project-long-run`,
      previous: longRunCompiled,
      messages: [userMessageForSuite(turn.text)],
      runtimeContext: turn.runtimeContext as never,
    });
  }
  const longRunPacket = retrieveMemoryContextPacket(longRunCompiled, {
    messages: [
      userMessageForSuite(
        "For install profile profile-b on release/memory-v3, what should we use in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  const longRunConstraintConceptCount = new Set(
    longRunCompiled.longTermMemory
      .filter(
        (entry) =>
          entry.ontologyKind === "constraint" &&
          entry.artifactRefs.includes("src/context-engine/memory-system.ts"),
      )
      .map((entry) => entry.conceptKey),
  ).size;
  const longRunProfileBVisible = longRunPacket.retrievalItems.some(
    (item) =>
      item.reason.includes("profile=profile-b") &&
      item.reason.includes("release/memory-v3") &&
      item.text.includes("profile-b"),
  );
  const longRunProfileALeak = longRunPacket.retrievalItems.some(
    (item) =>
      item.reason.includes("profile=profile-a") &&
      item.reason.includes("release/memory-v3") &&
      item.text.includes("profile-a"),
  );
  const longRunRuntimeSignalsCaptured = longRunCompiled.longTermMemory.filter((entry) =>
    (entry.environmentTags ?? []).some((tag) =>
      ["runtime:checkpoint", "runtime:retry", "runtime:branch-transition"].includes(tag),
    ),
  ).length;
  const longRunPermanentArtifacts = flattenPermanentNodes(longRunCompiled.permanentMemory).filter(
    (node) => node.summary?.includes("src/context-engine/memory-system.ts"),
  ).length;
  scenarios.push({
    scenario: "project_lifecycle_long_run",
    passed:
      longRunConstraintConceptCount <= 4 &&
      longRunProfileBVisible &&
      !longRunProfileALeak &&
      longRunCompiled.review.contestedRevisionConceptIds.length <= 3 &&
      longRunRuntimeSignalsCaptured >= 4 &&
      longRunPermanentArtifacts > 0,
    summary: `long-run constraints=${longRunConstraintConceptCount} profile-b-visible=${longRunProfileBVisible} profile-a-leaked=${longRunProfileALeak} runtime-signals=${longRunRuntimeSignalsCaptured}`,
    details: longRunPacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const scopeMatrixTurns = [
    "Use the permanent memory-system path in src/context-engine/memory-system.ts for customer acme version v2026.3.13-1 install profile profile-a on linux.",
    "Use the permanent memory-system path in src/context-engine/memory-system.ts for customer acme version v2026.3.13-1 install profile profile-b on linux.",
    "Use the permanent memory-system path in src/context-engine/memory-system.ts for customer acme version v2026.3.13-2 install profile profile-b on linux.",
    "Use the permanent memory-system path in src/context-engine/memory-system.ts for customer acme version v2026.3.13-2 install profile profile-b on windows.",
    "Use the permanent memory-system path in src/context-engine/memory-system.ts for customer beta version v2026.3.13-2 install profile profile-b on windows.",
    "I observed directly that the permanent memory-system path in src/context-engine/memory-system.ts works for customer beta version v2026.3.13-2 install profile profile-b on windows.",
  ];
  let scopeMatrixCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:scope-matrix`,
    messages: [userMessageForSuite(scopeMatrixTurns[0])],
  });
  for (const turn of scopeMatrixTurns.slice(1)) {
    scopeMatrixCompiled = compileMemoryState({
      sessionId: `${sessionIdPrefix}:scope-matrix`,
      previous: scopeMatrixCompiled,
      messages: [userMessageForSuite(turn)],
    });
  }
  const scopeMatrixPacket = retrieveMemoryContextPacket(scopeMatrixCompiled, {
    messages: [
      userMessageForSuite(
        "For customer beta version v2026.3.13-2 install profile profile-b on windows, what should we use in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  const scopeMatrixConstraintConceptCount = new Set(
    scopeMatrixCompiled.longTermMemory
      .filter(
        (entry) =>
          entry.ontologyKind === "constraint" &&
          entry.artifactRefs.includes("src/context-engine/memory-system.ts"),
      )
      .map((entry) => entry.conceptKey),
  ).size;
  const scopeMatrixTargetVisible = scopeMatrixPacket.retrievalItems.some(
    (item) =>
      item.reason.includes("customer=beta") &&
      item.reason.includes("version=v2026.3.13-2") &&
      item.reason.includes("profile=profile-b") &&
      item.reason.includes("env=windows") &&
      item.text.includes("customer beta"),
  );
  const scopeMatrixLeak = scopeMatrixPacket.retrievalItems.some(
    (item) =>
      ((item.reason.includes("customer=acme") && item.text.includes("customer acme")) ||
        (item.reason.includes("profile=profile-a") && item.text.includes("profile-a")) ||
        (item.reason.includes("version=v2026.3.13-1") && item.text.includes("v2026.3.13-1")) ||
        (item.reason.includes("env=linux") && item.text.includes("linux"))) &&
      !item.reason.includes("customer=beta"),
  );
  scenarios.push({
    scenario: "scope_matrix_resilience",
    passed:
      scopeMatrixConstraintConceptCount <= 5 &&
      scopeMatrixTargetVisible &&
      !scopeMatrixLeak &&
      scopeMatrixCompiled.review.contestedRevisionConceptIds.length <= 2,
    summary: `scope-matrix concepts=${scopeMatrixConstraintConceptCount} target-visible=${scopeMatrixTargetVisible} leaked=${scopeMatrixLeak}`,
    details: scopeMatrixPacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const multiTenantTurns = [
    {
      text: "Use the permanent memory-system path in src/context-engine/memory-system.ts for customer acme version v2026.3.13-2 install profile profile-b on release/memory-v3.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/multi-tenant-release.jsonl",
        },
      },
    },
    {
      text: "Hand off the permanent rollout state in src/context-engine/memory-system.ts for customer acme version v2026.3.13-2 install profile profile-b on release/memory-v3.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/multi-tenant-release.jsonl",
        },
        checkpointSignals: [
          {
            kind: "handoff",
            summary: "Hand off the acme release/memory-v3 rollout state.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    },
    {
      text: "Use the permanent memory-system path in src/context-engine/memory-system.ts for customer beta version v2026.3.13-2 install profile profile-b on release/memory-v3.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/multi-tenant-release.jsonl",
        },
      },
    },
    {
      text: "I observed directly that the permanent memory-system path in src/context-engine/memory-system.ts works for customer beta version v2026.3.13-2 install profile profile-b on release/memory-v3.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/multi-tenant-release.jsonl",
        },
        retrySignals: [
          {
            phase: "prompt",
            outcome: "recovered",
            summary: "Recovered while validating the beta rollout state.",
            attempt: 2,
            maxAttempts: 3,
          },
        ],
      },
    },
    {
      text: "Do not use the old workaround in src/context-engine/memory-system.ts for customer beta version v2026.3.13-2 install profile profile-b on release/memory-v3.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/multi-tenant-release.jsonl",
        },
      },
    },
    {
      text: "Complete the beta rollout state review in src/context-engine/memory-system.ts for customer beta version v2026.3.13-2 install profile profile-b on release/memory-v3.",
      runtimeContext: {
        workspaceState: {
          gitBranch: "release/memory-v3",
          workspaceName: "openclaw",
          sessionRelativePath: "sessions/multi-tenant-release.jsonl",
        },
        checkpointSignals: [
          {
            kind: "completion",
            summary: "Completed the beta release/memory-v3 rollout review.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    },
  ] as const;
  let multiTenantCompiled = compileMemoryState({
    sessionId: `${sessionIdPrefix}:multi-tenant-release`,
    messages: [userMessageForSuite(multiTenantTurns[0].text)],
    runtimeContext: multiTenantTurns[0].runtimeContext as never,
  });
  for (const turn of multiTenantTurns.slice(1)) {
    multiTenantCompiled = compileMemoryState({
      sessionId: `${sessionIdPrefix}:multi-tenant-release`,
      previous: multiTenantCompiled,
      messages: [userMessageForSuite(turn.text)],
      runtimeContext: turn.runtimeContext as never,
    });
  }
  const multiTenantPacket = retrieveMemoryContextPacket(multiTenantCompiled, {
    messages: [
      userMessageForSuite(
        "For customer beta version v2026.3.13-2 install profile profile-b on release/memory-v3, what should we use in src/context-engine/memory-system.ts?",
      ),
    ],
  });
  const multiTenantBetaVisible = multiTenantPacket.retrievalItems.some(
    (item) =>
      item.reason.includes("customer=beta") &&
      item.reason.includes("release/memory-v3") &&
      item.reason.includes("profile=profile-b") &&
      item.text.includes("customer beta"),
  );
  const multiTenantAcmeLeak = multiTenantPacket.retrievalItems.some(
    (item) =>
      item.reason.includes("customer=acme") &&
      item.text.includes("customer acme") &&
      !item.reason.includes("customer=beta"),
  );
  const multiTenantRuntimeSignals = multiTenantCompiled.longTermMemory.filter((entry) =>
    (entry.environmentTags ?? []).some((tag) =>
      ["runtime:checkpoint", "runtime:retry"].includes(tag),
    ),
  ).length;
  scenarios.push({
    scenario: "multi_tenant_release_handoff",
    passed:
      multiTenantBetaVisible &&
      !multiTenantAcmeLeak &&
      multiTenantRuntimeSignals >= 2 &&
      multiTenantCompiled.review.contestedRevisionConceptIds.length <= 2,
    summary: `multi-tenant beta-visible=${multiTenantBetaVisible} acme-leaked=${multiTenantAcmeLeak} runtime-signals=${multiTenantRuntimeSignals}`,
    details: multiTenantPacket.retrievalItems.map(
      (item) => `${item.reason} :: ${clipText(item.text, 100)}`,
    ),
  });

  const passedCount = scenarios.filter((scenario) => scenario.passed).length;
  const failedCount = scenarios.length - passedCount;
  return {
    passed: failedCount === 0,
    scenarioCount: scenarios.length,
    passedCount,
    failedCount,
    scenarios,
    summary: clipText(
      `acceptance scenarios=${scenarios.length} passed=${passedCount} failed=${failedCount}`,
      220,
    ),
  };
}

export function formatMemoryAcceptanceReport(
  report: MemoryAcceptanceReport,
  format: MemoryAcceptanceReportFormat = "json",
): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "summary") {
    const lines = [
      `summary: ${report.summary}`,
      `scenarios: ${report.passedCount}/${report.scenarioCount}`,
    ];
    if (report.failedCount > 0) {
      lines.push(
        `failed: ${report.scenarios
          .filter((scenario) => !scenario.passed)
          .map((scenario) => scenario.scenario)
          .join(", ")}`,
      );
    }
    return `${lines.join("\n")}\n`;
  }
  const lines = [
    "# Memory Acceptance Report",
    "",
    `- Summary: ${report.summary}`,
    `- Passed scenarios: ${report.passedCount}/${report.scenarioCount}`,
    `- Failed scenarios: ${report.failedCount}`,
    "",
    "## Scenarios",
    "",
  ];
  for (const scenario of report.scenarios) {
    lines.push(
      `### ${scenario.scenario}`,
      "",
      `- Passed: ${scenario.passed ? "yes" : "no"}`,
      `- Summary: ${scenario.summary}`,
      `- Details: ${scenario.details.length > 0 ? scenario.details.join("; ") : "none"}`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

function userMessageForSuite(content: string): AgentMessage {
  return {
    role: "user",
    content,
    timestamp: Date.now(),
  } as AgentMessage;
}

function inspectMemoryAgenticTrends(
  snapshot: MemoryStoreSnapshot,
): MemoryAgenticTrendReport | undefined {
  const agenticEntries = snapshot.longTermMemory
    .filter((entry) =>
      (entry.environmentTags ?? []).some((tag) => tag.startsWith("runtime:agentic-")),
    )
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const proceduralEntries = snapshot.longTermMemory
    .filter((entry) => (entry.environmentTags ?? []).includes("runtime:procedural"))
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (agenticEntries.length === 0 && proceduralEntries.length === 0) {
    return undefined;
  }
  const observabilitySignals = agenticEntries.filter((entry) =>
    (entry.environmentTags ?? []).includes("runtime:agentic-observability"),
  ).length;
  const soakSignals = agenticEntries.filter((entry) =>
    (entry.environmentTags ?? []).includes("runtime:agentic-soak"),
  ).length;
  const qualityGateSignals = agenticEntries.filter((entry) =>
    (entry.environmentTags ?? []).includes("runtime:agentic-quality-gate"),
  ).length;
  const missingFallbackSignals = agenticEntries.filter((entry) =>
    (entry.environmentTags ?? []).includes("agentic:missing-fallback"),
  ).length;
  const escalationSignals = agenticEntries.filter((entry) =>
    (entry.environmentTags ?? []).includes("agentic:escalation-required"),
  ).length;
  const failingSoakSignals = agenticEntries.filter((entry) =>
    (entry.environmentTags ?? []).includes("agentic:soak:fail"),
  ).length;
  const failingQualityGateSignals = agenticEntries.filter((entry) =>
    (entry.environmentTags ?? []).includes("agentic:quality:fail"),
  ).length;
  const qualityFailureReasons = uniqueStrings(
    agenticEntries.flatMap((entry) =>
      (entry.environmentTags ?? [])
        .filter((tag) => tag.startsWith("agentic:quality-failure:"))
        .map((tag) => tag.replace("agentic:quality-failure:", "")),
    ),
  );
  const effectivenessGuidance = deriveSkillEffectivenessGuidance(proceduralEntries);
  const effectiveSkills = effectivenessGuidance
    .filter((item) => item.score >= 1.5)
    .slice(0, 3)
    .map((item) => `${item.skill}@${item.taskMode}/${item.env}`);
  const effectiveFamilies = uniqueStrings(
    effectivenessGuidance
      .filter((item) => item.score >= 1)
      .slice(0, 4)
      .map((item) => `${item.family}@${item.taskMode}/${item.env}`),
  ).slice(0, 3);
  const weakeningSkills = effectivenessGuidance
    .filter((item) => item.score <= -0.5)
    .slice(0, 3)
    .map((item) => `${item.skill}@${item.taskMode}/${item.env}`);
  const recoveringSkills = deriveRecoveringScopedSkills(proceduralEntries);
  const latestSummaries = agenticEntries.slice(0, 3).map((entry) => clipText(entry.text, 160));
  const trend =
    failingQualityGateSignals > 0 || failingSoakSignals > 0
      ? "regressing"
      : missingFallbackSignals > 0 || escalationSignals > 0
        ? "watch"
        : "stable";
  return {
    totalSignals: agenticEntries.length,
    observabilitySignals,
    soakSignals,
    qualityGateSignals,
    missingFallbackSignals,
    escalationSignals,
    failingSoakSignals,
    failingQualityGateSignals,
    qualityFailureReasons,
    effectiveSkills,
    effectiveFamilies,
    weakeningSkills,
    recoveringSkills,
    latestSummaries,
    trend,
    summary: clipText(
      [
        `trend=${trend}`,
        `signals=${agenticEntries.length}`,
        `missing_fallback=${missingFallbackSignals}`,
        `escalations=${escalationSignals}`,
        `soak_failures=${failingSoakSignals}`,
        `quality_failures=${failingQualityGateSignals}`,
        effectiveSkills.length > 0 ? `effective=${effectiveSkills.join(",")}` : "",
        weakeningSkills.length > 0 ? `weakening=${weakeningSkills.join(",")}` : "",
        recoveringSkills.length > 0 ? `recovering=${recoveringSkills.join(",")}` : "",
        qualityFailureReasons.length > 0 ? `reasons=${qualityFailureReasons.join(",")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      220,
    ),
  };
}

export async function generateMemoryDiagnosticsReport(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  messages?: AgentMessage[];
  includeAcceptance?: boolean;
  acceptanceBackendKinds?: MemoryStoreBackendKind[];
  runRepair?: boolean;
  runRecover?: boolean;
}): Promise<MemoryDiagnosticsReport> {
  const backendKind = params.backendKind ?? "fs-json";
  const maintenance: MemoryDiagnosticsReport["maintenance"] = {};
  if (params.runRepair) {
    maintenance.repair = (
      await repairMemoryStoreSnapshotWithReport({
        workspaceDir: params.workspaceDir,
        sessionId: params.sessionId,
        backendKind,
      })
    ).report;
  }
  if (params.runRecover) {
    maintenance.recovery = (
      await recoverMemoryStoreFromBackupWithReport({
        workspaceDir: params.workspaceDir,
        sessionId: params.sessionId,
        backendKind,
      })
    ).report;
  }
  const snapshot = await loadMemoryStoreSnapshot({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  });
  const health = await inspectMemoryStoreHealth({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  });
  const agenticTrends = inspectMemoryAgenticTrends(snapshot);
  const retrieval =
    params.messages && params.messages.length > 0
      ? inspectMemoryRetrievalObservability(snapshot, { messages: params.messages })
      : undefined;
  const acceptance = params.includeAcceptance
    ? await runMemoryAcceptanceSuite({
        workspaceDir: params.workspaceDir,
        sessionIdPrefix: `${params.sessionId}:acceptance`,
        backendKinds: params.acceptanceBackendKinds,
      })
    : undefined;
  const failedAcceptanceScenarios = acceptance
    ? acceptance.scenarios
        .filter((scenario) => !scenario.passed)
        .map((scenario) => scenario.scenario)
    : [];
  const recommendations = uniqueStrings([
    ...health.recommendations,
    ...(failedAcceptanceScenarios.length > 0
      ? ["review failed acceptance scenarios before promoting the store"]
      : []),
    ...(agenticTrends?.trend === "regressing"
      ? ["investigate agentic quality regressions before promoting the store"]
      : agenticTrends?.trend === "watch"
        ? ["monitor agentic fallback and escalation drift before promotion"]
        : []),
    ...(agenticTrends?.weakeningSkills.length
      ? ["review weakening scoped skills before extending or promoting the current workflow family"]
      : []),
    ...(agenticTrends?.recoveringSkills.length
      ? [
          "confirm recovering scoped skills stay stable before promoting the recovered workflow family",
        ]
      : []),
  ]);
  const summary = clipText(
    [
      `backend=${backendKind}`,
      `health=${health.summary}`,
      retrieval ? `retrieval=${retrieval.summary}` : "",
      acceptance ? `acceptance=${acceptance.summary}` : "",
      agenticTrends ? `agentic=${agenticTrends.summary}` : "",
      maintenance.repair ? `repair=${maintenance.repair.summary}` : "",
      maintenance.recovery ? `recovery=${maintenance.recovery.summary}` : "",
      recommendations.length > 0 ? `recommendations=${recommendations.length}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    600,
  );
  return {
    generatedAt: Date.now(),
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
    health,
    retrieval,
    acceptance,
    agenticTrends,
    failedAcceptanceScenarios,
    maintenance: maintenance.repair || maintenance.recovery ? maintenance : undefined,
    recommendations,
    summary,
  };
}

export function formatMemoryDiagnosticsReport(
  report: MemoryDiagnosticsReport,
  format: MemoryDiagnosticsReportFormat = "json",
): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "summary") {
    const lines = [`summary: ${report.summary}`, `health: ${report.health.summary}`];
    if (report.retrieval) {
      lines.push(`retrieval: ${report.retrieval.summary}`);
    }
    if (report.acceptance) {
      lines.push(`acceptance: ${report.acceptance.summary}`);
    }
    if (report.agenticTrends) {
      lines.push(`agentic: ${report.agenticTrends.summary}`);
      if (report.agenticTrends.effectiveSkills.length > 0) {
        lines.push(`agentic_effective_skills: ${report.agenticTrends.effectiveSkills.join(", ")}`);
      }
      if (report.agenticTrends.weakeningSkills.length > 0) {
        lines.push(`agentic_weakening_skills: ${report.agenticTrends.weakeningSkills.join(", ")}`);
      }
      if (report.agenticTrends.recoveringSkills.length > 0) {
        lines.push(
          `agentic_recovering_skills: ${report.agenticTrends.recoveringSkills.join(", ")}`,
        );
      }
    }
    if (report.failedAcceptanceScenarios.length > 0) {
      lines.push(`failed_acceptance: ${report.failedAcceptanceScenarios.join(", ")}`);
    }
    if (report.health.issues.length > 0) {
      lines.push(`issues: ${report.health.issues.join(" | ")}`);
    }
    if (report.recommendations.length > 0) {
      lines.push(`recommendations: ${report.recommendations.join(" | ")}`);
    }
    return `${lines.join("\n")}\n`;
  }
  const lines = [
    "# Memory Diagnostics Report",
    "",
    `- Generated: ${new Date(report.generatedAt).toISOString()}`,
    `- Session: \`${report.sessionId}\``,
    `- Backend: \`${report.backendKind}\``,
    "",
    "## Summary",
    "",
    report.summary,
    "",
    "## Health",
    "",
    `- Summary: ${report.health.summary}`,
    `- Issues: ${report.health.issues.length > 0 ? report.health.issues.join("; ") : "none"}`,
    `- Recommendations: ${report.recommendations.length > 0 ? report.recommendations.join("; ") : "none"}`,
    `- Contested concepts: ${report.health.contestedConceptCount}`,
    `- Entity-linked contested concepts: ${report.health.contestedEntityConflictCount}`,
    `- Weak-evidence winners: ${report.health.weakEvidenceWinnerCount}`,
    `- Fragile winners: ${report.health.fragileWinnerCount}`,
    `- Scoped alternatives: ${report.health.scopedAlternativeConceptCount}`,
    `- Entity-linked concepts: ${report.health.entityLinkedConceptCount}`,
    "",
  ];
  if (report.agenticTrends) {
    lines.push(
      "## Agentic Trends",
      "",
      `- Summary: ${report.agenticTrends.summary}`,
      `- Trend: ${report.agenticTrends.trend}`,
      `- Total signals: ${report.agenticTrends.totalSignals}`,
      `- Missing fallback signals: ${report.agenticTrends.missingFallbackSignals}`,
      `- Escalation signals: ${report.agenticTrends.escalationSignals}`,
      `- Failing soak signals: ${report.agenticTrends.failingSoakSignals}`,
      `- Failing quality-gate signals: ${report.agenticTrends.failingQualityGateSignals}`,
      `- Quality failure reasons: ${report.agenticTrends.qualityFailureReasons.length > 0 ? report.agenticTrends.qualityFailureReasons.join(", ") : "none"}`,
      `- Effective skills: ${report.agenticTrends.effectiveSkills.length > 0 ? report.agenticTrends.effectiveSkills.join(", ") : "none"}`,
      `- Effective families: ${report.agenticTrends.effectiveFamilies.length > 0 ? report.agenticTrends.effectiveFamilies.join(", ") : "none"}`,
      `- Weakening skills: ${report.agenticTrends.weakeningSkills.length > 0 ? report.agenticTrends.weakeningSkills.join(", ") : "none"}`,
      `- Recovering skills: ${report.agenticTrends.recoveringSkills.length > 0 ? report.agenticTrends.recoveringSkills.join(", ") : "none"}`,
      `- Latest summaries: ${report.agenticTrends.latestSummaries.length > 0 ? report.agenticTrends.latestSummaries.join("; ") : "none"}`,
      "",
    );
  }
  if (report.retrieval) {
    lines.push(
      "## Retrieval",
      "",
      `- Summary: ${report.retrieval.summary}`,
      `- Item count: ${report.retrieval.retrievalItemCount}`,
      `- Long-term items: ${report.retrieval.longTermItemCount}`,
      `- Permanent items: ${report.retrieval.permanentItemCount}`,
      `- Contested items: ${report.retrieval.contestedItemCount}`,
      `- Top reasons: ${report.retrieval.topReasons.length > 0 ? report.retrieval.topReasons.join("; ") : "none"}`,
      "",
    );
  }
  if (report.acceptance) {
    lines.push(
      "## Acceptance",
      "",
      `- Summary: ${report.acceptance.summary}`,
      `- Passed scenarios: ${report.acceptance.passedCount}/${report.acceptance.scenarioCount}`,
      `- Failed scenarios: ${report.failedAcceptanceScenarios.length > 0 ? report.failedAcceptanceScenarios.join(", ") : "none"}`,
      "",
    );
  }
  if (report.maintenance) {
    lines.push("## Maintenance", "");
    if (report.maintenance.repair) {
      lines.push(`- Repair: ${report.maintenance.repair.summary}`);
    }
    if (report.maintenance.recovery) {
      lines.push(`- Recovery: ${report.maintenance.recovery.summary}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function runMemorySleepReview(params: {
  sessionId: string;
  snapshot: MemoryStoreSnapshot;
}): MemoryCompileResult {
  const archivedLongTerm = params.snapshot.longTermMemory.map((entry) =>
    params.snapshot.longTermMemory.some(
      (candidate) =>
        candidate.id === entry.id &&
        candidate.activeStatus === "superseded" &&
        candidate.compressionState === "latent",
    )
      ? { ...entry, activeStatus: "archived" as const, trend: "fading" as const }
      : entry,
  );
  const review = reviewMemoryState({
    workingMemory: params.snapshot.workingMemory,
    longTermMemory: archivedLongTerm,
    pendingSignificance: params.snapshot.pendingSignificance,
    revisions: collectPersistedMemoryRevisions(archivedLongTerm),
    adjudications: buildPersistedMemoryAdjudications({
      sessionId: params.sessionId,
      entries: archivedLongTerm,
      revisions: collectPersistedMemoryRevisions(archivedLongTerm),
    }),
  });
  const workingMemory: WorkingMemorySnapshot = {
    ...params.snapshot.workingMemory,
    carryForwardSummary: review.carryForwardSummary,
  };
  const graph = buildMemoryGraphSnapshot(archivedLongTerm);
  const compilerStages: MemoryCompilerStageReport[] = [
    {
      stage: "review",
      note: "performed sleep review over archived and active durable memories",
      candidateCount:
        review.archivedMemoryIds.length +
        review.contradictoryMemoryIds.length +
        review.supersededMemoryIds.length,
      conceptCount: new Set([...review.contradictoryConceptIds, ...review.supersededConceptIds])
        .size,
    },
    {
      stage: "graph",
      note: "rebuilt the memory graph snapshot after sleep review",
      candidateCount: graph.nodes.length + graph.edges.length,
      conceptCount: graph.nodes.filter((node) => node.kind === "memory").length,
    },
  ];
  return {
    workingMemory,
    longTermMemory: archivedLongTerm,
    pendingSignificance: params.snapshot.pendingSignificance,
    permanentMemory: params.snapshot.permanentMemory,
    graph,
    compilerNotes: [
      review.carryForwardSummary
        ? "sleep review refreshed carry-forward summary"
        : "sleep review completed",
      review.archivedMemoryIds.length > 0
        ? `sleep review archived ${review.archivedMemoryIds.length} memories`
        : "sleep review found no archival candidates",
      review.contradictoryMemoryIds.length > 0
        ? `sleep review flagged ${review.contradictoryMemoryIds.length} contradictory memories`
        : "sleep review found no contradictory memories",
    ],
    compilerStages,
    review,
  };
}

export function touchRetrievedMemories(
  entries: LongTermMemoryEntry[],
  ids: string[],
): LongTermMemoryEntry[] {
  const touched = new Set(ids);
  if (touched.size === 0) {
    return entries;
  }
  const now = Date.now();
  return entries.map((entry) =>
    touched.has(entry.id)
      ? {
          ...entry,
          accessCount: entry.accessCount + 1,
          lastAccessedAt: now,
          trend: entry.compressionState === "latent" ? "rising" : entry.trend,
        }
      : entry,
  );
}

function sanitizeLongTermEntry(entry: LongTermMemoryEntry): LongTermMemoryEntry {
  const semanticKey =
    entry.semanticKey ||
    buildMemorySemanticKey({
      category: entry.category,
      text: entry.text,
      versionScope: entry.versionScope,
      installProfileScope: entry.installProfileScope,
      customerScope: entry.customerScope,
      artifactRefs: entry.artifactRefs,
    });
  const adjudicationStatus =
    entry.adjudicationStatus ??
    inferAdjudicationStatus({
      activeStatus: entry.activeStatus ?? "active",
      contradictionCount: entry.contradictionCount ?? 0,
    });
  const permanence = evaluatePermanenceStatus({
    ...entry,
    activeStatus: entry.activeStatus ?? "active",
    adjudicationStatus,
    contradictionCount: entry.contradictionCount ?? 0,
  });
  return {
    ...entry,
    id:
      entry.id ||
      buildStableMemoryId(entry.category === "pattern" ? "pattern" : "ltm", semanticKey),
    semanticKey,
    conceptKey:
      entry.conceptKey ||
      buildMemoryConceptKey({
        category: entry.category,
        ontologyKind: entry.ontologyKind,
        text: entry.text,
        versionScope: entry.versionScope,
        installProfileScope: entry.installProfileScope,
        customerScope: entry.customerScope,
        artifactRefs: entry.artifactRefs,
      }),
    canonicalText: entry.canonicalText ?? canonicalizeComparable(entry.text),
    conceptAliases: uniqueStrings([...(entry.conceptAliases ?? []), entry.text]),
    entityAliases: uniqueStrings([
      ...(entry.entityAliases ?? []),
      ...buildResolvedEntityAliases(entry),
    ]),
    entityIds: uniqueIds(entry.entityIds ?? []),
    ontologyKind: entry.ontologyKind ?? inferOntologyKind(entry.category, entry.text),
    evidence: [...(entry.evidence ?? [])],
    provenance: (entry.provenance ?? []).map((item) => ({
      ...item,
      derivedFromMemoryIds: [...(item.derivedFromMemoryIds ?? [])],
    })),
    sourceType: entry.sourceType ?? "system_inferred",
    confidence: entry.confidence ?? 0.7,
    importanceClass: entry.importanceClass ?? "useful",
    compressionState: entry.compressionState ?? "stable",
    activeStatus: entry.activeStatus ?? "active",
    adjudicationStatus,
    revisionCount: entry.revisionCount ?? 0,
    lastRevisionKind: entry.lastRevisionKind ?? "new",
    permanenceStatus: entry.permanenceStatus ?? permanence.status,
    permanenceReasons: entry.permanenceReasons ?? permanence.reasons,
    trend: entry.trend ?? "stable",
    accessCount: entry.accessCount ?? 0,
    createdAt: entry.createdAt ?? entry.updatedAt ?? Date.now(),
    lastConfirmedAt: entry.lastConfirmedAt ?? entry.updatedAt ?? Date.now(),
    contradictionCount: entry.contradictionCount ?? 0,
    relatedMemoryIds: [...(entry.relatedMemoryIds ?? [])],
    relations: (entry.relations ?? []).map((relation) => ({ ...relation })),
    customerScope: entry.customerScope,
    environmentTags: [...(entry.environmentTags ?? [])],
    artifactRefs: [...(entry.artifactRefs ?? [])],
    updatedAt: entry.updatedAt ?? Date.now(),
  };
}

function sanitizeGraphSnapshot(graph: MemoryGraphSnapshot | undefined): MemoryGraphSnapshot {
  return {
    nodes: (graph?.nodes ?? []).map((node) => ({
      ...node,
      kind: node.kind ?? "memory",
      confidence: node.confidence ?? 0.7,
      activeStatus: node.activeStatus ?? "active",
      updatedAt: node.updatedAt ?? Date.now(),
    })),
    edges: (graph?.edges ?? []).map((edge) => ({
      ...edge,
      weight: edge.weight ?? 0.5,
      updatedAt: edge.updatedAt ?? Date.now(),
    })),
    updatedAt: graph?.updatedAt ?? Date.now(),
  };
}

function sanitizePendingEntry(entry: PendingMemoryEntry): PendingMemoryEntry {
  return {
    ...(sanitizeLongTermEntry(entry) as PendingMemoryEntry),
    pendingReason:
      entry.pendingReason ?? "needs recurrence or stronger confirmation before durable promotion",
  };
}

function sanitizePermanentNode(node: PermanentMemoryNode): PermanentMemoryNode {
  return {
    ...node,
    nodeType: node.nodeType ?? "context",
    relationToParent: node.relationToParent,
    evidence: [...(node.evidence ?? [])],
    sourceMemoryIds: [...(node.sourceMemoryIds ?? [])],
    confidence: node.confidence ?? 0.7,
    activeStatus: node.activeStatus ?? "active",
    updatedAt: node.updatedAt ?? Date.now(),
    children: (node.children ?? []).map((child) => sanitizePermanentNode(child)),
  };
}

function flattenPermanentNodeRecords(
  node: PermanentMemoryNode,
  parentId?: string,
): Array<{ id: string; parentId: string | undefined; json: string }> {
  const records: Array<{ id: string; parentId: string | undefined; json: string }> = [
    { id: node.id, parentId, json: JSON.stringify(node) },
  ];
  for (const child of node.children) {
    records.push(...flattenPermanentNodeRecords(child, node.id));
  }
  return records;
}

function collectSqliteGraphRoot(
  entries: Array<{ id: string; parent_id: string | null; json: string }>,
): PermanentMemoryNode {
  const nodes = new Map<string, PermanentMemoryNode>();
  const childrenByParent = new Map<string, PermanentMemoryNode[]>();
  let root: PermanentMemoryNode | undefined;

  for (const entry of entries) {
    const node = sanitizePermanentNode(JSON.parse(entry.json) as PermanentMemoryNode);
    node.children = [];
    nodes.set(entry.id, node);
    if (entry.parent_id) {
      const bucket = childrenByParent.get(entry.parent_id) ?? [];
      bucket.push(node);
      childrenByParent.set(entry.parent_id, bucket);
    } else {
      root = node;
    }
  }
  for (const [parentId, children] of childrenByParent.entries()) {
    const parent = nodes.get(parentId);
    if (parent) {
      parent.children = children;
    }
  }
  return root ?? createPermanentRoot();
}

type SqliteGraphMigration = {
  id: string;
  version: number;
  apply: (db: import("node:sqlite").DatabaseSync) => void;
};

const SQLITE_GRAPH_MIGRATIONS: SqliteGraphMigration[] = [
  {
    id: "001_sqlite_graph_init",
    version: 1,
    apply: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS memory_store_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_store_migrations (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL,
          applied_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS working_memory (
          session_id TEXT PRIMARY KEY,
          json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS long_term_memory (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          concept_id TEXT NOT NULL,
          concept_key TEXT NOT NULL,
          ontology_kind TEXT NOT NULL,
          active_status TEXT NOT NULL,
          permanence_status TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_concepts (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          concept_key TEXT NOT NULL,
          canonical_text TEXT NOT NULL,
          category TEXT NOT NULL,
          ontology_kind TEXT NOT NULL,
          permanence_status TEXT NOT NULL,
          adjudication_status TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_concept_aliases (
          session_id TEXT NOT NULL,
          concept_id TEXT NOT NULL,
          alias TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (session_id, concept_id, alias)
        );
        CREATE TABLE IF NOT EXISTS memory_entities (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          entity_kind TEXT NOT NULL,
          canonical_name TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_revisions (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          concept_id TEXT NOT NULL,
          memory_id TEXT NOT NULL,
          revision_kind TEXT NOT NULL,
          adjudication_status TEXT NOT NULL,
          active_status TEXT NOT NULL,
          permanence_status TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_adjudications (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          concept_id TEXT NOT NULL,
          status TEXT NOT NULL,
          resolution_kind TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pending_memory (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS permanent_nodes (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          parent_id TEXT,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_graph_nodes (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          active_status TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_graph_edges (
          session_id TEXT NOT NULL,
          from_id TEXT NOT NULL,
          to_id TEXT NOT NULL,
          type TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL,
          PRIMARY KEY (session_id, from_id, to_id, type)
        );
      `);
    },
  },
  {
    id: "002_adjudication_resolution_kind",
    version: 2,
    apply: (db) => {
      const adjudicationColumns = db
        .prepare("PRAGMA table_info(memory_adjudications)")
        .all() as Array<{
        name: string;
      }>;
      if (!adjudicationColumns.some((column) => column.name === "resolution_kind")) {
        db.exec(
          "ALTER TABLE memory_adjudications ADD COLUMN resolution_kind TEXT NOT NULL DEFAULT 'winner'",
        );
      }
    },
  },
  {
    id: "003_sqlite_graph_indexes",
    version: 3,
    apply: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_long_term_memory_session_updated
          ON long_term_memory (session_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_memory_concepts_session_updated
          ON memory_concepts (session_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_memory_revisions_session_concept
          ON memory_revisions (session_id, concept_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_memory_adjudications_session_concept
          ON memory_adjudications (session_id, concept_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pending_memory_session_updated
          ON pending_memory (session_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_permanent_nodes_session_parent
          ON permanent_nodes (session_id, parent_id, updated_at ASC);
        CREATE INDEX IF NOT EXISTS idx_memory_graph_nodes_session_updated
          ON memory_graph_nodes (session_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_memory_graph_edges_session_from
          ON memory_graph_edges (session_id, from_id, updated_at DESC);
      `);
    },
  },
  {
    id: "004_memory_entities",
    version: 4,
    apply: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS memory_entities (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          entity_kind TEXT NOT NULL,
          canonical_name TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_memory_entities_session_updated
          ON memory_entities (session_id, updated_at DESC);
      `);
    },
  },
];

function applySqliteGraphMigrations(db: import("node:sqlite").DatabaseSync): {
  schemaVersion: number;
  lastAppliedMigration: string;
} {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_store_migrations (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
  const applied = new Set(
    (
      db.prepare("SELECT id FROM memory_store_migrations ORDER BY applied_at ASC").all() as Array<{
        id: string;
      }>
    ).map((row) => row.id),
  );
  const insertMigration = db.prepare(
    "INSERT OR IGNORE INTO memory_store_migrations (id, schema_version, applied_at) VALUES (?, ?, ?)",
  );
  let lastAppliedMigration = "";
  let schemaVersion = 0;
  for (const migration of SQLITE_GRAPH_MIGRATIONS) {
    if (!applied.has(migration.id)) {
      migration.apply(db);
      insertMigration.run(migration.id, migration.version, Date.now());
      applied.add(migration.id);
    }
    lastAppliedMigration = migration.id;
    schemaVersion = migration.version;
  }
  return {
    schemaVersion,
    lastAppliedMigration,
  };
}

type PersistedMemoryConcept = {
  id: string;
  conceptKey: string;
  canonicalText: string;
  category: MemoryCategory;
  ontologyKind: MemoryOntologyKind;
  permanenceStatus: MemoryPermanenceStatus;
  adjudicationStatus: MemoryAdjudicationStatus;
  memoryIds: string[];
  aliases: string[];
  entityAliases: string[];
  entityIds: string[];
  updatedAt: number;
};

type PersistedMemoryRevision = {
  id: string;
  sessionId: string;
  conceptId: string;
  memoryId: string;
  revisionKind: MemoryRevisionKind;
  adjudicationStatus: MemoryAdjudicationStatus;
  activeStatus: MemoryActiveStatus;
  permanenceStatus: MemoryPermanenceStatus;
  summary: string;
  evidence: string[];
  updatedAt: number;
};

type PersistedMemoryAdjudication = {
  id: string;
  sessionId: string;
  conceptId: string;
  status: MemoryAdjudicationStatus;
  resolutionKind: "winner" | "contested" | "retired" | "scoped_alternative";
  rationale: string;
  winningMemoryId?: string;
  losingMemoryIds: string[];
  alternativeConceptIds: string[];
  entityIds: string[];
  winningScore?: number;
  scoreGap?: number;
  scopeSummary?: string;
  updatedAt: number;
};

function sanitizePersistedMemoryAdjudication(
  adjudication: PersistedMemoryAdjudication,
): PersistedMemoryAdjudication {
  return {
    ...adjudication,
    resolutionKind: adjudication.resolutionKind ?? "winner",
    alternativeConceptIds: uniqueIds(adjudication.alternativeConceptIds ?? []),
    entityIds: uniqueIds(adjudication.entityIds ?? []),
    winningScore:
      typeof adjudication.winningScore === "number" && Number.isFinite(adjudication.winningScore)
        ? adjudication.winningScore
        : undefined,
    scoreGap:
      typeof adjudication.scoreGap === "number" && Number.isFinite(adjudication.scoreGap)
        ? adjudication.scoreGap
        : undefined,
  };
}

function countWeakEvidenceWinners(
  entries: LongTermMemoryEntry[],
  adjudications: PersistedMemoryAdjudication[],
): number {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  return adjudications.filter((item) => {
    if (item.status !== "authoritative" || !item.winningMemoryId) {
      return false;
    }
    const winner = entriesById.get(item.winningMemoryId);
    if (!winner || !isWeakEvidenceSource(winner.sourceType)) {
      return false;
    }
    const strongerAlternatives = [
      ...item.losingMemoryIds
        .map((id) => entriesById.get(id))
        .filter((entry): entry is LongTermMemoryEntry => Boolean(entry)),
      ...item.alternativeConceptIds
        .flatMap((conceptId) => entries.filter((entry) => getEntryConceptId(entry) === conceptId))
        .filter((entry) => entry.id !== winner.id),
    ];
    return strongerAlternatives.some(
      (entry) =>
        sourceTypeReliabilityScore(entry.sourceType) >
        sourceTypeReliabilityScore(winner.sourceType),
    );
  }).length;
}

function countFragileWinners(
  entries: LongTermMemoryEntry[],
  adjudications: PersistedMemoryAdjudication[],
): number {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  return adjudications.filter((item) => {
    if (
      item.status !== "authoritative" ||
      item.resolutionKind !== "winner" ||
      !item.winningMemoryId
    ) {
      return false;
    }
    const winner = entriesById.get(item.winningMemoryId);
    if (!winner) {
      return false;
    }
    const closeDecision = typeof item.scoreGap === "number" && item.scoreGap < 0.12;
    const alternativePressure =
      item.losingMemoryIds.length > 0 ||
      item.alternativeConceptIds.length > 0 ||
      item.entityIds.length > 0;
    const weakSource = isWeakEvidenceSource(winner.sourceType);
    return alternativePressure && (closeDecision || weakSource);
  }).length;
}

function reviseReviewInputsFromHistory(params: {
  entries: LongTermMemoryEntry[];
  revisions: PersistedMemoryRevision[];
  adjudications?: PersistedMemoryAdjudication[];
}): LongTermMemoryEntry[] {
  const revisionsByConcept = new Map<string, PersistedMemoryRevision[]>();
  for (const revision of params.revisions) {
    const bucket = revisionsByConcept.get(revision.conceptId) ?? [];
    bucket.push(revision);
    revisionsByConcept.set(revision.conceptId, bucket);
  }
  return params.entries.map((entry) => {
    const conceptId = getEntryConceptId(entry);
    const history = revisionsByConcept.get(conceptId) ?? [];
    const adjudication = params.adjudications?.find((item) => item.conceptId === conceptId);
    if (history.length === 0) {
      if (!adjudication) {
        return entry;
      }
      return {
        ...entry,
        adjudicationStatus: adjudication.status,
      };
    }
    const revisionKinds = new Set(history.map((revision) => revision.revisionKind));
    const hasContested = history.some((revision) => revision.adjudicationStatus === "contested");
    const hasSuperseded = history.some((revision) => revision.activeStatus === "superseded");
    return {
      ...entry,
      adjudicationStatus:
        adjudication?.status ??
        (hasContested
          ? "contested"
          : hasSuperseded && entry.activeStatus === "superseded"
            ? "superseded"
            : entry.adjudicationStatus),
      contradictionCount:
        hasContested && entry.contradictionCount === 0 ? 1 : entry.contradictionCount,
      revisionCount: Math.max(entry.revisionCount, history.length - 1),
      lastRevisionKind: history[0]?.revisionKind ?? entry.lastRevisionKind,
      permanenceStatus:
        hasContested && entry.permanenceStatus !== "blocked" ? "blocked" : entry.permanenceStatus,
      permanenceReasons:
        hasContested &&
        !entry.permanenceReasons.includes(
          "concept revision history includes contested adjudication",
        )
          ? [...entry.permanenceReasons, "concept revision history includes contested adjudication"]
          : entry.permanenceReasons,
      conceptAliases:
        revisionKinds.has("updated") || revisionKinds.has("narrowed")
          ? uniqueStrings([...entry.conceptAliases, ...history.map((revision) => revision.summary)])
          : entry.conceptAliases,
    };
  });
}

function buildPersistedMemoryConcepts(entries: LongTermMemoryEntry[]): PersistedMemoryConcept[] {
  const byConcept = new Map<string, PersistedMemoryConcept>();
  for (const entry of entries) {
    const conceptId = `concept-${stableHash(entry.conceptKey || entry.semanticKey)}`;
    const existing = byConcept.get(conceptId);
    if (!existing) {
      byConcept.set(conceptId, {
        id: conceptId,
        conceptKey: entry.conceptKey,
        canonicalText: entry.canonicalText,
        category: entry.category,
        ontologyKind: entry.ontologyKind,
        permanenceStatus: entry.permanenceStatus,
        adjudicationStatus: entry.adjudicationStatus,
        memoryIds: [entry.id],
        aliases: uniqueStrings([...(entry.conceptAliases ?? []), entry.text]),
        entityAliases: uniqueStrings([
          ...(entry.entityAliases ?? []),
          ...buildResolvedEntityAliases(entry),
        ]),
        entityIds: uniqueIds(entry.entityIds ?? []),
        updatedAt: entry.updatedAt,
      });
      continue;
    }
    existing.memoryIds = uniqueIds([...existing.memoryIds, entry.id]);
    existing.aliases = uniqueStrings([
      ...existing.aliases,
      ...(entry.conceptAliases ?? []),
      entry.text,
    ]);
    existing.entityAliases = uniqueStrings([
      ...existing.entityAliases,
      ...(entry.entityAliases ?? []),
      ...buildResolvedEntityAliases(entry),
    ]);
    existing.entityIds = uniqueIds([...existing.entityIds, ...(entry.entityIds ?? [])]);
    if (entry.updatedAt >= existing.updatedAt) {
      existing.canonicalText = entry.canonicalText || existing.canonicalText;
      existing.category = entry.category;
      existing.ontologyKind = entry.ontologyKind;
      existing.permanenceStatus = entry.permanenceStatus;
      existing.adjudicationStatus = entry.adjudicationStatus;
      existing.updatedAt = entry.updatedAt;
    }
  }
  return [...byConcept.values()].toSorted((a, b) => b.updatedAt - a.updatedAt);
}

function buildPersistedMemoryEntities(
  sessionId: string,
  concepts: PersistedMemoryConcept[],
): PersistedMemoryEntity[] {
  const byEntity = new Map<string, PersistedMemoryEntity>();
  for (const concept of concepts) {
    for (const alias of concept.entityAliases ?? []) {
      const classified = classifyResolvedEntityAlias(alias);
      const entityId = `entity-${stableHash(
        [sessionId, classified.kind, normalizeComparable(classified.canonicalName)].join("::"),
      )}`;
      const existing = byEntity.get(entityId);
      if (!existing) {
        byEntity.set(entityId, {
          id: entityId,
          sessionId,
          kind: classified.kind,
          canonicalName: classified.canonicalName,
          aliases: uniqueStrings([alias]),
          conceptIds: [concept.id],
          updatedAt: concept.updatedAt,
        });
        continue;
      }
      existing.aliases = uniqueStrings([...existing.aliases, alias]);
      existing.conceptIds = uniqueIds([...existing.conceptIds, concept.id]);
      existing.updatedAt = Math.max(existing.updatedAt, concept.updatedAt);
    }
  }
  return [...byEntity.values()].toSorted((a, b) => b.updatedAt - a.updatedAt);
}

function buildPersistedMemoryRevisions(params: {
  sessionId: string;
  entries: LongTermMemoryEntry[];
}): PersistedMemoryRevision[] {
  return params.entries.map((entry) => {
    const conceptId = getEntryConceptId(entry);
    return {
      id: `rev-${stableHash([params.sessionId, conceptId, entry.id, entry.revisionCount, entry.lastRevisionKind, entry.updatedAt].join("::"))}`,
      sessionId: params.sessionId,
      conceptId,
      memoryId: entry.id,
      revisionKind: entry.lastRevisionKind,
      adjudicationStatus: entry.adjudicationStatus,
      activeStatus: entry.activeStatus,
      permanenceStatus: entry.permanenceStatus,
      summary: clipText(entry.text, 180),
      evidence: dedupeTexts(entry.evidence, MAX_WORKING_ITEMS),
      updatedAt: entry.updatedAt,
    };
  });
}

function collectPersistedMemoryRevisions(
  entries: LongTermMemoryEntry[],
): PersistedMemoryRevision[] {
  return buildPersistedMemoryRevisions({
    sessionId: "review",
    entries,
  });
}

function buildPersistedMemoryAdjudications(params: {
  sessionId: string;
  entries: LongTermMemoryEntry[];
  revisions: PersistedMemoryRevision[];
}): PersistedMemoryAdjudication[] {
  const entriesByConcept = new Map<string, LongTermMemoryEntry[]>();
  const entriesByConceptFamily = new Map<string, LongTermMemoryEntry[]>();
  const entriesByEntityId = new Map<string, LongTermMemoryEntry[]>();
  for (const entry of params.entries) {
    const conceptId = getEntryConceptId(entry);
    const bucket = entriesByConcept.get(conceptId) ?? [];
    bucket.push(entry);
    entriesByConcept.set(conceptId, bucket);
    const familyKey = getEntryConceptFamilyKey(entry);
    const familyBucket = entriesByConceptFamily.get(familyKey) ?? [];
    familyBucket.push(entry);
    entriesByConceptFamily.set(familyKey, familyBucket);
    for (const entityId of entry.entityIds ?? []) {
      const entityBucket = entriesByEntityId.get(entityId) ?? [];
      entityBucket.push(entry);
      entriesByEntityId.set(entityId, entityBucket);
    }
  }
  const revisionsByConcept = new Map<string, PersistedMemoryRevision[]>();
  for (const revision of params.revisions) {
    const bucket = revisionsByConcept.get(revision.conceptId) ?? [];
    bucket.push(revision);
    revisionsByConcept.set(revision.conceptId, bucket);
  }

  const scoreEntry = (entry: LongTermMemoryEntry, history: PersistedMemoryRevision[]): number => {
    const recencyDays = Math.max(0, (Date.now() - entry.updatedAt) / (1000 * 60 * 60 * 24));
    const recencyScore = Math.max(0, 1 - recencyDays / 30);
    const sourceScore = sourceTypeReliabilityScore(entry.sourceType) * 0.045;
    const importanceScore =
      entry.importanceClass === "critical"
        ? 0.16
        : entry.importanceClass === "useful"
          ? 0.1
          : entry.importanceClass === "temporary"
            ? -0.08
            : -0.12;
    const revisionSupport = Math.min(0.18, (entry.revisionCount + history.length) * 0.03);
    const artifactSupport = Math.min(0.12, (entry.artifactRefs ?? []).length * 0.04);
    const contradictionPenalty =
      entry.contradictionCount > 0 || entry.adjudicationStatus === "contested" ? 0.22 : 0;
    const supersededPenalty = entry.activeStatus === "superseded" ? 0.28 : 0;
    const entityNeighbors = uniqueIds(entry.entityIds ?? []).flatMap(
      (entityId) => entriesByEntityId.get(entityId) ?? [],
    );
    const entityConsensusSupport = Math.min(
      0.18,
      entityNeighbors.filter(
        (neighbor) =>
          neighbor.id !== entry.id &&
          neighbor.activeStatus !== "superseded" &&
          !isContradictoryPair(entry, neighbor),
      ).length * 0.05,
    );
    const entityKindConsensusSupport = Math.min(
      0.12,
      entityNeighbors.filter(
        (neighbor) =>
          neighbor.id !== entry.id && countCanonicalEntityKindOverlap(entry, neighbor) > 0,
      ).length * 0.03,
    );
    const entityConflictPenalty = Math.min(
      0.24,
      entityNeighbors.filter(
        (neighbor) => neighbor.id !== entry.id && isContradictoryPair(entry, neighbor),
      ).length * 0.08,
    );
    const provenanceKinds = new Set((entry.provenance ?? []).map((item) => item.kind));
    const provenanceSupport =
      Math.min(0.06, (entry.provenance?.length ?? 0) * 0.015) +
      Math.min(0.06, provenanceKinds.size * 0.025);
    const evidenceSupport = Math.min(0.08, (entry.evidence?.length ?? 0) * 0.015);
    return (
      entry.confidence * 0.34 +
      entry.strength * 0.22 +
      recencyScore * 0.12 +
      sourceScore +
      importanceScore +
      revisionSupport +
      artifactSupport +
      provenanceSupport +
      evidenceSupport +
      entityConsensusSupport +
      entityKindConsensusSupport -
      entityConflictPenalty -
      contradictionPenalty -
      supersededPenalty
    );
  };

  const adjudications: PersistedMemoryAdjudication[] = [];
  for (const [conceptId, conceptEntries] of entriesByConcept.entries()) {
    const history = revisionsByConcept.get(conceptId) ?? [];
    const hasConflictingEvidence =
      history.some((revision) => revision.adjudicationStatus === "contested") ||
      conceptEntries.some((entry) => entry.contradictionCount > 0) ||
      conceptEntries.some((entry, index) =>
        conceptEntries.slice(index + 1).some((other) => isContradictoryPair(entry, other)),
      );
    const scoredEntries = conceptEntries
      .map((entry) => ({
        entry,
        score: scoreEntry(
          entry,
          history.filter((revision) => revision.memoryId === entry.id),
        ),
      }))
      .toSorted(
        (a, b) =>
          b.score - a.score ||
          b.entry.confidence - a.entry.confidence ||
          b.entry.updatedAt - a.entry.updatedAt,
      );
    const winner = scoredEntries[0]?.entry;
    const winningScore = scoredEntries[0]?.score ?? 0;
    const runnerUpScore = scoredEntries[1]?.score ?? 0;
    const scoreGap = winningScore - runnerUpScore;
    const conceptFamilyKey = getEntryConceptFamilyKey(winner ?? conceptEntries[0]);
    const entityIds = uniqueIds(conceptEntries.flatMap((entry) => entry.entityIds ?? []));
    const entityNeighborEntries = entityIds.flatMap(
      (entityId) => entriesByEntityId.get(entityId) ?? [],
    );
    const losingMemoryIds = conceptEntries
      .filter((entry) => entry.id !== winner?.id)
      .map((entry) => entry.id);
    const winnerScopeSignature = buildScopeSignature(winner ?? conceptEntries[0]);
    const familyAlternativeEntries = (entriesByConceptFamily.get(conceptFamilyKey) ?? []).filter(
      (entry) => getEntryConceptId(entry) !== conceptId,
    );
    const entityAlternativeEntries = entityNeighborEntries;
    const alternativeConceptIds = uniqueIds(
      [...familyAlternativeEntries, ...entityAlternativeEntries]
        .filter((entry) => getEntryConceptId(entry) !== conceptId)
        .filter((entry) => buildScopeSignature(entry) !== winnerScopeSignature)
        .map((entry) => getEntryConceptId(entry)),
    );
    const conflictingEntityAlternatives = uniqueIds(
      entityNeighborEntries
        .filter((entry) => getEntryConceptId(entry) !== conceptId)
        .filter((entry) => isContradictoryPair(entry, winner ?? conceptEntries[0]))
        .map((entry) => getEntryConceptId(entry)),
    );
    const scoredAlternativeEntries = [
      ...new Map(
        [...familyAlternativeEntries, ...entityNeighborEntries]
          .filter((entry) => getEntryConceptId(entry) !== conceptId)
          .map((entry) => [entry.id, entry]),
      ).values(),
    ]
      .map((entry) => ({
        entry,
        score: scoreEntry(
          entry,
          revisionsByConcept
            .get(getEntryConceptId(entry))
            ?.filter((revision) => revision.memoryId === entry.id) ?? [],
        ),
      }))
      .toSorted(
        (a, b) =>
          b.score - a.score ||
          sourceTypeReliabilityScore(b.entry.sourceType) -
            sourceTypeReliabilityScore(a.entry.sourceType) ||
          b.entry.updatedAt - a.entry.updatedAt,
      );
    const strongestAlternative = scoredAlternativeEntries[0];
    const closeEntityAlternatives = scoredAlternativeEntries.filter((candidate) => {
      if (!winner || candidate.entry.id === winner.id) {
        return false;
      }
      const sharesEntityFamily =
        countSharedEntityIds(winner, candidate.entry) > 0 ||
        countCanonicalEntityKindOverlap(winner, candidate.entry) > 0 ||
        isContradictoryPair(winner, candidate.entry);
      return sharesEntityFamily && candidate.score + 0.12 >= winningScore;
    });
    const winnerSourceScore = winner ? sourceTypeReliabilityScore(winner.sourceType) : 0;
    const strongestAlternativeSourceScore = Math.max(
      0,
      ...conceptEntries
        .filter((entry) => entry.id !== winner?.id)
        .map((entry) => sourceTypeReliabilityScore(entry.sourceType)),
      ...entityNeighborEntries
        .filter((entry) => entry.id !== winner?.id)
        .map((entry) => sourceTypeReliabilityScore(entry.sourceType)),
    );
    let status: MemoryAdjudicationStatus = winner?.adjudicationStatus ?? "authoritative";
    let resolutionKind: PersistedMemoryAdjudication["resolutionKind"] = "winner";
    let rationale = "weighted evidence favors a single authoritative concept state";
    if (history.some((revision) => revision.adjudicationStatus === "contested")) {
      status = "contested";
      resolutionKind = "contested";
      rationale = "concept revision history contains contested evidence";
    } else if (
      hasConflictingEvidence &&
      scoredEntries.length > 1 &&
      scoreGap < 0.08 &&
      conceptEntries.some((entry) => entry.activeStatus !== "superseded")
    ) {
      status = "contested";
      resolutionKind = "contested";
      rationale = "weighted evidence gap between competing concept observations is too small";
    } else if (conflictingEntityAlternatives.length > 0 && scoreGap < 0.14) {
      status = "contested";
      resolutionKind = "contested";
      rationale =
        "shared canonical entities point to conflicting concept states without enough winning margin";
    } else if (
      winner &&
      isWeakEvidenceSource(winner.sourceType) &&
      strongestAlternative &&
      sourceTypeReliabilityScore(strongestAlternative.entry.sourceType) > winnerSourceScore &&
      strongestAlternative.score + 0.08 >= winningScore &&
      (countSharedEntityIds(winner, strongestAlternative.entry) > 0 ||
        countCanonicalEntityKindOverlap(winner, strongestAlternative.entry) > 0 ||
        isContradictoryPair(winner, strongestAlternative.entry))
    ) {
      status = "contested";
      resolutionKind = "contested";
      rationale =
        "weak-evidence winner is too close to a stronger competing observation on the same entity family";
    } else if (
      winner &&
      closeEntityAlternatives.length >= 2 &&
      scoreGap < 0.18 &&
      closeEntityAlternatives.some(
        (candidate) => sourceTypeReliabilityScore(candidate.entry.sourceType) >= winnerSourceScore,
      )
    ) {
      status = "contested";
      resolutionKind = "contested";
      rationale =
        "multiple close entity-linked alternatives keep the concept family too ambiguous for one stable winner";
    } else if (alternativeConceptIds.length > 0) {
      status = winner?.activeStatus === "superseded" ? "superseded" : "authoritative";
      resolutionKind = "scoped_alternative";
      rationale =
        entityIds.length > 0
          ? "concept family includes scope-specific alternatives over shared canonical entities"
          : "concept family includes scope-specific alternatives with distinct scope signatures";
    } else if (
      winner &&
      (winner.entityIds?.length ?? 0) > 0 &&
      entityNeighborEntries.some(
        (entry) =>
          entry.id !== winner.id &&
          !isContradictoryPair(entry, winner) &&
          countCanonicalEntityKindOverlap(entry, winner) > 0,
      )
    ) {
      rationale = "weighted winner is reinforced by shared canonical entity classes";
    } else if (winner && winnerSourceScore > strongestAlternativeSourceScore && scoreGap >= 0.1) {
      rationale = `weighted evidence favors the more reliable ${winner.sourceType} observation`;
    } else if (
      winner &&
      new Set((winner.provenance ?? []).map((item) => item.kind)).size >= 2 &&
      scoreGap >= 0.08
    ) {
      rationale = "weighted winner is reinforced by diverse provenance evidence";
    } else if (conceptEntries.some((entry) => entry.activeStatus === "superseded")) {
      status = winner?.activeStatus === "superseded" ? "superseded" : status;
      resolutionKind = winner?.activeStatus === "superseded" ? "retired" : "winner";
      rationale = "weighted winner remains after superseded observations are retired";
    } else if (history.some((revision) => revision.revisionKind === "updated")) {
      rationale = "weighted winner is supported by updated revision history";
    } else if (history.some((revision) => revision.revisionKind === "narrowed")) {
      rationale = "weighted winner is supported by narrowed revision history";
    }
    adjudications.push({
      id: `adj-${stableHash([params.sessionId, conceptId, status, winner?.id ?? "", history.map((item) => item.id).join(",")].join("::"))}`,
      sessionId: params.sessionId,
      conceptId,
      status,
      resolutionKind,
      rationale,
      winningMemoryId: winner?.id,
      losingMemoryIds,
      alternativeConceptIds,
      entityIds,
      winningScore,
      scoreGap: scoredEntries.length > 1 ? scoreGap : undefined,
      scopeSummary: [
        winner?.versionScope ? `version=${winner.versionScope}` : "",
        winner?.installProfileScope ? `profile=${winner.installProfileScope}` : "",
        winner?.customerScope ? `customer=${winner.customerScope}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      updatedAt: winner?.updatedAt ?? Date.now(),
    });
  }
  return adjudications;
}

export async function loadMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  allowBackupRecovery?: boolean;
}): Promise<MemoryStoreSnapshot> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  if (params.backendKind === "sqlite-graph") {
    const { DatabaseSync } = requireNodeSqlite();
    await ensureStoreDirs(paths);
    const dbPath = path.join(paths.rootDir, SQLITE_STORE_FILENAME);
    let db: import("node:sqlite").DatabaseSync | undefined;
    try {
      db = new DatabaseSync(dbPath);
      const migrationState = applySqliteGraphMigrations(db);
      const integrityRow = db.prepare("PRAGMA integrity_check(1)").get() as
        | { integrity_check?: string }
        | undefined;
      if (integrityRow?.integrity_check && integrityRow.integrity_check !== "ok") {
        throw new Error(`memory sqlite integrity check failed: ${integrityRow.integrity_check}`);
      }
      const metadata = sanitizeMemoryStoreMetadata(
        (() => {
          const row = db
            .prepare("SELECT value FROM memory_store_metadata WHERE key = 'store'")
            .get() as { value?: string } | undefined;
          if (!row?.value) {
            return defaultMemoryStoreMetadata("sqlite-graph");
          }
          try {
            return JSON.parse(row.value) as MemoryStoreMetadata;
          } catch {
            return defaultMemoryStoreMetadata("sqlite-graph");
          }
        })(),
        "sqlite-graph",
      );
      const workingRow = db
        .prepare("SELECT json FROM working_memory WHERE session_id = ?")
        .get(params.sessionId) as { json?: string } | undefined;
      const longTermRows = db
        .prepare("SELECT json FROM long_term_memory WHERE session_id = ? ORDER BY updated_at DESC")
        .all(params.sessionId) as Array<{ json: string }>;
      const conceptRows = db
        .prepare(
          "SELECT id, concept_key, canonical_text, category, ontology_kind, permanence_status, adjudication_status, updated_at, json FROM memory_concepts WHERE session_id = ? ORDER BY updated_at DESC",
        )
        .all(params.sessionId) as Array<{
        id: string;
        concept_key: string;
        canonical_text: string;
        category: MemoryCategory;
        ontology_kind: MemoryOntologyKind;
        permanence_status: MemoryPermanenceStatus;
        adjudication_status: MemoryAdjudicationStatus;
        updated_at: number;
        json: string;
      }>;
      const aliasRows = db
        .prepare(
          "SELECT concept_id, alias FROM memory_concept_aliases WHERE session_id = ? ORDER BY updated_at DESC",
        )
        .all(params.sessionId) as Array<{ concept_id: string; alias: string }>;
      const entityRows = db
        .prepare("SELECT json FROM memory_entities WHERE session_id = ? ORDER BY updated_at DESC")
        .all(params.sessionId) as Array<{ json: string }>;
      const revisionRows = db
        .prepare(
          "SELECT concept_id, json FROM memory_revisions WHERE session_id = ? ORDER BY updated_at DESC",
        )
        .all(params.sessionId) as Array<{ concept_id: string; json: string }>;
      const revisions = revisionRows.map((row) => JSON.parse(row.json) as PersistedMemoryRevision);
      const adjudicationRows = db
        .prepare(
          "SELECT json FROM memory_adjudications WHERE session_id = ? ORDER BY updated_at DESC",
        )
        .all(params.sessionId) as Array<{ json: string }>;
      const adjudications = adjudicationRows.map((row) =>
        sanitizePersistedMemoryAdjudication(JSON.parse(row.json) as PersistedMemoryAdjudication),
      );
      const pendingRows = db
        .prepare("SELECT json FROM pending_memory WHERE session_id = ? ORDER BY updated_at DESC")
        .all(params.sessionId) as Array<{ json: string }>;
      const permanentRows = db
        .prepare(
          "SELECT id, parent_id, json FROM permanent_nodes WHERE session_id = ? ORDER BY updated_at ASC",
        )
        .all(params.sessionId) as Array<{ id: string; parent_id: string | null; json: string }>;
      const graphNodeRows = db
        .prepare(
          "SELECT json FROM memory_graph_nodes WHERE session_id = ? ORDER BY updated_at DESC",
        )
        .all(params.sessionId) as Array<{ json: string }>;
      const graphEdgeRows = db
        .prepare(
          "SELECT json FROM memory_graph_edges WHERE session_id = ? ORDER BY updated_at DESC",
        )
        .all(params.sessionId) as Array<{ json: string }>;
      const aliasesByConcept = new Map<string, string[]>();
      for (const row of aliasRows) {
        const bucket = aliasesByConcept.get(row.concept_id) ?? [];
        bucket.push(row.alias);
        aliasesByConcept.set(row.concept_id, bucket);
      }
      const entityIdsByConcept = new Map<string, string[]>();
      for (const row of entityRows) {
        const entity = JSON.parse(row.json) as PersistedMemoryEntity;
        for (const conceptId of entity.conceptIds ?? []) {
          const bucket = entityIdsByConcept.get(conceptId) ?? [];
          bucket.push(entity.id);
          entityIdsByConcept.set(conceptId, bucket);
        }
      }
      const conceptByKey = new Map<string, PersistedMemoryConcept>();
      for (const row of conceptRows) {
        const concept = JSON.parse(row.json) as PersistedMemoryConcept;
        const revisionKinds = new Set(
          revisions
            .filter((revision) => revision.conceptId === row.id)
            .map((revision) => revision.revisionKind),
        );
        concept.aliases = uniqueStrings([
          ...(aliasesByConcept.get(row.id) ?? []),
          ...(concept.aliases ?? []),
        ]);
        concept.entityAliases = uniqueStrings(concept.entityAliases ?? []);
        concept.entityIds = uniqueIds([
          ...(concept.entityIds ?? []),
          ...(entityIdsByConcept.get(row.id) ?? []),
        ]);
        if (revisionKinds.has("contested")) {
          concept.adjudicationStatus = "contested";
        } else if (revisionKinds.has("updated") || revisionKinds.has("narrowed")) {
          concept.canonicalText = concept.canonicalText || row.canonical_text;
        }
        conceptByKey.set(row.concept_key, concept);
      }
      const workingMemory = workingRow?.json
        ? (JSON.parse(workingRow.json) as WorkingMemorySnapshot)
        : {
            sessionId: params.sessionId,
            updatedAt: Date.now(),
            rollingSummary: "",
            carryForwardSummary: "",
            activeFacts: [],
            activeGoals: [],
            openLoops: [],
            recentEvents: [],
            recentDecisions: [],
          };
      const snapshot: MemoryStoreSnapshot = {
        workingMemory,
        longTermMemory: longTermRows.map((row) => {
          const entry = sanitizeLongTermEntry(JSON.parse(row.json) as LongTermMemoryEntry);
          const concept = conceptByKey.get(entry.conceptKey);
          const adjudication = adjudications.find(
            (item) => item.conceptId === getEntryConceptId(entry),
          );
          if (!concept) {
            return adjudication ? { ...entry, adjudicationStatus: adjudication.status } : entry;
          }
          return {
            ...entry,
            canonicalText: concept.canonicalText || entry.canonicalText,
            conceptAliases: uniqueStrings([
              ...(entry.conceptAliases ?? []),
              ...(concept.aliases ?? []),
            ]),
            entityAliases: uniqueStrings([
              ...(entry.entityAliases ?? []),
              ...(concept.entityAliases ?? []),
            ]),
            entityIds: uniqueIds([...(entry.entityIds ?? []), ...(concept.entityIds ?? [])]),
            permanenceStatus: concept.permanenceStatus ?? entry.permanenceStatus,
            adjudicationStatus:
              adjudication?.status ?? concept.adjudicationStatus ?? entry.adjudicationStatus,
          };
        }),
        pendingSignificance: pendingRows.map((row) =>
          sanitizePendingEntry(JSON.parse(row.json) as PendingMemoryEntry),
        ),
        permanentMemory:
          permanentRows.length > 0 ? collectSqliteGraphRoot(permanentRows) : createPermanentRoot(),
        graph: sanitizeGraphSnapshot({
          nodes: graphNodeRows.map((row) => JSON.parse(row.json) as MemoryGraphNode),
          edges: graphEdgeRows.map((row) => JSON.parse(row.json) as MemoryGraphEdge),
          updatedAt: Date.now(),
        }),
      };
      db.prepare(
        `
          INSERT INTO memory_store_metadata (key, value)
          VALUES ('store', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `,
      ).run(
        JSON.stringify(
          buildSnapshotStoreMetadata({
            backend: "sqlite-graph",
            snapshot,
            previous: {
              ...metadata,
              schemaVersion: migrationState.schemaVersion,
              lastAppliedMigration: migrationState.lastAppliedMigration,
              lastIntegrityCheckAt: Date.now(),
              lastIntegrityCheckResult: "ok",
            },
          }) satisfies MemoryStoreMetadata,
        ),
      );
      return snapshot;
    } catch (error) {
      if (params.allowBackupRecovery !== false) {
        const backup = await readJsonFile<MemoryStoreExportBundle | null>(paths.backupFile, null);
        if (backup) {
          return recoverMemoryStoreFromBackup({
            workspaceDir: params.workspaceDir,
            sessionId: params.sessionId,
            backendKind: "sqlite-graph",
          });
        }
      }
      throw error;
    } finally {
      db?.close();
    }
  }
  const backend = resolveMemoryStoreBackend(params.backendKind);
  await ensureStoreDirs(paths);
  const metadata = sanitizeMemoryStoreMetadata(
    await backend.readJson<MemoryStoreMetadata>(
      paths.metadataFile,
      defaultMemoryStoreMetadata(backend.kind),
    ),
    backend.kind,
  );
  const workingMemory = await backend.readJson<WorkingMemorySnapshot>(paths.workingFile, {
    sessionId: params.sessionId,
    updatedAt: Date.now(),
    rollingSummary: "",
    carryForwardSummary: "",
    activeFacts: [],
    activeGoals: [],
    openLoops: [],
    recentEvents: [],
    recentDecisions: [],
  });
  const longTermMemory = (
    await backend.readJson<LongTermMemoryEntry[]>(paths.longTermFile, [])
  ).map((entry) => sanitizeLongTermEntry(entry));
  const pendingSignificance = await backend.readJson<PendingMemoryEntry[]>(paths.pendingFile, []);
  const permanentMemory = sanitizePermanentNode(
    await backend.readJson<PermanentMemoryNode>(paths.permanentTreeFile, createPermanentRoot()),
  );
  const graph = sanitizeGraphSnapshot(
    await backend.readJson<MemoryGraphSnapshot>(paths.graphFile, createEmptyGraph()),
  );
  const snapshot: MemoryStoreSnapshot = {
    workingMemory,
    longTermMemory,
    pendingSignificance: pendingSignificance.map((entry) => sanitizePendingEntry(entry)),
    permanentMemory,
    graph,
  };
  await backend.writeJson(
    paths.metadataFile,
    buildSnapshotStoreMetadata({
      backend: backend.kind,
      snapshot,
      previous: metadata,
    }) satisfies MemoryStoreMetadata,
  );
  return snapshot;
}

export async function persistMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
  workingMemory: WorkingMemorySnapshot;
  longTermMemory: LongTermMemoryEntry[];
  pendingSignificance: PendingMemoryEntry[];
  permanentMemory: PermanentMemoryNode;
  graph: MemoryGraphSnapshot;
  backendKind?: MemoryStoreBackendKind;
}): Promise<void> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  const snapshot: MemoryStoreSnapshot = {
    workingMemory: params.workingMemory,
    longTermMemory: params.longTermMemory,
    pendingSignificance: params.pendingSignificance,
    permanentMemory: params.permanentMemory,
    graph: params.graph,
  };
  if (params.backendKind === "sqlite-graph") {
    const { DatabaseSync } = requireNodeSqlite();
    await ensureStoreDirs(paths);
    const dbPath = path.join(paths.rootDir, SQLITE_STORE_FILENAME);
    const db = new DatabaseSync(dbPath);
    try {
      const migrationState = applySqliteGraphMigrations(db);
      const metadata = sanitizeMemoryStoreMetadata(
        (() => {
          const row = db
            .prepare("SELECT value FROM memory_store_metadata WHERE key = 'store'")
            .get() as { value?: string } | undefined;
          if (!row?.value) {
            return defaultMemoryStoreMetadata("sqlite-graph");
          }
          try {
            return JSON.parse(row.value) as MemoryStoreMetadata;
          } catch {
            return defaultMemoryStoreMetadata("sqlite-graph");
          }
        })(),
        "sqlite-graph",
      );
      db.prepare(
        `
          INSERT INTO memory_store_metadata (key, value)
          VALUES ('store', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `,
      ).run(
        JSON.stringify(
          buildSnapshotStoreMetadata({
            backend: "sqlite-graph",
            snapshot,
            previous: {
              ...metadata,
              schemaVersion: migrationState.schemaVersion,
              lastAppliedMigration: migrationState.lastAppliedMigration,
            },
          }) satisfies MemoryStoreMetadata,
        ),
      );
      db.prepare(
        `
          INSERT INTO working_memory (session_id, json, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET
            json = excluded.json,
            updated_at = excluded.updated_at
        `,
      ).run(params.sessionId, JSON.stringify(params.workingMemory), Date.now());
      db.prepare("DELETE FROM long_term_memory WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_concepts WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_concept_aliases WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_entities WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_revisions WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_adjudications WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM pending_memory WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM permanent_nodes WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_graph_nodes WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_graph_edges WHERE session_id = ?").run(params.sessionId);

      const concepts = buildPersistedMemoryConcepts(params.longTermMemory);
      const entities = buildPersistedMemoryEntities(params.sessionId, concepts);
      const entityIdsByConcept = new Map<string, string[]>();
      for (const entity of entities) {
        for (const conceptId of entity.conceptIds) {
          const bucket = entityIdsByConcept.get(conceptId) ?? [];
          bucket.push(entity.id);
          entityIdsByConcept.set(conceptId, bucket);
        }
      }
      for (const concept of concepts) {
        concept.entityIds = uniqueIds([
          ...(concept.entityIds ?? []),
          ...(entityIdsByConcept.get(concept.id) ?? []),
        ]);
      }
      const revisions = buildPersistedMemoryRevisions({
        sessionId: params.sessionId,
        entries: params.longTermMemory,
      });
      const adjudications = buildPersistedMemoryAdjudications({
        sessionId: params.sessionId,
        entries: params.longTermMemory,
        revisions,
      });
      const conceptIdByKey = new Map(concepts.map((concept) => [concept.conceptKey, concept.id]));
      const insertLongTerm = db.prepare(
        `INSERT INTO long_term_memory (
          id, session_id, concept_id, concept_key, ontology_kind, active_status, permanence_status, updated_at, json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const entry of params.longTermMemory) {
        insertLongTerm.run(
          entry.id,
          params.sessionId,
          conceptIdByKey.get(entry.conceptKey) ?? `concept-${stableHash(entry.conceptKey)}`,
          entry.conceptKey,
          entry.ontologyKind,
          entry.activeStatus,
          entry.permanenceStatus,
          entry.updatedAt,
          JSON.stringify(entry),
        );
      }
      const insertConcept = db.prepare(
        `INSERT INTO memory_concepts (
          id, session_id, concept_key, canonical_text, category, ontology_kind, permanence_status, adjudication_status, updated_at, json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertAlias = db.prepare(
        "INSERT INTO memory_concept_aliases (session_id, concept_id, alias, updated_at) VALUES (?, ?, ?, ?)",
      );
      const insertEntity = db.prepare(
        `INSERT INTO memory_entities (
          id, session_id, entity_kind, canonical_name, updated_at, json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const concept of concepts) {
        insertConcept.run(
          concept.id,
          params.sessionId,
          concept.conceptKey,
          concept.canonicalText,
          concept.category,
          concept.ontologyKind,
          concept.permanenceStatus,
          concept.adjudicationStatus,
          concept.updatedAt,
          JSON.stringify(concept),
        );
        for (const alias of concept.aliases) {
          insertAlias.run(params.sessionId, concept.id, alias, concept.updatedAt);
        }
      }
      for (const entity of entities) {
        insertEntity.run(
          entity.id,
          entity.sessionId,
          entity.kind,
          entity.canonicalName,
          entity.updatedAt,
          JSON.stringify(entity),
        );
      }
      const insertRevision = db.prepare(
        `INSERT INTO memory_revisions (
          id, session_id, concept_id, memory_id, revision_kind, adjudication_status, active_status, permanence_status, updated_at, json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          adjudication_status = excluded.adjudication_status,
          active_status = excluded.active_status,
          permanence_status = excluded.permanence_status,
          updated_at = excluded.updated_at,
          json = excluded.json`,
      );
      for (const revision of revisions) {
        insertRevision.run(
          revision.id,
          revision.sessionId,
          revision.conceptId,
          revision.memoryId,
          revision.revisionKind,
          revision.adjudicationStatus,
          revision.activeStatus,
          revision.permanenceStatus,
          revision.updatedAt,
          JSON.stringify(revision),
        );
      }
      const insertAdjudication = db.prepare(
        `INSERT INTO memory_adjudications (
          id, session_id, concept_id, status, resolution_kind, updated_at, json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          resolution_kind = excluded.resolution_kind,
          updated_at = excluded.updated_at,
          json = excluded.json`,
      );
      for (const adjudication of adjudications) {
        insertAdjudication.run(
          adjudication.id,
          adjudication.sessionId,
          adjudication.conceptId,
          adjudication.status,
          adjudication.resolutionKind,
          adjudication.updatedAt,
          JSON.stringify(adjudication),
        );
      }
      const insertPending = db.prepare(
        "INSERT INTO pending_memory (id, session_id, updated_at, json) VALUES (?, ?, ?, ?)",
      );
      for (const entry of params.pendingSignificance) {
        insertPending.run(entry.id, params.sessionId, entry.updatedAt, JSON.stringify(entry));
      }
      const insertPermanent = db.prepare(
        "INSERT INTO permanent_nodes (id, session_id, parent_id, updated_at, json) VALUES (?, ?, ?, ?, ?)",
      );
      for (const record of flattenPermanentNodeRecords(params.permanentMemory)) {
        const parsed = JSON.parse(record.json) as PermanentMemoryNode;
        insertPermanent.run(
          record.id,
          params.sessionId,
          record.parentId ?? null,
          parsed.updatedAt,
          record.json,
        );
      }
      const insertGraphNode = db.prepare(
        "INSERT INTO memory_graph_nodes (id, session_id, kind, active_status, updated_at, json) VALUES (?, ?, ?, ?, ?, ?)",
      );
      for (const node of params.graph.nodes) {
        insertGraphNode.run(
          node.id,
          params.sessionId,
          node.kind,
          node.activeStatus,
          node.updatedAt,
          JSON.stringify(node),
        );
      }
      const insertGraphEdge = db.prepare(
        "INSERT INTO memory_graph_edges (session_id, from_id, to_id, type, updated_at, json) VALUES (?, ?, ?, ?, ?, ?)",
      );
      for (const edge of params.graph.edges) {
        insertGraphEdge.run(
          params.sessionId,
          edge.from,
          edge.to,
          edge.type,
          edge.updatedAt,
          JSON.stringify(edge),
        );
      }
      const persistedMetadata = buildSnapshotStoreMetadata({
        backend: "sqlite-graph",
        snapshot,
        previous: {
          ...metadata,
          schemaVersion: migrationState.schemaVersion,
          lastAppliedMigration: migrationState.lastAppliedMigration,
        },
      });
      await writeJsonFile(
        paths.backupFile,
        buildMemoryStoreExportBundle({
          sessionId: params.sessionId,
          backendKind: "sqlite-graph",
          metadata: persistedMetadata,
          snapshot,
        }),
      );
      return;
    } finally {
      db.close();
    }
  }
  const backend = resolveMemoryStoreBackend(params.backendKind);
  await ensureStoreDirs(paths);
  const metadata = sanitizeMemoryStoreMetadata(
    await backend.readJson<MemoryStoreMetadata>(
      paths.metadataFile,
      defaultMemoryStoreMetadata(backend.kind),
    ),
    backend.kind,
  );
  await Promise.all([
    backend.writeJson(
      paths.metadataFile,
      buildSnapshotStoreMetadata({
        backend: backend.kind,
        snapshot,
        previous: metadata,
      }) satisfies MemoryStoreMetadata,
    ),
    backend.writeJson(paths.workingFile, snapshot.workingMemory),
    backend.writeJson(paths.longTermFile, snapshot.longTermMemory),
    backend.writeJson(paths.pendingFile, snapshot.pendingSignificance),
    backend.writeJson(paths.permanentTreeFile, snapshot.permanentMemory),
    backend.writeJson(paths.graphFile, snapshot.graph),
    writeJsonFile(
      paths.backupFile,
      buildMemoryStoreExportBundle({
        sessionId: params.sessionId,
        backendKind: backend.kind,
        metadata: buildSnapshotStoreMetadata({
          backend: backend.kind,
          snapshot,
          previous: metadata,
        }),
        snapshot,
      }),
    ),
  ]);
}

export async function exportMemoryStoreBundle(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
}): Promise<MemoryStoreExportBundle> {
  const backendKind = params.backendKind ?? "fs-json";
  const snapshot = await loadMemoryStoreSnapshot({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  });
  const metadata = await loadPersistedStoreMetadata({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  });
  return buildMemoryStoreExportBundle({
    sessionId: params.sessionId,
    backendKind,
    metadata,
    snapshot,
  });
}

export async function importMemoryStoreBundle(params: {
  workspaceDir: string;
  bundle: MemoryStoreExportBundle;
  targetSessionId?: string;
  backendKind?: MemoryStoreBackendKind;
}): Promise<void> {
  const sessionId = params.targetSessionId ?? params.bundle.sessionId;
  const backendKind = params.backendKind ?? params.bundle.backendKind;
  await persistMemoryStoreSnapshot({
    workspaceDir: params.workspaceDir,
    sessionId,
    backendKind,
    workingMemory: {
      ...params.bundle.snapshot.workingMemory,
      sessionId,
      updatedAt: Date.now(),
    },
    longTermMemory: params.bundle.snapshot.longTermMemory.map((entry) =>
      sanitizeLongTermEntry(entry),
    ),
    pendingSignificance: params.bundle.snapshot.pendingSignificance.map((entry) =>
      sanitizePendingEntry(entry),
    ),
    permanentMemory: sanitizePermanentNode(params.bundle.snapshot.permanentMemory),
    graph: sanitizeGraphSnapshot(params.bundle.snapshot.graph),
  });
}

export async function repairMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
}): Promise<MemoryStoreSnapshot> {
  const repaired = await repairMemoryStoreSnapshotWithReport(params);
  return repaired.snapshot;
}

export async function repairMemoryStoreSnapshotWithReport(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
}): Promise<{ snapshot: MemoryStoreSnapshot; report: MemoryStoreMaintenanceReport }> {
  const backendKind = params.backendKind ?? "fs-json";
  const healthBefore = await inspectMemoryStoreHealth({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  });
  const snapshot = await loadMemoryStoreSnapshot({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  });
  await persistMemoryStoreSnapshot({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
    workingMemory: snapshot.workingMemory,
    longTermMemory: snapshot.longTermMemory,
    pendingSignificance: snapshot.pendingSignificance,
    permanentMemory: snapshot.permanentMemory,
    graph: snapshot.graph,
  });
  const repairedSnapshot = await loadMemoryStoreSnapshot({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
    allowBackupRecovery: false,
  });
  const healthAfter = await inspectMemoryStoreHealth({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  });
  return {
    snapshot: repairedSnapshot,
    report: {
      action: "repair",
      backendKind,
      sessionId: params.sessionId,
      success: true,
      issuesBefore: healthBefore.issues,
      issuesAfter: healthAfter.issues,
      backupAvailableBefore: healthBefore.backupAvailable,
      backupAvailableAfter: healthAfter.backupAvailable,
      longTermCountBefore: snapshot.longTermMemory.length,
      longTermCountAfter: repairedSnapshot.longTermMemory.length,
      summary: clipText(
        `repair backend=${backendKind} issues-before=${healthBefore.issues.length} issues-after=${healthAfter.issues.length} long-term=${snapshot.longTermMemory.length}->${repairedSnapshot.longTermMemory.length}`,
        220,
      ),
    },
  };
}

export async function recoverMemoryStoreFromBackup(params: {
  workspaceDir: string;
  sessionId: string;
  targetSessionId?: string;
  backendKind?: MemoryStoreBackendKind;
}): Promise<MemoryStoreSnapshot> {
  const recovered = await recoverMemoryStoreFromBackupWithReport(params);
  return recovered.snapshot;
}

export async function recoverMemoryStoreFromBackupWithReport(params: {
  workspaceDir: string;
  sessionId: string;
  targetSessionId?: string;
  backendKind?: MemoryStoreBackendKind;
}): Promise<{ snapshot: MemoryStoreSnapshot; report: MemoryStoreMaintenanceReport }> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  let healthBeforeLongTermCount: number | undefined;
  const healthBefore = await inspectMemoryStoreHealth({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind: params.backendKind,
  })
    .then((report) => {
      healthBeforeLongTermCount = report.metadata.longTermCount;
      return report;
    })
    .catch(() => ({
      issues: ["store unreadable before recovery"],
      backupAvailable: false,
    }));
  const bundle = await readJsonFile<MemoryStoreExportBundle | null>(paths.backupFile, null);
  if (!bundle) {
    throw new Error(`memory store backup not found for session ${params.sessionId}`);
  }
  const targetBackend = params.backendKind ?? bundle.backendKind;
  if (targetBackend === "sqlite-graph") {
    await fs.rm(path.join(paths.rootDir, SQLITE_STORE_FILENAME), { force: true });
  }
  await importMemoryStoreBundle({
    workspaceDir: params.workspaceDir,
    bundle,
    targetSessionId: params.targetSessionId,
    backendKind: targetBackend,
  });
  const recoveredSnapshot = await loadMemoryStoreSnapshot({
    workspaceDir: params.workspaceDir,
    sessionId: params.targetSessionId ?? params.sessionId,
    backendKind: targetBackend,
    allowBackupRecovery: false,
  });
  const healthAfter = await inspectMemoryStoreHealth({
    workspaceDir: params.workspaceDir,
    sessionId: params.targetSessionId ?? params.sessionId,
    backendKind: targetBackend,
  });
  return {
    snapshot: recoveredSnapshot,
    report: {
      action: "recovery",
      backendKind: targetBackend,
      sessionId: params.targetSessionId ?? params.sessionId,
      success: true,
      issuesBefore: healthBefore.issues,
      issuesAfter: healthAfter.issues,
      backupAvailableBefore: Boolean(healthBefore.backupAvailable),
      backupAvailableAfter: healthAfter.backupAvailable,
      longTermCountBefore: healthBeforeLongTermCount,
      longTermCountAfter: recoveredSnapshot.longTermMemory.length,
      summary: clipText(
        `recovery backend=${targetBackend} issues-before=${healthBefore.issues.length} issues-after=${healthAfter.issues.length} long-term=${recoveredSnapshot.longTermMemory.length}`,
        220,
      ),
    },
  };
}

export async function inspectMemoryStoreHealth(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
}): Promise<MemoryStoreHealthReport> {
  const backendKind = params.backendKind ?? "fs-json";
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  const backupAvailable = await fs
    .stat(paths.backupFile)
    .then(() => true)
    .catch(() => false);
  const metadata = await loadPersistedStoreMetadata({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  }).catch(() => defaultMemoryStoreMetadata(backendKind));
  let snapshot: MemoryStoreSnapshot | undefined;
  let unreadableIssue: string | undefined;
  try {
    snapshot = await loadMemoryStoreSnapshot({
      workspaceDir: params.workspaceDir,
      sessionId: params.sessionId,
      backendKind,
      allowBackupRecovery: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? clipText(error.message, 160) : "unknown store read failure";
    unreadableIssue = `store unreadable: ${message}`;
  }
  if (!snapshot) {
    const issues = [unreadableIssue ?? "store unreadable"];
    if (metadata.lastIntegrityCheckResult && metadata.lastIntegrityCheckResult !== "ok") {
      issues.push(`integrity status: ${String(metadata.lastIntegrityCheckResult)}`);
    }
    if (!backupAvailable) {
      issues.push("backup bundle missing");
    }
    const recommendations = backupAvailable
      ? ["run store recovery from backup before normal diagnostics or retrieval"]
      : ["store is unreadable and no backup bundle is available"];
    return {
      backendKind,
      sessionId: params.sessionId,
      metadata,
      issues,
      recommendations,
      summary: clipText(
        [
          `backend=${backendKind}`,
          `long-term=${metadata.longTermCount ?? 0}`,
          `concepts=${metadata.conceptCount ?? 0}`,
          `backup=${backupAvailable ? "yes" : "no"}`,
          `issues=${issues.join("; ")}`,
        ].join(" | "),
        320,
      ),
      contestedConceptCount: 0,
      contestedEntityConflictCount: 0,
      scopedAlternativeConceptCount: 0,
      entityLinkedConceptCount: 0,
      weakEvidenceWinnerCount: 0,
      fragileWinnerCount: 0,
      sourceTypeCounts: createSourceTypeCounts(),
      authoritativeSourceTypeCounts: createSourceTypeCounts(),
      supersededMemoryCount: 0,
      permanentEligibleCount: 0,
      staleMemoryCount: 0,
      backupAvailable,
      recoveryRecommended: true,
    };
  }
  const adjudications = buildPersistedMemoryAdjudications({
    sessionId: params.sessionId,
    entries: snapshot.longTermMemory,
    revisions: collectPersistedMemoryRevisions(snapshot.longTermMemory),
  });
  const contestedConceptCount = new Set(
    snapshot.longTermMemory
      .filter((entry) => entry.adjudicationStatus === "contested")
      .map((entry) => getEntryConceptId(entry)),
  ).size;
  const scopedAlternativeConceptCount = new Set(
    adjudications
      .filter((item) => item.resolutionKind === "scoped_alternative")
      .map((item) => item.conceptId),
  ).size;
  const entityLinkedConceptCount = new Set(
    snapshot.longTermMemory
      .filter((entry) => (entry.entityIds?.length ?? 0) > 0)
      .map((entry) => getEntryConceptId(entry)),
  ).size;
  const supersededMemoryCount = snapshot.longTermMemory.filter(
    (entry) => entry.activeStatus === "superseded",
  ).length;
  const sourceTypeCounts = createSourceTypeCounts();
  for (const entry of snapshot.longTermMemory) {
    sourceTypeCounts[entry.sourceType] += 1;
  }
  const authoritativeSourceTypeCounts = createSourceTypeCounts();
  const entriesById = new Map(snapshot.longTermMemory.map((entry) => [entry.id, entry]));
  for (const adjudication of adjudications) {
    if (adjudication.status !== "authoritative" || !adjudication.winningMemoryId) {
      continue;
    }
    const winner = entriesById.get(adjudication.winningMemoryId);
    if (!winner) {
      continue;
    }
    authoritativeSourceTypeCounts[winner.sourceType] += 1;
  }
  const contestedEntityConflictCount = adjudications.filter(
    (item) => item.status === "contested" && item.entityIds.length > 0,
  ).length;
  const weakEvidenceWinnerCount = countWeakEvidenceWinners(snapshot.longTermMemory, adjudications);
  const fragileWinnerCount = countFragileWinners(snapshot.longTermMemory, adjudications);
  const permanentEligibleCount = snapshot.longTermMemory.filter(
    (entry) => entry.permanenceStatus === "eligible",
  ).length;
  const staleMemoryCount = snapshot.longTermMemory.filter(
    (entry) => entry.activeStatus === "stale" || entry.compressionState === "latent",
  ).length;
  const issues: string[] = [];
  if (contestedConceptCount > 0) {
    issues.push(`contested concepts: ${contestedConceptCount}`);
  }
  if (contestedEntityConflictCount > 0) {
    issues.push(`entity-linked contested concepts: ${contestedEntityConflictCount}`);
  }
  if (weakEvidenceWinnerCount > 0) {
    issues.push(`weak-evidence winners: ${weakEvidenceWinnerCount}`);
  }
  if (fragileWinnerCount > 0) {
    issues.push(`fragile authoritative winners: ${fragileWinnerCount}`);
  }
  if (supersededMemoryCount > Math.max(5, Math.floor(snapshot.longTermMemory.length * 0.25))) {
    issues.push(`superseded memory backlog: ${supersededMemoryCount}`);
  }
  if (staleMemoryCount > Math.max(8, Math.floor(snapshot.longTermMemory.length * 0.35))) {
    issues.push(`stale memory backlog: ${staleMemoryCount}`);
  }
  const integrityStatus: string | undefined = metadata.lastIntegrityCheckResult;
  if (integrityStatus !== undefined && integrityStatus !== "ok") {
    issues.push(`integrity status: ${integrityStatus}`);
  }
  if (backendKind === "sqlite-graph" && !metadata.schemaVersion) {
    issues.push("sqlite-graph metadata missing schema version");
  }
  if (!backupAvailable) {
    issues.push("backup bundle missing");
  }
  const recommendations: string[] = [];
  if (contestedConceptCount > 0) {
    recommendations.push("run diagnostics acceptance and inspect contested concept adjudications");
  }
  if (contestedEntityConflictCount > 0) {
    recommendations.push(
      "inspect contested concepts that share canonical entities before trusting current winners",
    );
  }
  if (weakEvidenceWinnerCount > 0) {
    recommendations.push(
      "review authoritative winners backed only by inferred or summary-derived evidence",
    );
  }
  if (fragileWinnerCount > 0) {
    recommendations.push(
      "inspect close authoritative winners with small adjudication margins before treating them as stable",
    );
  }
  if (scopedAlternativeConceptCount > 0) {
    recommendations.push(
      "review scoped alternatives for explicit version/profile/customer boundaries",
    );
  }
  if (staleMemoryCount > Math.max(8, Math.floor(snapshot.longTermMemory.length * 0.35))) {
    recommendations.push("run sleep review or archival cleanup to reduce stale memory pressure");
  }
  if (!backupAvailable) {
    recommendations.push("persist the store once to create a recovery backup bundle");
  }
  if (backendKind === "sqlite-graph" && !metadata.schemaVersion) {
    recommendations.push("run store repair to rewrite sqlite metadata and migration state");
  }
  if (recommendations.length === 0) {
    recommendations.push("no immediate repair action recommended");
  }
  const recoveryRecommended =
    (integrityStatus !== undefined && integrityStatus !== "ok") ||
    !backupAvailable ||
    (backendKind === "sqlite-graph" && !metadata.schemaVersion);
  const summary = clipText(
    [
      `backend=${backendKind}`,
      `long-term=${snapshot.longTermMemory.length}`,
      `concepts=${metadata.conceptCount ?? 0}`,
      `contested=${contestedConceptCount}`,
      `entity-contested=${contestedEntityConflictCount}`,
      `scoped-alternatives=${scopedAlternativeConceptCount}`,
      `entity-linked=${entityLinkedConceptCount}`,
      `weak-winners=${weakEvidenceWinnerCount}`,
      `fragile-winners=${fragileWinnerCount}`,
      `superseded=${supersededMemoryCount}`,
      `stale=${staleMemoryCount}`,
      `permanent-eligible=${permanentEligibleCount}`,
      `backup=${backupAvailable ? "yes" : "no"}`,
      issues[0] ? `issues=${issues.join("; ")}` : "issues=none",
    ].join(" | "),
    320,
  );
  return {
    backendKind,
    sessionId: params.sessionId,
    metadata,
    issues,
    recommendations,
    summary,
    contestedConceptCount,
    contestedEntityConflictCount,
    scopedAlternativeConceptCount,
    entityLinkedConceptCount,
    weakEvidenceWinnerCount,
    fragileWinnerCount,
    sourceTypeCounts,
    authoritativeSourceTypeCounts,
    supersededMemoryCount,
    permanentEligibleCount,
    staleMemoryCount,
    backupAvailable,
    recoveryRecommended,
  };
}
