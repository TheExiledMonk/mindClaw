import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  buildWorkingMemorySnapshot,
  compileMemoryState,
  inspectMemoryRetrievalObservability,
  retrieveMemoryContextPacket,
} from "./memory-system-store.js";
import type { MemoryStoreSnapshot } from "./memory-system-store.js";

function userMessage(content: string): AgentMessage {
  return {
    role: "user",
    content,
    timestamp: Date.now(),
  } as AgentMessage;
}

describe("memory system evaluation scenarios", () => {
  it("keeps stable memory identity across repeated equivalent constraints", () => {
    const first = compileMemoryState({
      sessionId: "eval-identity",
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for v2026.3.13-1.",
        ),
      ],
    });
    const second = compileMemoryState({
      sessionId: "eval-identity",
      previous: first,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for v2026.3.13-1.",
        ),
      ],
    });

    const firstConstraint = first.longTermMemory[0];
    const secondConstraint = second.longTermMemory.find(
      (entry) => entry.semanticKey === firstConstraint?.semanticKey,
    );

    expect(secondConstraint?.id).toBe(firstConstraint?.id);
    expect(secondConstraint?.ontologyKind).toBe("constraint");
    expect(secondConstraint?.lastRevisionKind).toBe("reasserted");
  });

  it("tracks concept aliases across paraphrased but equivalent durable constraints", () => {
    const first = compileMemoryState({
      sessionId: "eval-aliases",
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
    });
    const second = compileMemoryState({
      sessionId: "eval-aliases",
      previous: first,
      messages: [
        userMessage(
          "The permanent path for memory-system integration in src/context-engine/memory-system.ts should be used.",
        ),
      ],
    });

    const durable = second.longTermMemory.find((entry) => entry.id === first.longTermMemory[0]?.id);
    expect(durable?.conceptAliases.length).toBeGreaterThan(1);
    expect(durable?.canonicalText).toContain("memory-system");
  });

  it("converges stronger paraphrases with passive phrasing onto one concept identity", () => {
    const first = compileMemoryState({
      sessionId: "eval-stronger-paraphrase",
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
    });
    const second = compileMemoryState({
      sessionId: "eval-stronger-paraphrase",
      previous: first,
      messages: [
        userMessage(
          "The permanent path for the memory system in src/context-engine/memory-system.ts is required and should be used.",
        ),
      ],
    });

    const merged = second.longTermMemory.find((entry) => entry.id === first.longTermMemory[0]?.id);
    expect(merged).toBeTruthy();
    expect(merged?.conceptAliases.length).toBeGreaterThan(1);
    expect(merged?.lastRevisionKind).toMatch(/reasserted|updated|narrowed/);
  });

  it("converges instruction-like category drift when canonical entities stay aligned", () => {
    const first = compileMemoryState({
      sessionId: "eval-category-drift",
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
      } as never,
    });
    const second = compileMemoryState({
      sessionId: "eval-category-drift",
      previous: first,
      messages: [
        userMessage("Continue using the permanent path in memory-system.ts on feature/memory-v2."),
      ],
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
      } as never,
    });

    const durableArtifactConcepts = new Set(
      second.longTermMemory
        .filter(
          (entry) =>
            entry.ontologyKind === "constraint" &&
            entry.artifactRefs.includes("src/context-engine/memory-system.ts"),
        )
        .map((entry) => entry.conceptKey),
    );

    expect(durableArtifactConcepts.size).toBe(1);
  });

  it("records narrowed revisions on the same concept identity", () => {
    const first = compileMemoryState({
      sessionId: "eval-narrow",
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
    });
    const second = compileMemoryState({
      sessionId: "eval-narrow",
      previous: first,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for v2026.3.13-1 on linux profile-a.",
        ),
      ],
    });

    const narrowed = second.longTermMemory.find(
      (entry) => entry.semanticKey === first.longTermMemory[0]?.semanticKey,
    );
    expect(narrowed?.lastRevisionKind).toBe("narrowed");
    expect(narrowed?.revisionCount).toBeGreaterThan(0);
  });

  it("keeps replacement constraints separate from older workaround concepts across category boundaries", () => {
    const second = compileMemoryState({
      sessionId: "eval-supersede-category",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "eval-supersede-category",
          messages: [],
        }),
        longTermMemory: [
          {
            id: "ltm-old-workaround",
            semanticKey: "test::decision::old-workaround",
            conceptKey: "concept::decision::old-workaround",
            canonicalText: "use old memory-system workaround src context-engine memory-system ts",
            conceptAliases: [
              "Use the old memory-system workaround for src/context-engine/memory-system.ts.",
            ],
            ontologyKind: "constraint",
            category: "decision",
            text: "Use the old memory-system workaround for src/context-engine/memory-system.ts.",
            strength: 0.8,
            evidence: ["old workaround"],
            provenance: [
              {
                kind: "message",
                detail: "old workaround",
                recordedAt: Date.now() - 1000 * 60 * 60,
                derivedFromMemoryIds: [],
              },
            ],
            sourceType: "user_stated",
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
            createdAt: Date.now() - 1000 * 60 * 60,
            lastConfirmedAt: Date.now() - 1000 * 60 * 60,
            contradictionCount: 0,
            relatedMemoryIds: [],
            relations: [],
            customerScope: undefined,
            environmentTags: [],
            artifactRefs: ["src/context-engine/memory-system.ts"],
            updatedAt: Date.now() - 1000 * 60 * 60,
          },
        ],
        pendingSignificance: [],
        permanentMemory: {
          id: "root",
          label: "permanent-memory",
          nodeType: "root",
          updatedAt: Date.now(),
          evidence: [],
          sourceMemoryIds: [],
          confidence: 1,
          activeStatus: "active",
          children: [],
        },
        graph: { nodes: [], edges: [], updatedAt: Date.now() },
      },
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the old workaround.",
        ),
      ],
    });

    expect(second.longTermMemory.some((entry) => entry.id === "ltm-old-workaround")).toBe(true);
    expect(second.review.supersededMemoryIds).toContain("ltm-old-workaround");
    expect(
      second.longTermMemory.some(
        (entry) =>
          entry.id !== "ltm-old-workaround" && entry.text.includes("permanent memory-system path"),
      ),
    ).toBe(true);
  });

  it("keeps contradictory concept variants separate so adjudication can contest them", () => {
    const first = compileMemoryState({
      sessionId: "eval-contested",
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
    });
    const second = compileMemoryState({
      sessionId: "eval-contested",
      previous: first,
      messages: [
        userMessage(
          "Do not use the permanent memory-system path in src/context-engine/memory-system.ts.",
        ),
      ],
    });

    const contested = second.longTermMemory.filter(
      (entry) => entry.adjudicationStatus === "contested",
    );
    expect(contested.length).toBeGreaterThan(0);
    expect(contested.some((entry) => entry.text.includes("Do not use"))).toBe(true);
  });

  it("exposes adjudication score and gap in retrieval rationale for contested concepts", () => {
    const first = compileMemoryState({
      sessionId: "eval-adjudication-rationale",
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
    });
    const second = compileMemoryState({
      sessionId: "eval-adjudication-rationale",
      previous: first,
      messages: [
        userMessage(
          "Do not use the permanent memory-system path in src/context-engine/memory-system.ts.",
        ),
      ],
    });
    const packet = retrieveMemoryContextPacket(second, {
      messages: [
        userMessage(
          "What should we do with the permanent memory-system path in src/context-engine/memory-system.ts?",
        ),
      ],
    });

    expect(
      packet.retrievalItems.some(
        (item) => item.reason.includes("adjudication=") && item.reason.includes("score="),
      ),
    ).toBe(true);
  });

  it("surfaces superseded but still relevant memories as downgraded during planning", () => {
    const compiled = compileMemoryState({
      sessionId: "eval-supersession",
      previous: {
        workingMemory: buildWorkingMemorySnapshot({
          sessionId: "eval-supersession",
          messages: [],
        }),
        longTermMemory: [],
        pendingSignificance: [],
        permanentMemory: {
          id: "root",
          label: "permanent-memory",
          nodeType: "root",
          updatedAt: Date.now(),
          evidence: [],
          sourceMemoryIds: [],
          confidence: 1,
          activeStatus: "active",
          children: [],
        },
        graph: { nodes: [], edges: [], updatedAt: Date.now() },
      },
      messages: [
        userMessage(
          "Use the old memory-system workaround in src/context-engine/memory-system.ts for migration planning.",
        ),
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts instead of the old workaround.",
        ),
      ],
    });

    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [
        userMessage(
          "Plan the replacement of the old memory-system workaround in src/context-engine/memory-system.ts.",
        ),
      ],
    });

    expect(packet.text).toContain("downgraded:");
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.reason.includes("downgraded=superseded") ||
          item.reason.includes("downgraded=revision updated"),
      ),
    ).toBe(true);
  });

  it("treats same concept family variants as scoped alternatives instead of contested contradictions", () => {
    const first = compileMemoryState({
      sessionId: "eval-scoped-alternatives",
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a.",
        ),
      ],
    });
    const second = compileMemoryState({
      sessionId: "eval-scoped-alternatives",
      previous: first,
      messages: [
        userMessage(
          "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-b.",
        ),
      ],
    });

    const packet = retrieveMemoryContextPacket(second, {
      messages: [
        userMessage(
          "For install profile profile-b, use the permanent memory-system path in src/context-engine/memory-system.ts.",
        ),
      ],
    });

    expect(second.review.scopedAlternativeConceptIds.length).toBeGreaterThan(0);
    expect(second.review.contestedRevisionConceptIds).toEqual([]);
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.reason.includes("adjudication=authoritative:scoped_alternative") &&
          item.text.includes("profile-b"),
      ),
    ).toBe(true);
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.reason.includes("adjudication=authoritative:scoped_alternative") &&
          item.text.includes("profile-a"),
      ),
    ).toBe(false);
    expect(
      packet.retrievalItems.some(
        (item) => item.reason.startsWith("artifact anchor") && item.text.includes("profile-a"),
      ),
    ).toBe(false);
    expect(
      packet.retrievalItems.some(
        (item) =>
          item.reason.startsWith("stable permanent node tree branch") &&
          item.text.includes("profile-a"),
      ),
    ).toBe(false);
  });

  it("maintains one concept across a longer paraphrase-heavy run without drift", () => {
    const turns = [
      "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
      "The permanent path for the memory system in src/context-engine/memory-system.ts should be used.",
      "We need to use the permanent memory-system path in src/context-engine/memory-system.ts.",
      "The required path for memory-system integration in src/context-engine/memory-system.ts is the permanent one.",
      "Use that permanent memory-system path in src/context-engine/memory-system.ts for this rollout.",
      "The permanent path in src/context-engine/memory-system.ts is the path we should continue with.",
    ];
    let compiled = compileMemoryState({
      sessionId: "eval-long-run-drift",
      messages: [userMessage(turns[0])],
    });
    for (const turn of turns.slice(1)) {
      compiled = compileMemoryState({
        sessionId: "eval-long-run-drift",
        previous: compiled,
        messages: [userMessage(turn)],
      });
    }

    const durablePathMemories = compiled.longTermMemory.filter(
      (entry) =>
        entry.artifactRefs.includes("src/context-engine/memory-system.ts") &&
        entry.ontologyKind === "constraint",
    );
    const conceptIds = new Set(durablePathMemories.map((entry) => entry.conceptKey));

    expect(durablePathMemories.length).toBeGreaterThan(0);
    expect(conceptIds.size).toBe(1);
    expect(durablePathMemories[0]?.conceptAliases.length).toBeGreaterThanOrEqual(4);
  });

  it("prevents scope bleed across longer alternating profile variants", () => {
    const turns = [
      "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-a.",
      "Use the permanent memory-system path in src/context-engine/memory-system.ts for install profile profile-b.",
      "For install profile profile-a, continue using the permanent memory-system path in src/context-engine/memory-system.ts.",
      "For install profile profile-b, the permanent memory-system path in src/context-engine/memory-system.ts should be used.",
    ];
    let compiled = compileMemoryState({
      sessionId: "eval-long-run-scope-bleed",
      messages: [userMessage(turns[0])],
    });
    for (const turn of turns.slice(1)) {
      compiled = compileMemoryState({
        sessionId: "eval-long-run-scope-bleed",
        previous: compiled,
        messages: [userMessage(turn)],
      });
    }

    const report = inspectMemoryRetrievalObservability(compiled, {
      messages: [
        userMessage(
          "For install profile profile-b, use the permanent memory-system path in src/context-engine/memory-system.ts.",
        ),
      ],
    });
    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [
        userMessage(
          "For install profile profile-b, use the permanent memory-system path in src/context-engine/memory-system.ts.",
        ),
      ],
    });

    expect(report.scopedAlternativeItemCount).toBeGreaterThan(0);
    expect(
      packet.retrievalItems.some(
        (item) => item.reason.includes("profile=profile-b") && item.text.includes("profile-b"),
      ),
    ).toBe(true);
    expect(
      packet.retrievalItems.some(
        (item) => item.reason.includes("profile=profile-a") && item.text.includes("profile-a"),
      ),
    ).toBe(false);
  });

  it("converges memories through entity aliases like branch and artifact basename", () => {
    const first = compileMemoryState({
      sessionId: "eval-entity-alias-convergence",
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
      } as never,
    });
    const second = compileMemoryState({
      sessionId: "eval-entity-alias-convergence",
      previous: first,
      messages: [
        userMessage(
          "The permanent path in memory-system.ts on branch feature/memory-v2 should be used.",
        ),
      ],
    });

    const merged = second.longTermMemory.find((entry) => entry.id === first.longTermMemory[0]?.id);
    expect(merged).toBeTruthy();
    expect(merged?.entityAliases).toContain("feature/memory-v2");
    expect(merged?.entityAliases).toContain("memory-system.ts");
    expect(merged?.conceptAliases.length).toBeGreaterThan(1);
  });

  it("uses entity-linked retrieval when the query matches by branch and basename", () => {
    const compiled = compileMemoryState({
      sessionId: "eval-entity-retrieval",
      messages: [
        userMessage("Use the permanent memory-system path in src/context-engine/memory-system.ts."),
      ],
      runtimeContext: {
        workspaceState: {
          gitBranch: "feature/memory-v2",
        },
      } as never,
    });

    const packet = retrieveMemoryContextPacket(compiled, {
      messages: [
        userMessage("On branch feature/memory-v2, what should we do in memory-system.ts?"),
      ],
    });

    expect(
      packet.retrievalItems.some(
        (item) =>
          item.kind === "long-term" &&
          item.reason.includes("entities=") &&
          item.reason.includes("memory-system.ts") &&
          item.text.includes("permanent memory-system path"),
      ),
    ).toBe(true);
  });

  it("expands related memories through shared canonical entities when text overlap is weak", () => {
    const now = Date.now();
    const snapshot: MemoryStoreSnapshot = {
      workingMemory: buildWorkingMemorySnapshot({
        sessionId: "eval-entity-expansion",
        messages: [],
      }),
      longTermMemory: [
        {
          id: "ltm-entity-anchor",
          semanticKey: "entity::anchor",
          conceptKey: "concept::entity::anchor",
          canonicalText: "use permanent memory system path memory system ts",
          conceptAliases: [
            "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
          ],
          ontologyKind: "constraint",
          category: "decision",
          text: "Use the permanent memory-system path in src/context-engine/memory-system.ts.",
          strength: 0.95,
          evidence: ["anchor"],
          provenance: [],
          sourceType: "user_stated",
          confidence: 0.94,
          importanceClass: "critical",
          compressionState: "stable",
          activeStatus: "active",
          adjudicationStatus: "authoritative",
          revisionCount: 0,
          lastRevisionKind: "new",
          permanenceStatus: "eligible",
          permanenceReasons: [],
          trend: "stable",
          accessCount: 0,
          createdAt: now - 10_000,
          lastConfirmedAt: now - 10_000,
          contradictionCount: 0,
          relatedMemoryIds: [],
          relations: [],
          entityAliases: ["feature/memory-v2", "memory-system.ts"],
          entityIds: ["entity-branch", "entity-artifact"],
          environmentTags: ["git-branch:feature/memory-v2"],
          artifactRefs: ["src/context-engine/memory-system.ts"],
          updatedAt: now - 10_000,
        },
        {
          id: "ltm-distractor-1",
          semanticKey: "entity::d1",
          conceptKey: "concept::entity::d1",
          canonicalText: "review memory system ts branch feature memory v2",
          conceptAliases: ["Review memory-system.ts on feature/memory-v2 before editing."],
          ontologyKind: "fact",
          category: "fact",
          text: "Review memory-system.ts on feature/memory-v2 before editing.",
          strength: 0.92,
          evidence: ["d1"],
          provenance: [],
          sourceType: "summary_derived",
          confidence: 0.9,
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
          createdAt: now - 9_000,
          lastConfirmedAt: now - 9_000,
          contradictionCount: 0,
          relatedMemoryIds: [],
          relations: [],
          environmentTags: ["git-branch:feature/memory-v2"],
          artifactRefs: ["src/context-engine/memory-system.ts"],
          updatedAt: now - 9_000,
        },
        {
          id: "ltm-distractor-2",
          semanticKey: "entity::d2",
          conceptKey: "concept::entity::d2",
          canonicalText: "plan changes for memory system ts on feature memory v2",
          conceptAliases: ["Plan changes for memory-system.ts on feature/memory-v2 carefully."],
          ontologyKind: "pattern",
          category: "strategy",
          text: "Plan changes for memory-system.ts on feature/memory-v2 carefully.",
          strength: 0.9,
          evidence: ["d2"],
          provenance: [],
          sourceType: "summary_derived",
          confidence: 0.88,
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
          createdAt: now - 8_000,
          lastConfirmedAt: now - 8_000,
          contradictionCount: 0,
          relatedMemoryIds: [],
          relations: [],
          environmentTags: ["git-branch:feature/memory-v2"],
          artifactRefs: ["src/context-engine/memory-system.ts"],
          updatedAt: now - 8_000,
        },
        {
          id: "ltm-distractor-3",
          semanticKey: "entity::d3",
          conceptKey: "concept::entity::d3",
          canonicalText: "keep branch feature memory v2 aligned in memory system ts",
          conceptAliases: ["Keep branch feature/memory-v2 aligned in memory-system.ts."],
          ontologyKind: "fact",
          category: "fact",
          text: "Keep branch feature/memory-v2 aligned in memory-system.ts.",
          strength: 0.89,
          evidence: ["d3"],
          provenance: [],
          sourceType: "summary_derived",
          confidence: 0.87,
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
          createdAt: now - 7_000,
          lastConfirmedAt: now - 7_000,
          contradictionCount: 0,
          relatedMemoryIds: [],
          relations: [],
          environmentTags: ["git-branch:feature/memory-v2"],
          artifactRefs: ["src/context-engine/memory-system.ts"],
          updatedAt: now - 7_000,
        },
        {
          id: "ltm-entity-neighbor",
          semanticKey: "entity::neighbor",
          conceptKey: "concept::entity::neighbor",
          canonicalText: "preserve canonical bootstrap flow",
          conceptAliases: ["Preserve the canonical bootstrap flow."],
          ontologyKind: "constraint",
          category: "decision",
          text: "Preserve the canonical bootstrap flow.",
          strength: 0.64,
          evidence: ["neighbor"],
          provenance: [],
          sourceType: "user_stated",
          confidence: 0.72,
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
          createdAt: now - 6_000,
          lastConfirmedAt: now - 6_000,
          contradictionCount: 0,
          relatedMemoryIds: [],
          relations: [],
          entityAliases: ["feature/memory-v2", "memory-system.ts"],
          entityIds: ["entity-branch", "entity-artifact"],
          environmentTags: ["git-branch:feature/memory-v2"],
          artifactRefs: ["src/context-engine/memory-system.ts"],
          updatedAt: now - 6_000,
        },
      ],
      pendingSignificance: [],
      permanentMemory: {
        id: "root",
        label: "permanent-memory",
        nodeType: "root",
        updatedAt: now,
        evidence: [],
        sourceMemoryIds: [],
        confidence: 1,
        activeStatus: "active",
        children: [],
      },
      graph: { nodes: [], edges: [], updatedAt: now },
    };

    const packet = retrieveMemoryContextPacket(snapshot, {
      messages: [userMessage("What matters on feature/memory-v2 for memory-system.ts right now?")],
    });

    expect(
      packet.retrievalItems.some(
        (item) =>
          item.kind === "long-term" &&
          item.reason.includes("related expansion via entity-") &&
          item.text.includes("canonical bootstrap flow"),
      ),
    ).toBe(true);
  });
});
