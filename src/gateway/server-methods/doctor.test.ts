import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";

const loadConfig = vi.hoisted(() => vi.fn(() => ({}) as OpenClawConfig));
const resolveDefaultAgentId = vi.hoisted(() => vi.fn(() => "main"));
const resolveAgentWorkspaceDir = vi.hoisted(() => vi.fn(() => "/tmp/workspace"));
const getMemorySearchManager = vi.hoisted(() => vi.fn());
const generateMemoryDiagnosticsReport = vi.hoisted(() => vi.fn());
const getMemoryBackgroundWorkerStats = vi.hoisted(() =>
  vi.fn(() => ({
    queued: 1,
    completed: 2,
    failed: 0,
    active: 0,
    maintenanceRuns: 1,
    lastReason: "memory-store",
  })),
);

vi.mock("../../config/config.js", () => ({
  loadConfig,
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveDefaultAgentId,
  resolveAgentWorkspaceDir,
}));

vi.mock("../../memory/index.js", () => ({
  getMemorySearchManager,
}));

vi.mock("../../context-engine/memory-system-store.js", () => ({
  generateMemoryDiagnosticsReport,
}));

vi.mock("../../context-engine/memory-system-worker.js", () => ({
  getMemoryBackgroundWorkerStats,
}));

import { doctorHandlers } from "./doctor.js";

const invokeDoctorMemoryStatus = async (respond: ReturnType<typeof vi.fn>) => {
  await doctorHandlers["doctor.memory.status"]({
    req: {} as never,
    params: {} as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
};

const invokeDoctorMemoryDiagnostics = async (
  respond: ReturnType<typeof vi.fn>,
  params?: Record<string, unknown>,
) => {
  await doctorHandlers["doctor.memory.diagnostics"]({
    req: {} as never,
    params: (params ?? {}) as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
};

const expectEmbeddingErrorResponse = (respond: ReturnType<typeof vi.fn>, error: string) => {
  expect(respond).toHaveBeenCalledWith(
    true,
    {
      agentId: "main",
      embedding: {
        ok: false,
        error,
      },
    },
    undefined,
  );
};

describe("doctor.memory.status", () => {
  beforeEach(() => {
    loadConfig.mockClear();
    resolveDefaultAgentId.mockClear();
    resolveAgentWorkspaceDir.mockClear();
    getMemorySearchManager.mockReset();
    generateMemoryDiagnosticsReport.mockReset();
    getMemoryBackgroundWorkerStats.mockClear();
  });

  it("returns gateway embedding probe status for the default agent", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    getMemorySearchManager.mockResolvedValue({
      manager: {
        status: () => ({ provider: "gemini" }),
        probeEmbeddingAvailability: vi.fn().mockResolvedValue({ ok: true }),
        close,
      },
    });
    const respond = vi.fn();

    await invokeDoctorMemoryStatus(respond);

    expect(getMemorySearchManager).toHaveBeenCalledWith({
      cfg: expect.any(Object),
      agentId: "main",
      purpose: "status",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        agentId: "main",
        provider: "gemini",
        embedding: { ok: true },
      },
      undefined,
    );
    expect(close).toHaveBeenCalled();
  });

  it("returns unavailable when memory manager is missing", async () => {
    getMemorySearchManager.mockResolvedValue({
      manager: null,
      error: "memory search unavailable",
    });
    const respond = vi.fn();

    await invokeDoctorMemoryStatus(respond);

    expectEmbeddingErrorResponse(respond, "memory search unavailable");
  });

  it("returns probe failure when manager probe throws", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    getMemorySearchManager.mockResolvedValue({
      manager: {
        status: () => ({ provider: "openai" }),
        probeEmbeddingAvailability: vi.fn().mockRejectedValue(new Error("timeout")),
        close,
      },
    });
    const respond = vi.fn();

    await invokeDoctorMemoryStatus(respond);

    expectEmbeddingErrorResponse(respond, "gateway memory probe failed: timeout");
    expect(close).toHaveBeenCalled();
  });
});

describe("doctor.memory.diagnostics", () => {
  beforeEach(() => {
    loadConfig.mockClear();
    resolveDefaultAgentId.mockClear();
    resolveAgentWorkspaceDir.mockClear();
    generateMemoryDiagnosticsReport.mockReset();
    getMemoryBackgroundWorkerStats.mockClear();
  });

  it("returns diagnostics for the requested session", async () => {
    generateMemoryDiagnosticsReport.mockResolvedValue({
      summary: "backend=fs-json | recommendations=1",
      health: { summary: "healthy", recommendations: [] },
      retrieval: {
        summary: "retrieval ok",
        taskMode: "coding",
        retrievalItemCount: 3,
        longTermItemCount: 2,
        permanentItemCount: 1,
        contradictionItemCount: 0,
        downgradedItemCount: 0,
        contestedItemCount: 0,
        scopedAlternativeItemCount: 0,
        artifactAnchoredItemCount: 0,
        entityMatchedItemCount: 1,
        authoritativeWinnerItemCount: 0,
        summaryDerivedItemCount: 0,
        permanentSourceAnchorCount: 1,
        topicMatchedItemCount: 2,
        accessedConceptCount: 2,
        topReasons: ["topic"],
        skippedReasonCounts: {},
        supersededSamples: [],
      },
      generatedAt: 1,
      workspaceDir: "/tmp/workspace",
      sessionId: "research",
      backendKind: "fs-json",
      failedAcceptanceScenarios: [],
      recommendations: ["keep memory lean"],
    });
    const respond = vi.fn();

    await invokeDoctorMemoryDiagnostics(respond, { sessionKey: "research" });

    expect(resolveAgentWorkspaceDir).toHaveBeenCalledWith(expect.any(Object), "main");
    expect(generateMemoryDiagnosticsReport).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      sessionId: "research",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        agentId: "main",
        workspaceDir: "/tmp/workspace",
        report: expect.objectContaining({ sessionId: "research" }),
        worker: expect.objectContaining({ completed: 2, maintenanceRuns: 1 }),
      },
      undefined,
    );
  });
});
