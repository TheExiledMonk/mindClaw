import { describe, expect, it } from "vitest";
import { formatAgenticSoakReport, runAgenticSoakSuite } from "./agentic-state.js";

describe("agentic soak suite", () => {
  it("passes the built-in soak scenarios", () => {
    const report = runAgenticSoakSuite();
    expect(report.passed).toBe(true);
    expect(report.totalScenarios).toBeGreaterThanOrEqual(10);
    expect(report.failedScenarioIds).toEqual([]);

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
  });

  it("formats the soak report in summary and markdown forms", () => {
    const report = runAgenticSoakSuite();
    expect(formatAgenticSoakReport(report, "summary")).toContain("agentic soak");
    expect(formatAgenticSoakReport(report, "markdown")).toContain("# Agentic Soak Report");
    expect(formatAgenticSoakReport(report, "markdown")).toContain(
      "## retry_replan_recover_complete",
    );
  });
});
