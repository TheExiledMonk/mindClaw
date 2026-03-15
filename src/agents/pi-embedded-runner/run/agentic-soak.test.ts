import { describe, expect, it } from "vitest";
import { formatAgenticSoakReport, runAgenticSoakSuite } from "./agentic-state.js";

describe("agentic soak suite", () => {
  it("passes the built-in soak scenarios", () => {
    const report = runAgenticSoakSuite();
    expect(report.passed).toBe(true);
    expect(report.totalScenarios).toBeGreaterThanOrEqual(10);
    expect(report.failedScenarioIds).toEqual([]);
    expect(report.dominantClarificationProfile).toBe("mixed");
    expect(report.clarificationProfileCounts).toContain("environment_variable:2");
    expect(report.clarificationProfileCounts).toContain("approval:2");
    expect(report.clarificationProfileCounts).toContain("external_input:1");
    expect(report.clarificationTrendSignals).toContain("environment_variable:steady(1->1)");
    expect(report.clarificationTrendSignals).toContain("approval:steady(1->1)");
    expect(report.clarificationTrendSignals).toContain("external_input:rising(0->1)");
    expect(report.clarificationTrendPolicy).toBe("observe");
    expect(report.clarificationTrendPolicyStatus).toBe("observe_only");
    expect(report.trendPolicyPromotionStatus).toBe("promotion_safe");
    expect(report.environmentBoundaryStatus).toBe("bounded_and_guarded");
    expect(report.handoffResumabilityStatus).toBe("guarded_resume_paths");
    expect(report.resumeBarrierCounts).toContain("operator_approval:1");
    expect(report.resumeBarrierCounts).toContain("generic_prerequisite:1");
    expect(report.dominantResumeBarrierProfile).toBe("none");

    const retryLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "retry_replan_recover_complete",
    );
    expect(retryLifecycle?.phases[0]?.retryClass).toBe("skill_fallback");
    expect(retryLifecycle?.phases.at(-1)?.goalSatisfaction).toBe("satisfied");

    const handoffLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "handoff_resume_completion",
    );
    expect(handoffLifecycle?.phases[0]?.pendingHandoffSteps).toBeGreaterThan(0);
    expect(handoffLifecycle?.phases.at(-1)?.pendingHandoffSteps).toBe(0);

    const effectivenessLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "effectiveness_drift_recovery",
    );
    expect(effectivenessLifecycle?.phases[0]?.passed).toBe(true);
    expect(effectivenessLifecycle?.phases.at(-1)?.passed).toBe(true);

    const recoveredWatchLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "recovered_watch_stabilization",
    );
    expect(recoveredWatchLifecycle?.phases[0]?.passed).toBe(true);
    expect(recoveredWatchLifecycle?.phases.at(-1)?.passed).toBe(true);
    expect(recoveredWatchLifecycle?.phases.at(-1)?.details).toContain(
      "Promote stabilized scoped skills for stable reuse or extend-existing decisions.",
    );

    const consolidationLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "consolidation_mode_transition",
    );
    expect(consolidationLifecycle?.phases[0]?.passed).toBe(true);
    expect(consolidationLifecycle?.phases.at(-1)?.passed).toBe(true);
    expect(consolidationLifecycle?.phases[0]?.details).toContain(
      "Memory-backed template-ready families: diagnostics@general/node.",
    );
    expect(consolidationLifecycle?.phases.at(-1)?.details).toContain(
      "Merge-ready consolidation is active for sibling skills:",
    );
    expect(consolidationLifecycle?.phases.at(-1)?.details).toContain(
      "Memory-backed merge-ready families: diagnostics@general/node.",
    );

    const failureDerivedLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "failure_derived_consolidation_replan",
    );
    expect(failureDerivedLifecycle?.phases[0]?.passed).toBe(true);
    expect(failureDerivedLifecycle?.phases.at(-1)?.passed).toBe(true);
    expect(failureDerivedLifecycle?.phases[0]?.details).toContain(
      "Memory-backed merge-ready families: diagnostics@debugging/node.",
    );
    expect(failureDerivedLifecycle?.phases.at(-1)?.details).toContain(
      "Memory-backed template-ready families: verification@debugging/node.",
    );

    const environmentGuardLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "environment_guarded_retry_lifecycle",
    );
    expect(environmentGuardLifecycle?.phases[0]?.passed).toBe(true);
    expect(environmentGuardLifecycle?.phases.at(-1)?.passed).toBe(true);
    expect(environmentGuardLifecycle?.phases[0]?.details).toContain(
      "Protected-branch or high-risk mutation work requires approval before continuing.",
    );
    expect(environmentGuardLifecycle?.phases.at(-1)?.details).toContain(
      "Capture an observed validation command before allowing another retry on project work.",
    );

    const guardedHandoffLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "guarded_handoff_boundary",
    );
    expect(guardedHandoffLifecycle?.phases[0]?.passed).toBe(true);
    expect(guardedHandoffLifecycle?.phases.at(-1)?.passed).toBe(true);
    expect(guardedHandoffLifecycle?.phases[0]?.resumabilityStatus).toBe("approval_gated");
    expect(guardedHandoffLifecycle?.phases.at(-1)?.resumabilityStatus).toBe("prerequisite_gated");
    expect(guardedHandoffLifecycle?.phases[0]?.resumeBarrierProfile).toBe("operator_approval");
    expect(guardedHandoffLifecycle?.phases.at(-1)?.resumeBarrierProfile).toBe(
      "generic_prerequisite",
    );
    expect(guardedHandoffLifecycle?.phases[0]?.details).toContain("Resume after approval");
    expect(guardedHandoffLifecycle?.phases.at(-1)?.details).toContain(
      "Resume after prerequisites are restored",
    );

    const conciseProgressLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "concise_progress_resume_boundary",
    );
    expect(conciseProgressLifecycle?.phases[0]?.passed).toBe(true);
    expect(conciseProgressLifecycle?.phases.at(-1)?.passed).toBe(true);
    expect(conciseProgressLifecycle?.phases[0]?.details).toContain("progress=");
    expect(conciseProgressLifecycle?.phases.at(-1)?.details).toContain("completed=");

    const clarificationLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "clarification_resume_boundary",
    );
    expect(clarificationLifecycle?.phases[0]?.passed).toBe(true);
    expect(clarificationLifecycle?.phases.at(-1)?.passed).toBe(true);
    expect(clarificationLifecycle?.phases[0]?.details).toContain("config/runtime.json");
    expect(clarificationLifecycle?.phases.at(-1)?.details).toContain("clarification=none");

    const richClarificationLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "rich_clarification_resume_boundary",
    );
    expect(richClarificationLifecycle?.phases[0]?.passed).toBe(true);
    expect(richClarificationLifecycle?.phases[1]?.passed).toBe(true);
    expect(richClarificationLifecycle?.phases[2]?.passed).toBe(true);
    expect(richClarificationLifecycle?.phases[3]?.passed).toBe(true);
    expect(richClarificationLifecycle?.phases[0]?.details).toContain(
      "environment variable OPENAI_API_KEY",
    );
    expect(richClarificationLifecycle?.phases[1]?.details).toContain("clarification=none");
    expect(richClarificationLifecycle?.phases[2]?.details).toContain(
      "operator approval for production deployment",
    );
    expect(richClarificationLifecycle?.phases[3]?.details).toContain("clarification=none");

    const memoryBackedClarificationLifecycle = report.scenarios.find(
      (scenario) => scenario.id === "memory_backed_clarification_reporting_boundary",
    );
    expect(memoryBackedClarificationLifecycle?.phases[0]?.passed).toBe(true);
    expect(memoryBackedClarificationLifecycle?.phases[0]?.details).toContain(
      "missing_information:environment_variable",
    );
    expect(memoryBackedClarificationLifecycle?.phases[0]?.details).toContain(
      "Configure the missing environment variable before retrying.",
    );
    expect(memoryBackedClarificationLifecycle?.phases[1]?.passed).toBe(true);
    expect(memoryBackedClarificationLifecycle?.phases[1]?.details).toContain(
      "missing_information:approval",
    );
    expect(memoryBackedClarificationLifecycle?.phases[1]?.details).toContain(
      "Obtain the required approval before retrying.",
    );
    expect(memoryBackedClarificationLifecycle?.phases[2]?.passed).toBe(true);
    expect(memoryBackedClarificationLifecycle?.phases[2]?.details).toContain(
      "missing_information:external_input",
    );
    expect(memoryBackedClarificationLifecycle?.phases[2]?.details).toContain(
      "Request the missing external input before retrying.",
    );
  });

  it("formats the soak report in summary and markdown forms", () => {
    const report = runAgenticSoakSuite();
    expect(formatAgenticSoakReport(report, "summary")).toContain("agentic soak");
    expect(formatAgenticSoakReport(report, "summary")).toContain("clarification_profile=mixed");
    expect(formatAgenticSoakReport(report, "summary")).toContain("clarification_mix=");
    expect(formatAgenticSoakReport(report, "summary")).toContain("clarification_trends=");
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "clarification_trend_policy=observe",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "clarification_trend_policy_status=observe_only",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "trend_policy_promotion_status=promotion_safe",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "environment_boundary_status=bounded_and_guarded",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "handoff_resumability_status=guarded_resume_paths",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain("resume_barrier_profile=none");
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "resume_barrier_counts=operator_approval:1,generic_prerequisite:1",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain("# Agentic Soak Report");
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Dominant clarification profile: mixed",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain("Clarification trends:");
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Clarification trend policy: observe",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Clarification trend policy status: observe_only",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Trend policy promotion status: promotion_safe",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Environment boundary status: bounded_and_guarded",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Handoff resumability status: guarded_resume_paths",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain("Resume barrier profile: none");
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Resume barrier counts: operator_approval:1, generic_prerequisite:1",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "## retry_replan_recover_complete",
    );
  });

  it("can mark soak clarification trend policy as blocking when trend gating is enabled", () => {
    const report = runAgenticSoakSuite({
      failOnClarificationTrend: true,
    });

    expect(report.clarificationTrendPolicy).toBe("blocking");
    expect(report.clarificationTrendPolicyStatus).toBe("blocking");
    expect(report.trendPolicyPromotionStatus).toBe("gated_for_trend_watch");
    expect(report.environmentBoundaryStatus).toBe("bounded_and_guarded");
    expect(report.handoffResumabilityStatus).toBe("guarded_resume_paths");
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "clarification_trend_policy=blocking",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "clarification_trend_policy_status=blocking",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "trend_policy_promotion_status=gated_for_trend_watch",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "environment_boundary_status=bounded_and_guarded",
    );
    expect(formatAgenticSoakReport(report, "summary")).toContain(
      "handoff_resumability_status=guarded_resume_paths",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Clarification trend policy: blocking",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Clarification trend policy status: blocking",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Trend policy promotion status: gated_for_trend_watch",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Environment boundary status: bounded_and_guarded",
    );
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "Handoff resumability status: guarded_resume_paths",
    );
  });
});
