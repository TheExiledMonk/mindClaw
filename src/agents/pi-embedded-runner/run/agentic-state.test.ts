import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { buildAgenticExecutionState, buildAgenticSystemPromptAddition } from "./agentic-state.js";

function msg(role: "user" | "assistant" | "toolResult", content: string): AgentMessage {
  return { role, content, timestamp: Date.now() } as AgentMessage;
}

describe("agentic-state", () => {
  it("builds task, verification, and planner state from live execution signals", () => {
    const state = buildAgenticExecutionState({
      messages: [
        msg(
          "user",
          "Fix the failing TypeScript build in src/context-engine/memory-system.ts and verify with typecheck.",
        ),
      ],
      activeArtifacts: ["src/context-engine/memory-system.ts"],
      workspaceTags: ["workspace", "git-worktree"],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Ran pnpm exec tsc -p tsconfig.json --noEmit and the typecheck passed.",
          artifactRefs: ["src/context-engine/memory-system.ts"],
        },
      ],
      diffSignals: [
        {
          artifactRef: "src/context-engine/memory-system.ts",
          changeKind: "modified",
          summary: "Updated the memory-system path.",
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary: "TypeScript build fixed and completed.",
          artifactRefs: ["src/context-engine/memory-system.ts"],
        },
      ],
    });

    expect(state.taskState.taskMode).toBe("debugging");
    expect(state.taskState.objective).toContain("Fix the failing TypeScript build");
    expect(state.taskState.activeArtifacts).toContain("src/context-engine/memory-system.ts");
    expect(state.verificationState.outcome).toBe("verified");
    expect(state.plannerState.status).toBe("complete");
    expect(buildAgenticSystemPromptAddition(state)).toContain("## Execution State");
  });

  it("marks failures as blockers and requests replanning or escalation", () => {
    const state = buildAgenticExecutionState({
      messages: [msg("user", "Implement the task-state model and get the tests passing.")],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "pnpm exec vitest failed because the planner module is missing.",
        },
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "failed",
          attempt: 2,
          maxAttempts: 3,
          summary: "Runtime attempt 2 failed after retry progression.",
        },
      ],
      promptErrorSummary: "Planner initialization failed before execution completed.",
    });

    expect(
      state.taskState.blockers.some((entry) => entry.includes("Planner initialization failed")),
    ).toBe(true);
    expect(["failed", "blocked"]).toContain(state.verificationState.outcome);
    expect(state.plannerState.status).toBe("blocked");
  });
});
