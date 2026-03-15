import { describe, expect, it } from "vitest";
import { formatAgenticQualityGateReport, runAgenticQualityGate } from "./agentic-state.js";

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

  it("formats the quality gate report in summary and markdown forms", () => {
    const report = runAgenticQualityGate();
    expect(formatAgenticQualityGateReport(report, "summary")).toContain("agentic quality gate");
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain(
      "# Agentic Quality Gate Report",
    );
    expect(formatAgenticQualityGateReport(report, "markdown")).toContain("## Diagnostics");
  });
});
