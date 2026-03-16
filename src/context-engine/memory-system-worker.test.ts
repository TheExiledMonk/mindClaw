import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildMemoryQuerySignature,
  getCachedMemoryContextPacket,
  getCachedMemoryStoreSnapshot,
  invalidateMemoryCache,
} from "./memory-system-cache.js";
import {
  loadMemoryStoreMetadata,
  loadMemoryStoreSnapshot,
  persistMemoryStoreSnapshot,
  retrieveMemoryContextPacket,
  type MemoryGraphSnapshot,
  type PermanentMemoryNode,
  type WorkingMemorySnapshot,
  type LongTermMemoryEntry,
} from "./memory-system-store.js";
import {
  enqueueMemoryBackgroundRefresh,
  getMemoryBackgroundWorkerStats,
  waitForMemoryBackgroundWorkerIdle,
} from "./memory-system-worker.js";

const previousCwd = process.cwd();

afterEach(() => {
  process.chdir(previousCwd);
});

describe("memory background worker", () => {
  it("rewarms recent retrieval packets after invalidation", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-worker-"));
    process.chdir(workspaceDir);
    const sessionId = "agent:worker";

    await persistMemoryStoreSnapshot({
      workspaceDir,
      sessionId,
      workingMemory: buildWorkingMemory(),
      longTermMemory: [
        buildLongTermEntry({
          id: "ltm-course",
          text: "CPA course lessons stay durable in the integrated memory store.",
        }),
      ],
      pendingSignificance: [],
      permanentMemory: permanentRoot(),
      graph: emptyGraph(),
    });

    const queryMessage = [{ role: "user", content: "CPA course lessons" } as AgentMessage];
    const initial = await getCachedMemoryStoreSnapshot({
      workspaceDir,
      sessionId,
      loadMetadata: () => loadMemoryStoreMetadata({ workspaceDir, sessionId }),
      loadSnapshot: () => loadMemoryStoreSnapshot({ workspaceDir, sessionId }),
    });
    const initialPacket = getCachedMemoryContextPacket({
      workspaceDir,
      sessionId,
      metadata: initial.metadata,
      querySignature: buildMemoryQuerySignature({ messages: queryMessage }),
      queryParams: { messages: queryMessage },
      buildPacket: () => retrieveMemoryContextPacket(initial.snapshot, { messages: queryMessage }),
    });
    expect(initialPacket.cacheHit).toBe(false);

    invalidateMemoryCache({ workspaceDir, sessionId });
    enqueueMemoryBackgroundRefresh({
      workspaceDir,
      sessionId,
      reason: "memory-store",
    });
    await waitForMemoryBackgroundWorkerIdle();
    const stats = getMemoryBackgroundWorkerStats();
    expect(stats.completed).toBeGreaterThan(0);
    expect(stats.failed).toBe(0);

    const warmed = await getCachedMemoryStoreSnapshot({
      workspaceDir,
      sessionId,
      loadMetadata: () => loadMemoryStoreMetadata({ workspaceDir, sessionId }),
      loadSnapshot: () => loadMemoryStoreSnapshot({ workspaceDir, sessionId }),
    });
    const warmedPacket = getCachedMemoryContextPacket({
      workspaceDir,
      sessionId,
      metadata: warmed.metadata,
      querySignature: buildMemoryQuerySignature({ messages: queryMessage }),
      queryParams: { messages: queryMessage },
      buildPacket: () => retrieveMemoryContextPacket(warmed.snapshot, { messages: queryMessage }),
    });
    expect(warmedPacket.packet.text).toContain("CPA course lessons stay durable");
  });
});

function buildWorkingMemory(): WorkingMemorySnapshot {
  return {
    sessionId: "agent:worker",
    updatedAt: Date.now(),
    rollingSummary: "Discussing memory durability.",
    carryForwardSummary: "",
    activeFacts: [],
    activeGoals: [],
    openLoops: [],
    recentEvents: [],
    recentDecisions: [],
  };
}

function buildLongTermEntry(params: { id: string; text: string }): LongTermMemoryEntry {
  const now = Date.now();
  return {
    id: params.id,
    semanticKey: params.id,
    conceptKey: `concept-${params.id}`,
    canonicalText: params.text,
    conceptAliases: [],
    entityAliases: [],
    entityIds: [],
    ontologyKind: "fact",
    category: "fact",
    text: params.text,
    strength: 0.9,
    evidence: [params.text],
    provenance: [{ kind: "message", detail: "stored from worker test", recordedAt: now }],
    sourceType: "user_stated",
    confidence: 0.95,
    importanceClass: "useful",
    compressionState: "stable",
    activeStatus: "active",
    adjudicationStatus: "authoritative",
    revisionCount: 1,
    lastRevisionKind: "new",
    permanenceStatus: "eligible",
    permanenceReasons: [],
    trend: "stable",
    accessCount: 0,
    createdAt: now,
    lastConfirmedAt: now,
    contradictionCount: 0,
    relatedMemoryIds: [],
    relations: [],
    environmentTags: [],
    artifactRefs: [],
    updatedAt: now,
  };
}

function permanentRoot(): PermanentMemoryNode {
  return {
    id: "root",
    label: "root",
    nodeType: "root",
    evidence: [],
    sourceMemoryIds: [],
    confidence: 1,
    activeStatus: "active",
    updatedAt: Date.now(),
    children: [],
  };
}

function emptyGraph(): MemoryGraphSnapshot {
  return { nodes: [], edges: [], updatedAt: Date.now() };
}
