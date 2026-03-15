import { describe, expect, it } from "vitest";
import { formatAgenticAcceptanceReport, runAgenticAcceptanceSuite } from "./agentic-state.js";

describe("agentic acceptance suite", () => {
  it("passes the built-in acceptance scenarios", () => {
    const report = runAgenticAcceptanceSuite();
    expect(report.passed).toBe(true);
    expect(report.totalScenarios).toBeGreaterThanOrEqual(10);
    expect(report.failedScenarioIds).toEqual([]);
  });

  it("formats the acceptance report in summary and markdown forms", () => {
    const report = runAgenticAcceptanceSuite();
    expect(formatAgenticAcceptanceReport(report, "summary")).toContain("agentic acceptance");
    expect(formatAgenticAcceptanceReport(report, "markdown")).toContain(
      "# Agentic Acceptance Report",
    );
  });
});
