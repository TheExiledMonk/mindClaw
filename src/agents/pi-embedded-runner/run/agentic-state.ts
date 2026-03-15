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
export type AgenticRiskLevel = "low" | "medium" | "high";
export type AgenticVerificationOutcome =
  | "unverified"
  | "verified"
  | "partial"
  | "failed"
  | "blocked";
export type AgenticPlannerStatus = "continue" | "needs_replan" | "blocked" | "complete";
export type AgenticRetryClass =
  | "same_path_retry"
  | "skill_fallback"
  | "environment_fix"
  | "clarify"
  | "escalate";
export type AgenticEscalationReason =
  | "repeated_failure"
  | "environment_mismatch"
  | "missing_information"
  | "low_confidence"
  | "unknown";
export type AgenticAutonomyMode = "continue" | "fallback" | "approval_required" | "escalate";
export type AgenticFailureClass =
  | "tool_failure"
  | "verification_failure"
  | "prompt_failure"
  | "compaction_failure"
  | "overflow_recovery_failure"
  | "missing_information"
  | "environment_mismatch"
  | "unknown";

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
  failureClasses: AgenticFailureClass[];
};

export type AgenticPlannerState = {
  version: 1;
  status: AgenticPlannerStatus;
  nextAction?: string;
  rationale?: string;
  alternativeSkills: string[];
  retryClass: AgenticRetryClass;
  suggestedSkill?: string;
  shouldEscalate: boolean;
  escalationReason?: AgenticEscalationReason;
  remainingRetryBudget?: number;
};

export type AgenticExecutionState = {
  taskState: AgenticTaskState;
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
  governanceState: AgenticGovernanceState;
  orchestrationState: AgenticOrchestrationState;
  environmentState: AgenticEnvironmentState;
  failureLearningState: AgenticFailureLearningState;
};

export type AgenticGovernanceState = {
  version: 1;
  autonomyMode: AgenticAutonomyMode;
  riskLevel: AgenticRiskLevel;
  approvalRequired: boolean;
  secretPromptDetected: boolean;
  destructiveActionDetected: boolean;
  reasons: string[];
};

export type AgenticOrchestrationState = {
  version: 1;
  primarySkill?: string;
  fallbackSkills: string[];
  skillChain: string[];
  rankedSkills: string[];
  prerequisiteWarnings: string[];
  capabilityGaps: string[];
  multiSkillCandidate: boolean;
  rationale?: string;
};

export type AgenticEnvironmentState = {
  version: 1;
  workspaceKind: "project" | "temporary" | "unknown";
  gitBranch?: string;
  gitCommit?: string;
  capabilitySignals: string[];
  preferredValidationTools: string[];
  skillEnvironments: string[];
};

export type AgenticFailureLearningState = {
  version: 1;
  failurePattern: "clean_success" | "near_miss" | "blocked_path" | "hard_failure";
  learnFromFailure: boolean;
  failureReasons: string[];
  missingCapabilities: string[];
};

