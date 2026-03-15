import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SkillSnapshot } from "../../skills.js";

export type AgenticTaskMode =
  | "coding"
  | "debugging"
  | "support"
  | "research"
  | "planning"
  | "operations"
  | "general";

export type AgenticConfidence = "low" | "medium" | "high";
export type AgenticVerificationOutcome =
  | "unverified"
  | "verified"
  | "partial"
  | "failed"
  | "blocked";
export type AgenticPlannerStatus = "continue" | "needs_replan" | "blocked" | "complete";

export type AgenticTaskState = {
  version: 1;
  objective?: string;
  taskMode: AgenticTaskMode;
  subtasks: string[];
  blockers: string[];
  assumptions: string[];
  successCriteria: string[];
  activeArtifacts: string[];
  currentStrategy?: string;
  confidence: AgenticConfidence;
};

export type AgenticVerificationState = {
  version: 1;
  outcome: AgenticVerificationOutcome;
  evidence: string[];
  checksRun: string[];
  failingChecks: string[];
};

export type AgenticPlannerState = {
  version: 1;
  status: AgenticPlannerStatus;
  nextAction?: string;
  rationale?: string;
};

export type AgenticExecutionState = {
  taskState: AgenticTaskState;
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
};

export type ProceduralExecutionRecord = {
  version: 1;
  availableSkills: string[];
  likelySkills: string[];
  toolChain: string[];
  changedArtifacts: string[];
  outcome: AgenticVerificationOutcome;
  taskMode: AgenticTaskMode;
  templateCandidate: boolean;
  consolidationCandidate: boolean;
  nextImprovement?: string;
};

type ToolSignal = {
  toolName: string;
  status: "success" | "error";
  summary: string;
  artifactRefs?: string[];
};

type DiffSignal = {
  artifactRef: string;
  changeKind: "modified" | "created" | "deleted";
  summary: string;
};

type CheckpointSignal = {
  kind: "completion" | "handoff" | "failure";
  summary: string;
  artifactRefs?: string[];
};

type RetrySignal = {
  phase: "overflow" | "compaction" | "prompt";
  outcome: "recovered" | "failed";
  attempt?: number;
  maxAttempts?: number;
  summary: string;
};

function extractMessageText(message: AgentMessage): string {
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .flatMap((block) => {
      if (!block || typeof block !== "object") {
        return [];
      }
      const text = (block as { text?: unknown }).text;
      return typeof text === "string" && text.trim() ? [text.trim()] : [];
    })
    .join("\n")
    .trim();
}

function truncate(value: string | undefined, max = 180): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function uniqueCompact(values: Array<string | undefined>, limit = 6): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

function extractListCandidates(text: string): string[] {
  const numberedOrBulleted = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(\d+\.|[-*])\s+/.test(line))
    .map((line) => line.replace(/^(\d+\.|[-*])\s+/, "").trim());
  if (numberedOrBulleted.length > 0) {
    return numberedOrBulleted;
  }
  return text
    .split(/[.;]\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 18)
    .slice(0, 4);
}

function inferTaskMode(text: string): AgenticTaskMode {
  if (/\b(debug|bug|broken|fix|regression|failing|error|issue)\b/i.test(text)) {
    return "debugging";
  }
  if (
    /\b(code|implement|refactor|build|typescript|javascript|python|function|class)\b/i.test(text)
  ) {
    return "coding";
  }
  if (/\b(customer|ticket|support|incident|user report|case)\b/i.test(text)) {
    return "support";
  }
  if (/\b(research|investigate|compare|evaluate|look up|analyze)\b/i.test(text)) {
    return "research";
  }
  if (/\b(plan|roadmap|design|spec|architecture|strategy)\b/i.test(text)) {
    return "planning";
  }
  if (/\b(release|deploy|rollback|migration|ops|operational|runbook)\b/i.test(text)) {
    return "operations";
  }
  return "general";
}

function summarizeStrategy(params: {
  toolSignals?: ToolSignal[];
  diffSignals?: DiffSignal[];
}): string | undefined {
  const tools = uniqueCompact(params.toolSignals?.map((signal) => signal.toolName) ?? [], 3);
  const artifacts = uniqueCompact(params.diffSignals?.map((signal) => signal.artifactRef) ?? [], 2);
  if (tools.length === 0 && artifacts.length === 0) {
    return undefined;
  }
  if (tools.length > 0 && artifacts.length > 0) {
    return `Using ${tools.join(", ")} while working on ${artifacts.join(", ")}.`;
  }
  if (tools.length > 0) {
    return `Using ${tools.join(", ")} as the current execution path.`;
  }
  return `Working directly on ${artifacts.join(", ")}.`;
}

