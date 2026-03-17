import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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
    storeIntegratedMemoryEntry: vi.fn(),
  };
});

describe("memory_search unavailable payloads", () => {
  beforeEach(async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.loadMemoryStoreSnapshot).mockReset();
    vi.mocked(mod.loadMemoryStoreMetadata).mockReset();
    vi.mocked(mod.storeIntegratedMemoryEntry).mockReset();
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
