import type { OpenClawPluginApi } from "openclaw/plugin-sdk/memory-core";
import { describe, expect, it, vi } from "vitest";
import { createTestPluginApi } from "../test-utils/plugin-api.js";
import { createPluginRuntimeMock } from "../test-utils/plugin-runtime-mock.js";
import plugin from "./index.js";

describe("memory-core plugin registration", () => {
  it("registers search, get, delete, and store tools", () => {
    const runtime = createPluginRuntimeMock();
    const memorySearchTool = { name: "memory_search" } as never;
    const memoryCheckpointTool = { name: "memory_checkpoint" } as never;
    const memorySchemaTool = { name: "memory_schema" } as never;
    const memoryGetTool = { name: "memory_get" } as never;
    const memoryDeleteTool = { name: "memory_delete" } as never;
    const memoryStoreTool = { name: "memory_store" } as never;
    const registerTool = vi.fn();

    vi.mocked(runtime.tools.createMemorySearchTool).mockReturnValue(memorySearchTool);
    vi.mocked(runtime.tools.createMemoryCheckpointTool).mockReturnValue(memoryCheckpointTool);
    vi.mocked(runtime.tools.createMemorySchemaTool).mockReturnValue(memorySchemaTool);
    vi.mocked(runtime.tools.createMemoryGetTool).mockReturnValue(memoryGetTool);
    vi.mocked(runtime.tools.createMemoryDeleteTool).mockReturnValue(memoryDeleteTool);
    vi.mocked(runtime.tools.createMemoryStoreTool).mockReturnValue(memoryStoreTool);

    plugin.register?.(
      createTestPluginApi({
        id: "memory-core",
        name: "Memory (Core)",
        description: "Memory",
        source: "test",
        config: {},
        runtime,
        registerTool,
      }) as unknown as OpenClawPluginApi,
    );

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool.mock.calls[0]?.[1]).toMatchObject({
      names: [
        "memory_search",
        "memory_checkpoint",
        "memory_schema",
        "memory_get",
        "memory_delete",
        "memory_store",
      ],
    });

    const factory = registerTool.mock.calls[0]?.[0];
    const result = factory?.({ config: {}, sessionKey: "session:test" });
    expect(result).toEqual([
      memorySearchTool,
      memoryCheckpointTool,
      memorySchemaTool,
      memoryGetTool,
      memoryDeleteTool,
      memoryStoreTool,
    ]);

    expect(runtime.tools.createMemorySearchTool).toHaveBeenCalledWith({
      config: {},
      agentSessionKey: "session:test",
    });
    expect(runtime.tools.createMemoryCheckpointTool).toHaveBeenCalledWith({
      config: {},
      agentSessionKey: "session:test",
    });
    expect(runtime.tools.createMemoryGetTool).toHaveBeenCalledWith({
      config: {},
      agentSessionKey: "session:test",
    });
    expect(runtime.tools.createMemoryDeleteTool).toHaveBeenCalledWith({
      config: {},
      agentSessionKey: "session:test",
    });
    expect(runtime.tools.createMemorySchemaTool).toHaveBeenCalledWith({
      config: {},
      agentSessionKey: "session:test",
    });
    expect(runtime.tools.createMemoryStoreTool).toHaveBeenCalledWith({
      config: {},
      agentSessionKey: "session:test",
    });
  });
});
