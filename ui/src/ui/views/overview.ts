import { html, nothing, svg } from "lit";
import type {
  MemoryExplorerGraph,
  MemoryExplorerNode,
} from "../../../../src/context-engine/memory-system-store.ts";
import { t, i18n, SUPPORTED_LOCALES, type Locale } from "../../i18n/index.ts";
import type { EventLogEntry } from "../app-events.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "../external-link.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { GatewayHelloOk } from "../gateway.ts";
import { icons } from "../icons.ts";
import type { UiSettings } from "../storage.ts";
import type {
  AttentionItem,
  CronJob,
  CronStatus,
  DoctorMemoryDiagnosticsPayload,
  DoctorMemoryGraphPayload,
  SessionsListResult,
  SessionsUsageResult,
  SkillStatusReport,
} from "../types.ts";
import { formatBytes } from "./agents-utils.ts";
import { renderOverviewAttention } from "./overview-attention.ts";
import { renderOverviewCards } from "./overview-cards.ts";
import { renderOverviewEventLog } from "./overview-event-log.ts";
import {
  resolveAuthHintKind,
  shouldShowInsecureContextHint,
  shouldShowPairingHint,
} from "./overview-hints.ts";
import { renderOverviewLogTail } from "./overview-log-tail.ts";

export type OverviewProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  lastErrorCode: string | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  // New dashboard data
  usageResult: SessionsUsageResult | null;
  sessionsResult: SessionsListResult | null;
  skillsReport: SkillStatusReport | null;
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  attentionItems: AttentionItem[];
  eventLog: EventLogEntry[];
  overviewLogLines: string[];
  memoryDiagnostics: DoctorMemoryDiagnosticsPayload | null;
  memoryDiagnosticsError: string | null;
  memoryGraph: DoctorMemoryGraphPayload | null;
  memoryGraphError: string | null;
  selectedMemoryGraphNodeId: string | null;
  showGatewayToken: boolean;
  showGatewayPassword: boolean;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onToggleGatewayTokenVisibility: () => void;
  onToggleGatewayPasswordVisibility: () => void;
  onConnect: () => void;
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  onSelectMemoryGraphNode: (nodeId: string) => void;
  onRefreshLogs: () => void;
};

type MemoryExplorerLayoutNode = MemoryExplorerNode & { x: number; y: number; r: number };

function categoryColor(category: MemoryExplorerNode["category"]): string {
  switch (category) {
    case "fact":
      return "#22c55e";
    case "strategy":
      return "#f59e0b";
    case "decision":
      return "#f97316";
    case "pattern":
      return "#06b6d4";
    case "entity":
      return "#3b82f6";
    case "preference":
      return "#ec4899";
    case "episode":
      return "#a855f7";
    default:
      return "#94a3b8";
  }
}

export function buildMemoryExplorerLayout(graph: MemoryExplorerGraph): MemoryExplorerLayoutNode[] {
  if (graph.nodes.length === 0) {
    return [];
  }
  const width = 760;
  const height = 320;
  const cx = width / 2;
  const cy = height / 2;
  const memoryNodes = graph.nodes.filter((node) => node.kind === "memory");
  const artifactNodes = graph.nodes.filter((node) => node.kind === "artifact");
  const placeRing = (
    nodes: MemoryExplorerNode[],
    radius: number,
    baseRadius: number,
  ): MemoryExplorerLayoutNode[] =>
    nodes.map((node, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(nodes.length, 1)) * Math.PI * 2;
      return {
        ...node,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r: baseRadius + Math.min(node.degree, 6),
      };
    });
  return [...placeRing(memoryNodes, 86, 10), ...placeRing(artifactNodes, 136, 8)];
}

