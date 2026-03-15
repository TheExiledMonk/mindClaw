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
export type AgenticGoalSatisfaction = "satisfied" | "uncertain" | "unsatisfied";
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

export type AgenticPlanStepStatus = "pending" | "in_progress" | "completed" | "blocked";

export type AgenticPlanStep = {
  title: string;
  status: AgenticPlanStepStatus;
  kind: "implementation" | "verification" | "handoff";
};

export type AgenticWorkflowStep = {
  skill: string;
  role: "primary" | "supporting" | "verification" | "fallback";
};

export type AgenticConsolidationAction =
  | "none"
  | "extend_existing"
  | "generalize_existing"
  | "create_new";

export type AgenticTaskState = {
  version: 1;
  objective?: string;
  taskMode: AgenticTaskMode;
  subtasks: string[];
  blockers: string[];
  assumptions: string[];
  successCriteria: string[];
  planSteps: AgenticPlanStep[];
  activeArtifacts: string[];
  currentStrategy?: string;
  confidence: AgenticConfidence;
};

export type AgenticVerificationState = {
  version: 1;
  outcome: AgenticVerificationOutcome;
  goalSatisfaction: AgenticGoalSatisfaction;
  evidence: string[];
  goalSignals: string[];
  checksRun: string[];
  failingChecks: string[];
  unresolvedCriteria: string[];
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
  workflowSteps: AgenticWorkflowStep[];
  rankedSkills: string[];
  effectiveSkills: string[];
  effectiveFamilies: string[];
  promotedSkills: string[];
  prerequisiteWarnings: string[];
  capabilityGaps: string[];
  hasViableFallback: boolean;
  multiSkillCandidate: boolean;
  chainedWorkflow: boolean;
  skillFamilies: string[];
  overlappingSkills: string[];
  mergeCandidate: boolean;
  mergeSkills: string[];
  stabilityState: "neutral" | "recovered_watch" | "stable_reuse";
  stabilitySkills: string[];
  consolidationAction: AgenticConsolidationAction;
  rationale?: string;
};

export type AgenticEnvironmentState = {
  version: 1;
  workspaceKind: "project" | "temporary" | "unknown";
  gitBranch?: string;
  gitCommit?: string;
  repoFingerprint?: string;
  capabilitySignals: string[];
  preferredValidationTools: string[];
  skillEnvironments: string[];
  languageSignals?: string[];
  frameworkSignals?: string[];
  validationCommands?: string[];
  permissionSignals?: string[];
  branchConventions?: string[];
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
  goalSatisfaction: AgenticGoalSatisfaction;
  taskMode: AgenticTaskMode;
  planSteps: AgenticPlanStep[];
  templateCandidate: boolean;
  consolidationCandidate: boolean;
  consolidationAction: AgenticConsolidationAction;
  overlappingSkills: string[];
  skillFamilies: string[];
  mergeCandidate: boolean;
  mergeSkills: string[];
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
  workflowSteps: AgenticWorkflowStep[];
  rankedSkills: string[];
  effectiveSkills: string[];
  effectiveFamilies: string[];
  promotedSkills: string[];
  stabilityState: "neutral" | "recovered_watch" | "stable_reuse";
  stabilitySkills: string[];
  prerequisiteWarnings: string[];
  capabilityGaps: string[];
  hasViableFallback: boolean;
  multiSkillCandidate: boolean;
  chainedWorkflow: boolean;
  workspaceKind: "project" | "temporary" | "unknown";
  capabilitySignals: string[];
  preferredValidationTools: string[];
  skillEnvironments: string[];
  repoFingerprint?: string;
  languageSignals?: string[];
  frameworkSignals?: string[];
  validationCommands?: string[];
  permissionSignals?: string[];
  branchConventions?: string[];
  failurePattern: "clean_success" | "near_miss" | "blocked_path" | "hard_failure";
  learnFromFailure: boolean;
  failureReasons: string[];
  nextImprovement?: string;
};

export type AgenticExecutionObservabilityReport = {
  summary: string;
  progressSummary: string;
  clarificationSummary?: string;
  retryClass: AgenticRetryClass;
  autonomyMode: AgenticAutonomyMode;
  riskLevel: AgenticRiskLevel;
  primarySkill?: string;
  suggestedSkill?: string;
  workflowSteps: AgenticWorkflowStep[];
  rankedSkills: string[];
  effectiveSkills: string[];
  effectiveFamilies: string[];
  promotedSkills: string[];
  stabilityState: AgenticOrchestrationState["stabilityState"];
  stabilitySkills: string[];
  consolidationAction: AgenticConsolidationAction;
  overlappingSkills: string[];
  mergeCandidate: boolean;
  mergeSkills: string[];
  capabilityGaps: string[];
  failurePattern: AgenticFailureLearningState["failurePattern"];
  hasViableFallback: boolean;
  escalationRequired: boolean;
  planSteps: AgenticPlanStep[];
  goalSatisfaction: AgenticGoalSatisfaction;
  unresolvedCriteria: string[];
  assumptions: string[];
  recommendations: string[];
};

export type AgenticHandoffReport = {
  summary: string;
  progressSummary: string;
  clarificationSummary?: string;
  objective?: string;
  completedSteps: string[];
  pendingSteps: string[];
  blockedSteps: string[];
  activeArtifacts: string[];
  blockers: string[];
  operatorMode: "continue" | "pause" | "approval_required" | "escalate";
  operatorReason?: string;
  nextAction?: string;
  suggestedSkill?: string;
  resumePrompt?: string;
  resumeCondition?: string;
  assumptions: string[];
};

export type AgenticAcceptanceScenarioId =
  | "memory_guided_fallback"
  | "verified_memory_preferred"
  | "missing_fallback_escalation"
  | "environment_prerequisite_guard"
  | "observability_escalation_alignment"
  | "fallback_guidance_alignment"
  | "plan_step_completion_alignment"
  | "plan_step_blocking_alignment"
  | "recovered_retry_reopens_verification"
  | "handoff_checkpoint_alignment"
  | "memory_guided_workflow_chain"
  | "workflow_chain_persists_to_memory"
  | "skill_consolidation_prefers_existing"
  | "consolidation_persists_to_memory"
  | "goal_satisfaction_downgrades_verified_checks"
  | "long_run_recovery_reaches_goal_satisfaction"
  | "weakening_skills_quality_gate"
  | "stable_reuse_observability_alignment"
  | "stable_reuse_promotion_alignment"
  | "promotion_guidance_memory_alignment"
  | "recovering_skills_guidance_alignment"
  | "template_guidance_observability_alignment"
  | "merge_guidance_observability_alignment"
  | "durable_template_family_quality_alignment"
  | "durable_merge_family_quality_alignment"
  | "durable_merge_family_fallback_alignment"
  | "durable_template_family_replan_alignment"
  | "failure_derived_merge_family_alignment"
  | "failure_derived_template_family_alignment"
  | "failure_derived_quality_gate_alignment"
  | "protected_branch_governance_alignment"
  | "environment_guard_retry_alignment"
  | "guarded_handoff_alignment"
  | "concise_progress_alignment"
  | "clarification_alignment"
  | "nonblocking_missing_information_alignment"
  | "clarification_payload_alignment"
  | "clarification_strategy_alignment";

export type AgenticAcceptanceScenarioResult = {
  id: AgenticAcceptanceScenarioId;
  passed: boolean;
  summary: string;
  details?: string;
};

export type AgenticAcceptanceReport = {
  passed: boolean;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarioIds: AgenticAcceptanceScenarioId[];
  scenarios: AgenticAcceptanceScenarioResult[];
  summary: string;
};

export type AgenticSoakScenarioId =
  | "retry_replan_recover_complete"
  | "handoff_resume_completion"
  | "effectiveness_drift_recovery"
  | "recovered_watch_stabilization"
  | "consolidation_mode_transition"
  | "failure_derived_consolidation_replan"
  | "failure_derived_recovery_transition"
  | "environment_guarded_retry_lifecycle"
  | "guarded_handoff_boundary"
  | "concise_progress_resume_boundary"
  | "clarification_resume_boundary"
  | "rich_clarification_resume_boundary";

export type AgenticSoakPhaseResult = {
  label: string;
  passed: boolean;
  outcome: AgenticVerificationOutcome;
  goalSatisfaction: AgenticGoalSatisfaction;
  retryClass: AgenticRetryClass;
  autonomyMode: AgenticAutonomyMode;
  primarySkill?: string;
  planStepSummary: string[];
  pendingHandoffSteps: number;
  details?: string;
};

export type AgenticSoakScenarioResult = {
  id: AgenticSoakScenarioId;
  passed: boolean;
  summary: string;
  phases: AgenticSoakPhaseResult[];
  details?: string;
};

export type AgenticSoakReport = {
  passed: boolean;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarioIds: AgenticSoakScenarioId[];
  scenarios: AgenticSoakScenarioResult[];
  summary: string;
};

export type AgenticQualityGateReport = {
  passed: boolean;
  acceptancePassed: boolean;
  soakPassed: boolean;
  diagnosticsPassed: boolean;
  effectivenessPassed: boolean;
  failReasons: string[];
  acceptance: AgenticAcceptanceReport;
  soak: AgenticSoakReport;
  diagnostics: AgenticExecutionObservabilityReport;
  weakeningSkills: string[];
  effectiveSkills: string[];
  recoveringSkills: string[];
  stabilizedSkills: string[];
  templateFamilies: string[];
  mergeFamilies: string[];
  effectivenessTrend?: "stable" | "watch" | "regressing";
  recommendations: string[];
  summary: string;
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
  weightedFamilies: Map<string, number>;
  recoveringSkills: string[];
  stabilizedSkills: string[];
  promotedSkills: string[];
  workflowChains: string[][];
  multiSkillHint: boolean;
};

type AgenticRegressionMemorySignal = {
  missingFallbackRegression: boolean;
  escalationRegression: boolean;
  qualityFailureReasons: string[];
  regressingSkillFamilies: string[];
  consolidationPreferredFamilies: string[];
  templatePreferredFamilies: string[];
  mergePreferredFamilies: string[];
  preferredFallbackSkills: string[];
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

function extractProceduralWorkflowChains(params: {
  memoryText?: string;
  availableSkills?: string[];
}): { chains: string[][]; multiSkillHint: boolean } {
  if (!params.memoryText || !params.availableSkills || params.availableSkills.length === 0) {
    return { chains: [], multiSkillHint: false };
  }
  const availableSkillSet = new Set(params.availableSkills.map((skill) => skill.toLowerCase()));
  const guidanceMatch = params.memoryText.match(/Procedural guidance:\s*((?:\n-\s+[^\n]+)+)/i);
  if (!guidanceMatch) {
    return { chains: [], multiSkillHint: false };
  }
  const guidanceLines = guidanceMatch[1]
    .split("\n")
    .map((line) => line.replace(/^\s*-\s+/, "").trim())
    .filter(Boolean);
  const chains: string[][] = [];
  let multiSkillHint = false;
  for (const line of guidanceLines) {
    const normalizedLine = line.toLowerCase();
    if (normalizedLine.includes("multi-skill orchestration candidate")) {
      multiSkillHint = true;
    }
    const chainMatches = [
      ...line.matchAll(/skill chain ([a-z0-9._-]+(?:\s*,\s*[a-z0-9._-]+)+)/gi),
      ...line.matchAll(/fallback chain ([a-z0-9._-]+(?:\s*(?:->|,)\s*[a-z0-9._-]+)+)/gi),
    ];
    for (const match of chainMatches) {
      const raw = match[1] ?? "";
      const steps = uniqueCompact(
        raw
          .split(/\s*(?:->|,)\s*/g)
          .map((item) => item.trim())
          .filter((item) => availableSkillSet.has(item.toLowerCase())),
        5,
      );
      if (steps.length > 1) {
        chains.push(steps);
      }
    }
  }
  return { chains, multiSkillHint };
}

function extractProceduralMemorySkillSignals(params: {
  memoryText?: string;
  availableSkills?: string[];
  taskMode?: AgenticTaskMode;
  preferredEnv?: string;
}): ProceduralMemorySkillSignal {
  const recommendedSkills = extractRecommendedProceduralSkills(params.memoryText);
  const workflowHints = extractProceduralWorkflowChains(params);
  const weightedSkills = new Map<string, number>();
  const weightedFamilies = new Map<string, number>();
  const availableSkills = params.availableSkills;
  for (const skill of recommendedSkills) {
    weightedSkills.set(skill, (weightedSkills.get(skill) ?? 0) + 2.5);
  }
  if (!params.memoryText || !availableSkills || availableSkills.length === 0) {
    return {
      recommendedSkills,
      weightedSkills,
      weightedFamilies,
      recoveringSkills: [],
      stabilizedSkills: [],
      promotedSkills: [],
      workflowChains: workflowHints.chains,
      multiSkillHint: workflowHints.multiSkillHint,
    };
  }
  const guidanceMatch = params.memoryText.match(/Procedural guidance:\s*((?:\n-\s+[^\n]+)+)/i);
  const guidanceLines = guidanceMatch
    ? guidanceMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean)
    : [];
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
    for (const skill of availableSkills) {
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
  const effectivenessMatch = params.memoryText.match(
    /Skill effectiveness guidance:\s*((?:\n-\s+[^\n]+)+)/i,
  );
  const effectivenessLines = effectivenessMatch
    ? effectivenessMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean)
    : [];
  for (const line of effectivenessLines) {
    const skill = line.match(/skill=([a-z0-9._-]+)/i)?.[1]?.trim();
    const family = line.match(/family=([a-z0-9._-]+)/i)?.[1]?.trim();
    const rawScore = Number(line.match(/score=(-?\d+(?:\.\d+)?)/i)?.[1] ?? Number.NaN);
    const scopedTaskMode = line.match(/task_mode=([a-z0-9._-]+)/i)?.[1]?.trim();
    const scopedEnv = line.match(/env=([a-z0-9._-]+)/i)?.[1]?.trim();
    let score = rawScore;
    if (Number.isFinite(score) && params.taskMode && scopedTaskMode) {
      score *= scopedTaskMode === params.taskMode ? 1 : score >= 0 ? -0.2 : 0.2;
    }
    if (Number.isFinite(score) && params.preferredEnv && scopedEnv) {
      score *= scopedEnv === params.preferredEnv ? 1.15 : score >= 0 ? -0.15 : 0.15;
    }
    if (skill && Number.isFinite(score) && availableSkills.includes(skill)) {
      weightedSkills.set(skill, (weightedSkills.get(skill) ?? 0) + score);
    }
    if (family && Number.isFinite(score)) {
      weightedFamilies.set(family, (weightedFamilies.get(family) ?? 0) + score);
    }
  }
  const recoveryMatch = params.memoryText.match(/Skill recovery guidance:\s*((?:\n-\s+[^\n]+)+)/i);
  const recoveryLines = recoveryMatch
    ? recoveryMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean)
    : [];
  const recoveringSkills = uniqueCompact(
    recoveryLines.flatMap((line) => {
      const skill = line.match(/skill=([a-z0-9._-]+)/i)?.[1]?.trim();
      return skill && availableSkills.includes(skill) ? [skill] : [];
    }),
    6,
  );
  for (const line of recoveryLines) {
    const skill = line.match(/skill=([a-z0-9._-]+)/i)?.[1]?.trim();
    const scopedTaskMode = line.match(/task_mode=([a-z0-9._-]+)/i)?.[1]?.trim();
    const scopedEnv = line.match(/env=([a-z0-9._-]+)/i)?.[1]?.trim();
    if (!skill || !availableSkills.includes(skill)) {
      continue;
    }
    let score = -0.35;
    if (params.taskMode && scopedTaskMode && scopedTaskMode === params.taskMode) {
      score += 0.15;
    }
    if (params.preferredEnv && scopedEnv && scopedEnv === params.preferredEnv) {
      score += 0.1;
    }
    weightedSkills.set(skill, (weightedSkills.get(skill) ?? 0) + score);
  }
  const stabilityMatch = params.memoryText.match(
    /Skill stability guidance:\s*((?:\n-\s+[^\n]+)+)/i,
  );
  const stabilityLines = stabilityMatch
    ? stabilityMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean)
    : [];
  const stabilizedSkills = uniqueCompact(
    stabilityLines.flatMap((line) => {
      const skill = line.match(/skill=([a-z0-9._-]+)/i)?.[1]?.trim();
      return skill && availableSkills.includes(skill) ? [skill] : [];
    }),
    6,
  );
  for (const line of stabilityLines) {
    const skill = line.match(/skill=([a-z0-9._-]+)/i)?.[1]?.trim();
    const scopedTaskMode = line.match(/task_mode=([a-z0-9._-]+)/i)?.[1]?.trim();
    const scopedEnv = line.match(/env=([a-z0-9._-]+)/i)?.[1]?.trim();
    if (!skill || !availableSkills.includes(skill)) {
      continue;
    }
    let score = 0.45;
    if (params.taskMode && scopedTaskMode && scopedTaskMode === params.taskMode) {
      score += 0.15;
    }
    if (params.preferredEnv && scopedEnv && scopedEnv === params.preferredEnv) {
      score += 0.1;
    }
    weightedSkills.set(skill, (weightedSkills.get(skill) ?? 0) + score);
  }
  const promotionMatch = params.memoryText.match(
    /Skill promotion guidance:\s*((?:\n-\s+[^\n]+)+)/i,
  );
  const promotionLines = promotionMatch
    ? promotionMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean)
    : [];
  const promotedSkills = uniqueCompact(
    promotionLines.flatMap((line) => {
      const skill = line.match(/skill=([a-z0-9._-]+)/i)?.[1]?.trim();
      return skill && availableSkills.includes(skill) ? [skill] : [];
    }),
    6,
  );
  for (const line of promotionLines) {
    const skill = line.match(/skill=([a-z0-9._-]+)/i)?.[1]?.trim();
    const scopedTaskMode = line.match(/task_mode=([a-z0-9._-]+)/i)?.[1]?.trim();
    const scopedEnv = line.match(/env=([a-z0-9._-]+)/i)?.[1]?.trim();
    if (!skill || !availableSkills.includes(skill)) {
      continue;
    }
    let score = 0.6;
    if (params.taskMode && scopedTaskMode && scopedTaskMode === params.taskMode) {
      score += 0.2;
    }
    if (params.preferredEnv && scopedEnv && scopedEnv === params.preferredEnv) {
      score += 0.1;
    }
    weightedSkills.set(skill, (weightedSkills.get(skill) ?? 0) + score);
  }
  return {
    recommendedSkills,
    weightedSkills,
    weightedFamilies,
    recoveringSkills,
    stabilizedSkills,
    promotedSkills,
    workflowChains: workflowHints.chains,
    multiSkillHint: workflowHints.multiSkillHint,
  };
}

function extractAgenticRegressionMemorySignals(memoryText?: string): AgenticRegressionMemorySignal {
  if (!memoryText) {
    return {
      missingFallbackRegression: false,
      escalationRegression: false,
      qualityFailureReasons: [],
      regressingSkillFamilies: [],
      consolidationPreferredFamilies: [],
      templatePreferredFamilies: [],
      mergePreferredFamilies: [],
      preferredFallbackSkills: [],
    };
  }
  const match = memoryText.match(/Agentic regression guidance:\s*((?:\n-\s+[^\n]+)+)/i);
  const lines = match
    ? match[1]
        .split("\n")
        .map((line) => line.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean)
    : [];
  const qualityFailureReasons = uniqueCompact(
    lines.flatMap((line) => {
      const reasonsMatch = line.match(/reasons=([a-z0-9_,.-]+)/i);
      if (!reasonsMatch) {
        return [];
      }
      return reasonsMatch[1]
        .split(",")
        .map((reason) => reason.trim())
        .filter(Boolean);
    }),
    6,
  );
  const familyMatch = memoryText.match(/Skill family guidance:\s*((?:\n-\s+[^\n]+)+)/i);
  const familyLines = familyMatch
    ? familyMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean)
    : [];
  const regressingSkillFamilies = uniqueCompact(
    familyLines.flatMap((line) => {
      const family = line.match(/family=([a-z0-9_.-]+)/i)?.[1]?.trim();
      const trend = line.match(/trend=([a-z0-9_.-]+)/i)?.[1]?.trim();
      return family && (trend === "regressing" || trend === "watch") ? [family] : [];
    }),
    6,
  );
  const consolidationPreferredFamilies = uniqueCompact(
    familyLines.flatMap((line) => {
      const family = line.match(/family=([a-z0-9_.-]+)/i)?.[1]?.trim();
      const consolidation = line.match(/consolidation=([a-z0-9_.-]+)/i)?.[1]?.trim();
      return family && consolidation && consolidation !== "none" ? [family] : [];
    }),
    6,
  );
  const templatePreferredFamilies = uniqueCompact(
    familyLines.flatMap((line) => {
      const family = line.match(/family=([a-z0-9_.-]+)/i)?.[1]?.trim();
      const templateCandidate = line.match(/template_candidate=(true|false)/i)?.[1]?.trim();
      return family && templateCandidate === "true" ? [family] : [];
    }),
    6,
  );
  const mergePreferredFamilies = uniqueCompact(
    familyLines.flatMap((line) => {
      const family = line.match(/family=([a-z0-9_.-]+)/i)?.[1]?.trim();
      const mergeCandidate = line.match(/merge_candidate=(true|false)/i)?.[1]?.trim();
      return family && mergeCandidate === "true" ? [family] : [];
    }),
    6,
  );
  const preferredFallbackSkills = uniqueCompact(
    familyLines.flatMap((line) => {
      const fallback = line.match(/preferred_fallback=([a-z0-9_.-]+)/i)?.[1]?.trim();
      return fallback ? [fallback] : [];
    }),
    6,
  );
  const normalized = lines.join("\n").toLowerCase();
  return {
    missingFallbackRegression:
      normalized.includes("missing viable fallback") ||
      normalized.includes("diagnostics_missing_fallback") ||
      normalized.includes("no_viable_fallback"),
    escalationRegression:
      normalized.includes("escalation") || normalized.includes("trend=regressing"),
    qualityFailureReasons,
    regressingSkillFamilies,
    consolidationPreferredFamilies,
    templatePreferredFamilies,
    mergePreferredFamilies,
    preferredFallbackSkills,
  };
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

function tokenizeCriterion(text: string): string[] {
  const stopwords = new Set([
    "with",
    "from",
    "this",
    "that",
    "then",
    "than",
    "into",
    "onto",
    "about",
    "after",
    "before",
    "during",
    "while",
    "where",
    "when",
    "keep",
    "make",
    "have",
    "your",
    "their",
    "work",
    "final",
    "report",
    "prepare",
    "continue",
  ]);
  return uniqueCompact(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !stopwords.has(token)),
    10,
  );
}

function criterionIsSatisfied(criterion: string, corpus: string): boolean {
  const tokens = tokenizeCriterion(criterion);
  if (tokens.length === 0) {
    return false;
  }
  const matches = tokens.filter((token) => corpus.includes(token)).length;
  return matches >= Math.max(1, Math.min(2, Math.ceil(tokens.length / 2)));
}

