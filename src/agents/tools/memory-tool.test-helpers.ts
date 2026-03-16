import { expect } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import {
  createMemoryGetTool,
  createMemorySearchTool,
  createMemoryStoreTool,
} from "./memory-tool.js";

export function asOpenClawConfig(config: Partial<OpenClawConfig>): OpenClawConfig {
  return config as OpenClawConfig;
}

export function createDefaultMemoryToolConfig(): OpenClawConfig {
  return asOpenClawConfig({ agents: { list: [{ id: "main", default: true }] } });
}

export function createMemorySearchToolOrThrow(params?: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}) {
  const tool = createMemorySearchTool({
    config: params?.config ?? createDefaultMemoryToolConfig(),
    ...(params?.agentSessionKey ? { agentSessionKey: params.agentSessionKey } : {}),
  });
  if (!tool) {
    throw new Error("tool missing");
  }
  return tool;
}

export function createMemoryGetToolOrThrow(
  params?:
    | OpenClawConfig
    | {
        config?: OpenClawConfig;
        agentSessionKey?: string;
      },
) {
  const isConfigOnly =
    params !== undefined && !("config" in params) && !("agentSessionKey" in params);
  const config: OpenClawConfig = isConfigOnly
    ? (params as OpenClawConfig)
    : (params?.config ?? createDefaultMemoryToolConfig());
  const agentSessionKey: string | undefined = isConfigOnly ? undefined : params?.agentSessionKey;
  const tool = createMemoryGetTool({
    config,
    ...(agentSessionKey ? { agentSessionKey } : {}),
  });
  if (!tool) {
    throw new Error("tool missing");
  }
  return tool;
}

export function createMemoryStoreToolOrThrow(params?: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}) {
  const tool = createMemoryStoreTool({
    config: params?.config ?? createDefaultMemoryToolConfig(),
    ...(params?.agentSessionKey ? { agentSessionKey: params.agentSessionKey } : {}),
  });
  if (!tool) {
    throw new Error("tool missing");
  }
  return tool;
}

export function createAutoCitationsMemorySearchTool(agentSessionKey: string) {
  return createMemorySearchToolOrThrow({
    config: asOpenClawConfig({
      memory: { citations: "auto" },
      agents: { list: [{ id: "main", default: true }] },
    }),
    agentSessionKey,
  });
}

export function expectUnavailableMemorySearchDetails(
  details: unknown,
  params: {
    error: string;
    warning: string;
    action: string;
  },
) {
  expect(details).toEqual({
    results: [],
    disabled: true,
    unavailable: true,
    error: params.error,
    warning: params.warning,
    action: params.action,
  });
}
