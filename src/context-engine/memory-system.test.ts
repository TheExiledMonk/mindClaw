import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { MemorySystemContextEngine } from "./memory-system.js";
import {
  buildMemoryContextPacket,
  buildWorkingMemorySnapshot,
  compileMemoryState,
  deriveLongTermMemoryCandidates,
  loadMemoryStoreSnapshot,
  MEMORY_SYSTEM_DIRNAME,
  retrieveMemoryContextPacket,
  runMemorySleepReview,
} from "./memory-system-store.js";
import type { LongTermMemoryEntry, PendingMemoryEntry, PermanentMemoryNode } from "./memory-system-store.js";

const previousCwd = process.cwd();

afterEach(() => {
  process.chdir(previousCwd);
});

function userMessage(content: string): AgentMessage {
  return {
    role: "user",
    content,
    timestamp: Date.now(),
  } as AgentMessage;
}

function longTermEntry(overrides: Partial<LongTermMemoryEntry> = {}): LongTermMemoryEntry {
  const now = Date.now();
  return {
    id: "ltm-default",
    category: "strategy",
    text: "Default durable memory.",
    strength: 0.8,
    evidence: ["default evidence"],
    provenance: [
      {
        kind: "message",
        detail: "default evidence",
        recordedAt: now,
        derivedFromMemoryIds: [],
      },
    ],
    sourceType: "system_inferred",
    confidence: 0.8,
    importanceClass: "useful",
    compressionState: "stable",
    activeStatus: "active",
    trend: "stable",
    accessCount: 0,
    createdAt: now,
    lastConfirmedAt: now,
    contradictionCount: 0,
    relatedMemoryIds: [],
    relations: [],
    customerScope: undefined,
    environmentTags: [],
    artifactRefs: [],
    updatedAt: now,
    ...overrides,
  };
}

function pendingEntry(overrides: Partial<PendingMemoryEntry> = {}): PendingMemoryEntry {
  return {
    ...longTermEntry({
      activeStatus: "pending",
      importanceClass: "temporary",
      trend: "rising",
      ...overrides,
    }),
    pendingReason:
      overrides.pendingReason ?? "needs recurrence or stronger confirmation before durable promotion",
  };
}

function permanentRoot(children: PermanentMemoryNode[] = []): PermanentMemoryNode {
  return {
    id: "root",
    label: "permanent-memory",
    nodeType: "root",
    updatedAt: Date.now(),
    evidence: [],
    sourceMemoryIds: [],
    confidence: 1,
    activeStatus: "active",
    children,
  };
}

function emptyGraph() {
  return {
    nodes: [],
    edges: [],
    updatedAt: Date.now(),
  };
}

