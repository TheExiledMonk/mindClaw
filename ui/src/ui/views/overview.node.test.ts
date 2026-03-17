import { describe, expect, it } from "vitest";
import { ConnectErrorDetailCodes } from "../../../../src/gateway/protocol/connect-error-details.js";
import { resolveAuthHintKind, shouldShowPairingHint } from "./overview-hints.ts";
import { buildMemoryExplorerLayout } from "./overview.ts";

describe("shouldShowPairingHint", () => {
  it("returns true for 'pairing required' close reason", () => {
    expect(shouldShowPairingHint(false, "disconnected (1008): pairing required")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(shouldShowPairingHint(false, "Pairing Required")).toBe(true);
  });

  it("returns false when connected", () => {
    expect(shouldShowPairingHint(true, "disconnected (1008): pairing required")).toBe(false);
  });

  it("returns false when lastError is null", () => {
    expect(shouldShowPairingHint(false, null)).toBe(false);
  });

  it("returns false for unrelated errors", () => {
    expect(shouldShowPairingHint(false, "disconnected (1006): no reason")).toBe(false);
  });

  it("returns false for auth errors", () => {
    expect(shouldShowPairingHint(false, "disconnected (4008): unauthorized")).toBe(false);
  });

  it("returns true for structured pairing code", () => {
    expect(
      shouldShowPairingHint(
        false,
        "disconnected (4008): connect failed",
        ConnectErrorDetailCodes.PAIRING_REQUIRED,
      ),
    ).toBe(true);
  });
});

describe("resolveAuthHintKind", () => {
  it("returns required for structured auth-required codes", () => {
    expect(
      resolveAuthHintKind({
        connected: false,
        lastError: "disconnected (4008): connect failed",
        lastErrorCode: ConnectErrorDetailCodes.AUTH_TOKEN_MISSING,
        hasToken: false,
        hasPassword: false,
      }),
    ).toBe("required");
  });

  it("returns failed for structured auth mismatch codes", () => {
    expect(
      resolveAuthHintKind({
        connected: false,
        lastError: "disconnected (4008): connect failed",
        lastErrorCode: ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH,
        hasToken: true,
        hasPassword: false,
      }),
    ).toBe("failed");
  });

  it("does not treat generic connect failures as auth failures", () => {
    expect(
      resolveAuthHintKind({
        connected: false,
        lastError: "disconnected (4008): connect failed",
        lastErrorCode: ConnectErrorDetailCodes.CONTROL_UI_DEVICE_IDENTITY_REQUIRED,
        hasToken: true,
        hasPassword: false,
      }),
    ).toBeNull();
  });

  it("falls back to unauthorized string matching without structured codes", () => {
    expect(
      resolveAuthHintKind({
        connected: false,
        lastError: "disconnected (4008): unauthorized",
        lastErrorCode: null,
        hasToken: true,
        hasPassword: false,
      }),
    ).toBe("failed");
  });
});

describe("buildMemoryExplorerLayout", () => {
  it("places memory and artifact nodes into a stable overview graph layout", () => {
    const layout = buildMemoryExplorerLayout({
      generatedAt: 1,
      workspaceDir: "/tmp/workspace",
      sessionId: "main",
      totalNodes: 3,
      totalEdges: 2,
      visibleNodeCount: 3,
      visibleEdgeCount: 2,
      recommendations: [],
      nodes: [
        {
          id: "ltm-1",
          kind: "memory",
          category: "fact",
          summary: "CPA metrics",
          confidence: 0.9,
          activeStatus: "active",
          updatedAt: 1,
          degree: 2,
          connectedNodeIds: ["ltm-2", "artifact-1"],
          relationTypes: ["linked_to"],
        },
        {
          id: "ltm-2",
          kind: "memory",
          category: "strategy",
          summary: "Campaign optimization",
          confidence: 0.85,
          activeStatus: "active",
          updatedAt: 2,
          degree: 1,
          connectedNodeIds: ["ltm-1"],
          relationTypes: ["linked_to"],
        },
        {
          id: "artifact-1",
          kind: "artifact",
          category: "episode",
          summary: "Raw course dump",
          confidence: 0.7,
          activeStatus: "active",
          updatedAt: 3,
          degree: 1,
          connectedNodeIds: ["ltm-1"],
          relationTypes: ["derived_from"],
          artifactRef: "mindclaw_memory://artifacts/raw-course.md",
        },
      ],
      edges: [
        { from: "ltm-1", to: "ltm-2", type: "linked_to", weight: 0.8, updatedAt: 1 },
        { from: "ltm-1", to: "artifact-1", type: "derived_from", weight: 0.7, updatedAt: 1 },
      ],
    });

    expect(layout).toHaveLength(3);
    expect(layout.find((node) => node.id === "ltm-1")?.r).toBeGreaterThan(10);
    expect(layout.find((node) => node.id === "artifact-1")?.y).toBeDefined();
  });
});
