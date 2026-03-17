import type { OpenClawPluginApi } from "openclaw/plugin-sdk/memory-core";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/memory-core";

const memoryCorePlugin = {
  id: "memory-core",
  name: "Memory (Core)",
  description: "File-backed memory search tools and CLI",
  kind: "memory",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerTool(
      (ctx) => {
        const memorySearchTool = api.runtime.tools.createMemorySearchTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        const memoryCheckpointTool = api.runtime.tools.createMemoryCheckpointTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        const memorySchemaTool = api.runtime.tools.createMemorySchemaTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        const memoryGetTool = api.runtime.tools.createMemoryGetTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        const memoryDeleteTool = api.runtime.tools.createMemoryDeleteTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        const memoryStoreTool = api.runtime.tools.createMemoryStoreTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        if (
          !memorySearchTool ||
          !memoryCheckpointTool ||
          !memorySchemaTool ||
          !memoryGetTool ||
          !memoryDeleteTool ||
          !memoryStoreTool
        ) {
          return null;
        }
        return [
          memorySearchTool,
          memoryCheckpointTool,
          memorySchemaTool,
          memoryGetTool,
          memoryDeleteTool,
          memoryStoreTool,
        ];
      },
      {
        names: [
          "memory_search",
          "memory_checkpoint",
          "memory_schema",
          "memory_get",
          "memory_delete",
          "memory_store",
        ],
      },
    );

    api.registerCli(
      ({ program }) => {
        api.runtime.tools.registerMemoryCli(program);
      },
      { commands: ["memory"] },
    );
  },
};

export default memoryCorePlugin;