export type ProceduralExecutionRecord = {
  version: 1;
  availableSkills: string[];
  likelySkills: string[];
  alternativeSkills: string[];
  toolChain: string[];
  changedArtifacts: string[];
  outcome: AgenticVerificationOutcome;
  taskMode: AgenticTaskMode;
  templateCandidate: boolean;
  consolidationCandidate: boolean;
  nearMissCandidate: boolean;
  retryClass: AgenticRetryClass;
  suggestedSkill?: string;
  shouldEscalate: boolean;
  escalationReason?: AgenticEscalationReason;
  autonomyMode: AgenticAutonomyMode;
  riskLevel: AgenticRiskLevel;
  governanceReasons: string[];
  primarySkill?: string;
  fallbackSkills: string[];
  skillChain: string[];
  rankedSkills: string[];
  prerequisiteWarnings: string[];
  capabilityGaps: string[];
  multiSkillCandidate: boolean;
  workspaceKind: "project" | "temporary" | "unknown";
  capabilitySignals: string[];
  preferredValidationTools: string[];
  skillEnvironments: string[];
  failurePattern: "clean_success" | "near_miss" | "blocked_path" | "hard_failure";
  learnFromFailure: boolean;
  failureReasons: string[];
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

type SkillInfo = {
  name: string;
  primaryEnv?: string;
  requiredEnv?: string[];
};

type WorkspaceState = {
  workspaceName?: string;
  sessionRelativePath?: string;
  gitBranch?: string;
  gitCommit?: string;
  transcriptExists?: boolean;
};

type ProceduralMemorySkillSignal = {
  recommendedSkills: string[];
  weightedSkills: Map<string, number>;
};

function extractRecommendedProceduralSkills(memoryText?: string): string[] {
  if (!memoryText) {
    return [];
  }
  const match = memoryText.match(/Recommended procedural skills:\s*((?:\n-\s+[^\n]+)+)/i);
  if (!match) {
    return [];
  }
  return uniqueCompact(
    match[1]
      .split("\n")
      .map((line) => line.replace(/^\s*-\s+/, "").trim())
      .filter(Boolean),
    6,
  );
}

function extractProceduralMemorySkillSignals(params: {
  memoryText?: string;
  availableSkills?: string[];
}): ProceduralMemorySkillSignal {
  const recommendedSkills = extractRecommendedProceduralSkills(params.memoryText);
  const weightedSkills = new Map<string, number>();
  for (const skill of recommendedSkills) {
    weightedSkills.set(skill, (weightedSkills.get(skill) ?? 0) + 2.5);
  }
  if (!params.memoryText || !params.availableSkills || params.availableSkills.length === 0) {
    return { recommendedSkills, weightedSkills };
  }
  const guidanceMatch = params.memoryText.match(/Procedural guidance:\s*((?:\n-\s+[^\n]+)+)/i);
  if (!guidanceMatch) {
    return { recommendedSkills, weightedSkills };
  }
  const guidanceLines = guidanceMatch[1]
    .split("\n")
    .map((line) => line.replace(/^\s*-\s+/, "").trim())
    .filter(Boolean);
  for (const line of guidanceLines) {
    const normalizedLine = line.toLowerCase();
    const outcomeBoost = normalizedLine.includes("with outcome verified")
      ? 1.5
      : normalizedLine.includes("with outcome partial")
        ? 0.75
        : normalizedLine.includes("with outcome failed") ||
            normalizedLine.includes("with outcome blocked")
          ? -0.5
          : 0;
    const failureBoost = normalizedLine.includes("failure pattern clean_success")
      ? 1
      : normalizedLine.includes("failure pattern near_miss")
        ? -0.25
        : normalizedLine.includes("failure pattern blocked_path") ||
            normalizedLine.includes("failure pattern hard_failure")
          ? -0.75
          : 0;
    for (const skill of params.availableSkills) {
      const normalizedSkill = skill.toLowerCase();
      if (!normalizedLine.includes(normalizedSkill)) {
        continue;
      }
      let score = weightedSkills.get(skill) ?? 0;
      if (normalizedLine.includes(`primary skill ${normalizedSkill}`)) {
        score += 1.5;
      }
      if (normalizedLine.includes(`suggested fallback ${normalizedSkill}`)) {
        score += 1.25;
      }
      if (normalizedLine.includes(`fallback chain ${normalizedSkill}`)) {
        score += 0.75;
      }
      if (normalizedLine.includes(`uses skill path ${normalizedSkill}`)) {
        score += 1;
      }
      score += outcomeBoost + failureBoost;
      weightedSkills.set(skill, score);
    }
  }
  return { recommendedSkills, weightedSkills };
}

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

function classifyFailureSignals(params: {
  toolSignals?: ToolSignal[];
  retrySignals?: RetrySignal[];
  promptErrorSummary?: string;
}): AgenticFailureClass[] {
  const classes = new Set<AgenticFailureClass>();
  const promptError = params.promptErrorSummary?.toLowerCase() ?? "";
  if (promptError) {
    if (/\bcompaction\b/.test(promptError)) {
      classes.add("compaction_failure");
    } else if (/\boverflow\b/.test(promptError)) {
      classes.add("overflow_recovery_failure");
    } else if (
      /\bprompt\b/.test(promptError) ||
      /\b(initialization|initialisation|before execution)\b/.test(promptError)
    ) {
      classes.add("prompt_failure");
    } else {
      classes.add("prompt_failure");
    }
  }
  for (const signal of params.retrySignals ?? []) {
    if (signal.outcome !== "failed") {
      continue;
    }
    if (signal.phase === "compaction") {
      classes.add("compaction_failure");
    } else if (signal.phase === "overflow") {
      classes.add("overflow_recovery_failure");
    } else {
      classes.add("prompt_failure");
    }
  }
  for (const signal of params.toolSignals ?? []) {
    if (signal.status !== "error") {
      continue;
    }
    const text = `${signal.toolName} ${signal.summary}`.toLowerCase();
    if (
      /\b(test|typecheck|lint|build|compile|verify|check|tsc|typescript errors?|validation)\b/.test(
        text,
      )
    ) {
      classes.add("verification_failure");
    } else if (/\b(permission|forbidden|denied|sandbox|workspace only|not allowed)\b/.test(text)) {
      classes.add("environment_mismatch");
    } else if (/\bmissing|not found|unknown file|no such file|required|needs\b/.test(text)) {
      classes.add("missing_information");
    } else {
      classes.add("tool_failure");
    }
  }
  return [...classes];
}

function buildVerificationState(params: {
  toolSignals?: ToolSignal[];
  checkpointSignals?: CheckpointSignal[];
  retrySignals?: RetrySignal[];
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
  const failureClasses = classifyFailureSignals({
    toolSignals,
    retrySignals: params.retrySignals,
    promptErrorSummary: params.promptErrorSummary,
  });

  let outcome: AgenticVerificationOutcome = "unverified";
  if (params.promptErrorSummary || checkpointSignals.some((signal) => signal.kind === "failure")) {
    outcome = checksRun.length > 0 ? "failed" : "blocked";
  } else if (
    checkpointSignals.some((signal) => signal.kind === "completion") &&
    checksRun.length > 0
  ) {
    outcome = "verified";
  } else if (failingChecks.length > 0) {
    outcome = checksRun.length > 0 ? "failed" : "blocked";
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
    failureClasses,
  };
}

function buildPlannerState(params: {
  objective?: string;
  blockers: string[];
  verificationState: AgenticVerificationState;
  checkpointSignals?: CheckpointSignal[];
  activeArtifacts: string[];
  retrySignals?: RetrySignal[];
  availableSkills?: string[];
  likelySkills?: string[];
}): AgenticPlannerState {
  const checkpointSignals = params.checkpointSignals ?? [];
  const retrySignals = params.retrySignals ?? [];
  const likelySkills = params.likelySkills ?? [];
  const alternativeSkills = (params.availableSkills ?? []).filter(
    (skill) => !likelySkills.includes(skill),
  );
  const retryFailures = retrySignals.filter((signal) => signal.outcome === "failed");
  const latestRetrySignal = retrySignals.at(-1);
  const remainingRetryBudget =
    typeof latestRetrySignal?.maxAttempts === "number" &&
    typeof latestRetrySignal.attempt === "number"
      ? Math.max(0, latestRetrySignal.maxAttempts - latestRetrySignal.attempt)
      : undefined;

  const dominantFailureClass = params.verificationState.failureClasses[0];
  const suggestedSkill = alternativeSkills[0];
  const shouldEscalate =
    retryFailures.length > 0 ||
    dominantFailureClass === "environment_mismatch" ||
    (dominantFailureClass === "missing_information" && alternativeSkills.length === 0);
  const escalationReason: AgenticEscalationReason | undefined =
    retryFailures.length > 0
      ? "repeated_failure"
      : dominantFailureClass === "environment_mismatch"
        ? "environment_mismatch"
        : dominantFailureClass === "missing_information" && alternativeSkills.length === 0
          ? "missing_information"
          : params.verificationState.outcome === "blocked"
            ? "low_confidence"
            : undefined;
  const retryClass: AgenticRetryClass = shouldEscalate
    ? "escalate"
    : dominantFailureClass === "missing_information"
      ? "clarify"
      : suggestedSkill
        ? "skill_fallback"
        : "same_path_retry";
  if (checkpointSignals.some((signal) => signal.kind === "completion")) {
    return {
      version: 1,
      status: "complete",
      nextAction: "Confirm final deliverable and prepare handoff or follow-up notes.",
      rationale: "A completion checkpoint was observed in the current execution flow.",
      alternativeSkills: [],
      retryClass: "same_path_retry",
      shouldEscalate: false,
    };
  }
  if (params.blockers.length > 0) {
    const fallbackHint =
      alternativeSkills.length > 0
        ? ` Consider alternative skills: ${alternativeSkills.slice(0, 3).join(", ")}.`
        : "";
    return {
      version: 1,
      status: retryFailures.length > 0 ? "blocked" : "needs_replan",
      nextAction: shouldEscalate
        ? `Escalate or unblock the current failure before continuing.${fallbackHint}`.trim()
        : dominantFailureClass === "missing_information"
          ? "Clarify the missing input or fetch the missing prerequisite before retrying."
          : suggestedSkill
            ? `Switch to a fallback workflow using ${suggestedSkill} before retrying.${fallbackHint}`.trim()
            : dominantFailureClass === "verification_failure"
              ? `Do not repeat the same failing validation path; change the implementation strategy before retrying.${fallbackHint}`.trim()
              : `Replan around the current blocker and try a different execution path.${fallbackHint}`.trim(),
      rationale: dominantFailureClass
        ? `${dominantFailureClass}: ${params.blockers[0]}`
        : params.blockers[0],
      alternativeSkills,
      retryClass,
      suggestedSkill,
      shouldEscalate,
      escalationReason,
      remainingRetryBudget,
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
      alternativeSkills: [],
      retryClass: "same_path_retry",
      shouldEscalate: false,
      remainingRetryBudget,
    };
  }
  return {
    version: 1,
    status: "continue",
    nextAction: params.objective
      ? `Continue progressing toward: ${truncate(params.objective, 120)}`
      : "Clarify or restate the current objective before continuing.",
    rationale: params.verificationState.outcome === "blocked" ? "Execution is blocked." : undefined,
    alternativeSkills,
    retryClass,
    suggestedSkill,
    shouldEscalate,
    escalationReason,
    remainingRetryBudget,
  };
}

function buildGovernanceState(params: {
  messages: AgentMessage[];
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
}): AgenticGovernanceState {
  const corpus = params.messages.map((message) => extractMessageText(message)).join("\n");
  const lowered = corpus.toLowerCase();
  const secretPromptDetected =
    /\b(password|api key|token|credential|secret|private key)\b/.test(lowered) &&
    /\b(give|send|paste|provide|share|reveal|export|show)\b/.test(lowered);
  const destructiveActionDetected =
    /\b(rm -rf|git reset --hard|drop database|drop table|delete production|wipe|destroy)\b/.test(
      lowered,
    );
  const reasons = uniqueCompact(
    [
      secretPromptDetected ? "secret_exfiltration_request" : undefined,
      destructiveActionDetected ? "destructive_action_detected" : undefined,
      params.plannerState.shouldEscalate
        ? `planner:${params.plannerState.escalationReason ?? "unknown"}`
        : undefined,
      params.verificationState.outcome === "blocked" ? "blocked_execution" : undefined,
    ],
    5,
  );
  const approvalRequired = destructiveActionDetected;
  const autonomyMode: AgenticAutonomyMode =
    secretPromptDetected || params.plannerState.shouldEscalate
      ? "escalate"
      : approvalRequired
        ? "approval_required"
        : params.plannerState.retryClass === "skill_fallback"
          ? "fallback"
          : "continue";
  const riskLevel: AgenticRiskLevel =
    secretPromptDetected ||
    destructiveActionDetected ||
    params.plannerState.escalationReason === "environment_mismatch"
      ? "high"
      : params.plannerState.retryClass === "skill_fallback" ||
          params.verificationState.outcome === "partial" ||
          params.verificationState.outcome === "failed" ||
          params.verificationState.outcome === "blocked"
        ? "medium"
        : "low";
  return {
    version: 1,
    autonomyMode,
    riskLevel,
    approvalRequired,
    secretPromptDetected,
    destructiveActionDetected,
    reasons,
  };
}

function inferPreferredSkillEnvironment(
  text: string,
  taskMode: AgenticTaskMode,
): string | undefined {
  if (/\b(node|typescript|javascript|pnpm|npm|vitest|tsx|tsconfig)\b/i.test(text)) {
    return "node";
  }
  if (/\b(python|pytest|pip|poetry)\b/i.test(text)) {
    return "python";
  }
  if (/\b(rust|cargo)\b/i.test(text)) {
    return "rust";
  }
  if (/\b(go|golang)\b/i.test(text)) {
    return "go";
  }
  return taskMode === "coding" || taskMode === "debugging" ? "node" : undefined;
}

function inferCurrentExecutionEnvironments(params: {
  preferredEnv?: string;
  taskMode: AgenticTaskMode;
  toolSignals?: ToolSignal[];
  availableSkills?: SkillInfo[];
}): string[] {
  const environments = new Set<string>();
  if (params.preferredEnv) {
    environments.add(params.preferredEnv);
  }
  if ((params.toolSignals ?? []).some((signal) => signal.toolName === "exec")) {
    if (params.taskMode === "coding" || params.taskMode === "debugging") {
      environments.add("node");
    }
    if (params.taskMode === "operations") {
      environments.add("shell");
    }
  }
  for (const skill of params.availableSkills ?? []) {
    if (skill.primaryEnv && environments.has(skill.primaryEnv)) {
      environments.add(skill.primaryEnv);
    }
  }
  return [...environments];
}

function buildOrchestrationState(params: {
  taskMode: AgenticTaskMode;
  objectiveText?: string;
  availableSkills?: SkillInfo[];
  likelySkills?: string[];
  memoryRecommendedSkills?: string[];
  memoryWeightedSkills?: Map<string, number>;
  alternativeSkills?: string[];
  toolSignals?: ToolSignal[];
  plannerState?: AgenticPlannerState;
}): AgenticOrchestrationState {
  const availableSkills = params.availableSkills ?? [];
  const likelySkills = uniqueCompact(params.likelySkills ?? [], 6);
  const memoryRecommendedSkills = uniqueCompact(params.memoryRecommendedSkills ?? [], 6);
  const memoryWeightedSkills = params.memoryWeightedSkills ?? new Map<string, number>();
  const alternativeSkills = uniqueCompact(params.alternativeSkills ?? [], 6);
  const currentLikelySkill = likelySkills[0];
  const currentLikelyMemoryWeight = currentLikelySkill
    ? (memoryWeightedSkills.get(currentLikelySkill) ?? 0)
    : 0;
  const toolNames = new Set((params.toolSignals ?? []).map((signal) => signal.toolName));
  const preferredEnv = inferPreferredSkillEnvironment(params.objectiveText ?? "", params.taskMode);
  const currentExecutionEnvs = inferCurrentExecutionEnvironments({
    preferredEnv,
    taskMode: params.taskMode,
    toolSignals: params.toolSignals,
    availableSkills,
  });
  const rankedSkills = availableSkills
    .map((skill) => {
      let score = 0;
      const reasons: string[] = [];
      if (likelySkills.includes(skill.name)) {
        score += 4;
        reasons.push("objective-match");
      }
      if (memoryRecommendedSkills.includes(skill.name)) {
        score += 3.5;
        reasons.push("memory-recommended");
      }
      if (memoryWeightedSkills.has(skill.name)) {
        score += memoryWeightedSkills.get(skill.name) ?? 0;
        reasons.push("memory-quality");
      }
      if (alternativeSkills.includes(skill.name)) {
        score += 1.5;
        reasons.push("fallback-option");
      }
      if (preferredEnv && skill.primaryEnv === preferredEnv) {
        score += 1.5;
        reasons.push(`env:${preferredEnv}`);
      } else if (preferredEnv && skill.primaryEnv && skill.primaryEnv !== preferredEnv) {
        score -= 0.5;
        reasons.push(`weaker-env:${skill.primaryEnv}`);
      }
      const requiredEnv = uniqueCompact(skill.requiredEnv ?? [], 6);
      const requiredEnvMatches = requiredEnv.filter((env) => currentExecutionEnvs.includes(env));
      if (requiredEnv.length > 0 && requiredEnvMatches.length > 0) {
        score += 1.25;
        reasons.push(`requires:${requiredEnvMatches.join("|")}`);
      } else if (requiredEnv.length > 0) {
        score -= 2;
        reasons.push(`missing-env:${requiredEnv.join("|")}`);
      }
      if (params.plannerState?.retryClass === "skill_fallback") {
        if (skill.name === likelySkills[0]) {
          score -= 2;
          reasons.push("downgraded-after-near-miss");
        }
        if (alternativeSkills.includes(skill.name)) {
          score += 2;
          reasons.push("promoted-fallback");
        }
        if (
          alternativeSkills.includes(skill.name) &&
          (memoryWeightedSkills.get(skill.name) ?? 0) > currentLikelyMemoryWeight
        ) {
          score += 2.5;
          reasons.push("better-memory-backed-fallback");
        }
      }
      if (
        params.plannerState?.escalationReason === "environment_mismatch" &&
        skill.name === likelySkills[0]
      ) {
        score -= 3;
        reasons.push("env-mismatch");
      }
      if (
        params.plannerState?.retryClass === "same_path_retry" &&
        params.plannerState.status === "needs_replan" &&
        skill.name === likelySkills[0]
      ) {
        score -= 1;
        reasons.push("same-path-replan");
      }
      return { skill: skill.name, score, reasons };
    })
    .toSorted((a, b) => b.score - a.score || a.skill.localeCompare(b.skill))
    .map((entry) => entry.skill);
  const rankedSet = new Set(rankedSkills);
  const prerequisiteWarnings = uniqueCompact(
    availableSkills.flatMap((skill) => {
      const requiredEnv = uniqueCompact(skill.requiredEnv ?? [], 6);
      if (
        requiredEnv.length === 0 ||
        requiredEnv.some((env) => currentExecutionEnvs.includes(env)) ||
        (!rankedSet.has(skill.name) && !likelySkills.includes(skill.name))
      ) {
        return [];
      }
      return [`${skill.name}:missing-env:${requiredEnv.join("|")}`];
    }),
    8,
  );
  const primarySkill = rankedSkills[0] ?? likelySkills[0] ?? availableSkills[0]?.name;
  const fallbackSkills = rankedSkills.filter((skill) => skill !== primarySkill).slice(0, 4);
  const skillChain = uniqueCompact(
    [primarySkill, ...fallbackSkills].filter((value): value is string => Boolean(value)),
    4,
  );
  const capabilityGaps = uniqueCompact(
    [
      availableSkills.length === 0 ? "no_available_skills" : undefined,
      !primarySkill ? "no_primary_skill" : undefined,
      params.taskMode === "coding" || params.taskMode === "debugging"
        ? !toolNames.has("exec")
          ? "missing_validation_execution"
          : undefined
        : undefined,
      params.taskMode === "operations" && !toolNames.has("exec")
        ? "missing_operational_execution"
        : undefined,
      fallbackSkills.length === 0 && availableSkills.length > 1 ? "no_ranked_fallback" : undefined,
    ],
    5,
  );
  const multiSkillCandidate =
    skillChain.length > 1 &&
    (params.plannerState?.retryClass === "skill_fallback" ||
      prerequisiteWarnings.length > 0 ||
      params.taskMode === "planning" ||
      params.taskMode === "operations");
  const rationale = primarySkill
    ? `Prefer ${primarySkill}${fallbackSkills.length > 0 ? `, then fall back to ${fallbackSkills.slice(0, 2).join(", ")}` : ""}${preferredEnv ? ` for ${preferredEnv} work` : ""}${prerequisiteWarnings.length > 0 ? ` while watching ${prerequisiteWarnings[0]}` : ""}.`
    : availableSkills.length > 0
      ? "Available skills exist, but none match the current objective strongly."
      : "No matching skills are currently available for this objective.";
  return {
    version: 1,
    primarySkill,
    fallbackSkills,
    skillChain,
    rankedSkills,
    prerequisiteWarnings,
    capabilityGaps,
    multiSkillCandidate,
    rationale,
  };
}

function buildEnvironmentState(params: {
  workspaceTags?: string[];
  workspaceState?: WorkspaceState;
  toolSignals?: ToolSignal[];
  availableSkills?: SkillInfo[];
}): AgenticEnvironmentState {
  const workspaceKind: AgenticEnvironmentState["workspaceKind"] = (
    params.workspaceTags ?? []
  ).includes("tmp-workspace")
    ? "temporary"
    : (params.workspaceTags ?? []).includes("workspace")
      ? "project"
      : "unknown";
  const toolNames = new Set((params.toolSignals ?? []).map((signal) => signal.toolName));
  const capabilitySignals = uniqueCompact(
    [
      toolNames.has("exec") ? "can_execute_commands" : undefined,
      toolNames.has("read") ? "can_read_files" : undefined,
      toolNames.has("write") ? "can_write_files" : undefined,
      (params.workspaceTags ?? []).includes("git-worktree") ? "git_worktree" : undefined,
      params.workspaceState?.transcriptExists ? "transcript_present" : undefined,
    ],
    8,
  );
  const preferredValidationTools = uniqueCompact(
    (params.toolSignals ?? [])
      .filter((signal) =>
        /\b(test|typecheck|lint|build|compile|verify|check)\b/i.test(signal.summary),
      )
      .map((signal) => signal.toolName),
    4,
  );
  const skillEnvironments = uniqueCompact(
    (params.availableSkills ?? []).map((skill) => skill.primaryEnv).filter(Boolean),
    6,
  );
  return {
    version: 1,
    workspaceKind,
    gitBranch: params.workspaceState?.gitBranch,
    gitCommit: params.workspaceState?.gitCommit,
    capabilitySignals,
    preferredValidationTools,
    skillEnvironments,
  };
}

function buildFailureLearningState(params: {
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
  orchestrationState: AgenticOrchestrationState;
}): AgenticFailureLearningState {
  const failurePattern: AgenticFailureLearningState["failurePattern"] =
    params.verificationState.outcome === "verified"
      ? "clean_success"
      : params.plannerState.retryClass === "skill_fallback" ||
          params.verificationState.outcome === "partial"
        ? "near_miss"
        : params.plannerState.shouldEscalate || params.verificationState.outcome === "blocked"
          ? "blocked_path"
          : "hard_failure";
  const failureReasons = uniqueCompact(
    [...params.verificationState.failureClasses, params.plannerState.escalationReason],
    6,
  );
  return {
    version: 1,
    failurePattern,
    learnFromFailure: failurePattern === "near_miss" || failurePattern === "blocked_path",
    failureReasons,
    missingCapabilities: params.orchestrationState.capabilityGaps,
  };
}

function reconcilePlannerStateWithOrchestration(params: {
  plannerState: AgenticPlannerState;
  orchestrationState: AgenticOrchestrationState;
  likelySkills?: string[];
}): AgenticPlannerState {
  const likelySkills = uniqueCompact(params.likelySkills ?? [], 6);
  if (params.plannerState.retryClass !== "skill_fallback") {
    return params.plannerState;
  }
  const rankedAlternatives = params.orchestrationState.rankedSkills.filter(
    (skill) => !likelySkills.includes(skill),
  );
  if (rankedAlternatives.length === 0) {
    return params.plannerState;
  }
  const suggestedSkill = rankedAlternatives[0];
  const nextAction = params.plannerState.nextAction?.includes("fallback workflow using")
    ? `Switch to a fallback workflow using ${suggestedSkill} before retrying. Consider alternative skills: ${rankedAlternatives.slice(0, 3).join(", ")}.`
    : params.plannerState.nextAction;
  return {
    ...params.plannerState,
    suggestedSkill,
    alternativeSkills: rankedAlternatives,
    nextAction,
  };
}

export function buildAgenticExecutionState(params: {
  messages: AgentMessage[];
  activeArtifacts?: string[];
  workspaceTags?: string[];
  workspaceState?: WorkspaceState;
  toolSignals?: ToolSignal[];
  diffSignals?: DiffSignal[];
  checkpointSignals?: CheckpointSignal[];
  retrySignals?: RetrySignal[];
  promptErrorSummary?: string;
  availableSkills?: string[];
  likelySkills?: string[];
  availableSkillInfo?: SkillInfo[];
  memorySystemPromptAddition?: string;
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
    retrySignals: params.retrySignals,
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
    availableSkills: params.availableSkills,
    likelySkills: params.likelySkills,
  });
  const governanceState = buildGovernanceState({
    messages: params.messages,
    verificationState,
    plannerState,
  });
  const availableSkillInfo =
    params.availableSkillInfo && params.availableSkillInfo.length > 0
      ? params.availableSkillInfo
      : (params.availableSkills ?? []).map((skill) => ({ name: skill }));
  const memorySkillSignals = extractProceduralMemorySkillSignals({
    memoryText: params.memorySystemPromptAddition,
    availableSkills: availableSkillInfo.map((skill) => skill.name),
  });
  const orchestrationState = buildOrchestrationState({
    taskMode: taskState.taskMode,
    objectiveText: taskState.objective,
    availableSkills: availableSkillInfo,
    likelySkills: params.likelySkills,
    memoryRecommendedSkills: memorySkillSignals.recommendedSkills,
    memoryWeightedSkills: memorySkillSignals.weightedSkills,
    alternativeSkills: plannerState.alternativeSkills,
    toolSignals: params.toolSignals,
    plannerState,
  });
  const environmentState = buildEnvironmentState({
    workspaceTags: params.workspaceTags,
    workspaceState: params.workspaceState,
    toolSignals: params.toolSignals,
    availableSkills: availableSkillInfo,
  });
  const failureLearningState = buildFailureLearningState({
    verificationState,
    plannerState,
    orchestrationState,
  });
  const reconciledPlannerState = reconcilePlannerStateWithOrchestration({
    plannerState,
    orchestrationState,
    likelySkills: params.likelySkills,
  });

  return {
    taskState,
    verificationState,
    plannerState: reconciledPlannerState,
    governanceState,
    orchestrationState,
    environmentState,
    failureLearningState,
  };
}

export function extractAgenticMemoryRecommendations(memoryText?: string): {
  recommendedSkills: string[];
} {
  return {
    recommendedSkills: extractProceduralMemorySkillSignals({ memoryText }).recommendedSkills,
  };
}

export function buildAgenticSystemPromptAddition(state: AgenticExecutionState): string | undefined {
  const failureGuidance =
    state.verificationState.failureClasses.length > 0
      ? `Failure classes: ${state.verificationState.failureClasses.join(", ")}`
      : undefined;
  const antiRepeatGuidance =
    state.plannerState.status === "needs_replan" || state.plannerState.status === "blocked"
      ? "Do not repeat the same failing path. Change strategy, narrow scope, or escalate."
      : undefined;
  const fallbackSkillGuidance =
    state.plannerState.alternativeSkills.length > 0
      ? `Fallback skills to consider: ${state.plannerState.alternativeSkills.slice(0, 3).join(", ")}`
      : undefined;
  const retryGuidance = `Retry class: ${state.plannerState.retryClass}`;
  const escalationGuidance = state.plannerState.shouldEscalate
    ? `Escalation required: ${state.plannerState.escalationReason ?? "unknown"}`
    : undefined;
  const governanceGuidance = `Autonomy mode: ${state.governanceState.autonomyMode} (risk=${state.governanceState.riskLevel})`;
  const governanceReasons =
    state.governanceState.reasons.length > 0
      ? `Governance reasons: ${state.governanceState.reasons.join(", ")}`
      : undefined;
  const orchestrationGuidance = state.orchestrationState.primarySkill
    ? `Primary skill: ${state.orchestrationState.primarySkill}`
    : undefined;
  const fallbackChainGuidance =
    state.orchestrationState.fallbackSkills.length > 0
      ? `Fallback chain: ${state.orchestrationState.fallbackSkills.join(" -> ")}`
      : undefined;
  const capabilityGapGuidance =
    state.orchestrationState.capabilityGaps.length > 0
      ? `Capability gaps: ${state.orchestrationState.capabilityGaps.join(", ")}`
      : undefined;
  const rankedSkillsGuidance =
    state.orchestrationState.rankedSkills.length > 0
      ? `Ranked skills: ${state.orchestrationState.rankedSkills.join(" > ")}`
      : undefined;
  const prerequisiteGuidance =
    state.orchestrationState.prerequisiteWarnings.length > 0
      ? `Skill prerequisites: ${state.orchestrationState.prerequisiteWarnings.join(", ")}`
      : undefined;
  const environmentGuidance = `Environment: ${state.environmentState.workspaceKind}${state.environmentState.gitBranch ? ` branch=${state.environmentState.gitBranch}` : ""}`;
  const capabilitySignalsGuidance =
    state.environmentState.capabilitySignals.length > 0
      ? `Capabilities: ${state.environmentState.capabilitySignals.join(", ")}`
      : undefined;
  const failureLearningGuidance = `Failure pattern: ${state.failureLearningState.failurePattern}`;
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
    failureGuidance,
    retryGuidance,
    escalationGuidance,
    governanceGuidance,
    governanceReasons,
    orchestrationGuidance,
    fallbackChainGuidance,
    rankedSkillsGuidance,
    prerequisiteGuidance,
    capabilityGapGuidance,
    environmentGuidance,
    capabilitySignalsGuidance,
    failureLearningGuidance,
    state.plannerState.nextAction ? `Next action: ${state.plannerState.nextAction}` : undefined,
    fallbackSkillGuidance,
    antiRepeatGuidance,
  ].filter((line): line is string => Boolean(line));

  return lines.length > 2 ? lines.join("\n") : undefined;
}

