import { createHash } from "node:crypto";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { MemoryCitationsMode } from "../../config/types.memory.js";
import {
  loadMemoryStoreSnapshot,
  storeIntegratedMemoryEntry,
  retrieveMemoryContextPacket,
  type MemoryContextPacket,
  type MemoryCategory,
  type MemorySourceType,
  type MemoryRetrievalItem,
  type MemoryStoreBackendKind,
  type PermanentMemoryNode,
} from "../../context-engine/memory-system-store.js";
import { parseAgentSessionKey } from "../../routing/session-key.js";
import { resolveAgentWorkspaceDir } from "../agent-scope.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { resolveMemorySearchConfig } from "../memory-search.js";
import type { AnyAgentTool } from "./common.js";
import { ToolInputError, jsonResult, readNumberParam, readStringParam } from "./common.js";

const MemorySearchSchema = Type.Object({
  query: Type.String(),
  maxResults: Type.Optional(Type.Number()),
  minScore: Type.Optional(Type.Number()),
});

const MemoryGetSchema = Type.Object({
  path: Type.String(),
  from: Type.Optional(Type.Number()),
  lines: Type.Optional(Type.Number()),
});

const MemoryStoreSchema = Type.Object({
  text: Type.String(),
  category: Type.Optional(Type.String()),
  importanceClass: Type.Optional(Type.String()),
  sourceType: Type.Optional(Type.String()),
});

function resolveMemoryToolContext(options: { config?: OpenClawConfig; agentSessionKey?: string }) {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  if (!resolveMemorySearchConfig(cfg, agentId)) {
    return null;
  }
  return { cfg, agentId };
}

function createMemoryTool<
  TParameters extends typeof MemorySearchSchema | typeof MemoryGetSchema | typeof MemoryStoreSchema,
>(params: {
  options: {
    config?: OpenClawConfig;
    agentSessionKey?: string;
  };
  label: string;
  name: string;
  description: string;
  parameters: TParameters;
  execute: (ctx: { cfg: OpenClawConfig; agentId: string }) => AnyAgentTool["execute"];
}): AnyAgentTool | null {
  const ctx = resolveMemoryToolContext(params.options);
  if (!ctx) {
    return null;
  }
  return {
    label: params.label,
    name: params.name,
    description: params.description,
    parameters: params.parameters,
    execute: params.execute(ctx),
  };
}

export function createMemorySearchTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  return createMemoryTool({
    options,
    label: "Memory Search",
    name: "memory_search",
    description:
      "Mandatory recall step: semantically search the integrated MindClaw memory store before answering questions about prior work, decisions, dates, people, preferences, or todos; returns top recalled snippets with stable pseudo-paths for follow-up memory_get reads. If response has disabled=true, integrated memory retrieval is unavailable and should be surfaced to the user.",
    parameters: MemorySearchSchema,
    execute:
      ({ cfg, agentId }) =>
      async (_toolCallId, params) => {
        const query = readStringParam(params, "query", { required: true });
        const maxResults = readNumberParam(params, "maxResults");
        const minScore = readNumberParam(params, "minScore");
        try {
          const snapshot = await loadMemoryStoreSnapshot({
            workspaceDir: resolveAgentWorkspaceDir(cfg, agentId),
            sessionId: options.agentSessionKey ?? agentId,
            backendKind: resolveIntegratedMemoryBackendKind(),
          });
          const packet = retrieveMemoryContextPacket(snapshot, {
            messages: [{ content: query } as AgentMessage],
          });
          const citationsMode = resolveMemoryCitationsMode(cfg);
          const includeCitations = shouldIncludeCitations({
            mode: citationsMode,
            sessionKey: options.agentSessionKey,
          });
          const rawResults = buildIntegratedMemorySearchResults(packet, {
            query,
            maxResults,
            minScore,
          });
          const results = decorateCitations(rawResults, includeCitations);
          return jsonResult({
            results,
            provider: "mindclaw-memory",
            model: "integrated-memory",
            fallback: false,
            citations: citationsMode,
            mode: "integrated-memory",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResult(buildMemorySearchUnavailableResult(message));
        }
      },
  });
}

export function createMemoryGetTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  return createMemoryTool({
    options,
    label: "Memory Get",
    name: "memory_get",
    description:
      "Safe snippet read from the integrated MindClaw memory store using a pseudo-path returned by memory_search; use after memory_search to pull only the needed memory text and keep context small.",
    parameters: MemoryGetSchema,
    execute:
      ({ cfg, agentId }) =>
      async (_toolCallId, params) => {
        const relPath = readStringParam(params, "path", { required: true });
        try {
          const snapshot = await loadMemoryStoreSnapshot({
            workspaceDir: resolveAgentWorkspaceDir(cfg, agentId),
            sessionId: options.agentSessionKey ?? agentId,
            backendKind: resolveIntegratedMemoryBackendKind(),
          });
          return jsonResult(resolveIntegratedMemoryReadResult(snapshot, relPath));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResult({ path: relPath, text: "", disabled: true, error: message });
        }
      },
  });
}

