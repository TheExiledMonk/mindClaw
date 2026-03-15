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
    expect(report.scenarioCount).toBeGreaterThanOrEqual(4);
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
});