export function buildProceduralExecutionRecord(params: {
  skillsSnapshot?: SkillSnapshot;
  taskState: AgenticTaskState;
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
  governanceState: AgenticGovernanceState;
  orchestrationState: AgenticOrchestrationState;
  environmentState: AgenticEnvironmentState;
  failureLearningState: AgenticFailureLearningState;
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
  const alternativeSkills = availableSkills.filter((skill) => !likelySkills.includes(skill));
  const toolChain = uniqueCompact(params.toolSignals?.map((signal) => signal.toolName) ?? [], 8);
  const consolidationCandidate = likelySkills.length > 1;
  const nearMissCandidate =
    params.verificationState.outcome === "partial" ||
    params.verificationState.outcome === "failed" ||
    params.verificationState.outcome === "blocked";
  const templateCandidate =
    params.verificationState.outcome !== "failed" &&
    params.verificationState.outcome !== "blocked" &&
    (changedArtifacts.length > 1 || toolChain.length > 1);

  let nextImprovement: string | undefined;
  const resolvedPrimarySkill =
    params.orchestrationState.primarySkill ?? likelySkills[0] ?? availableSkills[0];
  const resolvedFallbackSkills =
    params.orchestrationState.fallbackSkills.length > 0
      ? params.orchestrationState.fallbackSkills
      : alternativeSkills.filter((skill) => skill !== resolvedPrimarySkill);
  const resolvedSkillChain =
    params.orchestrationState.skillChain.length > 0
      ? params.orchestrationState.skillChain
      : uniqueCompact(
          [resolvedPrimarySkill, ...resolvedFallbackSkills].filter((value): value is string =>
            Boolean(value),
          ),
          4,
        );
  const resolvedRankedSkills =
    params.orchestrationState.rankedSkills.length > 0
      ? params.orchestrationState.rankedSkills
      : uniqueCompact(
          [resolvedPrimarySkill, ...resolvedFallbackSkills].filter((value): value is string =>
            Boolean(value),
          ),
          6,
        );
  if (nearMissCandidate && alternativeSkills.length > 0) {
    nextImprovement = `Capture why the primary path fell short and compare it with alternative skills such as ${alternativeSkills.slice(0, 3).join(", ")}.`;
  } else if (params.plannerState.shouldEscalate) {
    nextImprovement = `Document why this workflow now requires escalation${params.plannerState.escalationReason ? ` (${params.plannerState.escalationReason})` : ""} before reuse.`;
  } else if (
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
    alternativeSkills,
    toolChain,
    changedArtifacts,
    outcome: params.verificationState.outcome,
    taskMode: params.taskState.taskMode,
    templateCandidate,
    consolidationCandidate,
    nearMissCandidate,
    retryClass: params.plannerState.retryClass,
    suggestedSkill: params.plannerState.suggestedSkill,
    shouldEscalate: params.plannerState.shouldEscalate,
    escalationReason: params.plannerState.escalationReason,
    autonomyMode: params.governanceState.autonomyMode,
    riskLevel: params.governanceState.riskLevel,
    governanceReasons: params.governanceState.reasons,
    primarySkill: resolvedPrimarySkill,
    fallbackSkills: resolvedFallbackSkills,
    skillChain: resolvedSkillChain,
    rankedSkills: resolvedRankedSkills,
    prerequisiteWarnings: params.orchestrationState.prerequisiteWarnings,
    capabilityGaps: params.orchestrationState.capabilityGaps,
    multiSkillCandidate: params.orchestrationState.multiSkillCandidate,
    workspaceKind: params.environmentState.workspaceKind,
    capabilitySignals: params.environmentState.capabilitySignals,
    preferredValidationTools: params.environmentState.preferredValidationTools,
    skillEnvironments: params.environmentState.skillEnvironments,
    failurePattern: params.failureLearningState.failurePattern,
    learnFromFailure: params.failureLearningState.learnFromFailure,
    failureReasons: params.failureLearningState.failureReasons,
    nextImprovement,
  };
}