function buildPlanSteps(params: {
  objective?: string;
  subtasks: string[];
  successCriteria: string[];
  activeArtifacts: string[];
  blockers: string[];
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
  checkpointSignals?: CheckpointSignal[];
  retrySignals?: RetrySignal[];
}): AgenticPlanStep[] {
  const checkpointSignals = params.checkpointSignals ?? [];
  const retrySignals = params.retrySignals ?? [];
  const retryRecovered = retrySignals.some((signal) => signal.outcome === "recovered");
  const implementationSeeds = uniqueCompact(
    [
      ...params.subtasks.map((item) => truncate(item, 100)),
      params.activeArtifacts[0]
        ? `Update ${truncate(params.activeArtifacts[0], 80)}`
        : params.objective
          ? truncate(params.objective, 100)
          : undefined,
    ],
    2,
  );
  const implementationSteps: AgenticPlanStep[] = implementationSeeds.map((title, index) => {
    let status: AgenticPlanStepStatus = index === 0 ? "in_progress" : "pending";
    if (params.plannerState.status === "complete") {
      status = "completed";
    } else if (
      index === 0 &&
      params.blockers.length > 0 &&
      params.verificationState.outcome !== "verified"
    ) {
      status = params.activeArtifacts.length > 0 ? "completed" : "blocked";
    } else if (
      index === 0 &&
      (params.verificationState.outcome === "failed" ||
        params.verificationState.outcome === "blocked") &&
      params.activeArtifacts.length > 0
    ) {
      status = "completed";
    } else if (index > 0) {
      status = "pending";
    }
    return { title, status, kind: "implementation" };
  });

  const verificationTitle =
    params.successCriteria[0] !== undefined
      ? `Verify: ${truncate(params.successCriteria[0], 90)}`
      : "Verify the latest change with available checks.";
  let verificationStatus: AgenticPlanStepStatus = "pending";
  if (
    params.plannerState.status === "complete" ||
    params.verificationState.outcome === "verified"
  ) {
    verificationStatus = "completed";
  } else if (
    params.verificationState.outcome === "failed" ||
    params.verificationState.outcome === "blocked"
  ) {
    verificationStatus = "blocked";
  } else if (
    params.verificationState.checksRun.length > 0 ||
    params.verificationState.outcome === "partial"
  ) {
    verificationStatus = "in_progress";
  } else if (retryRecovered) {
    verificationStatus = "in_progress";
  }

  const handoffObserved = checkpointSignals.some((signal) => signal.kind === "handoff");
  let handoffStatus: AgenticPlanStepStatus = "pending";
  if (handoffObserved) {
    handoffStatus = "completed";
  } else if (params.plannerState.status === "complete") {
    handoffStatus = "in_progress";
  }

  return uniquePlanSteps(
    [
      ...implementationSteps,
      {
        title: verificationTitle,
        status: verificationStatus,
        kind: "verification",
      },
      {
        title: "Prepare final handoff or concise completion summary.",
        status: handoffStatus,
        kind: "handoff",
      },
    ],
    5,
  );
}

