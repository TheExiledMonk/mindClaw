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

    expect(candidates.map((candidate) => candidate.category)).toContain("decision");
    expect(candidates.some((candidate) => candidate.text.includes("v2026.3.13-1"))).toBe(true);
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
          updatedAt: Date.now(),
        },
      ],
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
    expect(packet).toContain("Long-term memory");
    expect(packet).toContain("Permanent memory tree");
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
    expect(assembled.systemPromptAddition).toContain("Permanent memory tree");

    const memoryRoot = path.join(tempDir, MEMORY_SYSTEM_DIRNAME);
    await expect(fs.stat(memoryRoot)).resolves.toBeTruthy();
  });
});
