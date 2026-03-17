import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import {
  generateMemoryDiagnosticsReport,
  generateMemoryExplorerGraph,
  type MemoryDiagnosticsReport,
  type MemoryExplorerGraph,
} from "../../context-engine/memory-system-store.js";
import {
  getMemoryBackgroundWorkerStats,
  type MemoryBackgroundWorkerStats,
} from "../../context-engine/memory-system-worker.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { formatError } from "../server-utils.js";
import type { GatewayRequestHandlers } from "./types.js";

export type DoctorMemoryStatusPayload = {
  agentId: string;
  provider?: string;
  embedding: {
    ok: boolean;
    error?: string;
  };
};

export type DoctorMemoryDiagnosticsPayload = {
  agentId: string;
  workspaceDir: string;
  report: MemoryDiagnosticsReport;
  worker: MemoryBackgroundWorkerStats;
};

export type DoctorMemoryGraphPayload = {
  agentId: string;
  workspaceDir: string;
  graph: MemoryExplorerGraph;
};

export const doctorHandlers: GatewayRequestHandlers = {
  "doctor.memory.status": async ({ respond }) => {
    const cfg = loadConfig();
    const agentId = resolveDefaultAgentId(cfg);
    const { manager, error } = await getMemorySearchManager({
      cfg,
      agentId,
      purpose: "status",
    });
    if (!manager) {
      const payload: DoctorMemoryStatusPayload = {
        agentId,
        embedding: {
          ok: false,
          error: error ?? "memory search unavailable",
        },
      };
      respond(true, payload, undefined);
      return;
    }

    try {
      const status = manager.status();
      let embedding = await manager.probeEmbeddingAvailability();
      if (!embedding.ok && !embedding.error) {
        embedding = { ok: false, error: "memory embeddings unavailable" };
      }
      const payload: DoctorMemoryStatusPayload = {
        agentId,
        provider: status.provider,
        embedding,
      };
      respond(true, payload, undefined);
    } catch (err) {
      const payload: DoctorMemoryStatusPayload = {
        agentId,
        embedding: {
          ok: false,
          error: `gateway memory probe failed: ${formatError(err)}`,
        },
      };
      respond(true, payload, undefined);
    } finally {
      await manager.close?.().catch(() => {});
    }
  },
  "doctor.memory.diagnostics": async ({ params, respond }) => {
    const cfg = loadConfig();
    const agentId = resolveDefaultAgentId(cfg);
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const sessionId =
      typeof (params as { sessionKey?: unknown } | undefined)?.sessionKey === "string" &&
      (params as { sessionKey?: string }).sessionKey?.trim()
        ? (params as { sessionKey?: string }).sessionKey!.trim()
        : "main";
    const report = await generateMemoryDiagnosticsReport({
      workspaceDir,
      sessionId,
    });
    const payload: DoctorMemoryDiagnosticsPayload = {
      agentId,
      workspaceDir,
      report,
      worker: getMemoryBackgroundWorkerStats(),
    };
    respond(true, payload, undefined);
  },
  "doctor.memory.graph": async ({ params, respond }) => {
    const cfg = loadConfig();
    const agentId = resolveDefaultAgentId(cfg);
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const sessionId =
      typeof (params as { sessionKey?: unknown } | undefined)?.sessionKey === "string" &&
      (params as { sessionKey?: string }).sessionKey?.trim()
        ? (params as { sessionKey?: string }).sessionKey!.trim()
        : "main";
    const nodeLimit =
      typeof (params as { nodeLimit?: unknown } | undefined)?.nodeLimit === "number"
        ? (params as { nodeLimit?: number }).nodeLimit
        : undefined;
    const graph = await generateMemoryExplorerGraph({
      workspaceDir,
      sessionId,
      nodeLimit,
    });
    const payload: DoctorMemoryGraphPayload = {
      agentId,
      workspaceDir,
      graph,
    };
    respond(true, payload, undefined);
  },
};