function buildVerificationState(params: {
  toolSignals?: ToolSignal[];
  checkpointSignals?: CheckpointSignal[];
  promptErrorSummary?: string;
}): AgenticVerificationState {
  const toolSignals = params.toolSignals ?? [];
  const checkpointSignals = params.checkpointSignals ?? [];
  const checksRun = uniqueCompact(
    toolSignals
      .filter((signal) =>
        /\b(test|typecheck|lint|build|compile|verify|check)\b/i.test(
          `${signal.toolName} ${signal.summary}`,
        ),
      )
      .map((signal) => `${signal.toolName}:${signal.status}`),
    8,
  );
  const failingChecks = uniqueCompact(
    toolSignals
      .filter((signal) => signal.status === "error")
      .map((signal) => `${signal.toolName}: ${truncate(signal.summary, 96)}`),
    6,
  );
  const evidence = uniqueCompact(
    [
      ...toolSignals
        .filter((signal) => signal.status === "success")
        .map((signal) => `${signal.toolName}: ${truncate(signal.summary, 96)}`),
      ...checkpointSignals.map((signal) => `${signal.kind}: ${truncate(signal.summary, 96)}`),
    ],
    8,
  );

  let outcome: AgenticVerificationOutcome = "unverified";
  if (params.promptErrorSummary || checkpointSignals.some((signal) => signal.kind === "failure")) {
    outcome = checksRun.length > 0 ? "failed" : "blocked";
  } else if (
    checkpointSignals.some((signal) => signal.kind === "completion") &&
    checksRun.length > 0
  ) {
    outcome = "verified";
  } else if (checksRun.length > 0 && failingChecks.length === 0) {
    outcome = "verified";
  } else if (
    toolSignals.some((signal) => signal.status === "success") ||
    checkpointSignals.length > 0
  ) {
    outcome = "partial";
  }

  return {
    version: 1,
    outcome,
    evidence,
    checksRun,
    failingChecks,
  };
}

function buildPlannerState(params: {
  objective?: string;
  blockers: string[];
  verificationState: AgenticVerificationState;
  checkpointSignals?: CheckpointSignal[];
  activeArtifacts: string[];
  retrySignals?: RetrySignal[];
}): AgenticPlannerState {
  const checkpointSignals = params.checkpointSignals ?? [];
  const retrySignals = params.retrySignals ?? [];
  if (checkpointSignals.some((signal) => signal.kind === "completion")) {
    return {
      version: 1,
      status: "complete",
      nextAction: "Confirm final deliverable and prepare handoff or follow-up notes.",
      rationale: "A completion checkpoint was observed in the current execution flow.",
    };
  }
  if (params.blockers.length > 0) {
    const retryFailures = retrySignals.filter((signal) => signal.outcome === "failed");
    return {
      version: 1,
      status: retryFailures.length > 0 ? "blocked" : "needs_replan",
      nextAction:
        retryFailures.length > 0
          ? "Escalate or unblock the current failure before continuing."
          : "Replan around the current blocker and try a different execution path.",
      rationale: params.blockers[0],
    };
  }
  if (params.activeArtifacts.length > 0) {
    return {
      version: 1,
      status: "continue",
      nextAction: `Continue work on ${params.activeArtifacts[0]} and validate the latest change.`,
      rationale:
        params.verificationState.outcome === "verified"
          ? "Recent work has evidence behind it, so the next step is forward progress."
          : "Work is active, but more verification is still needed.",
    };
  }
  return {
    version: 1,
    status: "continue",
    nextAction: params.objective
      ? `Continue progressing toward: ${truncate(params.objective, 120)}`
      : "Clarify or restate the current objective before continuing.",
    rationale: params.verificationState.outcome === "blocked" ? "Execution is blocked." : undefined,
  };
}

