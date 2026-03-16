import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { sanitizeToolUseResultPairing } from "../agents/session-transcript-repair.js";
import { loadConfig } from "../config/config.js";
import { LegacyContextEngine } from "./legacy.js";
import {
  compileMemoryState,
  loadMemoryStoreSnapshot,
  type MemoryStoreBackendKind,
  persistMemoryStoreSnapshot,
  retrieveMemoryContextPacket,
  runMemorySleepReview,
  touchRetrievedMemories,
} from "./memory-system-store.js";
import { registerContextEngine } from "./registry.js";
import type {
  AssembleResult,
  BootstrapResult,
  CompactResult,
  ContextEngine,
  ContextEngineInfo,
  ContextEngineRuntimeContext,
  IngestBatchResult,
  IngestResult,
  ReviewResult,
} from "./types.js";

type WorkingSetPolicy = {
  retainLatestMessages: number;
  compactAfterMessages: number;
  importantItemsMax: number;
  includeRelevantMemory: boolean;
};

const DEFAULT_WORKING_SET_POLICY: WorkingSetPolicy = {
  retainLatestMessages: 8,
  compactAfterMessages: 18,
  importantItemsMax: 12,
  includeRelevantMemory: true,
};

function resolveWorkspaceDir(runtimeContext?: ContextEngineRuntimeContext): string {
  const workspaceDir = runtimeContext?.workspaceDir;
  if (typeof workspaceDir === "string" && workspaceDir.trim()) {
    return workspaceDir;
  }
  return process.cwd();
}

function resolveMemoryStoreBackendKind(
  runtimeContext?: ContextEngineRuntimeContext,
): MemoryStoreBackendKind | undefined {
  const runtimeValue = runtimeContext?.memoryStoreBackend;
  if (
    runtimeValue === "fs-json" ||
    runtimeValue === "sqlite-doc" ||
    runtimeValue === "sqlite-graph"
  ) {
    return runtimeValue;
  }
  const envValue = process.env.OPENCLAW_MEMORY_STORE_BACKEND;
  return envValue === "fs-json" || envValue === "sqlite-doc" || envValue === "sqlite-graph"
    ? envValue
    : undefined;
}

function selectNewMessages(
  messages: AgentMessage[],
  prePromptMessageCount?: number,
): AgentMessage[] {
  if (
    typeof prePromptMessageCount === "number" &&
    Number.isFinite(prePromptMessageCount) &&
    prePromptMessageCount >= 0
  ) {
    return messages.slice(prePromptMessageCount);
  }
  return messages;
}

function resolveWorkingSetPolicy(): WorkingSetPolicy {
  const configured = loadConfig().agents?.defaults?.compaction?.workingSet;
  const retainLatestMessages = Math.max(
    1,
    configured?.retainLatestMessages ?? DEFAULT_WORKING_SET_POLICY.retainLatestMessages,
  );
  const compactAfterMessages = Math.max(
    retainLatestMessages + 1,
    configured?.compactAfterMessages ?? DEFAULT_WORKING_SET_POLICY.compactAfterMessages,
  );
  return {
    retainLatestMessages,
    compactAfterMessages,
    importantItemsMax: Math.max(
      1,
      configured?.importantItemsMax ?? DEFAULT_WORKING_SET_POLICY.importantItemsMax,
    ),
    includeRelevantMemory:
      configured?.includeRelevantMemory ?? DEFAULT_WORKING_SET_POLICY.includeRelevantMemory,
  };
}

function trimMessagesToWorkingSet(
  messages: AgentMessage[],
  policy: WorkingSetPolicy,
): AgentMessage[] {
  const isConversationMessage = (message: AgentMessage): boolean =>
    message.role === "user" || message.role === "assistant" || message.role === "toolResult";
  const conversationMessageCount = messages.filter(isConversationMessage).length;
  if (conversationMessageCount <= policy.compactAfterMessages) {
    return sanitizeToolUseResultPairing(messages);
  }
  let keptConversationMessages = 0;
  let startIndex = messages.length;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isConversationMessage(messages[index])) {
      keptConversationMessages += 1;
      if (keptConversationMessages > policy.retainLatestMessages) {
        return sanitizeToolUseResultPairing(messages.slice(startIndex));
      }
      startIndex = index;
    }
  }
  return sanitizeToolUseResultPairing(messages);
}

