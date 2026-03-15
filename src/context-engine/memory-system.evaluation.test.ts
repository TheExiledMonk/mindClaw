import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  buildWorkingMemorySnapshot,
  compileMemoryState,
  retrieveMemoryContextPacket,
} from "./memory-system-store.js";

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

    expect(packet.text).toContain("downgraded: superseded");
    expect(
      packet.retrievalItems.some((item) => item.reason.includes("downgraded=superseded")),
    ).toBe(true);
  });
});
