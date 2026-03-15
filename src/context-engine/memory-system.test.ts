import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { afterEach, describe, expect, it } from "vitest";
import { buildAgenticExecutionState } from "../agents/pi-embedded-runner/run/agentic-state.js";
import { requireNodeSqlite } from "../memory/sqlite.js";
import {
  buildMemoryContextPacket,
  buildWorkingMemorySnapshot,
  compileMemoryState,
  deriveLongTermMemoryCandidates,
  exportMemoryStoreBundle,
  generateMemoryDiagnosticsReport,
  formatMemoryDiagnosticsReport,
  formatMemoryAcceptanceReport,
  importMemoryStoreBundle,
  inspectMemoryStoreHealth,
  inspectMemoryRetrievalObservability,
  loadMemoryStoreSnapshot,
  MEMORY_SYSTEM_DIRNAME,
  persistMemoryStoreSnapshot,
  recoverMemoryStoreFromBackup,
  recoverMemoryStoreFromBackupWithReport,
  repairMemoryStoreSnapshot,
  repairMemoryStoreSnapshotWithReport,
  retrieveMemoryContextPacket,
  runMemoryAcceptanceSuite,
  runMemorySleepReview,
} from "./memory-system-store.js";
import type {
  LongTermMemoryEntry,
  MemoryAcceptanceScenarioResult,
  PendingMemoryEntry,
  PermanentMemoryNode,
} from "./memory-system-store.js";
import { MemorySystemContextEngine } from "./memory-system.js";

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
  const category = overrides.category ?? "strategy";
  const text = overrides.text ?? "Default durable memory.";
  return {
    id: "ltm-default",
    semanticKey: `test::${category}::${text.toLowerCase()}`,
    conceptKey: `concept::${category}::${text.toLowerCase()}`,
    canonicalText: text.toLowerCase(),
    conceptAliases: [text],
    ontologyKind:
      category === "decision"
        ? "constraint"
        : category === "pattern" || category === "strategy"
          ? "pattern"
          : category === "episode"
            ? "outcome"
            : category === "entity"
              ? "entity"
              : category === "preference"
                ? "preference"
                : "fact",
    category,
    text,
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
    adjudicationStatus: "authoritative",
    revisionCount: 0,
    lastRevisionKind: "new",
    permanenceStatus: "deferred",
    permanenceReasons: [],
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
      overrides.pendingReason ??
      "needs recurrence or stronger confirmation before durable promotion",
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

function findPermanentNodeBySummary(
  node: PermanentMemoryNode,
  pattern: string | RegExp,
): PermanentMemoryNode | undefined {
  const matches =
    typeof pattern === "string"
      ? node.summary?.includes(pattern)
      : Boolean(node.summary && pattern.test(node.summary));
  if (matches) {
    return node;
  }
  for (const child of node.children) {
    const match = findPermanentNodeBySummary(child, pattern);
    if (match) {
      return match;
    }
  }
  return undefined;
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
    expect(candidates.durable[0]?.semanticKey).toBeTruthy();
    expect(candidates.durable[0]?.ontologyKind).toBeTruthy();
  });

  it("builds a compact outward-facing memory packet", () => {
    const packet = buildMemoryContextPacket({
      workingMemory: buildWorkingMemorySnapshot({
        sessionId: "session-a",
        messages: [
          userMessage(
            "We are building a new bot with short-term, long-term, and permanent memory.",
          ),
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
    expect(compiled.permanentMemory.children.some((child) => child.label === "projects")).toBe(
      true,
    );
    expect(Array.isArray(compiled.pendingSignificance)).toBe(true);
    expect(compiled.review.carryForwardSummary).toBeTruthy();
  });

  it("captures runtime tool signals as durable memory candidates", () => {
    const compiled = compileMemoryState({
      sessionId: "session-runtime-signals",
      messages: [userMessage("Continue the memory runtime integration work.")],
      runtimeContext: {
        toolSignals: [
          {
            toolName: "write",
            status: "success",
            summary: "Updated src/context-engine/memory-system.ts to persist runtime state.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
          },
        ],
      },
    });

    const runtimeEntry = compiled.longTermMemory.find((entry) =>
      entry.text.includes("Tool write observed during runtime"),
    );

    expect(runtimeEntry?.sourceType).toBe("direct_observation");
    expect(runtimeEntry?.artifactRefs).toContain("src/context-engine/memory-system.ts");
    expect(runtimeEntry?.environmentTags).toContain("tool:write");
    expect(runtimeEntry?.environmentTags).toContain("tool-status:success");
    expect(compiled.compilerNotes).toContain("captured 1 runtime signal memories");
  });

  it("captures prompt construction failures as critical runtime memories", () => {
    const compiled = compileMemoryState({
      sessionId: "session-runtime-prompt-error",
      messages: [userMessage("Continue the memory runtime integration work.")],
      runtimeContext: {
        promptErrorSummary: "token budget exceeded while building the runtime prompt",
      },
    });

    const promptErrorEntry = compiled.longTermMemory.find((entry) =>
      entry.text.includes("Prompt construction failed during runtime"),
    );

    expect(promptErrorEntry?.category).toBe("episode");
    expect(promptErrorEntry?.sourceType).toBe("direct_observation");
    expect(promptErrorEntry?.importanceClass).toBe("critical");
    expect(promptErrorEntry?.environmentTags).toContain("runtime:prompt-error");
    expect(compiled.compilerNotes).toContain("captured 1 runtime signal memories");
  });

  it("captures runtime checkpoint, diff, and branch transition memories", () => {
    const compiled = compileMemoryState({
      sessionId: "session-runtime-events",
      previous: {
        workingMemory: {
          ...buildWorkingMemorySnapshot({
            sessionId: "session-runtime-events",
            messages: [],
          }),
          lastWorkspaceBranch: "feature/memory-v1",
        },
        longTermMemory: [],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      messages: [userMessage("Continue the runtime integration work.")],
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
        diffSignals: [
          {
            artifactRef: "src/context-engine/memory-system-store.ts",
            changeKind: "modified",
            summary:
              "Updated src/context-engine/memory-system-store.ts to ingest runtime checkpoint signals.",
          },
        ],
        checkpointSignals: [
          {
            kind: "completion",
            summary:
              "The memory-runtime integration checkpoint is completed for src/context-engine/memory-system-store.ts.",
            artifactRefs: ["src/context-engine/memory-system-store.ts"],
          },
        ],
      },
    });

    expect(compiled.workingMemory.lastWorkspaceBranch).toBe("feature/memory-v2");
    expect(
      compiled.longTermMemory.some((entry) =>
        entry.text.includes(
          "Workspace git branch changed from feature/memory-v1 to feature/memory-v2",
        ),
      ),
    ).toBe(true);
    expect(
      compiled.longTermMemory.some((entry) =>
        entry.text.includes(
          "Artifact src/context-engine/memory-system-store.ts was modified during runtime",
        ),
      ),
    ).toBe(true);
    expect(
      compiled.longTermMemory.some((entry) =>
        entry.text.includes("Runtime completion checkpoint recorded"),
      ),
    ).toBe(true);
  });

  it("captures runtime retry signals as durable memory", () => {
    const compiled = compileMemoryState({
      sessionId: "session-runtime-retries",
      messages: [userMessage("Continue the runtime integration work.")],
      runtimeContext: {
        retrySignals: [
          {
            phase: "overflow",
            outcome: "failed",
            attempt: 2,
            maxAttempts: 3,
            summary: "Overflow recovery ended with compaction failure.",
          },
        ],
      },
    });

    const retryEntry = compiled.longTermMemory.find((entry) =>
      entry.text.includes("Runtime overflow retry failed"),
    );

    expect(retryEntry?.sourceType).toBe("direct_observation");
    expect(retryEntry?.importanceClass).toBe("critical");
    expect(retryEntry?.environmentTags).toContain("runtime:retry");
    expect(retryEntry?.environmentTags).toContain("retry:overflow");
    expect(retryEntry?.environmentTags).toContain("retry-outcome:failed");
  });

  it("gates permanent-memory promotion through explicit permanence policy", () => {
    const compiled = compileMemoryState({
      sessionId: "permanence-policy-a",
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for all migrations.",
        ),
        userMessage(
          "The current session is a migration-planning session for memory compiler notes.",
        ),
        userMessage(
          "Do not use the permanent memory-system path in src/context-engine/memory-system.ts during transcript debugging.",
        ),
      ],
    });

    const constraint = compiled.longTermMemory.find((entry) =>
      entry.text.includes("permanent memory-system path"),
    );
    const discussedFact = compiled.longTermMemory.find((entry) =>
      entry.text.includes("current session is a migration-planning session"),
    );

    expect(compiled.review.permanentEligibleIds.length).toBeGreaterThan(0);
    expect(compiled.review.permanentBlockedIds.length).toBeGreaterThan(0);
    expect(constraint?.permanenceStatus).toMatch(/eligible|blocked/);
    expect(discussedFact?.permanenceStatus).toBe("deferred");
    expect(
      findPermanentNodeBySummary(
        compiled.permanentMemory,
        "current session is a migration-planning session",
      ),
    ).toBe(undefined);
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
              summary:
                "The main memory integration work lives in src/context-engine/memory-system.ts.",
              confidence: 0.8,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-artifact-related",
              kind: "memory",
              category: "episode",
              summary:
                "Previous fix in src/context-engine/memory-system.ts preserved carry-forward behavior.",
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
        userMessage(
          "Compaction should preserve unresolved loops and repo state while we integrate memory.",
        ),
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
    expect(packet.accessedConceptIds.length).toBeGreaterThan(0);
    expect(packet.text).toContain("Retrieval audit");
  });

  it("deduplicates retrieval at the concept level while preserving concept ids", () => {
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "concept-dedupe-a",
          messages: [userMessage("Use the permanent memory-system path for this migration.")],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-concept-a",
            conceptKey: "concept::constraint::memory-path",
            canonicalText: "use permanent memory-system path",
            conceptAliases: [
              "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
              "The permanent path for memory-system integration should be used.",
            ],
            text: "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.92,
          }),
          longTermEntry({
            id: "ltm-concept-b",
            conceptKey: "concept::constraint::memory-path",
            canonicalText: "use permanent memory-system path",
            conceptAliases: [
              "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
              "The permanent path for memory-system integration should be used.",
            ],
            text: "The permanent path for memory-system integration should be used.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.88,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      { messages: [userMessage("Plan the permanent memory-system path rollout.")] },
    );

    const ranked = packet.retrievalItems.filter(
      (item) => item.kind === "long-term" && item.reason.includes("relevance="),
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.conceptId).toBeTruthy();
    expect(packet.accessedConceptIds).toHaveLength(1);
  });

  it("surfaces adjudication rationale in concept-ranked retrieval", () => {
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "adjudication-ranked-a",
          messages: [userMessage("Plan the permanent memory-system path rollout.")],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-adj-winner",
            conceptKey: "concept::constraint::memory-path",
            canonicalText: "use permanent memory-system path",
            conceptAliases: ["Use the permanent memory-system path."],
            text: "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
            confidence: 0.95,
            strength: 0.95,
            revisionCount: 2,
            lastRevisionKind: "updated",
          }),
          longTermEntry({
            id: "ltm-adj-loser",
            conceptKey: "concept::constraint::memory-path",
            canonicalText: "use permanent memory-system path",
            conceptAliases: ["Use the permanent memory-system path."],
            text: "Use the permanent path for memory-system integration.",
            confidence: 0.74,
            strength: 0.7,
            revisionCount: 1,
            lastRevisionKind: "reasserted",
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      { messages: [userMessage("Plan the permanent memory-system path rollout.")] },
    );

    const ranked = packet.retrievalItems.find(
      (item) => item.kind === "long-term" && item.memoryId === "ltm-adj-winner",
    );
    expect(ranked?.reason).toContain("adjudication=authoritative:winner");
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
      {
        messages: [
          userMessage("Continue memory-system context assembly and linked pattern review."),
        ],
      },
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
          messages: [
            userMessage("Support ticket: confirm the customer install fix and next action."),
          ],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-base",
            category: "fact",
            text: "User issue remains unresolved after the initial install fix.",
            relations: [
              {
                sourceMemoryId: "ltm-base",
                type: "confirmed_by",
                targetMemoryId: "ltm-confirmed",
                weight: 0.9,
              },
              {
                sourceMemoryId: "ltm-base",
                type: "derived_from",
                targetMemoryId: "ltm-derived",
                weight: 0.95,
              },
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
      {
        messages: [
          userMessage("Customer support ticket: confirm the actual install fix and resolution."),
        ],
      },
    );

    expect(supportPacket.text).toContain("Related memory expansion");
    const expandedItems = supportPacket.retrievalItems.filter((item) =>
      item.reason.includes("related expansion"),
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

  it("surfaces downgraded memory state in ranked retrieval output", () => {
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "state-aware-a",
          messages: [
            userMessage(
              "Plan the replacement for the old memory-system workaround in src/context-engine/memory-system.ts.",
            ),
          ],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-superseded",
            category: "strategy",
            text: "Old memory-system workaround for src/context-engine/memory-system.ts before the permanent fix.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            activeStatus: "superseded",
            contradictionCount: 1,
            supersededById: "ltm-new",
            strength: 0.84,
          }),
          longTermEntry({
            id: "ltm-new",
            category: "decision",
            text: "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the workaround.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.95,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      {
        messages: [
          userMessage(
            "Plan the replacement for the old memory-system workaround in src/context-engine/memory-system.ts.",
          ),
        ],
      },
    );

    expect(packet.text).toContain("downgraded: superseded, contradicted x1");
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.memoryId === "ltm-superseded" &&
          item.reason.includes("downgraded=superseded,contradicted x1"),
      ),
    ).toBe(true);
  });

  it("surfaces artifact-anchored constraints, patterns, and outcomes", () => {
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "artifact-anchor-a",
          messages: [
            userMessage(
              "Use src/context-engine/memory-system.ts to preserve the migration constraint and inspect the restored outcome.",
            ),
          ],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-constraint",
            category: "decision",
            text: "Use src/context-engine/memory-system.ts as the canonical integration path and preserve the migration constraint.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.94,
          }),
          longTermEntry({
            id: "ltm-pattern",
            category: "pattern",
            text: "Pattern memory: repeated integration safeguards around src/context-engine/memory-system.ts preserve carry-forward behavior.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.9,
          }),
          longTermEntry({
            id: "ltm-outcome",
            category: "episode",
            text: "The previous fix in src/context-engine/memory-system.ts restored carry-forward output after regression.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.88,
          }),
        ],
        pendingSignificance: [],
        graph: {
          nodes: [
            {
              id: "ltm-constraint",
              kind: "memory",
              category: "decision",
              summary: "Use src/context-engine/memory-system.ts as the canonical integration path.",
              confidence: 0.95,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-pattern",
              kind: "memory",
              category: "pattern",
              summary: "Pattern memory for integration safeguards.",
              confidence: 0.9,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-outcome",
              kind: "memory",
              category: "episode",
              summary: "Previous fix restored carry-forward output.",
              confidence: 0.88,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "artifact:src/context-engine/memory-system.ts",
              kind: "artifact",
              category: "entity",
              summary: "src/context-engine/memory-system.ts",
              artifactRef: "src/context-engine/memory-system.ts",
              confidence: 0.95,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
          ],
          edges: [
            {
              from: "artifact:src/context-engine/memory-system.ts",
              to: "ltm-constraint",
              type: "relevant_to",
              weight: 0.9,
              updatedAt: Date.now(),
            },
            {
              from: "artifact:src/context-engine/memory-system.ts",
              to: "ltm-pattern",
              type: "derived_from",
              weight: 0.92,
              updatedAt: Date.now(),
            },
            {
              from: "artifact:src/context-engine/memory-system.ts",
              to: "ltm-outcome",
              type: "confirmed_by",
              weight: 0.88,
              updatedAt: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        },
        permanentMemory: permanentRoot(),
      },
      {
        messages: [
          userMessage(
            "Use src/context-engine/memory-system.ts to preserve the migration constraint and inspect the previous restored outcome.",
          ),
        ],
      },
    );

    expect(packet.text).toContain("Artifact-anchored constraints, patterns, and outcomes");
    expect(packet.text).toContain("constraint:");
    expect(packet.text).toContain("pattern:");
    expect(packet.text).toContain("outcome:");
    expect(packet.accessedLongTermIds).toContain("ltm-constraint");
    expect(packet.accessedLongTermIds).toContain("ltm-pattern");
    expect(packet.accessedLongTermIds).toContain("ltm-outcome");
  });

  it("expands from active artifacts into adjacent fixes and supersessions", () => {
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "artifact-traversal-a",
          messages: [
            userMessage(
              "Debug src/context-engine/memory-system.ts and check the latest fix that replaced the old workaround.",
            ),
          ],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-anchor",
            category: "decision",
            text: "Use src/context-engine/memory-system.ts as the canonical integration path.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.94,
          }),
          longTermEntry({
            id: "ltm-fix",
            category: "episode",
            text: "The latest fix in src/context-engine/memory-system.ts restored carry-forward output after regression.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.9,
            relations: [
              {
                sourceMemoryId: "ltm-fix",
                type: "superseded_by",
                targetMemoryId: "ltm-old-workaround",
                weight: 0.91,
              },
            ],
          }),
          longTermEntry({
            id: "ltm-old-workaround",
            category: "strategy",
            text: "Old workaround for memory-system carry-forward behavior before the permanent fix.",
            strength: 0.62,
            activeStatus: "superseded",
            contradictionCount: 1,
            supersededById: "ltm-fix",
          }),
          longTermEntry({
            id: "ltm-direct-a",
            category: "fact",
            text: "Debug review should preserve the latest regression trace for memory-system output.",
            strength: 0.91,
          }),
          longTermEntry({
            id: "ltm-direct-b",
            category: "decision",
            text: "Check the latest fix before changing the canonical integration path.",
            strength: 0.89,
          }),
        ],
        pendingSignificance: [],
        graph: {
          nodes: [
            {
              id: "ltm-anchor",
              kind: "memory",
              category: "decision",
              summary: "Canonical integration path.",
              confidence: 0.95,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-fix",
              kind: "memory",
              category: "episode",
              summary: "Latest fix restored carry-forward output.",
              confidence: 0.9,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-old-workaround",
              kind: "memory",
              category: "strategy",
              summary: "Old workaround before permanent fix.",
              confidence: 0.82,
              activeStatus: "superseded",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-direct-a",
              kind: "memory",
              category: "fact",
              summary: "Preserve latest regression trace.",
              confidence: 0.91,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-direct-b",
              kind: "memory",
              category: "decision",
              summary: "Check latest fix before changing path.",
              confidence: 0.89,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "artifact:src/context-engine/memory-system.ts",
              kind: "artifact",
              category: "entity",
              summary: "src/context-engine/memory-system.ts",
              artifactRef: "src/context-engine/memory-system.ts",
              confidence: 0.95,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
          ],
          edges: [
            {
              from: "artifact:src/context-engine/memory-system.ts",
              to: "ltm-anchor",
              type: "relevant_to",
              weight: 0.9,
              updatedAt: Date.now(),
            },
            {
              from: "artifact:src/context-engine/memory-system.ts",
              to: "ltm-fix",
              type: "confirmed_by",
              weight: 0.92,
              updatedAt: Date.now(),
            },
            {
              from: "ltm-fix",
              to: "ltm-old-workaround",
              type: "superseded_by",
              weight: 0.91,
              updatedAt: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        },
        permanentMemory: permanentRoot(),
      },
      {
        messages: [
          userMessage(
            "Debug src/context-engine/memory-system.ts and inspect the fix that replaced the old workaround.",
          ),
        ],
      },
    );

    expect(packet.text).toContain("Artifact traversal expansion");
    expect(packet.text).toContain("Old workaround for memory-system carry-forward behavior");
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.reason.includes(
            "artifact outcome traversal via superseded_by downgraded=superseded,contradicted x1",
          ) && item.memoryId === "ltm-old-workaround",
      ),
    ).toBe(true);
  });

  it("uses constraint facet traversal before unrelated outcome neighbors", () => {
    const packet = retrieveMemoryContextPacket(
      {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "artifact-facet-a",
          messages: [
            userMessage(
              "Plan updates for src/context-engine/memory-system.ts and preserve the migration constraint.",
            ),
          ],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-constraint-seed",
            category: "decision",
            text: "Use src/context-engine/memory-system.ts as the canonical migration constraint.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.95,
          }),
          longTermEntry({
            id: "ltm-constraint-neighbor",
            category: "decision",
            text: "The release checklist must keep the canonical implementation path intact during rollout handoff.",
            strength: 0.66,
          }),
          longTermEntry({
            id: "ltm-outcome-seed",
            category: "episode",
            text: "The latest fix in src/context-engine/memory-system.ts restored carry-forward output.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            strength: 0.9,
          }),
          longTermEntry({
            id: "ltm-outcome-neighbor",
            category: "episode",
            text: "The previous regression was resolved after the rollout fix landed.",
            strength: 0.8,
          }),
          longTermEntry({
            id: "ltm-direct-a",
            category: "fact",
            text: "Planning review should keep rollout notes visible.",
            strength: 0.91,
          }),
          longTermEntry({
            id: "ltm-direct-b",
            category: "decision",
            text: "Plan the next rollout before changing migration constraints.",
            strength: 0.89,
          }),
          longTermEntry({
            id: "ltm-direct-c",
            category: "fact",
            text: "Planning updates should preserve the current migration summary for the next rollout.",
            strength: 0.88,
          }),
          longTermEntry({
            id: "ltm-direct-d",
            category: "strategy",
            text: "Migration planning should keep the current rollout path visible before edits.",
            strength: 0.87,
          }),
        ],
        pendingSignificance: [],
        graph: {
          nodes: [
            {
              id: "ltm-constraint-seed",
              kind: "memory",
              category: "decision",
              summary: "Canonical migration constraint.",
              confidence: 0.95,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-constraint-neighbor",
              kind: "memory",
              category: "decision",
              summary: "Release checklist keeps canonical path intact.",
              confidence: 0.84,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-outcome-seed",
              kind: "memory",
              category: "episode",
              summary: "Latest fix restored carry-forward output.",
              confidence: 0.9,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-outcome-neighbor",
              kind: "memory",
              category: "episode",
              summary: "Regression resolved after rollout fix.",
              confidence: 0.8,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-direct-c",
              kind: "memory",
              category: "fact",
              summary: "Preserve current migration summary.",
              confidence: 0.88,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "ltm-direct-d",
              kind: "memory",
              category: "strategy",
              summary: "Keep rollout path visible before edits.",
              confidence: 0.87,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
            {
              id: "artifact:src/context-engine/memory-system.ts",
              kind: "artifact",
              category: "entity",
              summary: "src/context-engine/memory-system.ts",
              artifactRef: "src/context-engine/memory-system.ts",
              confidence: 0.95,
              activeStatus: "active",
              updatedAt: Date.now(),
            },
          ],
          edges: [
            {
              from: "artifact:src/context-engine/memory-system.ts",
              to: "ltm-constraint-seed",
              type: "relevant_to",
              weight: 0.93,
              updatedAt: Date.now(),
            },
            {
              from: "artifact:src/context-engine/memory-system.ts",
              to: "ltm-outcome-seed",
              type: "confirmed_by",
              weight: 0.9,
              updatedAt: Date.now(),
            },
            {
              from: "ltm-constraint-seed",
              to: "ltm-constraint-neighbor",
              type: "relevant_to",
              weight: 0.91,
              updatedAt: Date.now(),
            },
            {
              from: "ltm-outcome-seed",
              to: "ltm-outcome-neighbor",
              type: "confirmed_by",
              weight: 0.86,
              updatedAt: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        },
        permanentMemory: permanentRoot(),
      },
      {
        messages: [
          userMessage(
            "Plan updates for src/context-engine/memory-system.ts and preserve the migration constraint.",
          ),
        ],
      },
    );

    expect(packet.text).toContain("Artifact traversal expansion");
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.reason === "artifact constraint traversal via relevant_to" &&
          item.memoryId === "ltm-constraint-neighbor",
      ),
    ).toBe(true);
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.reason === "artifact outcome traversal via confirmed_by" &&
          item.memoryId === "ltm-outcome-neighbor",
      ),
    ).toBe(true);
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
      compiled.graph.nodes.some(
        (node) => node.artifactRef === "src/context-engine/memory-system.ts",
      ),
    ).toBe(true);
    expect(
      compiled.graph.edges.some(
        (edge) => edge.from.startsWith("artifact:") || edge.to.startsWith("artifact:"),
      ),
    ).toBe(true);
    expect(
      compiled.graph.edges.some(
        (edge) =>
          edge.to === "artifact:src/context-engine/memory-system.ts" &&
          edge.type === "confirmed_by",
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

    expect(
      artifacts?.children.some((child) => child.summary === "src/context-engine/memory-system.ts"),
    ).toBe(true);
    expect(
      artifacts?.children.some((child) => child.summary === "docs/memory-system-integration.md"),
    ).toBe(true);
  });

  it("adds artifact-scoped constraint and outcome branches into the permanent tree", () => {
    const compiled = compileMemoryState({
      sessionId: "artifact-tree-branches-a",
      messages: [
        userMessage(
          "Use src/context-engine/memory-system.ts as the required integration path for the migration constraint.",
        ),
        userMessage(
          "The previous fix in src/context-engine/memory-system.ts has restored carry-forward output after regression.",
        ),
      ],
    });

    const projects = compiled.permanentMemory.children.find((child) => child.label === "projects");
    const currentBot = projects?.children.find((child) => child.label === "current-bot");
    const artifacts = currentBot?.children.find((child) => child.label === "artifacts");
    const memorySystemArtifact = artifacts?.children.find(
      (child) => child.summary === "src/context-engine/memory-system.ts",
    );
    const constraints = memorySystemArtifact?.children.find(
      (child) => child.label === "constraints",
    );
    const outcomes = memorySystemArtifact?.children.find((child) => child.label === "outcomes");

    expect(
      constraints?.children.some((child) => child.summary?.includes("required integration path")),
    ).toBe(true);
    expect(
      outcomes?.children.some((child) =>
        child.summary?.includes("has restored carry-forward output"),
      ),
    ).toBe(true);
  });

  it("propagates superseded status into permanent memory leaves", () => {
    const compiled = compileMemoryState({
      sessionId: "permanent-state-a",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "permanent-state-a",
          messages: [],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-permanent-old",
            category: "strategy",
            text: "Use the old memory-system workaround in src/context-engine/memory-system.ts.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            updatedAt: Date.now() - 1000 * 60 * 60,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the old workaround.",
        ),
      ],
    });

    const oldLeaf = findPermanentNodeBySummary(
      compiled.permanentMemory,
      "old memory-system workaround",
    );

    expect(oldLeaf?.activeStatus).toBe("superseded");
    expect(oldLeaf?.relationToParent).toBe("superseded_by");
    expect(oldLeaf?.evidence.some((item) => item.includes("Superseded by durable memory"))).toBe(
      true,
    );
  });

  it("archives retired permanent leaves into a history branch", () => {
    const compiled = compileMemoryState({
      sessionId: "permanent-history-a",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "permanent-history-a",
          messages: [],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-history-old",
            category: "strategy",
            text: "Use the old memory-system workaround in src/context-engine/memory-system.ts.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            updatedAt: Date.now() - 1000 * 60 * 60,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the old workaround.",
        ),
      ],
    });

    const history = compiled.permanentMemory.children.find((child) => child.label === "history");
    const retired = history?.children.find((child) => child.label === "retired");
    const historicalLeaf = findPermanentNodeBySummary(
      retired ?? permanentRoot(),
      "old memory-system workaround",
    );

    expect(history).toBeTruthy();
    expect(retired).toBeTruthy();
    expect(historicalLeaf?.activeStatus).toBe("archived");
    expect(
      historicalLeaf?.evidence.some((item) => item.includes("Retained in permanent history")),
    ).toBe(true);
  });

  it("does not surface archived permanent leaves during normal retrieval", () => {
    const compiled = compileMemoryState({
      sessionId: "permanent-retrieval-archive-a",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "permanent-retrieval-archive-a",
          messages: [],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-archive-old",
            category: "strategy",
            text: "Use the old memory-system workaround in src/context-engine/memory-system.ts.",
            artifactRefs: ["src/context-engine/memory-system.ts"],
            updatedAt: Date.now() - 1000 * 60 * 60,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the old workaround.",
        ),
      ],
    });

    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [
        userMessage(
          "Plan the permanent memory-system path rollout in src/context-engine/memory-system.ts.",
        ),
      ],
    });

    expect(
      packet.retrievalItems.some(
        (item) =>
          item.reason.startsWith("stable permanent node tree branch") &&
          item.text.includes("old memory-system workaround"),
      ),
    ).toBe(false);
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
        userMessage(
          "Memory-system context assembly should preserve compaction instructions across active sessions.",
        ),
        userMessage(
          "Memory-system context assembly should preserve compaction summaries across active sessions.",
        ),
        userMessage(
          "Use memory-system context assembly instead of legacy compaction instructions because the legacy path is now obsolete.",
        ),
      ],
    });

    expect(compiled.longTermMemory.some((entry) => entry.category === "pattern")).toBe(true);
    expect(compiled.longTermMemory.find((entry) => entry.id === "ltm-old")?.activeStatus).toBe(
      "superseded",
    );
    expect(compiled.compilerNotes.some((note) => note.includes("generalized pattern"))).toBe(true);
    expect(compiled.review.supersededMemoryIds).toContain("ltm-old");
    expect(compiled.compilerNotes.some((note) => note.includes("review flagged"))).toBe(true);
    expect(
      compiled.longTermMemory
        .find((entry) => entry.id === "ltm-old")
        ?.relations.some((relation) => relation.type === "superseded_by"),
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
        pendingSignificance: [
          pendingEntry({ id: "pending-review", text: "Review carry-forward heuristics." }),
        ],
        permanentMemory: permanentRoot(),
        graph: emptyGraph(),
      },
    });

    expect(reviewed.workingMemory.carryForwardSummary).toBeTruthy();
    expect(
      reviewed.longTermMemory.find((entry) => entry.id === "ltm-archivable")?.activeStatus,
    ).toBe("archived");
    expect(reviewed.review.archivedMemoryIds).toContain("ltm-archivable");
    expect(reviewed.review.contradictoryMemoryIds).toEqual([]);
  });

  it("records contradiction and supersession pressure during review", () => {
    const compiled = compileMemoryState({
      sessionId: "review-pressure-a",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "review-pressure-a",
          messages: [],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-replace-old",
            category: "decision",
            text: "Use the old memory-system workaround for src/context-engine/memory-system.ts.",
            updatedAt: Date.now() - 1000 * 60 * 60,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the old workaround.",
        ),
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts and never drop carry-forward output.",
        ),
        userMessage(
          "Do not use the permanent memory-system path in src/context-engine/memory-system.ts when debugging old transcripts.",
        ),
      ],
    });

    expect(compiled.review.supersededMemoryIds).toContain("ltm-replace-old");
    expect(compiled.review.contradictoryMemoryIds.length).toBeGreaterThan(0);
    expect(compiled.review.supersededConceptIds.length).toBeGreaterThan(0);
    expect(compiled.review.contradictoryConceptIds.length).toBeGreaterThan(0);
    expect(compiled.review.contestedRevisionConceptIds.length).toBeGreaterThan(0);
    expect(compiled.review.revisedConceptIds.length).toBeGreaterThan(0);
    expect(compiled.workingMemory.carryForwardSummary).toContain("Contradictions need resolution");
    expect(compiled.workingMemory.carryForwardSummary).toContain("Concepts with contested");
  });
});

