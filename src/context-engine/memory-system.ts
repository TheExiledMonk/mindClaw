import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  AssembleResult,
  BootstrapResult,
  CompactResult,
  ContextEngine,
  ContextEngineInfo,
  ContextEngineRuntimeContext,
  IngestBatchResult,
  IngestResult,
} from "./types.js";
import { registerContextEngine } from "./registry.js";
import { LegacyContextEngine } from "./legacy.js";
import {
  compileMemoryState,
  loadMemoryStoreSnapshot,
  persistMemoryStoreSnapshot,
  retrieveMemoryContextPacket,
  touchRetrievedMemories,
} from "./memory-system-store.js";

function resolveWorkspaceDir(runtimeContext?: ContextEngineRuntimeContext): string {
  const workspaceDir = runtimeContext?.workspaceDir;
  if (typeof workspaceDir === "string" && workspaceDir.trim()) {
    return workspaceDir;
  }
  return process.cwd();
}

function selectNewMessages(messages: AgentMessage[], prePromptMessageCount?: number): AgentMessage[] {
  if (
    typeof prePromptMessageCount === "number" &&
    Number.isFinite(prePromptMessageCount) &&
    prePromptMessageCount >= 0
  ) {
    return messages.slice(prePromptMessageCount);
  }
  return messages;
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
    const snapshot = await loadMemoryStoreSnapshot({
      workspaceDir: process.cwd(),
      sessionId: params.sessionKey ?? params.sessionId,
    });
    const packet = retrieveMemoryContextPacket(snapshot, { messages: params.messages });
    if (packet.accessedLongTermIds.length > 0) {
      await persistMemoryStoreSnapshot({
        workspaceDir: process.cwd(),
        sessionId: params.sessionKey ?? params.sessionId,
        workingMemory: snapshot.workingMemory,
        longTermMemory: touchRetrievedMemories(snapshot.longTermMemory, packet.accessedLongTermIds),
        pendingSignificance: snapshot.pendingSignificance,
        permanentMemory: snapshot.permanentMemory,
      });
    }
    return {
      messages: params.messages,
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
    const snapshot = await loadMemoryStoreSnapshot({
      workspaceDir,
      sessionId,
    });
    const compiled = compileMemoryState({
      sessionId,
      previous: snapshot,
      messages: params.messages,
      compactionSummary: params.autoCompactionSummary,
    });
    const newMessages = selectNewMessages(params.messages, params.prePromptMessageCount);
    const incremental = compileMemoryState({
      sessionId,
      previous: compiled,
      messages: newMessages,
    });
    await persistMemoryStoreSnapshot({
      workspaceDir,
      sessionId,
      workingMemory: incremental.workingMemory,
      longTermMemory: incremental.longTermMemory,
      pendingSignificance: incremental.pendingSignificance,
      permanentMemory: incremental.permanentMemory,
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
    const snapshot = await loadMemoryStoreSnapshot({ workspaceDir, sessionId });
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
      });
      await persistMemoryStoreSnapshot({
        workspaceDir,
        sessionId,
        workingMemory: compiled.workingMemory,
        longTermMemory: compiled.longTermMemory,
        pendingSignificance: compiled.pendingSignificance,
        permanentMemory: compiled.permanentMemory,
      });
    }
    return result;
  }

  async dispose(): Promise<void> {
    await this.legacy.dispose?.();
  }
}

export function registerMemorySystemContextEngine(): void {
  registerContextEngine("memory-system", () => new MemorySystemContextEngine());
}
