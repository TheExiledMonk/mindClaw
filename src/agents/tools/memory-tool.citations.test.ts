import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  persistMemoryStoreSnapshot,
  type LongTermMemoryEntry,
  type MemoryGraphSnapshot,
  type PendingMemoryEntry,
  type PermanentMemoryNode,
  type WorkingMemorySnapshot,
} from "../../context-engine/memory-system-store.js";
import {
  asOpenClawConfig,
  createMemoryGetToolOrThrow,
  createMemorySearchToolOrThrow,
  createMemoryStoreToolOrThrow,
} from "./memory-tool.test-helpers.js";

let workspaceDir = "";

beforeEach(async () => {
  workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "mindclaw-memory-tool-"));
  await persistMemoryStoreSnapshot({
    workspaceDir,
    sessionId: "session-main",
    workingMemory: buildWorkingMemory(),
    longTermMemory: [
      buildLongTermEntry({
        id: "ltm-course",
        text: "CPA course syllabus stored under PowerHouse Affiliate with tax module sequencing.",
      }),
    ],
    pendingSignificance: [
      buildPendingEntry({
        id: "pending-affiliate",
        text: "Need to confirm whether PowerHouse Affiliate should stay grouped with CPA course artifacts.",
      }),
    ],
    permanentMemory: buildPermanentRoot([
      "MindClaw course knowledge should stay available across sessions.",
    ]),
    graph: emptyGraph(),
  });
});

afterEach(async () => {
  if (workspaceDir) {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  }
});

describe("memory search citations", () => {
  it("appends source information when citations are enabled", async () => {
    const cfg = configForWorkspace({
      memory: { citations: "on" },
      agents: { list: [{ id: "main", default: true, workspace: workspaceDir }] },
    });
    const tool = createMemorySearchToolOrThrow({
      config: cfg,
      agentSessionKey: "session-main",
    });
    const result = await tool.execute("call_citations_on", { query: "CPA course" });
    const details = result.details as { results: Array<{ snippet: string; citation?: string }> };
    expect(details.results[0]?.snippet).toMatch(
      /Source: mindclaw_memory:\/\/long-term\/ltm-course#L1/,
    );
    expect(details.results[0]?.citation).toBe("mindclaw_memory://long-term/ltm-course#L1");
  });

  it("leaves snippet untouched when citations are off", async () => {
    const cfg = configForWorkspace({
      memory: { citations: "off" },
      agents: { list: [{ id: "main", default: true, workspace: workspaceDir }] },
    });
    const tool = createMemorySearchToolOrThrow({
      config: cfg,
      agentSessionKey: "session-main",
    });
    const result = await tool.execute("call_citations_off", { query: "CPA course" });
    const details = result.details as { results: Array<{ snippet: string; citation?: string }> };
    expect(details.results[0]?.snippet).not.toMatch(/Source:/);
    expect(details.results[0]?.citation).toBeUndefined();
  });

  it("honors auto mode for direct chats", async () => {
    const tool = createMemorySearchToolOrThrow({
      config: configForWorkspace({
        memory: { citations: "auto" },
        agents: { list: [{ id: "main", default: true, workspace: workspaceDir }] },
      }),
      agentSessionKey: "agent:main:discord:dm:u123",
    });
    const result = await tool.execute("auto_mode_direct", { query: "CPA course" });
    const details = result.details as { results: Array<{ snippet: string }> };
    expect(details.results[0]?.snippet).toMatch(/Source:/);
  });

  it("suppresses citations for auto mode in group chats", async () => {
    const tool = createMemorySearchToolOrThrow({
      config: configForWorkspace({
        memory: { citations: "auto" },
        agents: { list: [{ id: "main", default: true, workspace: workspaceDir }] },
      }),
      agentSessionKey: "agent:main:discord:group:c123",
    });
    const result = await tool.execute("auto_mode_group", { query: "CPA course" });
    const details = result.details as { results: Array<{ snippet: string }> };
    expect(details.results[0]?.snippet).not.toMatch(/Source:/);
  });
});

