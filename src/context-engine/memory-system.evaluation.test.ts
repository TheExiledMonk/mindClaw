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