export class MemorySystemContextEngine implements ContextEngine {
  readonly info: ContextEngineInfo = {
    id: "memory-system",
    name: "Integrated Memory System",
    version: "0.1.0",
    ownsCompaction: true,
  };

  private readonly legacy = new LegacyContextEngine();

  async bootstrap(params: {
    sessionId: string;
    sessionKey?: string;
    sessionFile: string;
  }): Promise<BootstrapResult> {
    await loadMemoryStoreSnapshot({
      workspaceDir: process.cwd(),
      sessionId: params.sessionKey ?? params.sessionId,
      backendKind: resolveMemoryStoreBackendKind(),
    });
    return { bootstrapped: true, importedMessages: 0 };
  }

  async ingest(_params: {
    sessionId: string;
    sessionKey?: string;
    message: AgentMessage;
    isHeartbeat?: boolean;
  }): Promise<IngestResult> {
    return { ingested: false };
  }

  async ingestBatch(_params: {
    sessionId: string;
    sessionKey?: string;
    messages: AgentMessage[];
    isHeartbeat?: boolean;
  }): Promise<IngestBatchResult> {
    return { ingestedCount: 0 };
  }

  async assemble(params: {
    sessionId: string;
    sessionKey?: string;
    messages: AgentMessage[];
    tokenBudget?: number;
  }): Promise<AssembleResult> {
    const workingSetPolicy = resolveWorkingSetPolicy();
    const assembledMessages = trimMessagesToWorkingSet(params.messages, workingSetPolicy);
    const snapshot = await loadMemoryStoreSnapshot({
      workspaceDir: process.cwd(),
      sessionId: params.sessionKey ?? params.sessionId,
      backendKind: resolveMemoryStoreBackendKind(),
    });
    const packet = retrieveMemoryContextPacket(snapshot, {
      messages: assembledMessages,
      workingItemsMax: workingSetPolicy.importantItemsMax,
      includeLongTermMemory: workingSetPolicy.includeRelevantMemory,
    });
    if (packet.accessedLongTermIds.length > 0) {
      await persistMemoryStoreSnapshot({
        workspaceDir: process.cwd(),
        sessionId: params.sessionKey ?? params.sessionId,
        backendKind: resolveMemoryStoreBackendKind(),
        workingMemory: snapshot.workingMemory,
        longTermMemory: touchRetrievedMemories(snapshot.longTermMemory, packet.accessedLongTermIds),
        pendingSignificance: snapshot.pendingSignificance,
        permanentMemory: snapshot.permanentMemory,
        graph: snapshot.graph,
      });
    }
    return {
      messages: assembledMessages,
      estimatedTokens: packet.text ? Math.ceil(packet.text.length / 4) : 0,
      systemPromptAddition: packet.text,
    };
  }

  async afterTurn(params: {
    sessionId: string;
    sessionKey?: string;
    sessionFile: string;
    messages: AgentMessage[];
    prePromptMessageCount: number;
    autoCompactionSummary?: string;
    isHeartbeat?: boolean;
    tokenBudget?: number;
    runtimeContext?: ContextEngineRuntimeContext;
  }): Promise<void> {
    if (params.isHeartbeat) {
      return;
    }
    const sessionId = params.sessionKey ?? params.sessionId;
    const workspaceDir = resolveWorkspaceDir(params.runtimeContext);
    const backendKind = resolveMemoryStoreBackendKind(params.runtimeContext);
    const snapshot = await loadMemoryStoreSnapshot({
      workspaceDir,
      sessionId,
      backendKind,
    });
    const compiled = compileMemoryState({
      sessionId,
      previous: snapshot,
      messages: params.messages,
      compactionSummary: params.autoCompactionSummary,
      runtimeContext: params.runtimeContext,
      sessionFile: params.sessionFile,
    });
    const newMessages = selectNewMessages(params.messages, params.prePromptMessageCount);
    const incremental = compileMemoryState({
      sessionId,
      previous: compiled,
      messages: newMessages,
      runtimeContext: params.runtimeContext,
      sessionFile: params.sessionFile,
    });
    await persistMemoryStoreSnapshot({
      workspaceDir,
      sessionId,
      backendKind,
      workingMemory: incremental.workingMemory,
      longTermMemory: incremental.longTermMemory,
      pendingSignificance: incremental.pendingSignificance,
      permanentMemory: incremental.permanentMemory,
      graph: incremental.graph,
    });
  }

