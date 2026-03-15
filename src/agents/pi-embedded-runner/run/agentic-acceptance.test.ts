import { describe, expect, it } from "vitest";
import { formatAgenticAcceptanceReport, runAgenticAcceptanceSuite } from "./agentic-state.js";

describe("agentic acceptance suite", () => {
  it("passes the built-in acceptance scenarios", () => {
    const report = runAgenticAcceptanceSuite();
    expect(report.passed).toBe(true);
    expect(report.totalScenarios).toBeGreaterThanOrEqual(32);
    expect(report.failedScenarioIds).toEqual([]);
    const recoveringScenario = report.scenarios.find(
      (scenario) => scenario.id === "recovering_skills_guidance_alignment",
    );
    expect(recoveringScenario?.passed).toBe(true);
    const stableReuseScenario = report.scenarios.find(
      (scenario) => scenario.id === "stable_reuse_observability_alignment",
    );
    expect(stableReuseScenario?.passed).toBe(true);
    const stablePromotionScenario = report.scenarios.find(
      (scenario) => scenario.id === "stable_reuse_promotion_alignment",
    );
    expect(stablePromotionScenario?.passed).toBe(true);
    const promotionGuidanceScenario = report.scenarios.find(
      (scenario) => scenario.id === "promotion_guidance_memory_alignment",
    );
    expect(promotionGuidanceScenario?.passed).toBe(true);
    const templateGuidanceScenario = report.scenarios.find(
      (scenario) => scenario.id === "template_guidance_observability_alignment",
    );
    expect(templateGuidanceScenario?.passed).toBe(true);
    const mergeGuidanceScenario = report.scenarios.find(
      (scenario) => scenario.id === "merge_guidance_observability_alignment",
    );
    expect(mergeGuidanceScenario?.passed).toBe(true);
    const durableTemplateScenario = report.scenarios.find(
      (scenario) => scenario.id === "durable_template_family_quality_alignment",
    );
    expect(durableTemplateScenario?.passed).toBe(true);
    const durableMergeScenario = report.scenarios.find(
      (scenario) => scenario.id === "durable_merge_family_quality_alignment",
    );
    expect(durableMergeScenario?.passed).toBe(true);
    const durableMergeFallbackScenario = report.scenarios.find(
      (scenario) => scenario.id === "durable_merge_family_fallback_alignment",
    );
    expect(durableMergeFallbackScenario?.passed).toBe(true);
    const durableTemplateReplanScenario = report.scenarios.find(
      (scenario) => scenario.id === "durable_template_family_replan_alignment",
    );
    expect(durableTemplateReplanScenario?.passed).toBe(true);
    const failureDerivedMergeScenario = report.scenarios.find(
      (scenario) => scenario.id === "failure_derived_merge_family_alignment",
    );
    expect(failureDerivedMergeScenario?.passed).toBe(true);
    const failureDerivedTemplateScenario = report.scenarios.find(
      (scenario) => scenario.id === "failure_derived_template_family_alignment",
    );
    expect(failureDerivedTemplateScenario?.passed).toBe(true);
    const protectedBranchScenario = report.scenarios.find(
      (scenario) => scenario.id === "protected_branch_governance_alignment",
    );
    expect(protectedBranchScenario?.passed).toBe(true);
    const environmentGuardRetryScenario = report.scenarios.find(
      (scenario) => scenario.id === "environment_guard_retry_alignment",
    );
    expect(environmentGuardRetryScenario?.passed).toBe(true);
    const guardedHandoffScenario = report.scenarios.find(
      (scenario) => scenario.id === "guarded_handoff_alignment",
    );
    expect(guardedHandoffScenario?.passed).toBe(true);
    const conciseProgressScenario = report.scenarios.find(
      (scenario) => scenario.id === "concise_progress_alignment",
    );
    expect(conciseProgressScenario?.passed).toBe(true);
    const clarificationScenario = report.scenarios.find(
      (scenario) => scenario.id === "clarification_alignment",
    );
    expect(clarificationScenario?.passed).toBe(true);
    const nonblockingMissingInformationScenario = report.scenarios.find(
      (scenario) => scenario.id === "nonblocking_missing_information_alignment",
    );
    expect(nonblockingMissingInformationScenario?.passed).toBe(true);
    const clarificationPayloadScenario = report.scenarios.find(
      (scenario) => scenario.id === "clarification_payload_alignment",
    );
    expect(clarificationPayloadScenario?.passed).toBe(true);
    const clarificationStrategyScenario = report.scenarios.find(
      (scenario) => scenario.id === "clarification_strategy_alignment",
    );
    expect(clarificationStrategyScenario?.passed).toBe(true);
    const memoryBackedClarificationScenario = report.scenarios.find(
      (scenario) => scenario.id === "memory_backed_clarification_alignment",
    );
    expect(memoryBackedClarificationScenario?.passed).toBe(true);
  });

  it("formats the acceptance report in summary and markdown forms", () => {
    const report = runAgenticAcceptanceSuite();
    expect(formatAgenticAcceptanceReport(report, "summary")).toContain("agentic acceptance");
    expect(formatAgenticAcceptanceReport(report, "markdown")).toContain(
      "# Agentic Acceptance Report",
    );
  });
});
