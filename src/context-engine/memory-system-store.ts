import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

export const MEMORY_SYSTEM_DIRNAME = ".openclaw-memory";
const SESSIONS_DIRNAME = "sessions";
const LONG_TERM_FILENAME = "long-term.json";
const PENDING_FILENAME = "pending-significance.json";
const PERMANENT_TREE_FILENAME = "permanent-tree.json";
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
  | "episode";

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
export type MemoryActiveStatus = "active" | "pending" | "superseded";

export type WorkingMemorySnapshot = {
  sessionId: string;
  updatedAt: number;
  rollingSummary: string;
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
  sourceType: MemorySourceType;
  confidence: number;
  importanceClass: MemoryImportanceClass;
  compressionState: MemoryCompressionState;
  activeStatus: MemoryActiveStatus;
  accessCount: number;
  lastAccessedAt?: number;
  contradictionCount: number;
  updatedAt: number;
};

export type PendingMemoryEntry = LongTermMemoryEntry & {
  pendingReason: string;
};

export type PermanentMemoryNode = {
  id: string;
  label: string;
  summary?: string;
  evidence: string[];
  updatedAt: number;
  children: PermanentMemoryNode[];
};

export type MemoryStoreSnapshot = {
  workingMemory: WorkingMemorySnapshot;
  longTermMemory: LongTermMemoryEntry[];
  pendingSignificance: PendingMemoryEntry[];
  permanentMemory: PermanentMemoryNode;
};

