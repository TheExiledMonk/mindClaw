import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

export const MEMORY_SYSTEM_DIRNAME = ".openclaw-memory";
const SESSIONS_DIRNAME = "sessions";
const LONG_TERM_FILENAME = "long-term.json";
const PERMANENT_TREE_FILENAME = "permanent-tree.json";
const MAX_WORKING_ITEMS = 6;
const MAX_LONG_TERM_ITEMS = 48;
const MAX_PACKET_ITEMS = 4;

export type MemoryCategory =
  | "fact"
  | "preference"
  | "decision"
  | "strategy"
  | "entity"
  | "episode";

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
  updatedAt: number;
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
  permanentMemory: PermanentMemoryNode;
};

export type MemoryCompileResult = MemoryStoreSnapshot & {
  compilerNotes: string[];
};

type MemoryStorePaths = {
  rootDir: string;
  sessionsDir: string;
  workingFile: string;
  longTermFile: string;
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
  if (/\b(memory system|context compression|node tree|context-engine|long[- ]term|permanent)\b/i.test(text)) {
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

export function deriveLongTermMemoryCandidates(params: {
  messages: AgentMessage[];
  compactionSummary?: string;
}): LongTermMemoryEntry[] {
  const candidates: LongTermMemoryEntry[] = [];
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
    candidates.push({
      id: `ltm-${Date.now().toString(36)}-${candidates.length.toString(36)}`,
      category,
      text: normalized,
      strength: baseStrengthForCategory(category),
      evidence: [normalized],
      updatedAt: Date.now(),
    });
  }
  const compactionSummary = params.compactionSummary?.trim();
  if (compactionSummary) {
    candidates.push({
      id: `ltm-${Date.now().toString(36)}-compaction`,
      category: "episode",
      text: clipText(compactionSummary, 260),
      strength: 0.88,
      evidence: [clipText(compactionSummary, 180)],
      updatedAt: Date.now(),
    });
  }
  return mergeLongTermMemory([], candidates);
}

export function mergeLongTermMemory(
  existing: LongTermMemoryEntry[],
  incoming: LongTermMemoryEntry[],
): LongTermMemoryEntry[] {
  const byText = new Map<string, LongTermMemoryEntry>();
  for (const item of existing) {
    byText.set(normalizeComparable(item.text), { ...item, evidence: [...item.evidence] });
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
    current.evidence = dedupeTexts([...current.evidence, ...item.evidence], MAX_WORKING_ITEMS);
    if (baseStrengthForCategory(item.category) > baseStrengthForCategory(current.category)) {
      current.category = item.category;
    }
  }
  return [...byText.values()]
    .sort((a, b) => b.strength - a.strength || b.updatedAt - a.updatedAt)
    .slice(0, MAX_LONG_TERM_ITEMS);
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
    case "strategy":
      return ["projects", "current-bot"];
    case "entity":
      return ["identity"];
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
      (child) =>
        normalizeComparable(child.summary ?? child.label) === leafKey ||
        normalizeComparable(child.label) === leafKey,
    );
    if (existing) {
      existing.summary = candidate.text;
      existing.updatedAt = Date.now();
      existing.evidence = dedupeTexts([...existing.evidence, ...candidate.evidence], MAX_WORKING_ITEMS);
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
  const nextLongTerm = mergeLongTermMemory(previous?.longTermMemory ?? [], candidates);
  const nextPermanent = mergePermanentMemoryTree(previous?.permanentMemory, candidates);

  const compilerNotes: string[] = [];
  if (candidates.length > 0) {
    compilerNotes.push(`promoted ${candidates.length} durable memories`);
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
    permanentMemory: nextPermanent,
    compilerNotes,
  };
}

function tokenize(text: string): string[] {
  return normalizeComparable(text)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
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

export function buildMemoryContextPacket(snapshot: MemoryStoreSnapshot): string | undefined {
  const currentText = [
    snapshot.workingMemory.rollingSummary,
    ...snapshot.workingMemory.activeGoals,
    ...snapshot.workingMemory.recentEvents,
  ].join(" ");
  const queryTokens = new Set(tokenize(currentText));

  const longTerm = [...snapshot.longTermMemory]
    .sort(
      (a, b) =>
        computeOverlapScore(b.text, queryTokens) + b.strength * 10 -
        (computeOverlapScore(a.text, queryTokens) + a.strength * 10),
    )
    .slice(0, MAX_PACKET_ITEMS);

  const permanent = flattenPermanentNodes(snapshot.permanentMemory)
    .filter((node) => node.summary)
    .sort(
      (a, b) =>
        computeOverlapScore(b.summary ?? "", queryTokens) -
        computeOverlapScore(a.summary ?? "", queryTokens),
    )
    .slice(0, MAX_PACKET_ITEMS)
    .map((node) => node.summary as string);

  const sections: string[] = [];
  if (snapshot.workingMemory.rollingSummary) {
    sections.push(`Short-term summary: ${snapshot.workingMemory.rollingSummary}`);
  }
  if (snapshot.workingMemory.activeGoals.length > 0) {
    sections.push(`Active goals:\n- ${snapshot.workingMemory.activeGoals.join("\n- ")}`);
  }
  if (snapshot.workingMemory.openLoops.length > 0) {
    sections.push(`Open loops:\n- ${snapshot.workingMemory.openLoops.join("\n- ")}`);
  }
  if (longTerm.length > 0) {
    sections.push(
      `Long-term memory:\n- ${longTerm.map((item) => `[${item.category}] ${item.text}`).join("\n- ")}`,
    );
  }
  if (permanent.length > 0) {
    sections.push(`Permanent memory tree:\n- ${permanent.join("\n- ")}`);
  }
  if (snapshot.workingMemory.lastCompactionSummary) {
    sections.push(`Last compaction summary: ${clipText(snapshot.workingMemory.lastCompactionSummary, 220)}`);
  }
  if (sections.length === 0) {
    return undefined;
  }
  return [
    "Integrated memory packet",
    "Memory hierarchy: short-term context is freshest, long-term memory is distilled, permanent memory is structural. Prefer the current transcript when memories conflict, and treat stale memory as update-needed rather than authoritative.",
    ...sections,
  ].join("\n\n");
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
  const permanentMemory = await readJsonFile<PermanentMemoryNode>(
    paths.permanentTreeFile,
    createPermanentRoot(),
  );
  return {
    workingMemory,
    longTermMemory,
    permanentMemory,
  };
}

export async function persistMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
  workingMemory: WorkingMemorySnapshot;
  longTermMemory: LongTermMemoryEntry[];
  permanentMemory: PermanentMemoryNode;
}): Promise<void> {
  const paths = resolveStorePaths(params.workspaceDir, params.sessionId);
  await ensureStoreDirs(paths);
  await Promise.all([
    writeJsonFile(paths.workingFile, params.workingMemory),
    writeJsonFile(paths.longTermFile, params.longTermMemory),
    writeJsonFile(paths.permanentTreeFile, params.permanentMemory),
  ]);
}