export function buildAgenticExecutionState(params: {
  messages: AgentMessage[];
  activeArtifacts?: string[];
  workspaceTags?: string[];
  toolSignals?: ToolSignal[];
  diffSignals?: DiffSignal[];
  checkpointSignals?: CheckpointSignal[];
  retrySignals?: RetrySignal[];
  promptErrorSummary?: string;
}): AgenticExecutionState {
  const texts = params.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map(extractMessageText)
    .filter(Boolean);
  const latestUserText = [...params.messages]
    .toReversed()
    .find((message) => message.role === "user");
  const latestUserSummary = latestUserText
    ? truncate(extractMessageText(latestUserText), 220)
    : undefined;
  const corpus = texts.join("\n");
  const activeArtifacts = uniqueCompact(
    [
      ...(params.activeArtifacts ?? []),
      ...(params.diffSignals?.map((signal) => signal.artifactRef) ?? []),
      ...(params.toolSignals?.flatMap((signal) => signal.artifactRefs ?? []) ?? []),
      ...(params.checkpointSignals?.flatMap((signal) => signal.artifactRefs ?? []) ?? []),
    ],
    6,
  );
  const blockers = uniqueCompact(
    [
      truncate(params.promptErrorSummary, 140),
      ...(params.toolSignals ?? [])
        .filter((signal) => signal.status === "error")
        .map((signal) => `${signal.toolName}: ${truncate(signal.summary, 120)}`),
      ...(params.checkpointSignals ?? [])
        .filter((signal) => signal.kind === "failure")
        .map((signal) => truncate(signal.summary, 140)),
      ...(params.retrySignals ?? [])
        .filter((signal) => signal.outcome === "failed")
        .map((signal) => truncate(signal.summary, 140)),
    ],
    5,
  );
  const successCriteria = uniqueCompact(
    extractListCandidates(latestUserSummary ?? "").map((item) => truncate(item, 120)),
    4,
  );
  const assumptions = uniqueCompact(
    [
      ...(params.workspaceTags ?? []).slice(0, 3).map((tag) => `Environment tag: ${tag}`),
      activeArtifacts.length > 0
        ? `Primary artifacts are ${activeArtifacts.slice(0, 2).join(", ")}.`
        : undefined,
    ],
    4,
  );
  const verificationState = buildVerificationState({
    toolSignals: params.toolSignals,
    checkpointSignals: params.checkpointSignals,
    promptErrorSummary: params.promptErrorSummary,
  });
  const taskState: AgenticTaskState = {
    version: 1,
    objective: latestUserSummary,
    taskMode: inferTaskMode(corpus),
    subtasks: uniqueCompact(
      extractListCandidates(latestUserSummary ?? "").map((item) => truncate(item, 120)),
      4,
    ),
    blockers,
    assumptions,
    successCriteria:
      successCriteria.length > 0 ? successCriteria : latestUserSummary ? [latestUserSummary] : [],
    activeArtifacts,
    currentStrategy: summarizeStrategy({
      toolSignals: params.toolSignals,
      diffSignals: params.diffSignals,
    }),
    confidence:
      blockers.length > 0 ? "low" : verificationState.outcome === "verified" ? "high" : "medium",
  };
  const plannerState = buildPlannerState({
    objective: taskState.objective,
    blockers,
    verificationState,
    checkpointSignals: params.checkpointSignals,
    activeArtifacts,
    retrySignals: params.retrySignals,
  });

  return {
    taskState,
    verificationState,
    plannerState,
  };
}

export function buildAgenticSystemPromptAddition(state: AgenticExecutionState): string | undefined {
  const lines = [
    "## Execution State",
    state.taskState.objective ? `Objective: ${state.taskState.objective}` : undefined,
    `Task mode: ${state.taskState.taskMode}`,
    state.taskState.activeArtifacts.length > 0
      ? `Active artifacts: ${state.taskState.activeArtifacts.slice(0, 3).join(", ")}`
      : undefined,
    state.taskState.currentStrategy
      ? `Current strategy: ${state.taskState.currentStrategy}`
      : undefined,
    state.taskState.blockers.length > 0
      ? `Current blockers: ${state.taskState.blockers.join(" | ")}`
      : undefined,
    `Verification state: ${state.verificationState.outcome}`,
    state.plannerState.nextAction ? `Next action: ${state.plannerState.nextAction}` : undefined,
  ].filter((line): line is string => Boolean(line));

  return lines.length > 2 ? lines.join("\n") : undefined;
}

export function buildProceduralExecutionRecord(params: {
  skillsSnapshot?: SkillSnapshot;
  taskState: AgenticTaskState;
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
  toolSignals?: ToolSignal[];
  diffSignals?: DiffSignal[];
}): ProceduralExecutionRecord {
  const availableSkills = uniqueCompact(
    params.skillsSnapshot?.skills.map((skill) => skill.name) ?? [],
    12,
  );
  const objectiveText = params.taskState.objective?.toLowerCase() ?? "";
  const likelySkills = availableSkills.filter((skill) => {
    const normalized = skill.toLowerCase();
    const tokens = normalized.split(/[^a-z0-9]+/i).filter((token) => token.length >= 3);
    return tokens.some((token) => objectiveText.includes(token));
  });
  const changedArtifacts = uniqueCompact(
    params.diffSignals?.map((signal) => signal.artifactRef) ?? [],
    8,
  );
  const toolChain = uniqueCompact(params.toolSignals?.map((signal) => signal.toolName) ?? [], 8);
  const consolidationCandidate = likelySkills.length > 1;
  const templateCandidate =
    params.verificationState.outcome !== "failed" &&
    params.verificationState.outcome !== "blocked" &&
    (changedArtifacts.length > 1 || toolChain.length > 1);

  let nextImprovement: string | undefined;
  if (
    params.verificationState.outcome === "failed" ||
    params.verificationState.outcome === "blocked"
  ) {
    nextImprovement =
      "Capture a stronger fallback or alternative execution path for this workflow.";
  } else if (consolidationCandidate) {
    nextImprovement =
      "Consider consolidating overlapping skills into a more generic reusable workflow.";
  } else if (templateCandidate && likelySkills.length === 1) {
    nextImprovement = `Consider parameterizing ${likelySkills[0]} so it can cover similar jobs without duplication.`;
  } else if (params.plannerState.status === "needs_replan") {
    nextImprovement = "Improve replanning guidance for this workflow before reusing it.";
  }

  return {
    version: 1,
    availableSkills,
    likelySkills,
    toolChain,
    changedArtifacts,
    outcome: params.verificationState.outcome,
    taskMode: params.taskState.taskMode,
    templateCandidate,
    consolidationCandidate,
    nextImprovement,
  };
}