export type MemoryCompileResult = MemoryStoreSnapshot & {
  compilerNotes: string[];
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

function cloneLongTermEntry(entry: LongTermMemoryEntry): LongTermMemoryEntry {
  return {
    ...entry,
    evidence: [...entry.evidence],
  };
}

function clonePendingEntry(entry: PendingMemoryEntry): PendingMemoryEntry {
  return {
    ...entry,
    evidence: [...entry.evidence],
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

export function deriveLongTermMemoryCandidates(params: {
  messages: AgentMessage[];
  compactionSummary?: string;
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

    const entryBase: LongTermMemoryEntry = {
      id: `ltm-${Date.now().toString(36)}-${(durable.length + pending.length).toString(36)}`,
      category,
      text: normalized,
      strength: baseStrengthForCategory(category),
      evidence: [normalized],
      sourceType: "user_stated",
      confidence: category === "decision" ? 0.95 : 0.78,
      importanceClass: detectImportanceClass(category, normalized),
      compressionState: "active",
      activeStatus: "active",
      accessCount: 0,
      contradictionCount: 0,
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
    durable.push({
      id: `ltm-${Date.now().toString(36)}-compaction`,
      category: "episode",
      text: clipText(compactionSummary, 260),
      strength: 0.88,
      evidence: [clipText(compactionSummary, 180)],
      sourceType: "summary_derived",
      confidence: 0.84,
      importanceClass: "useful",
      compressionState: "compressed",
      activeStatus: "active",
      accessCount: 0,
      contradictionCount: 0,
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
    current.importanceClass =
      current.importanceClass === "critical" || item.importanceClass === "critical"
        ? "critical"
        : current.importanceClass === "useful" || item.importanceClass === "useful"
          ? "useful"
          : item.importanceClass;
    current.compressionState =
      item.compressionState === "compressed" ? item.compressionState : current.compressionState;
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

    if (age >= LATENT_AFTER_MS && entry.accessCount <= 1) {
      compressionState = "latent";
    } else if (age >= COMPRESS_AFTER_MS && entry.accessCount <= 2) {
      compressionState = "compressed";
    } else if (entry.accessCount > 0 || age < COMPRESS_AFTER_MS) {
      compressionState = "stable";
    }

    if (compressionState === "latent" && overlap >= 2) {
      compressionState = "stable";
      activeStatus = "active";
      strength = Math.min(1, strength + 0.05);
      confidence = Math.min(1, confidence + 0.03);
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
    updatedAt: now,
    evidence: [],
    children: [
      { id: "identity", label: "identity", updatedAt: now, evidence: [], children: [] },
      { id: "projects", label: "projects", updatedAt: now, evidence: [], children: [] },
      { id: "preferences", label: "preferences", updatedAt: now, evidence: [], children: [] },
      {
        id: "operating-rules",
        label: "operating-rules",
        updatedAt: now,
        evidence: [],
        children: [],
      },
      { id: "patterns", label: "patterns", updatedAt: now, evidence: [], children: [] },
    ],
  };
}

function ensureChildNode(parent: PermanentMemoryNode, label: string): PermanentMemoryNode {
  const existing = parent.children.find((child) => child.label === label);
  if (existing) {
    return existing;
  }
  const next: PermanentMemoryNode = {
    id: `${parent.id}/${label}`,
    label,
    updatedAt: Date.now(),
    evidence: [],
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
    case "entity":
      return ["identity"];
    case "episode":
      return ["projects", "current-bot", "episodes"];
    default:
      return ["operating-rules"];
  }
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
    for (const segment of branch) {
      cursor = ensureChildNode(cursor, segment);
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
      continue;
    }
    cursor.children.push({
      id: `${cursor.id}/${cursor.children.length + 1}`,
      label: clipText(candidate.text, 80),
      summary: candidate.text,
      evidence: dedupeTexts(candidate.evidence, MAX_WORKING_ITEMS),
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
}): MemoryCompileResult {
  const previous = params.previous;
  const nextWorkingMemory = buildWorkingMemorySnapshot({
    sessionId: params.sessionId,
    messages: params.messages,
    previous: previous?.workingMemory,
    compactionSummary: params.compactionSummary,
  });
  const candidates = deriveLongTermMemoryCandidates({
    messages: params.messages,
    compactionSummary: params.compactionSummary,
  });
  const mergedPending = mergePendingSignificance(
    previous?.pendingSignificance ?? [],
    candidates.pending,
  );
  const promotedPending = promotePendingMemories({
    pending: mergedPending,
    messages: params.messages,
  });
  const lifecycle = refreshLongTermLifecycle(
    mergeLongTermMemory(previous?.longTermMemory ?? [], [
      ...candidates.durable,
      ...promotedPending.durable,
    ]),
    params.messages,
  );
  const nextLongTerm = lifecycle.entries;
  const nextPending = promotedPending.remaining;
  const nextPermanent = mergePermanentMemoryTree(previous?.permanentMemory, [
    ...candidates.durable,
    ...promotedPending.durable,
  ]);

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
  if (lifecycle.reactivated.length > 0) {
    compilerNotes.push(`reactivated ${lifecycle.reactivated.length} latent or compressed memories`);
  }
  if (params.compactionSummary?.trim()) {
    compilerNotes.push("reconsolidated compaction summary");
  }
  if (nextWorkingMemory.activeGoals.length > 0) {
    compilerNotes.push("refreshed active-goal working set");
  }

  return {
    workingMemory: nextWorkingMemory,
    longTermMemory: nextLongTerm,
    pendingSignificance: nextPending,
    permanentMemory: nextPermanent,
    compilerNotes,
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
      contradictionPenalty(a);
    const bScore =
      computeOverlapScore(b.text, queryTokens) +
      b.strength * 10 +
      b.confidence * 4 +
      taskBonus(b) -
      statePenalty(b) -
      contradictionPenalty(b);
    return bScore - aScore;
  });
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

  const longTerm = rankLongTermEntries(snapshot.longTermMemory, queryTokens, taskMode).slice(
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

  const confidenceNotes = longTerm
    .slice(0, MAX_PACKET_ITEMS)
    .map(
      (item) =>
        `${item.id.slice(0, 8)} confidence=${item.confidence.toFixed(2)} source=${item.sourceType}`,
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
        }
      : entry,
  );
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
    activeFacts: [],
    activeGoals: [],
    openLoops: [],
    recentEvents: [],
    recentDecisions: [],
  });
  const longTermMemory = await readJsonFile<LongTermMemoryEntry[]>(paths.longTermFile, []);
  const pendingSignificance = await readJsonFile<PendingMemoryEntry[]>(paths.pendingFile, []);
  const permanentMemory = await readJsonFile<PermanentMemoryNode>(
    paths.permanentTreeFile,
    createPermanentRoot(),
  );
  return {
    workingMemory,
    longTermMemory,
    pendingSignificance,
    permanentMemory,
  };
}

export async function persistMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
  workingMemory: WorkingMemorySnapshot;
  longTermMemory: LongTermMemoryEntry[];
  pendingSignificance: PendingMemoryEntry[];
  permanentMemory: PermanentMemoryNode;
}): Promise<void> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  await ensureStoreDirs(paths);
  await Promise.all([
    writeJsonFile(paths.workingFile, params.workingMemory),
    writeJsonFile(paths.longTermFile, params.longTermMemory),
    writeJsonFile(paths.pendingFile, params.pendingSignificance),
    writeJsonFile(paths.permanentTreeFile, params.permanentMemory),
  ]);
}
