import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ContextEngineRuntimeContext } from "./types.js";

export const MEMORY_SYSTEM_DIRNAME = ".openclaw-memory";
const SESSIONS_DIRNAME = "sessions";
const LONG_TERM_FILENAME = "long-term.json";
const PENDING_FILENAME = "pending-significance.json";
const PERMANENT_TREE_FILENAME = "permanent-tree.json";
const GRAPH_FILENAME = "memory-graph.json";
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
  | "supports";
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
  activeFacts: string[];
  activeGoals: string[];
  openLoops: string[];
  recentEvents: string[];
  recentDecisions: string[];
  lastCompactionSummary?: string;
};

export type LongTermMemoryEntry = {
  id: string;
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

export type MemoryCompileResult = MemoryStoreSnapshot & {
  compilerNotes: string[];
  review: MemoryReviewResult;
};

export type MemoryReviewResult = {
  carryForwardSummary?: string;
  archivedMemoryIds: string[];
  staleMemoryIds: string[];
  reviewedPendingIds: string[];
};

export type MemoryRetrievalItem = {
  kind: "working" | "long-term" | "pending" | "permanent" | "contradiction";
  text: string;
  reason: string;
  memoryId?: string;
};

export type MemoryContextPacket = {
  text?: string;
  taskMode: MemoryTaskMode;
  accessedLongTermIds: string[];
  sections: string[];
  retrievalItems: MemoryRetrievalItem[];
};

type MemoryStorePaths = {
  rootDir: string;
  sessionsDir: string;
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

function clipText(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function normalizeComparable(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
    evidence: [...entry.evidence],
    provenance: entry.provenance.map((item) => ({ ...item, derivedFromMemoryIds: [...(item.derivedFromMemoryIds ?? [])] })),
    relatedMemoryIds: [...entry.relatedMemoryIds],
    relations: (entry.relations ?? []).map((relation) => ({ ...relation })),
  };
}

function clonePendingEntry(entry: PendingMemoryEntry): PendingMemoryEntry {
  return {
    ...entry,
    evidence: [...entry.evidence],
    provenance: entry.provenance.map((item) => ({ ...item, derivedFromMemoryIds: [...(item.derivedFromMemoryIds ?? [])] })),
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
  return [...merged.values()].sort((a, b) => b.weight - a.weight).slice(0, MAX_WORKING_ITEMS);
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
}): WorkingMemorySnapshot {
  const lines = gatherRelevantLines(params.messages);
  const recentEvents = dedupeTexts(lines.slice(-MAX_WORKING_ITEMS).reverse()).reverse();
  const activeFacts = dedupeTexts(
    filterByPattern(
      lines,
      /\b(my|our|we are|i am|this bot|the bot|memory system|context|long[- ]term|permanent)\b/i,
    ).reverse(),
  ).reverse();
  const activeGoals = dedupeTexts(
    filterByPattern(
      lines,
      /\b(build|implement|need to|going to|plan to|want to|next|todo|integrate|adjust|revert|create)\b/i,
    ).reverse(),
  ).reverse();
  const openLoops = dedupeTexts(
    lines
      .filter((line) => /\?$/.test(line) || /\b(how|what|should|need to|next)\b/i.test(line))
      .reverse(),
  ).reverse();
  const recentDecisions = dedupeTexts(
    filterByPattern(
      lines,
      /\b(decided|will use|use .* as|revert|remove \.git|create a new git repo|slot|context-engine)\b/i,
    ).reverse(),
  ).reverse();
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

function detectTaskMode(messages: AgentMessage[], workingMemory?: WorkingMemorySnapshot): MemoryTaskMode {
  const corpus = [
    ...(messages.map((message) => extractMessageText(message)).filter(Boolean) as string[]),
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
  const match = text.match(/\bv\d+(?:\.\d+)+(?:-\d+)?\b/i) ?? text.match(/\bversion\s+([0-9]+(?:\.[0-9]+)+)\b/i);
  return match?.[0]?.trim();
}

function extractInstallProfileScope(text: string): string | undefined {
  const match = text.match(/\binstall profile\s+([a-z0-9._-]+)/i) ?? text.match(/\bprofile\s+([a-z0-9._-]+)/i);
  return match?.[1]?.trim();
}

function extractCustomerScope(text: string): string | undefined {
  const match =
    text.match(/\bcustomer\s+([a-z0-9._-]+)/i) ??
    text.match(/\buser\s+([a-z0-9._-]+)/i);
  return match?.[1]?.trim();
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
  const matches = text.match(/\b[\w./-]+\.(?:ts|tsx|js|json|md|yml|yaml|toml|lock)\b/g) ?? [];
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

function mergeScopeContexts(primary: MemoryScopeContext, secondary?: Partial<MemoryScopeContext>): MemoryScopeContext {
  return {
    versionScope: primary.versionScope ?? secondary?.versionScope,
    installProfileScope: primary.installProfileScope ?? secondary?.installProfileScope,
    customerScope: primary.customerScope ?? secondary?.customerScope,
    environmentTags: uniqueStrings([
      ...primary.environmentTags,
      ...(secondary?.environmentTags ?? []),
    ]),
    artifactRefs: uniqueStrings([
      ...primary.artifactRefs,
      ...(secondary?.artifactRefs ?? []),
    ]),
  };
}

function buildRuntimeScopeContext(params?: {
  runtimeContext?: ContextEngineRuntimeContext;
  sessionFile?: string;
}): MemoryScopeContext {
  const runtime = params?.runtimeContext;
  const stringValue = (key: string): string | undefined => {
    const value = runtime?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
        runtime?.bashElevated === true ? "bash-elevated" : "",
      ].filter(Boolean),
    ),
    artifactRefs: uniqueStrings([
      ...extractArtifactRefs(extraPrompt),
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

    const entryBase: LongTermMemoryEntry = {
      id: `ltm-${Date.now().toString(36)}-${(durable.length + pending.length).toString(36)}`,
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
    const scope = mergeScopeContexts(buildMemoryScopeContext(compactionSummary), params.scopeContext);
    durable.push({
      id: `ltm-${Date.now().toString(36)}-compaction`,
      category: "episode",
      text: clipText(compactionSummary, 260),
      strength: 0.88,
      evidence: [clipText(compactionSummary, 180)],
      provenance: [createProvenanceRecord("compaction", compactionSummary)],
      sourceType: "summary_derived",
      confidence: 0.84,
      importanceClass: "useful",
      compressionState: "compressed",
      activeStatus: "active",
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
    durable: mergeLongTermMemory([], durable),
    pending: mergePendingSignificance([], pending),
  };
}

export function mergeLongTermMemory(
  existing: LongTermMemoryEntry[],
  incoming: LongTermMemoryEntry[],
): LongTermMemoryEntry[] {
  const byText = new Map<string, LongTermMemoryEntry>();
  for (const item of existing) {
    byText.set(normalizeComparable(item.text), cloneLongTermEntry(item));
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
    current.strength = Math.min(1, Math.max(current.strength, item.strength) + 0.03);
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
    current.artifactRefs = uniqueStrings([...(current.artifactRefs ?? []), ...(item.artifactRefs ?? [])]);
    current.lastConfirmedAt = Date.now();
    current.trend = "rising";
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
  }
  return [...byText.values()]
    .sort((a, b) => b.strength - a.strength || b.updatedAt - a.updatedAt)
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
    current.artifactRefs = uniqueStrings([...(current.artifactRefs ?? []), ...(item.artifactRefs ?? [])]);
    current.lastConfirmedAt = Date.now();
  }
  return [...byText.values()]
    .sort((a, b) => b.strength - a.strength || b.updatedAt - a.updatedAt)
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
    counts.set(entry.id, 0);
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
    return {
      ...entry,
      contradictionCount,
      activeStatus:
        contradictionCount > 0 && entry.activeStatus !== "superseded" ? "pending" : entry.activeStatus,
      confidence:
        contradictionCount > 0 ? Math.max(0.35, entry.confidence - contradictionCount * 0.08) : entry.confidence,
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
      ...[item.text, ...lines].map((line) => computeOverlapScore(line, new Set(tokenize(item.text)))),
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

function selectPermanentBranch(category: MemoryCategory): string[] {
  switch (category) {
    case "preference":
      return ["preferences"];
    case "decision":
      return ["projects", "current-bot", "decisions"];
    case "strategy":
      return ["patterns", "strategies"];
    case "pattern":
      return ["patterns", "generalized"];
    case "entity":
      return ["identity"];
    case "episode":
      return ["projects", "current-bot", "episodes"];
    default:
      return ["operating-rules"];
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
      const key = shared.slice(0, 4).sort().join("-");
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
    const patternId = `pattern-${Date.now().toString(36)}-${patterns.length.toString(36)}`;
    patterns.push({
      id: patternId,
      category: "pattern",
      text: summary,
      strength: Math.min(
        0.96,
        deduped.reduce((max, entry) => Math.max(max, entry.strength), 0.78) + 0.04,
      ),
      evidence: dedupeTexts(deduped.flatMap((entry) => entry.evidence), MAX_WORKING_ITEMS),
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
    if (!/\b(replaced|replace|no longer|obsolete|superseded|fixed permanently|instead of)\b/i.test(newer.text)) {
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
      older.supersededById = newer.id;
      older.trend = "fading";
      older.provenance = mergeProvenance(older.provenance, [
        createProvenanceRecord("derived", `superseded by ${newer.text}`, [newer.id]),
      ]);
      older.relatedMemoryIds = uniqueIds([...older.relatedMemoryIds, newer.id]);
      older.relations = mergeRelations(older.relations, [
        { sourceMemoryId: older.id, type: "superseded_by", targetMemoryId: newer.id, weight: 0.96 },
      ]);
      newer.relations = mergeRelations(newer.relations, [
        { sourceMemoryId: newer.id, type: "confirmed_by", targetMemoryId: older.id, weight: 0.62 },
      ]);
      supersededCount += 1;
    }
  }

  return { entries: next, supersededCount };
}

function reviewMemoryState(params: {
  workingMemory: WorkingMemorySnapshot;
  longTermMemory: LongTermMemoryEntry[];
  pendingSignificance: PendingMemoryEntry[];
}): MemoryReviewResult {
  const archivedMemoryIds = params.longTermMemory
    .filter(
      (entry) =>
        ((entry.activeStatus === "superseded" && entry.compressionState === "latent") ||
          entry.activeStatus === "archived") &&
        entry.accessCount === 0,
    )
    .map((entry) => entry.id);
  const staleMemoryIds = params.longTermMemory
    .filter((entry) => entry.activeStatus === "stale" || entry.compressionState === "latent")
    .map((entry) => entry.id)
    .slice(0, MAX_WORKING_ITEMS);
  const reviewedPendingIds = params.pendingSignificance.map((entry) => entry.id).slice(0, MAX_WORKING_ITEMS);
  const carryForwardSummary = clipText(
    [
      params.workingMemory.rollingSummary,
      params.workingMemory.activeGoals[0] ? `Top goal: ${params.workingMemory.activeGoals[0]}` : "",
      params.workingMemory.openLoops[0] ? `Open loop: ${params.workingMemory.openLoops[0]}` : "",
      params.pendingSignificance[0] ? `Pending review: ${params.pendingSignificance[0].text}` : "",
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
  };
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
          type: "linked_to" as const,
          weight: 0.82,
          updatedAt: entry.updatedAt,
        },
        {
          from: artifactId,
          to: entry.id,
          type: "linked_to" as const,
          weight: 0.82,
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
    edges: [...uniqueEdges.values()].sort((a, b) => b.weight - a.weight),
    updatedAt: Date.now(),
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
    const branch = selectPermanentBranch(candidate.category);
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
      continue;
    }
    cursor.children.push({
      id: `${cursor.id}/${cursor.children.length + 1}`,
      label: clipText(candidate.text, 80),
      nodeType: selectPermanentNodeType(candidate.category),
      relationToParent: "derived_from",
      summary: candidate.text,
      evidence: dedupeTexts(candidate.evidence, MAX_WORKING_ITEMS),
      sourceMemoryIds: [candidate.id],
      confidence: candidate.confidence,
      activeStatus: candidate.activeStatus,
      updatedAt: Date.now(),
      children: [],
    });
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
  });
  const candidates = deriveLongTermMemoryCandidates({
    messages: params.messages,
    compactionSummary: params.compactionSummary,
    scopeContext: runtimeScope,
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
    ...promotedPending.durable,
  ]);
  const lifecycle = refreshLongTermLifecycle(
    mergeLongTermMemory(previous?.longTermMemory ?? [], [
      ...candidates.durable,
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
  });
  const reviewedWorkingMemory: WorkingMemorySnapshot = {
    ...nextWorkingMemory,
    carryForwardSummary: review.carryForwardSummary,
  };
  const nextPermanent = mergePermanentMemoryTree(previous?.permanentMemory, [
    ...candidates.durable,
    ...promotedPending.durable,
    ...patternCandidates,
  ]);
  const nextGraph = buildMemoryGraphSnapshot(nextLongTerm);

  const compilerNotes: string[] = [];
  if (candidates.durable.length > 0) {
    compilerNotes.push(`promoted ${candidates.durable.length} durable memories`);
  }
  if (candidates.pending.length > 0) {
    compilerNotes.push(`held ${candidates.pending.length} memories pending significance`);
  }
  if (promotedPending.durable.length > 0) {
    compilerNotes.push(`promoted ${promotedPending.durable.length} pending memories after recurrence`);
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

function rankLongTermEntries(
  entries: LongTermMemoryEntry[],
  queryTokens: Set<string>,
  taskMode: MemoryTaskMode,
  scopeContext?: MemoryScopeContext,
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
  return [...entries].sort((a, b) => {
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
    const contradictionPenalty = (entry: LongTermMemoryEntry): number => entry.contradictionCount * 1.2;
    const aScore =
      computeOverlapScore(a.text, queryTokens) +
      a.strength * 10 +
      a.confidence * 4 +
      taskBonus(a) -
      statePenalty(a) -
      contradictionPenalty(a) +
      scopeBonus(a);
    const bScore =
      computeOverlapScore(b.text, queryTokens) +
      b.strength * 10 +
      b.confidence * 4 +
      taskBonus(b) -
      statePenalty(b) -
      contradictionPenalty(b) +
      scopeBonus(b);
    return bScore - aScore;
  });
}

function expandRelatedMemories(
  selected: LongTermMemoryEntry[],
  allEntries: LongTermMemoryEntry[],
  taskMode: MemoryTaskMode,
  scopeContext?: MemoryScopeContext,
  graph?: MemoryGraphSnapshot,
): LongTermMemoryEntry[] {
  const byId = new Map(allEntries.map((entry) => [entry.id, entry]));
  const graphNodeById = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
  const expanded: LongTermMemoryEntry[] = [];
  const seen = new Set<string>(selected.map((entry) => entry.id));
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const allowedRelationTypes = (() => {
    switch (taskMode) {
      case "coding":
        return new Set<MemoryRelationType>(["derived_from", "relevant_to", "confirmed_by", "linked_to"]);
      case "support":
        return new Set<MemoryRelationType>(["contradicts", "confirmed_by", "relevant_to", "linked_to"]);
      case "planning":
        return new Set<MemoryRelationType>(["relevant_to", "superseded_by", "derived_from", "linked_to"]);
      case "debugging":
        return new Set<MemoryRelationType>(["contradicts", "confirmed_by", "derived_from", "linked_to"]);
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
      if (!related || related.activeStatus === "superseded") {
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
        if (!artifactRelated || artifactRelated.activeStatus === "superseded") {
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
    if (!related || related.activeStatus === "superseded") {
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
    ...((params?.messages ?? []).map((message) => extractMessageText(message)).filter(Boolean) as string[]),
  ].join(" ");
  const queryTokens = new Set(tokenize(currentText));
  const taskMode = detectTaskMode(params?.messages ?? [], snapshot.workingMemory);
  const scopeContext = buildMemoryScopeContext(currentText);
  const retrievalItems: MemoryRetrievalItem[] = [];
  const sections: string[] = [];
  const accessedLongTermIds: string[] = [];

  const workingItems = selectWorkingContext(snapshot);
  if (workingItems.length > 0) {
    retrievalItems.push(...workingItems);
    sections.push(
      `Current task summary:\n- ${workingItems.map((item) => item.text).join("\n- ")}`,
    );
  }

  const longTerm = rankLongTermEntries(snapshot.longTermMemory, queryTokens, taskMode, scopeContext).slice(
    0,
    MAX_PACKET_ITEMS,
  );
  if (longTerm.length > 0) {
    retrievalItems.push(
      ...longTerm.map((item) => ({
        kind: "long-term" as const,
        text: `[${item.category}] ${item.text}`,
        reason: `relevance=${computeOverlapScore(item.text, queryTokens)} strength=${item.strength.toFixed(2)} confidence=${item.confidence.toFixed(2)}`,
        memoryId: item.id,
      })),
    );
    accessedLongTermIds.push(...longTerm.map((item) => item.id));
    sections.push(
      `Relevant long-term facts and patterns:\n- ${longTerm.map((item) => `[${item.category}] ${item.text}`).join("\n- ")}`,
    );
  }

  const artifactEntries = longTerm
    .filter((item) => (item.artifactRefs ?? []).length > 0)
    .flatMap((item) => item.artifactRefs.map((ref) => `${ref} (${item.id.slice(0, 8)})`))
    .slice(0, MAX_PACKET_ITEMS);
  if (artifactEntries.length > 0) {
    sections.push(`Relevant files and artifacts:\n- ${artifactEntries.join("\n- ")}`);
  }
  const relatedExpansion = expandRelatedMemories(
    longTerm,
    snapshot.longTermMemory,
    taskMode,
    scopeContext,
    snapshot.graph,
  );
  if (relatedExpansion.length > 0) {
    retrievalItems.push(
      ...relatedExpansion.map((item) => ({
        kind: "long-term" as const,
        text: `[${item.category}] ${item.text}`,
        reason: `graph expansion via ${item.relations[0]?.type ?? "linked"} relation`,
        memoryId: item.id,
      })),
    );
    accessedLongTermIds.push(...relatedExpansion.map((item) => item.id));
    sections.push(
      `Related memory expansion:\n- ${relatedExpansion.map((item) => `[${item.category}] ${item.text}`).join("\n- ")}`,
    );
  }

  const pending = [...snapshot.pendingSignificance]
    .sort((a, b) => computeOverlapScore(b.text, queryTokens) - computeOverlapScore(a.text, queryTokens))
    .slice(0, MAX_PACKET_ITEMS);
  if (pending.length > 0) {
    retrievalItems.push(
      ...pending.map((item) => ({
        kind: "pending" as const,
        text: item.text,
        reason: `pending significance: ${item.pendingReason}`,
        memoryId: item.id,
      })),
    );
    sections.push(
      `Open uncertainty notes:\n- ${pending.map((item) => `${item.text} (${item.pendingReason})`).join("\n- ")}`,
    );
  }

  const permanent = flattenPermanentNodes(snapshot.permanentMemory)
    .filter((node) => node.summary)
    .sort(
      (a, b) =>
        computeOverlapScore(b.summary ?? "", queryTokens) -
        computeOverlapScore(a.summary ?? "", queryTokens),
    )
    .slice(0, MAX_PACKET_ITEMS)
    .map((node) => node.summary as string);
  if (permanent.length > 0) {
    retrievalItems.push(
      ...permanent.map((text) => ({
        kind: "permanent" as const,
        text,
        reason: "stable permanent node tree branch",
      })),
    );
    sections.push(`Relevant entities, constraints, and structural memory:\n- ${permanent.join("\n- ")}`);
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
      review.carryForwardSummary ? "sleep review refreshed carry-forward summary" : "sleep review completed",
      review.archivedMemoryIds.length > 0
        ? `sleep review archived ${review.archivedMemoryIds.length} memories`
        : "sleep review found no archival candidates",
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
  return {
    ...entry,
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
    pendingReason: entry.pendingReason ?? "needs recurrence or stronger confirmation before durable promotion",
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

export async function loadMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
}): Promise<MemoryStoreSnapshot> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  await ensureStoreDirs(paths);
  const workingMemory = await readJsonFile<WorkingMemorySnapshot>(paths.workingFile, {
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
  const longTermMemory = (await readJsonFile<LongTermMemoryEntry[]>(paths.longTermFile, [])).map(
    (entry) => sanitizeLongTermEntry(entry),
  );
  const pendingSignificance = await readJsonFile<PendingMemoryEntry[]>(paths.pendingFile, []);
  const permanentMemory = sanitizePermanentNode(
    await readJsonFile<PermanentMemoryNode>(
    paths.permanentTreeFile,
    createPermanentRoot(),
    ),
  );
  const graph = sanitizeGraphSnapshot(
    await readJsonFile<MemoryGraphSnapshot>(paths.graphFile, createEmptyGraph()),
  );
  return {
    workingMemory,
    longTermMemory,
    pendingSignificance: pendingSignificance.map((entry) => sanitizePendingEntry(entry)),
    permanentMemory,
    graph,
  };
}

export async function persistMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
  workingMemory: WorkingMemorySnapshot;
  longTermMemory: LongTermMemoryEntry[];
  pendingSignificance: PendingMemoryEntry[];
  permanentMemory: PermanentMemoryNode;
  graph: MemoryGraphSnapshot;
}): Promise<void> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  await ensureStoreDirs(paths);
  await Promise.all([
    writeJsonFile(paths.workingFile, params.workingMemory),
    writeJsonFile(paths.longTermFile, params.longTermMemory),
    writeJsonFile(paths.pendingFile, params.pendingSignificance),
    writeJsonFile(paths.permanentTreeFile, params.permanentMemory),
    writeJsonFile(paths.graphFile, params.graph),
  ]);
}