describe("memory tools", () => {
  it("searches the integrated memory store instead of legacy markdown memory files", async () => {
    const tool = createMemorySearchToolOrThrow({
      config: configForWorkspace({
        agents: { list: [{ id: "main", default: true, workspace: workspaceDir }] },
      }),
      agentSessionKey: "session-main",
    });

    const result = await tool.execute("call_search", { query: "PowerHouse Affiliate" });
    const details = result.details as {
      provider: string;
      mode: string;
      results: Array<{ path: string; snippet: string }>;
    };

    expect(details.provider).toBe("mindclaw-memory");
    expect(details.mode).toBe("integrated-memory");
    expect(details.results[0]?.path).toBe("mindclaw_memory://long-term/ltm-course");
    expect(details.results[0]?.snippet).toContain("PowerHouse Affiliate");
  });

  it("reads long-term memory through integrated pseudo-paths", async () => {
    const tool = createMemoryGetToolOrThrow(
      configForWorkspace({
        agents: { list: [{ id: "main", default: true, workspace: workspaceDir }] },
      }),
    );

    const result = await tool.execute("call_get", {
      path: "mindclaw_memory://long-term/ltm-course",
    });
    expect(result.details).toEqual({
      path: "mindclaw_memory://long-term/ltm-course",
      text: "CPA course syllabus stored under PowerHouse Affiliate with tax module sequencing.",
    });
  });

  it("stores explicit durable memory into the integrated memory store", async () => {
    const cfg = configForWorkspace({
      agents: { list: [{ id: "main", default: true, workspace: workspaceDir }] },
    });
    const storeTool = createMemoryStoreToolOrThrow({
      config: cfg,
      agentSessionKey: "session-main",
    });
    const storeResult = await storeTool.execute("call_store", {
      text: "Remember that the CPA affiliate course lives under PowerHouse Affiliate and includes compliance notes.",
      category: "fact",
      importanceClass: "useful",
    });
    const stored = storeResult.details as {
      stored: boolean;
      created: boolean;
      path: string;
      text: string;
    };
    expect(stored.stored).toBe(true);
    expect(stored.path).toMatch(/^mindclaw_memory:\/\/long-term\//);
    expect(stored.text).toContain("PowerHouse Affiliate");

    const getTool = createMemoryGetToolOrThrow({
      config: cfg,
      agentSessionKey: "session-main",
    });
    const getResult = await getTool.execute("call_store_get", { path: stored.path });
    expect((getResult.details as { text: string }).text).toContain("compliance notes");

    const searchTool = createMemorySearchToolOrThrow({
      config: cfg,
      agentSessionKey: "session-main",
    });
    const searchResult = await searchTool.execute("call_store_search", {
      query: "compliance notes",
    });
    const details = searchResult.details as { results: Array<{ path: string; snippet: string }> };
    expect(details.results.some((entry) => entry.path === stored.path)).toBe(true);
  });
});

function configForWorkspace(config: Record<string, unknown>) {
  return asOpenClawConfig(config);
}

function buildWorkingMemory(): WorkingMemorySnapshot {
  return {
    sessionId: "session-main",
    updatedAt: Date.now(),
    rollingSummary: "Discussed durable course setup.",
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
    strength: 0.92,
    evidence: [params.text],
    provenance: [{ kind: "message", detail: "stored from session", recordedAt: now }],
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

function buildPendingEntry(params: { id: string; text: string }): PendingMemoryEntry {
  return {
    ...buildLongTermEntry(params),
    pendingReason: "needs review",
  };
}

function buildPermanentRoot(summaries: string[]): PermanentMemoryNode {
  return {
    id: "root",
    label: "root",
    nodeType: "root",
    summary: "root",
    evidence: [],
    sourceMemoryIds: [],
    confidence: 1,
    activeStatus: "active",
    updatedAt: Date.now(),
    children: summaries.map((summary, index) => ({
      id: `root/${index + 1}`,
      label: `node-${index + 1}`,
      nodeType: "context",
      relationToParent: "contains",
      summary,
      evidence: [summary],
      sourceMemoryIds: [],
      confidence: 0.9,
      activeStatus: "active",
      updatedAt: Date.now(),
      children: [],
    })),
  };
}

function emptyGraph(): MemoryGraphSnapshot {
  return {
    nodes: [],
    edges: [],
    updatedAt: Date.now(),
  };
}
