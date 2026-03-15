import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  buildAgenticExecutionState,
  buildAgenticSystemPromptAddition,
  buildProceduralExecutionRecord,
} from "./agentic-state.js";

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
    expect(state.verificationState.failureClasses).toContain("prompt_failure");
    expect(state.plannerState.status).toBe("blocked");
    expect(state.plannerState.rationale).toContain("prompt_failure");
    expect(buildAgenticSystemPromptAddition(state)).toContain(
      "Do not repeat the same failing path.",
    );
  });

  it("classifies validation failures and tells the planner to change strategy", () => {
    const state = buildAgenticExecutionState({
      messages: [msg("user", "Fix the broken typecheck and rerun validation.")],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "pnpm exec tsc -p tsconfig.json --noEmit failed with TypeScript errors.",
        },
      ],
    });

    expect(state.verificationState.failureClasses).toContain("verification_failure");
    expect(state.plannerState.status).toBe("needs_replan");
    expect(state.plannerState.nextAction).toContain(
      "Do not repeat the same failing validation path",
    );
    expect(buildAgenticSystemPromptAddition(state)).toContain(
      "Failure classes: verification_failure",
    );
  });

  it("builds procedural execution records for skill and workflow learning", () => {
    const state = buildAgenticExecutionState({
      messages: [
        msg(
          "user",
          "Plan the memory diagnostics rollout and update the markdown report workflow for the acceptance report.",
        ),
      ],
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the diagnostics markdown template.",
        },
        {
          toolName: "exec",
          status: "success",
          summary: "Ran markdown report generation successfully.",
        },
      ],
      diffSignals: [
        {
          artifactRef: "scripts/memory-diagnostics-report.ts",
          changeKind: "modified",
          summary: "Updated diagnostics report generation.",
        },
        {
          artifactRef: "docs/memory-system-operations.md",
          changeKind: "modified",
          summary: "Updated operations guidance.",
        },
      ],
    });
    const record = buildProceduralExecutionRecord({
      skillsSnapshot: {
        prompt: "",
        skills: [
          { name: "memory-diagnostics", primaryEnv: "node" },
          { name: "acceptance-report", primaryEnv: "node" },
        ],
      },
      taskState: state.taskState,
      verificationState: state.verificationState,
      plannerState: state.plannerState,
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the diagnostics markdown template.",
        },
        {
          toolName: "exec",
          status: "success",
          summary: "Ran markdown report generation successfully.",
        },
      ],
      diffSignals: [
        {
          artifactRef: "scripts/memory-diagnostics-report.ts",
          changeKind: "modified",
          summary: "Updated diagnostics report generation.",
        },
        {
          artifactRef: "docs/memory-system-operations.md",
          changeKind: "modified",
          summary: "Updated operations guidance.",
        },
      ],
    });

    expect(record.availableSkills).toEqual(
      expect.arrayContaining(["memory-diagnostics", "acceptance-report"]),
    );
    expect(record.toolChain).toEqual(expect.arrayContaining(["read", "exec"]));
    expect(record.changedArtifacts).toEqual(
      expect.arrayContaining([
        "scripts/memory-diagnostics-report.ts",
        "docs/memory-system-operations.md",
      ]),
    );
    expect(record.templateCandidate).toBe(true);
  });
});