function renderMemoryExplorer(props: OverviewProps) {
  const graph = props.memoryGraph?.graph;
  if (props.memoryGraphError) {
    return html`<div class="callout danger" style="margin-top: 14px;">${props.memoryGraphError}</div>`;
  }
  if (!graph || graph.nodes.length === 0) {
    return html`
      <div class="muted" style="margin-top: 14px">Memory explorer unavailable.</div>
    `;
  }
  const layout = buildMemoryExplorerLayout(graph);
  const nodeById = new Map(layout.map((node) => [node.id, node]));
  const selectedNode = nodeById.get(props.selectedMemoryGraphNodeId ?? "") ?? layout[0] ?? null;
  const selectedNeighborIds = new Set(selectedNode?.connectedNodeIds ?? []);
  const selectedEdgeIds = new Set(
    graph.edges
      .filter((edge) => edge.from === selectedNode?.id || edge.to === selectedNode?.id)
      .map((edge) => `${edge.from}:${edge.to}:${edge.type}`),
  );
  return html`
    <div style="margin-top: 16px;" class="memory-explorer">
      <div class="memory-explorer__header">
        <div>
          <div class="card-sub">Memory Explorer</div>
          <div class="muted">
            ${graph.visibleNodeCount} visible nodes / ${graph.totalNodes} total nodes,
            ${graph.visibleEdgeCount} visible links / ${graph.totalEdges} total links
          </div>
        </div>
        <div class="memory-explorer__legend">
          ${["fact", "strategy", "decision", "pattern", "entity"].map(
            (category) => html`
              <span class="memory-explorer__legend-item">
                <span
                  class="memory-explorer__legend-dot"
                  style=${`background:${categoryColor(category as MemoryExplorerNode["category"])}`}
                ></span>
                ${category}
              </span>
            `,
          )}
        </div>
      </div>
      <div class="memory-explorer__grid">
        <div class="memory-explorer__canvas">
          <svg viewBox="0 0 760 320" class="memory-explorer__svg" aria-label="Memory graph">
            ${graph.edges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);
              if (!from || !to) {
                return nothing;
              }
              const edgeId = `${edge.from}:${edge.to}:${edge.type}`;
              const highlighted = selectedEdgeIds.has(edgeId);
              return svg`
                <line
                  x1=${from.x}
                  y1=${from.y}
                  x2=${to.x}
                  y2=${to.y}
                  class=${highlighted ? "memory-explorer__edge is-active" : "memory-explorer__edge"}
                  style=${`opacity:${Math.max(0.18, Math.min(edge.weight, 1))};`}
                />
              `;
            })}
            ${layout.map((node) => {
              const isSelected = node.id === selectedNode?.id;
              const isNeighbor = selectedNeighborIds.has(node.id);
              return svg`
                <g
                  class=${
                    isSelected
                      ? "memory-explorer__node is-selected"
                      : isNeighbor
                        ? "memory-explorer__node is-neighbor"
                        : "memory-explorer__node"
                  }
                  @click=${() => props.onSelectMemoryGraphNode(node.id)}
                >
                  <circle
                    cx=${node.x}
                    cy=${node.y}
                    r=${node.r}
                    fill=${categoryColor(node.category)}
                  ></circle>
                  <text x=${node.x} y=${node.y + node.r + 14} text-anchor="middle">
                    ${node.summary.length > 18 ? `${node.summary.slice(0, 18)}...` : node.summary}
                  </text>
                </g>
              `;
            })}
          </svg>
        </div>
        <div class="memory-explorer__details">
          ${
            selectedNode
              ? html`
                  <div class="memory-explorer__detail-title">${selectedNode.summary}</div>
                  <div class="memory-explorer__detail-meta">
                    <span class="mono">${selectedNode.id}</span>
                    <span>${selectedNode.kind}</span>
                    <span>${selectedNode.category}</span>
                    <span>${selectedNode.activeStatus}</span>
                  </div>
                  <div class="memory-explorer__stats">
                    <div><span>Confidence</span><strong>${selectedNode.confidence.toFixed(2)}</strong></div>
                    <div><span>Degree</span><strong>${selectedNode.degree}</strong></div>
                    <div><span>Updated</span><strong>${formatRelativeTimestamp(selectedNode.updatedAt)}</strong></div>
                  </div>
                  ${
                    selectedNode.excerpt
                      ? html`<div class="callout" style="margin-top: 12px;">${selectedNode.excerpt}</div>`
                      : nothing
                  }
                  ${
                    selectedNode.relationTypes.length > 0
                      ? html`
                          <div style="margin-top: 12px;">
                            <div class="card-sub">Relation types</div>
                            <div class="muted" style="margin-top: 6px;">
                              ${selectedNode.relationTypes.join(" | ")}
                            </div>
                          </div>
                        `
                      : nothing
                  }
                  ${
                    selectedNode.artifactRef
                      ? html`
                          <div style="margin-top: 12px;">
                            <div class="card-sub">Artifact</div>
                            <div class="muted mono" style="margin-top: 6px;">${selectedNode.artifactRef}</div>
                          </div>
                        `
                      : nothing
                  }
                  ${
                    selectedNeighborIds.size > 0
                      ? html`
                          <div style="margin-top: 12px;">
                            <div class="card-sub">Connected nodes</div>
                            <ul class="session-list" style="margin-top: 8px;">
                              ${[...selectedNeighborIds].slice(0, 8).map((neighborId) => {
                                const neighbor = nodeById.get(neighborId);
                                if (!neighbor) {
                                  return nothing;
                                }
                                return html`
                                  <li>
                                    <button
                                      class="memory-explorer__neighbor-btn"
                                      @click=${() => props.onSelectMemoryGraphNode(neighbor.id)}
                                    >
                                      ${neighbor.summary}
                                    </button>
                                    <span class="mono">${neighbor.category}</span>
                                  </li>
                                `;
                              })}
                            </ul>
                          </div>
                        `
                      : nothing
                  }
                `
              : html`
                  <div class="muted">Select a node to inspect it.</div>
                `
          }
        </div>
      </div>
      ${
        graph.recommendations.length > 0
          ? html`
              <div style="margin-top: 12px;" class="muted">
                ${graph.recommendations.join(" | ")}
              </div>
            `
          : nothing
      }
    </div>
  `;
}

