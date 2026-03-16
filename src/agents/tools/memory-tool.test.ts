import { beforeEach, describe, it, vi } from "vitest";
import {
  createMemorySearchToolOrThrow,
  expectUnavailableMemorySearchDetails,
} from "./memory-tool.test-helpers.js";

vi.mock("../../context-engine/memory-system-store.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../context-engine/memory-system-store.js")
  >("../../context-engine/memory-system-store.js");
  return {
    ...actual,
    loadMemoryStoreSnapshot: vi.fn(),
  };
});

describe("memory_search unavailable payloads", () => {
  beforeEach(async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.loadMemoryStoreSnapshot).mockReset();
  });

  it("returns explicit unavailable metadata for integrated store failures", async () => {
    const mod = await import("../../context-engine/memory-system-store.js");
    vi.mocked(mod.loadMemoryStoreSnapshot).mockRejectedValue(
      new Error("integrated memory store unavailable"),
    );

    const tool = createMemorySearchToolOrThrow();
    const result = await tool.execute("store-failure", { query: "hello" });
    expectUnavailableMemorySearchDetails(result.details, {
      error: "integrated memory store unavailable",
      warning: "Memory search is unavailable due to an embedding/provider error.",
      action: "Check embedding provider configuration and retry memory_search.",
    });
  });
});
