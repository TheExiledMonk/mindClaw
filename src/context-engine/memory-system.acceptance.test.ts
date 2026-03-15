import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runMemoryAcceptanceSuite } from "./memory-system-store.js";

describe("memory system acceptance suite", () => {
  it("passes the built-in acceptance scenarios across fs-json and sqlite-graph", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-acceptance-"));

    const report = await runMemoryAcceptanceSuite({
      workspaceDir: tempDir,
      sessionIdPrefix: "acceptance-main",
      backendKinds: ["fs-json", "sqlite-graph"],
    });

    expect(report.passed).toBe(true);
    expect(report.scenarioCount).toBeGreaterThanOrEqual(9);
    expect(report.failedCount).toBe(0);
    expect(report.summary).toContain("acceptance");
    expect(report.scenarios.every((scenario) => scenario.details.length > 0)).toBe(true);
  });

  it("reports backend parity as a first-class acceptance scenario", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-acceptance-"));

    const report = await runMemoryAcceptanceSuite({
      workspaceDir: tempDir,
      sessionIdPrefix: "acceptance-parity",
      backendKinds: ["fs-json", "sqlite-graph"],
    });

    const parity = report.scenarios.find((scenario) => scenario.scenario === "backend_parity");
    expect(parity).toBeTruthy();
    expect(parity?.passed).toBe(true);
    expect(parity?.summary).toContain("parity=");
  });

  it("includes runtime lifecycle and permanence invalidation scenarios", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-acceptance-"));

    const report = await runMemoryAcceptanceSuite({
      workspaceDir: tempDir,
      sessionIdPrefix: "acceptance-lifecycle",
      backendKinds: ["fs-json", "sqlite-graph"],
    });

    const runtime = report.scenarios.find((scenario) => scenario.scenario === "runtime_lifecycle");
    const invalidation = report.scenarios.find(
      (scenario) => scenario.scenario === "permanence_invalidation",
    );

    expect(runtime?.passed).toBe(true);
    expect(runtime?.summary).toContain("branch=");
    expect(invalidation?.passed).toBe(true);
    expect(invalidation?.summary).toContain("superseded=");
  });

  it("includes entity resolution, handoff continuity, and store recovery scenarios", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-acceptance-"));

    const report = await runMemoryAcceptanceSuite({
      workspaceDir: tempDir,
      sessionIdPrefix: "acceptance-entity-recovery",
      backendKinds: ["fs-json", "sqlite-graph"],
    });

    const entityResolution = report.scenarios.find(
      (scenario) => scenario.scenario === "entity_resolution",
    );
    const handoff = report.scenarios.find(
      (scenario) => scenario.scenario === "session_handoff_continuity",
    );
    const storeRecovery = report.scenarios.find(
      (scenario) => scenario.scenario === "store_recovery",
    );

    expect(entityResolution?.passed).toBe(true);
    expect(entityResolution?.summary).toContain("entity-visible=");
    expect(handoff?.passed).toBe(true);
    expect(handoff?.summary).toContain("handoff long-term=");
    expect(storeRecovery?.passed).toBe(true);
    expect(storeRecovery?.summary).toContain("recovered-long-term=");
  });
});
