import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { MemoryCitationsMode } from "../../config/types.memory.js";
import {
  buildMemoryQuerySignature,
  getCachedMemoryContextPacket,
  getCachedMemoryStoreSnapshot,
  primeMemoryStoreSnapshot,
} from "../../context-engine/memory-system-cache.js";
import {
  loadMemoryStoreMetadata,
  loadMemoryStoreSnapshot,
  deleteIntegratedMemoryEntry,
  storeIntegratedMemoryCheckpoint,
  storeIntegratedMemoryEntry,
  retrieveMemoryContextPacket,
  MEMORY_SYSTEM_DIRNAME,
  type MemoryContextPacket,
  type MemoryCategory,
  type MemorySourceType,
  type MemoryRetrievalItem,
  type MemoryStoreBackendKind,
  type PermanentMemoryNode,
} from "../../context-engine/memory-system-store.js";
import { enqueueMemoryBackgroundRefresh } from "../../context-engine/memory-system-worker.js";
import { readBooleanParam } from "../../plugin-sdk/boolean-param.js";
import { parseAgentSessionKey } from "../../routing/session-key.js";
import { resolveAgentWorkspaceDir } from "../agent-scope.js";
import { resolveSessionAgentId } from "../agent-scope.js";
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

const MemoryCheckpointSchema = Type.Object({
  text: Type.String(),
  category: Type.Optional(Type.String()),
  sourceType: Type.Optional(Type.String()),
  pendingReason: Type.Optional(Type.String()),
});

const MemoryDeleteSchema = Type.Object({
  path: Type.String(),
  deleteArtifacts: Type.Optional(Type.Boolean()),
});

const MemorySchemaToolSchema = Type.Object({});

function resolveMemoryToolContext(options: { config?: OpenClawConfig; agentSessionKey?: string }) {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  return { cfg, agentId };
}

function resolveDurableMemorySessionId(agentId: string): string {
  return `memory:${agentId}`;
}

