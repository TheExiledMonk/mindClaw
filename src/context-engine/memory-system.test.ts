import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { afterEach, describe, expect, it } from "vitest";
import { requireNodeSqlite } from "../memory/sqlite.js";
import {
  buildMemoryContextPacket,
  buildWorkingMemorySnapshot,
  compileMemoryState,
  deriveLongTermMemoryCandidates,
  loadMemoryStoreSnapshot,
  MEMORY_SYSTEM_DIRNAME,
  persistMemoryStoreSnapshot,
  retrieveMemoryContextPacket,
  runMemorySleepReview,
} from "./memory-system-store.js";
import type {
  LongTermMemoryEntry,
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
        lastIntegrityCheckResult?: string;
        lastIntegrityCheckAt?: number;
        longTermCount?: number;
        conceptCount?: number;
        graphNodeCount?: number;
        graphEdgeCount?: number;
      };
      expect(metadata.backend).toBe("sqlite-graph");
      expect(metadata.lastIntegrityCheckResult).toBe("ok");
      expect(typeof metadata.lastIntegrityCheckAt).toBe("number");
      expect(typeof metadata.longTermCount).toBe("number");
      expect(typeof metadata.conceptCount).toBe("number");
      expect(typeof metadata.graphNodeCount).toBe("number");
      expect(typeof metadata.graphEdgeCount).toBe("number");
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
