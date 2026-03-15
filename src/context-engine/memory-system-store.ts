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

export type MemoryCompileResult = MemoryStoreSnapshot & {
  compilerNotes: string[];
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

type MemoryStorePaths = {
  rootDir: string;
  sessionsDir: string;
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

function clipText(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
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

function canonicalizeComparable(text: string): string {
  const normalized = normalizeComparable(text)
    .replace(/\bmemory system\b/g, "memory-system")
    .replace(/\bmemory system path\b/g, "memory-system-path")
    .replace(/\bpath for memory-system integration\b/g, "memory-system-path")
    .replace(/\bpermanent path\b/g, "permanent memory-system-path")
    .replace(/\bcarry forward\b/g, "carry-forward")
    .replace(/\blong term\b/g, "long-term")
    .replace(/\bnode tree\b/g, "node-tree")
    .replace(/\bshould be used\b/g, "use")
    .replace(/\bbe used\b/g, "use")
    .replace(/\bold workaround\b/g, "legacy-workaround");
  const tokens = normalized
    .split(/\s+/)
    .map((token) => singularizeToken(token))
    .filter((token) => token && !CANONICAL_STOP_WORDS.has(token));
  return tokens.join(" ").trim();
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
  if (
    category === "decision" ||
    /\b(must|required|always|never|constraint|preserve|keep|use|used|preferred)\b/i.test(text)
  ) {
    return "constraint";
  }
  if (
    category === "episode" ||
    /\b(fixed|resolved|preserved|restored|regression|outcome|result|workaround)\b/i.test(text)
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
  let familyText = params.text
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
  for (const candidate of entries) {
    if (
      candidate.conceptKey &&
      incoming.conceptKey &&
      candidate.conceptKey === incoming.conceptKey
    ) {
      return candidate;
    }
    if (candidate.category !== incoming.category) {
      continue;
    }
    if (candidate.ontologyKind !== incoming.ontologyKind) {
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
      aliasOverlap +
      artifactOverlap * 3 +
      scopeOverlap * 2 +
      runtimeTagOverlap * 2;
    if (
      score >= 6 &&
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
      sourceType: "user_stated",
      confidence: category === "decision" ? 0.95 : 0.78,
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
        scopeBonus(a) +
        adjudicationBonus(a);
      const bScore =
        computeOverlapScore(b.text, queryTokens) +
        b.strength * 10 +
        b.confidence * 4 +
        taskBonus(b) -
        statePenalty(b) -
        contradictionPenalty(b) +
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
): LongTermMemoryEntry[] {
  const byId = new Map(allEntries.map((entry) => [entry.id, entry]));
  const graphNodeById = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
  const expanded: LongTermMemoryEntry[] = [];
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
    expanded.push(related);
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
        expanded.push(artifactRelated);
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
    expanded.push(related);
    if (expanded.length >= MAX_PACKET_ITEMS) {
      break;
    }
  }

  return expanded;
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
    adjudications,
  ).slice(0, MAX_PACKET_ITEMS);
  if (longTerm.length > 0) {
    retrievalItems.push(
      ...longTerm.map((item) => {
        const adjudication = adjudications.find(
          (entry) => entry.conceptId === getEntryConceptId(item),
        );
        return {
          kind: "long-term" as const,
          text: formatMemoryWithState(item),
          reason: `concept=${getEntryConceptId(item).slice(0, 10)} relevance=${computeOverlapScore(item.text, queryTokens)} strength=${item.strength.toFixed(2)} confidence=${item.confidence.toFixed(2)}${adjudication ? ` adjudication=${adjudication.status}:${adjudication.resolutionKind}` : ""}${describeMemoryStateDowngrade(item).length > 0 ? ` downgraded=${describeMemoryStateDowngrade(item).join(",")}` : ""}`,
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
        text: formatMemoryWithState(item),
        reason: `concept=${getEntryConceptId(item).slice(0, 10)} graph expansion via ${item.relations[0]?.type ?? "linked"} relation${describeMemoryStateDowngrade(item).length > 0 ? ` downgraded=${describeMemoryStateDowngrade(item).join(",")}` : ""}`,
        memoryId: item.id,
        conceptId: getEntryConceptId(item),
      })),
    );
    accessedLongTermIds.push(...relatedExpansion.map((item) => item.id));
    accessedConceptIds.push(...relatedExpansion.map((item) => getEntryConceptId(item)));
    sections.push(
      `Related memory expansion:\n- ${relatedExpansion.map((item) => formatMemoryWithState(item)).join("\n- ")}`,
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
  const scopeNotes = [
    scopeContext.versionScope ? `version=${scopeContext.versionScope}` : "",
    scopeContext.installProfileScope ? `install-profile=${scopeContext.installProfileScope}` : "",
    scopeContext.customerScope ? `customer=${scopeContext.customerScope}` : "",
    scopeContext.environmentTags.length > 0 ? `env=${scopeContext.environmentTags.join(",")}` : "",
  ].filter(Boolean);
  if (scopeNotes.length > 0) {
    sections.push(`Scope notes:\n- ${scopeNotes.join("\n- ")}`);
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
  };
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
  for (const entry of params.entries) {
    const conceptId = getEntryConceptId(entry);
    const bucket = entriesByConcept.get(conceptId) ?? [];
    bucket.push(entry);
    entriesByConcept.set(conceptId, bucket);
    const familyKey = getEntryConceptFamilyKey(entry);
    const familyBucket = entriesByConceptFamily.get(familyKey) ?? [];
    familyBucket.push(entry);
    entriesByConceptFamily.set(familyKey, familyBucket);
  }
  const revisionsByConcept = new Map<string, PersistedMemoryRevision[]>();
  for (const revision of params.revisions) {
    const bucket = revisionsByConcept.get(revision.conceptId) ?? [];
    bucket.push(revision);
    revisionsByConcept.set(revision.conceptId, bucket);
  }

  const adjudications: PersistedMemoryAdjudication[] = [];
  for (const [conceptId, conceptEntries] of entriesByConcept.entries()) {
    const history = revisionsByConcept.get(conceptId) ?? [];
    const winner = conceptEntries.toSorted(
      (a, b) => b.confidence - a.confidence || b.updatedAt - a.updatedAt,
    )[0];
    const conceptFamilyKey = getEntryConceptFamilyKey(winner ?? conceptEntries[0]);
    const losingMemoryIds = conceptEntries
      .filter((entry) => entry.id !== winner?.id)
      .map((entry) => entry.id);
    const winnerScopeSignature = buildScopeSignature(winner ?? conceptEntries[0]);
    const alternativeConceptIds = uniqueIds(
      (entriesByConceptFamily.get(conceptFamilyKey) ?? [])
        .filter((entry) => getEntryConceptId(entry) !== conceptId)
        .filter((entry) => buildScopeSignature(entry) !== winnerScopeSignature)
        .map((entry) => getEntryConceptId(entry)),
    );
    let status: MemoryAdjudicationStatus = winner?.adjudicationStatus ?? "authoritative";
    let resolutionKind: PersistedMemoryAdjudication["resolutionKind"] = "winner";
    let rationale = "single authoritative concept state";
    if (history.some((revision) => revision.adjudicationStatus === "contested")) {
      status = "contested";
      resolutionKind = "contested";
      rationale = "concept revision history contains contested evidence";
    } else if (alternativeConceptIds.length > 0) {
      status = winner?.activeStatus === "superseded" ? "superseded" : "authoritative";
      resolutionKind = "scoped_alternative";
      rationale = "concept family includes scope-specific alternatives";
    } else if (conceptEntries.some((entry) => entry.activeStatus === "superseded")) {
      status = winner?.activeStatus === "superseded" ? "superseded" : status;
      resolutionKind = winner?.activeStatus === "superseded" ? "retired" : "winner";
      rationale = "concept includes superseded observations";
    } else if (history.some((revision) => revision.revisionKind === "updated")) {
      rationale = "concept resolved through updated revision history";
    } else if (history.some((revision) => revision.revisionKind === "narrowed")) {
      rationale = "concept resolved through narrowed revision history";
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
}): Promise<MemoryStoreSnapshot> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  if (params.backendKind === "sqlite-graph") {
    const { DatabaseSync } = requireNodeSqlite();
    await ensureStoreDirs(paths);
    const dbPath = path.join(paths.rootDir, SQLITE_STORE_FILENAME);
    const db = new DatabaseSync(dbPath);
    try {
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
            snapshot: {
              workingMemory: params.workingMemory,
              longTermMemory: params.longTermMemory,
              pendingSignificance: params.pendingSignificance,
              permanentMemory: params.permanentMemory,
              graph: params.graph,
            },
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
      db.prepare("DELETE FROM memory_revisions WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_adjudications WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM pending_memory WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM permanent_nodes WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_graph_nodes WHERE session_id = ?").run(params.sessionId);
      db.prepare("DELETE FROM memory_graph_edges WHERE session_id = ?").run(params.sessionId);

      const concepts = buildPersistedMemoryConcepts(params.longTermMemory);
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
        snapshot: {
          workingMemory: params.workingMemory,
          longTermMemory: params.longTermMemory,
          pendingSignificance: params.pendingSignificance,
          permanentMemory: params.permanentMemory,
          graph: params.graph,
        },
        previous: metadata,
      }) satisfies MemoryStoreMetadata,
    ),
    backend.writeJson(paths.workingFile, params.workingMemory),
    backend.writeJson(paths.longTermFile, params.longTermMemory),
    backend.writeJson(paths.pendingFile, params.pendingSignificance),
    backend.writeJson(paths.permanentTreeFile, params.permanentMemory),
    backend.writeJson(paths.graphFile, params.graph),
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
  return {
    version: 1,
    exportedAt: Date.now(),
    sessionId: params.sessionId,
    backendKind,
    metadata,
    snapshot,
  };
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
  const backendKind = params.backendKind ?? "fs-json";
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
  return loadMemoryStoreSnapshot({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind,
  });
}