function uniquePlanSteps(steps: AgenticPlanStep[], limit = 5): AgenticPlanStep[] {
  const seen = new Set<string>();
  const result: AgenticPlanStep[] = [];
  for (const step of steps) {
    const normalized = step.title.replace(/\s+/g, " ").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(step);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
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
    } else if (
      /\bmissing|not found|unknown file|no such file|required|needs|awaiting\b/.test(text)
    ) {
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
  objective?: string;
  successCriteria?: string[];
}): AgenticVerificationState {
  const toolSignals = params.toolSignals ?? [];
  const checkpointSignals = params.checkpointSignals ?? [];
  const checksRun = uniqueCompact(
    toolSignals
      .filter((signal) =>
        /\b(test|typecheck|lint|build|compile|verify|check|validation)\b/i.test(
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
  const goalCriteria = uniqueCompact([...(params.successCriteria ?? []), params.objective], 5);
  const goalCorpus = [
    ...toolSignals.map((signal) => `${signal.toolName} ${signal.summary}`.toLowerCase()),
    ...checkpointSignals.map((signal) => `${signal.kind} ${signal.summary}`.toLowerCase()),
  ].join("\n");
  const goalSignals = uniqueCompact(
    checkpointSignals
      .filter((signal) => signal.kind === "completion" || signal.kind === "handoff")
      .map((signal) => `${signal.kind}: ${truncate(signal.summary, 96)}`),
    6,
  );
  const unresolvedCriteria = goalCriteria.filter(
    (criterion) => !criterionIsSatisfied(criterion, goalCorpus),
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
  const goalSatisfaction: AgenticGoalSatisfaction =
    goalCriteria.length === 0
      ? "uncertain"
      : unresolvedCriteria.length === 0
        ? "satisfied"
        : outcome === "verified" || outcome === "partial"
          ? "uncertain"
          : "unsatisfied";
  if (outcome === "verified" && goalSatisfaction !== "satisfied") {
    outcome = "partial";
  }

  return {
    version: 1,
    outcome,
    goalSatisfaction,
    evidence,
    goalSignals,
    checksRun,
    failingChecks,
    unresolvedCriteria,
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
  memoryRegressionSignals?: AgenticRegressionMemorySignal;
}): AgenticPlannerState {
  const checkpointSignals = params.checkpointSignals ?? [];
  const retrySignals = params.retrySignals ?? [];
  const likelySkills = params.likelySkills ?? [];
  const memoryRegressionSignals = params.memoryRegressionSignals ?? {
    missingFallbackRegression: false,
    escalationRegression: false,
    qualityFailureReasons: [],
    regressingSkillFamilies: [],
    consolidationPreferredFamilies: [],
    templatePreferredFamilies: [],
    mergePreferredFamilies: [],
    preferredFallbackSkills: [],
  };
  const rawAlternativeSkills = (params.availableSkills ?? []).filter(
    (skill) => !likelySkills.includes(skill),
  );
  const likelyPrimarySkill = likelySkills[0];
  const likelyPrimaryFamily = likelyPrimarySkill ? inferSkillFamily(likelyPrimarySkill) : undefined;
  const mergeFamilyFallbackSkills =
    likelyPrimaryFamily &&
    memoryRegressionSignals.mergePreferredFamilies.includes(likelyPrimaryFamily)
      ? rawAlternativeSkills.filter((skill) => inferSkillFamily(skill) === likelyPrimaryFamily)
      : [];
  const alternativeSkills = uniqueCompact(
    [
      ...mergeFamilyFallbackSkills,
      ...rawAlternativeSkills.filter((skill) => !mergeFamilyFallbackSkills.includes(skill)),
    ],
    6,
  );
  const retryFailures = retrySignals.filter((signal) => signal.outcome === "failed");
  const latestRetrySignal = retrySignals.at(-1);
  const remainingRetryBudget =
    typeof latestRetrySignal?.maxAttempts === "number" &&
    typeof latestRetrySignal.attempt === "number"
      ? Math.max(0, latestRetrySignal.maxAttempts - latestRetrySignal.attempt)
      : undefined;

  const dominantFailureClass = params.verificationState.failureClasses[0];
  const blockingMissingInformation =
    dominantFailureClass === "missing_information" &&
    params.verificationState.outcome === "blocked";
  const clarificationReason = getPrimaryClarificationReason(params.blockers);
  const templateFamilyActive =
    Boolean(likelyPrimaryFamily) &&
    memoryRegressionSignals.templatePreferredFamilies.includes(likelyPrimaryFamily ?? "");
  const suggestedSkill = mergeFamilyFallbackSkills[0] ?? alternativeSkills[0];
  const shouldEscalate =
    retryFailures.length > 0 || dominantFailureClass === "environment_mismatch";
  const escalationReason: AgenticEscalationReason | undefined =
    retryFailures.length > 0
      ? "repeated_failure"
      : dominantFailureClass === "environment_mismatch"
        ? "environment_mismatch"
        : params.verificationState.outcome === "blocked" &&
            dominantFailureClass !== "missing_information"
          ? "low_confidence"
          : undefined;
  const retryClass: AgenticRetryClass = shouldEscalate
    ? "escalate"
    : blockingMissingInformation
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
    const mergeFallbackHint =
      mergeFamilyFallbackSkills.length > 0
        ? ` Prefer the sibling fallback ${mergeFamilyFallbackSkills[0]} inside the durable merge-ready ${likelyPrimaryFamily} family.`
        : "";
    const templateGuidanceHint =
      templateFamilyActive && likelyPrimarySkill
        ? ` Reuse and parameterize the stable ${likelyPrimaryFamily} workflow around ${likelyPrimarySkill} instead of creating a new fork.`
        : "";
    const rationaleSuffix =
      mergeFamilyFallbackSkills.length > 0
        ? "merge-family-guidance"
        : templateFamilyActive
          ? "template-family-guidance"
          : undefined;
    return {
      version: 1,
      status: retryFailures.length > 0 ? "blocked" : "needs_replan",
      nextAction: shouldEscalate
        ? `Escalate or unblock the current failure before continuing.${fallbackHint}`.trim()
        : blockingMissingInformation
          ? clarificationReason === "missing_information:environment_variable"
            ? "Configure the missing environment variable before retrying."
            : clarificationReason === "missing_information:approval"
              ? "Obtain the required approval before retrying."
              : clarificationReason === "missing_information:external_input"
                ? "Request the missing external input before retrying."
                : "Clarify the missing input or fetch the missing prerequisite before retrying."
          : mergeFamilyFallbackSkills.length > 0
            ? `Switch to a fallback workflow using ${suggestedSkill} before retrying.${mergeFallbackHint}${fallbackHint}`.trim()
            : templateFamilyActive
              ? `Do not spawn a new fork for this blocker.${templateGuidanceHint}${fallbackHint}`.trim()
              : suggestedSkill
                ? `Switch to a fallback workflow using ${suggestedSkill} before retrying.${fallbackHint}`.trim()
                : dominantFailureClass === "verification_failure"
                  ? `Do not repeat the same failing validation path; change the implementation strategy before retrying.${fallbackHint}`.trim()
                  : `Replan around the current blocker and try a different execution path.${fallbackHint}`.trim(),
      rationale: dominantFailureClass
        ? `${dominantFailureClass}: ${params.blockers[0]}${rationaleSuffix ? `; ${rationaleSuffix}` : ""}`
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
  taskState: AgenticTaskState;
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
  environmentState: AgenticEnvironmentState;
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
  const protectedBranch =
    params.environmentState.branchConventions?.some((entry) =>
      ["default_branch", "release_branch", "hotfix_branch"].includes(entry),
    ) ?? false;
  const mutatingWorkDetected =
    params.taskState.activeArtifacts.length > 0 ||
    /\b(fix|update|modify|edit|change|implement|repair|rewrite|refactor|patch|migrate|deploy|release)\b/.test(
      lowered,
    );
  const needsValidationContext =
    params.taskState.taskMode === "coding" ||
    params.taskState.taskMode === "debugging" ||
    params.taskState.taskMode === "operations";
  const missingValidationContext =
    needsValidationContext &&
    params.environmentState.workspaceKind === "project" &&
    (params.environmentState.preferredValidationTools?.length ?? 0) === 0;
  const protectedBranchApprovalGate =
    protectedBranch &&
    mutatingWorkDetected &&
    params.verificationState.outcome !== "verified" &&
    !params.plannerState.shouldEscalate;
  const reasons = uniqueCompact(
    [
      secretPromptDetected ? "secret_exfiltration_request" : undefined,
      destructiveActionDetected ? "destructive_action_detected" : undefined,
      protectedBranchApprovalGate ? "protected_branch_change_guard" : undefined,
      missingValidationContext ? "missing_validation_context" : undefined,
      params.plannerState.shouldEscalate
        ? `planner:${params.plannerState.escalationReason ?? "unknown"}`
        : undefined,
      params.verificationState.outcome === "blocked" ? "blocked_execution" : undefined,
    ],
    5,
  );
  const approvalRequired = destructiveActionDetected || protectedBranchApprovalGate;
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
    params.plannerState.escalationReason === "environment_mismatch" ||
    protectedBranchApprovalGate
      ? "high"
      : missingValidationContext
        ? "medium"
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

function inferSkillFamily(skill: string): string {
  const normalized = skill.toLowerCase();
  if (normalized.includes("diagnostic")) {
    return "diagnostics";
  }
  if (
    normalized.includes("acceptance") ||
    normalized.includes("validation") ||
    normalized.includes("report")
  ) {
    return "verification";
  }
  if (normalized.includes("release") || normalized.includes("deploy")) {
    return "release";
  }
  if (normalized.includes("migration")) {
    return "migration";
  }
  const parts = normalized.split(/[^a-z0-9]+/).filter((part) => part.length >= 4);
  return parts[0] ?? normalized;
}

function detectOverlappingSkills(skills: string[]): {
  families: string[];
  overlappingSkills: string[];
} {
  const familyMap = new Map<string, string[]>();
  for (const skill of skills) {
    const family = inferSkillFamily(skill);
    const bucket = familyMap.get(family) ?? [];
    bucket.push(skill);
    familyMap.set(family, bucket);
  }
  const families = [...familyMap.entries()]
    .filter(([, bucket]) => bucket.length > 1)
    .map(([family]) => family);
  const overlappingSkills = uniqueCompact(
    families.flatMap((family) => familyMap.get(family) ?? []),
    8,
  );
  return { families, overlappingSkills };
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
  memoryWeightedFamilies?: Map<string, number>;
  memoryRecoveringSkills?: string[];
  memoryStabilizedSkills?: string[];
  memoryPromotedSkills?: string[];
  memoryWorkflowChains?: string[][];
  memoryMultiSkillHint?: boolean;
  memoryRegressionSignals?: AgenticRegressionMemorySignal;
  alternativeSkills?: string[];
  toolSignals?: ToolSignal[];
  plannerState?: AgenticPlannerState;
}): AgenticOrchestrationState {
  const availableSkills = params.availableSkills ?? [];
  const likelySkills = uniqueCompact(params.likelySkills ?? [], 6);
  const memoryRecommendedSkills = uniqueCompact(params.memoryRecommendedSkills ?? [], 6);
  const memoryWeightedSkills = params.memoryWeightedSkills ?? new Map<string, number>();
  const memoryWeightedFamilies = params.memoryWeightedFamilies ?? new Map<string, number>();
  const memoryRecoveringSkills = new Set(params.memoryRecoveringSkills ?? []);
  const memoryStabilizedSkills = new Set(params.memoryStabilizedSkills ?? []);
  const memoryPromotedSkills = new Set(params.memoryPromotedSkills ?? []);
  const memoryWorkflowChains = params.memoryWorkflowChains ?? [];
  const memoryMultiSkillHint = params.memoryMultiSkillHint === true;
  const memoryRegressionSignals: AgenticRegressionMemorySignal = params.memoryRegressionSignals ?? {
    missingFallbackRegression: false,
    escalationRegression: false,
    qualityFailureReasons: [],
    regressingSkillFamilies: [],
    consolidationPreferredFamilies: [],
    templatePreferredFamilies: [],
    mergePreferredFamilies: [],
    preferredFallbackSkills: [],
  };
  const alternativeSkills = uniqueCompact(params.alternativeSkills ?? [], 6);
  const currentLikelySkill = likelySkills[0];
  const currentLikelyFamily = currentLikelySkill ? inferSkillFamily(currentLikelySkill) : undefined;
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
      const skillFamily = inferSkillFamily(skill.name);
      if (memoryWeightedFamilies.has(skillFamily)) {
        score += memoryWeightedFamilies.get(skillFamily) ?? 0;
        reasons.push(`family-quality:${skillFamily}`);
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
      if (
        memoryRegressionSignals.missingFallbackRegression &&
        (params.plannerState?.status === "needs_replan" ||
          params.plannerState?.status === "blocked")
      ) {
        if (skill.name === likelySkills[0]) {
          score -= 1.5;
          reasons.push("memory-regression-guard");
        }
        if (alternativeSkills.includes(skill.name)) {
          score += 1.25;
          reasons.push("memory-regression-escape");
        }
      }
      if (
        memoryRegressionSignals.regressingSkillFamilies.includes(skillFamily) &&
        (params.plannerState?.status === "needs_replan" ||
          params.plannerState?.status === "blocked")
      ) {
        score -= 1.25;
        reasons.push("family-regression-guard");
      }
      if (memoryRegressionSignals.preferredFallbackSkills.includes(skill.name)) {
        score += 1.75;
        reasons.push("family-guided-fallback");
      }
      if (
        currentLikelyFamily &&
        (params.plannerState?.status === "needs_replan" ||
          params.plannerState?.status === "blocked")
      ) {
        if (
          memoryRegressionSignals.mergePreferredFamilies.includes(currentLikelyFamily) &&
          skillFamily === currentLikelyFamily
        ) {
          if (skill.name === currentLikelySkill) {
            score -= 1.5;
            reasons.push("merge-family-move");
          } else {
            score += 2.25;
            reasons.push("merge-family-sibling");
          }
        }
        if (
          memoryRegressionSignals.templatePreferredFamilies.includes(currentLikelyFamily) &&
          skillFamily === currentLikelyFamily
        ) {
          if (skill.name === currentLikelySkill) {
            score += 1.75;
            reasons.push("template-family-anchor");
          } else {
            score += 1;
            reasons.push("template-family-sibling");
          }
        } else if (
          memoryRegressionSignals.templatePreferredFamilies.includes(currentLikelyFamily) &&
          skillFamily !== currentLikelyFamily
        ) {
          score -= 0.5;
          reasons.push("template-family-avoid-fork");
        }
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
  const hasViableFallback =
    fallbackSkills.length > 0 &&
    (params.plannerState?.retryClass !== "skill_fallback" ||
      rankedSkills[0] !== likelySkills[0] ||
      fallbackSkills.some((skill) => alternativeSkills.includes(skill)));
  const verificationLikeSkill = rankedSkills.find(
    (skill) =>
      ![primarySkill, ...fallbackSkills].includes(skill) &&
      /\b(report|check|validation|test|acceptance|release)\b/i.test(skill),
  );
  const selectedMemoryChain =
    memoryWorkflowChains
      .filter((chain) => chain.every((skill) => rankedSkills.includes(skill)))
      .toSorted((a, b) => b.length - a.length)[0] ?? [];
  const baseWorkflowChain = uniqueCompact(
    [
      ...selectedMemoryChain,
      primarySkill,
      memoryMultiSkillHint ? fallbackSkills[0] : undefined,
      verificationLikeSkill,
    ].filter((value): value is string => Boolean(value)),
    4,
  );
  const chainedWorkflow = baseWorkflowChain.length > 1;
  const workflowSteps: AgenticWorkflowStep[] = [
    ...baseWorkflowChain.map((skill, index, chain): AgenticWorkflowStep => {
      const role: AgenticWorkflowStep["role"] =
        index === 0
          ? "primary"
          : index === chain.length - 1 &&
              /\b(report|check|validation|test|acceptance|release)\b/i.test(skill)
            ? "verification"
            : "supporting";
      return { skill, role };
    }),
    ...fallbackSkills
      .filter((skill) => !baseWorkflowChain.includes(skill))
      .slice(0, 2)
      .map((skill) => ({ skill, role: "fallback" as const })),
  ];
  const skillChain = uniqueCompact(
    workflowSteps.map((step) => step.skill),
    5,
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
      likelySkills.length > 0 &&
      (params.plannerState?.status === "needs_replan" ||
        params.plannerState?.status === "blocked" ||
        params.plannerState?.retryClass === "skill_fallback") &&
      !hasViableFallback
        ? "no_viable_fallback"
        : undefined,
    ],
    5,
  );
  const overlapSignals = detectOverlappingSkills(rankedSkills);
  const effectiveSkills = rankedSkills.filter(
    (skill) => (memoryWeightedSkills.get(skill) ?? 0) >= 1.5,
  );
  const effectiveFamilies = uniqueCompact(
    [...memoryWeightedFamilies.entries()]
      .filter(([, score]) => score >= 1)
      .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([family]) => family),
    6,
  );
  const multiSkillCandidate =
    (chainedWorkflow || memoryMultiSkillHint || rankedSkills.length > 1) &&
    (params.plannerState?.retryClass === "skill_fallback" ||
      prerequisiteWarnings.length > 0 ||
      params.taskMode === "planning" ||
      params.taskMode === "operations" ||
      params.taskMode === "coding" ||
      params.taskMode === "debugging");
  const overlapFamilies = overlapSignals.families.filter((family) =>
    memoryRegressionSignals.consolidationPreferredFamilies.includes(family),
  );
  const promotedSkills = uniqueCompact(
    availableSkills.map((skill) => skill.name).filter((skill) => memoryPromotedSkills.has(skill)),
    6,
  );
  const primarySkillFamily = primarySkill ? inferSkillFamily(primarySkill) : undefined;
  const familyGuidedMerge =
    primarySkillFamily &&
    memoryRegressionSignals.mergePreferredFamilies.includes(primarySkillFamily) &&
    overlapSignals.overlappingSkills.length >= 2
      ? primarySkillFamily
      : undefined;
  const familyGuidedGeneralization =
    primarySkillFamily &&
    !familyGuidedMerge &&
    (memoryRegressionSignals.templatePreferredFamilies.includes(primarySkillFamily) ||
      (memoryRegressionSignals.consolidationPreferredFamilies.includes(primarySkillFamily) &&
        (effectiveFamilies.includes(primarySkillFamily) ||
          promotedSkills.includes(primarySkill ?? "") ||
          memoryStabilizedSkills.has(primarySkill ?? ""))))
      ? primarySkillFamily
      : undefined;
  const mergeSkills = familyGuidedMerge
    ? uniqueCompact(
        overlapSignals.overlappingSkills.filter(
          (skill) => inferSkillFamily(skill) === familyGuidedMerge,
        ),
        6,
      )
    : [];
  const stabilitySkills = uniqueCompact(
    [
      ...availableSkills
        .map((skill) => skill.name)
        .filter((skill) => memoryStabilizedSkills.has(skill)),
      ...availableSkills
        .map((skill) => skill.name)
        .filter((skill) => memoryRecoveringSkills.has(skill)),
    ],
    6,
  );
  const recoveringPrimaryFamily =
    primarySkill && memoryRecoveringSkills.has(primarySkill)
      ? inferSkillFamily(primarySkill)
      : undefined;
  const stabilityState: AgenticOrchestrationState["stabilityState"] =
    primarySkill && memoryRecoveringSkills.has(primarySkill)
      ? "recovered_watch"
      : primarySkill && memoryStabilizedSkills.has(primarySkill)
        ? "stable_reuse"
        : "neutral";
  const strongPrimaryFamily =
    primarySkill &&
    effectiveFamilies.includes(inferSkillFamily(primarySkill)) &&
    (memoryStabilizedSkills.has(primarySkill) || !memoryRecoveringSkills.has(primarySkill))
      ? inferSkillFamily(primarySkill)
      : undefined;
  const consolidationAction: AgenticConsolidationAction =
    overlapSignals.overlappingSkills.length >= 3 ||
    overlapFamilies.length > 0 ||
    Boolean(familyGuidedGeneralization)
      ? "generalize_existing"
      : primarySkill && promotedSkills.includes(primarySkill) && !recoveringPrimaryFamily
        ? "extend_existing"
        : (overlapSignals.overlappingSkills.length >= 2 || multiSkillCandidate) &&
            !recoveringPrimaryFamily
          ? "extend_existing"
          : strongPrimaryFamily
            ? "extend_existing"
            : availableSkills.length === 0
              ? "create_new"
              : "none";
  const rationale = primarySkill
    ? `Prefer ${primarySkill}${chainedWorkflow ? ` with workflow chain ${skillChain.join(" -> ")}` : ""}${fallbackSkills.length > 0 ? `, then fall back to ${fallbackSkills.slice(0, 2).join(", ")}` : ""}${preferredEnv ? ` for ${preferredEnv} work` : ""}${prerequisiteWarnings.length > 0 ? ` while watching ${prerequisiteWarnings[0]}` : ""}${memoryRecoveringSkills.has(primarySkill) ? " while keeping the recovered path under watch" : ""}${promotedSkills.includes(primarySkill) ? " with promotion-ready reuse guidance" : ""}${familyGuidedMerge ? ` while merging overlapping ${familyGuidedMerge} siblings ${mergeSkills.join(", ")}` : ""}${familyGuidedGeneralization ? ` with template-ready ${familyGuidedGeneralization} family guidance` : ""}${overlapFamilies.length > 0 && !familyGuidedMerge ? ` while consolidating within ${overlapFamilies.join(", ")}` : ""}.`
    : availableSkills.length > 0
      ? "Available skills exist, but none match the current objective strongly."
      : "No matching skills are currently available for this objective.";
  const orchestrationFamilies = uniqueCompact(
    [
      ...overlapSignals.families,
      ...(familyGuidedGeneralization ? [familyGuidedGeneralization] : []),
    ],
    6,
  );
  return {
    version: 1,
    primarySkill,
    fallbackSkills,
    skillChain,
    workflowSteps,
    rankedSkills,
    effectiveSkills,
    effectiveFamilies,
    promotedSkills,
    prerequisiteWarnings,
    capabilityGaps,
    hasViableFallback,
    multiSkillCandidate,
    chainedWorkflow,
    skillFamilies: orchestrationFamilies,
    overlappingSkills: overlapSignals.overlappingSkills,
    mergeCandidate: Boolean(familyGuidedMerge),
    mergeSkills,
    stabilityState,
    stabilitySkills,
    consolidationAction,
    rationale,
  };
}

function buildEnvironmentState(params: {
  workspaceTags?: string[];
  workspaceState?: WorkspaceState;
  toolSignals?: ToolSignal[];
  availableSkills?: SkillInfo[];
  objective?: string;
  activeArtifacts?: string[];
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
  const languageSignals = inferEnvironmentLanguages({
    objective: params.objective,
    activeArtifacts: params.activeArtifacts,
    toolSignals: params.toolSignals,
    skillEnvironments,
  });
  const frameworkSignals = inferEnvironmentFrameworks({
    objective: params.objective,
    activeArtifacts: params.activeArtifacts,
    toolSignals: params.toolSignals,
    workspaceTags: params.workspaceTags,
  });
  const validationCommands = inferValidationCommands({
    toolSignals: params.toolSignals,
    languages: languageSignals,
    frameworks: frameworkSignals,
  });
  const permissionSignals = uniqueCompact(
    [
      toolNames.has("exec") ? "command_execution" : undefined,
      toolNames.has("read") ? "file_read" : undefined,
      toolNames.has("write") ? "file_write" : undefined,
      (params.workspaceTags ?? []).includes("git-worktree") ? "git_metadata" : undefined,
      params.workspaceState?.transcriptExists ? "transcript_access" : undefined,
      workspaceKind === "temporary" ? "temporary_workspace" : undefined,
      workspaceKind === "project" ? "project_workspace" : undefined,
    ],
    8,
  );
  const branchConventions = inferBranchConventions(params.workspaceState?.gitBranch);
  const repoFingerprint = buildRepoFingerprint({
    workspaceKind,
    workspaceState: params.workspaceState,
    languages: languageSignals,
    frameworks: frameworkSignals,
    validationCommands,
  });
  return {
    version: 1,
    workspaceKind,
    gitBranch: params.workspaceState?.gitBranch,
    gitCommit: params.workspaceState?.gitCommit,
    repoFingerprint,
    capabilitySignals,
    preferredValidationTools,
    skillEnvironments,
    languageSignals,
    frameworkSignals,
    validationCommands,
    permissionSignals,
    branchConventions,
  };
}

function inferEnvironmentLanguages(params: {
  objective?: string;
  activeArtifacts?: string[];
  toolSignals?: ToolSignal[];
  skillEnvironments?: string[];
}): string[] {
  const corpus = [
    params.objective ?? "",
    ...(params.activeArtifacts ?? []),
    ...(params.toolSignals?.map((signal) => signal.summary) ?? []),
  ]
    .join("\n")
    .toLowerCase();
  const artifacts = (params.activeArtifacts ?? []).map((artifact) => artifact.toLowerCase());
  return uniqueCompact(
    [
      artifacts.some((artifact) => /\.(ts|tsx)$/.test(artifact)) || /\btypescript\b/.test(corpus)
        ? "typescript"
        : undefined,
      artifacts.some((artifact) => /\.(js|jsx|mjs|cjs)$/.test(artifact)) ||
      /\bjavascript\b/.test(corpus)
        ? "javascript"
        : undefined,
      artifacts.some((artifact) => artifact.endsWith(".py")) || /\bpython\b/.test(corpus)
        ? "python"
        : undefined,
      artifacts.some((artifact) => artifact.endsWith(".rs")) || /\brust\b/.test(corpus)
        ? "rust"
        : undefined,
      artifacts.some((artifact) => artifact.endsWith(".go")) ||
      /\bgolang\b|\bgo test\b/.test(corpus)
        ? "go"
        : undefined,
      artifacts.some((artifact) => artifact.endsWith(".java")) || /\bjava\b/.test(corpus)
        ? "java"
        : undefined,
      ...(params.skillEnvironments ?? []).map((env) => env.toLowerCase()),
    ],
    6,
  );
}

function inferEnvironmentFrameworks(params: {
  objective?: string;
  activeArtifacts?: string[];
  toolSignals?: ToolSignal[];
  workspaceTags?: string[];
}): string[] {
  const corpus = [
    params.objective ?? "",
    ...(params.activeArtifacts ?? []),
    ...(params.toolSignals?.map((signal) => signal.summary) ?? []),
    ...(params.workspaceTags ?? []),
  ]
    .join("\n")
    .toLowerCase();
  return uniqueCompact(
    [
      /\breact\b|\.tsx\b/.test(corpus) ? "react" : undefined,
      /\bnext\.?js\b|\bnextjs\b/.test(corpus) ? "nextjs" : undefined,
      /\bvitest\b/.test(corpus) ? "vitest" : undefined,
      /\bjest\b/.test(corpus) ? "jest" : undefined,
      /\bpytest\b/.test(corpus) ? "pytest" : undefined,
      /\bdocker\b/.test(corpus) ? "docker" : undefined,
      /\bpnpm\b/.test(corpus) ? "pnpm" : undefined,
      /\bnpm\b/.test(corpus) ? "npm" : undefined,
      /\bcargo\b/.test(corpus) ? "cargo" : undefined,
    ],
    6,
  );
}

function extractValidationCommandsFromSummary(summary: string): string[] {
  const matches = [
    ...summary.matchAll(
      /\b(pnpm exec [^;\n]+|pnpm [^;\n]+|npm run [^;\n]+|yarn [^;\n]+|pytest(?: [^;\n]+)?|vitest(?: [^;\n]+)?|cargo (?:test|check|build)(?: [^;\n]+)?|go test(?: [^;\n]+)?|tsc(?: [^;\n]+)?|ruff(?: [^;\n]+)?|eslint(?: [^;\n]+)?)/gi,
    ),
  ];
  return uniqueCompact(
    matches.map((match) =>
      match[1]
        .trim()
        .replace(/\s+(?:and|with|because)\b.*$/i, "")
        .replace(/\s+(?:successfully|failed)\b.*$/i, ""),
    ),
    4,
  );
}

function inferValidationCommands(params: {
  toolSignals?: ToolSignal[];
  languages: string[];
  frameworks: string[];
}): string[] {
  const extracted = uniqueCompact(
    (params.toolSignals ?? []).flatMap((signal) =>
      extractValidationCommandsFromSummary(signal.summary),
    ),
    6,
  );
  if (extracted.length > 0) {
    return extracted;
  }
  return uniqueCompact(
    [
      params.languages.includes("typescript")
        ? "pnpm exec tsc -p tsconfig.json --noEmit"
        : undefined,
      params.frameworks.includes("vitest") ? "pnpm exec vitest run" : undefined,
      params.frameworks.includes("pytest") || params.languages.includes("python")
        ? "pytest"
        : undefined,
      params.languages.includes("rust") ? "cargo test" : undefined,
      params.languages.includes("go") ? "go test ./..." : undefined,
    ],
    4,
  );
}

function inferBranchConventions(gitBranch?: string): string[] {
  const normalized = gitBranch?.toLowerCase();
  if (!normalized) {
    return [];
  }
  return uniqueCompact(
    [
      /^(main|master)$/.test(normalized) ? "default_branch" : undefined,
      /^(develop|development|dev)$/.test(normalized) ? "development_branch" : undefined,
      /^(release\/|release-)/.test(normalized) ? "release_branch" : undefined,
      /^(hotfix\/|hotfix-)/.test(normalized) ? "hotfix_branch" : undefined,
      /^(feature\/|feat\/|feature-)/.test(normalized) ? "feature_branch" : undefined,
      /^(chore\/|chore-)/.test(normalized) ? "chore_branch" : undefined,
    ],
    4,
  );
}

function buildRepoFingerprint(params: {
  workspaceKind: AgenticEnvironmentState["workspaceKind"];
  workspaceState?: WorkspaceState;
  languages: string[];
  frameworks: string[];
  validationCommands: string[];
}): string | undefined {
  const workspace = params.workspaceState?.workspaceName ?? "workspace";
  const relativePath = params.workspaceState?.sessionRelativePath ?? ".";
  const languagePart = params.languages.slice(0, 2).join("+") || "unknown";
  const frameworkPart = params.frameworks.slice(0, 2).join("+") || "general";
  const validationPart =
    params.validationCommands.length > 0
      ? params.validationCommands[0].split(/\s+/).slice(0, 2).join("_")
      : "novalidation";
  return `${workspace}:${relativePath}:${params.workspaceKind}:${languagePart}:${frameworkPart}:${validationPart}`;
}

function normalizeClarificationNeed(blocker: string): string {
  const rawBlocker = blocker.replace(/^[^:]+:\s*/, "").trim();
  const envVarMatch = rawBlocker.match(
    /\b(?:missing(?:\s+required)?|required)\s+(?:environment variable|env var|env)\s*:?\s*([A-Z][A-Z0-9_]+)/i,
  );
  if (envVarMatch?.[1]) {
    return `environment variable ${envVarMatch[1]}`;
  }
  const approvalMatch = rawBlocker.match(
    /\b(?:approval required|requires approval|awaiting approval|needs approval)\b[:\s-]*(.*)$/i,
  );
  if (approvalMatch) {
    const approvalTarget = approvalMatch[1]?.trim();
    return approvalTarget ? `operator approval for ${approvalTarget}` : "operator approval";
  }
  const externalInputMatch = rawBlocker.match(
    /\b(?:missing(?:\s+required)?|required|awaiting|needs?)\s+(external input|customer input|user input|request payload|dataset id|api contract|credentials?)\b[:\s-]*(.*)$/i,
  );
  if (externalInputMatch) {
    const inputKind = externalInputMatch[1]?.trim().toLowerCase();
    const inputTail = externalInputMatch[2]?.trim();
    return inputTail ? `${inputKind} ${inputTail}` : inputKind;
  }
  return rawBlocker
    .replace(
      /^(?:missing(?:\s+required)?|required|unknown file|no such file|needs?)\s+(?:config\s+)?(?:file\s+)?/i,
      "",
    )
    .replace(/^file:\s*/i, "")
    .replace(/^:\s*/, "")
    .trim();
}

function extractClarificationFailureReasons(blockers: string[]): string[] {
  const reasons: string[] = [];
  for (const blocker of blockers) {
    const normalized = blocker.toLowerCase();
    if (
      /\b(?:environment variable|env var|env)\b/.test(normalized) &&
      /\bmissing|required|needs?\b/.test(normalized)
    ) {
      reasons.push("missing_information:environment_variable");
      continue;
    }
    if (
      /\bapproval required|requires approval|awaiting approval|needs approval\b/.test(normalized)
    ) {
      reasons.push("missing_information:approval");
      continue;
    }
    if (
      /\bexternal input|customer input|user input|request payload|dataset id|api contract|credentials?\b/.test(
        normalized,
      ) &&
      /\bmissing|required|awaiting|needs?\b/.test(normalized)
    ) {
      reasons.push("missing_information:external_input");
      continue;
    }
    if (/\bmissing|not found|unknown file|no such file|required|needs\b/.test(normalized)) {
      reasons.push("missing_information:file_or_input");
    }
  }
  return uniqueCompact(reasons, 4);
}

function getPrimaryClarificationReason(blockers: string[]): string | undefined {
  return extractClarificationFailureReasons(blockers)[0];
}

function extractClarificationSummary(state: AgenticExecutionState): string | undefined {
  if (state.plannerState.retryClass !== "clarify") {
    return undefined;
  }
  const missingBlocker = state.taskState.blockers.find((blocker) =>
    /\bmissing|not found|required|needs|unknown file|no such file|approval|awaiting|environment variable|env var|external input|customer input|user input|credentials?\b/i.test(
      blocker,
    ),
  );
  if (missingBlocker) {
    const normalizedBlocker = normalizeClarificationNeed(missingBlocker);
    return `Need clarification on: ${truncate(normalizedBlocker, 140)}`;
  }
  const unresolved = state.verificationState.unresolvedCriteria[0];
  if (unresolved) {
    return `Need clarification on: ${truncate(unresolved, 140)}`;
  }
  const objective = state.taskState.objective;
  if (objective) {
    return `Need clarification before retrying: ${truncate(objective, 140)}`;
  }
  return "Need clarification before retrying.";
}

function reconcilePlannerStateWithEnvironment(params: {
  plannerState: AgenticPlannerState;
  environmentState: AgenticEnvironmentState;
  taskState: AgenticTaskState;
  verificationState: AgenticVerificationState;
}): AgenticPlannerState {
  const { plannerState, environmentState, taskState, verificationState } = params;
  const validationCommands = environmentState.validationCommands ?? [];
  const branchConventions = environmentState.branchConventions ?? [];
  const protectedBranch =
    branchConventions.includes("default_branch") ||
    branchConventions.includes("release_branch") ||
    branchConventions.includes("hotfix_branch");
  const validationThinProjectWork =
    environmentState.workspaceKind === "project" &&
    (taskState.taskMode === "coding" ||
      taskState.taskMode === "debugging" ||
      taskState.taskMode === "operations") &&
    (environmentState.preferredValidationTools?.length ?? 0) === 0;
  let retryClass = plannerState.retryClass;
  let suggestedSkill = plannerState.suggestedSkill;
  let remainingRetryBudget = plannerState.remainingRetryBudget;
  const alternativeSkills = plannerState.alternativeSkills;
  if (
    protectedBranch &&
    verificationState.outcome !== "verified" &&
    retryClass === "same_path_retry" &&
    alternativeSkills.length > 0
  ) {
    retryClass = "skill_fallback";
    suggestedSkill = suggestedSkill ?? alternativeSkills[0];
  }
  if (validationThinProjectWork && retryClass === "same_path_retry") {
    retryClass = "clarify";
  }
  if (protectedBranch || validationThinProjectWork) {
    remainingRetryBudget =
      typeof remainingRetryBudget === "number" ? Math.min(remainingRetryBudget, 1) : 1;
  }
  const nextActionParts = uniqueCompact(
    [
      plannerState.nextAction,
      validationCommands.length > 0 && plannerState.status !== "complete"
        ? `Use repo-aware validation: ${validationCommands.slice(0, 2).join(" then ")}.`
        : undefined,
      branchConventions.includes("release_branch") || branchConventions.includes("hotfix_branch")
        ? `Respect branch convention: ${branchConventions.join(", ")}.`
        : undefined,
      protectedBranch && verificationState.outcome !== "verified"
        ? "Avoid repeated same-path retries on protected branches; prefer review-safe fallback or approval."
        : undefined,
      validationThinProjectWork
        ? "Establish an observed validation command before retrying project changes."
        : undefined,
    ],
    5,
  );
  const rationaleParts = uniqueCompact(
    [
      plannerState.rationale,
      environmentState.repoFingerprint
        ? `environment=${truncate(environmentState.repoFingerprint, 120)}`
        : undefined,
      protectedBranch && verificationState.outcome !== "verified"
        ? "protected-branch-retry-guard"
        : undefined,
      validationThinProjectWork ? "validation-context-required" : undefined,
    ],
    6,
  );
  return {
    ...plannerState,
    retryClass,
    suggestedSkill,
    remainingRetryBudget,
    nextAction: nextActionParts.length > 0 ? nextActionParts.join(" ") : plannerState.nextAction,
    rationale: rationaleParts.length > 0 ? rationaleParts.join(" | ") : plannerState.rationale,
  };
}

function buildFailureLearningState(params: {
  verificationState: AgenticVerificationState;
  plannerState: AgenticPlannerState;
  orchestrationState: AgenticOrchestrationState;
  blockers: string[];
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
    [
      ...params.verificationState.failureClasses,
      ...extractClarificationFailureReasons(params.blockers),
      params.plannerState.escalationReason,
    ],
    8,
  );
  return {
    version: 1,
    failurePattern,
    learnFromFailure: failurePattern === "near_miss" || failurePattern === "blocked_path",
    failureReasons,
    missingCapabilities: uniqueCompact(
      [
        ...params.orchestrationState.capabilityGaps,
        !params.orchestrationState.hasViableFallback ? "no_viable_fallback" : undefined,
      ],
      8,
    ),
  };
}

function reconcilePlannerStateWithOrchestration(params: {
  plannerState: AgenticPlannerState;
  orchestrationState: AgenticOrchestrationState;
  likelySkills?: string[];
  memoryRegressionSignals?: AgenticRegressionMemorySignal;
}): AgenticPlannerState {
  const likelySkills = uniqueCompact(params.likelySkills ?? [], 6);
  const memoryRegressionSignals = params.memoryRegressionSignals ?? {
    missingFallbackRegression: false,
    escalationRegression: false,
    qualityFailureReasons: [],
    regressingSkillFamilies: [],
    consolidationPreferredFamilies: [],
    templatePreferredFamilies: [],
    mergePreferredFamilies: [],
    preferredFallbackSkills: [],
  };
  const primaryFamily = params.orchestrationState.primarySkill
    ? inferSkillFamily(params.orchestrationState.primarySkill)
    : undefined;
  const templateFamilyReuseActive =
    Boolean(primaryFamily) &&
    !params.orchestrationState.mergeCandidate &&
    params.orchestrationState.consolidationAction === "generalize_existing" &&
    memoryRegressionSignals.templatePreferredFamilies.includes(primaryFamily ?? "");
  const mergeFamilyFallbackActive =
    params.orchestrationState.mergeCandidate && params.orchestrationState.mergeSkills.length > 1;
  const rankedAlternatives = params.orchestrationState.rankedSkills.filter(
    (skill) => !likelySkills.includes(skill),
  );
  if (
    params.plannerState.retryClass === "same_path_retry" &&
    params.plannerState.status === "needs_replan" &&
    memoryRegressionSignals.missingFallbackRegression &&
    rankedAlternatives.length > 0
  ) {
    return {
      ...params.plannerState,
      retryClass: "skill_fallback",
      suggestedSkill: rankedAlternatives[0],
      alternativeSkills: rankedAlternatives,
      nextAction: `Avoid the historically regressing path and switch to ${rankedAlternatives[0]}. Consider alternative skills: ${rankedAlternatives.slice(0, 3).join(", ")}.`,
      rationale: params.plannerState.rationale
        ? `${params.plannerState.rationale}; memory-regression:no_viable_fallback`
        : "memory-regression:no_viable_fallback",
    };
  }
  if (
    params.orchestrationState.capabilityGaps.includes("no_viable_fallback") &&
    !params.orchestrationState.hasViableFallback &&
    (params.plannerState.status === "needs_replan" || params.plannerState.status === "blocked")
  ) {
    if (templateFamilyReuseActive && params.orchestrationState.primarySkill) {
      return {
        ...params.plannerState,
        shouldEscalate: false,
        escalationReason: undefined,
        nextAction: `Do not spawn a new fork for this blocker. Reuse and parameterize the stable ${primaryFamily} workflow around ${params.orchestrationState.primarySkill} instead of creating a new fork.`,
        rationale: (params.plannerState.rationale ?? "").includes("template-family-guidance")
          ? params.plannerState.rationale
          : params.plannerState.rationale
            ? `${params.plannerState.rationale}; template-family-guidance`
            : "template-family-guidance",
      };
    }
    return {
      ...params.plannerState,
      retryClass: "escalate",
      suggestedSkill: undefined,
      alternativeSkills: [],
      shouldEscalate: true,
      escalationReason: params.plannerState.escalationReason ?? "low_confidence",
      nextAction:
        "Escalate or add a new viable workflow before retrying; current options are too weak or missing.",
      rationale: params.plannerState.rationale
        ? `${params.plannerState.rationale}; no_viable_fallback`
        : "no_viable_fallback",
    };
  }
  if (params.plannerState.retryClass !== "skill_fallback") {
    return params.plannerState;
  }
  if (rankedAlternatives.length === 0) {
    return params.plannerState;
  }
  const suggestedSkill = rankedAlternatives[0];
  const nextAction = mergeFamilyFallbackActive
    ? `Switch to a fallback workflow using ${suggestedSkill} before retrying. Prefer the sibling fallback ${suggestedSkill} inside the durable merge-ready ${inferSkillFamily(suggestedSkill)} family. Consider alternative skills: ${rankedAlternatives.slice(0, 3).join(", ")}.`
    : params.plannerState.nextAction?.includes("fallback workflow using")
      ? `Switch to a fallback workflow using ${suggestedSkill} before retrying. Consider alternative skills: ${rankedAlternatives.slice(0, 3).join(", ")}.`
      : params.plannerState.nextAction;
  const rationale =
    memoryRegressionSignals.missingFallbackRegression &&
    !(params.plannerState.rationale ?? "").includes("memory-regression:no_viable_fallback")
      ? params.plannerState.rationale
        ? `${params.plannerState.rationale}; memory-regression:no_viable_fallback`
        : "memory-regression:no_viable_fallback"
      : params.plannerState.rationale;
  return {
    ...params.plannerState,
    suggestedSkill,
    alternativeSkills: rankedAlternatives,
    nextAction,
    rationale,
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
    objective: latestUserSummary,
    successCriteria:
      successCriteria.length > 0 ? successCriteria : latestUserSummary ? [latestUserSummary] : [],
  });
  const taskMode = inferTaskMode(corpus);
  const subtasks = uniqueCompact(
    extractListCandidates(latestUserSummary ?? "").map((item) => truncate(item, 120)),
    4,
  );
  const memoryRegressionSignals = extractAgenticRegressionMemorySignals(
    params.memorySystemPromptAddition,
  );
  const plannerState = buildPlannerState({
    objective: latestUserSummary,
    blockers,
    verificationState,
    checkpointSignals: params.checkpointSignals,
    activeArtifacts,
    retrySignals: params.retrySignals,
    availableSkills: params.availableSkills,
    likelySkills: params.likelySkills,
    memoryRegressionSignals,
  });
  const taskState: AgenticTaskState = {
    version: 1,
    objective: latestUserSummary,
    taskMode,
    subtasks,
    blockers,
    assumptions,
    successCriteria:
      successCriteria.length > 0 ? successCriteria : latestUserSummary ? [latestUserSummary] : [],
    planSteps: buildPlanSteps({
      objective: latestUserSummary,
      subtasks,
      successCriteria:
        successCriteria.length > 0 ? successCriteria : latestUserSummary ? [latestUserSummary] : [],
      activeArtifacts,
      blockers,
      verificationState,
      plannerState,
      checkpointSignals: params.checkpointSignals,
      retrySignals: params.retrySignals,
    }),
    activeArtifacts,
    currentStrategy: summarizeStrategy({
      toolSignals: params.toolSignals,
      diffSignals: params.diffSignals,
    }),
    confidence:
      blockers.length > 0 ? "low" : verificationState.outcome === "verified" ? "high" : "medium",
  };
  const availableSkillInfo =
    params.availableSkillInfo && params.availableSkillInfo.length > 0
      ? params.availableSkillInfo
      : (params.availableSkills ?? []).map((skill) => ({ name: skill }));
  const preferredEnv = inferPreferredSkillEnvironment(
    taskState.objective ?? "",
    taskState.taskMode,
  );
  const memorySkillSignals = extractProceduralMemorySkillSignals({
    memoryText: params.memorySystemPromptAddition,
    availableSkills: availableSkillInfo.map((skill) => skill.name),
    taskMode: taskState.taskMode,
    preferredEnv,
  });
  const orchestrationState = buildOrchestrationState({
    taskMode: taskState.taskMode,
    objectiveText: taskState.objective,
    availableSkills: availableSkillInfo,
    likelySkills: params.likelySkills,
    memoryRecommendedSkills: memorySkillSignals.recommendedSkills,
    memoryWeightedSkills: memorySkillSignals.weightedSkills,
    memoryWeightedFamilies: memorySkillSignals.weightedFamilies,
    memoryRecoveringSkills: memorySkillSignals.recoveringSkills,
    memoryStabilizedSkills: memorySkillSignals.stabilizedSkills,
    memoryPromotedSkills: memorySkillSignals.promotedSkills,
    memoryWorkflowChains: memorySkillSignals.workflowChains,
    memoryMultiSkillHint: memorySkillSignals.multiSkillHint,
    memoryRegressionSignals,
    alternativeSkills: plannerState.alternativeSkills,
    toolSignals: params.toolSignals,
    plannerState,
  });
  const environmentState = buildEnvironmentState({
    workspaceTags: params.workspaceTags,
    workspaceState: params.workspaceState,
    toolSignals: params.toolSignals,
    availableSkills: availableSkillInfo,
    objective: taskState.objective,
    activeArtifacts,
  });
  const failureLearningState = buildFailureLearningState({
    verificationState,
    plannerState,
    orchestrationState,
    blockers,
  });
  const orchestrationReconciledPlannerState = reconcilePlannerStateWithOrchestration({
    plannerState,
    orchestrationState,
    likelySkills: params.likelySkills,
    memoryRegressionSignals,
  });
  const reconciledPlannerState = reconcilePlannerStateWithEnvironment({
    plannerState: orchestrationReconciledPlannerState,
    environmentState,
    taskState,
    verificationState,
  });
  const governanceState = buildGovernanceState({
    messages: params.messages,
    taskState,
    verificationState,
    plannerState: reconciledPlannerState,
    environmentState,
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
  const goalGuidance = `Goal satisfaction: ${state.verificationState.goalSatisfaction}`;
  const unresolvedGoalGuidance =
    state.verificationState.unresolvedCriteria.length > 0
      ? `Unresolved success criteria: ${state.verificationState.unresolvedCriteria.join(" | ")}`
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
  const workflowGuidance =
    state.orchestrationState.workflowSteps.length > 1
      ? `Workflow chain: ${state.orchestrationState.workflowSteps
          .map((step) => `${step.role}:${step.skill}`)
          .join(" -> ")}`
      : undefined;
  const capabilityGapGuidance =
    state.orchestrationState.capabilityGaps.length > 0
      ? `Capability gaps: ${state.orchestrationState.capabilityGaps.join(", ")}`
      : undefined;
  const consolidationGuidance =
    state.orchestrationState.consolidationAction !== "none"
      ? `Consolidation guidance: ${state.orchestrationState.consolidationAction}${state.orchestrationState.overlappingSkills.length > 0 ? ` for ${state.orchestrationState.overlappingSkills.join(", ")}` : ""}`
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
  const repoFingerprintGuidance = state.environmentState.repoFingerprint
    ? `Repo fingerprint: ${state.environmentState.repoFingerprint}`
    : undefined;
  const capabilitySignalsGuidance =
    state.environmentState.capabilitySignals.length > 0
      ? `Capabilities: ${state.environmentState.capabilitySignals.join(", ")}`
      : undefined;
  const languageSignalsGuidance =
    state.environmentState.languageSignals && state.environmentState.languageSignals.length > 0
      ? `Languages: ${state.environmentState.languageSignals.join(", ")}`
      : undefined;
  const frameworkSignalsGuidance =
    state.environmentState.frameworkSignals && state.environmentState.frameworkSignals.length > 0
      ? `Frameworks: ${state.environmentState.frameworkSignals.join(", ")}`
      : undefined;
  const validationCommandsGuidance =
    state.environmentState.validationCommands &&
    state.environmentState.validationCommands.length > 0
      ? `Validation commands: ${state.environmentState.validationCommands.join(" | ")}`
      : undefined;
  const permissionSignalsGuidance =
    state.environmentState.permissionSignals && state.environmentState.permissionSignals.length > 0
      ? `Permissions: ${state.environmentState.permissionSignals.join(", ")}`
      : undefined;
  const branchConventionsGuidance =
    state.environmentState.branchConventions && state.environmentState.branchConventions.length > 0
      ? `Branch conventions: ${state.environmentState.branchConventions.join(", ")}`
      : undefined;
  const failureLearningGuidance = `Failure pattern: ${state.failureLearningState.failurePattern}`;
  const lines = [
    "## Execution State",
    state.taskState.objective ? `Objective: ${state.taskState.objective}` : undefined,
    `Task mode: ${state.taskState.taskMode}`,
    state.taskState.planSteps.length > 0
      ? `Plan steps: ${state.taskState.planSteps
          .map((step) => `[${step.status}] ${step.title}`)
          .join(" | ")}`
      : undefined,
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
    goalGuidance,
    unresolvedGoalGuidance,
    failureGuidance,
    retryGuidance,
    escalationGuidance,
    governanceGuidance,
    governanceReasons,
    orchestrationGuidance,
    workflowGuidance,
    fallbackChainGuidance,
    rankedSkillsGuidance,
    prerequisiteGuidance,
    capabilityGapGuidance,
    consolidationGuidance,
    environmentGuidance,
    repoFingerprintGuidance,
    capabilitySignalsGuidance,
    languageSignalsGuidance,
    frameworkSignalsGuidance,
    validationCommandsGuidance,
    permissionSignalsGuidance,
    branchConventionsGuidance,
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
    (changedArtifacts.length > 1 ||
      toolChain.length > 1 ||
      (params.orchestrationState.consolidationAction === "generalize_existing" &&
        !params.orchestrationState.mergeCandidate));

  let nextImprovement: string | undefined;
  const resolvedPrimarySkill =
    params.orchestrationState.primarySkill ?? likelySkills[0] ?? availableSkills[0];
  const overlappingSkills =
    params.orchestrationState.overlappingSkills.length > 0
      ? params.orchestrationState.overlappingSkills
      : uniqueCompact(
          availableSkills.filter(
            (skill) => inferSkillFamily(skill) === inferSkillFamily(resolvedPrimarySkill),
          ),
          6,
        );
  const skillFamilies = params.orchestrationState.skillFamilies;
  const consolidationAction = params.orchestrationState.consolidationAction;
  const mergeCandidate = params.orchestrationState.mergeCandidate;
  const mergeSkills = params.orchestrationState.mergeSkills;
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
  const resolvedEffectiveSkills = params.orchestrationState.effectiveSkills;
  const resolvedEffectiveFamilies = params.orchestrationState.effectiveFamilies;
  const resolvedPromotedSkills = params.orchestrationState.promotedSkills;
  const resolvedStabilityState = params.orchestrationState.stabilityState;
  const resolvedStabilitySkills = params.orchestrationState.stabilitySkills;
  const resolvedWorkflowSteps =
    params.orchestrationState.workflowSteps.length > 0
      ? params.orchestrationState.workflowSteps
      : resolvedSkillChain.map((skill, index) => ({
          skill,
          role: index === 0 ? ("primary" as const) : ("fallback" as const),
        }));
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
  } else if (resolvedStabilityState === "recovered_watch") {
    nextImprovement =
      "Keep the recovered workflow under watch until it proves durable across repeated runs.";
  } else if (resolvedPromotedSkills.length > 0) {
    nextImprovement = `Promote the durable workflow path for reuse: ${resolvedPromotedSkills.join(", ")}.`;
  } else if (resolvedStabilityState === "stable_reuse") {
    nextImprovement = "Extend the stable workflow family rather than creating a new fork.";
  } else if (mergeCandidate && mergeSkills.length > 0) {
    nextImprovement = `Merge overlapping sibling skills into one reusable workflow: ${mergeSkills.join(", ")}.`;
  } else if (consolidationCandidate) {
    nextImprovement =
      "Consider consolidating overlapping skills into a more generic reusable workflow.";
  } else if (
    consolidationAction === "extend_existing" ||
    consolidationAction === "generalize_existing"
  ) {
    nextImprovement = `Prefer ${consolidationAction} rather than creating a new fork${overlappingSkills.length > 0 ? ` for ${overlappingSkills.join(", ")}` : ""}.`;
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
    goalSatisfaction: params.verificationState.goalSatisfaction,
    taskMode: params.taskState.taskMode,
    planSteps: params.taskState.planSteps,
    templateCandidate,
    consolidationCandidate,
    consolidationAction,
    overlappingSkills,
    skillFamilies,
    mergeCandidate,
    mergeSkills,
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
    workflowSteps: resolvedWorkflowSteps,
    rankedSkills: resolvedRankedSkills,
    effectiveSkills: resolvedEffectiveSkills,
    effectiveFamilies: resolvedEffectiveFamilies,
    promotedSkills: resolvedPromotedSkills,
    stabilityState: resolvedStabilityState,
    stabilitySkills: resolvedStabilitySkills,
    prerequisiteWarnings: params.orchestrationState.prerequisiteWarnings,
    capabilityGaps: params.orchestrationState.capabilityGaps,
    hasViableFallback: params.orchestrationState.hasViableFallback,
    multiSkillCandidate: params.orchestrationState.multiSkillCandidate,
    chainedWorkflow: params.orchestrationState.chainedWorkflow,
    workspaceKind: params.environmentState.workspaceKind,
    capabilitySignals: params.environmentState.capabilitySignals,
    preferredValidationTools: params.environmentState.preferredValidationTools,
    skillEnvironments: params.environmentState.skillEnvironments,
    repoFingerprint: params.environmentState.repoFingerprint,
    languageSignals: params.environmentState.languageSignals,
    frameworkSignals: params.environmentState.frameworkSignals,
    validationCommands: params.environmentState.validationCommands,
    permissionSignals: params.environmentState.permissionSignals,
    branchConventions: params.environmentState.branchConventions,
    failurePattern: params.failureLearningState.failurePattern,
    learnFromFailure: params.failureLearningState.learnFromFailure,
    failureReasons: params.failureLearningState.failureReasons,
    nextImprovement,
  };
}

export function inspectAgenticExecutionObservability(
  state: AgenticExecutionState,
): AgenticExecutionObservabilityReport {
  const completedSteps = state.taskState.planSteps.filter((step) => step.status === "completed");
  const activeSteps = state.taskState.planSteps.filter(
    (step) => step.status === "in_progress" || step.status === "pending",
  );
  const blockedSteps = state.taskState.planSteps.filter((step) => step.status === "blocked");
  const recommendations = uniqueCompact(
    [
      state.plannerState.shouldEscalate
        ? `Escalate: ${state.plannerState.escalationReason ?? "unknown"}`
        : undefined,
      state.plannerState.retryClass === "skill_fallback" && state.plannerState.suggestedSkill
        ? `Retry with fallback skill: ${state.plannerState.suggestedSkill}`
        : undefined,
      !state.orchestrationState.hasViableFallback
        ? "Add or learn a viable fallback workflow before retrying."
        : undefined,
      state.orchestrationState.capabilityGaps.length > 0
        ? `Address capability gaps: ${state.orchestrationState.capabilityGaps.join(", ")}`
        : undefined,
      state.orchestrationState.consolidationAction !== "none"
        ? `Prefer ${state.orchestrationState.consolidationAction} for overlapping skills${state.orchestrationState.overlappingSkills.length > 0 ? `: ${state.orchestrationState.overlappingSkills.join(", ")}` : ""}.`
        : undefined,
      state.orchestrationState.mergeCandidate && state.orchestrationState.mergeSkills.length > 0
        ? `Merge overlapping sibling skills: ${state.orchestrationState.mergeSkills.join(", ")}`
        : undefined,
      state.orchestrationState.stabilityState === "stable_reuse" &&
      state.orchestrationState.stabilitySkills.length > 0
        ? `Stable reusable skills can be extended: ${state.orchestrationState.stabilitySkills.join(", ")}`
        : undefined,
      state.orchestrationState.stabilityState === "recovered_watch" &&
      state.orchestrationState.stabilitySkills.length > 0
        ? `Recovered skills remain under watch: ${state.orchestrationState.stabilitySkills.join(", ")}`
        : undefined,
      state.orchestrationState.promotedSkills.length > 0
        ? `Promotion-ready scoped skills: ${state.orchestrationState.promotedSkills.join(", ")}`
        : undefined,
      state.failureLearningState.learnFromFailure
        ? `Retain this failure pattern for learning: ${state.failureLearningState.failurePattern}`
        : undefined,
    ],
    6,
  );
  const summary = [
    `retry=${state.plannerState.retryClass}`,
    `autonomy=${state.governanceState.autonomyMode}`,
    `risk=${state.governanceState.riskLevel}`,
    state.orchestrationState.primarySkill ? `primary=${state.orchestrationState.primarySkill}` : "",
    state.plannerState.suggestedSkill ? `suggested=${state.plannerState.suggestedSkill}` : "",
    `failure=${state.failureLearningState.failurePattern}`,
    state.orchestrationState.hasViableFallback ? "fallback=viable" : "fallback=missing",
  ]
    .filter(Boolean)
    .join(" ");
  const progressSummary = uniqueCompact(
    [
      `completed=${completedSteps.length}`,
      `active=${activeSteps.length}`,
      blockedSteps.length > 0 ? `blocked=${blockedSteps.length}` : "blocked=0",
      state.plannerState.nextAction
        ? `next=${truncate(state.plannerState.nextAction, 120)}`
        : undefined,
    ],
    4,
  ).join(" ");
  const clarificationSummary = extractClarificationSummary(state);
  return {
    summary,
    progressSummary,
    clarificationSummary,
    retryClass: state.plannerState.retryClass,
    autonomyMode: state.governanceState.autonomyMode,
    riskLevel: state.governanceState.riskLevel,
    primarySkill: state.orchestrationState.primarySkill,
    suggestedSkill: state.plannerState.suggestedSkill,
    workflowSteps: state.orchestrationState.workflowSteps,
    rankedSkills: state.orchestrationState.rankedSkills,
    effectiveSkills: state.orchestrationState.effectiveSkills,
    effectiveFamilies: state.orchestrationState.effectiveFamilies,
    promotedSkills: state.orchestrationState.promotedSkills,
    stabilityState: state.orchestrationState.stabilityState,
    stabilitySkills: state.orchestrationState.stabilitySkills,
    consolidationAction: state.orchestrationState.consolidationAction,
    overlappingSkills: state.orchestrationState.overlappingSkills,
    mergeCandidate: state.orchestrationState.mergeCandidate,
    mergeSkills: state.orchestrationState.mergeSkills,
    capabilityGaps: state.orchestrationState.capabilityGaps,
    failurePattern: state.failureLearningState.failurePattern,
    hasViableFallback: state.orchestrationState.hasViableFallback,
    escalationRequired: state.plannerState.shouldEscalate,
    planSteps: state.taskState.planSteps,
    goalSatisfaction: state.verificationState.goalSatisfaction,
    unresolvedCriteria: state.verificationState.unresolvedCriteria,
    assumptions: state.taskState.assumptions,
    recommendations,
  };
}

export function formatAgenticExecutionObservabilityReport(
  report: AgenticExecutionObservabilityReport,
  format: "json" | "summary" | "markdown" = "json",
): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "summary") {
    const lines = [
      report.summary,
      `progress=${report.progressSummary}`,
      report.clarificationSummary
        ? `clarification=${report.clarificationSummary}`
        : "clarification=none",
      `escalation=${report.escalationRequired ? "yes" : "no"} fallback=${report.hasViableFallback ? "viable" : "missing"}`,
      report.rankedSkills.length > 0 ? `ranked=${report.rankedSkills.join(">")}` : "ranked=none",
      report.effectiveSkills.length > 0
        ? `effective_skills=${report.effectiveSkills.join(">")}`
        : "effective_skills=none",
      report.effectiveFamilies.length > 0
        ? `effective_families=${report.effectiveFamilies.join(">")}`
        : "effective_families=none",
      report.promotedSkills.length > 0
        ? `promoted_skills=${report.promotedSkills.join(">")}`
        : "promoted_skills=none",
      `stability_state=${report.stabilityState}`,
      report.stabilitySkills.length > 0
        ? `stability_skills=${report.stabilitySkills.join(">")}`
        : "stability_skills=none",
      report.workflowSteps.length > 0
        ? `workflow=${report.workflowSteps.map((step) => `${step.role}:${step.skill}`).join(">")}`
        : "workflow=none",
      `consolidation=${report.consolidationAction}`,
      report.mergeCandidate
        ? `merge_skills=${report.mergeSkills.length > 0 ? report.mergeSkills.join(">") : "candidate"}`
        : "merge_skills=none",
      `goal=${report.goalSatisfaction}`,
      report.assumptions.length > 0
        ? `assumptions=${report.assumptions.join(" | ")}`
        : "assumptions=none",
      report.recommendations.length > 0
        ? `recommendations=${report.recommendations.join(" | ")}`
        : "recommendations=none",
      report.planSteps.length > 0
        ? `plan=${report.planSteps.map((step) => `${step.status}:${step.title}`).join(" | ")}`
        : "plan=none",
    ];
    return `${lines.join("\n")}\n`;
  }
  const lines = [
    "# Agentic Diagnostics Report",
    "",
    `- Summary: ${report.summary}`,
    `- Progress: ${report.progressSummary}`,
    `- Clarification: ${report.clarificationSummary ?? "none"}`,
    `- Retry class: ${report.retryClass}`,
    `- Autonomy mode: ${report.autonomyMode}`,
    `- Risk level: ${report.riskLevel}`,
    `- Primary skill: ${report.primarySkill ?? "none"}`,
    `- Suggested skill: ${report.suggestedSkill ?? "none"}`,
    `- Ranked skills: ${report.rankedSkills.length > 0 ? report.rankedSkills.join(" > ") : "none"}`,
    `- Effective skills: ${report.effectiveSkills.length > 0 ? report.effectiveSkills.join(" > ") : "none"}`,
    `- Effective families: ${report.effectiveFamilies.length > 0 ? report.effectiveFamilies.join(", ") : "none"}`,
    `- Promoted skills: ${report.promotedSkills.length > 0 ? report.promotedSkills.join(", ") : "none"}`,
    `- Stability state: ${report.stabilityState}`,
    `- Stability skills: ${report.stabilitySkills.length > 0 ? report.stabilitySkills.join(", ") : "none"}`,
    `- Workflow chain: ${report.workflowSteps.length > 0 ? report.workflowSteps.map((step) => `${step.role}:${step.skill}`).join(" -> ") : "none"}`,
    `- Consolidation action: ${report.consolidationAction}`,
    `- Overlapping skills: ${report.overlappingSkills.length > 0 ? report.overlappingSkills.join(", ") : "none"}`,
    `- Merge candidate: ${report.mergeCandidate ? "yes" : "no"}`,
    `- Merge skills: ${report.mergeSkills.length > 0 ? report.mergeSkills.join(", ") : "none"}`,
    `- Goal satisfaction: ${report.goalSatisfaction}`,
    `- Unresolved criteria: ${report.unresolvedCriteria.length > 0 ? report.unresolvedCriteria.join(" | ") : "none"}`,
    `- Assumptions: ${report.assumptions.length > 0 ? report.assumptions.join(" | ") : "none"}`,
    `- Failure pattern: ${report.failurePattern}`,
    `- Viable fallback: ${report.hasViableFallback ? "yes" : "no"}`,
    `- Escalation required: ${report.escalationRequired ? "yes" : "no"}`,
    `- Capability gaps: ${report.capabilityGaps.length > 0 ? report.capabilityGaps.join(", ") : "none"}`,
    "",
    "## Plan Steps",
    ...(report.planSteps.length > 0
      ? report.planSteps.map((step) => `- [${step.status}] ${step.title} (${step.kind})`)
      : ["- none"]),
    "",
    "## Recommendations",
    ...(report.recommendations.length > 0
      ? report.recommendations.map((recommendation) => `- ${recommendation}`)
      : ["- none"]),
  ];
  return `${lines.join("\n")}\n`;
}

export function buildAgenticHandoffReport(state: AgenticExecutionState): AgenticHandoffReport {
  const completedSteps = state.taskState.planSteps
    .filter((step) => step.status === "completed")
    .map((step) => step.title);
  const pendingSteps = state.taskState.planSteps
    .filter((step) => step.status === "pending" || step.status === "in_progress")
    .map((step) => `${step.status === "in_progress" ? "active" : "pending"}: ${step.title}`);
  const blockedSteps = state.taskState.planSteps
    .filter((step) => step.status === "blocked")
    .map((step) => step.title);
  const progressSummary = uniqueCompact(
    [
      `completed=${completedSteps.length}`,
      `pending=${pendingSteps.length}`,
      blockedSteps.length > 0 ? `blocked=${blockedSteps.length}` : "blocked=0",
      state.plannerState.nextAction
        ? `next=${truncate(state.plannerState.nextAction, 120)}`
        : undefined,
    ],
    4,
  ).join(" ");
  const clarificationSummary = extractClarificationSummary(state);
  const clarificationReason = getPrimaryClarificationReason(state.taskState.blockers);
  const operatorReason =
    state.governanceState.reasons[0] ??
    (state.plannerState.retryClass === "clarify" ? "await_validation_context" : undefined);
  const operatorMode: AgenticHandoffReport["operatorMode"] =
    state.governanceState.autonomyMode === "approval_required"
      ? "approval_required"
      : state.governanceState.autonomyMode === "escalate"
        ? "escalate"
        : state.plannerState.retryClass === "clarify"
          ? "pause"
          : "continue";
  const resumeCondition =
    operatorMode === "approval_required"
      ? "Wait for operator approval before resuming protected or high-risk work."
      : operatorMode === "escalate"
        ? `Resolve escalation before resuming${state.plannerState.escalationReason ? ` (${state.plannerState.escalationReason})` : ""}.`
        : state.plannerState.retryClass === "clarify"
          ? clarificationReason === "missing_information:environment_variable"
            ? "Configure the missing environment variable before resuming."
            : clarificationReason === "missing_information:approval"
              ? "Obtain the required approval before resuming."
              : clarificationReason === "missing_information:external_input"
                ? "Provide the missing external input before resuming."
                : "Capture an observed validation command or missing prerequisite before resuming."
          : undefined;
  const resumePrompt =
    operatorMode === "approval_required"
      ? state.taskState.objective
        ? `Resume after approval: ${state.taskState.objective}`
        : state.plannerState.nextAction
          ? `Resume after approval with next action: ${state.plannerState.nextAction}`
          : undefined
      : operatorMode === "escalate"
        ? state.plannerState.nextAction
          ? `Resume after escalation is resolved: ${state.plannerState.nextAction}`
          : undefined
        : operatorMode === "pause"
          ? state.plannerState.nextAction
            ? `Resume after prerequisites are restored: ${state.plannerState.nextAction}`
            : undefined
          : state.taskState.objective
            ? `Resume by continuing: ${state.taskState.objective}`
            : state.plannerState.nextAction
              ? `Resume with next action: ${state.plannerState.nextAction}`
              : undefined;
  const summaryParts = uniqueCompact(
    [
      state.taskState.objective
        ? `objective=${truncate(state.taskState.objective, 80)}`
        : undefined,
      `operator=${operatorMode}`,
      completedSteps.length > 0 ? `completed=${completedSteps.length}` : undefined,
      pendingSteps.length > 0 ? `pending=${pendingSteps.length}` : undefined,
      blockedSteps.length > 0 ? `blocked=${blockedSteps.length}` : undefined,
      state.plannerState.suggestedSkill
        ? `suggested=${state.plannerState.suggestedSkill}`
        : undefined,
    ],
    6,
  );
  return {
    summary: summaryParts.join(" "),
    progressSummary,
    clarificationSummary,
    objective: state.taskState.objective,
    completedSteps,
    pendingSteps,
    blockedSteps,
    activeArtifacts: state.taskState.activeArtifacts,
    blockers: state.taskState.blockers,
    operatorMode,
    operatorReason,
    nextAction: state.plannerState.nextAction,
    suggestedSkill: state.plannerState.suggestedSkill,
    resumePrompt,
    resumeCondition,
    assumptions: state.taskState.assumptions,
  };
}

export function formatAgenticHandoffReport(
  report: AgenticHandoffReport,
  format: "json" | "summary" | "markdown" = "json",
): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "summary") {
    const lines = [
      report.summary || "handoff=empty",
      `progress=${report.progressSummary}`,
      report.clarificationSummary
        ? `clarification=${report.clarificationSummary}`
        : "clarification=none",
      `operator=${report.operatorMode}${report.operatorReason ? ` reason=${report.operatorReason}` : ""}`,
      report.nextAction ? `next=${report.nextAction}` : "next=none",
      report.pendingSteps.length > 0
        ? `pending=${report.pendingSteps.join(" | ")}`
        : "pending=none",
      report.blockedSteps.length > 0
        ? `blocked=${report.blockedSteps.join(" | ")}`
        : "blocked=none",
      report.resumeCondition
        ? `resume_condition=${report.resumeCondition}`
        : "resume_condition=none",
      report.resumePrompt ? `resume=${report.resumePrompt}` : "resume=none",
    ];
    return `${lines.join("\n")}\n`;
  }
  const lines = [
    "# Agentic Handoff Report",
    "",
    `- Summary: ${report.summary || "none"}`,
    `- Progress: ${report.progressSummary}`,
    `- Clarification: ${report.clarificationSummary ?? "none"}`,
    `- Objective: ${report.objective ?? "none"}`,
    `- Operator mode: ${report.operatorMode}`,
    `- Operator reason: ${report.operatorReason ?? "none"}`,
    `- Next action: ${report.nextAction ?? "none"}`,
    `- Suggested skill: ${report.suggestedSkill ?? "none"}`,
    `- Resume condition: ${report.resumeCondition ?? "none"}`,
    `- Resume prompt: ${report.resumePrompt ?? "none"}`,
    `- Active artifacts: ${report.activeArtifacts.length > 0 ? report.activeArtifacts.join(", ") : "none"}`,
    `- Blockers: ${report.blockers.length > 0 ? report.blockers.join(" | ") : "none"}`,
    `- Assumptions: ${report.assumptions.length > 0 ? report.assumptions.join(" | ") : "none"}`,
    "",
    "## Completed Steps",
    ...(report.completedSteps.length > 0
      ? report.completedSteps.map((step) => `- ${step}`)
      : ["- none"]),
    "",
    "## Pending Steps",
    ...(report.pendingSteps.length > 0
      ? report.pendingSteps.map((step) => `- ${step}`)
      : ["- none"]),
    "",
    "## Blocked Steps",
    ...(report.blockedSteps.length > 0
      ? report.blockedSteps.map((step) => `- ${step}`)
      : ["- none"]),
  ];
  return `${lines.join("\n")}\n`;
}

export function runAgenticAcceptanceSuite(): AgenticAcceptanceReport {
  const scenarios: AgenticAcceptanceScenarioResult[] = [];

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow and switch to the strongest remembered reporting path if needed.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Validation failed again for the diagnostics workflow.",
        },
      ],
      availableSkills: ["memory-diagnostics", "acceptance-report", "release-checks"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "release-checks", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Recommended procedural skills:",
        "- memory-diagnostics",
        "Procedural guidance:",
        "- Procedural workflow for planning work: primary skill memory-diagnostics: with outcome failed: failure pattern near_miss",
        "- Procedural workflow for planning work: primary skill acceptance-report: with outcome verified: failure pattern clean_success",
      ].join("\n"),
    });
    const passed =
      state.plannerState.retryClass === "skill_fallback" &&
      state.plannerState.suggestedSkill === "acceptance-report";
    scenarios.push({
      id: "memory_guided_fallback",
      passed,
      summary: passed
        ? "Memory-guided fallback selects the stronger remembered workflow."
        : "Fallback selection did not follow stronger remembered workflow quality.",
      details: `suggested=${state.plannerState.suggestedSkill ?? "none"} retry=${state.plannerState.retryClass}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Keep the diagnostics workflow moving and reuse the strongest reporting workflow.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics", "acceptance-report"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Recommended procedural skills:",
        "- memory-diagnostics",
        "Procedural guidance:",
        "- Procedural workflow for planning work: primary skill memory-diagnostics: fallback chain acceptance-report: with outcome failed: failure pattern near_miss: suggested fallback acceptance-report",
        "- Procedural workflow for planning work: primary skill acceptance-report: with outcome verified: failure pattern clean_success",
      ].join("\n"),
    });
    const passed =
      state.orchestrationState.primarySkill === "acceptance-report" &&
      state.orchestrationState.rankedSkills[0] === "acceptance-report";
    scenarios.push({
      id: "verified_memory_preferred",
      passed,
      summary: passed
        ? "Verified procedural memory outranks weaker near-miss memory."
        : "Verified procedural memory did not outrank weaker near-miss memory.",
      details: `primary=${state.orchestrationState.primarySkill ?? "none"} ranked=${state.orchestrationState.rankedSkills.join(">")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the diagnostics workflow and find a viable fallback.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Validation failed again for the diagnostics workflow.",
        },
      ],
      availableSkills: ["memory-diagnostics"],
      likelySkills: ["memory-diagnostics"],
    });
    const passed =
      state.plannerState.retryClass === "escalate" &&
      state.governanceState.autonomyMode === "escalate" &&
      !state.orchestrationState.hasViableFallback;
    scenarios.push({
      id: "missing_fallback_escalation",
      passed,
      summary: passed
        ? "Missing viable fallback escalates instead of looping weak retries."
        : "Missing viable fallback did not escalate correctly.",
      details: `retry=${state.plannerState.retryClass} autonomy=${state.governanceState.autonomyMode} fallback=${state.orchestrationState.hasViableFallback}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Implement the Python migration helper and keep the docker-only deployment skill as a fallback.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Ran pytest successfully for the migration helper.",
        },
      ],
      availableSkills: ["python-migration", "docker-release"],
      likelySkills: ["python-migration"],
      availableSkillInfo: [
        { name: "python-migration", primaryEnv: "python", requiredEnv: ["python"] },
        { name: "docker-release", primaryEnv: "node", requiredEnv: ["docker"] },
      ],
    });
    const passed =
      state.orchestrationState.primarySkill === "python-migration" &&
      state.orchestrationState.prerequisiteWarnings.includes("docker-release:missing-env:docker");
    scenarios.push({
      id: "environment_prerequisite_guard",
      passed,
      summary: passed
        ? "Environment prerequisites downgrade incompatible fallback skills."
        : "Environment prerequisites failed to guard incompatible fallback skills.",
      details: `primary=${state.orchestrationState.primarySkill ?? "none"} prereqs=${state.orchestrationState.prerequisiteWarnings.join(",")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the diagnostics workflow and find a viable fallback.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Validation failed again for the diagnostics workflow.",
        },
      ],
      availableSkills: ["memory-diagnostics"],
      likelySkills: ["memory-diagnostics"],
    });
    const report = inspectAgenticExecutionObservability(state);
    const passed =
      report.escalationRequired &&
      !report.hasViableFallback &&
      report.recommendations.includes("Add or learn a viable fallback workflow before retrying.");
    scenarios.push({
      id: "observability_escalation_alignment",
      passed,
      summary: passed
        ? "Observability report matches missing-fallback escalation behavior."
        : "Observability report drifted from missing-fallback escalation behavior.",
      details: `escalation=${report.escalationRequired} fallback=${report.hasViableFallback} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow and switch to the strongest remembered reporting path if needed.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Validation failed again for the diagnostics workflow.",
        },
      ],
      availableSkills: ["memory-diagnostics", "acceptance-report", "release-checks"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "release-checks", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Recommended procedural skills:",
        "- memory-diagnostics",
        "Procedural guidance:",
        "- Procedural workflow for planning work: primary skill memory-diagnostics: with outcome failed: failure pattern near_miss",
        "- Procedural workflow for planning work: primary skill acceptance-report: with outcome verified: failure pattern clean_success",
      ].join("\n"),
    });
    const report = inspectAgenticExecutionObservability(state);
    const passed =
      report.retryClass === "skill_fallback" &&
      report.suggestedSkill === "acceptance-report" &&
      report.rankedSkills[0] === "acceptance-report";
    scenarios.push({
      id: "fallback_guidance_alignment",
      passed,
      summary: passed
        ? "Observability report preserves memory-guided fallback ordering."
        : "Observability report lost alignment with memory-guided fallback ordering.",
      details: `retry=${report.retryClass} suggested=${report.suggestedSkill ?? "none"} ranked=${report.rankedSkills.join(">")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "1. Fix the failing typecheck in src/context-engine/memory-system.ts\n2. Run typecheck validation\n3. Prepare the final handoff summary",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/context-engine/memory-system.ts"],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Ran pnpm exec tsc -p tsconfig.json --noEmit and the typecheck passed.",
          artifactRefs: ["src/context-engine/memory-system.ts"],
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary: "Typecheck fix completed successfully.",
          artifactRefs: ["src/context-engine/memory-system.ts"],
        },
      ],
    });
    const passed =
      state.taskState.planSteps.length >= 3 &&
      state.taskState.planSteps.every((step) =>
        step.kind === "handoff" ? step.status === "in_progress" : step.status === "completed",
      );
    scenarios.push({
      id: "plan_step_completion_alignment",
      passed,
      summary: passed
        ? "Completion checkpoints advance explicit plan steps into completed state."
        : "Explicit plan steps did not reflect completion-state progress.",
      details: state.taskState.planSteps
        .map((step) => `${step.kind}:${step.status}:${step.title}`)
        .join("|"),
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "1. Fix the failing diagnostics workflow\n2. Re-run validation\n3. Prepare the final report",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/agents/pi-embedded-runner/run/agentic-state.ts"],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "pnpm exec vitest failed for the diagnostics workflow.",
          artifactRefs: ["src/agents/pi-embedded-runner/run/agentic-state.ts"],
        },
      ],
    });
    const verificationStep = state.taskState.planSteps.find((step) => step.kind === "verification");
    const passed =
      verificationStep?.status === "blocked" &&
      state.taskState.planSteps.some(
        (step) => step.kind === "implementation" && step.status === "completed",
      );
    scenarios.push({
      id: "plan_step_blocking_alignment",
      passed,
      summary: passed
        ? "Verification failures block the plan without erasing implementation progress."
        : "Plan steps did not capture blocked verification state correctly.",
      details: state.taskState.planSteps
        .map((step) => `${step.kind}:${step.status}:${step.title}`)
        .join("|"),
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the diagnostics workflow, retry validation, and prepare the report.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 1,
          maxAttempts: 3,
          summary: "Recovered after a retry and resumed validation.",
        },
      ],
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Re-opened the diagnostics workflow files after retry recovery.",
        },
      ],
    });
    const verificationStep = state.taskState.planSteps.find((step) => step.kind === "verification");
    const passed = verificationStep?.status === "in_progress";
    scenarios.push({
      id: "recovered_retry_reopens_verification",
      passed,
      summary: passed
        ? "Recovered retries reopen verification work instead of leaving it idle."
        : "Recovered retries did not reopen verification work.",
      details: state.taskState.planSteps
        .map((step) => `${step.kind}:${step.status}:${step.title}`)
        .join("|"),
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "1. Finalize the diagnostics report\n2. Hand off the next validation step to the next operator",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["scripts/agentic-diagnostics-report.ts"],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Handoff prepared for the next operator with the remaining validation step.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
      ],
    });
    const report = buildAgenticHandoffReport(state);
    const handoffStep = state.taskState.planSteps.find((step) => step.kind === "handoff");
    const passed =
      handoffStep?.status === "completed" &&
      report.pendingSteps.length > 0 &&
      report.resumePrompt !== undefined;
    scenarios.push({
      id: "handoff_checkpoint_alignment",
      passed,
      summary: passed
        ? "Handoff checkpoints produce resumable operator handoff state."
        : "Handoff checkpoints did not produce a resumable handoff summary.",
      details: `${report.summary} resume=${report.resumePrompt ?? "none"}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow, then run the acceptance report and final validation in sequence.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics", "acceptance-report", "release-checks"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "release-checks", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Recommended procedural skills:",
        "- memory-diagnostics",
        "Procedural guidance:",
        "- Procedural workflow for planning work: primary skill memory-diagnostics: skill chain memory-diagnostics, acceptance-report: ranked skills acceptance-report > memory-diagnostics: multi-skill orchestration candidate",
      ].join("\n"),
    });
    const passed =
      state.orchestrationState.workflowSteps.length >= 2 &&
      state.orchestrationState.workflowSteps[0]?.skill === "memory-diagnostics" &&
      state.orchestrationState.workflowSteps[1]?.skill === "acceptance-report" &&
      state.orchestrationState.chainedWorkflow;
    scenarios.push({
      id: "memory_guided_workflow_chain",
      passed,
      summary: passed
        ? "Procedural memory can promote an explicit multi-skill workflow chain."
        : "Procedural memory did not produce the expected workflow chain.",
      details: state.orchestrationState.workflowSteps
        .map((step) => `${step.role}:${step.skill}`)
        .join("|"),
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow, then run the acceptance report and final validation in sequence.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics", "acceptance-report", "release-checks"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "release-checks", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Recommended procedural skills:",
        "- memory-diagnostics",
        "Procedural guidance:",
        "- Procedural workflow for planning work: primary skill memory-diagnostics: skill chain memory-diagnostics, acceptance-report: multi-skill orchestration candidate",
      ].join("\n"),
    });
    const record = buildProceduralExecutionRecord({
      taskState: state.taskState,
      verificationState: state.verificationState,
      plannerState: state.plannerState,
      governanceState: state.governanceState,
      orchestrationState: state.orchestrationState,
      environmentState: state.environmentState,
      failureLearningState: state.failureLearningState,
      toolSignals: [],
      diffSignals: [],
    });
    const passed =
      record.workflowSteps.length >= 2 &&
      record.workflowSteps.some(
        (step) => step.role === "supporting" || step.role === "verification",
      ) &&
      record.chainedWorkflow;
    scenarios.push({
      id: "workflow_chain_persists_to_memory",
      passed,
      summary: passed
        ? "Workflow-chain orchestration persists into procedural execution memory."
        : "Workflow-chain orchestration did not persist into procedural memory.",
      details: record.workflowSteps.map((step) => `${step.role}:${step.skill}`).join("|"),
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Extend the diagnostics reporting skill instead of creating another diagnostics-report variant.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report", "diagnostics-validation"],
      likelySkills: ["memory-diagnostics", "diagnostics-report"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "diagnostics-report", primaryEnv: "node" },
        { name: "diagnostics-validation", primaryEnv: "node" },
      ],
    });
    const passed =
      state.orchestrationState.consolidationAction !== "none" &&
      state.orchestrationState.overlappingSkills.length >= 2;
    scenarios.push({
      id: "skill_consolidation_prefers_existing",
      passed,
      summary: passed
        ? "Overlapping skills trigger an extend/generalize recommendation instead of a new fork."
        : "Overlapping skills did not trigger a consolidation recommendation.",
      details: `${state.orchestrationState.consolidationAction}:${state.orchestrationState.overlappingSkills.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Extend the diagnostics reporting skill instead of creating another diagnostics-report variant.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report", "diagnostics-validation"],
      likelySkills: ["memory-diagnostics", "diagnostics-report"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "diagnostics-report", primaryEnv: "node" },
        { name: "diagnostics-validation", primaryEnv: "node" },
      ],
    });
    const record = buildProceduralExecutionRecord({
      taskState: state.taskState,
      verificationState: state.verificationState,
      plannerState: state.plannerState,
      governanceState: state.governanceState,
      orchestrationState: state.orchestrationState,
      environmentState: state.environmentState,
      failureLearningState: state.failureLearningState,
      toolSignals: [],
      diffSignals: [],
    });
    const passed =
      record.consolidationAction !== "none" &&
      record.overlappingSkills.length >= 2 &&
      record.skillFamilies.length >= 1;
    scenarios.push({
      id: "consolidation_persists_to_memory",
      passed,
      summary: passed
        ? "Consolidation recommendations persist into procedural execution memory."
        : "Consolidation recommendations did not persist into procedural memory.",
      details: `${record.consolidationAction}:${record.overlappingSkills.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the diagnostics workflow and prepare the final operator handoff summary.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Ran pnpm exec vitest successfully for diagnostics validation.",
        },
      ],
    });
    const passed =
      state.verificationState.goalSatisfaction !== "satisfied" &&
      state.verificationState.outcome === "partial" &&
      state.verificationState.unresolvedCriteria.length > 0;
    scenarios.push({
      id: "goal_satisfaction_downgrades_verified_checks",
      passed,
      summary: passed
        ? "Passing checks alone no longer count as full success when the stated goal is still unresolved."
        : "Verified checks still overstate success when the user goal is unresolved.",
      details: `${state.verificationState.outcome}:${state.verificationState.goalSatisfaction}:${state.verificationState.unresolvedCriteria.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow, rerun validation, and prepare the final handoff summary.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 2,
          maxAttempts: 3,
          summary: "Recovered after retrying the workflow.",
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Ran diagnostics validation and produced the final handoff summary.",
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary:
            "Diagnostics workflow fixed, validation rerun, and final handoff summary prepared.",
        },
      ],
    });
    const passed =
      state.verificationState.goalSatisfaction === "satisfied" &&
      state.verificationState.outcome === "verified" &&
      state.taskState.planSteps.every((step) => step.status !== "blocked");
    scenarios.push({
      id: "long_run_recovery_reaches_goal_satisfaction",
      passed,
      summary: passed
        ? "Recovered long-run execution can converge on a fully satisfied goal state."
        : "Recovered long-run execution did not reach a fully satisfied goal state.",
      details: `${state.verificationState.outcome}:${state.verificationState.goalSatisfaction}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Extend the stable acceptance-report workflow instead of forking another verification skill.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Validated the stable acceptance-report path successfully.",
        },
      ],
      availableSkills: ["acceptance-report"],
      likelySkills: ["acceptance-report"],
      availableSkillInfo: [{ name: "acceptance-report", primaryEnv: "node" }],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill effectiveness guidance:",
        "- skill=acceptance-report family=verification task_mode=debugging workspace=project env=node validation=exec score=2.50 evidence=4",
        "Skill stability guidance:",
        "- skill=acceptance-report task_mode=debugging env=node state=stable_reuse",
      ].join("\n"),
    });
    const report = inspectAgenticExecutionObservability(state);
    const summary = formatAgenticExecutionObservabilityReport(report, "summary");
    const markdown = formatAgenticExecutionObservabilityReport(report, "markdown");
    const passed =
      state.orchestrationState.stabilityState === "stable_reuse" &&
      report.stabilityState === "stable_reuse" &&
      report.stabilitySkills.includes("acceptance-report") &&
      report.recommendations.some((recommendation) =>
        recommendation.includes("Stable reusable skills can be extended"),
      ) &&
      summary.includes("stability_state=stable_reuse") &&
      markdown.includes("Stability state: stable_reuse");
    scenarios.push({
      id: "stable_reuse_observability_alignment",
      passed,
      summary: passed
        ? "Stable-reuse skills stay visible in operator diagnostics and support explicit reuse guidance."
        : "Stable-reuse guidance did not stay aligned across orchestration and observability.",
      details: `stability=${report.stabilityState} skills=${report.stabilitySkills.join("|")} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const report = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "stable",
        effectiveSkills: ["acceptance-report@debugging/node"],
        stabilizedSkills: ["acceptance-report@debugging/node"],
      },
    });
    const summary = formatAgenticQualityGateReport(report, "summary");
    const markdown = formatAgenticQualityGateReport(report, "markdown");
    const passed =
      report.passed &&
      report.effectivenessPassed &&
      report.stabilizedSkills.includes("acceptance-report@debugging/node") &&
      report.recommendations.includes(
        "Promote stabilized scoped skills for stable reuse or extend-existing decisions.",
      ) &&
      summary.includes("stabilized_skills=acceptance-report@debugging/node") &&
      markdown.includes(
        "Promote stabilized scoped skills for stable reuse or extend-existing decisions.",
      );
    scenarios.push({
      id: "stable_reuse_promotion_alignment",
      passed,
      summary: passed
        ? "Stable scoped skills trigger explicit promotion guidance once the path is durable."
        : "Stable scoped skills did not trigger the expected promotion guidance.",
      details: `stabilized=${report.stabilizedSkills.join("|")} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Extend the diagnostics workflow that memory says is promotion-ready instead of creating another fork.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["diagnostics-repair"],
      likelySkills: ["diagnostics-repair"],
      availableSkillInfo: [{ name: "diagnostics-repair", primaryEnv: "node" }],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill stability guidance:",
        "- skill=diagnostics-repair task_mode=general env=node state=stable_reuse",
        "Skill promotion guidance:",
        "- skill=diagnostics-repair task_mode=general env=node action=promote_extend_existing",
      ].join("\n"),
    });
    const report = inspectAgenticExecutionObservability(state);
    const passed =
      state.orchestrationState.promotedSkills.includes("diagnostics-repair") &&
      state.orchestrationState.consolidationAction === "extend_existing" &&
      report.promotedSkills.includes("diagnostics-repair") &&
      report.recommendations.some((recommendation) =>
        recommendation.includes("Promotion-ready scoped skills"),
      );
    scenarios.push({
      id: "promotion_guidance_memory_alignment",
      passed,
      summary: passed
        ? "Promotion guidance from memory feeds directly into extend-existing orchestration."
        : "Promotion guidance did not flow cleanly from retrieval into orchestration.",
      details: `promoted=${report.promotedSkills.join("|")} consolidation=${state.orchestrationState.consolidationAction}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Turn the stable diagnostics workflow into a reusable template instead of creating another specialized fork.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [{ name: "memory-diagnostics", primaryEnv: "node" }],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill effectiveness guidance:",
        "- skill=memory-diagnostics family=diagnostics task_mode=general workspace=project env=node validation=exec score=3.30 evidence=3",
        "Skill family guidance:",
        "- family=diagnostics trend=stable consolidation=generalize_existing template_candidate=true primary=memory-diagnostics",
      ].join("\n"),
    });
    const report = inspectAgenticExecutionObservability(state);
    const summary = formatAgenticExecutionObservabilityReport(report, "summary");
    const markdown = formatAgenticExecutionObservabilityReport(report, "markdown");
    const passed =
      state.orchestrationState.consolidationAction === "generalize_existing" &&
      !state.orchestrationState.mergeCandidate &&
      report.recommendations.some((recommendation) =>
        recommendation.includes("Prefer generalize_existing"),
      ) &&
      summary.includes("merge_skills=none") &&
      markdown.includes("Merge candidate: no");
    scenarios.push({
      id: "template_guidance_observability_alignment",
      passed,
      summary: passed
        ? "Template-ready family guidance stays distinct from merge guidance in observability."
        : "Template-ready generalization did not remain distinct from merge guidance.",
      details: `consolidation=${report.consolidationAction} merge=${report.mergeCandidate} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Merge the overlapping diagnostics sibling workflows into one reusable path instead of keeping both forks.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report", "diagnostics-validation"],
      likelySkills: ["memory-diagnostics", "diagnostics-report"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "diagnostics-report", primaryEnv: "node" },
        { name: "diagnostics-validation", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill family guidance:",
        "- family=diagnostics trend=stable consolidation=generalize_existing merge_candidate=true merge_skills=memory-diagnostics,diagnostics-report primary=memory-diagnostics",
      ].join("\n"),
    });
    const report = inspectAgenticExecutionObservability(state);
    const summary = formatAgenticExecutionObservabilityReport(report, "summary");
    const markdown = formatAgenticExecutionObservabilityReport(report, "markdown");
    const passed =
      state.orchestrationState.consolidationAction === "generalize_existing" &&
      state.orchestrationState.mergeCandidate &&
      report.mergeSkills.length >= 2 &&
      report.mergeSkills.includes("memory-diagnostics") &&
      report.mergeSkills.includes("diagnostics-report") &&
      report.recommendations.some((recommendation) =>
        recommendation.includes("Merge overlapping sibling skills"),
      ) &&
      summary.includes("merge_skills=") &&
      markdown.includes("Merge candidate: yes");
    scenarios.push({
      id: "merge_guidance_observability_alignment",
      passed,
      summary: passed
        ? "Merge-ready family guidance stays visible as a distinct operator recommendation."
        : "Merge-ready family guidance did not stay visible through observability.",
      details: `consolidation=${report.consolidationAction} merge=${report.mergeSkills.join("|")} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const diagnostics = inspectAgenticExecutionObservability(
      buildAgenticExecutionState({
        messages: [
          {
            role: "user",
            content:
              "Reuse the durable diagnostics family guidance and turn the stable path into a reusable template.",
            timestamp: Date.now(),
          } as AgentMessage,
        ],
        availableSkills: ["memory-diagnostics"],
        likelySkills: ["memory-diagnostics"],
        availableSkillInfo: [{ name: "memory-diagnostics", primaryEnv: "node" }],
        memorySystemPromptAddition: [
          "Integrated memory packet",
          "Skill family guidance:",
          "- family=diagnostics task_mode=debugging env=node trend=stable consolidation=generalize_existing template_candidate=true durable=true",
        ].join("\n"),
      }),
    );
    const report = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      diagnosticsOverride: diagnostics,
      memoryTrend: {
        trend: "stable",
        templateFamilies: ["diagnostics@debugging/node"],
      },
    });
    const passed =
      report.passed &&
      report.templateFamilies.includes("diagnostics@debugging/node") &&
      report.diagnostics.consolidationAction === "generalize_existing" &&
      !report.diagnostics.mergeCandidate &&
      report.recommendations.includes(
        "Memory-backed template-ready families: diagnostics@debugging/node.",
      ) &&
      report.recommendations.includes(
        "Template-ready consolidation is active; parameterize the stable workflow instead of creating a new fork.",
      );
    scenarios.push({
      id: "durable_template_family_quality_alignment",
      passed,
      summary: passed
        ? "Durable template-ready family trends stay visible from retrieval through the release-facing quality gate."
        : "Durable template-ready family trends did not stay visible through the quality gate.",
      details: `template_families=${report.templateFamilies.join("|")} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const diagnostics = inspectAgenticExecutionObservability(
      buildAgenticExecutionState({
        messages: [
          {
            role: "user",
            content:
              "Use the durable diagnostics overlap evidence to merge the sibling workflows instead of keeping forks alive.",
            timestamp: Date.now(),
          } as AgentMessage,
        ],
        availableSkills: ["memory-diagnostics", "diagnostics-report", "diagnostics-validation"],
        likelySkills: ["memory-diagnostics", "diagnostics-report"],
        availableSkillInfo: [
          { name: "memory-diagnostics", primaryEnv: "node" },
          { name: "diagnostics-report", primaryEnv: "node" },
          { name: "diagnostics-validation", primaryEnv: "node" },
        ],
        memorySystemPromptAddition: [
          "Integrated memory packet",
          "Skill family guidance:",
          "- family=diagnostics task_mode=debugging env=node trend=stable consolidation=generalize_existing merge_candidate=true merge_skills=memory-diagnostics,diagnostics-report durable=true",
        ].join("\n"),
      }),
    );
    const report = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      diagnosticsOverride: diagnostics,
      memoryTrend: {
        trend: "stable",
        mergeFamilies: ["diagnostics@debugging/node"],
      },
    });
    const passed =
      report.passed &&
      report.mergeFamilies.includes("diagnostics@debugging/node") &&
      report.diagnostics.mergeCandidate &&
      report.diagnostics.mergeSkills.includes("memory-diagnostics") &&
      report.diagnostics.mergeSkills.includes("diagnostics-report") &&
      report.recommendations.includes(
        "Memory-backed merge-ready families: diagnostics@debugging/node.",
      ) &&
      report.recommendations.some((recommendation) =>
        recommendation.includes("Merge-ready consolidation is active for sibling skills"),
      );
    scenarios.push({
      id: "durable_merge_family_quality_alignment",
      passed,
      summary: passed
        ? "Durable merge-ready family trends stay visible from retrieval through the release-facing quality gate."
        : "Durable merge-ready family trends did not stay visible through the quality gate.",
      details: `merge_families=${report.mergeFamilies.join("|")} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow and switch to the strongest sibling path if the current one keeps failing.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Diagnostics validation failed again for the current path.",
        },
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report", "acceptance-report"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "diagnostics-report", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill family guidance:",
        "- family=diagnostics task_mode=debugging env=node trend=stable consolidation=generalize_existing merge_candidate=true merge_skills=memory-diagnostics,diagnostics-report durable=true",
      ].join("\n"),
    });
    const passed =
      state.plannerState.retryClass === "skill_fallback" &&
      state.plannerState.suggestedSkill === "diagnostics-report" &&
      state.plannerState.rationale?.includes("merge-family-guidance") === true &&
      state.orchestrationState.primarySkill === "diagnostics-report" &&
      state.orchestrationState.mergeCandidate;
    scenarios.push({
      id: "durable_merge_family_fallback_alignment",
      passed,
      summary: passed
        ? "Durable merge-ready family guidance promotes sibling fallback selection during replanning."
        : "Durable merge-ready family guidance did not steer fallback replanning correctly.",
      details: `retry=${state.plannerState.retryClass} suggested=${state.plannerState.suggestedSkill ?? "none"} primary=${state.orchestrationState.primarySkill ?? "none"}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the diagnostics workflow without creating another specialized fork.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Diagnostics validation failed again for the current implementation.",
        },
      ],
      availableSkills: ["memory-diagnostics"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [{ name: "memory-diagnostics", primaryEnv: "node" }],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill family guidance:",
        "- family=diagnostics task_mode=debugging env=node trend=stable consolidation=generalize_existing template_candidate=true durable=true",
      ].join("\n"),
    });
    const passed =
      state.plannerState.retryClass === "same_path_retry" &&
      !state.plannerState.shouldEscalate &&
      state.plannerState.rationale?.includes("template-family-guidance") === true &&
      state.plannerState.nextAction?.includes(
        "Reuse and parameterize the stable diagnostics workflow",
      ) === true &&
      state.orchestrationState.primarySkill === "memory-diagnostics" &&
      state.orchestrationState.consolidationAction === "generalize_existing";
    scenarios.push({
      id: "durable_template_family_replan_alignment",
      passed,
      summary: passed
        ? "Durable template-ready family guidance keeps replanning inside the stable family instead of escalating into a new fork."
        : "Durable template-ready family guidance did not preserve stable-family replanning.",
      details: `retry=${state.plannerState.retryClass} escalate=${state.plannerState.shouldEscalate} next=${state.plannerState.nextAction ?? "none"}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow and use repeated failed sibling evidence to choose the strongest same-family fallback.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Diagnostics validation failed again for the current path.",
        },
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "diagnostics-report", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill family guidance:",
        "- family=diagnostics task_mode=debugging env=node trend=stable consolidation=generalize_existing merge_candidate=true merge_skills=diagnostics-report,memory-diagnostics durable=true",
      ].join("\n"),
    });
    const report = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(state),
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "watch",
        mergeFamilies: ["diagnostics@debugging/node"],
      },
    });
    const passed =
      state.plannerState.suggestedSkill === "diagnostics-report" &&
      state.orchestrationState.primarySkill === "diagnostics-report" &&
      state.orchestrationState.mergeCandidate &&
      report.recommendations.includes(
        "Memory-backed merge-ready families: diagnostics@debugging/node.",
      );
    scenarios.push({
      id: "failure_derived_merge_family_alignment",
      passed,
      summary: passed
        ? "Failure-derived merge family guidance can shift later replanning onto a sibling fallback."
        : "Failure-derived merge family guidance did not steer later replanning cleanly.",
      details: `suggested=${state.plannerState.suggestedSkill ?? "none"} primary=${state.orchestrationState.primarySkill ?? "none"} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the acceptance workflow without creating another specialized fork after the last near-miss.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Acceptance workflow validation nearly worked but still needs refinement.",
        },
      ],
      availableSkills: ["acceptance-report"],
      likelySkills: ["acceptance-report"],
      availableSkillInfo: [{ name: "acceptance-report", primaryEnv: "node" }],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill family guidance:",
        "- family=verification task_mode=debugging env=node trend=stable consolidation=generalize_existing template_candidate=true durable=true",
      ].join("\n"),
    });
    const report = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(state),
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "watch",
        templateFamilies: ["verification@debugging/node"],
      },
    });
    const passed =
      !state.plannerState.shouldEscalate &&
      state.orchestrationState.primarySkill === "acceptance-report" &&
      state.orchestrationState.consolidationAction === "generalize_existing" &&
      report.recommendations.includes(
        "Memory-backed template-ready families: verification@debugging/node.",
      );
    scenarios.push({
      id: "failure_derived_template_family_alignment",
      passed,
      summary: passed
        ? "Failure-derived template family guidance can keep replanning inside the stable workflow family."
        : "Failure-derived template family guidance did not preserve stable-family replanning.",
      details: `retry=${state.plannerState.retryClass} escalate=${state.plannerState.shouldEscalate} recommendations=${report.recommendations.join("|")}`,
    });
  }

  {
    const mergeDiagnostics = inspectAgenticExecutionObservability(
      buildAgenticExecutionState({
        messages: [
          {
            role: "user",
            content:
              "Use repeated failed diagnostics overlap evidence to choose the strongest sibling path and keep release guidance aligned.",
            timestamp: Date.now(),
          } as AgentMessage,
        ],
        toolSignals: [
          {
            toolName: "exec",
            status: "error",
            summary: "Diagnostics validation failed again for the current path.",
          },
        ],
        availableSkills: ["memory-diagnostics", "diagnostics-report"],
        likelySkills: ["memory-diagnostics"],
        availableSkillInfo: [
          { name: "memory-diagnostics", primaryEnv: "node" },
          { name: "diagnostics-report", primaryEnv: "node" },
        ],
        memorySystemPromptAddition: [
          "Integrated memory packet",
          "Skill family guidance:",
          "- family=diagnostics task_mode=debugging env=node trend=stable consolidation=generalize_existing merge_candidate=true merge_skills=diagnostics-report,memory-diagnostics durable=true",
        ].join("\n"),
      }),
    );
    const mergeReport = runAgenticQualityGate({
      diagnosticsOverride: mergeDiagnostics,
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "watch",
        mergeFamilies: ["diagnostics@debugging/node"],
      },
    });
    const templateDiagnostics = inspectAgenticExecutionObservability(
      buildAgenticExecutionState({
        messages: [
          {
            role: "user",
            content:
              "Use repeated failed acceptance near-miss evidence to stay inside the stable reporting workflow family.",
            timestamp: Date.now(),
          } as AgentMessage,
        ],
        toolSignals: [
          {
            toolName: "exec",
            status: "error",
            summary: "Acceptance workflow validation nearly worked but still needs refinement.",
          },
        ],
        availableSkills: ["acceptance-report"],
        likelySkills: ["acceptance-report"],
        availableSkillInfo: [{ name: "acceptance-report", primaryEnv: "node" }],
        memorySystemPromptAddition: [
          "Integrated memory packet",
          "Skill family guidance:",
          "- family=verification task_mode=debugging env=node trend=stable consolidation=generalize_existing template_candidate=true durable=true",
        ].join("\n"),
      }),
    );
    const templateReport = runAgenticQualityGate({
      diagnosticsOverride: templateDiagnostics,
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "watch",
        templateFamilies: ["verification@debugging/node"],
      },
    });
    const passed =
      mergeReport.recommendations.includes(
        "Memory-backed merge-ready families: diagnostics@debugging/node.",
      ) &&
      mergeReport.recommendations.some((recommendation) =>
        recommendation.includes("Merge-ready consolidation is active for sibling skills"),
      ) &&
      templateReport.recommendations.includes(
        "Memory-backed template-ready families: verification@debugging/node.",
      ) &&
      templateReport.recommendations.includes(
        "Template-ready consolidation is active; parameterize the stable workflow instead of creating a new fork.",
      );
    scenarios.push({
      id: "failure_derived_quality_gate_alignment",
      passed,
      summary: passed
        ? "Failure-derived family trends stay aligned with release-facing quality gate recommendations."
        : "Failure-derived family trends drifted before reaching the quality gate.",
      details: `merge=${mergeReport.recommendations.join("|")} template=${templateReport.recommendations.join("|")}`,
    });
  }

  {
    const protectedBranchState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the release-branch diagnostics regression in src/diagnostics/report.ts and keep the deployment safe.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/report.ts"],
      workspaceTags: ["workspace", "git-worktree"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "release/diagnostics-fix",
      },
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the diagnostics implementation and release checklist.",
        },
      ],
    });
    const passed =
      protectedBranchState.governanceState.approvalRequired &&
      protectedBranchState.governanceState.autonomyMode === "approval_required" &&
      protectedBranchState.governanceState.riskLevel === "high" &&
      protectedBranchState.governanceState.reasons.includes("protected_branch_change_guard") &&
      (protectedBranchState.plannerState.nextAction ?? "").includes(
        "Respect branch convention: release_branch",
      );
    scenarios.push({
      id: "protected_branch_governance_alignment",
      passed,
      summary: passed
        ? "Protected branch mutation work now requires approval and branch-aware guidance."
        : "Protected branch mutation work did not trigger the expected governance boundary.",
      details: `autonomy=${protectedBranchState.governanceState.autonomyMode} reasons=${protectedBranchState.governanceState.reasons.join("|")} next=${protectedBranchState.plannerState.nextAction ?? "none"}`,
    });
  }

  {
    const protectedRetryState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the release-branch diagnostics regression without repeating the failing path.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/report.ts"],
      workspaceTags: ["workspace", "git-worktree"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "release/diagnostics-fix",
      },
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Diagnostics validation failed again for the current path.",
        },
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 1,
          maxAttempts: 4,
          summary: "Recovered after the first retry.",
        },
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report"],
      likelySkills: ["memory-diagnostics"],
    });
    const validationThinState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Implement the diagnostics formatter changes in src/diagnostics/formatter.ts.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/formatter.ts"],
      workspaceTags: ["workspace"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "feature/formatter-update",
      },
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the formatter implementation and current diagnostics output.",
        },
      ],
    });
    const passed =
      protectedRetryState.plannerState.retryClass === "skill_fallback" &&
      protectedRetryState.plannerState.suggestedSkill === "diagnostics-report" &&
      protectedRetryState.plannerState.remainingRetryBudget === 1 &&
      (protectedRetryState.plannerState.nextAction ?? "").includes(
        "Avoid repeated same-path retries on protected branches",
      ) &&
      validationThinState.plannerState.retryClass === "clarify" &&
      validationThinState.plannerState.remainingRetryBudget === 1 &&
      (validationThinState.plannerState.nextAction ?? "").includes(
        "Establish an observed validation command before retrying project changes.",
      );
    scenarios.push({
      id: "environment_guard_retry_alignment",
      passed,
      summary: passed
        ? "Environment guards now constrain replanning with protected-branch fallback bias and validation-context throttling."
        : "Environment guards did not correctly constrain retry and replanning behavior.",
      details: `protected=${protectedRetryState.plannerState.retryClass}/${protectedRetryState.plannerState.suggestedSkill ?? "none"}/${protectedRetryState.plannerState.remainingRetryBudget ?? -1} validation=${validationThinState.plannerState.retryClass}/${validationThinState.plannerState.remainingRetryBudget ?? -1}`,
    });
  }

  {
    const protectedBranchState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the release-branch diagnostics regression in src/diagnostics/report.ts and hand off safely if approval is needed.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/report.ts"],
      workspaceTags: ["workspace", "git-worktree"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "release/diagnostics-fix",
      },
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the diagnostics implementation and release checklist.",
        },
      ],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a guarded handoff for release-branch approval.",
          artifactRefs: ["src/diagnostics/report.ts"],
        },
      ],
    });
    const protectedHandoff = buildAgenticHandoffReport(protectedBranchState);
    const validationThinState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Implement the diagnostics formatter changes and pause until the validation command is known.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/formatter.ts"],
      workspaceTags: ["workspace"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "feature/formatter-update",
      },
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the formatter implementation and current diagnostics output.",
        },
      ],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a guarded handoff while validation setup remains incomplete.",
          artifactRefs: ["src/diagnostics/formatter.ts"],
        },
      ],
    });
    const validationThinHandoff = buildAgenticHandoffReport(validationThinState);
    const passed =
      protectedHandoff.operatorMode === "approval_required" &&
      (protectedHandoff.resumeCondition ?? "").includes("Wait for operator approval") &&
      (protectedHandoff.resumePrompt ?? "").includes("Resume after approval") &&
      validationThinHandoff.operatorMode === "pause" &&
      (validationThinHandoff.resumeCondition ?? "").includes(
        "Capture an observed validation command",
      ) &&
      (validationThinHandoff.resumePrompt ?? "").includes(
        "Resume after prerequisites are restored",
      );
    scenarios.push({
      id: "guarded_handoff_alignment",
      passed,
      summary: passed
        ? "Guarded work now produces operator-aware handoffs instead of generic resume prompts."
        : "Guarded handoff output did not align with approval and validation pause boundaries.",
      details: `protected=${protectedHandoff.operatorMode}/${protectedHandoff.resumeCondition ?? "none"} validation=${validationThinHandoff.operatorMode}/${validationThinHandoff.resumeCondition ?? "none"}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Finalize the diagnostics report, keep the current assumptions visible, and leave the last validation step for the next operator.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["scripts/agentic-diagnostics-report.ts"],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a concise operator handoff for the remaining validation step.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
      ],
    });
    const observability = inspectAgenticExecutionObservability(state);
    const handoff = buildAgenticHandoffReport(state);
    const passed =
      observability.progressSummary.includes("completed=") &&
      observability.assumptions.length > 0 &&
      formatAgenticExecutionObservabilityReport(observability, "summary").includes("progress=") &&
      formatAgenticExecutionObservabilityReport(observability, "summary").includes(
        "assumptions=",
      ) &&
      handoff.progressSummary.includes("pending=") &&
      handoff.assumptions.length > 0 &&
      formatAgenticHandoffReport(handoff, "summary").includes("progress=");
    scenarios.push({
      id: "concise_progress_alignment",
      passed,
      summary: passed
        ? "Operator-facing reports now keep concise progress and assumptions visible for resume."
        : "Concise progress or assumption surfacing drifted out of operator-facing reports.",
      details: `progress=${observability.progressSummary} handoff=${handoff.progressSummary}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the build once the missing config file is available.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required config file: config/runtime.json",
        },
      ],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a handoff until the missing config file is restored.",
        },
      ],
    });
    const observability = inspectAgenticExecutionObservability(state);
    const handoff = buildAgenticHandoffReport(state);
    const passed =
      state.plannerState.retryClass === "clarify" &&
      (observability.clarificationSummary ?? "").includes("config/runtime.json") &&
      (handoff.clarificationSummary ?? "").includes("config/runtime.json") &&
      formatAgenticExecutionObservabilityReport(observability, "summary").includes(
        "clarification=Need clarification on:",
      ) &&
      formatAgenticHandoffReport(handoff, "summary").includes(
        "clarification=Need clarification on:",
      );
    scenarios.push({
      id: "clarification_alignment",
      passed,
      summary: passed
        ? "Missing-information retries now surface a concrete clarification payload for operators."
        : "Clarification payloads did not stay concrete for missing-information retries.",
      details: `clarification=${observability.clarificationSummary ?? "none"} handoff=${handoff.clarificationSummary ?? "none"}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Repair the release notes generation flow and keep moving.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Ran pnpm exec vitest --run release-notes validation.",
        },
        {
          toolName: "template-generator",
          status: "error",
          summary: "Missing required template variable: releaseNotesTitle",
        },
      ],
      availableSkills: ["release-notes-generator", "release-notes-template-fallback"],
      likelySkills: ["release-notes-generator"],
    });
    const observability = inspectAgenticExecutionObservability(state);
    const passed =
      state.verificationState.outcome === "failed" &&
      state.verificationState.failureClasses.includes("missing_information") &&
      state.plannerState.retryClass === "skill_fallback" &&
      state.plannerState.suggestedSkill === "release-notes-template-fallback" &&
      observability.clarificationSummary === undefined;
    scenarios.push({
      id: "nonblocking_missing_information_alignment",
      passed,
      summary: passed
        ? "Non-blocking missing-information failures now prefer fallback or replanning over premature clarification."
        : "Non-blocking missing-information failures still over-trigger clarification.",
      details: `outcome=${state.verificationState.outcome} retry=${state.plannerState.retryClass} suggested=${state.plannerState.suggestedSkill ?? "none"} clarification=${observability.clarificationSummary ?? "none"}`,
    });
  }

  {
    const envVarState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Run the deployment smoke test after the required environment variable is available.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required environment variable: OPENAI_API_KEY",
        },
      ],
    });
    const approvalState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Deploy the production hotfix once the release approval is granted.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Approval required: production deployment",
        },
      ],
    });
    const envVarObservability = inspectAgenticExecutionObservability(envVarState);
    const approvalObservability = inspectAgenticExecutionObservability(approvalState);
    const passed =
      envVarState.plannerState.retryClass === "clarify" &&
      approvalState.plannerState.retryClass === "clarify" &&
      envVarObservability.clarificationSummary ===
        "Need clarification on: environment variable OPENAI_API_KEY" &&
      approvalObservability.clarificationSummary ===
        "Need clarification on: operator approval for production deployment";
    scenarios.push({
      id: "clarification_payload_alignment",
      passed,
      summary: passed
        ? "Clarification payloads stay concrete for environment variables and approval-gated work."
        : "Clarification payloads drifted for environment variables or approval-gated work.",
      details: `env=${envVarObservability.clarificationSummary ?? "none"} approval=${approvalObservability.clarificationSummary ?? "none"}`,
    });
  }

  {
    const envVarState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Run the deployment smoke test after the required environment variable is available.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required environment variable: OPENAI_API_KEY",
        },
      ],
    });
    const approvalState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Deploy the production hotfix once the release approval is granted.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Approval required: production deployment",
        },
      ],
    });
    const externalInputState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Continue the import after the customer input is provided.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Awaiting external input: customer CSV export",
        },
      ],
    });
    const envVarHandoff = buildAgenticHandoffReport(envVarState);
    const approvalHandoff = buildAgenticHandoffReport(approvalState);
    const externalInputHandoff = buildAgenticHandoffReport(externalInputState);
    const passed =
      (envVarState.plannerState.nextAction ?? "").includes(
        "Configure the missing environment variable before retrying.",
      ) &&
      (envVarHandoff.resumeCondition ?? "").includes(
        "Configure the missing environment variable before resuming.",
      ) &&
      (approvalState.plannerState.nextAction ?? "").includes(
        "Obtain the required approval before retrying.",
      ) &&
      (approvalHandoff.resumeCondition ?? "").includes(
        "Obtain the required approval before resuming.",
      ) &&
      (externalInputState.plannerState.nextAction ?? "").includes(
        "Request the missing external input before retrying.",
      ) &&
      (externalInputHandoff.resumeCondition ?? "").includes(
        "Provide the missing external input before resuming.",
      );
    scenarios.push({
      id: "clarification_strategy_alignment",
      passed,
      summary: passed
        ? "Clarification blocker subtypes now drive subtype-specific retry and resume guidance."
        : "Clarification retry and resume guidance stayed too generic for blocker subtypes.",
      details: `env=${envVarState.plannerState.nextAction ?? "none"} approval=${approvalState.plannerState.nextAction ?? "none"} external=${externalInputState.plannerState.nextAction ?? "none"}`,
    });
  }

  {
    const report = runAgenticQualityGate({
      failOnWeakeningSkills: true,
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "watch",
        effectiveSkills: ["acceptance-report@debugging/node"],
        weakeningSkills: ["diagnostics-repair@debugging/node"],
      },
    });
    const summary = formatAgenticQualityGateReport(report, "summary");
    const markdown = formatAgenticQualityGateReport(report, "markdown");
    const passed =
      !report.passed &&
      !report.effectivenessPassed &&
      report.failReasons.includes("weakening_scoped_skills") &&
      summary.includes("effectiveness=fail") &&
      markdown.includes("## Effectiveness");
    scenarios.push({
      id: "weakening_skills_quality_gate",
      passed,
      summary: passed
        ? "Weakening scoped skills can fail the quality gate and surface in operator-facing output."
        : "Weakening scoped skills did not flow through the quality gate correctly.",
      details: `failReasons=${report.failReasons.join("|")} weakening=${report.weakeningSkills.join("|")}`,
    });
  }

  {
    const state = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow and prefer the most stable reusable path while the recovered diagnostics route is still under watch.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["diagnostics-repair", "acceptance-report"],
      likelySkills: ["diagnostics-repair"],
      availableSkillInfo: [
        { name: "diagnostics-repair", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill effectiveness guidance:",
        "- skill=diagnostics-repair family=diagnostics task_mode=debugging workspace=project env=node validation=exec score=2.20 evidence=3",
        "- skill=acceptance-report family=verification task_mode=debugging workspace=project env=node validation=exec score=2.40 evidence=3",
        "Skill recovery guidance:",
        "- skill=diagnostics-repair task_mode=debugging env=node state=recovered_watch",
      ].join("\n"),
    });
    const report = runAgenticQualityGate({
      failOnRecoveringSkills: true,
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "watch",
        effectiveSkills: ["acceptance-report@debugging/node"],
        recoveringSkills: ["diagnostics-repair@debugging/node"],
      },
    });
    const passed =
      state.orchestrationState.primarySkill === "acceptance-report" &&
      state.orchestrationState.rankedSkills[0] === "acceptance-report" &&
      !report.passed &&
      !report.effectivenessPassed &&
      report.failReasons.includes("recovering_scoped_skills") &&
      report.recoveringSkills.includes("diagnostics-repair@debugging/node");
    scenarios.push({
      id: "recovering_skills_guidance_alignment",
      passed,
      summary: passed
        ? "Recovered-watch skills steer planning toward the stable sibling and can still fail the quality gate."
        : "Recovered-watch guidance did not align planning and quality-gate behavior.",
      details: `primary=${state.orchestrationState.primarySkill} failReasons=${report.failReasons.join("|")} recovering=${report.recoveringSkills.join("|")}`,
    });
  }

  const failedScenarioIds = scenarios
    .filter((scenario) => !scenario.passed)
    .map((scenario) => scenario.id);
  const passedScenarios = scenarios.length - failedScenarioIds.length;
  const passed = failedScenarioIds.length === 0;
  return {
    passed,
    totalScenarios: scenarios.length,
    passedScenarios,
    failedScenarioIds,
    scenarios,
    summary: `agentic acceptance ${passedScenarios}/${scenarios.length} passed`,
  };
}

