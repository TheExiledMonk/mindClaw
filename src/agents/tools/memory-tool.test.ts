import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asOpenClawConfig,
  createMemoryCheckpointToolOrThrow,
  createMemoryDeleteToolOrThrow,
  createMemorySchemaToolOrThrow,
  createMemorySearchToolOrThrow,
  createMemoryStoreToolOrThrow,
  expectUnavailableMemorySearchDetails,
} from "./memory-tool.test-helpers.js";

vi.mock("../../context-engine/memory-system-store.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../context-engine/memory-system-store.js")
  >("../../context-engine/memory-system-store.js");
  return {
    ...actual,
    loadMemoryStoreSnapshot: vi.fn(),
    loadMemoryStoreMetadata: vi.fn(),
    deleteIntegratedMemoryEntry: vi.fn(),
    storeIntegratedMemoryCheckpoint: vi.fn(),
    storeIntegratedMemoryEntry: vi.fn(),
  };
});

describe("memory_search unavailable payloads", () => {
  beforeEach(async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.loadMemoryStoreSnapshot).mockReset();
    vi.mocked(mod.loadMemoryStoreMetadata).mockReset();
    vi.mocked(mod.deleteIntegratedMemoryEntry).mockReset();
    vi.mocked(mod.storeIntegratedMemoryEntry).mockReset();
    vi.mocked(mod.storeIntegratedMemoryCheckpoint).mockReset();
  });

  it("returns explicit unavailable metadata for integrated store failures", async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.loadMemoryStoreSnapshot).mockRejectedValue(
      new Error("integrated memory store unavailable"),
    );

    const tool = createMemorySearchToolOrThrow();
    const result = await tool.execute("store-failure", { query: "hello" });
    expectUnavailableMemorySearchDetails(result.details, {
      error: "integrated memory store unavailable",
      warning: "Memory search is unavailable due to an embedding/provider error.",
      action: "Check embedding provider configuration and retry memory_search.",
    });
  });

  it("returns explicit disabled metadata for integrated store write failures", async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.storeIntegratedMemoryEntry).mockRejectedValue(
      new Error("integrated memory store unavailable"),
    );

    const tool = createMemoryStoreToolOrThrow();
    const result = await tool.execute("store-write-failure", { text: "remember this" });
    expect(result.details).toEqual({
      stored: false,
      disabled: true,
      error: "integrated memory store unavailable",
    });
  });

  it("still exposes integrated memory tools even when legacy memorySearch is disabled", async () => {
    const tool = createMemorySchemaToolOrThrow({
      config: asOpenClawConfig({
        agents: {
          defaults: {
            memorySearch: { enabled: false },
          },
          list: [{ id: "main", default: true }],
        },
      }),
    });

    const result = await tool.execute("memory-schema-disabled-legacy", {});
    expect(result.details).toMatchObject({
      mode: "integrated-memory",
    });
  });

  it("exposes allowed memory labels and aliases via memory_schema", async () => {
    const tool = createMemorySchemaToolOrThrow();
    const result = await tool.execute("memory-schema", {});

    expect(result.details).toMatchObject({
      mode: "integrated-memory",
      categories: expect.arrayContaining([
        expect.objectContaining({ id: "fact" }),
        expect.objectContaining({ id: "strategy" }),
      ]),
      importanceClasses: expect.arrayContaining([
        expect.objectContaining({ id: "critical" }),
        expect.objectContaining({ id: "useful" }),
      ]),
      sourceTypes: expect.arrayContaining([
        expect.objectContaining({
          id: "summary_derived",
          aliases: expect.arrayContaining(["training", "lesson", "course"]),
        }),
      ]),
      checkpointUsage: expect.objectContaining({
        tool: "memory_checkpoint",
      }),
    });
  });

  it("stores temporary checkpoint memory into pending significance", async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.storeIntegratedMemoryCheckpoint).mockResolvedValue({
      created: true,
      entry: {
        id: "pending-1",
        text: "Need to verify the CPA lesson before promoting it.",
        category: "fact",
        sourceType: "direct_observation",
        pendingReason: "temporary checkpoint",
      },
    } as Awaited<ReturnType<typeof mod.storeIntegratedMemoryCheckpoint>>);
    vi.mocked(mod.loadMemoryStoreMetadata).mockResolvedValue({
      schemaVersion: 1,
      snapshotVersion: 1,
      workingMemoryVersion: 1,
      longTermMemoryVersion: 1,
      permanentMemoryVersion: 1,
      graphVersion: 1,
      lastUpdatedAt: Date.now(),
    } as unknown as Awaited<ReturnType<typeof mod.loadMemoryStoreMetadata>>);
    vi.mocked(mod.loadMemoryStoreSnapshot).mockResolvedValue({
      workingMemory: {
        sessionId: "memory:main",
        updatedAt: Date.now(),
        rollingSummary: "",
        activeFacts: [],
        activeGoals: [],
        openLoops: [],
        recentEvents: [],
        recentDecisions: [],
      },
      longTermMemory: [],
      pendingSignificance: [],
      permanentMemory: {
        id: "root",
        nodeType: "root",
        label: "root",
        summary: "",
        activeStatus: "active",
        confidence: 1,
        evidence: [],
        sourceMemoryIds: [],
        children: [],
        relatedNodeIds: [],
        updatedAt: Date.now(),
      },
      graph: { nodes: [], edges: [], updatedAt: Date.now() },
    } as unknown as Awaited<ReturnType<typeof mod.loadMemoryStoreSnapshot>>);

    const tool = createMemoryCheckpointToolOrThrow();
    const result = await tool.execute("memory-checkpoint", {
      text: "Need to verify the CPA lesson before promoting it.",
      pendingReason: "temporary checkpoint",
    });

    expect(mod.storeIntegratedMemoryCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Need to verify the CPA lesson before promoting it.",
      }),
    );
    expect(result.details).toMatchObject({
      stored: true,
      kind: "checkpoint",
      path: "mindclaw_memory://pending/pending-1",
      pendingReason: "temporary checkpoint",
    });
  });

  it("accepts human-friendly source type aliases like training", async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.storeIntegratedMemoryEntry).mockResolvedValue({
      created: true,
      entry: {
        id: "mem-1",
        text: "Remember this lesson",
        category: "fact",
        importanceClass: "useful",
        sourceType: "summary_derived",
      },
    } as Awaited<ReturnType<typeof mod.storeIntegratedMemoryEntry>>);

    const tool = createMemoryStoreToolOrThrow();
    const result = await tool.execute("store-training", {
      text: "Remember this lesson",
      sourceType: "training",
    });

    expect(mod.storeIntegratedMemoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "summary_derived",
      }),
    );
    expect(result.details).toMatchObject({
      stored: true,
      sourceType: "summary_derived",
    });
  });

  it("accepts human-friendly category aliases like knowledge", async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.storeIntegratedMemoryEntry).mockResolvedValue({
      created: true,
      entry: {
        id: "mem-knowledge",
        text: "Remember this knowledge",
        category: "fact",
        importanceClass: "useful",
        sourceType: "summary_derived",
      },
    } as Awaited<ReturnType<typeof mod.storeIntegratedMemoryEntry>>);

    const tool = createMemoryStoreToolOrThrow();
    const result = await tool.execute("store-knowledge", {
      text: "Remember this knowledge",
      category: "knowledge",
    });

    expect(mod.storeIntegratedMemoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "fact",
      }),
    );
    expect(result.details).toMatchObject({
      stored: true,
      category: "fact",
    });
  });

  it("deletes a specific integrated memory path", async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.deleteIntegratedMemoryEntry).mockResolvedValue({
      deleted: true,
      path: "mindclaw_memory://long-term/mem-1",
      deletedMemoryIds: ["mem-1"],
      deletedArtifactRefs: [],
    } as Awaited<ReturnType<typeof mod.deleteIntegratedMemoryEntry>>);
    vi.mocked(mod.loadMemoryStoreMetadata).mockResolvedValue({
      schemaVersion: 1,
      snapshotVersion: 1,
      workingMemoryVersion: 1,
      longTermMemoryVersion: 1,
      permanentMemoryVersion: 1,
      graphVersion: 1,
      lastUpdatedAt: Date.now(),
    } as unknown as Awaited<ReturnType<typeof mod.loadMemoryStoreMetadata>>);
    vi.mocked(mod.loadMemoryStoreSnapshot).mockResolvedValue({
      workingMemory: {
        sessionId: "memory:main",
        updatedAt: Date.now(),
        rollingSummary: "",
        activeFacts: [],
        activeGoals: [],
        openLoops: [],
        recentEvents: [],
        recentDecisions: [],
      },
      longTermMemory: [],
      pendingSignificance: [],
      permanentMemory: {
        id: "root",
        nodeType: "root",
        label: "root",
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        updatedAt: Date.now(),
        children: [],
      },
      graph: { nodes: [], edges: [], updatedAt: Date.now() },
    } as Awaited<ReturnType<typeof mod.loadMemoryStoreSnapshot>>);

    const tool = createMemoryDeleteToolOrThrow();
    const result = await tool.execute("memory-delete", {
      path: "mindclaw_memory://long-term/mem-1",
    });

    expect(mod.deleteIntegratedMemoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "mindclaw_memory://long-term/mem-1",
      }),
    );
    expect(result.details).toMatchObject({
      deleted: true,
      deletedMemoryIds: ["mem-1"],
    });
  });

  it("uses a stable agent-level durable memory scope instead of live session keys", async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.loadMemoryStoreMetadata).mockResolvedValue({
      schemaVersion: 1,
      snapshotVersion: 1,
      workingMemoryVersion: 1,
      longTermMemoryVersion: 1,
      permanentMemoryVersion: 1,
      graphVersion: 1,
      lastUpdatedAt: Date.now(),
    } as unknown as Awaited<ReturnType<typeof mod.loadMemoryStoreMetadata>>);
    vi.mocked(mod.loadMemoryStoreSnapshot).mockResolvedValue({
      workingMemory: {
        sessionId: "memory:main",
        updatedAt: Date.now(),
        rollingSummary: "",
        activeFacts: [],
        activeGoals: [],
        openLoops: [],
        recentEvents: [],
        recentDecisions: [],
      },
      longTermMemory: [],
      pendingSignificance: [],
      permanentMemory: {
        id: "root",
        nodeType: "root",
        label: "root",
        summary: "",
        activeStatus: "active",
        confidence: 1,
        evidence: [],
        sourceMemoryIds: [],
        children: [],
        relatedNodeIds: [],
        updatedAt: Date.now(),
      },
      graph: { nodes: [], edges: [], updatedAt: Date.now() },
    } as unknown as Awaited<ReturnType<typeof mod.loadMemoryStoreSnapshot>>);
    vi.mocked(mod.storeIntegratedMemoryEntry).mockResolvedValue({
      created: true,
      entry: {
        id: "mem-1",
        text: "Remember this lesson",
        category: "fact",
        importanceClass: "useful",
        sourceType: "summary_derived",
      },
    } as Awaited<ReturnType<typeof mod.storeIntegratedMemoryEntry>>);

    const tool = createMemoryStoreToolOrThrow({
      agentSessionKey: "agent:main:discord:dm:u123",
    });
    await tool.execute("store-scope", {
      text: "Remember this lesson",
      sourceType: "training",
    });

    expect(mod.storeIntegratedMemoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "memory:main",
      }),
    );
  });
});