describe("memory system store", () => {
  it("derives durable long-term memory candidates from user instructions", () => {
    const candidates = deriveLongTermMemoryCandidates({
      messages: [
        userMessage("We will use OpenClaw as the base and revert to tag v2026.3.13-1."),
        userMessage("Remove .git and create a new git repo when the migration is done."),
      ],
    });

    expect(candidates.durable.map((candidate) => candidate.category)).toContain("decision");
    expect(candidates.durable.some((candidate) => candidate.text.includes("v2026.3.13-1"))).toBe(
      true,
    );
  });

  it("builds a compact outward-facing memory packet", () => {
    const packet = buildMemoryContextPacket({
      workingMemory: buildWorkingMemorySnapshot({
        sessionId: "session-a",
        messages: [
          userMessage("We are building a new bot with short-term, long-term, and permanent memory."),
          userMessage("Next we need to integrate the memory system into context compression."),
        ],
      }),
      longTermMemory: [
        longTermEntry({
          id: "ltm-1",
          category: "strategy",
          text: "The memory system should sit between raw context and prompt assembly.",
          strength: 0.9,
          evidence: ["strategy"],
          confidence: 0.9,
          artifactRefs: ["src/context-engine/memory-system.ts"],
        }),
      ],
      pendingSignificance: [],
      graph: emptyGraph(),
      permanentMemory: permanentRoot([
          {
            id: "projects",
            label: "projects",
            nodeType: "context",
            relationToParent: "contains",
            updatedAt: Date.now(),
            evidence: [],
            sourceMemoryIds: [],
            confidence: 1,
            activeStatus: "active",
            children: [
              {
                id: "projects/current-bot",
                label: "current-bot",
                nodeType: "context",
                relationToParent: "contains",
                summary: "Permanent node tree is the highest-stability memory layer.",
                updatedAt: Date.now(),
                evidence: [],
                sourceMemoryIds: [],
                confidence: 0.9,
                activeStatus: "active",
                children: [],
              },
            ],
          },
        ]),
    });

    expect(packet).toContain("Integrated memory packet");
    expect(packet).toContain("Relevant long-term facts and patterns");
    expect(packet).toContain("Relevant entities, constraints, and structural memory");
    expect(packet).toContain("Relevant files and artifacts");
  });

  it("compiler reconsolidates compaction summaries into long-term and permanent memory", () => {
    const compiled = compileMemoryState({
      sessionId: "session-a",
      messages: [userMessage("Next session continue with memory-system migration validation.")],
      compactionSummary:
        "We decided to use memory-system as the active context engine and preserve repo tag v2026.3.13-1 as the migration baseline.",
    });

    expect(compiled.longTermMemory.some((entry) => entry.category === "episode")).toBe(true);
    expect(
      compiled.permanentMemory.children.some((child) => child.label === "projects"),
    ).toBe(true);
    expect(Array.isArray(compiled.pendingSignificance)).toBe(true);
    expect(compiled.review.carryForwardSummary).toBeTruthy();
  });

  it("promotes recurring pending-significance memories into durable long-term memory", () => {
    const compiled = compileMemoryState({
      sessionId: "session-a",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "session-a",
          messages: [userMessage("Track the memory compiler plan.")],
        }),
        longTermMemory: [],
        pendingSignificance: [
          pendingEntry({
            id: "pending-1",
            category: "fact",
            text: "The memory compiler should review pending significance during each integration pass.",
            strength: 0.76,
            evidence: ["first observation"],
            sourceType: "user_stated",
            confidence: 0.82,
            compressionState: "active",
          }),
        ],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      messages: [
        userMessage(
          "The memory compiler should review pending significance during each integration pass and promote recurring items.",
        ),
      ],
    });

    expect(
      compiled.longTermMemory.some((entry) =>
        entry.text.includes("review pending significance during each integration pass"),
      ),
    ).toBe(true);
    expect(compiled.pendingSignificance).toHaveLength(0);
  });

  it("reactivates latent memories when the current turn matches them again", () => {
    const oldTimestamp = Date.now() - 1000 * 60 * 60 * 24 * 45;
    const compiled = compileMemoryState({
      sessionId: "session-a",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "session-a",
          messages: [],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-latent",
            category: "strategy",
            text: "Memory compaction should preserve unresolved loops and repo-state facts.",
            strength: 0.7,
            evidence: ["prior project lesson"],
            sourceType: "summary_derived",
            confidence: 0.76,
            compressionState: "latent",
            createdAt: oldTimestamp,
            lastConfirmedAt: oldTimestamp,
            updatedAt: oldTimestamp,
          }),
        ],
        pendingSignificance: [],
        graph: {
          nodes: [
            {
              id: "ltm-artifact-base",
              kind: "memory",
              category: "strategy",
              summary: "The main memory integration work lives in src/context-engine/memory-system.ts.",
              confidence: 0.8,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-artifact-related",
              kind: "memory",
              category: "episode",
              summary: "Previous fix in src/context-engine/memory-system.ts preserved carry-forward behavior.",
              confidence: 0.8,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "artifact:src/context-engine/memory-system.ts",
              kind: "artifact",
              category: "entity",
              summary: "src/context-engine/memory-system.ts",
              artifactRef: "src/context-engine/memory-system.ts",
              confidence: 0.8,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
          ],
          edges: [
            {
              from: "ltm-artifact-base",
              to: "artifact:src/context-engine/memory-system.ts",
              type: "linked_to",
              weight: 0.82,
              updatedAt: Date.now(),
            },
            {
              from: "artifact:src/context-engine/memory-system.ts",
              to: "ltm-artifact-related",
              type: "linked_to",
              weight: 0.82,
              updatedAt: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        },
        permanentMemory: permanentRoot(),
      },
      messages: [
        userMessage("Compaction should preserve unresolved loops and repo state while we integrate memory."),
      ],
    });

    const latent = compiled.longTermMemory.find((entry) => entry.id === "ltm-latent");
    expect(latent?.compressionState).toBe("stable");
    expect(compiled.compilerNotes.some((note) => note.includes("reactivated"))).toBe(true);
  });

  it("retrieval packet includes audit data and task-mode detection", () => {
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "session-a",
          messages: [userMessage("We need to implement the context engine and fix tests.")],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-1",
            category: "decision",
            text: "Use memory-system as the default context engine.",
            strength: 0.95,
            evidence: ["decision"],
            sourceType: "user_stated",
            confidence: 0.95,
            importanceClass: "critical",
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      { messages: [userMessage("Implement the context engine compiler and tests.")] },
    );

    expect(packet.taskMode).toBe("coding");
    expect(packet.accessedLongTermIds).toContain("ltm-1");
    expect(packet.text).toContain("Retrieval audit");
  });

  it("expands retrieval through related memories and includes continuity output", () => {
    const workingMemory = buildWorkingMemorySnapshot({
      sessionId: "session-a",
      messages: [userMessage("Continue the memory-system context assembly work next session.")],
    });
    workingMemory.carryForwardSummary =
      "Continue memory-system context assembly work, preserve unresolved review items, and check linked patterns.";
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory,
        longTermMemory: [
          longTermEntry({
            id: "ltm-primary",
            category: "strategy",
            text: "Memory-system context assembly should preserve unresolved review items.",
            relations: [{ type: "relevant_to", targetMemoryId: "ltm-related", weight: 0.82 }],
          }),
          longTermEntry({
            id: "ltm-ranked",
            category: "decision",
            text: "Continue memory-system context assembly work next session and preserve the migration plan.",
            strength: 0.91,
          }),
          longTermEntry({
            id: "ltm-ranked-2",
            category: "fact",
            text: "The current migration plan keeps memory-system as the default context engine for the next session.",
            strength: 0.89,
          }),
          longTermEntry({
            id: "ltm-ranked-3",
            category: "strategy",
            text: "Next session should continue the migration plan and preserve context-engine continuity checks.",
            strength: 0.88,
          }),
          longTermEntry({
            id: "ltm-related",
            category: "pattern",
            text: "Linked pattern memory for archived support signals with low direct lexical overlap.",
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      { messages: [userMessage("Continue memory-system context assembly and linked pattern review.")] },
    );

    expect(packet.text).toContain("Related memory expansion");
    expect(packet.text).toContain("Session continuity output");
    expect(packet.accessedLongTermIds).toContain("ltm-related");
  });

  it("uses task-mode-specific graph expansion priorities", () => {
    const supportPacket = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "support-a",
          messages: [userMessage("Support ticket: confirm the customer install fix and next action.")],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-base",
            category: "fact",
            text: "User issue remains unresolved after the initial install fix.",
            relations: [
              { sourceMemoryId: "ltm-base", type: "confirmed_by", targetMemoryId: "ltm-confirmed", weight: 0.9 },
              { sourceMemoryId: "ltm-base", type: "derived_from", targetMemoryId: "ltm-derived", weight: 0.95 },
            ],
          }),
          longTermEntry({
            id: "ltm-confirmed",
            category: "episode",
            text: "Call transcript verified the root cause after agent handoff.",
          }),
          longTermEntry({
            id: "ltm-direct-2",
            category: "fact",
            text: "Customer install profile requires preserving the next support action in memory.",
            strength: 0.9,
          }),
          longTermEntry({
            id: "ltm-direct-3",
            category: "decision",
            text: "Support workflow should confirm the customer-facing fix before closing the ticket.",
            strength: 0.88,
          }),
          longTermEntry({
            id: "ltm-direct-4",
            category: "fact",
            text: "Customer support notes should preserve install status and next support action.",
            strength: 0.87,
          }),
          longTermEntry({
            id: "ltm-derived",
            category: "pattern",
            text: "Refactor-oriented code pattern unrelated to customer support resolution wording.",
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      { messages: [userMessage("Customer support ticket: confirm the actual install fix and resolution.")] },
    );

    expect(supportPacket.text).toContain("Related memory expansion");
    const expandedItems = supportPacket.retrievalItems.filter((item) =>
      item.reason.includes("graph expansion"),
    );
    expect(expandedItems[0]?.text).toContain("Call transcript verified");
  });

  it("uses version/profile/artifact scope during retrieval ranking", () => {
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "scope-a",
          messages: [
            userMessage(
              "For customer acme on install profile profile-a, fix v2026.3.13-1 in src/context-engine/memory-system.ts on linux.",
            ),
          ],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-scoped",
            category: "fact",
            text: "Customer acme uses install profile profile-a and the fix lives in src/context-engine/memory-system.ts for v2026.3.13-1 on linux.",
            versionScope: "v2026.3.13-1",
            installProfileScope: "profile-a",
            customerScope: "acme",
            environmentTags: ["linux"],
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.78,
          }),
          longTermEntry({
            id: "ltm-unscoped",
            category: "fact",
            text: "Generic migration note with no scoped artifact.",
            strength: 0.9,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      {
        messages: [
          userMessage(
            "Customer acme on install profile profile-a needs the v2026.3.13-1 linux fix in src/context-engine/memory-system.ts.",
          ),
        ],
      },
    );

    expect(packet.text).toContain("Scope notes");
    expect(packet.text).toContain("Relevant files and artifacts");
    expect(packet.accessedLongTermIds[0]).toBe("ltm-scoped");
  });

  it("captures structured runtime scope during compilation", () => {
    const compiled = compileMemoryState({
      sessionId: "runtime-a",
      messages: [userMessage("The memory system must preserve the current migration constraint.")],
      runtimeContext: {
        provider: "openai",
        model: "gpt-5",
        messageProvider: "slack",
        authProfileId: "profile-runtime",
        activeArtifacts: ["runtime-artifact.md", "src/runtime/known.ts"],
        workspaceTags: ["workspace", "tmp-workspace"],
        extraSystemPrompt:
          "Use src/context-engine/memory-system.ts as the authoritative artifact for v2026.3.13-1.",
      },
      sessionFile: "/tmp/session.jsonl",
    });

    const durable = compiled.longTermMemory.find((entry) =>
      entry.text.includes("preserve the current migration constraint"),
    );
    expect(durable?.installProfileScope).toBe("profile-runtime");
    expect(durable?.environmentTags).toContain("provider:openai");
    expect(durable?.environmentTags).toContain("tmp-workspace");
    expect(durable?.artifactRefs).toContain("src/context-engine/memory-system.ts");
    expect(durable?.artifactRefs).toContain("runtime-artifact.md");
    expect(durable?.artifactRefs).toContain("src/runtime/known.ts");
    expect(durable?.artifactRefs).toContain("session.jsonl");
  });

  it("builds first-class artifact nodes in the memory graph", () => {
    const compiled = compileMemoryState({
      sessionId: "artifact-a",
      messages: [
        userMessage(
          "The main memory integration work lives in src/context-engine/memory-system.ts and previous fixes preserved carry-forward behavior there.",
        ),
      ],
    });

    expect(compiled.graph.nodes.some((node) => node.kind === "artifact")).toBe(true);
    expect(
      compiled.graph.nodes.some((node) => node.artifactRef === "src/context-engine/memory-system.ts"),
    ).toBe(true);
    expect(
      compiled.graph.edges.some(
        (edge) => edge.from.startsWith("artifact:") || edge.to.startsWith("artifact:"),
      ),
    ).toBe(true);
  });

  it("adds artifact references into the permanent memory tree", () => {
    const compiled = compileMemoryState({
      sessionId: "artifact-tree-a",
      messages: [
        userMessage(
          "The fix for v2026.3.13-1 lives in src/context-engine/memory-system.ts and docs/memory-system-integration.md.",
        ),
      ],
    });

    const projects = compiled.permanentMemory.children.find((child) => child.label === "projects");
    const currentBot = projects?.children.find((child) => child.label === "current-bot");
    const artifacts = currentBot?.children.find((child) => child.label === "artifacts");

    expect(artifacts?.children.some((child) => child.summary === "src/context-engine/memory-system.ts")).toBe(true);
    expect(
      artifacts?.children.some((child) => child.summary === "docs/memory-system-integration.md"),
    ).toBe(true);
  });

  it("extracts generalized pattern memories and marks superseded memories", () => {
    const compiled = compileMemoryState({
      sessionId: "session-a",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "session-a",
          messages: [],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-old",
            category: "strategy",
            text: "Use legacy compaction instructions for memory-system context assembly.",
            updatedAt: Date.now() - 1000 * 60 * 60,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      messages: [
        userMessage("Memory-system context assembly should preserve compaction instructions across active sessions."),
        userMessage("Memory-system context assembly should preserve compaction summaries across active sessions."),
        userMessage("Use memory-system context assembly instead of legacy compaction instructions because the legacy path is now obsolete."),
      ],
    });

    expect(compiled.longTermMemory.some((entry) => entry.category === "pattern")).toBe(true);
    expect(compiled.longTermMemory.find((entry) => entry.id === "ltm-old")?.activeStatus).toBe(
      "superseded",
    );
    expect(compiled.compilerNotes.some((note) => note.includes("generalized pattern"))).toBe(true);
    expect(
      compiled.longTermMemory.find((entry) => entry.id === "ltm-old")?.relations.some(
        (relation) => relation.type === "superseded_by",
      ),
    ).toBe(true);
    expect(compiled.graph.edges.length).toBeGreaterThan(0);
  });

  it("sleep review prepares carry-forward output and archives latent superseded memory", () => {
    const reviewed = runMemorySleepReview({
      sessionId: "session-a",
      snapshot: {
        workingMemory: {
          ...buildWorkingMemorySnapshot({
            sessionId: "session-a",
            messages: [userMessage("Continue the memory review work tomorrow.")],
          }),
          carryForwardSummary: undefined,
        },
        longTermMemory: [
          longTermEntry({
            id: "ltm-archivable",
            text: "Legacy workaround is obsolete after the permanent fix.",
            activeStatus: "superseded",
            compressionState: "latent",
          }),
        ],
        pendingSignificance: [pendingEntry({ id: "pending-review", text: "Review carry-forward heuristics." })],
        permanentMemory: permanentRoot(),
        graph: emptyGraph(),
      },
    });

    expect(reviewed.workingMemory.carryForwardSummary).toBeTruthy();
    expect(reviewed.longTermMemory.find((entry) => entry.id === "ltm-archivable")?.activeStatus).toBe(
      "archived",
    );
    expect(reviewed.review.archivedMemoryIds).toContain("ltm-archivable");
  });
});