export function formatAgenticAcceptanceReport(
  report: AgenticAcceptanceReport,
  format: "json" | "summary" | "markdown" = "json",
): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "summary") {
    const lines = [
      report.summary,
      ...report.scenarios.map(
        (scenario) => `${scenario.passed ? "PASS" : "FAIL"} ${scenario.id}: ${scenario.summary}`,
      ),
    ];
    return `${lines.join("\n")}\n`;
  }
  const lines = [
    "# Agentic Acceptance Report",
    "",
    `- Summary: ${report.summary}`,
    `- Passed: ${report.passed ? "yes" : "no"}`,
    "",
    ...report.scenarios.map(
      (scenario) =>
        `- ${scenario.passed ? "PASS" : "FAIL"} \`${scenario.id}\`: ${scenario.summary}${scenario.details ? ` (${scenario.details})` : ""}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function buildSoakPhaseResult(params: {
  label: string;
  state: AgenticExecutionState;
  passed: boolean;
  details?: string;
}): AgenticSoakPhaseResult {
  const handoffReport = buildAgenticHandoffReport(params.state);
  return {
    label: params.label,
    passed: params.passed,
    outcome: params.state.verificationState.outcome,
    goalSatisfaction: params.state.verificationState.goalSatisfaction,
    retryClass: params.state.plannerState.retryClass,
    autonomyMode: params.state.governanceState.autonomyMode,
    primarySkill: params.state.orchestrationState.primarySkill,
    planStepSummary: params.state.taskState.planSteps.map(
      (step) => `${step.kind}:${step.status}:${step.title}`,
    ),
    pendingHandoffSteps: handoffReport.pendingSteps.length,
    details: params.details,
  };
}

export function runAgenticSoakSuite(): AgenticSoakReport {
  const scenarios: AgenticSoakScenarioResult[] = [];

  {
    const failureState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow, switch to the strongest fallback if validation keeps failing, rerun validation, and prepare the final handoff summary.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Validation failed again for the diagnostics workflow.",
        },
      ],
      availableSkills: ["memory-diagnostics", "acceptance-report", "release-checks"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "release-checks", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Recommended procedural skills:",
        "- memory-diagnostics",
        "Procedural guidance:",
        "- Procedural workflow for planning work: primary skill memory-diagnostics: with outcome failed: failure pattern near_miss",
        "- Procedural workflow for planning work: primary skill acceptance-report: with outcome verified: failure pattern clean_success",
      ].join("\n"),
    });
    const recoveryState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow, switch to the strongest fallback if validation keeps failing, rerun validation, and prepare the final handoff summary.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 2,
          maxAttempts: 3,
          summary: "Recovered after switching to the remembered fallback workflow.",
        },
      ],
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary:
            "Reviewed the diagnostics workflow and acceptance-report fallback after recovery.",
        },
      ],
      availableSkills: ["memory-diagnostics", "acceptance-report", "release-checks"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "release-checks", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Recommended procedural skills:",
        "- acceptance-report",
        "Procedural guidance:",
        "- Procedural workflow for planning work: primary skill memory-diagnostics: with outcome failed: failure pattern near_miss",
        "- Procedural workflow for planning work: primary skill acceptance-report: with outcome verified: failure pattern clean_success",
      ].join("\n"),
    });
    const completionState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow, switch to the strongest fallback if validation keeps failing, rerun validation, and prepare the final handoff summary.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 2,
          maxAttempts: 3,
          summary: "Recovered after switching to the remembered fallback workflow.",
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Ran diagnostics validation through the acceptance-report workflow and passed.",
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary:
            "Diagnostics workflow fixed, fallback workflow applied, validation rerun, and final handoff summary prepared.",
        },
        {
          kind: "handoff",
          summary:
            "Operator handoff prepared with the completed validation outcome and next-step note.",
        },
      ],
      availableSkills: ["memory-diagnostics", "acceptance-report", "release-checks"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "release-checks", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Recommended procedural skills:",
        "- acceptance-report",
        "Procedural guidance:",
        "- Procedural workflow for planning work: primary skill memory-diagnostics: with outcome failed: failure pattern near_miss",
        "- Procedural workflow for planning work: primary skill acceptance-report: with outcome verified: failure pattern clean_success",
      ].join("\n"),
    });

    const phases = [
      buildSoakPhaseResult({
        label: "initial_failure",
        state: failureState,
        passed:
          failureState.plannerState.retryClass === "skill_fallback" &&
          failureState.taskState.planSteps.some(
            (step) => step.kind === "verification" && step.status === "blocked",
          ) &&
          failureState.orchestrationState.primarySkill === "acceptance-report",
        details: "initial failure should block verification and promote a stronger fallback",
      }),
      buildSoakPhaseResult({
        label: "recovery_replan",
        state: recoveryState,
        passed:
          recoveryState.plannerState.retryClass === "skill_fallback" &&
          recoveryState.taskState.planSteps.some(
            (step) => step.kind === "verification" && step.status === "in_progress",
          ) &&
          recoveryState.governanceState.autonomyMode === "fallback",
        details: "recovered retry should reopen verification work under fallback autonomy",
      }),
      buildSoakPhaseResult({
        label: "completion",
        state: completionState,
        passed:
          completionState.verificationState.outcome === "verified" &&
          completionState.verificationState.goalSatisfaction === "satisfied" &&
          completionState.taskState.planSteps.every((step) => step.status !== "blocked"),
        details: "completion should reach verified, satisfied state with no blocked steps",
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "retry_replan_recover_complete",
      passed,
      summary: passed
        ? "A long-running retry path can fail, replan through fallback, and still complete cleanly."
        : "Retry, replan, and completion drifted across the long-running fallback lifecycle.",
      phases,
      details: phases
        .map(
          (phase) =>
            `${phase.label}:${phase.outcome}:${phase.goalSatisfaction}:${phase.retryClass}`,
        )
        .join("|"),
    });
  }

  {
    const handoffState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Finalize the diagnostics report, leave the validation rerun for the next operator, and hand off the remaining work clearly.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["scripts/agentic-diagnostics-report.ts"],
      checkpointSignals: [
        {
          kind: "handoff",
          summary:
            "Diagnostics report finalized and handoff prepared for the remaining validation rerun.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
      ],
    });
    const resumedState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Finalize the diagnostics report, leave the validation rerun for the next operator, and hand off the remaining work clearly.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 1,
          maxAttempts: 2,
          summary: "Resumed from the prior handoff and continued the remaining validation step.",
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Reran diagnostics validation successfully and updated the report handoff.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary:
            "Diagnostics report finalized, validation rerun completed, and the handoff package updated.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
        {
          kind: "handoff",
          summary: "Final operator handoff refreshed after the completed validation rerun.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
      ],
      activeArtifacts: ["scripts/agentic-diagnostics-report.ts"],
    });

    const initialHandoff = buildAgenticHandoffReport(handoffState);
    const resumedHandoff = buildAgenticHandoffReport(resumedState);
    const phases = [
      buildSoakPhaseResult({
        label: "initial_handoff",
        state: handoffState,
        passed:
          initialHandoff.pendingSteps.length > 0 &&
          initialHandoff.resumePrompt !== undefined &&
          handoffState.taskState.planSteps.some(
            (step) => step.kind === "handoff" && step.status === "completed",
          ),
        details: "handoff should preserve pending work and a resumable prompt",
      }),
      buildSoakPhaseResult({
        label: "resumed_completion",
        state: resumedState,
        passed:
          resumedState.verificationState.outcome === "verified" &&
          resumedState.verificationState.goalSatisfaction === "satisfied" &&
          resumedHandoff.pendingSteps.length === 0,
        details: "resumed execution should consume the pending handoff work and finish cleanly",
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "handoff_resume_completion",
      passed,
      summary: passed
        ? "Handoff state can be resumed and driven to a verified, satisfied completion."
        : "Handoff-to-resume lifecycle did not converge on a clean completion state.",
      phases,
      details: phases
        .map(
          (phase) =>
            `${phase.label}:${phase.pendingHandoffSteps}:${phase.outcome}:${phase.goalSatisfaction}`,
        )
        .join("|"),
    });
  }

  {
    const driftState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Keep the diagnostics workflow healthy and avoid promoting weakening scoped paths.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["acceptance-report", "diagnostics-repair"],
      likelySkills: ["acceptance-report"],
      availableSkillInfo: [
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "diagnostics-repair", primaryEnv: "node" },
      ],
    });
    const driftGate = runAgenticQualityGate({
      failOnWeakeningSkills: true,
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "watch",
        effectiveSkills: ["acceptance-report@debugging/node"],
        weakeningSkills: ["diagnostics-repair@debugging/node"],
      },
    });
    const recoveredState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Keep the diagnostics workflow healthy and avoid promoting weakening scoped paths.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["acceptance-report", "diagnostics-repair"],
      likelySkills: ["acceptance-report"],
      availableSkillInfo: [
        { name: "acceptance-report", primaryEnv: "node" },
        { name: "diagnostics-repair", primaryEnv: "node" },
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 1,
          maxAttempts: 2,
          summary: "Recovered after moving back to the stronger scoped workflow.",
        },
      ],
    });
    const recoveredGate = runAgenticQualityGate({
      failOnWeakeningSkills: true,
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "stable",
        effectiveSkills: ["acceptance-report@debugging/node"],
        weakeningSkills: [],
      },
    });
    const phases = [
      buildSoakPhaseResult({
        label: "effectiveness_drift",
        state: driftState,
        passed:
          !driftGate.passed &&
          driftGate.failReasons.includes("weakening_scoped_skills") &&
          driftGate.weakeningSkills.length > 0,
        details: `quality_gate=${driftGate.summary}`,
      }),
      buildSoakPhaseResult({
        label: "effectiveness_recovery",
        state: recoveredState,
        passed:
          recoveredGate.passed &&
          recoveredGate.effectivenessPassed &&
          recoveredGate.weakeningSkills.length === 0,
        details: `quality_gate=${recoveredGate.summary}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "effectiveness_drift_recovery",
      passed,
      summary: passed
        ? "Scoped effectiveness drift can fail the gate and then recover after the stronger path is restored."
        : "Scoped effectiveness drift/recovery did not propagate through the long-run gate lifecycle.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  {
    const recoveredWatchState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Keep the recovered diagnostics workflow under watch and prefer the more stable sibling path until it proves durable.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["diagnostics-repair", "acceptance-report"],
      likelySkills: ["diagnostics-repair"],
      availableSkillInfo: [
        { name: "diagnostics-repair", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill effectiveness guidance:",
        "- skill=diagnostics-repair family=diagnostics task_mode=debugging workspace=project env=node validation=exec score=2.20 evidence=3",
        "- skill=acceptance-report family=verification task_mode=debugging workspace=project env=node validation=exec score=2.40 evidence=3",
        "Skill recovery guidance:",
        "- skill=diagnostics-repair task_mode=debugging env=node state=recovered_watch",
      ].join("\n"),
    });
    const recoveredWatchGate = runAgenticQualityGate({
      failOnRecoveringSkills: true,
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "watch",
        effectiveSkills: ["acceptance-report@debugging/node"],
        recoveringSkills: ["diagnostics-repair@debugging/node"],
      },
    });
    const stabilizedState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Keep the recovered diagnostics workflow under watch and prefer the more stable sibling path until it proves durable.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 1,
          maxAttempts: 2,
          summary:
            "Stayed on the stable sibling path while the recovered route remained under watch.",
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary:
            "Validated the stable acceptance-report path while monitoring the recovered diagnostics route.",
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary:
            "Stable sibling path validated successfully, the recovered diagnostics workflow proved durable, and the task is ready for final handoff.",
        },
        {
          kind: "handoff",
          summary:
            "Final handoff updated after the recovered diagnostics workflow stabilized and the stronger reusable path was confirmed.",
        },
      ],
      availableSkills: ["diagnostics-repair", "acceptance-report"],
      likelySkills: ["diagnostics-repair"],
      availableSkillInfo: [
        { name: "diagnostics-repair", primaryEnv: "node" },
        { name: "acceptance-report", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill effectiveness guidance:",
        "- skill=diagnostics-repair family=diagnostics task_mode=debugging workspace=project env=node validation=exec score=2.60 evidence=4",
        "- skill=acceptance-report family=verification task_mode=debugging workspace=project env=node validation=exec score=2.50 evidence=4",
      ].join("\n"),
    });
    const stabilizedGate = runAgenticQualityGate({
      failOnRecoveringSkills: true,
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      memoryTrend: {
        trend: "stable",
        effectiveSkills: ["acceptance-report@debugging/node", "diagnostics-repair@debugging/node"],
        stabilizedSkills: ["diagnostics-repair@debugging/node"],
        recoveringSkills: [],
      },
    });
    const phases = [
      buildSoakPhaseResult({
        label: "recovered_watch_gate",
        state: recoveredWatchState,
        passed:
          recoveredWatchState.orchestrationState.primarySkill === "acceptance-report" &&
          !recoveredWatchGate.passed &&
          !recoveredWatchGate.effectivenessPassed &&
          recoveredWatchGate.failReasons.includes("recovering_scoped_skills"),
        details: `quality_gate=${recoveredWatchGate.summary}`,
      }),
      buildSoakPhaseResult({
        label: "stabilized_reuse",
        state: stabilizedState,
        passed:
          stabilizedState.verificationState.goalSatisfaction === "satisfied" &&
          stabilizedState.verificationState.outcome !== "failed" &&
          stabilizedState.verificationState.outcome !== "blocked" &&
          buildAgenticHandoffReport(stabilizedState).pendingSteps.length === 0 &&
          stabilizedGate.passed &&
          stabilizedGate.effectivenessPassed &&
          stabilizedGate.recoveringSkills.length === 0 &&
          stabilizedGate.recommendations.includes(
            "Promote stabilized scoped skills for stable reuse or extend-existing decisions.",
          ),
        details: `quality_gate=${stabilizedGate.summary} recommendations=${stabilizedGate.recommendations.join("|")}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "recovered_watch_stabilization",
      passed,
      summary: passed
        ? "Recovered-watch skills can stay gated under observation and later stabilize into a clean reusable path."
        : "Recovered-watch lifecycle did not move cleanly from guarded use into stable reuse.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  {
    const templateState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Generalize the stable diagnostics workflow into a reusable template without creating another fork.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [{ name: "memory-diagnostics", primaryEnv: "node" }],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill effectiveness guidance:",
        "- skill=memory-diagnostics family=diagnostics task_mode=general workspace=project env=node validation=exec score=3.20 evidence=4",
        "Skill family guidance:",
        "- family=diagnostics trend=stable consolidation=generalize_existing template_candidate=true primary=memory-diagnostics",
      ].join("\n"),
    });
    const templateReport = inspectAgenticExecutionObservability(templateState);
    const templateGate = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      diagnosticsOverride: templateReport,
      memoryTrend: {
        trend: "stable",
        templateFamilies: ["diagnostics@general/node"],
      },
    });
    const mergeState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Merge the overlapping diagnostics siblings into one reusable workflow after repeated overlap evidence.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report", "diagnostics-validation"],
      likelySkills: ["memory-diagnostics", "diagnostics-report"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "diagnostics-report", primaryEnv: "node" },
        { name: "diagnostics-validation", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill family guidance:",
        "- family=diagnostics trend=stable consolidation=generalize_existing merge_candidate=true merge_skills=memory-diagnostics,diagnostics-report primary=memory-diagnostics",
      ].join("\n"),
    });
    const mergeReport = inspectAgenticExecutionObservability(mergeState);
    const mergeGate = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      diagnosticsOverride: mergeReport,
      memoryTrend: {
        trend: "stable",
        mergeFamilies: ["diagnostics@general/node"],
      },
    });
    const phases = [
      buildSoakPhaseResult({
        label: "template_generalization",
        state: templateState,
        passed:
          templateState.orchestrationState.consolidationAction === "generalize_existing" &&
          !templateState.orchestrationState.mergeCandidate &&
          templateReport.recommendations.some((recommendation) =>
            recommendation.includes("Prefer generalize_existing"),
          ) &&
          templateGate.recommendations.includes(
            "Memory-backed template-ready families: diagnostics@general/node.",
          ),
        details: `merge=${templateReport.mergeCandidate} recommendations=${templateGate.recommendations.join("|")}`,
      }),
      buildSoakPhaseResult({
        label: "merge_consolidation",
        state: mergeState,
        passed:
          mergeState.orchestrationState.consolidationAction === "generalize_existing" &&
          mergeState.orchestrationState.mergeCandidate &&
          mergeReport.mergeSkills.length >= 2 &&
          mergeGate.mergeFamilies.includes("diagnostics@general/node") &&
          mergeGate.diagnostics.recommendations.some((recommendation) =>
            recommendation.includes("Merge overlapping sibling skills"),
          ) &&
          mergeGate.recommendations.includes(
            "Memory-backed merge-ready families: diagnostics@general/node.",
          ),
        details: `merge=${mergeReport.mergeSkills.join("|")} recommendations=${mergeGate.recommendations.join("|")}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "consolidation_mode_transition",
      passed,
      summary: passed
        ? "Long-run consolidation can stay template-oriented for one stable path and later shift into merge-oriented sibling consolidation."
        : "Template-vs-merge consolidation modes did not stay distinct across the soak lifecycle.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  {
    const failureMergeState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow and let repeated failed overlap evidence pick the strongest sibling path.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Diagnostics validation failed again for the current path.",
        },
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report"],
      likelySkills: ["memory-diagnostics"],
      availableSkillInfo: [
        { name: "memory-diagnostics", primaryEnv: "node" },
        { name: "diagnostics-report", primaryEnv: "node" },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill family guidance:",
        "- family=diagnostics task_mode=debugging env=node trend=stable consolidation=generalize_existing merge_candidate=true merge_skills=diagnostics-report,memory-diagnostics durable=true",
      ].join("\n"),
    });
    const failureMergeGate = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      diagnosticsOverride: inspectAgenticExecutionObservability(failureMergeState),
      memoryTrend: {
        trend: "watch",
        mergeFamilies: ["diagnostics@debugging/node"],
      },
    });
    const failureTemplateState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the acceptance workflow without creating another specialized fork after the previous near-miss.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Acceptance workflow validation nearly worked but still needs refinement.",
        },
      ],
      availableSkills: ["acceptance-report"],
      likelySkills: ["acceptance-report"],
      availableSkillInfo: [{ name: "acceptance-report", primaryEnv: "node" }],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Skill family guidance:",
        "- family=verification task_mode=debugging env=node trend=stable consolidation=generalize_existing template_candidate=true durable=true",
      ].join("\n"),
    });
    const failureTemplateGate = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      diagnosticsOverride: inspectAgenticExecutionObservability(failureTemplateState),
      memoryTrend: {
        trend: "watch",
        templateFamilies: ["verification@debugging/node"],
      },
    });
    const phases = [
      buildSoakPhaseResult({
        label: "failure_derived_merge_replan",
        state: failureMergeState,
        passed:
          failureMergeState.plannerState.suggestedSkill === "diagnostics-report" &&
          failureMergeState.orchestrationState.primarySkill === "diagnostics-report" &&
          failureMergeGate.recommendations.includes(
            "Memory-backed merge-ready families: diagnostics@debugging/node.",
          ),
        details: `suggested=${failureMergeState.plannerState.suggestedSkill ?? "none"} recommendations=${failureMergeGate.recommendations.join("|")}`,
      }),
      buildSoakPhaseResult({
        label: "failure_derived_template_replan",
        state: failureTemplateState,
        passed:
          !failureTemplateState.plannerState.shouldEscalate &&
          failureTemplateState.orchestrationState.consolidationAction === "generalize_existing" &&
          failureTemplateGate.recommendations.includes(
            "Memory-backed template-ready families: verification@debugging/node.",
          ),
        details: `retry=${failureTemplateState.plannerState.retryClass} recommendations=${failureTemplateGate.recommendations.join("|")}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "failure_derived_consolidation_replan",
      passed,
      summary: passed
        ? "Repeated failed forks can later steer merge-oriented fallback and template-oriented reuse through the long-run gate."
        : "Failure-derived consolidation signals did not stay aligned across the long-run replan lifecycle.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  {
    const protectedBranchState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the release-branch diagnostics regression without repeating the failing path.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/report.ts"],
      workspaceTags: ["workspace", "git-worktree"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "release/diagnostics-fix",
      },
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Diagnostics validation failed again for the current path.",
        },
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 1,
          maxAttempts: 4,
          summary: "Recovered after the first retry.",
        },
      ],
      availableSkills: ["memory-diagnostics", "diagnostics-report"],
      likelySkills: ["memory-diagnostics"],
    });
    const protectedBranchGate = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      diagnosticsOverride: inspectAgenticExecutionObservability(protectedBranchState),
    });
    const validationThinState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Implement the diagnostics formatter changes in src/diagnostics/formatter.ts.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/formatter.ts"],
      workspaceTags: ["workspace"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "feature/formatter-update",
      },
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the formatter implementation and current diagnostics output.",
        },
      ],
    });
    const validationThinGate = runAgenticQualityGate({
      acceptanceOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic acceptance 0/0 passed",
      },
      soakOverride: {
        passed: true,
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarioIds: [],
        scenarios: [],
        summary: "agentic soak 0/0 passed",
      },
      diagnosticsOverride: inspectAgenticExecutionObservability(validationThinState),
    });
    const phases = [
      buildSoakPhaseResult({
        label: "protected_branch_retry_boundary",
        state: protectedBranchState,
        passed:
          protectedBranchState.governanceState.autonomyMode === "approval_required" &&
          protectedBranchState.plannerState.retryClass === "skill_fallback" &&
          protectedBranchState.plannerState.remainingRetryBudget === 1 &&
          protectedBranchGate.recommendations.includes(
            "Protected-branch or high-risk mutation work requires approval before continuing.",
          ),
        details: `retry=${protectedBranchState.plannerState.retryClass} autonomy=${protectedBranchState.governanceState.autonomyMode} recommendations=${protectedBranchGate.recommendations.join("|")}`,
      }),
      buildSoakPhaseResult({
        label: "validation_context_retry_boundary",
        state: validationThinState,
        passed:
          validationThinState.plannerState.retryClass === "clarify" &&
          validationThinState.plannerState.remainingRetryBudget === 1 &&
          validationThinState.governanceState.riskLevel === "medium" &&
          validationThinGate.recommendations.includes(
            "Capture an observed validation command before allowing another retry on project work.",
          ),
        details: `retry=${validationThinState.plannerState.retryClass} risk=${validationThinState.governanceState.riskLevel} recommendations=${validationThinGate.recommendations.join("|")}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "environment_guarded_retry_lifecycle",
      passed,
      summary: passed
        ? "Protected-branch and validation-thin environments keep retries bounded across the long-run gate."
        : "Environment retry guards did not stay bounded across soak and quality validation.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  {
    const guardedApprovalState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the release-branch diagnostics regression in src/diagnostics/report.ts and hand off safely if approval is needed.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/report.ts"],
      workspaceTags: ["workspace", "git-worktree"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "release/diagnostics-fix",
      },
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the diagnostics implementation and release checklist.",
        },
      ],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a guarded handoff for release-branch approval.",
          artifactRefs: ["src/diagnostics/report.ts"],
        },
      ],
    });
    const guardedPauseState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Implement the diagnostics formatter changes and pause until the validation command is known.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["src/diagnostics/formatter.ts"],
      workspaceTags: ["workspace"],
      workspaceState: {
        workspaceName: "openclaw",
        sessionRelativePath: "packages/diagnostics",
        gitBranch: "feature/formatter-update",
      },
      toolSignals: [
        {
          toolName: "read",
          status: "success",
          summary: "Read the formatter implementation and current diagnostics output.",
        },
      ],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a guarded handoff while validation setup remains incomplete.",
          artifactRefs: ["src/diagnostics/formatter.ts"],
        },
      ],
    });
    const approvalHandoff = buildAgenticHandoffReport(guardedApprovalState);
    const pauseHandoff = buildAgenticHandoffReport(guardedPauseState);
    const phases = [
      buildSoakPhaseResult({
        label: "approval_guard_handoff",
        state: guardedApprovalState,
        passed:
          approvalHandoff.operatorMode === "approval_required" &&
          (approvalHandoff.resumePrompt ?? "").includes("Resume after approval") &&
          (approvalHandoff.resumeCondition ?? "").includes("Wait for operator approval"),
        details: `operator=${approvalHandoff.operatorMode} resume=${approvalHandoff.resumePrompt ?? "none"}`,
      }),
      buildSoakPhaseResult({
        label: "validation_pause_handoff",
        state: guardedPauseState,
        passed:
          pauseHandoff.operatorMode === "pause" &&
          (pauseHandoff.resumePrompt ?? "").includes("Resume after prerequisites are restored") &&
          (pauseHandoff.resumeCondition ?? "").includes("Capture an observed validation command"),
        details: `operator=${pauseHandoff.operatorMode} resume=${pauseHandoff.resumePrompt ?? "none"}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "guarded_handoff_boundary",
      passed,
      summary: passed
        ? "Guarded work stays resumable with approval-aware and validation-aware handoff boundaries."
        : "Guarded handoff boundaries did not stay intact across the soak lifecycle.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  {
    const initialState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Finalize the diagnostics report, keep assumptions visible, and leave the remaining validation step for the next operator.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      activeArtifacts: ["scripts/agentic-diagnostics-report.ts"],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a concise operator handoff for the remaining validation step.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
      ],
    });
    const resumedState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Finalize the diagnostics report, keep assumptions visible, and leave the remaining validation step for the next operator.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      retrySignals: [
        {
          phase: "prompt",
          outcome: "recovered",
          attempt: 1,
          maxAttempts: 2,
          summary:
            "Resumed from the concise operator handoff and continued the remaining validation step.",
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Reran diagnostics validation successfully and updated the report handoff.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary: "Diagnostics report finalized and remaining validation step completed.",
          artifactRefs: ["scripts/agentic-diagnostics-report.ts"],
        },
      ],
      activeArtifacts: ["scripts/agentic-diagnostics-report.ts"],
    });
    const initialObservability = inspectAgenticExecutionObservability(initialState);
    const initialHandoff = buildAgenticHandoffReport(initialState);
    const resumedHandoff = buildAgenticHandoffReport(resumedState);
    const phases = [
      buildSoakPhaseResult({
        label: "concise_progress_handoff",
        state: initialState,
        passed:
          initialObservability.progressSummary.includes("active=") &&
          initialObservability.assumptions.length > 0 &&
          initialHandoff.progressSummary.includes("pending="),
        details: `progress=${initialObservability.progressSummary} assumptions=${initialObservability.assumptions.join("|")}`,
      }),
      buildSoakPhaseResult({
        label: "concise_progress_resume",
        state: resumedState,
        passed:
          resumedState.verificationState.outcome === "verified" &&
          resumedHandoff.progressSummary.includes("completed=") &&
          resumedHandoff.assumptions.length > 0,
        details: `progress=${resumedHandoff.progressSummary} assumptions=${resumedHandoff.assumptions.join("|")}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "concise_progress_resume_boundary",
      passed,
      summary: passed
        ? "Concise progress and assumptions stay visible across handoff and resume."
        : "Concise progress or assumptions drifted across the handoff/resume lifecycle.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  {
    const blockedState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the build once the missing config file is available.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required config file: config/runtime.json",
        },
      ],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a handoff until the missing config file is restored.",
        },
      ],
    });
    const resumedState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the build once the missing config file is available.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary:
            "Ran pnpm exec tsc -p tsconfig.json --noEmit successfully after restoring config/runtime.json.",
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary: "Build fixed after the missing config file was restored.",
        },
      ],
    });
    const blockedObservability = inspectAgenticExecutionObservability(blockedState);
    const blockedHandoff = buildAgenticHandoffReport(blockedState);
    const resumedObservability = inspectAgenticExecutionObservability(resumedState);
    const phases = [
      buildSoakPhaseResult({
        label: "clarification_pause",
        state: blockedState,
        passed:
          blockedState.plannerState.retryClass === "clarify" &&
          (blockedObservability.clarificationSummary ?? "").includes("config/runtime.json") &&
          (blockedHandoff.clarificationSummary ?? "").includes("config/runtime.json"),
        details: `clarification=${blockedObservability.clarificationSummary ?? "none"}`,
      }),
      buildSoakPhaseResult({
        label: "clarification_resume",
        state: resumedState,
        passed:
          resumedState.verificationState.outcome !== "blocked" &&
          resumedState.plannerState.retryClass === "same_path_retry" &&
          resumedObservability.clarificationSummary === undefined,
        details: `clarification=${resumedObservability.clarificationSummary ?? "none"} outcome=${resumedState.verificationState.outcome}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "clarification_resume_boundary",
      passed,
      summary: passed
        ? "Concrete clarification needs pause execution only until the missing prerequisite is restored."
        : "Clarification pause/resume behavior drifted across the lifecycle.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  {
    const blockedEnvVarState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Run the deployment smoke test after the required environment variable is available.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required environment variable: OPENAI_API_KEY",
        },
      ],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a handoff until OPENAI_API_KEY is configured.",
        },
      ],
    });
    const resumedEnvVarState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Run the deployment smoke test after the required environment variable is available.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Configured OPENAI_API_KEY and ran the deployment smoke test successfully.",
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary: "Deployment smoke test completed after OPENAI_API_KEY was configured.",
        },
      ],
    });
    const blockedApprovalState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Deploy the production hotfix once the release approval is granted.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Approval required: production deployment",
        },
      ],
      checkpointSignals: [
        {
          kind: "handoff",
          summary: "Prepared a handoff until production deployment approval is granted.",
        },
      ],
    });
    const resumedApprovalState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Deploy the production hotfix once the release approval is granted.",
          timestamp: Date.now(),
        } as AgentMessage,
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "success",
          summary: "Production deployment approved and hotfix deployed successfully.",
        },
      ],
      checkpointSignals: [
        {
          kind: "completion",
          summary: "Production hotfix completed after deployment approval was granted.",
        },
      ],
    });
    const blockedEnvVarObservability = inspectAgenticExecutionObservability(blockedEnvVarState);
    const resumedEnvVarObservability = inspectAgenticExecutionObservability(resumedEnvVarState);
    const blockedApprovalObservability = inspectAgenticExecutionObservability(blockedApprovalState);
    const resumedApprovalObservability = inspectAgenticExecutionObservability(resumedApprovalState);
    const phases = [
      buildSoakPhaseResult({
        label: "env_var_pause",
        state: blockedEnvVarState,
        passed:
          blockedEnvVarState.plannerState.retryClass === "clarify" &&
          blockedEnvVarObservability.clarificationSummary ===
            "Need clarification on: environment variable OPENAI_API_KEY",
        details: `clarification=${blockedEnvVarObservability.clarificationSummary ?? "none"}`,
      }),
      buildSoakPhaseResult({
        label: "env_var_resume",
        state: resumedEnvVarState,
        passed:
          resumedEnvVarState.verificationState.outcome !== "blocked" &&
          resumedEnvVarState.plannerState.retryClass === "same_path_retry" &&
          resumedEnvVarObservability.clarificationSummary === undefined,
        details: `clarification=${resumedEnvVarObservability.clarificationSummary ?? "none"} outcome=${resumedEnvVarState.verificationState.outcome}`,
      }),
      buildSoakPhaseResult({
        label: "approval_pause",
        state: blockedApprovalState,
        passed:
          blockedApprovalState.plannerState.retryClass === "clarify" &&
          blockedApprovalObservability.clarificationSummary ===
            "Need clarification on: operator approval for production deployment",
        details: `clarification=${blockedApprovalObservability.clarificationSummary ?? "none"}`,
      }),
      buildSoakPhaseResult({
        label: "approval_resume",
        state: resumedApprovalState,
        passed:
          resumedApprovalState.verificationState.outcome !== "blocked" &&
          resumedApprovalState.plannerState.retryClass === "same_path_retry" &&
          resumedApprovalObservability.clarificationSummary === undefined,
        details: `clarification=${resumedApprovalObservability.clarificationSummary ?? "none"} outcome=${resumedApprovalState.verificationState.outcome}`,
      }),
    ];
    const passed = phases.every((phase) => phase.passed);
    scenarios.push({
      id: "rich_clarification_resume_boundary",
      passed,
      summary: passed
        ? "Environment-variable and approval prerequisites pause cleanly and clear once the prerequisite is restored."
        : "Rich clarification payloads did not stay stable across pause/resume lifecycles.",
      phases,
      details: phases.map((phase) => `${phase.label}:${phase.details ?? "none"}`).join("|"),
    });
  }

  const failedScenarioIds = scenarios
    .filter((scenario) => !scenario.passed)
    .map((scenario) => scenario.id);
  const passedScenarios = scenarios.length - failedScenarioIds.length;
  return {
    passed: failedScenarioIds.length === 0,
    totalScenarios: scenarios.length,
    passedScenarios,
    failedScenarioIds,
    scenarios,
    summary: `agentic soak ${passedScenarios}/${scenarios.length} passed`,
  };
}

export function formatAgenticSoakReport(
  report: AgenticSoakReport,
  format: "json" | "summary" | "markdown" = "json",
): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "summary") {
    const lines = [
      report.summary,
      ...report.scenarios.map(
        (scenario) =>
          `${scenario.passed ? "PASS" : "FAIL"} ${scenario.id}: ${scenario.summary} phases=${scenario.phases
            .map((phase) => `${phase.label}:${phase.passed ? "ok" : "fail"}`)
            .join("|")}`,
      ),
    ];
    return `${lines.join("\n")}\n`;
  }
  const lines = [
    "# Agentic Soak Report",
    "",
    `Summary: ${report.summary}`,
    "",
    ...report.scenarios.flatMap((scenario) => [
      `## ${scenario.id}`,
      `- Passed: ${scenario.passed ? "yes" : "no"}`,
      `- Summary: ${scenario.summary}`,
      ...(scenario.details ? [`- Details: ${scenario.details}`] : []),
      "- Phases:",
      ...scenario.phases.map(
        (phase) =>
          `  - ${phase.label}: ${phase.passed ? "passed" : "failed"} outcome=${phase.outcome} goal=${phase.goalSatisfaction} retry=${phase.retryClass} autonomy=${phase.autonomyMode} pending_handoff=${phase.pendingHandoffSteps}`,
      ),
      "",
    ]),
  ];
  return `${lines.join("\n")}\n`;
}