export function renderOverview(props: OverviewProps) {
  const snapshot = props.hello?.snapshot as
    | {
        uptimeMs?: number;
        authMode?: "none" | "token" | "password" | "trusted-proxy";
      }
    | undefined;
  const uptime = snapshot?.uptimeMs ? formatDurationHuman(snapshot.uptimeMs) : t("common.na");
  const tickIntervalMs = props.hello?.policy?.tickIntervalMs;
  const tick = tickIntervalMs
    ? `${(tickIntervalMs / 1000).toFixed(tickIntervalMs % 1000 === 0 ? 0 : 1)}s`
    : t("common.na");
  const authMode = snapshot?.authMode;
  const isTrustedProxy = authMode === "trusted-proxy";

  const pairingHint = (() => {
    if (!shouldShowPairingHint(props.connected, props.lastError, props.lastErrorCode)) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.pairing.hint")}
        <div style="margin-top: 6px">
          <span class="mono">openclaw devices list</span><br />
          <span class="mono">openclaw devices approve &lt;requestId&gt;</span>
        </div>
        <div style="margin-top: 6px; font-size: 12px;">
          ${t("overview.pairing.mobileHint")}
        </div>
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclaw.ai/web/control-ui#device-pairing-first-connection"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title="Device pairing docs (opens in new tab)"
            >Docs: Device pairing</a
          >
        </div>
      </div>
    `;
  })();

  const authHint = (() => {
    const authHintKind = resolveAuthHintKind({
      connected: props.connected,
      lastError: props.lastError,
      lastErrorCode: props.lastErrorCode,
      hasToken: Boolean(props.settings.token.trim()),
      hasPassword: Boolean(props.password.trim()),
    });
    if (authHintKind == null) {
      return null;
    }
    if (authHintKind === "required") {
      return html`
        <div class="muted" style="margin-top: 8px">
          ${t("overview.auth.required")}
          <div style="margin-top: 6px">
            <span class="mono">openclaw dashboard --no-open</span> → tokenized URL<br />
            <span class="mono">openclaw doctor --generate-gateway-token</span> → set token
          </div>
          <div style="margin-top: 6px">
            <a
              class="session-link"
              href="https://docs.openclaw.ai/web/dashboard"
              target=${EXTERNAL_LINK_TARGET}
              rel=${buildExternalLinkRel()}
              title="Control UI auth docs (opens in new tab)"
              >Docs: Control UI auth</a
            >
          </div>
        </div>
      `;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.auth.failed", { command: "openclaw dashboard --no-open" })}
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclaw.ai/web/dashboard"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title="Control UI auth docs (opens in new tab)"
            >Docs: Control UI auth</a
          >
        </div>
      </div>
    `;
  })();

  const insecureContextHint = (() => {
    if (props.connected || !props.lastError) {
      return null;
    }
    const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
    if (isSecureContext) {
      return null;
    }
    if (!shouldShowInsecureContextHint(props.connected, props.lastError, props.lastErrorCode)) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.insecure.hint", { url: "http://127.0.0.1:18789" })}
        <div style="margin-top: 6px">
          ${t("overview.insecure.stayHttp", { config: "gateway.controlUi.allowInsecureAuth: true" })}
        </div>
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclaw.ai/gateway/tailscale"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title="Tailscale Serve docs (opens in new tab)"
            >Docs: Tailscale Serve</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.openclaw.ai/web/control-ui#insecure-http"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title="Insecure HTTP docs (opens in new tab)"
            >Docs: Insecure HTTP</a
          >
        </div>
      </div>
    `;
  })();

  const currentLocale = i18n.getLocale();
  const memoryReport = props.memoryDiagnostics?.report;
  const memoryWorker = props.memoryDiagnostics?.worker;
  const memorySkipped = memoryReport?.retrieval
    ? Object.entries(memoryReport.retrieval.skippedReasonCounts)
        .toSorted((a, b) => b[1] - a[1])
        .slice(0, 4)
    : [];

  return html`
    <section class="grid">
      <div class="card">
        <div class="card-title">${t("overview.access.title")}</div>
        <div class="card-sub">${t("overview.access.subtitle")}</div>
        <div class="ov-access-grid" style="margin-top: 16px;">
          <label class="field ov-access-grid__full">
            <span>${t("overview.access.wsUrl")}</span>
            <input
              .value=${props.settings.gatewayUrl}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({
                  ...props.settings,
                  gatewayUrl: v,
                  token: v.trim() === props.settings.gatewayUrl.trim() ? props.settings.token : "",
                });
              }}
              placeholder="ws://100.x.y.z:18789"
            />
          </label>
          ${
            isTrustedProxy
              ? ""
              : html`
                <label class="field">
                  <span>${t("overview.access.token")}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <input
                      type=${props.showGatewayToken ? "text" : "password"}
                      autocomplete="off"
                      style="flex: 1;"
                      .value=${props.settings.token}
                      @input=${(e: Event) => {
                        const v = (e.target as HTMLInputElement).value;
                        props.onSettingsChange({ ...props.settings, token: v });
                      }}
                      placeholder="OPENCLAW_GATEWAY_TOKEN"
                    />
                    <button
                      type="button"
                      class="btn btn--icon ${props.showGatewayToken ? "active" : ""}"
                      style="width: 36px; height: 36px;"
                      title=${props.showGatewayToken ? "Hide token" : "Show token"}
                      aria-label="Toggle token visibility"
                      aria-pressed=${props.showGatewayToken}
                      @click=${props.onToggleGatewayTokenVisibility}
                    >
                      ${props.showGatewayToken ? icons.eye : icons.eyeOff}
                    </button>
                  </div>
                </label>
                <label class="field">
                  <span>${t("overview.access.password")}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <input
                      type=${props.showGatewayPassword ? "text" : "password"}
                      autocomplete="off"
                      style="flex: 1;"
                      .value=${props.password}
                      @input=${(e: Event) => {
                        const v = (e.target as HTMLInputElement).value;
                        props.onPasswordChange(v);
                      }}
                      placeholder="system or shared password"
                    />
                    <button
                      type="button"
                      class="btn btn--icon ${props.showGatewayPassword ? "active" : ""}"
                      style="width: 36px; height: 36px;"
                      title=${props.showGatewayPassword ? "Hide password" : "Show password"}
                      aria-label="Toggle password visibility"
                      aria-pressed=${props.showGatewayPassword}
                      @click=${props.onToggleGatewayPasswordVisibility}
                    >
                      ${props.showGatewayPassword ? icons.eye : icons.eyeOff}
                    </button>
                  </div>
                </label>
              `
          }
          <label class="field">
            <span>${t("overview.access.sessionKey")}</span>
            <input
              .value=${props.settings.sessionKey}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSessionKeyChange(v);
              }}
            />
          </label>
          <label class="field">
            <span>${t("overview.access.language")}</span>
            <select
              .value=${currentLocale}
              @change=${(e: Event) => {
                const v = (e.target as HTMLSelectElement).value as Locale;
                void i18n.setLocale(v);
                props.onSettingsChange({ ...props.settings, locale: v });
              }}
            >
              ${SUPPORTED_LOCALES.map((loc) => {
                const key = loc.replace(/-([a-zA-Z])/g, (_, c) => c.toUpperCase());
                return html`<option value=${loc}>${t(`languages.${key}`)}</option>`;
              })}
            </select>
          </label>
        </div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn" @click=${() => props.onConnect()}>${t("common.connect")}</button>
          <button class="btn" @click=${() => props.onRefresh()}>${t("common.refresh")}</button>
          <span class="muted">${
            isTrustedProxy ? t("overview.access.trustedProxy") : t("overview.access.connectHint")
          }</span>
        </div>
        ${
          !props.connected
            ? html`
                <div class="login-gate__help" style="margin-top: 16px;">
                  <div class="login-gate__help-title">${t("overview.connection.title")}</div>
                  <ol class="login-gate__steps">
                    <li>${t("overview.connection.step1")}<code>openclaw gateway run</code></li>
                    <li>${t("overview.connection.step2")}<code>openclaw dashboard --no-open</code></li>
                    <li>${t("overview.connection.step3")}</li>
                    <li>${t("overview.connection.step4")}<code>openclaw doctor --generate-gateway-token</code></li>
                  </ol>
                  <div class="login-gate__docs">
                    ${t("overview.connection.docsHint")}
                    <a
                      class="session-link"
                      href="https://docs.openclaw.ai/web/dashboard"
                      target="_blank"
                      rel="noreferrer"
                    >${t("overview.connection.docsLink")}</a>
                  </div>
                </div>
              `
            : nothing
        }
      </div>

      <div class="card">
        <div class="card-title">${t("overview.snapshot.title")}</div>
        <div class="card-sub">${t("overview.snapshot.subtitle")}</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t("overview.snapshot.status")}</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">
              ${props.connected ? t("common.ok") : t("common.offline")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.snapshot.uptime")}</div>
            <div class="stat-value">${uptime}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.snapshot.tickInterval")}</div>
            <div class="stat-value">${tick}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.snapshot.lastChannelsRefresh")}</div>
            <div class="stat-value">
              ${props.lastChannelsRefresh ? formatRelativeTimestamp(props.lastChannelsRefresh) : t("common.na")}
            </div>
          </div>
        </div>
        ${
          props.lastError
            ? html`<div class="callout danger" style="margin-top: 14px;">
              <div>${props.lastError}</div>
              ${pairingHint ?? ""}
              ${authHint ?? ""}
              ${insecureContextHint ?? ""}
            </div>`
            : html`
                <div class="callout" style="margin-top: 14px">
                  ${t("overview.snapshot.channelsHint")}
                </div>
              `
        }
      </div>
    </section>

    <div class="ov-section-divider"></div>

    ${renderOverviewCards({
      usageResult: props.usageResult,
      sessionsResult: props.sessionsResult,
      skillsReport: props.skillsReport,
      cronJobs: props.cronJobs,
      cronStatus: props.cronStatus,
      presenceCount: props.presenceCount,
      onNavigate: props.onNavigate,
    })}

    ${renderOverviewAttention({ items: props.attentionItems })}

    <div class="ov-section-divider"></div>

    <section class="grid">
      <div class="card">
        <div class="card-title">Memory Diagnostics</div>
        <div class="card-sub">Integrated memory health, retrieval behavior, and worker activity.</div>
        ${
          props.memoryDiagnosticsError
            ? html`<div class="callout danger" style="margin-top: 14px;">${props.memoryDiagnosticsError}</div>`
            : memoryReport
              ? html`
                  <div class="callout" style="margin-top: 14px;">${memoryReport.summary}</div>

                  <div class="stat-grid" style="margin-top: 16px;">
                    <div class="stat">
                      <div class="stat-label">Health</div>
                      <div class="stat-value">${memoryReport.health.summary}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-label">Session</div>
                      <div class="stat-value mono">${memoryReport.sessionId}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-label">Retrieved items</div>
                      <div class="stat-value">${memoryReport.retrieval?.retrievalItemCount ?? 0}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-label">Topic matches</div>
                      <div class="stat-value">${memoryReport.retrieval?.topicMatchedItemCount ?? 0}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-label">Store size</div>
                      <div class="stat-value">${formatBytes(memoryReport.health.storageBytes)}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-label">Artifacts size</div>
                      <div class="stat-value">${formatBytes(memoryReport.health.artifactsBytes)}</div>
                    </div>
                  </div>

                  ${
                    memoryWorker
                      ? html`
                          <div class="muted" style="margin-top: 14px;">
                            Worker: queued=${memoryWorker.queued} completed=${memoryWorker.completed}
                            failed=${memoryWorker.failed} active=${memoryWorker.active}
                            maintenance=${memoryWorker.maintenanceRuns}
                            ${memoryWorker.lastReason ? html` last=${memoryWorker.lastReason}` : nothing}
                          </div>
                        `
                      : nothing
                  }

                  ${
                    memoryReport.retrieval
                      ? html`
                          <div style="margin-top: 14px;">
                            <div class="card-sub">Retrieval reasons</div>
                            <div class="muted" style="margin-top: 6px;">
                              ${memoryReport.retrieval.topReasons.join(" | ") || "No retrieval reasons recorded."}
                            </div>
                          </div>
                        `
                      : nothing
                  }

                  ${
                    memorySkipped.length > 0
                      ? html`
                          <div style="margin-top: 14px;">
                            <div class="card-sub">Skipped items</div>
                            <ul class="session-list" style="margin-top: 8px;">
                              ${memorySkipped.map(
                                ([reason, count]) =>
                                  html`<li><span class="mono">${reason}</span><span>${count}</span></li>`,
                              )}
                            </ul>
                          </div>
                        `
                      : nothing
                  }

                  ${
                    (memoryReport.retrieval?.supersededSamples.length ?? 0) > 0
                      ? html`
                          <div style="margin-top: 14px;">
                            <div class="card-sub">Superseded samples</div>
                            <ul class="muted" style="margin-top: 8px; padding-left: 18px;">
                              ${memoryReport.retrieval?.supersededSamples
                                .slice(0, 4)
                                .map((item) => html`<li>${item}</li>`)}
                            </ul>
                          </div>
                        `
                      : nothing
                  }

                  ${
                    memoryReport.recommendations.length > 0
                      ? html`
                          <div style="margin-top: 14px;">
                            <div class="card-sub">Recommendations</div>
                            <ul class="muted" style="margin-top: 8px; padding-left: 18px;">
                              ${memoryReport.recommendations
                                .slice(0, 5)
                                .map((item) => html`<li>${item}</li>`)}
                            </ul>
                          </div>
                        `
                      : nothing
                  }

                  ${renderMemoryExplorer(props)}
                `
              : html`
                  <div class="muted" style="margin-top: 14px">Memory diagnostics unavailable.</div>
                `
        }
      </div>
    </section>

    <div class="ov-section-divider"></div>
    <div class="ov-bottom-grid" style="margin-top: 18px;">
      ${renderOverviewEventLog({
        events: props.eventLog,
      })}

      ${renderOverviewLogTail({
        lines: props.overviewLogLines,
        onRefreshLogs: props.onRefreshLogs,
      })}
    </div>

  `;
}