describe("MemorySystemContextEngine", () => {
  it("persists working, long-term, and permanent memory after a turn and rehydrates it on assemble", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-system-"));
    process.chdir(tempDir);

    const engine = new MemorySystemContextEngine();
    const messages = [
      userMessage("We are building a new bot on top of OpenClaw."),
      userMessage("We will use three layers: short-term context, long-term memory, and a permanent node tree."),
      userMessage("Revert to tag v2026.3.13-1, then remove .git and create a new git repo."),
    ];

    await engine.afterTurn({
      sessionId: "sess-1",
      sessionKey: "agent:main",
      sessionFile: path.join(tempDir, "session.jsonl"),
      messages,
      prePromptMessageCount: 0,
      runtimeContext: { workspaceDir: tempDir },
    });

    const snapshot = await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId: "agent:main",
    });
    expect(snapshot.workingMemory.activeGoals.length).toBeGreaterThan(0);
    expect(snapshot.workingMemory.carryForwardSummary).toBeTruthy();
    expect(snapshot.longTermMemory.length).toBeGreaterThan(0);
    expect(snapshot.graph.nodes.length).toBeGreaterThan(0);
    expect(snapshot.permanentMemory.children.length).toBeGreaterThan(0);

    const assembled = await engine.assemble({
      sessionId: "sess-1",
      sessionKey: "agent:main",
      messages,
    });
    expect(assembled.systemPromptAddition).toContain("Integrated memory packet");
    expect(assembled.systemPromptAddition).toContain(
      "Relevant entities, constraints, and structural memory",
    );

    const memoryRoot = path.join(tempDir, MEMORY_SYSTEM_DIRNAME);
    await expect(fs.stat(memoryRoot)).resolves.toBeTruthy();
  });

  it("runs explicit review and persists the reviewed state", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-review-"));
    process.chdir(tempDir);

    const engine = new MemorySystemContextEngine();
    await engine.afterTurn({
      sessionId: "sess-review",
      sessionKey: "agent:review",
      sessionFile: path.join(tempDir, "session.jsonl"),
      messages: [userMessage("Continue the migration review next session and preserve unresolved items.")],
      prePromptMessageCount: 0,
      runtimeContext: { workspaceDir: tempDir },
    });

    const reviewed = await engine.review?.({
      sessionId: "sess-review",
      sessionKey: "agent:review",
      sessionFile: path.join(tempDir, "session.jsonl"),
      runtimeContext: { workspaceDir: tempDir },
      reason: "manual",
    });

    const snapshot = await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId: "agent:review",
    });
    expect(reviewed?.reviewed).toBe(true);
    expect(snapshot.workingMemory.carryForwardSummary).toBeTruthy();
  });
});
