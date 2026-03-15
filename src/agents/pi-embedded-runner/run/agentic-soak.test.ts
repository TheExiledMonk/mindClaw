import { describe, expect, it } from "vitest";
import { formatAgenticSoakReport, runAgenticSoakSuite } from "./agentic-state.js";

describe("agentic soak suite", () => {
  it("passes the built-in soak scenarios", () => {
    const report = runAgenticSoakSuite();
    expect(report.passed).toBe(true);
    expect(report.totalScenarios).toBeGreaterThanOrEqual(4);
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
