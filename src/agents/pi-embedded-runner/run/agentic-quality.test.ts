import { describe, expect, it } from "vitest";
import {
  formatAgenticQualityGateReport,
  inspectAgenticExecutionObservability,
  runAgenticQualityGate,
} from "./agentic-state.js";

describe("agentic quality gate", () => {
  it("combines acceptance, soak, and diagnostics into one release-gate report", () => {
    const report = runAgenticQualityGate({
      messages: [
        {
          role: "user",
          content:
            "Fix the diagnostics workflow, rerun validation, and prepare the final handoff summary.",
          timestamp: Date.now(),
        },
      ],
    });

    expect(report.passed).toBe(true);
    expect(report.acceptancePassed).toBe(true);
    expect(report.soakPassed).toBe(true);
    expect(report.diagnosticsPassed).toBe(true);
    expect(report.failReasons).toEqual([]);
  });

  it("can fail the diagnostics portion when escalation or missing fallback is disallowed", () => {
    const report = runAgenticQualityGate({
      messages: [
        {
          role: "user",
          content: "Fix the diagnostics workflow and find a viable fallback.",
          timestamp: Date.now(),
        },
      ],
      failOnEscalation: true,
      failOnMissingFallback: true,
    });

    expect(report.passed).toBe(false);
    expect(report.acceptancePassed).toBe(true);
    expect(report.soakPassed).toBe(true);
    expect(report.diagnosticsPassed).toBe(false);
    expect(report.failReasons).toContain("diagnostics_missing_fallback");
  });

  it("can fail the effectiveness portion when weakening scoped skills are disallowed", () => {
    const report = runAgenticQualityGate({
      failOnWeakeningSkills: true,
      memoryTrend: {
        trend: "watch",
        effectiveSkills: ["acceptance-report@debugging/node"],
        weakeningSkills: ["diagnostics-repair@debugging/node"],
      },
    });

    expect(report.passed).toBe(false);
    expect(report.effectivenessPassed).toBe(false);
    expect(report.failReasons).toContain("weakening_scoped_skills");
    expect(report.weakeningSkills).toContain("diagnostics-repair@debugging/node");
  });

  it("can fail the effectiveness portion when recovering scoped skills are disallowed", () => {
    const report = runAgenticQualityGate({
      failOnRecoveringSkills: true,
      memoryTrend: {
        trend: "watch",
        effectiveSkills: ["acceptance-report@debugging/node"],
        recoveringSkills: ["diagnostics-repair@debugging/node"],
      },
    });

    expect(report.passed).toBe(false);
    expect(report.effectivenessPassed).toBe(false);
    expect(report.failReasons).toContain("recovering_scoped_skills");
    expect(report.recoveringSkills).toContain("diagnostics-repair@debugging/node");
  });

  it("formats the quality gate report in summary and markdown forms", () => {
    const report = runAgenticQualityGate({
      memoryTrend: {
        trend: "stable",
        effectiveSkills: ["acceptance-report@debugging/node"],
        stabilizedSkills: ["release-checks@debugging/node"],
        templateFamilies: ["diagnostics@debugging/node"],
        mergeFamilies: ["verification@debugging/node"],
      },
    });
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("agentic quality gate");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("effectiveness=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("recovering_skills=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("stabilized_skills=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("template_families=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("merge_families=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("recommendations=");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "# Agentic Quality Gate Report",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("## Diagnostics");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("## Effectiveness");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("Stabilized skills:");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Template-ready families:",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("Merge-ready families:");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("Recommendations:");
    expect(report.recommendations).toContain(
      "Promote stabilized scoped skills for stable reuse or extend-existing decisions.",
    );
    expect(report.recommendations).toContain(
      "Memory-backed template-ready families: diagnostics@debugging/node.",
    );
    expect(report.recommendations).toContain(
      "Memory-backed merge-ready families: verification@debugging/node.",
    );
  });

  it("surfaces template-ready and merge-ready consolidation recommendations in the quality gate", () => {
    const templateDiagnostics = inspectAgenticExecutionObservability({
      taskState: {
        version: 1,
        taskMode: "debugging",
        objective: "Template the diagnostics workflow",
        subtasks: [],
        blockers: [],
        assumptions: [],
        successCriteria: [],
        planSteps: [],
        activeArtifacts: [],
        confidence: "medium",
      },
      verificationState: {
        version: 1,
        outcome: "verified",
        goalSatisfaction: "satisfied",
        evidence: [],
        goalSignals: [],
        checksRun: [],
        failingChecks: [],
        unresolvedCriteria: [],
        failureClasses: [],
      },
      plannerState: {
        version: 1,
        status: "continue",
        alternativeSkills: [],
        retryClass: "same_path_retry",
        shouldEscalate: false,
      },
      governanceState: {
        version: 1,
        autonomyMode: "continue",
        riskLevel: "low",
        approvalRequired: false,
        secretPromptDetected: false,
        destructiveActionDetected: false,
        reasons: [],
      },
      orchestrationState: {
        version: 1,
        primarySkill: "memory-diagnostics",
        fallbackSkills: [],
        skillChain: ["memory-diagnostics"],
        workflowSteps: [{ skill: "memory-diagnostics", role: "primary" }],
        rankedSkills: ["memory-diagnostics"],
        effectiveSkills: ["memory-diagnostics"],
        effectiveFamilies: ["diagnostics"],
        promotedSkills: [],
        prerequisiteWarnings: [],
        capabilityGaps: [],
        hasViableFallback: true,
        multiSkillCandidate: false,
        chainedWorkflow: false,
        skillFamilies: ["diagnostics"],
        overlappingSkills: [],
        mergeCandidate: false,
        mergeSkills: [],
        stabilityState: "neutral",
        stabilitySkills: [],
        consolidationAction: "generalize_existing",
      },
      environmentState: {
        version: 1,
        workspaceKind: "project",
        capabilitySignals: ["can_execute_commands"],
        preferredValidationTools: ["exec"],
        skillEnvironments: ["node"],
      },
      failureLearningState: {
        version: 1,
        failurePattern: "clean_success",
        learnFromFailure: false,
        failureReasons: [],
        missingCapabilities: [],
      },
    });
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
    });
    expect(templateReport.recommendations).toContain(
      "Template-ready consolidation is active; parameterize the stable workflow instead of creating a new fork.",
    );

    const mergeDiagnostics = inspectAgenticExecutionObservability({
      taskState: {
        version: 1,
        taskMode: "debugging",
        objective: "Merge diagnostics siblings",
        subtasks: [],
        blockers: [],
        assumptions: [],
        successCriteria: [],
        planSteps: [],
        activeArtifacts: [],
        confidence: "medium",
      },
      verificationState: {
        version: 1,
        outcome: "verified",
        goalSatisfaction: "satisfied",
        evidence: [],
        goalSignals: [],
        checksRun: [],
        failingChecks: [],
        unresolvedCriteria: [],
        failureClasses: [],
      },
      plannerState: {
        version: 1,
        status: "continue",
        alternativeSkills: [],
        retryClass: "same_path_retry",
        shouldEscalate: false,
      },
      governanceState: {
        version: 1,
        autonomyMode: "continue",
        riskLevel: "low",
        approvalRequired: false,
        secretPromptDetected: false,
        destructiveActionDetected: false,
        reasons: [],
      },
      orchestrationState: {
        version: 1,
        primarySkill: "memory-diagnostics",
        fallbackSkills: ["diagnostics-report"],
        skillChain: ["memory-diagnostics", "diagnostics-report"],
        workflowSteps: [
          { skill: "memory-diagnostics", role: "primary" },
          { skill: "diagnostics-report", role: "supporting" },
        ],
        rankedSkills: ["memory-diagnostics", "diagnostics-report"],
        effectiveSkills: ["memory-diagnostics", "diagnostics-report"],
        effectiveFamilies: ["diagnostics"],
        promotedSkills: [],
        prerequisiteWarnings: [],
        capabilityGaps: [],
        hasViableFallback: true,
        multiSkillCandidate: true,
        chainedWorkflow: false,
        skillFamilies: ["diagnostics"],
        overlappingSkills: ["memory-diagnostics", "diagnostics-report"],
        mergeCandidate: true,
        mergeSkills: ["memory-diagnostics", "diagnostics-report"],
        stabilityState: "neutral",
        stabilitySkills: [],
        consolidationAction: "generalize_existing",
      },
      environmentState: {
        version: 1,
        workspaceKind: "project",
        capabilitySignals: ["can_execute_commands"],
        preferredValidationTools: ["exec"],
        skillEnvironments: ["node"],
      },
      failureLearningState: {
        version: 1,
        failurePattern: "clean_success",
        learnFromFailure: false,
        failureReasons: [],
        missingCapabilities: [],
      },
    });
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
    });
    expect(mergeReport.recommendations).toContain(
      "Merge-ready consolidation is active for sibling skills: memory-diagnostics, diagnostics-report.",
    );
    expect(formatAgenticQualityGateReport(mergeReport, "summary")).toContain("recommendations=");
  });
});