export function runAgenticQualityGate(params?: {
  messages?: AgentMessage[];
  failOnEscalation?: boolean;
  failOnMissingFallback?: boolean;
  failOnWeakeningSkills?: boolean;
  failOnRecoveringSkills?: boolean;
  diagnosticsOverride?: AgenticExecutionObservabilityReport;
  acceptanceOverride?: AgenticAcceptanceReport;
  soakOverride?: AgenticSoakReport;
  memoryTrend?: {
    weakeningSkills?: string[];
    effectiveSkills?: string[];
    recoveringSkills?: string[];
    stabilizedSkills?: string[];
    templateFamilies?: string[];
    mergeFamilies?: string[];
    trend?: "stable" | "watch" | "regressing";
  };
}): AgenticQualityGateReport {
  const acceptance = params?.acceptanceOverride ?? runAgenticAcceptanceSuite();
  const soak = params?.soakOverride ?? runAgenticSoakSuite();
  const diagnostics =
    params?.diagnosticsOverride ??
    inspectAgenticExecutionObservability(
      buildAgenticExecutionState({
        messages: params?.messages ?? [],
      }),
    );
  const weakeningSkills = uniqueCompact(params?.memoryTrend?.weakeningSkills ?? [], 6);
  const effectiveSkills = uniqueCompact(params?.memoryTrend?.effectiveSkills ?? [], 6);
  const recoveringSkills = uniqueCompact(params?.memoryTrend?.recoveringSkills ?? [], 6);
  const stabilizedSkills = uniqueCompact(params?.memoryTrend?.stabilizedSkills ?? [], 6);
  const templateFamilies = uniqueCompact(params?.memoryTrend?.templateFamilies ?? [], 6);
  const mergeFamilies = uniqueCompact(params?.memoryTrend?.mergeFamilies ?? [], 6);
  const effectivenessTrend = params?.memoryTrend?.trend;
  const failReasons = [
    !acceptance.passed ? "acceptance_failed" : undefined,
    !soak.passed ? "soak_failed" : undefined,
    params?.failOnEscalation && diagnostics.escalationRequired
      ? "diagnostics_escalation"
      : undefined,
    params?.failOnMissingFallback && !diagnostics.hasViableFallback
      ? "diagnostics_missing_fallback"
      : undefined,
    params?.failOnWeakeningSkills && weakeningSkills.length > 0
      ? "weakening_scoped_skills"
      : undefined,
    params?.failOnRecoveringSkills && recoveringSkills.length > 0
      ? "recovering_scoped_skills"
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));
  const diagnosticsPassed =
    (!params?.failOnEscalation || !diagnostics.escalationRequired) &&
    (!params?.failOnMissingFallback || diagnostics.hasViableFallback);
  const effectivenessPassed =
    (!params?.failOnWeakeningSkills || weakeningSkills.length === 0) &&
    (!params?.failOnRecoveringSkills || recoveringSkills.length === 0);
  const recommendations = uniqueCompact(
    [
      diagnostics.autonomyMode === "approval_required"
        ? "Protected-branch or high-risk mutation work requires approval before continuing."
        : undefined,
      diagnostics.retryClass === "clarify" && diagnostics.clarificationSummary
        ? diagnostics.clarificationSummary
        : undefined,
      diagnostics.riskLevel === "medium" && diagnostics.retryClass === "clarify"
        ? "Capture an observed validation command before allowing another retry on project work."
        : undefined,
      diagnostics.consolidationAction === "generalize_existing" &&
      diagnostics.mergeCandidate &&
      diagnostics.mergeSkills.length > 0
        ? `Merge-ready consolidation is active for sibling skills: ${diagnostics.mergeSkills.join(", ")}.`
        : undefined,
      diagnostics.consolidationAction === "generalize_existing" && !diagnostics.mergeCandidate
        ? "Template-ready consolidation is active; parameterize the stable workflow instead of creating a new fork."
        : undefined,
      templateFamilies.length > 0
        ? `Memory-backed template-ready families: ${templateFamilies.join(", ")}.`
        : undefined,
      mergeFamilies.length > 0
        ? `Memory-backed merge-ready families: ${mergeFamilies.join(", ")}.`
        : undefined,
      weakeningSkills.length > 0
        ? "Review weakening scoped skills before promoting or extending the current workflow family."
        : undefined,
      recoveringSkills.length > 0
        ? "Keep recovering scoped skills under watch until repeated successful runs confirm stability."
        : undefined,
      stabilizedSkills.length > 0 && weakeningSkills.length === 0 && recoveringSkills.length === 0
        ? "Promote stabilized scoped skills for stable reuse or extend-existing decisions."
        : undefined,
    ],
    6,
  );
  const passed = acceptance.passed && soak.passed && diagnosticsPassed && effectivenessPassed;
  return {
    passed,
    acceptancePassed: acceptance.passed,
    soakPassed: soak.passed,
    diagnosticsPassed,
    effectivenessPassed,
    failReasons,
    acceptance,
    soak,
    diagnostics,
    weakeningSkills,
    effectiveSkills,
    recoveringSkills,
    stabilizedSkills,
    templateFamilies,
    mergeFamilies,
    effectivenessTrend,
    recommendations,
    summary: `agentic quality gate acceptance=${acceptance.passed ? "pass" : "fail"} soak=${soak.passed ? "pass" : "fail"} diagnostics=${diagnosticsPassed ? "pass" : "fail"} effectiveness=${effectivenessPassed ? "pass" : "fail"}`,
  };
}

