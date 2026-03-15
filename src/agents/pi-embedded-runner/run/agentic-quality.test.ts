import { describe, expect, it } from "vitest";
import {
  formatAgenticQualityGateReport,
  buildAgenticExecutionState,
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
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_clarification_profile=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("soak_clarification_mix=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_clarification_trends=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_clarification_trend_policy=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "quality_clarification_trend_policy=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "clarification_trend_policy_alignment=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "clarification_trend_policy_status=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "cross_layer_trend_policy_status=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "handoff_resumability_status=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_resume_barrier_profile=",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("effectiveness=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("clarification_classes=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("clarification_profile=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("recovering_skills=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("stabilized_skills=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("template_families=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("merge_families=");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("recommendations=");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "# Agentic Quality Gate Report",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("## Diagnostics");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("## Soak");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("## Effectiveness");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("Clarification profile:");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("Clarification mix:");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("Clarification trends:");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Soak clarification trend policy:",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Quality clarification trend policy:",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Clarification trend policy alignment:",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Clarification trend policy status:",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Cross-layer trend policy status:",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Handoff resumability status:",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Soak resume barrier profile:",
    );
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

  it("surfaces environment guard recommendations in the quality gate", () => {
    const protectedBranchState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Fix the release-branch diagnostics regression without repeating the failing path.",
          timestamp: Date.now(),
        },
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
      availableSkills: ["memory-diagnostics", "diagnostics-report"],
      likelySkills: ["memory-diagnostics"],
    });
    const protectedReport = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(protectedBranchState),
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
    expect(protectedReport.recommendations).toContain(
      "Protected-branch or high-risk mutation work requires approval before continuing.",
    );
    expect(protectedReport.diagnostics.workspaceKind).toBe("project");
    expect(protectedReport.diagnostics.branchConventions.length).toBeGreaterThan(0);
    expect(protectedReport.diagnostics.permissionSignals.length).toBeGreaterThan(0);
    expect(protectedReport.protectedBranchGovernanceStatus).toBe("guarded");
    expect(protectedReport.handoffResumabilityStatus).toBe("unknown");
    expect(protectedReport.soakResumeBarrierProfile).toBe("none");
    expect(formatAgenticQualityGateReport(protectedReport, "summary")).toContain(
      "workspace_kind=project",
    );
    expect(formatAgenticQualityGateReport(protectedReport, "summary")).toContain(
      `branch_conventions=${protectedReport.diagnostics.branchConventions.join(",")}`,
    );
    expect(formatAgenticQualityGateReport(protectedReport, "summary")).toContain(
      `permission_signals=${protectedReport.diagnostics.permissionSignals.join(",")}`,
    );
    expect(formatAgenticQualityGateReport(protectedReport, "summary")).toContain(
      "protected_branch_governance_status=guarded",
    );
    expect(formatAgenticQualityGateReport(protectedReport, "summary")).toContain(
      "handoff_resumability_status=unknown",
    );
    expect(formatAgenticQualityGateReport(protectedReport, "summary")).toContain(
      "soak_resume_barrier_profile=none",
    );
    expect(formatAgenticQualityGateReport(protectedReport, "markdown")).toContain(
      "Workspace kind: project",
    );
    expect(formatAgenticQualityGateReport(protectedReport, "markdown")).toContain(
      `Branch conventions: ${protectedReport.diagnostics.branchConventions.join(", ")}`,
    );
    expect(formatAgenticQualityGateReport(protectedReport, "markdown")).toContain(
      `Permission signals: ${protectedReport.diagnostics.permissionSignals.join(", ")}`,
    );
    expect(formatAgenticQualityGateReport(protectedReport, "markdown")).toContain(
      "Protected branch governance status: guarded",
    );
    expect(formatAgenticQualityGateReport(protectedReport, "markdown")).toContain(
      "Handoff resumability status: unknown",
    );
    expect(formatAgenticQualityGateReport(protectedReport, "markdown")).toContain(
      "Soak resume barrier profile: none",
    );

    const validationThinState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Implement the diagnostics formatter changes in src/diagnostics/formatter.ts.",
          timestamp: Date.now(),
        },
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
    const validationThinReport = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(validationThinState),
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
    expect(validationThinReport.recommendations).toContain(
      "Capture an observed validation command before allowing another retry on project work.",
    );
    expect(validationThinReport.diagnostics.validationCommands.length).toBeGreaterThan(0);
    expect(validationThinReport.validationReadinessStatus).toBe("observed");
    expect(formatAgenticQualityGateReport(validationThinReport, "summary")).toContain(
      `validation_commands=${validationThinReport.diagnostics.validationCommands.join(",")}`,
    );
    expect(formatAgenticQualityGateReport(validationThinReport, "summary")).toContain(
      "validation_readiness_status=observed",
    );
    expect(formatAgenticQualityGateReport(validationThinReport, "markdown")).toContain(
      `Validation commands: ${validationThinReport.diagnostics.validationCommands.join(" | ")}`,
    );
    expect(formatAgenticQualityGateReport(validationThinReport, "markdown")).toContain(
      "Validation readiness status: observed",
    );
  });

  it("surfaces concrete clarification recommendations in the quality gate", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Fix the build once the missing config file is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required config file: config/runtime.json",
        },
      ],
    });

    const clarificationReport = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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

    expect(clarificationReport.recommendations).toContain(
      "Need clarification on: config/runtime.json",
    );
    expect(formatAgenticQualityGateReport(clarificationReport, "summary")).toContain(
      "Need clarification on: config/runtime.json",
    );
    expect(formatAgenticQualityGateReport(clarificationReport, "markdown")).toContain(
      "Need clarification on: config/runtime.json",
    );
  });

  it("surfaces normalized clarification recommendations for environment variables", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content:
            "Run the deployment smoke test after the required environment variable is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required environment variable: OPENAI_API_KEY",
        },
      ],
    });

    const clarificationReport = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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

    expect(clarificationReport.recommendations).toContain(
      "Need clarification on: environment variable OPENAI_API_KEY",
    );
  });

  it("uses memory-backed clarification subtype guidance in the quality gate", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Resume the deployment task once the prerequisite is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required prerequisite for deployment.",
        },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Agentic regression guidance:",
        "- reasons=missing_information:environment_variable trend=watch",
      ].join("\n"),
    });

    const clarificationReport = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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

    expect(clarificationReport.recommendations).toContain(
      "Configure the missing environment variable before retrying.",
    );
    expect(clarificationReport.recommendations).toContain(
      "Need clarification on: prerequisite for deployment.",
    );
    expect(formatAgenticQualityGateReport(clarificationReport, "summary")).toContain(
      "Configure the missing environment variable before retrying.",
    );
  });

  it("uses memory-backed approval clarification guidance in the quality gate", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Resume the production deployment once the prerequisite is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required prerequisite for deployment.",
        },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Agentic regression guidance:",
        "- reasons=missing_information:approval trend=watch",
      ].join("\n"),
    });

    const clarificationReport = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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

    expect(clarificationReport.recommendations).toContain(
      "Obtain the required approval before retrying.",
    );
    expect(clarificationReport.recommendations).toContain(
      "Need clarification on: prerequisite for deployment.",
    );
  });

  it("can fail the diagnostics gate on repeated approval blockers", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Resume the production deployment once the prerequisite is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required prerequisite for deployment.",
        },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Agentic regression guidance:",
        "- reasons=missing_information:approval trend=watch",
      ].join("\n"),
    });

    const report = runAgenticQualityGate({
      failOnClarificationBlockers: true,
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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

    expect(report.passed).toBe(false);
    expect(report.diagnosticsPassed).toBe(false);
    expect(report.clarificationClasses).toContain("missing_information:approval");
    expect(report.clarificationProfile).toBe("approval");
    expect(report.failReasons).toContain("diagnostics_clarification_approval");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "clarification_classes=missing_information:approval",
    );
  });

  it("uses memory-backed external-input clarification guidance in the quality gate", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Resume the import workflow once the prerequisite is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required prerequisite for dataset import.",
        },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Agentic regression guidance:",
        "- reasons=missing_information:external_input trend=watch",
      ].join("\n"),
    });

    const clarificationReport = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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

    expect(clarificationReport.recommendations).toContain(
      "Request the missing external input before retrying.",
    );
    expect(clarificationReport.recommendations).toContain(
      "Need clarification on: prerequisite for dataset import.",
    );
  });

  it("can fail the diagnostics gate on repeated external-input blockers", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Resume the import workflow once the prerequisite is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required prerequisite for dataset import.",
        },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Agentic regression guidance:",
        "- reasons=missing_information:external_input trend=watch",
      ].join("\n"),
    });

    const report = runAgenticQualityGate({
      failOnClarificationBlockers: true,
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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

    expect(report.passed).toBe(false);
    expect(report.diagnosticsPassed).toBe(false);
    expect(report.clarificationClasses).toContain("missing_information:external_input");
    expect(report.clarificationProfile).toBe("external_input");
    expect(report.failReasons).toContain("diagnostics_clarification_external_input");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Clarification classes: missing_information:external_input",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Clarification profile: external_input",
    );
  });

  it("surfaces a mismatch between current clarification blocker and long-run soak mix", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Resume the production deployment once the prerequisite is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required prerequisite for deployment.",
        },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Agentic regression guidance:",
        "- reasons=missing_information:approval trend=watch",
      ].join("\n"),
    });

    const report = runAgenticQualityGate({
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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
        clarificationProfileCounts: ["environment_variable:3", "approval:1"],
        dominantClarificationProfile: "environment_variable",
        clarificationTrendSignals: ["environment_variable:falling(2->1)", "approval:rising(0->1)"],
        clarificationTrendPolicy: "observe",
        summary: "agentic soak 0/0 passed",
      },
    });

    expect(report.recommendations).toContain(
      "Current clarification blocker differs from long-run blocker mix: current=approval soak=environment_variable.",
    );
    expect(report.recommendations).toContain(
      "Long-run clarification blocker trend is rising: approval:rising(0->1).",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_clarification_profile=environment_variable",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_clarification_mix=environment_variable:3,approval:1",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_clarification_trends=environment_variable:falling(2->1),approval:rising(0->1)",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_clarification_trend_policy=observe",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "quality_clarification_trend_policy=observe",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "clarification_trend_policy_alignment=aligned",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "clarification_trend_policy_status=observe_only",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "cross_layer_trend_policy_status=consistent",
    );
  });

  it("can fail the quality gate on a rising long-run clarification blocker trend", () => {
    const clarificationState = buildAgenticExecutionState({
      messages: [
        {
          role: "user",
          content: "Resume the production deployment once the prerequisite is available.",
          timestamp: Date.now(),
        },
      ],
      toolSignals: [
        {
          toolName: "exec",
          status: "error",
          summary: "Missing required prerequisite for deployment.",
        },
      ],
      memorySystemPromptAddition: [
        "Integrated memory packet",
        "Agentic regression guidance:",
        "- reasons=missing_information:approval trend=watch",
      ].join("\n"),
    });

    const report = runAgenticQualityGate({
      failOnClarificationTrend: true,
      diagnosticsOverride: inspectAgenticExecutionObservability(clarificationState),
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
        clarificationProfileCounts: ["environment_variable:2", "approval:1"],
        dominantClarificationProfile: "environment_variable",
        clarificationTrendSignals: ["approval:rising(0->1)"],
        clarificationTrendPolicy: "observe",
        summary: "agentic soak 0/0 passed",
      },
    });

    expect(report.passed).toBe(false);
    expect(report.diagnosticsPassed).toBe(false);
    expect(report.failReasons).toContain("diagnostics_clarification_trend_approval");
    expect(report.recommendations).toContain(
      "Long-run clarification blocker trend is rising: approval:rising(0->1).",
    );
    expect(report.recommendations).toContain(
      "Clarification trend policy diverges from soak trend policy: quality=blocking soak=observe.",
    );
    expect(report.clarificationTrendPolicy).toBe("blocking");
    expect(report.soakClarificationTrendPolicy).toBe("observe");
    expect(report.clarificationTrendPolicyAlignment).toBe("drift");
    expect(report.clarificationTrendPolicyStatus).toBe("blocking");
    expect(report.crossLayerTrendPolicyStatus).toBe("divergent");
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "soak_clarification_trend_policy=observe",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "quality_clarification_trend_policy=blocking",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "clarification_trend_policy_alignment=drift",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "clarification_trend_policy_status=blocking",
    );
    expect(formatAgenticQualityGateReport(report, "summary")).toContain(
      "cross_layer_trend_policy_status=divergent",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Soak clarification trend policy: observe",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Quality clarification trend policy: blocking",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Clarification trend policy alignment: drift",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Clarification trend policy status: blocking",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "Cross-layer trend policy status: divergent",
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

  it("keeps durable family-trend recommendations aligned with live consolidation mode", () => {
    const templateDiagnostics = inspectAgenticExecutionObservability({
      taskState: {
        version: 1,
        taskMode: "debugging",
        objective: "Template a durable diagnostics family",
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
      memoryTrend: {
        trend: "stable",
        templateFamilies: ["diagnostics@debugging/node"],
      },
    });
    expect(templateReport.recommendations).toContain(
      "Template-ready consolidation is active; parameterize the stable workflow instead of creating a new fork.",
    );
    expect(templateReport.recommendations).toContain(
      "Memory-backed template-ready families: diagnostics@debugging/node.",
    );

    const mergeDiagnostics = {
      ...templateDiagnostics,
      mergeCandidate: true,
      mergeSkills: ["memory-diagnostics", "diagnostics-report"],
    };
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
        trend: "stable",
        mergeFamilies: ["diagnostics@debugging/node"],
      },
    });
    expect(mergeReport.recommendations).toContain(
      "Merge-ready consolidation is active for sibling skills: memory-diagnostics, diagnostics-report.",
    );
    expect(mergeReport.recommendations).toContain(
      "Memory-backed merge-ready families: diagnostics@debugging/node.",
    );
  });

  it("keeps failure-derived family trends aligned with later release-gate recommendations", () => {
    const failureDerivedMergeDiagnostics = inspectAgenticExecutionObservability({
      taskState: {
        version: 1,
        taskMode: "debugging",
        objective: "Recover from repeated diagnostics overlap failures",
        subtasks: [],
        blockers: ["diagnostics validation failed again"],
        assumptions: [],
        successCriteria: [],
        planSteps: [],
        activeArtifacts: [],
        confidence: "low",
      },
      verificationState: {
        version: 1,
        outcome: "failed",
        goalSatisfaction: "unsatisfied",
        evidence: [],
        goalSignals: [],
        checksRun: [],
        failingChecks: [],
        unresolvedCriteria: [],
        failureClasses: ["verification_failure"],
      },
      plannerState: {
        version: 1,
        status: "needs_replan",
        alternativeSkills: ["diagnostics-report"],
        retryClass: "skill_fallback",
        suggestedSkill: "diagnostics-report",
        shouldEscalate: false,
      },
      governanceState: {
        version: 1,
        autonomyMode: "fallback",
        riskLevel: "medium",
        approvalRequired: false,
        secretPromptDetected: false,
        destructiveActionDetected: false,
        reasons: [],
      },
      orchestrationState: {
        version: 1,
        primarySkill: "diagnostics-report",
        fallbackSkills: ["memory-diagnostics"],
        skillChain: ["diagnostics-report", "memory-diagnostics"],
        workflowSteps: [
          { skill: "diagnostics-report", role: "primary" },
          { skill: "memory-diagnostics", role: "fallback" },
        ],
        rankedSkills: ["diagnostics-report", "memory-diagnostics"],
        effectiveSkills: [],
        effectiveFamilies: [],
        promotedSkills: [],
        prerequisiteWarnings: [],
        capabilityGaps: [],
        hasViableFallback: true,
        multiSkillCandidate: true,
        chainedWorkflow: false,
        skillFamilies: ["diagnostics"],
        overlappingSkills: ["diagnostics-report", "memory-diagnostics"],
        mergeCandidate: true,
        mergeSkills: ["diagnostics-report", "memory-diagnostics"],
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
        failurePattern: "blocked_path",
        learnFromFailure: true,
        failureReasons: ["verification_failure"],
        missingCapabilities: [],
      },
    });
    const failureDerivedMergeReport = runAgenticQualityGate({
      diagnosticsOverride: failureDerivedMergeDiagnostics,
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
    expect(failureDerivedMergeReport.recommendations).toContain(
      "Merge-ready consolidation is active for sibling skills: diagnostics-report, memory-diagnostics.",
    );
    expect(failureDerivedMergeReport.recommendations).toContain(
      "Memory-backed merge-ready families: diagnostics@debugging/node.",
    );

    const failureDerivedTemplateDiagnostics = inspectAgenticExecutionObservability({
      taskState: {
        version: 1,
        taskMode: "debugging",
        objective: "Recover the acceptance workflow without another fork",
        subtasks: [],
        blockers: ["acceptance workflow still needs refinement"],
        assumptions: [],
        successCriteria: [],
        planSteps: [],
        activeArtifacts: [],
        confidence: "low",
      },
      verificationState: {
        version: 1,
        outcome: "failed",
        goalSatisfaction: "unsatisfied",
        evidence: [],
        goalSignals: [],
        checksRun: [],
        failingChecks: [],
        unresolvedCriteria: [],
        failureClasses: ["verification_failure"],
      },
      plannerState: {
        version: 1,
        status: "needs_replan",
        alternativeSkills: [],
        retryClass: "same_path_retry",
        shouldEscalate: false,
      },
      governanceState: {
        version: 1,
        autonomyMode: "continue",
        riskLevel: "medium",
        approvalRequired: false,
        secretPromptDetected: false,
        destructiveActionDetected: false,
        reasons: [],
      },
      orchestrationState: {
        version: 1,
        primarySkill: "acceptance-report",
        fallbackSkills: [],
        skillChain: ["acceptance-report"],
        workflowSteps: [{ skill: "acceptance-report", role: "primary" }],
        rankedSkills: ["acceptance-report"],
        effectiveSkills: [],
        effectiveFamilies: [],
        promotedSkills: [],
        prerequisiteWarnings: [],
        capabilityGaps: [],
        hasViableFallback: true,
        multiSkillCandidate: false,
        chainedWorkflow: false,
        skillFamilies: ["verification"],
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
        failurePattern: "near_miss",
        learnFromFailure: true,
        failureReasons: ["verification_failure"],
        missingCapabilities: [],
      },
    });
    const failureDerivedTemplateReport = runAgenticQualityGate({
      diagnosticsOverride: failureDerivedTemplateDiagnostics,
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
    expect(failureDerivedTemplateReport.recommendations).toContain(
      "Template-ready consolidation is active; parameterize the stable workflow instead of creating a new fork.",
    );
    expect(failureDerivedTemplateReport.recommendations).toContain(
      "Memory-backed template-ready families: verification@debugging/node.",
    );
  });
});