export function createMemoryStoreTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  return createMemoryTool({
    options,
    label: "Memory Store",
    name: "memory_store",
    description:
      "Persist a durable note directly into the integrated MindClaw memory store. Use when the user explicitly asks you to remember something, or when a stable takeaway should survive future sessions. Do not write MEMORY.md or memory/*.md.",
    parameters: MemoryStoreSchema,
    execute:
      ({ cfg, agentId }) =>
      async (_toolCallId, params) => {
        const text = readStringParam(params, "text", { required: true });
        const category = readMemoryCategoryParam(params, "category");
        const importanceClass = readImportanceClassParam(params, "importanceClass");
        const sourceType = readMemorySourceTypeParam(params, "sourceType");
        try {
          const stored = await storeIntegratedMemoryEntry({
            workspaceDir: resolveAgentWorkspaceDir(cfg, agentId),
            sessionId: options.agentSessionKey ?? agentId,
            backendKind: resolveIntegratedMemoryBackendKind(),
            text,
            category,
            importanceClass,
            sourceType,
          });
          const path = `${MINDCLAW_MEMORY_PREFIX}long-term/${encodeURIComponent(stored.entry.id)}`;
          return jsonResult({
            stored: true,
            created: stored.created,
            provider: "mindclaw-memory",
            mode: "integrated-memory",
            path,
            text: stored.entry.text,
            category: stored.entry.category,
            importanceClass: stored.entry.importanceClass,
            sourceType: stored.entry.sourceType,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResult({
            stored: false,
            disabled: true,
            error: message,
          });
        }
      },
  });
}

function resolveMemoryCitationsMode(cfg: OpenClawConfig): MemoryCitationsMode {
  const mode = cfg.memory?.citations;
  if (mode === "on" || mode === "off" || mode === "auto") {
    return mode;
  }
  return "auto";
}

type IntegratedMemorySearchResult = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: "memory";
  citation?: string;
};

function decorateCitations(
  results: IntegratedMemorySearchResult[],
  include: boolean,
): IntegratedMemorySearchResult[] {
  if (!include) {
    return results.map((entry) => ({ ...entry, citation: undefined }));
  }
  return results.map((entry) => {
    const citation = formatCitation(entry);
    const snippet = `${entry.snippet.trim()}\n\nSource: ${citation}`;
    return { ...entry, citation, snippet };
  });
}

function formatCitation(entry: IntegratedMemorySearchResult): string {
  const lineRange =
    entry.startLine === entry.endLine
      ? `#L${entry.startLine}`
      : `#L${entry.startLine}-L${entry.endLine}`;
  return `${entry.path}${lineRange}`;
}

const MINDCLAW_MEMORY_PREFIX = "mindclaw_memory://";

function readMemoryCategoryParam(
  params: Record<string, unknown>,
  key: string,
): MemoryCategory | undefined {
  const value = readStringParam(params, key);
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "fact" ||
    normalized === "preference" ||
    normalized === "decision" ||
    normalized === "strategy" ||
    normalized === "entity" ||
    normalized === "episode" ||
    normalized === "pattern"
  ) {
    return normalized;
  }
  throw new ToolInputError(`unsupported memory category: ${value}`);
}

function readImportanceClassParam(
  params: Record<string, unknown>,
  key: string,
): "critical" | "useful" | undefined {
  const value = readStringParam(params, key);
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "critical" || normalized === "useful") {
    return normalized;
  }
  throw new ToolInputError(`unsupported importance class: ${value}`);
}

function readMemorySourceTypeParam(
  params: Record<string, unknown>,
  key: string,
): MemorySourceType | undefined {
  const value = readStringParam(params, key);
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "user_stated" ||
    normalized === "direct_observation" ||
    normalized === "summary_derived" ||
    normalized === "system_inferred"
  ) {
    return normalized;
  }
  throw new ToolInputError(`unsupported memory source type: ${value}`);
}

function resolveIntegratedMemoryBackendKind(): MemoryStoreBackendKind | undefined {
  const envValue = process.env.OPENCLAW_MEMORY_STORE_BACKEND;
  return envValue === "fs-json" || envValue === "sqlite-doc" || envValue === "sqlite-graph"
    ? envValue
    : undefined;
}

function buildIntegratedMemorySearchResults(
  packet: MemoryContextPacket,
  params: {
    query: string;
    maxResults?: number;
    minScore?: number;
  },
): IntegratedMemorySearchResult[] {
  const queryTokens = tokenizeMemoryQuery(params.query);
  const minScore = params.minScore ?? 0.1;
  const maxResults = Math.max(1, Math.floor(params.maxResults ?? 6));
  const candidates = packet.retrievalItems
    .filter(
      (item) =>
        (item.kind === "long-term" || item.kind === "pending" || item.kind === "permanent") &&
        (item.memoryId || item.kind === "permanent"),
    )
    .map((item) => {
      const score = scoreMemoryRetrievalItem(item, queryTokens);
      return { item, score };
    })
    .filter(({ score }) => score >= minScore)
    .toSorted((a, b) => b.score - a.score);

  const deduped = new Map<string, IntegratedMemorySearchResult>();
  for (const { item, score } of candidates) {
    const path = buildIntegratedMemoryPath(item);
    if (!path || deduped.has(path)) {
      continue;
    }
    deduped.set(path, {
      path,
      startLine: 1,
      endLine: 1,
      score,
      snippet: clipSnippet(item.text),
      source: "memory",
    });
    if (deduped.size >= maxResults) {
      break;
    }
  }
  return [...deduped.values()];
}

function tokenizeMemoryQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  );
}

function scoreMemoryRetrievalItem(item: MemoryRetrievalItem, queryTokens: string[]): number {
  if (queryTokens.length === 0) {
    return 0;
  }
  const haystack = `${item.text} ${item.reason}`.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      matches += 1;
    }
  }
  if (matches === 0) {
    return 0;
  }
  const base = matches / queryTokens.length;
  const kindBoost =
    item.kind === "long-term"
      ? 0.2
      : item.kind === "pending"
        ? 0.1
        : item.kind === "permanent"
          ? 0.05
          : 0;
  return Math.min(1, base + kindBoost);
}

function clipSnippet(text: string): string {
  return text.length > 700 ? `${text.slice(0, 697)}...` : text;
}

function buildIntegratedMemoryPath(item: MemoryRetrievalItem): string | null {
  if (item.kind === "long-term" && item.memoryId) {
    return `${MINDCLAW_MEMORY_PREFIX}long-term/${encodeURIComponent(item.memoryId)}`;
  }
  if (item.kind === "pending" && item.memoryId) {
    return `${MINDCLAW_MEMORY_PREFIX}pending/${encodeURIComponent(item.memoryId)}`;
  }
  if (item.kind === "permanent") {
    return `${MINDCLAW_MEMORY_PREFIX}permanent/${hashMemoryText(item.text)}`;
  }
  return null;
}

function hashMemoryText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function resolveIntegratedMemoryReadResult(
  snapshot: Awaited<ReturnType<typeof loadMemoryStoreSnapshot>>,
  relPath: string,
): { path: string; text: string } {
  if (!relPath.startsWith(MINDCLAW_MEMORY_PREFIX)) {
    throw new Error(
      `unsupported memory path: ${relPath}. Use a pseudo-path returned by memory_search from the integrated memory store.`,
    );
  }
  const [, remainder] = relPath.split(MINDCLAW_MEMORY_PREFIX);
  const [kind, ...rest] = remainder.split("/");
  const key = rest.join("/");
  if (kind === "long-term") {
    const id = decodeURIComponent(key);
    const entry = snapshot.longTermMemory.find((item) => item.id === id);
    if (!entry) {
      return { path: relPath, text: "" };
    }
    return { path: relPath, text: entry.text };
  }
  if (kind === "pending") {
    const id = decodeURIComponent(key);
    const entry = snapshot.pendingSignificance.find((item) => item.id === id);
    if (!entry) {
      return { path: relPath, text: "" };
    }
    return { path: relPath, text: entry.text };
  }
  if (kind === "permanent") {
    const node = findPermanentNodeByHash(snapshot.permanentMemory, key);
    return { path: relPath, text: node?.summary ?? "" };
  }
  throw new Error(`unsupported integrated memory path kind: ${kind}`);
}

function findPermanentNodeByHash(
  node: PermanentMemoryNode,
  targetHash: string,
): PermanentMemoryNode | undefined {
  if (node.summary && hashMemoryText(node.summary) === targetHash) {
    return node;
  }
  for (const child of node.children) {
    const found = findPermanentNodeByHash(child, targetHash);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function buildMemorySearchUnavailableResult(error: string | undefined) {
  const reason = (error ?? "memory search unavailable").trim() || "memory search unavailable";
  const isQuotaError = /insufficient_quota|quota|429/.test(reason.toLowerCase());
  const warning = isQuotaError
    ? "Memory search is unavailable because the embedding provider quota is exhausted."
    : "Memory search is unavailable due to an embedding/provider error.";
  const action = isQuotaError
    ? "Top up or switch embedding provider, then retry memory_search."
    : "Check embedding provider configuration and retry memory_search.";
  return {
    results: [],
    disabled: true,
    unavailable: true,
    error: reason,
    warning,
    action,
  };
}

function shouldIncludeCitations(params: {
  mode: MemoryCitationsMode;
  sessionKey?: string;
}): boolean {
  if (params.mode === "on") {
    return true;
  }
  if (params.mode === "off") {
    return false;
  }
  // auto: show citations in direct chats; suppress in groups/channels by default.
  const chatType = deriveChatTypeFromSessionKey(params.sessionKey);
  return chatType === "direct";
}

function deriveChatTypeFromSessionKey(sessionKey?: string): "direct" | "group" | "channel" {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed?.rest) {
    return "direct";
  }
  const tokens = new Set(parsed.rest.toLowerCase().split(":").filter(Boolean));
  if (tokens.has("channel")) {
    return "channel";
  }
  if (tokens.has("group")) {
    return "group";
  }
  return "direct";
}