describe("MemorySystemContextEngine", () => {
  it("persists working, long-term, and permanent memory after a turn and rehydrates it on assemble", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-system-"));
    process.chdir(tempDir);

    const engine = new MemorySystemContextEngine();
    const messages = [
      userMessage("We are building a new bot on top of OpenClaw."),
      userMessage(
        "We will use three layers: short-term context, long-term memory, and a permanent node tree.",
      ),
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
    await expect(fs.stat(path.join(memoryRoot, "store-metadata.json"))).resolves.toBeTruthy();
  });

  it("runs explicit review and persists the reviewed state", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-review-"));
    process.chdir(tempDir);

    const engine = new MemorySystemContextEngine();
    await engine.afterTurn({
      sessionId: "sess-review",
      sessionKey: "agent:review",
      sessionFile: path.join(tempDir, "session.jsonl"),
      messages: [
        userMessage("Continue the migration review next session and preserve unresolved items."),
      ],
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
    expect(reviewed?.contradictoryMemoryIds).toEqual(expect.any(Array));
    expect(reviewed?.supersededMemoryIds).toEqual(expect.any(Array));
  });

  it("persists and reloads memory snapshots with the sqlite backend", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-sqlite-"));
    const sessionId = "agent:sqlite";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for all migrations.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-doc",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const loaded = await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-doc",
    });
    expect(loaded.longTermMemory[0]?.text).toContain("permanent memory-system path");
    await expect(
      fs.stat(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite")),
    ).resolves.toBeTruthy();
  });

  it("exports and imports memory store bundles across backends", async () => {
    const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-export-source-"));
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-export-target-"));
    const sessionId = "agent:bundle-export";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for all migrations.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: sourceDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const bundle = await exportMemoryStoreBundle({
      workspaceDir: sourceDir,
      sessionId,
      backendKind: "sqlite-graph",
    });
    await importMemoryStoreBundle({
      workspaceDir: targetDir,
      bundle,
      backendKind: "fs-json",
      targetSessionId: "agent:bundle-imported",
    });

    const imported = await loadMemoryStoreSnapshot({
      workspaceDir: targetDir,
      sessionId: "agent:bundle-imported",
      backendKind: "fs-json",
    });
    expect(bundle.metadata.backend).toBe("sqlite-graph");
    expect(imported.longTermMemory[0]?.text).toContain("permanent memory-system path");
  });

  it("recovers memory store state from backup after sqlite corruption", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-backup-recovery-"));
    const sessionId = "agent:bundle-recovery";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for all migrations.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    await fs.writeFile(
      path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite"),
      "not-a-valid-sqlite-db",
      "utf8",
    );

    const recovered = await recoverMemoryStoreFromBackup({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
      targetSessionId: "agent:bundle-recovered",
    });

    expect(recovered.longTermMemory[0]?.text).toContain("permanent memory-system path");
  });

  it("auto-recovers sqlite-graph loads from the session backup bundle", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-auto-recovery-"));
    const sessionId = "agent:auto-recovery";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for all migrations.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    await fs.writeFile(
      path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite"),
      "not-a-valid-sqlite-db",
      "utf8",
    );

    const loaded = await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
    });

    expect(loaded.longTermMemory[0]?.text).toContain("permanent memory-system path");
  });

  it("uses the sqlite backend when requested through runtime context", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-engine-sqlite-"));
    process.chdir(tempDir);

    const engine = new MemorySystemContextEngine();
    await engine.afterTurn({
      sessionId: "sess-sqlite",
      sessionKey: "agent:sqlite-runtime",
      sessionFile: path.join(tempDir, "session.jsonl"),
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for v2026.3.13-1.",
        ),
      ],
      prePromptMessageCount: 0,
      runtimeContext: { workspaceDir: tempDir, memoryStoreBackend: "sqlite-doc" },
    });

    const snapshot = await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId: "agent:sqlite-runtime",
      backendKind: "sqlite-doc",
    });
    expect(snapshot.longTermMemory.length).toBeGreaterThan(0);
    await expect(
      fs.stat(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite")),
    ).resolves.toBeTruthy();
  });

  it("persists structured rows with the sqlite-graph backend", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-sqlite-graph-"));
    const sessionId = "agent:sqlite-graph";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for all migrations.",
        ),
        userMessage(
          "The previous fix in src/context-engine/memory-system.ts restored carry-forward output.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const loaded = await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
    });
    expect(loaded.longTermMemory.length).toBeGreaterThan(0);
    expect(loaded.graph.nodes.length).toBeGreaterThan(0);
    expect(loaded.permanentMemory.children.length).toBeGreaterThan(0);
    await expect(
      fs.stat(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite")),
    ).resolves.toBeTruthy();

    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite"), {
      readOnly: true,
    });
    try {
      const conceptCount = db
        .prepare("SELECT COUNT(*) AS count FROM memory_concepts WHERE session_id = ?")
        .get(sessionId) as { count: number };
      const aliasCount = db
        .prepare("SELECT COUNT(*) AS count FROM memory_concept_aliases WHERE session_id = ?")
        .get(sessionId) as { count: number };
      const revisionCount = db
        .prepare("SELECT COUNT(*) AS count FROM memory_revisions WHERE session_id = ?")
        .get(sessionId) as { count: number };
      const adjudicationCount = db
        .prepare("SELECT COUNT(*) AS count FROM memory_adjudications WHERE session_id = ?")
        .get(sessionId) as { count: number };
      const conceptRow = db
        .prepare("SELECT canonical_text FROM memory_concepts WHERE session_id = ? LIMIT 1")
        .get(sessionId) as { canonical_text: string } | undefined;

      expect(conceptCount.count).toBeGreaterThan(0);
      expect(aliasCount.count).toBeGreaterThan(0);
      expect(revisionCount.count).toBeGreaterThan(0);
      expect(adjudicationCount.count).toBeGreaterThan(0);
      expect(conceptRow?.canonical_text).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it("sanitizes fs-json store metadata when the persisted backend marker is invalid", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-metadata-"));
    await fs.mkdir(path.join(tempDir, MEMORY_SYSTEM_DIRNAME), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "store-metadata.json"),
      JSON.stringify({ backend: "broken", version: 99, updatedAt: "nope" }),
      "utf8",
    );

    await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId: "agent:metadata-fs",
      backendKind: "fs-json",
    });

    const metadata = JSON.parse(
      await fs.readFile(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "store-metadata.json"), "utf8"),
    ) as {
      backend?: string;
      version?: number;
      longTermCount?: number;
      conceptCount?: number;
      permanentNodeCount?: number;
    };
    expect(metadata).toMatchObject({ backend: "fs-json", version: 1 });
    expect(typeof metadata.longTermCount).toBe("number");
    expect(typeof metadata.conceptCount).toBe("number");
    expect(typeof metadata.permanentNodeCount).toBe("number");
  });

  it("repairs persisted fs-json snapshots by rewriting sanitized long-term entries", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-repair-"));
    const storeDir = path.join(tempDir, MEMORY_SYSTEM_DIRNAME);
    await fs.mkdir(path.join(storeDir, "sessions"), { recursive: true });
    await fs.writeFile(
      path.join(storeDir, "sessions", "agent_repair.json"),
      JSON.stringify({
        sessionId: "agent:repair",
        updatedAt: Date.now(),
        rollingSummary: "",
        activeFacts: [],
        activeGoals: [],
        openLoops: [],
        recentEvents: [],
        recentDecisions: [],
      }),
      "utf8",
    );
    await fs.writeFile(
      path.join(storeDir, "long-term.json"),
      JSON.stringify([
        {
          id: "",
          category: "fact",
          text: "Repair should restore semantic keys and canonical text.",
          strength: 0.7,
          evidence: [],
          provenance: [],
          confidence: 0.8,
          importanceClass: "useful",
          compressionState: "stable",
          activeStatus: "active",
          adjudicationStatus: "authoritative",
          revisionCount: 0,
          lastRevisionKind: "new",
          permanenceStatus: "deferred",
          permanenceReasons: [],
          trend: "stable",
          accessCount: 0,
          createdAt: Date.now(),
          contradictionCount: 0,
          relatedMemoryIds: [],
          relations: [],
          environmentTags: [],
          artifactRefs: [],
          updatedAt: Date.now(),
        },
      ]),
      "utf8",
    );
    await fs.writeFile(path.join(storeDir, "pending-significance.json"), "[]", "utf8");
    await fs.writeFile(
      path.join(storeDir, "permanent-tree.json"),
      JSON.stringify(permanentRoot()),
      "utf8",
    );
    await fs.writeFile(
      path.join(storeDir, "memory-graph.json"),
      JSON.stringify(emptyGraph()),
      "utf8",
    );

    const repaired = await repairMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId: "agent:repair",
      backendKind: "fs-json",
    });

    expect(repaired.longTermMemory[0]?.semanticKey).toBeTruthy();
    expect(repaired.longTermMemory[0]?.conceptKey).toBeTruthy();
    expect(repaired.longTermMemory[0]?.canonicalText).toBeTruthy();
  });

  it("reports memory store health with contested and stale backlog signals", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-health-"));
    const sessionId = "agent:health";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
        userMessage(
          "Do not use the permanent memory-system path in src/context-engine/memory-system.ts.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const health = await inspectMemoryStoreHealth({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
    });

    expect(health.summary).toContain("backend=sqlite-graph");
    expect(health.contestedConceptCount).toBeGreaterThan(0);
    expect(health.contestedEntityConflictCount).toBeGreaterThanOrEqual(0);
    expect(health.fragileWinnerCount).toBeGreaterThanOrEqual(0);
    expect(health.sourceTypeCounts.user_stated).toBeGreaterThan(0);
    expect(health.authoritativeSourceTypeCounts.user_stated).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(health.issues)).toBe(true);
    expect(Array.isArray(health.recommendations)).toBe(true);
    expect(health.backupAvailable).toBe(true);
  });

  it("produces maintenance reports for repair and recovery actions", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-maintenance-"));
    const sessionId = "agent:maintenance";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const repaired = await repairMemoryStoreSnapshotWithReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
    });
    expect(repaired.report.action).toBe("repair");
    expect(repaired.report.summary).toContain("repair backend=sqlite-graph");

    await fs.writeFile(
      path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite"),
      "broken",
      "utf8",
    );

    const recovered = await recoverMemoryStoreFromBackupWithReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
    });
    expect(recovered.report.action).toBe("recovery");
    expect(recovered.report.summary).toContain("recovery backend=sqlite-graph");
    expect(recovered.snapshot.longTermMemory.length).toBeGreaterThan(0);
  });

  it("reports explicit compiler stages and retrieval observability", () => {
    const compiled = compileMemoryState({
      sessionId: "agent:compiler-observability",
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a.",
        ),
        userMessage(
          "Do not use the old workaround in src/context-engine/memory-system.ts for install profile profile-a.",
        ),
      ],
    });

    expect(compiled.compilerStages.some((stage) => stage.stage === "extract")).toBe(true);
    expect(compiled.compilerStages.some((stage) => stage.stage === "review")).toBe(true);

    const report = inspectMemoryRetrievalObservability(compiled, {
      messages: [
        userMessage(
          "For install profile profile-a, plan the permanent memory-system path in src/context-engine/memory-system.ts.",
        ),
      ],
    });

    expect(report.summary).toContain("task=");
    expect(report.accessedConceptCount).toBeGreaterThan(0);
    expect(report.longTermItemCount).toBeGreaterThan(0);
    expect(report.entityMatchedItemCount).toBeGreaterThan(0);
    expect(report.authoritativeWinnerItemCount).toBeGreaterThan(0);
  });

  it("ingests procedural execution records into long-term memory and retrieval", () => {
    const compiled = compileMemoryState({
      sessionId: "agent:procedural-memory",
      messages: [
        userMessage(
          "Plan the diagnostics rollout for src/context-engine/memory-system.ts and keep the acceptance workflow reusable.",
        ),
      ],
      runtimeContext: {
        environmentState: {
          version: 1,
          workspaceKind: "project",
          gitBranch: "feature/memory",
          gitCommit: "abcdef0",
          capabilitySignals: ["can_execute_commands", "can_read_files", "git_worktree"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
        },
        failureLearningState: {
          version: 1,
          failurePattern: "near_miss",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          missingCapabilities: [],
        },
        governanceState: {
          version: 1,
          autonomyMode: "fallback",
          riskLevel: "medium",
          approvalRequired: false,
          secretPromptDetected: false,
          destructiveActionDetected: false,
          reasons: ["planner:unknown"],
        },
        proceduralExecution: {
          version: 1,
          availableSkills: ["memory-diagnostics", "acceptance-report"],
          likelySkills: ["memory-diagnostics"],
          alternativeSkills: ["acceptance-report"],
          toolChain: ["read", "exec"],
          changedArtifacts: [
            "scripts/memory-diagnostics-report.ts",
            "src/context-engine/memory-system.ts",
          ],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "planning",
          templateCandidate: true,
          consolidationCandidate: false,
          consolidationAction: "extend_existing",
          overlappingSkills: ["memory-diagnostics", "acceptance-report"],
          skillFamilies: ["verification"],
          nearMissCandidate: false,
          retryClass: "skill_fallback",
          suggestedSkill: "acceptance-report",
          shouldEscalate: false,
          autonomyMode: "fallback",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "memory-diagnostics",
          fallbackSkills: ["acceptance-report"],
          skillChain: ["memory-diagnostics", "acceptance-report"],
          workflowSteps: [
            { skill: "memory-diagnostics", role: "primary" },
            { skill: "acceptance-report", role: "verification" },
          ],
          rankedSkills: ["acceptance-report", "memory-diagnostics"],
          promotedSkills: ["memory-diagnostics"],
          stabilityState: "stable_reuse",
          stabilitySkills: ["memory-diagnostics"],
          prerequisiteWarnings: ["acceptance-report:missing-env:docker"],
          capabilityGaps: [],
          multiSkillCandidate: true,
          chainedWorkflow: true,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands", "can_read_files", "git_worktree"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "near_miss",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement:
            "Consider parameterizing memory-diagnostics so it can cover acceptance reporting without duplication.",
        },
      } as never,
    });

    const proceduralEntries = compiled.longTermMemory.filter((entry) =>
      (entry.environmentTags ?? []).includes("runtime:procedural"),
    );
    expect(proceduralEntries.length).toBeGreaterThan(0);
    expect(
      proceduralEntries.some(
        (entry) =>
          (entry.environmentTags ?? []).includes("procedural:retry:skill_fallback") &&
          (entry.environmentTags ?? []).includes("procedural:primary-skill:memory-diagnostics") &&
          (entry.environmentTags ?? []).includes("procedural:failure-pattern:near_miss") &&
          (entry.environmentTags ?? []).includes("procedural:goal-satisfaction:satisfied") &&
          (entry.environmentTags ?? []).includes("procedural:ranked-skill:1:acceptance-report") &&
          (entry.environmentTags ?? []).includes(
            "procedural:consolidation-action:extend_existing",
          ) &&
          (entry.environmentTags ?? []).includes(
            "procedural:prereq:acceptance-report:missing-env:docker",
          ) &&
          entry.artifactRefs.includes("src/context-engine/memory-system.ts"),
      ),
    ).toBe(true);
    expect(
      proceduralEntries.some((entry) =>
        (entry.environmentTags ?? []).includes(
          "procedural:workflow-step:1:primary:memory-diagnostics",
        ),
      ),
    ).toBe(true);
    expect(
      proceduralEntries.some((entry) =>
        (entry.environmentTags ?? []).includes(
          "procedural:workflow-step:2:verification:acceptance-report",
        ),
      ),
    ).toBe(true);
    expect(
      proceduralEntries.some((entry) =>
        (entry.environmentTags ?? []).includes("procedural:skill-family:verification"),
      ),
    ).toBe(true);
    expect(
      proceduralEntries.some((entry) =>
        (entry.environmentTags ?? []).includes("procedural:stability:stable_reuse"),
      ),
    ).toBe(true);
    expect(
      proceduralEntries.some((entry) =>
        (entry.environmentTags ?? []).includes("procedural:stability-skill:memory-diagnostics"),
      ),
    ).toBe(true);
    expect(
      proceduralEntries.some((entry) =>
        (entry.environmentTags ?? []).includes("procedural:promoted-skill:memory-diagnostics"),
      ),
    ).toBe(true);

    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [
        userMessage(
          "For the diagnostics rollout in src/context-engine/memory-system.ts, what workflow should we reuse?",
        ),
      ],
    });

    expect(packet.text).toContain("Recommended procedural skills:");
    expect(packet.text).toContain("acceptance-report");
    expect(packet.text).toContain("Procedural guidance:");
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.text.includes("Available skill surface for current execution") &&
          item.text.includes("memory-diagnostics") &&
          item.reason.includes("source=direct_observation"),
      ),
    ).toBe(true);
  });

  it("ingests agentic observability, soak, and quality gate runtime records", () => {
    const compiled = compileMemoryState({
      sessionId: "agent:agentic-quality-memory",
      messages: [
        userMessage(
          "Track the agentic release gate quality and keep fallback regressions visible.",
        ),
      ],
      runtimeContext: {
        agenticObservability: {
          version: 1,
          summary:
            "retry=escalate autonomy=escalate risk=high failure=blocked_path fallback=missing",
          retryClass: "escalate",
          autonomyMode: "escalate",
          riskLevel: "high",
          failurePattern: "blocked_path",
          suggestedSkill: undefined,
          rankedSkills: ["memory-diagnostics"],
          capabilityGaps: ["no_viable_fallback"],
          overlappingSkills: [],
          skillFamilies: [],
          consolidationAction: "none",
          workflowSteps: [],
          hasViableFallback: false,
          escalationRequired: true,
          planSteps: [],
          goalSatisfaction: "uncertain",
          unresolvedCriteria: ["find a viable fallback"],
          recommendations: ["Add or learn a viable fallback workflow before retrying."],
        },
        agenticSoak: {
          passed: false,
          totalScenarios: 2,
          passedScenarios: 1,
          failedScenarioIds: ["retry_replan_recover_complete"],
          scenarios: [
            {
              id: "retry_replan_recover_complete",
              passed: false,
              summary: "Retry path regressed during recovery.",
              phases: [],
            },
          ],
          summary: "agentic soak 1/2 passed",
        },
        agenticQualityGate: {
          passed: false,
          acceptancePassed: true,
          soakPassed: false,
          diagnosticsPassed: false,
          failReasons: ["soak_failed", "diagnostics_missing_fallback"],
          acceptance: {
            passed: true,
            totalScenarios: 16,
            passedScenarios: 16,
            failedScenarioIds: [],
            scenarios: [],
            summary: "agentic acceptance 16/16 passed",
          },
          soak: {
            passed: false,
            totalScenarios: 2,
            passedScenarios: 1,
            failedScenarioIds: ["retry_replan_recover_complete"],
            scenarios: [],
            summary: "agentic soak 1/2 passed",
          },
          diagnostics: {
            summary:
              "retry=escalate autonomy=escalate risk=high failure=blocked_path fallback=missing",
            retryClass: "escalate",
            autonomyMode: "escalate",
            riskLevel: "high",
            failurePattern: "blocked_path",
            suggestedSkill: undefined,
            rankedSkills: ["memory-diagnostics"],
            capabilityGaps: ["no_viable_fallback"],
            overlappingSkills: [],
            skillFamilies: [],
            consolidationAction: "none",
            workflowSteps: [],
            hasViableFallback: false,
            escalationRequired: true,
            planSteps: [],
            goalSatisfaction: "uncertain",
            unresolvedCriteria: ["find a viable fallback"],
            recommendations: ["Add or learn a viable fallback workflow before retrying."],
          },
          summary: "agentic quality gate acceptance=pass soak=fail diagnostics=fail",
        },
      } as never,
    });

    const agenticEntries = compiled.longTermMemory.filter((entry) =>
      (entry.environmentTags ?? []).some((tag) => tag.startsWith("runtime:agentic-")),
    );
    expect(agenticEntries.length).toBeGreaterThanOrEqual(3);
    expect(
      agenticEntries.some((entry) =>
        (entry.environmentTags ?? []).includes("runtime:agentic-observability"),
      ),
    ).toBe(true);
    expect(
      agenticEntries.some((entry) =>
        (entry.environmentTags ?? []).includes("agentic:missing-fallback"),
      ),
    ).toBe(true);
    expect(
      agenticEntries.some((entry) =>
        (entry.environmentTags ?? []).includes("runtime:agentic-soak"),
      ),
    ).toBe(true);
    expect(
      agenticEntries.some((entry) =>
        (entry.environmentTags ?? []).includes(
          "agentic:soak-failure:retry_replan_recover_complete",
        ),
      ),
    ).toBe(true);
    expect(
      agenticEntries.some((entry) =>
        (entry.environmentTags ?? []).includes("runtime:agentic-quality-gate"),
      ),
    ).toBe(true);
    expect(
      agenticEntries.some((entry) =>
        (entry.environmentTags ?? []).includes(
          "agentic:quality-failure:diagnostics_missing_fallback",
        ),
      ),
    ).toBe(true);
  });

  it("generates a diagnostics report with health, retrieval, and acceptance summaries", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-diagnostics-"));
    const sessionId = "agent:diagnostics";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a.",
        ),
        userMessage(
          "Do not use the old workaround in src/context-engine/memory-system.ts for install profile profile-a.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const report = await generateMemoryDiagnosticsReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      messages: [
        userMessage(
          "For install profile profile-a, use the permanent memory-system path in src/context-engine/memory-system.ts.",
        ),
      ],
      includeAcceptance: true,
      acceptanceBackendKinds: ["fs-json", "sqlite-graph"],
    });

    expect(report.summary).toContain("backend=sqlite-graph");
    expect(report.health.summary).toContain("backend=sqlite-graph");
    expect(report.health.sourceTypeCounts.user_stated).toBeGreaterThanOrEqual(0);
    expect(report.retrieval?.summary).toContain("task=");
    expect(report.acceptance?.scenarioCount).toBeGreaterThanOrEqual(15);
    expect(report.failedAcceptanceScenarios).toEqual([]);
    expect(report.maintenance).toBeUndefined();
    expect(report.recommendations.length).toBeGreaterThan(0);
    const markdown = formatMemoryDiagnosticsReport(report, "markdown");
    const summary = formatMemoryDiagnosticsReport(report, "summary");
    expect(markdown).toContain("# Memory Diagnostics Report");
    expect(markdown).toContain("## Acceptance");
    expect(summary).toContain("summary:");
    expect(summary).toContain("acceptance:");
    const acceptanceMarkdown = formatMemoryAcceptanceReport(report.acceptance!, "markdown");
    const acceptanceSummary = formatMemoryAcceptanceReport(report.acceptance!, "summary");
    expect(acceptanceMarkdown).toContain("# Memory Acceptance Report");
    expect(acceptanceMarkdown).toContain("## Scenarios");
    expect(acceptanceSummary).toContain("scenarios:");
  });

  it("includes persisted stabilized-promotion coverage in the memory acceptance suite", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-acceptance-agentic-"));

    const report = await runMemoryAcceptanceSuite({
      workspaceDir: tempDir,
      sessionIdPrefix: "agentic-stable-promotion",
      backendKinds: ["fs-json"],
    });

    const scenario = report.scenarios.find(
      (entry: MemoryAcceptanceScenarioResult) => entry.scenario === "agentic_stable_promotion",
    );
    expect(scenario?.passed).toBe(true);
    expect(scenario?.details).toContain("diagnostics-repair@debugging/node");
    expect(scenario?.details).toContain(
      "promote stabilized scoped skills for stable reuse or extend-existing workflow decisions",
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("includes failure-derived consolidation guidance coverage in the memory acceptance suite", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "openclaw-memory-acceptance-failure-consolidation-"),
    );

    const report = await runMemoryAcceptanceSuite({
      workspaceDir: tempDir,
      sessionIdPrefix: "failure-consolidation",
      backendKinds: ["fs-json"],
    });

    const scenario = report.scenarios.find(
      (entry: MemoryAcceptanceScenarioResult) =>
        entry.scenario === "agentic_failure_derived_consolidation_guidance",
    );
    expect(scenario?.passed).toBe(true);

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("surfaces agentic trend summaries in memory diagnostics", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-agentic-trends-"));
    const sessionId = "agent:agentic-trends";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Track agentic regressions in memory diagnostics and release gating."),
      ],
      runtimeContext: {
        agenticObservability: {
          version: 1,
          summary:
            "retry=escalate autonomy=escalate risk=high failure=blocked_path fallback=missing",
          retryClass: "escalate",
          autonomyMode: "escalate",
          riskLevel: "high",
          failurePattern: "blocked_path",
          suggestedSkill: undefined,
          rankedSkills: ["memory-diagnostics"],
          capabilityGaps: ["no_viable_fallback"],
          overlappingSkills: [],
          skillFamilies: [],
          consolidationAction: "none",
          workflowSteps: [],
          hasViableFallback: false,
          escalationRequired: true,
          planSteps: [],
          goalSatisfaction: "uncertain",
          unresolvedCriteria: ["find a viable fallback"],
          recommendations: ["Add or learn a viable fallback workflow before retrying."],
        },
        agenticSoak: {
          passed: false,
          totalScenarios: 2,
          passedScenarios: 1,
          failedScenarioIds: ["retry_replan_recover_complete"],
          scenarios: [],
          summary: "agentic soak 1/2 passed",
        },
        agenticQualityGate: {
          passed: false,
          acceptancePassed: true,
          soakPassed: false,
          diagnosticsPassed: false,
          failReasons: ["soak_failed", "diagnostics_missing_fallback"],
          acceptance: {
            passed: true,
            totalScenarios: 16,
            passedScenarios: 16,
            failedScenarioIds: [],
            scenarios: [],
            summary: "agentic acceptance 16/16 passed",
          },
          soak: {
            passed: false,
            totalScenarios: 2,
            passedScenarios: 1,
            failedScenarioIds: ["retry_replan_recover_complete"],
            scenarios: [],
            summary: "agentic soak 1/2 passed",
          },
          diagnostics: {
            summary:
              "retry=escalate autonomy=escalate risk=high failure=blocked_path fallback=missing",
            retryClass: "escalate",
            autonomyMode: "escalate",
            riskLevel: "high",
            failurePattern: "blocked_path",
            suggestedSkill: undefined,
            rankedSkills: ["memory-diagnostics"],
            capabilityGaps: ["no_viable_fallback"],
            overlappingSkills: [],
            skillFamilies: [],
            consolidationAction: "none",
            workflowSteps: [],
            hasViableFallback: false,
            escalationRequired: true,
            planSteps: [],
            goalSatisfaction: "uncertain",
            unresolvedCriteria: ["find a viable fallback"],
            recommendations: ["Add or learn a viable fallback workflow before retrying."],
          },
          summary: "agentic quality gate acceptance=pass soak=fail diagnostics=fail",
        },
      } as never,
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const report = await generateMemoryDiagnosticsReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
    });

    expect(report.agenticTrends?.trend).toBe("regressing");
    expect(report.agenticTrends?.missingFallbackSignals).toBeGreaterThan(0);
    expect(report.agenticTrends?.qualityFailureReasons).toContain("diagnostics_missing_fallback");
    expect(report.recommendations).toContain(
      "investigate agentic quality regressions before promoting the store",
    );
    const summary = formatMemoryDiagnosticsReport(report, "summary");
    const markdown = formatMemoryDiagnosticsReport(report, "markdown");
    expect(summary).toContain("agentic:");
    expect(markdown).toContain("## Agentic Trends");
  });

  it("surfaces scoped effective and weakening skills in agentic diagnostics trends", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "openclaw-memory-agentic-effectiveness-"),
    );
    const sessionId = "agent:agentic-effectiveness-trends";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [userMessage("Track which scoped workflows are getting stronger or weaker.")],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["acceptance-report", "memory-diagnostics"],
          likelySkills: ["acceptance-report"],
          alternativeSkills: ["memory-diagnostics"],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: false,
          consolidationAction: "extend_existing",
          overlappingSkills: ["acceptance-report", "memory-diagnostics"],
          skillFamilies: ["verification"],
          nearMissCandidate: false,
          retryClass: "skill_fallback",
          suggestedSkill: "memory-diagnostics",
          shouldEscalate: false,
          autonomyMode: "fallback",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "acceptance-report",
          fallbackSkills: ["memory-diagnostics"],
          skillChain: ["acceptance-report", "memory-diagnostics"],
          workflowSteps: [
            { skill: "acceptance-report", role: "primary" },
            { skill: "memory-diagnostics", role: "fallback" },
          ],
          rankedSkills: ["acceptance-report", "memory-diagnostics"],
          effectiveSkills: ["acceptance-report"],
          effectiveFamilies: ["verification"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: true,
          chainedWorkflow: true,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: true,
          failureReasons: [],
          nextImprovement: "Keep reusing the acceptance-report path in node debugging work.",
        },
        agenticObservability: {
          version: 1,
          summary:
            "retry=skill_fallback autonomy=fallback risk=medium failure=blocked_path fallback=missing",
          retryClass: "skill_fallback",
          autonomyMode: "fallback",
          riskLevel: "medium",
          primarySkill: "acceptance-report",
          suggestedSkill: "memory-diagnostics",
          workflowSteps: [],
          rankedSkills: ["acceptance-report", "memory-diagnostics"],
          effectiveSkills: ["acceptance-report"],
          effectiveFamilies: ["verification"],
          consolidationAction: "none",
          overlappingSkills: [],
          capabilityGaps: ["no_viable_fallback"],
          failurePattern: "blocked_path",
          hasViableFallback: false,
          escalationRequired: false,
          planSteps: [],
          goalSatisfaction: "partial",
          unresolvedCriteria: ["find a viable fallback"],
          recommendations: ["Add or learn a viable fallback workflow before retrying."],
        },
        agenticQualityGate: {
          passed: false,
          acceptancePassed: true,
          soakPassed: true,
          diagnosticsPassed: false,
          failReasons: ["diagnostics_missing_fallback"],
          acceptance: {
            passed: true,
            totalScenarios: 16,
            passedScenarios: 16,
            failedScenarioIds: [],
            scenarios: [],
            summary: "agentic acceptance 16/16 passed",
          },
          soak: {
            passed: true,
            totalScenarios: 2,
            passedScenarios: 2,
            failedScenarioIds: [],
            scenarios: [],
            summary: "agentic soak 2/2 passed",
          },
          diagnostics: {
            summary:
              "retry=skill_fallback autonomy=fallback risk=medium failure=blocked_path fallback=missing",
            retryClass: "skill_fallback",
            autonomyMode: "fallback",
            riskLevel: "medium",
            primarySkill: "acceptance-report",
            suggestedSkill: "memory-diagnostics",
            workflowSteps: [],
            rankedSkills: ["acceptance-report", "memory-diagnostics"],
            effectiveSkills: ["acceptance-report"],
            effectiveFamilies: ["verification"],
            consolidationAction: "none",
            overlappingSkills: [],
            capabilityGaps: ["no_viable_fallback"],
            failurePattern: "blocked_path",
            hasViableFallback: false,
            escalationRequired: false,
            planSteps: [],
            goalSatisfaction: "partial",
            unresolvedCriteria: ["find a viable fallback"],
            recommendations: ["Add or learn a viable fallback workflow before retrying."],
          },
          summary: "agentic quality gate acceptance=pass soak=pass diagnostics=fail",
        },
      } as never,
    });
    const weakeningSnapshot = compileMemoryState({
      sessionId,
      messages: [userMessage("Track which scoped workflows are getting stronger or weaker.")],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "failed",
          goalSatisfaction: "uncertain",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: false,
          consolidationAction: "none",
          overlappingSkills: [],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: true,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: [],
          skillChain: ["diagnostics-repair"],
          workflowSteps: [{ skill: "diagnostics-repair", role: "primary" }],
          rankedSkills: ["diagnostics-repair"],
          effectiveSkills: [],
          effectiveFamilies: [],
          prerequisiteWarnings: [],
          capabilityGaps: ["no_viable_fallback"],
          hasViableFallback: false,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "blocked_path",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Avoid reusing the weak diagnostics repair path in this scope.",
        },
      } as never,
    });
    snapshot.longTermMemory.push(...weakeningSnapshot.longTermMemory);
    snapshot.pendingSignificance.push(...weakeningSnapshot.pendingSignificance);

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const report = await generateMemoryDiagnosticsReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
    });

    expect(report.agenticTrends?.effectiveSkills).toContain("acceptance-report@debugging/node");
    expect(report.agenticTrends?.effectiveFamilies).toContain("verification@debugging/node");
    expect(report.agenticTrends?.weakeningSkills).toContain("diagnostics-repair@debugging/node");
    expect(report.recommendations).toContain(
      "review weakening scoped skills before extending or promoting the current workflow family",
    );
    const summary = formatMemoryDiagnosticsReport(report, "summary");
    const markdown = formatMemoryDiagnosticsReport(report, "markdown");
    expect(summary).toContain("agentic_effective_skills:");
    expect(markdown).toContain("Effective skills:");
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("surfaces recovering scoped skills in persisted agentic diagnostics trends", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-agentic-recovery-"));
    const sessionId = "agent:agentic-recovery-trends";
    const weakeningSnapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Track when a scoped diagnostics workflow degrades and then recovers."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "failed",
          goalSatisfaction: "uncertain",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: false,
          consolidationAction: "none",
          overlappingSkills: [],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: true,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: [],
          skillChain: ["diagnostics-repair"],
          workflowSteps: [{ skill: "diagnostics-repair", role: "primary" }],
          rankedSkills: ["diagnostics-repair"],
          effectiveSkills: [],
          effectiveFamilies: [],
          prerequisiteWarnings: [],
          capabilityGaps: ["no_viable_fallback"],
          hasViableFallback: false,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "blocked_path",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Do not promote the weak diagnostics-repair path yet.",
        },
      } as never,
    });
    const recoveredSnapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Track when a scoped diagnostics workflow degrades and then recovers."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair", "acceptance-report"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: ["acceptance-report"],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "extend_existing",
          overlappingSkills: ["acceptance-report"],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: false,
          retryClass: "skill_fallback",
          suggestedSkill: "acceptance-report",
          shouldEscalate: false,
          autonomyMode: "fallback",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: ["acceptance-report"],
          skillChain: ["diagnostics-repair", "acceptance-report"],
          workflowSteps: [
            { skill: "diagnostics-repair", role: "primary" },
            { skill: "acceptance-report", role: "fallback" },
          ],
          rankedSkills: ["diagnostics-repair", "acceptance-report"],
          effectiveSkills: ["diagnostics-repair"],
          effectiveFamilies: ["diagnostics"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: true,
          chainedWorkflow: true,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "recovered_path",
          learnFromFailure: true,
          failureReasons: [],
          nextImprovement:
            "Keep watching the recovered diagnostics-repair path before promoting it.",
        },
      } as never,
    });

    for (const entry of weakeningSnapshot.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of recoveredSnapshot.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    weakeningSnapshot.longTermMemory.push(...recoveredSnapshot.longTermMemory);
    weakeningSnapshot.pendingSignificance.push(...recoveredSnapshot.pendingSignificance);

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
      workingMemory: weakeningSnapshot.workingMemory,
      longTermMemory: weakeningSnapshot.longTermMemory,
      pendingSignificance: weakeningSnapshot.pendingSignificance,
      permanentMemory: weakeningSnapshot.permanentMemory,
      graph: weakeningSnapshot.graph,
    });

    const report = await generateMemoryDiagnosticsReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
    });

    expect(report.agenticTrends?.recoveringSkills).toContain("diagnostics-repair@debugging/node");
    expect(report.recommendations).toContain(
      "confirm recovering scoped skills stay stable before promoting the recovered workflow family",
    );
    const summary = formatMemoryDiagnosticsReport(report, "summary");
    const markdown = formatMemoryDiagnosticsReport(report, "markdown");
    expect(summary).toContain("agentic_recovering_skills:");
    expect(markdown).toContain("Recovering skills:");
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("surfaces stabilized scoped skills in persisted agentic diagnostics trends", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-agentic-stable-"));
    const sessionId = "agent:agentic-stable-trends";
    const firstStableSnapshot = compileMemoryState({
      sessionId,
      messages: [userMessage("Track when a scoped diagnostics workflow has become stable.")],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: false,
          consolidationAction: "extend_existing",
          overlappingSkills: [],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: [],
          skillChain: ["diagnostics-repair"],
          workflowSteps: [{ skill: "diagnostics-repair", role: "primary" }],
          rankedSkills: ["diagnostics-repair"],
          effectiveSkills: ["diagnostics-repair"],
          effectiveFamilies: ["diagnostics"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: true,
          failureReasons: [],
          nextImprovement: "Keep reusing the now-stable diagnostics repair workflow.",
        },
      } as never,
    });
    const secondStableSnapshot = compileMemoryState({
      sessionId,
      messages: [userMessage("Track when a scoped diagnostics workflow has become stable.")],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "extend_existing",
          overlappingSkills: [],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: [],
          skillChain: ["diagnostics-repair"],
          workflowSteps: [{ skill: "diagnostics-repair", role: "primary" }],
          rankedSkills: ["diagnostics-repair"],
          effectiveSkills: ["diagnostics-repair"],
          effectiveFamilies: ["diagnostics"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: true,
          failureReasons: [],
          nextImprovement: "The diagnostics repair workflow is holding up across repeated runs.",
        },
      } as never,
    });

    for (const entry of firstStableSnapshot.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of secondStableSnapshot.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    firstStableSnapshot.longTermMemory.push(...secondStableSnapshot.longTermMemory);
    firstStableSnapshot.pendingSignificance.push(...secondStableSnapshot.pendingSignificance);

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
      workingMemory: firstStableSnapshot.workingMemory,
      longTermMemory: firstStableSnapshot.longTermMemory,
      pendingSignificance: firstStableSnapshot.pendingSignificance,
      permanentMemory: firstStableSnapshot.permanentMemory,
      graph: firstStableSnapshot.graph,
    });

    const report = await generateMemoryDiagnosticsReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
    });

    expect(report.agenticTrends?.stabilizedSkills).toContain("diagnostics-repair@debugging/node");
    expect(report.recommendations).toContain(
      "promote stabilized scoped skills for stable reuse or extend-existing workflow decisions",
    );
    const summary = formatMemoryDiagnosticsReport(report, "summary");
    const markdown = formatMemoryDiagnosticsReport(report, "markdown");
    expect(summary).toContain("agentic_stabilized_skills:");
    expect(markdown).toContain("Stabilized skills:");
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("surfaces template-ready and merge-ready families in persisted agentic diagnostics trends", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "openclaw-memory-agentic-consolidation-"),
    );
    const sessionId = "agent:agentic-consolidation-trends";
    const templateFirst = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Track when diagnostics workflows become template-ready or merge-ready."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["acceptance-report"],
          likelySkills: ["acceptance-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/acceptance-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: true,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: [],
          skillFamilies: ["verification"],
          mergeCandidate: false,
          mergeSkills: [],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "acceptance-report",
          fallbackSkills: [],
          skillChain: ["acceptance-report"],
          workflowSteps: [{ skill: "acceptance-report", role: "primary" }],
          rankedSkills: ["acceptance-report"],
          effectiveSkills: ["acceptance-report"],
          effectiveFamilies: ["verification"],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: false,
          failureReasons: [],
          nextImprovement: "Parameterize the stable acceptance reporting workflow.",
        },
      } as never,
    });
    const templateSecond = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Track when diagnostics workflows become template-ready or merge-ready."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["acceptance-report"],
          likelySkills: ["acceptance-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/acceptance-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: true,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: [],
          skillFamilies: ["verification"],
          mergeCandidate: false,
          mergeSkills: [],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "acceptance-report",
          fallbackSkills: [],
          skillChain: ["acceptance-report"],
          workflowSteps: [{ skill: "acceptance-report", role: "primary" }],
          rankedSkills: ["acceptance-report"],
          effectiveSkills: ["acceptance-report"],
          effectiveFamilies: ["verification"],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: false,
          failureReasons: [],
          nextImprovement: "Keep parameterizing the stable acceptance reporting workflow family.",
        },
      } as never,
    });
    const mergeFirst = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Track when diagnostics workflows become template-ready or merge-ready."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-report", "diagnostics-validation", "memory-diagnostics"],
          likelySkills: ["memory-diagnostics", "diagnostics-report"],
          alternativeSkills: ["diagnostics-validation"],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/memory-diagnostics-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: ["memory-diagnostics", "diagnostics-report"],
          skillFamilies: ["diagnostics"],
          mergeCandidate: true,
          mergeSkills: ["memory-diagnostics", "diagnostics-report"],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "memory-diagnostics",
          fallbackSkills: ["diagnostics-report"],
          skillChain: ["memory-diagnostics", "diagnostics-report"],
          workflowSteps: [
            { skill: "memory-diagnostics", role: "primary" },
            { skill: "diagnostics-report", role: "supporting" },
          ],
          rankedSkills: ["memory-diagnostics", "diagnostics-report", "diagnostics-validation"],
          effectiveSkills: ["memory-diagnostics", "diagnostics-report"],
          effectiveFamilies: ["diagnostics"],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: true,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: false,
          failureReasons: [],
          nextImprovement: "Merge the overlapping diagnostics siblings.",
        },
      } as never,
    });
    const mergeSecond = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Track when diagnostics workflows become template-ready or merge-ready."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-report", "diagnostics-validation", "memory-diagnostics"],
          likelySkills: ["memory-diagnostics", "diagnostics-validation"],
          alternativeSkills: ["diagnostics-report"],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/memory-diagnostics-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: ["memory-diagnostics", "diagnostics-validation"],
          skillFamilies: ["diagnostics"],
          mergeCandidate: true,
          mergeSkills: ["memory-diagnostics", "diagnostics-validation"],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "memory-diagnostics",
          fallbackSkills: ["diagnostics-validation"],
          skillChain: ["memory-diagnostics", "diagnostics-validation"],
          workflowSteps: [
            { skill: "memory-diagnostics", role: "primary" },
            { skill: "diagnostics-validation", role: "supporting" },
          ],
          rankedSkills: ["memory-diagnostics", "diagnostics-validation", "diagnostics-report"],
          effectiveSkills: ["memory-diagnostics", "diagnostics-validation"],
          effectiveFamilies: ["diagnostics"],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: true,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: false,
          failureReasons: [],
          nextImprovement: "Keep merging the overlapping diagnostics siblings.",
        },
      } as never,
    });

    for (const entry of templateFirst.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of templateSecond.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    for (const entry of mergeFirst.longTermMemory) {
      entry.updatedAt = 3_000;
    }
    for (const entry of mergeSecond.longTermMemory) {
      entry.updatedAt = 4_000;
    }
    templateFirst.longTermMemory.push(
      ...templateSecond.longTermMemory,
      ...mergeFirst.longTermMemory,
      ...mergeSecond.longTermMemory,
    );
    templateFirst.pendingSignificance.push(
      ...templateSecond.pendingSignificance,
      ...mergeFirst.pendingSignificance,
      ...mergeSecond.pendingSignificance,
    );

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
      workingMemory: templateFirst.workingMemory,
      longTermMemory: templateFirst.longTermMemory,
      pendingSignificance: templateFirst.pendingSignificance,
      permanentMemory: templateFirst.permanentMemory,
      graph: templateFirst.graph,
    });

    const report = await generateMemoryDiagnosticsReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
    });

    expect(report.agenticTrends?.templateFamilies).toContain("verification@debugging/node");
    expect(report.agenticTrends?.mergeFamilies).toContain("diagnostics@debugging/node");
    expect(report.recommendations).toContain(
      "parameterize template-ready workflow families before spawning new forks",
    );
    expect(report.recommendations).toContain(
      "merge repeated sibling workflow families when overlap evidence stays durable",
    );
    const summary = formatMemoryDiagnosticsReport(report, "summary");
    const markdown = formatMemoryDiagnosticsReport(report, "markdown");
    expect(summary).toContain("agentic_template_families:");
    expect(summary).toContain("agentic_merge_families:");
    expect(markdown).toContain("Template-ready families:");
    expect(markdown).toContain("Merge-ready families:");
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("uses repeated near-miss and blocked-path consolidation history to surface durable family trends", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "openclaw-memory-agentic-failure-consolidation-"),
    );
    const sessionId = "agent:agentic-failure-consolidation-trends";
    const templateNearMiss = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Keep the acceptance workflow reusable instead of spawning another fork."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["acceptance-report"],
          likelySkills: ["acceptance-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/acceptance-report.ts"],
          outcome: "failed",
          goalSatisfaction: "partial",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: true,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: [],
          skillFamilies: ["verification"],
          mergeCandidate: false,
          mergeSkills: [],
          nearMissCandidate: true,
          retryClass: "same_path_retry",
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: [],
          primarySkill: "acceptance-report",
          fallbackSkills: [],
          skillChain: ["acceptance-report"],
          workflowSteps: [{ skill: "acceptance-report", role: "primary" }],
          rankedSkills: ["acceptance-report"],
          effectiveSkills: [],
          effectiveFamilies: [],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "near_miss",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Parameterize the acceptance workflow instead of creating another fork.",
        },
      } as never,
    });
    const mergeBlocked = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Merge the overlapping diagnostics siblings instead of keeping parallel forks.",
        ),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["memory-diagnostics", "diagnostics-report"],
          likelySkills: ["memory-diagnostics", "diagnostics-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/memory-diagnostics-report.ts"],
          outcome: "failed",
          goalSatisfaction: "partial",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: ["memory-diagnostics", "diagnostics-report"],
          skillFamilies: ["diagnostics"],
          mergeCandidate: true,
          mergeSkills: ["memory-diagnostics", "diagnostics-report"],
          nearMissCandidate: true,
          retryClass: "skill_fallback",
          shouldEscalate: false,
          autonomyMode: "fallback",
          riskLevel: "medium",
          governanceReasons: [],
          primarySkill: "diagnostics-report",
          fallbackSkills: ["memory-diagnostics"],
          skillChain: ["diagnostics-report", "memory-diagnostics"],
          workflowSteps: [
            { skill: "diagnostics-report", role: "primary" },
            { skill: "memory-diagnostics", role: "fallback" },
          ],
          rankedSkills: ["diagnostics-report", "memory-diagnostics"],
          effectiveSkills: [],
          effectiveFamilies: [],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: true,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "blocked_path",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Merge overlapping diagnostics siblings into one reusable workflow.",
        },
      } as never,
    });
    const templateBlocked = structuredClone(templateNearMiss);
    const mergeNearMiss = structuredClone(mergeBlocked);
    for (const entry of templateNearMiss.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of templateBlocked.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    for (const entry of mergeBlocked.longTermMemory) {
      entry.updatedAt = 3_000;
    }
    for (const entry of mergeNearMiss.longTermMemory) {
      entry.updatedAt = 4_000;
    }
    templateNearMiss.longTermMemory.push(
      ...templateBlocked.longTermMemory,
      ...mergeBlocked.longTermMemory,
      ...mergeNearMiss.longTermMemory,
    );
    templateNearMiss.pendingSignificance.push(
      ...templateBlocked.pendingSignificance,
      ...mergeBlocked.pendingSignificance,
      ...mergeNearMiss.pendingSignificance,
    );

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
      workingMemory: templateNearMiss.workingMemory,
      longTermMemory: templateNearMiss.longTermMemory,
      pendingSignificance: templateNearMiss.pendingSignificance,
      permanentMemory: templateNearMiss.permanentMemory,
      graph: templateNearMiss.graph,
    });

    const report = await generateMemoryDiagnosticsReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "fs-json",
    });

    expect(report.agenticTrends?.templateFamilies).toContain("verification@debugging/node");
    expect(report.agenticTrends?.mergeFamilies).toContain("diagnostics@debugging/node");
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("injects agentic regression guidance into retrieved memory packets", () => {
    const compiled = compileMemoryState({
      sessionId: "agent:agentic-regression-packet",
      messages: [
        userMessage(
          "Track the failing diagnostics workflow and keep missing fallback regressions visible.",
        ),
      ],
      runtimeContext: {
        agenticObservability: {
          version: 1,
          summary:
            "retry=escalate autonomy=escalate risk=high failure=blocked_path fallback=missing",
          retryClass: "escalate",
          autonomyMode: "escalate",
          riskLevel: "high",
          failurePattern: "blocked_path",
          suggestedSkill: undefined,
          rankedSkills: ["memory-diagnostics"],
          capabilityGaps: ["no_viable_fallback"],
          overlappingSkills: [],
          skillFamilies: [],
          consolidationAction: "none",
          workflowSteps: [],
          hasViableFallback: false,
          escalationRequired: true,
          planSteps: [],
          goalSatisfaction: "uncertain",
          unresolvedCriteria: ["find a viable fallback"],
          recommendations: ["Add or learn a viable fallback workflow before retrying."],
        },
        agenticQualityGate: {
          passed: false,
          acceptancePassed: true,
          soakPassed: false,
          diagnosticsPassed: false,
          failReasons: ["diagnostics_missing_fallback"],
          acceptance: {
            passed: true,
            totalScenarios: 16,
            passedScenarios: 16,
            failedScenarioIds: [],
            scenarios: [],
            summary: "agentic acceptance 16/16 passed",
          },
          soak: {
            passed: false,
            totalScenarios: 2,
            passedScenarios: 1,
            failedScenarioIds: ["retry_replan_recover_complete"],
            scenarios: [],
            summary: "agentic soak 1/2 passed",
          },
          diagnostics: {
            summary:
              "retry=escalate autonomy=escalate risk=high failure=blocked_path fallback=missing",
            retryClass: "escalate",
            autonomyMode: "escalate",
            riskLevel: "high",
            failurePattern: "blocked_path",
            suggestedSkill: undefined,
            rankedSkills: ["memory-diagnostics"],
            capabilityGaps: ["no_viable_fallback"],
            overlappingSkills: [],
            skillFamilies: [],
            consolidationAction: "none",
            workflowSteps: [],
            hasViableFallback: false,
            escalationRequired: true,
            planSteps: [],
            goalSatisfaction: "uncertain",
            unresolvedCriteria: ["find a viable fallback"],
            recommendations: ["Add or learn a viable fallback workflow before retrying."],
          },
          summary: "agentic quality gate acceptance=pass soak=fail diagnostics=fail",
        },
      } as never,
    });

    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [userMessage("Fix the diagnostics workflow and stop repeating the failing path.")],
    });

    expect(packet.text).toContain("Agentic regression guidance:");
    expect(packet.text).toContain("diagnostics_missing_fallback");
    expect(
      packet.retrievalItems.some((item) => item.reason.includes("agentic regression guidance")),
    ).toBe(true);
  });

  it("injects skill family guidance into retrieved memory packets", () => {
    const compiled = compileMemoryState({
      sessionId: "agent:skill-family-guidance-packet",
      messages: [
        userMessage(
          "Fix the diagnostics workflow and prefer the stronger verification path without spawning more diagnostics forks.",
        ),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["memory-diagnostics", "diagnostics-repair", "acceptance-report"],
          likelySkills: ["memory-diagnostics"],
          alternativeSkills: ["acceptance-report"],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "failed",
          goalSatisfaction: "partial",
          taskMode: "debugging",
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: ["memory-diagnostics", "diagnostics-repair"],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: true,
          retryClass: "skill_fallback",
          suggestedSkill: "acceptance-report",
          shouldEscalate: false,
          autonomyMode: "fallback",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "memory-diagnostics",
          fallbackSkills: ["acceptance-report"],
          skillChain: ["memory-diagnostics", "acceptance-report"],
          workflowSteps: [
            { skill: "memory-diagnostics", role: "primary" },
            { skill: "acceptance-report", role: "fallback" },
          ],
          rankedSkills: ["memory-diagnostics", "acceptance-report", "diagnostics-repair"],
          prerequisiteWarnings: [],
          capabilityGaps: ["no_viable_fallback"],
          multiSkillCandidate: true,
          chainedWorkflow: true,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "blocked_path",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Prefer the verification sibling and generalize diagnostics handling.",
          planSteps: [],
        },
      } as never,
    });

    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [
        userMessage(
          "Fix the diagnostics workflow and prefer the stronger verification path without duplication.",
        ),
      ],
    });

    expect(packet.text).toContain("Skill family guidance:");
    expect(packet.text).toContain("family=diagnostics");
    expect(packet.text).toContain("merge_candidate=true");
    expect(packet.text).toContain("merge_skills=memory-diagnostics,diagnostics-repair");
    expect(packet.text).toContain("preferred_fallback=acceptance-report");
    expect(
      packet.retrievalItems.some((item) => item.reason.includes("skill family guidance")),
    ).toBe(true);
  });

  it("injects merge-ready skill family guidance into retrieved memory packets", () => {
    const compiled = compileMemoryState({
      sessionId: "agent:skill-family-merge-guidance-packet",
      messages: [
        userMessage("Merge the overlapping diagnostics siblings into one reusable workflow."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["memory-diagnostics", "diagnostics-report", "diagnostics-validation"],
          likelySkills: ["memory-diagnostics", "diagnostics-report"],
          alternativeSkills: ["diagnostics-validation"],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/memory-diagnostics-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: ["memory-diagnostics", "diagnostics-report"],
          skillFamilies: ["diagnostics"],
          mergeCandidate: true,
          mergeSkills: ["memory-diagnostics", "diagnostics-report"],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "low",
          governanceReasons: [],
          primarySkill: "memory-diagnostics",
          fallbackSkills: ["diagnostics-report"],
          skillChain: ["memory-diagnostics", "diagnostics-report"],
          workflowSteps: [
            { skill: "memory-diagnostics", role: "primary" },
            { skill: "diagnostics-report", role: "supporting" },
          ],
          rankedSkills: ["memory-diagnostics", "diagnostics-report", "diagnostics-validation"],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: true,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: false,
          failureReasons: [],
          nextImprovement: "Merge overlapping sibling skills into one reusable workflow.",
          planSteps: [],
        },
      } as never,
    });

    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [userMessage("Merge the diagnostics siblings instead of keeping both forks.")],
    });

    expect(packet.text).toContain("Skill family guidance:");
    expect(packet.text).toContain("merge_candidate=true");
    expect(packet.text).toContain("merge_skills=diagnostics-report,memory-diagnostics");
  });

  it("injects durable family trend guidance into retrieved memory packets", () => {
    const sessionId = "agent:durable-family-guidance-packet";
    const templateFirst = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Keep the acceptance reporting workflow reusable without duplication."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["acceptance-report"],
          likelySkills: ["acceptance-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/acceptance-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: true,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: [],
          skillFamilies: ["verification"],
          mergeCandidate: false,
          mergeSkills: [],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "low",
          governanceReasons: [],
          primarySkill: "acceptance-report",
          fallbackSkills: [],
          skillChain: ["acceptance-report"],
          workflowSteps: [{ skill: "acceptance-report", role: "primary" }],
          rankedSkills: ["acceptance-report"],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          effectiveSkills: ["acceptance-report"],
          effectiveFamilies: ["verification"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: false,
          failureReasons: [],
          nextImprovement: "Parameterize the stable acceptance reporting workflow.",
        },
      } as never,
    });
    const templateSecond = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Keep the acceptance reporting workflow reusable without duplication."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["acceptance-report"],
          likelySkills: ["acceptance-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/acceptance-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: true,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: [],
          skillFamilies: ["verification"],
          mergeCandidate: false,
          mergeSkills: [],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "low",
          governanceReasons: [],
          primarySkill: "acceptance-report",
          fallbackSkills: [],
          skillChain: ["acceptance-report"],
          workflowSteps: [{ skill: "acceptance-report", role: "primary" }],
          rankedSkills: ["acceptance-report"],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          effectiveSkills: ["acceptance-report"],
          effectiveFamilies: ["verification"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: false,
          failureReasons: [],
          nextImprovement: "Keep parameterizing the stable acceptance reporting workflow.",
        },
      } as never,
    });
    for (const entry of templateFirst.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of templateSecond.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    templateFirst.longTermMemory.push(...templateSecond.longTermMemory);
    templateFirst.pendingSignificance.push(...templateSecond.pendingSignificance);

    const packet = retrieveMemoryContextPacket(
      {
        ...templateFirst,
      },
      {
        messages: [
          userMessage(
            "Template the acceptance reporting workflow instead of creating another fork.",
          ),
        ],
      },
    );

    expect(packet.text).toContain("Skill family guidance:");
    expect(packet.text).toContain("family=verification");
    expect(packet.text).toContain("template_candidate=true");
    expect(packet.text).toContain("durable=true");
    expect(
      packet.retrievalItems.some((item) =>
        item.reason.includes("skill family guidance source=memory_trend"),
      ),
    ).toBe(true);
  });

  it("injects durable family trend guidance from repeated near-miss history into retrieved packets", () => {
    const sessionId = "agent:durable-failure-family-guidance-packet";
    const templateFirst = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Keep the acceptance workflow reusable instead of spawning another fork."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["acceptance-report"],
          likelySkills: ["acceptance-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/acceptance-report.ts"],
          outcome: "failed",
          goalSatisfaction: "partial",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: true,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: [],
          skillFamilies: ["verification"],
          mergeCandidate: false,
          mergeSkills: [],
          nearMissCandidate: true,
          retryClass: "same_path_retry",
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: [],
          primarySkill: "acceptance-report",
          fallbackSkills: [],
          skillChain: ["acceptance-report"],
          workflowSteps: [{ skill: "acceptance-report", role: "primary" }],
          rankedSkills: ["acceptance-report"],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          effectiveSkills: [],
          effectiveFamilies: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "near_miss",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Parameterize the acceptance workflow instead of creating another fork.",
        },
      } as never,
    });
    const templateSecond = structuredClone(templateFirst);
    for (const entry of templateFirst.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of templateSecond.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    templateFirst.longTermMemory.push(...templateSecond.longTermMemory);
    templateFirst.pendingSignificance.push(...templateSecond.pendingSignificance);

    const packet = retrieveMemoryContextPacket(templateFirst, {
      messages: [userMessage("Template the acceptance workflow instead of creating another fork.")],
    });

    expect(packet.text).toContain("Skill family guidance:");
    expect(packet.text).toContain("family=verification");
    expect(packet.text).toContain("template_candidate=true");
    expect(packet.text).toContain("durable=true");
  });

  it("uses retrieved failure-derived merge guidance to steer later replanning", () => {
    const sessionId = "agent:failure-derived-merge-replan";
    const mergeFirst = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Merge the overlapping diagnostics siblings after repeated blocked attempts."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["memory-diagnostics", "diagnostics-report"],
          likelySkills: ["memory-diagnostics", "diagnostics-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/memory-diagnostics-report.ts"],
          outcome: "failed",
          goalSatisfaction: "partial",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: ["memory-diagnostics", "diagnostics-report"],
          skillFamilies: ["diagnostics"],
          mergeCandidate: true,
          mergeSkills: ["memory-diagnostics", "diagnostics-report"],
          nearMissCandidate: true,
          retryClass: "skill_fallback",
          shouldEscalate: false,
          autonomyMode: "fallback",
          riskLevel: "medium",
          governanceReasons: [],
          primarySkill: "diagnostics-report",
          fallbackSkills: ["memory-diagnostics"],
          skillChain: ["diagnostics-report", "memory-diagnostics"],
          workflowSteps: [
            { skill: "diagnostics-report", role: "primary" },
            { skill: "memory-diagnostics", role: "fallback" },
          ],
          rankedSkills: ["diagnostics-report", "memory-diagnostics"],
          effectiveSkills: [],
          effectiveFamilies: [],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: true,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "blocked_path",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Merge overlapping diagnostics siblings into one reusable workflow.",
        },
      } as never,
    });
    const mergeSecond = structuredClone(mergeFirst);
    for (const entry of mergeFirst.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of mergeSecond.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    mergeFirst.longTermMemory.push(...mergeSecond.longTermMemory);
    mergeFirst.pendingSignificance.push(...mergeSecond.pendingSignificance);

    const packet = retrieveMemoryContextPacket(mergeFirst, {
      messages: [userMessage("Fix the diagnostics workflow and pick the strongest sibling path.")],
    });
    const state = buildAgenticExecutionState({
      messages: [userMessage("Fix the diagnostics workflow and pick the strongest sibling path.")],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Diagnostics validation failed again for the current path.",
        },
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "diagnostics-report", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: packet.text,
    });

    expect(packet.text).toContain("merge_candidate=true");
    expect(state.plannerState.suggestedSkill).toBe("diagnostics-report");
    expect(state.orchestrationState.primarySkill).toBe("diagnostics-report");
    expect(state.orchestrationState.mergeCandidate).toBe(true);
  });

  it("uses retrieved failure-derived template guidance to avoid escalating into a new fork", () => {
    const sessionId = "agent:failure-derived-template-replan";
    const templateFirst = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Keep the acceptance workflow reusable instead of spawning another fork."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["acceptance-report"],
          likelySkills: ["acceptance-report"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/acceptance-report.ts"],
          outcome: "failed",
          goalSatisfaction: "partial",
          taskMode: "debugging",
          planSteps: [],
          templateCandidate: true,
          consolidationCandidate: true,
          consolidationAction: "generalize_existing",
          overlappingSkills: [],
          skillFamilies: ["verification"],
          mergeCandidate: false,
          mergeSkills: [],
          nearMissCandidate: true,
          retryClass: "same_path_retry",
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: [],
          primarySkill: "acceptance-report",
          fallbackSkills: [],
          skillChain: ["acceptance-report"],
          workflowSteps: [{ skill: "acceptance-report", role: "primary" }],
          rankedSkills: ["acceptance-report"],
          effectiveSkills: [],
          effectiveFamilies: [],
          promotedSkills: [],
          stabilityState: "neutral",
          stabilitySkills: [],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          hasViableFallback: true,
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "near_miss",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Parameterize the acceptance workflow instead of creating another fork.",
        },
      } as never,
    });
    const templateSecond = structuredClone(templateFirst);
    for (const entry of templateFirst.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of templateSecond.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    templateFirst.longTermMemory.push(...templateSecond.longTermMemory);
    templateFirst.pendingSignificance.push(...templateSecond.pendingSignificance);

    const packet = retrieveMemoryContextPacket(templateFirst, {
      messages: [
        userMessage("Fix the acceptance workflow without creating another specialized fork."),
      ],
    });
    const state = buildAgenticExecutionState({
      messages: [
        userMessage("Fix the acceptance workflow without creating another specialized fork."),
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Acceptance workflow validation nearly worked but still needs refinement.",
        },
      ],
      availableSkills: ["acceptance-report"],
      likelySkills: ["acceptance-report"],
      availableSkillInfo: [{ name: "acceptance-report", primaryEnv: "node" }],
      memorySystemPromptAddition: packet.text,
    });

    expect(packet.text).toContain("template_candidate=true");
    expect(state.plannerState.shouldEscalate).toBe(false);
    expect(state.orchestrationState.primarySkill).toBe("acceptance-report");
    expect(state.orchestrationState.consolidationAction).toBe("generalize_existing");
  });

  it("injects skill effectiveness guidance into retrieved memory packets", () => {
    const compiled = compileMemoryState({
      sessionId: "agent:skill-effectiveness-guidance-packet",
      messages: [userMessage("Choose the strongest reusable workflow for the diagnostics fix.")],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["memory-diagnostics", "acceptance-report"],
          likelySkills: ["memory-diagnostics"],
          alternativeSkills: ["acceptance-report"],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          templateCandidate: false,
          consolidationCandidate: false,
          consolidationAction: "extend_existing",
          overlappingSkills: ["memory-diagnostics", "acceptance-report"],
          skillFamilies: ["verification"],
          nearMissCandidate: false,
          retryClass: "skill_fallback",
          suggestedSkill: "acceptance-report",
          shouldEscalate: false,
          autonomyMode: "fallback",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "acceptance-report",
          fallbackSkills: ["memory-diagnostics"],
          skillChain: ["acceptance-report", "memory-diagnostics"],
          workflowSteps: [
            { skill: "acceptance-report", role: "primary" },
            { skill: "memory-diagnostics", role: "fallback" },
          ],
          rankedSkills: ["acceptance-report", "memory-diagnostics"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          multiSkillCandidate: true,
          chainedWorkflow: true,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: true,
          failureReasons: [],
          nextImprovement: "Reuse the acceptance-first verification path.",
          planSteps: [],
        },
      } as never,
    });

    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [userMessage("Which workflow is strongest for the diagnostics fix?")],
    });

    expect(packet.text).toContain("Skill effectiveness guidance:");
    expect(packet.text).toContain("skill=acceptance-report");
    expect(packet.text).toContain("family=verification");
    expect(packet.text).toContain("task_mode=debugging");
    expect(packet.text).toContain("workspace=project");
    expect(packet.text).toContain("env=node");
    expect(packet.text).toContain("validation=exec");
    expect(packet.text).toContain("score=");
  });

  it("injects skill recovery guidance into retrieved memory packets", () => {
    const weakeningCompiled = compileMemoryState({
      sessionId: "agent:skill-recovery-guidance-packet",
      messages: [userMessage("Track a recovered diagnostics workflow without over-promoting it.")],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "failed",
          goalSatisfaction: "uncertain",
          taskMode: "debugging",
          templateCandidate: false,
          consolidationCandidate: false,
          consolidationAction: "none",
          overlappingSkills: [],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: true,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: [],
          skillChain: ["diagnostics-repair"],
          workflowSteps: [{ skill: "diagnostics-repair", role: "primary" }],
          rankedSkills: ["diagnostics-repair"],
          prerequisiteWarnings: [],
          capabilityGaps: ["no_viable_fallback"],
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "blocked_path",
          learnFromFailure: true,
          failureReasons: ["verification_failure"],
          nextImprovement: "Do not promote the weak diagnostics path yet.",
          planSteps: [],
        },
      } as never,
    });
    const recoveredCompiled = compileMemoryState({
      sessionId: "agent:skill-recovery-guidance-packet",
      messages: [userMessage("Track a recovered diagnostics workflow without over-promoting it.")],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair", "acceptance-report"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: ["acceptance-report"],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "extend_existing",
          overlappingSkills: ["acceptance-report"],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: false,
          retryClass: "skill_fallback",
          suggestedSkill: "acceptance-report",
          shouldEscalate: false,
          autonomyMode: "fallback",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: ["acceptance-report"],
          skillChain: ["diagnostics-repair", "acceptance-report"],
          workflowSteps: [
            { skill: "diagnostics-repair", role: "primary" },
            { skill: "acceptance-report", role: "fallback" },
          ],
          rankedSkills: ["diagnostics-repair", "acceptance-report"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          multiSkillCandidate: true,
          chainedWorkflow: true,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "recovered_path",
          learnFromFailure: true,
          failureReasons: [],
          nextImprovement: "Keep watching the recovered diagnostics path before promotion.",
          planSteps: [],
        },
      } as never,
    });
    for (const entry of weakeningCompiled.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of recoveredCompiled.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    weakeningCompiled.longTermMemory.push(...recoveredCompiled.longTermMemory);

    const packet = retrieveMemoryContextPacket(weakeningCompiled, {
      messages: [userMessage("Which recovered diagnostics path is still watch-only?")],
    });

    expect(packet.text).toContain("Skill recovery guidance:");
    expect(packet.text).toContain("skill=diagnostics-repair");
    expect(packet.text).toContain("state=recovered_watch");
  });

  it("injects skill stability guidance into retrieved memory packets", () => {
    const firstStableCompiled = compileMemoryState({
      sessionId: "agent:skill-stability-guidance-packet",
      messages: [
        userMessage("Track a diagnostics workflow that has become stable across repeated runs."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "extend_existing",
          overlappingSkills: [],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: [],
          skillChain: ["diagnostics-repair"],
          workflowSteps: [{ skill: "diagnostics-repair", role: "primary" }],
          rankedSkills: ["diagnostics-repair"],
          promotedSkills: ["diagnostics-repair"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: true,
          failureReasons: [],
          nextImprovement: "The diagnostics path is stable enough to keep extending.",
          planSteps: [],
        },
      } as never,
    });
    const secondStableCompiled = compileMemoryState({
      sessionId: "agent:skill-stability-guidance-packet",
      messages: [
        userMessage("Track a diagnostics workflow that has become stable across repeated runs."),
      ],
      runtimeContext: {
        proceduralExecution: {
          version: 1,
          availableSkills: ["diagnostics-repair"],
          likelySkills: ["diagnostics-repair"],
          alternativeSkills: [],
          toolChain: ["read", "exec"],
          changedArtifacts: ["scripts/agentic-quality-report.ts"],
          outcome: "verified",
          goalSatisfaction: "satisfied",
          taskMode: "debugging",
          templateCandidate: false,
          consolidationCandidate: true,
          consolidationAction: "extend_existing",
          overlappingSkills: [],
          skillFamilies: ["diagnostics"],
          nearMissCandidate: false,
          retryClass: "same_path_retry",
          suggestedSkill: undefined,
          shouldEscalate: false,
          autonomyMode: "continue",
          riskLevel: "medium",
          governanceReasons: ["planner:unknown"],
          primarySkill: "diagnostics-repair",
          fallbackSkills: [],
          skillChain: ["diagnostics-repair"],
          workflowSteps: [{ skill: "diagnostics-repair", role: "primary" }],
          rankedSkills: ["diagnostics-repair"],
          promotedSkills: ["diagnostics-repair"],
          prerequisiteWarnings: [],
          capabilityGaps: [],
          multiSkillCandidate: false,
          chainedWorkflow: false,
          workspaceKind: "project",
          capabilitySignals: ["can_execute_commands"],
          preferredValidationTools: ["exec"],
          skillEnvironments: ["node"],
          failurePattern: "clean_success",
          learnFromFailure: true,
          failureReasons: [],
          nextImprovement: "The diagnostics path remains stable over repeated runs.",
          planSteps: [],
        },
      } as never,
    });
    for (const entry of firstStableCompiled.longTermMemory) {
      entry.updatedAt = 1_000;
    }
    for (const entry of secondStableCompiled.longTermMemory) {
      entry.updatedAt = 2_000;
    }
    firstStableCompiled.longTermMemory.push(...secondStableCompiled.longTermMemory);

    const packet = retrieveMemoryContextPacket(firstStableCompiled, {
      messages: [userMessage("Which diagnostics path is now stable enough to extend?")],
    });

    expect(packet.text).toContain("Skill stability guidance:");
    expect(packet.text).toContain("skill=diagnostics-repair");
    expect(packet.text).toContain("state=stable_reuse");
    expect(packet.text).toContain("Skill promotion guidance:");
    expect(packet.text).toContain("action=promote_extend_existing");
  });

  it("includes maintenance details when diagnostics runs repair", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-diagnostics-repair-"));
    const sessionId = "agent:diagnostics-repair";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const report = await generateMemoryDiagnosticsReport({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      runRepair: true,
    });

    expect(report.maintenance?.repair?.action).toBe("repair");
    expect(report.maintenance?.repair?.summary).toContain("repair backend=sqlite-graph");
  });

  it("materializes entity aliases from scope, artifact, and branch context", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-entity-aliases-"));
    const sessionId = "agent:entity-aliases";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a.",
        ),
      ],
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
      } as never,
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const loaded = await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
    });
    const durable = loaded.longTermMemory[0];

    expect(durable?.entityAliases).toContain("profile-a");
    expect(durable?.entityAliases).toContain("feature/memory-v2");
    expect(durable?.entityAliases).toContain("memory-system.ts");
    expect((durable?.entityIds ?? []).length).toBeGreaterThan(0);

    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite"));
    try {
      const entityRows = db
        .prepare("SELECT COUNT(*) AS count FROM memory_entities WHERE session_id = ?")
        .get(sessionId) as { count: number };
      expect(entityRows.count).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  it("persists contested and superseded revision history rows in sqlite-graph", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-revisions-"));
    const sessionId = "agent:sqlite-revisions";
    const snapshot = compileMemoryState({
      sessionId,
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId,
          messages: [],
        }),
        longTermMemory: [
          longTermEntry({
            id: "ltm-old-revision",
            category: "decision",
            text: "Use the old memory-system workaround for src/context-engine/memory-system.ts.",
            updatedAt: Date.now() - 1000 * 60 * 60,
          }),
        ],
        pendingSignificance: [],
        graph: emptyGraph(),
        permanentMemory: permanentRoot(),
      },
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the old workaround.",
        ),
        userMessage(
          "Do not use the permanent memory-system path in src/context-engine/memory-system.ts when debugging old transcripts.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite"), {
      readOnly: true,
    });
    try {
      const contested = db
        .prepare(
          "SELECT COUNT(*) AS count FROM memory_revisions WHERE session_id = ? AND adjudication_status = 'contested'",
        )
        .get(sessionId) as { count: number };
      const contestedAdjudications = db
        .prepare(
          "SELECT COUNT(*) AS count FROM memory_adjudications WHERE session_id = ? AND status = 'contested'",
        )
        .get(sessionId) as { count: number };
      const superseded = db
        .prepare(
          "SELECT COUNT(*) AS count FROM memory_revisions WHERE session_id = ? AND active_status = 'superseded'",
        )
        .get(sessionId) as { count: number };

      expect(contested.count).toBeGreaterThan(0);
      expect(contestedAdjudications.count).toBeGreaterThan(0);
      expect(superseded.count).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  it("records sqlite-graph integrity checks in store metadata", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-integrity-"));
    const sessionId = "agent:sqlite-integrity";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    await loadMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
    });

    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite"), {
      readOnly: true,
    });
    try {
      const row = db.prepare("SELECT value FROM memory_store_metadata WHERE key = 'store'").get() as
        | { value?: string }
        | undefined;
      const metadata = JSON.parse(row?.value ?? "{}") as {
        backend?: string;
        schemaVersion?: number;
        lastAppliedMigration?: string;
        lastIntegrityCheckResult?: string;
        lastIntegrityCheckAt?: number;
        longTermCount?: number;
        conceptCount?: number;
        graphNodeCount?: number;
        graphEdgeCount?: number;
      };
      expect(metadata.backend).toBe("sqlite-graph");
      expect((metadata.schemaVersion ?? 0) >= 3).toBe(true);
      expect(
        new Set(["003_sqlite_graph_indexes", "004_memory_entities"]).has(
          metadata.lastAppliedMigration ?? "",
        ),
      ).toBe(true);
      expect(metadata.lastIntegrityCheckResult).toBe("ok");
      expect(typeof metadata.lastIntegrityCheckAt).toBe("number");
      expect(typeof metadata.longTermCount).toBe("number");
      expect(typeof metadata.conceptCount).toBe("number");
      expect(typeof metadata.graphNodeCount).toBe("number");
      expect(typeof metadata.graphEdgeCount).toBe("number");
      const migrations = db
        .prepare(
          "SELECT id, schema_version FROM memory_store_migrations ORDER BY schema_version ASC",
        )
        .all() as Array<{ id: string; schema_version: number }>;
      expect(migrations.map((row) => row.id)).toEqual([
        "001_sqlite_graph_init",
        "002_adjudication_resolution_kind",
        "003_sqlite_graph_indexes",
        "004_memory_entities",
      ]);
    } finally {
      db.close();
    }
  });

  it("persists scoped alternative adjudications in sqlite-graph", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-scoped-alt-"));
    const sessionId = "agent:sqlite-scoped-alternatives";
    const snapshot = compileMemoryState({
      sessionId,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a.",
        ),
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-b.",
        ),
      ],
    });

    await persistMemoryStoreSnapshot({
      workspaceDir: tempDir,
      sessionId,
      backendKind: "sqlite-graph",
      workingMemory: snapshot.workingMemory,
      longTermMemory: snapshot.longTermMemory,
      pendingSignificance: snapshot.pendingSignificance,
      permanentMemory: snapshot.permanentMemory,
      graph: snapshot.graph,
    });

    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(path.join(tempDir, MEMORY_SYSTEM_DIRNAME, "memory-store.sqlite"), {
      readOnly: true,
    });
    try {
      const scopedAltCount = db
        .prepare(
          "SELECT COUNT(*) AS count FROM memory_adjudications WHERE session_id = ? AND resolution_kind = 'scoped_alternative'",
        )
        .get(sessionId) as { count: number };
      const adjudicationJson = db
        .prepare(
          "SELECT json FROM memory_adjudications WHERE session_id = ? AND resolution_kind = 'scoped_alternative' LIMIT 1",
        )
        .get(sessionId) as { json: string } | undefined;

      expect(scopedAltCount.count).toBeGreaterThan(0);
      expect(
        (JSON.parse(adjudicationJson?.json ?? "{}") as { alternativeConceptIds?: string[] })
          .alternativeConceptIds?.length ?? 0,
      ).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });
});