  async compact(params: {
    sessionId: string;
    sessionKey?: string;
    sessionFile: string;
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
    compactionTarget?: "budget" | "threshold";
    customInstructions?: string;
    runtimeContext?: ContextEngineRuntimeContext;
  }): Promise<CompactResult> {
    const sessionId = params.sessionKey ?? params.sessionId;
    const workspaceDir = resolveWorkspaceDir(params.runtimeContext);
    const backendKind = resolveMemoryStoreBackendKind(params.runtimeContext);
    const snapshot = await loadMemoryStoreSnapshot({ workspaceDir, sessionId, backendKind });
    const memoryAwareInstructions = [
      "Memory-system compaction rules:",
      "Preserve current goals, constraints, decisions, and unresolved loops explicitly.",
      "Keep enough detail that long-term and permanent memories can be audited against the summary.",
      "Do not rewrite identifiers, versions, paths, or repo state.",
      params.customInstructions?.trim() || "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await this.legacy.compact({
      ...params,
      customInstructions: memoryAwareInstructions,
    });
    if (result.result?.summary) {
      const compiled = compileMemoryState({
        sessionId,
        previous: snapshot,
        messages: [],
        compactionSummary: result.result.summary,
        runtimeContext: params.runtimeContext,
        sessionFile: params.sessionFile,
      });
      await persistMemoryStoreSnapshot({
        workspaceDir,
        sessionId,
        backendKind,
        workingMemory: compiled.workingMemory,
        longTermMemory: compiled.longTermMemory,
        pendingSignificance: compiled.pendingSignificance,
        permanentMemory: compiled.permanentMemory,
        graph: compiled.graph,
      });
    }
    await this.review({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      sessionFile: params.sessionFile,
      runtimeContext: params.runtimeContext,
      reason: "compaction",
    });
    return result;
  }

  async review(params: {
    sessionId: string;
    sessionKey?: string;
    sessionFile: string;
    runtimeContext?: ContextEngineRuntimeContext;
    reason?: "manual" | "compaction" | "checkpoint";
  }): Promise<ReviewResult> {
    const sessionId = params.sessionKey ?? params.sessionId;
    const workspaceDir = resolveWorkspaceDir(params.runtimeContext);
    const backendKind = resolveMemoryStoreBackendKind(params.runtimeContext);
    const reviewed = runMemorySleepReview({
      sessionId,
      snapshot: await loadMemoryStoreSnapshot({ workspaceDir, sessionId, backendKind }),
    });
    await persistMemoryStoreSnapshot({
      workspaceDir,
      sessionId,
      backendKind,
      workingMemory: reviewed.workingMemory,
      longTermMemory: reviewed.longTermMemory,
      pendingSignificance: reviewed.pendingSignificance,
      permanentMemory: reviewed.permanentMemory,
      graph: reviewed.graph,
    });
    return {
      reviewed: true,
      summary:
        reviewed.review.carryForwardSummary ??
        `memory review complete (${params.reason ?? "manual"})`,
      archivedMemoryIds: reviewed.review.archivedMemoryIds,
      staleMemoryIds: reviewed.review.staleMemoryIds,
      contradictoryMemoryIds: reviewed.review.contradictoryMemoryIds,
      contradictoryConceptIds: reviewed.review.contradictoryConceptIds,
      scopedAlternativeConceptIds: reviewed.review.scopedAlternativeConceptIds,
      supersededMemoryIds: reviewed.review.supersededMemoryIds,
      supersededConceptIds: reviewed.review.supersededConceptIds,
      contestedRevisionConceptIds: reviewed.review.contestedRevisionConceptIds,
      revisedConceptIds: reviewed.review.revisedConceptIds,
      permanentEligibleIds: reviewed.review.permanentEligibleIds,
      permanentEligibleConceptIds: reviewed.review.permanentEligibleConceptIds,
      permanentDeferredIds: reviewed.review.permanentDeferredIds,
      permanentDeferredConceptIds: reviewed.review.permanentDeferredConceptIds,
      permanentBlockedIds: reviewed.review.permanentBlockedIds,
      permanentBlockedConceptIds: reviewed.review.permanentBlockedConceptIds,
    };
  }

  async dispose(): Promise<void> {
    await this.legacy.dispose?.();
  }
}

export function registerMemorySystemContextEngine(): void {
  registerContextEngine("memory-system", () => new MemorySystemContextEngine());
}