export function formatAgenticQualityGateReport(
  report: AgenticQualityGateReport,
  format: "json" | "summary" | "markdown" = "json",
): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "summary") {
    const lines = [
      report.summary,
      `acceptance=${report.acceptance.summary}`,
      `soak=${report.soak.summary}`,
      `diagnostics=${report.diagnostics.summary}`,
      `effectiveness=${report.effectivenessPassed ? "pass" : "fail"}${report.effectivenessTrend ? ` trend=${report.effectivenessTrend}` : ""}`,
      `weakening_skills=${report.weakeningSkills.length > 0 ? report.weakeningSkills.join(",") : "none"}`,
      `recovering_skills=${report.recoveringSkills.length > 0 ? report.recoveringSkills.join(",") : "none"}`,
      `stabilized_skills=${report.stabilizedSkills.length > 0 ? report.stabilizedSkills.join(",") : "none"}`,
      `template_families=${report.templateFamilies.length > 0 ? report.templateFamilies.join(",") : "none"}`,
      `merge_families=${report.mergeFamilies.length > 0 ? report.mergeFamilies.join(",") : "none"}`,
      `recommendations=${report.recommendations.length > 0 ? report.recommendations.join(" | ") : "none"}`,
      `fail_reasons=${report.failReasons.length > 0 ? report.failReasons.join(",") : "none"}`,
    ];
    return `${lines.join("\n")}\n`;
  }
  const lines = [
    "# Agentic Quality Gate Report",
    "",
    `Summary: ${report.summary}`,
    `Passed: ${report.passed ? "yes" : "no"}`,
    `Fail reasons: ${report.failReasons.length > 0 ? report.failReasons.join(", ") : "none"}`,
    "",
    "## Acceptance",
    `- Summary: ${report.acceptance.summary}`,
    `- Passed: ${report.acceptancePassed ? "yes" : "no"}`,
    "",
    "## Soak",
    `- Summary: ${report.soak.summary}`,
    `- Passed: ${report.soakPassed ? "yes" : "no"}`,
    "",
    "## Diagnostics",
    `- Summary: ${report.diagnostics.summary}`,
    `- Passed: ${report.diagnosticsPassed ? "yes" : "no"}`,
    `- Escalation required: ${report.diagnostics.escalationRequired ? "yes" : "no"}`,
    `- Viable fallback: ${report.diagnostics.hasViableFallback ? "yes" : "no"}`,
    "",
    "## Effectiveness",
    `- Passed: ${report.effectivenessPassed ? "yes" : "no"}`,
    `- Trend: ${report.effectivenessTrend ?? "unknown"}`,
    `- Effective skills: ${report.effectiveSkills.length > 0 ? report.effectiveSkills.join(", ") : "none"}`,
    `- Weakening skills: ${report.weakeningSkills.length > 0 ? report.weakeningSkills.join(", ") : "none"}`,
    `- Recovering skills: ${report.recoveringSkills.length > 0 ? report.recoveringSkills.join(", ") : "none"}`,
    `- Stabilized skills: ${report.stabilizedSkills.length > 0 ? report.stabilizedSkills.join(", ") : "none"}`,
    `- Template-ready families: ${report.templateFamilies.length > 0 ? report.templateFamilies.join(", ") : "none"}`,
    `- Merge-ready families: ${report.mergeFamilies.length > 0 ? report.mergeFamilies.join(", ") : "none"}`,
    `- Recommendations: ${report.recommendations.length > 0 ? report.recommendations.join("; ") : "none"}`,
  ];
  return `${lines.join("\n")}\n`;
}