function createMemoryTool<
  TParameters extends
    | typeof MemorySearchSchema
    | typeof MemoryGetSchema
    | typeof MemoryStoreSchema
    | typeof MemoryCheckpointSchema
    | typeof MemoryDeleteSchema
    | typeof MemorySchemaToolSchema,
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
          const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
          const sessionId = resolveDurableMemorySessionId(agentId);
          const backendKind = resolveIntegratedMemoryBackendKind();
          const startedAt = Date.now();
          const {
            snapshot,
            metadata,
            cacheHit: snapshotCacheHit,
          } = await getCachedMemoryStoreSnapshot({
            workspaceDir,
            sessionId,
            backendKind,
            loadMetadata: () => loadMemoryStoreMetadata({ workspaceDir, sessionId, backendKind }),
            loadSnapshot: () => loadMemoryStoreSnapshot({ workspaceDir, sessionId, backendKind }),
          });
          const packetStartedAt = Date.now();
          const { packet, cacheHit: packetCacheHit } = getCachedMemoryContextPacket({
            workspaceDir,
            sessionId,
            backendKind,
            metadata,
            querySignature: buildMemoryQuerySignature({
              messages: [{ content: query } as AgentMessage],
            }),
            queryParams: {
              messages: [{ content: query } as AgentMessage],
            },
            buildPacket: () =>
              retrieveMemoryContextPacket(snapshot, {
                messages: [{ content: query } as AgentMessage],
              }),
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
            observability: {
              snapshotCacheHit,
              packetCacheHit,
              loadMs: packetStartedAt - startedAt,
              packetMs: Date.now() - packetStartedAt,
              snapshotVersion: metadata.snapshotVersion ?? 0,
              longTermMemoryVersion: metadata.longTermMemoryVersion ?? 0,
            },
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
          const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
          const sessionId = resolveDurableMemorySessionId(agentId);
          const backendKind = resolveIntegratedMemoryBackendKind();
          const { snapshot } = await getCachedMemoryStoreSnapshot({
            workspaceDir,
            sessionId,
            backendKind,
            loadMetadata: () => loadMemoryStoreMetadata({ workspaceDir, sessionId, backendKind }),
            loadSnapshot: () => loadMemoryStoreSnapshot({ workspaceDir, sessionId, backendKind }),
          });
          return jsonResult(
            await resolveIntegratedMemoryReadResult(snapshot, workspaceDir, relPath),
          );
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
          const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
          const sessionId = resolveDurableMemorySessionId(agentId);
          const backendKind = resolveIntegratedMemoryBackendKind();
          const plan = await prepareMemoryStorePlan({
            workspaceDir,
            sessionId,
            text,
            category,
            importanceClass,
            sourceType,
          });
          const storedEntries = [];
          for (const item of plan.entries) {
            storedEntries.push(
              await storeIntegratedMemoryEntry({
                workspaceDir,
                sessionId,
                backendKind,
                text: item.text,
                category: item.category,
                importanceClass: item.importanceClass,
                sourceType: item.sourceType,
                evidence: item.evidence,
                artifactRefs: item.artifactRefs,
                provenanceDetail: item.provenanceDetail,
              }),
            );
          }
          const stored = storedEntries[0];
          primeMemoryStoreSnapshot({
            workspaceDir,
            sessionId,
            backendKind,
            metadata: await loadMemoryStoreMetadata({ workspaceDir, sessionId, backendKind }),
            snapshot: await loadMemoryStoreSnapshot({ workspaceDir, sessionId, backendKind }),
          });
          enqueueMemoryBackgroundRefresh({
            workspaceDir,
            sessionId,
            backendKind,
            reason: "memory-store",
          });
          const path = `${MINDCLAW_MEMORY_PREFIX}long-term/${encodeURIComponent(stored.entry.id)}`;
          return jsonResult({
            stored: true,
            created: stored.created,
            provider: "mindclaw-memory",
            mode: "integrated-memory",
            path,
            paths: storedEntries.map(
              (entry) => `${MINDCLAW_MEMORY_PREFIX}long-term/${encodeURIComponent(entry.entry.id)}`,
            ),
            storedCount: storedEntries.length,
            rawArtifactPath: plan.rawArtifactPath,
            distilled: plan.distilled,
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

export function createMemorySchemaTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  return createMemoryTool({
    options,
    label: "Memory Schema",
    name: "memory_schema",
    description:
      "Inspect the integrated MindClaw memory schema before storing memory. Returns allowed categories, source types, importance classes, aliases, and guidance so you can choose valid labels without guessing.",
    parameters: MemorySchemaToolSchema,
    execute: () => async () => jsonResult(buildMemorySchemaDetails()),
  });
}

export function createMemoryCheckpointTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  return createMemoryTool({
    options,
    label: "Memory Checkpoint",
    name: "memory_checkpoint",
    description:
      "Store temporary checkpoint memory in the integrated MindClaw memory store without promoting it to durable long-term memory. Use for in-progress notes, tentative findings, temporary reminders, and short-lived working context that may need retrieval later.",
    parameters: MemoryCheckpointSchema,
    execute:
      ({ cfg, agentId }) =>
      async (_toolCallId, params) => {
        const text = readStringParam(params, "text", { required: true });
        const category = readMemoryCategoryParam(params, "category");
        const sourceType = readMemorySourceTypeParam(params, "sourceType");
        const pendingReason = readStringParam(params, "pendingReason");
        try {
          const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
          const sessionId = resolveDurableMemorySessionId(agentId);
          const backendKind = resolveIntegratedMemoryBackendKind();
          const stored = await storeIntegratedMemoryCheckpoint({
            workspaceDir,
            sessionId,
            backendKind,
            text,
            category,
            sourceType,
            pendingReason,
          });
          primeMemoryStoreSnapshot({
            workspaceDir,
            sessionId,
            backendKind,
            metadata: await loadMemoryStoreMetadata({ workspaceDir, sessionId, backendKind }),
            snapshot: await loadMemoryStoreSnapshot({ workspaceDir, sessionId, backendKind }),
          });
          enqueueMemoryBackgroundRefresh({
            workspaceDir,
            sessionId,
            backendKind,
            reason: "memory-checkpoint",
          });
          const path = `${MINDCLAW_MEMORY_PREFIX}pending/${encodeURIComponent(stored.entry.id)}`;
          return jsonResult({
            stored: true,
            created: stored.created,
            provider: "mindclaw-memory",
            mode: "integrated-memory",
            kind: "checkpoint",
            path,
            text: stored.entry.text,
            category: stored.entry.category,
            sourceType: stored.entry.sourceType,
            pendingReason: stored.entry.pendingReason,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResult({
            stored: false,
            disabled: true,
            kind: "checkpoint",
            error: message,
          });
        }
      },
  });
}

export function createMemoryDeleteTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  return createMemoryTool({
    options,
    label: "Memory Delete",
    name: "memory_delete",
    description:
      "Delete or forget a specific integrated MindClaw memory by pseudo-path. Use on paths returned by memory_search or memory_get when a memory is wrong, obsolete, or should be forgotten.",
    parameters: MemoryDeleteSchema,
    execute:
      ({ cfg, agentId }) =>
      async (_toolCallId, params) => {
        const relPath = readStringParam(params, "path", { required: true });
        const deleteArtifacts = readBooleanParam(params, "deleteArtifacts") ?? false;
        try {
          const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
          const sessionId = resolveDurableMemorySessionId(agentId);
          const backendKind = resolveIntegratedMemoryBackendKind();
          const result = await deleteIntegratedMemoryEntry({
            workspaceDir,
            sessionId,
            path: relPath,
            backendKind,
            deleteArtifacts,
          });
          primeMemoryStoreSnapshot({
            workspaceDir,
            sessionId,
            backendKind,
            metadata: await loadMemoryStoreMetadata({ workspaceDir, sessionId, backendKind }),
            snapshot: await loadMemoryStoreSnapshot({ workspaceDir, sessionId, backendKind }),
          });
          enqueueMemoryBackgroundRefresh({
            workspaceDir,
            sessionId,
            backendKind,
            reason: "memory-delete",
          });
          return jsonResult({
            deleted: result.deleted,
            provider: "mindclaw-memory",
            mode: "integrated-memory",
            path: relPath,
            deletedMemoryIds: result.deletedMemoryIds,
            deletedArtifactRefs: result.deletedArtifactRefs,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResult({
            deleted: false,
            disabled: true,
            path: relPath,
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

const MEMORY_CATEGORIES: MemoryCategory[] = [
  "fact",
  "preference",
  "decision",
  "strategy",
  "entity",
  "episode",
  "pattern",
];

const MEMORY_IMPORTANCE_CLASSES = ["critical", "useful"] as const;

const MEMORY_SOURCE_TYPE_ALIASES = {
  user_stated: ["user", "human"],
  direct_observation: ["observation", "observed"],
  summary_derived: ["summary", "training", "lesson", "course", "study"],
  system_inferred: ["inferred", "derived"],
} as const satisfies Record<MemorySourceType, readonly string[]>;

function buildMemorySchemaDetails() {
  return {
    mode: "integrated-memory",
    categories: MEMORY_CATEGORIES.map((id) => ({
      id,
      whenToUse: describeMemoryCategory(id),
    })),
    importanceClasses: MEMORY_IMPORTANCE_CLASSES.map((id) => ({
      id,
      whenToUse:
        id === "critical"
          ? "Use for high-value durable knowledge that should strongly influence future behavior."
          : "Use for normal durable knowledge worth remembering across sessions.",
    })),
    sourceTypes: (Object.keys(MEMORY_SOURCE_TYPE_ALIASES) as MemorySourceType[]).map((id) => ({
      id,
      aliases: [...MEMORY_SOURCE_TYPE_ALIASES[id]],
      whenToUse: describeMemorySourceType(id),
    })),
    checkpointUsage: {
      tool: "memory_checkpoint",
      whenToUse:
        "Use for temporary checkpoints, in-progress findings, working reminders, tentative conclusions, and other short-lived context that should stay retrievable without becoming durable long-term memory.",
      notes: [
        "Checkpoint memories are stored in pending significance, not durable long-term memory.",
        "Use memory_store only for durable knowledge that should survive as a long-term takeaway.",
      ],
    },
    guidance: [
      "If unsure, call memory_schema before memory_store or memory_checkpoint instead of guessing labels.",
      "Keep stored memories distilled; use memory_store for durable takeaways, not raw transcript dumps.",
      "Use memory_checkpoint for temporary notes, active checkpoints, and in-progress working context.",
      "Use memory_delete when a stored memory is wrong, obsolete, or should be forgotten.",
      "If the input is long training material, prefer sourceType=summary_derived.",
      "Use category=fact when in doubt unless the memory is clearly a preference, decision, strategy, entity, episode, or pattern.",
    ],
  };
}

function describeMemoryCategory(category: MemoryCategory): string {
  switch (category) {
    case "fact":
      return "Stable knowledge, instructions, or takeaways that are true enough to reuse later.";
    case "preference":
      return "User tastes, defaults, likes, dislikes, and recurring stylistic choices.";
    case "decision":
      return "A chosen direction, commitment, or resolved option that should affect future work.";
    case "strategy":
      return "An approach, plan, playbook, or procedural method worth reusing.";
    case "entity":
      return "A person, project, brand, product, course, or named thing with durable identity.";
    case "episode":
      return "A specific event or session outcome tied to a particular time or situation.";
    case "pattern":
      return "A recurring behavior, repeated issue, or cross-instance lesson.";
  }
}

function describeMemorySourceType(sourceType: MemorySourceType): string {
  switch (sourceType) {
    case "user_stated":
      return "The user directly said it or explicitly asked for it to be remembered.";
    case "direct_observation":
      return "The agent directly observed it from concrete evidence, tools, or workspace state.";
    case "summary_derived":
      return "The memory is distilled from longer source material such as a lesson, course, or summary.";
    case "system_inferred":
      return "The system inferred it from patterns or synthesis rather than direct statement alone.";
  }
}

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
  switch (normalized) {
    case "user_stated":
    case "user":
    case "human":
      return "user_stated";
    case "direct_observation":
    case "observation":
    case "observed":
      return "direct_observation";
    case "summary_derived":
    case "summary":
    case "training":
    case "lesson":
    case "course":
    case "study":
      return "summary_derived";
    case "system_inferred":
    case "inferred":
    case "derived":
      return "system_inferred";
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

async function resolveIntegratedMemoryReadResult(
  snapshot: Awaited<ReturnType<typeof loadMemoryStoreSnapshot>>,
  workspaceDir: string,
  relPath: string,
): Promise<{ path: string; text: string }> {
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
  if (kind === "artifacts") {
    const artifactText = await readIntegratedMemoryArtifact(workspaceDir, decodeURIComponent(key));
    return { path: relPath, text: artifactText };
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

type MemoryStorePlan = {
  distilled: boolean;
  rawArtifactPath?: string;
  entries: Array<{
    text: string;
    category?: MemoryCategory;
    importanceClass?: "critical" | "useful";
    sourceType?: MemorySourceType;
    evidence?: string[];
    artifactRefs?: string[];
    provenanceDetail?: string;
  }>;
};

async function prepareMemoryStorePlan(params: {
  workspaceDir: string;
  sessionId: string;
  text: string;
  category?: MemoryCategory;
  importanceClass?: "critical" | "useful";
  sourceType?: MemorySourceType;
}): Promise<MemoryStorePlan> {
  const normalized = params.text.trim();
  if (isLikelyDistilledMemoryText(normalized)) {
    return {
      distilled: true,
      entries: [
        {
          text: normalized,
          category: params.category,
          importanceClass: params.importanceClass,
          sourceType: params.sourceType,
        },
      ],
    };
  }

  const artifactPath = await writeIntegratedMemoryArtifact({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    text: normalized,
  });
  const artifactRef = `${MEMORY_SYSTEM_DIRNAME}/artifacts/${decodeURIComponent(artifactPath.split("/").at(-1) ?? "")}`;
  const distilledEntries = distillMemoryKnowledge(normalized, params.category);
  const effectiveEntries =
    distilledEntries.length > 0
      ? distilledEntries
      : [{ text: clipSnippet(normalized), category: params.category }];
  return {
    distilled: false,
    rawArtifactPath: artifactPath,
    entries: effectiveEntries.map((entry) => ({
      text: entry.text,
      category: entry.category ?? params.category,
      importanceClass: params.importanceClass,
      sourceType: params.sourceType ?? "summary_derived",
      evidence: [clipSnippet(normalized)],
      artifactRefs: [artifactRef],
      provenanceDetail: clipSnippet(normalized),
    })),
  };
}

function isLikelyDistilledMemoryText(text: string): boolean {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return true;
  }
  if (normalized.length <= 280) {
    return true;
  }
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLikeCount = lines.filter((line) => /^([-*•]|\d+[.)])\s+/.test(line)).length;
  if (lines.length > 1 && lines.length <= 8 && bulletLikeCount >= Math.ceil(lines.length / 2)) {
    return true;
  }
  const sentenceCount = normalized.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  return sentenceCount <= 3 && normalized.length <= 420;
}

function distillMemoryKnowledge(
  text: string,
  fallbackCategory?: MemoryCategory,
): Array<{ text: string; category?: MemoryCategory }> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title =
    lines.find((line) => !/^([-*•]|\d+[.)])\s+/.test(line) && line.length <= 90) ?? undefined;
  const bulletCandidates = lines
    .filter((line) => /^([-*•]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^([-*•]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length >= 18);
  const sentenceCandidates =
    bulletCandidates.length > 0
      ? bulletCandidates
      : normalized
          .split(/(?<=[.!?])\s+/)
          .map((line) => line.trim())
          .filter((line) => line.length >= 24);
  const unique = Array.from(
    new Set(sentenceCandidates.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean)),
  ).slice(0, 6);
  return unique.map((line) => {
    const compact = clipSnippet(line);
    const lower = compact.toLowerCase();
    const category =
      fallbackCategory ??
      (/\b(always|never|must|do not|should|required)\b/.test(lower)
        ? "decision"
        : /\b(step|sequence|process|before|after|first|then)\b/.test(lower)
          ? "pattern"
          : /\b(strategy|funnel|convert|offer|market|angle)\b/.test(lower)
            ? "strategy"
            : /\b(prefer|use|path|config|setting|workflow)\b/.test(lower)
              ? "pattern"
              : "fact");
    if (!title || compact.toLowerCase().includes(title.toLowerCase())) {
      return { text: compact, category };
    }
    return { text: clipSnippet(`${title}: ${compact}`), category };
  });
}

async function writeIntegratedMemoryArtifact(params: {
  workspaceDir: string;
  sessionId: string;
  text: string;
}): Promise<string> {
  const artifactsDir = path.join(params.workspaceDir, MEMORY_SYSTEM_DIRNAME, "artifacts");
  await fs.mkdir(artifactsDir, { recursive: true });
  const safeSessionId = params.sessionId.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const hash = createHash("sha256").update(params.text).digest("hex").slice(0, 16);
  const fileName = `${safeSessionId}-${hash}.md`;
  await fs.writeFile(path.join(artifactsDir, fileName), `${params.text.trim()}\n`, "utf8");
  return `${MINDCLAW_MEMORY_PREFIX}artifacts/${encodeURIComponent(fileName)}`;
}

async function readIntegratedMemoryArtifact(
  workspaceDir: string,
  fileName: string,
): Promise<string> {
  const artifactsDir = path.join(workspaceDir, MEMORY_SYSTEM_DIRNAME, "artifacts");
  const resolved = path.resolve(artifactsDir, fileName);
  if (!resolved.startsWith(path.resolve(artifactsDir) + path.sep)) {
    throw new Error(`unsupported integrated memory artifact path: ${fileName}`);
  }
  return fs.readFile(resolved, "utf8");
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
