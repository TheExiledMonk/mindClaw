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
} from "./memory-system-store.js";

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
        {
          id: "ltm-1",
          category: "strategy",
          text: "The memory system should sit between raw context and prompt assembly.",
          strength: 0.9,
          evidence: ["strategy"],
          sourceType: "system_inferred",
          confidence: 0.9,
          importanceClass: "useful",
          compressionState: "stable",
          activeStatus: "active",
          accessCount: 0,
          contradictionCount: 0,
          updatedAt: Date.now(),
        },
      ],
      pendingSignificance: [],
      permanentMemory: {
        id: "root",
        label: "permanent-memory",
        updatedAt: Date.now(),
        evidence: [],
        children: [
          {
            id: "projects",
            label: "projects",
            updatedAt: Date.now(),
            evidence: [],
            children: [
              {
                id: "projects/current-bot",
                label: "current-bot",
                summary: "Permanent node tree is the highest-stability memory layer.",
                updatedAt: Date.now(),
                evidence: [],
                children: [],
              },
            ],
          },
        ],
      },
    });

    expect(packet).toContain("Integrated memory packet");
    expect(packet).toContain("Relevant long-term facts and patterns");
    expect(packet).toContain("Relevant entities, constraints, and structural memory");
  });

  it("compiler reconsolidates compaction summaries into long-term and permanent memory", () => {
    const compiled = compileMemoryState({
      sessionId: "session-a",
      messages: [],
      compactionSummary:
        "We decided to use memory-system as the active context engine and preserve repo tag v2026.3.13-1 as the migration baseline.",
    });

    expect(compiled.longTermMemory.some((entry) => entry.category === "episode")).toBe(true);
    expect(
      compiled.permanentMemory.children.some((child) => child.label === "projects"),
    ).toBe(true);
    expect(Array.isArray(compiled.pendingSignificance)).toBe(true);
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
          {
            id: "pending-1",
            category: "fact",
            text: "The memory compiler should review pending significance during each integration pass.",
            strength: 0.76,
            evidence: ["first observation"],
            sourceType: "user_stated",
            confidence: 0.82,
            importanceClass: "temporary",
            compressionState: "active",
            activeStatus: "pending",
            accessCount: 0,
            contradictionCount: 0,
            updatedAt: Date.now(),
            pendingReason: "needs recurrence or stronger confirmation before durable promotion",
          },
        ],
        permanentMemory: {
          id: "root",
          label: "permanent-memory",
          updatedAt: Date.now(),
          evidence: [],
          children: [],
        },
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
          {
            id: "ltm-latent",
            category: "strategy",
            text: "Memory compaction should preserve unresolved loops and repo-state facts.",
            strength: 0.7,
            evidence: ["prior project lesson"],
            sourceType: "summary_derived",
            confidence: 0.76,
            importanceClass: "useful",
            compressionState: "latent",
            activeStatus: "active",
            accessCount: 0,
            contradictionCount: 0,
            updatedAt: oldTimestamp,
          },
        ],
        pendingSignificance: [],
        permanentMemory: {
          id: "root",
          label: "permanent-memory",
          updatedAt: Date.now(),
          evidence: [],
          children: [],
        },
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
          {
            id: "ltm-1",
            category: "decision",
            text: "Use memory-system as the default context engine.",
            strength: 0.95,
            evidence: ["decision"],
            sourceType: "user_stated",
            confidence: 0.95,
            importanceClass: "critical",
            compressionState: "stable",
            activeStatus: "active",
            accessCount: 0,
            contradictionCount: 0,
            updatedAt: Date.now(),
          },
        ],
        pendingSignificance: [],
        permanentMemory: {
          id: "root",
          label: "permanent-memory",
          updatedAt: Date.now(),
          evidence: [],
          children: [],
        },
      },
      { messages: [userMessage("Implement the context engine compiler and tests.")] },
    );

    expect(packet.taskMode).toBe("coding");
    expect(packet.accessedLongTermIds).toContain("ltm-1");
    expect(packet.text).toContain("Retrieval audit");
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
    expect(snapshot.longTermMemory.length).toBeGreaterThan(0);
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
});
