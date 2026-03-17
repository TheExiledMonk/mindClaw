import {
  createMemoryCheckpointTool,
  createMemoryDeleteTool,
  createMemoryGetTool,
  createMemorySchemaTool,
  createMemorySearchTool,
  createMemoryStoreTool,
} from "../../agents/tools/memory-tool.js";
import { registerMemoryCli } from "../../cli/memory-cli.js";
import type { PluginRuntime } from "./types.js";

export function createRuntimeTools(): PluginRuntime["tools"] {
  return {
    createMemoryCheckpointTool,
    createMemoryGetTool,
    createMemoryDeleteTool,
    createMemorySchemaTool,
    createMemorySearchTool,
    createMemoryStoreTool,
    registerMemoryCli,
  };
}
