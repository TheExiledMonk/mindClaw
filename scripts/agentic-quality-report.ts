import process from "node:process";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  formatAgenticQualityGateReport,
  runAgenticQualityGate,
} from "../src/agents/pi-embedded-runner/run/agentic-state.js";

function parseMessages(argv: string[]): AgentMessage[] {
  const messages: AgentMessage[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--message" && next) {
      messages.push({
        role: "user",
        content: next,
        timestamp: Date.now(),
      } as AgentMessage);
      index += 1;
    }
  }
  return messages;
}

function parseArgs(argv: string[]): {
  messages: AgentMessage[];
  format: "json" | "summary" | "markdown";
  outputPath?: string;
  workspaceDir?: string;
  sessionId?: string;
  failOnAcceptance: boolean;
  failOnSoak: boolean;
  failOnEscalation: boolean;
  failOnMissingFallback: boolean;
  failOnWeakeningSkills: boolean;
  failOnRecoveringSkills: boolean;
} {
  let format: "json" | "summary" | "markdown" = "json";
  let outputPath: string | undefined;
  let workspaceDir: string | undefined;
  let sessionId: string | undefined;
  let failOnAcceptance = false;
  let failOnSoak = false;
  let failOnEscalation = false;
  let failOnMissingFallback = false;
  let failOnWeakeningSkills = false;
  let failOnRecoveringSkills = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--format" && next) {
      if (next === "json" || next === "summary" || next === "markdown") {
        format = next;
      }
      index += 1;
      continue;
    }
    if (arg === "--out" && next) {
      outputPath = next;
      index += 1;
      continue;
    }
    if (arg === "--workspace" && next) {
      workspaceDir = next;
      index += 1;
      continue;
    }
    if (arg === "--session" && next) {
      sessionId = next;
      index += 1;
      continue;
    }
    if (arg === "--fail-on-acceptance") {
      failOnAcceptance = true;
      continue;
    }
    if (arg === "--fail-on-soak") {
      failOnSoak = true;
      continue;
    }
    if (arg === "--fail-on-escalation") {
      failOnEscalation = true;
      continue;
    }
    if (arg === "--fail-on-missing-fallback") {
      failOnMissingFallback = true;
      continue;
    }
    if (arg === "--fail-on-weakening-skills") {
      failOnWeakeningSkills = true;
      continue;
    }
    if (arg === "--fail-on-recovering-skills") {
      failOnRecoveringSkills = true;
    }
  }
  return {
    messages: parseMessages(argv),
    format,
    outputPath,
    workspaceDir,
    sessionId,
    failOnAcceptance,
    failOnSoak,
    failOnEscalation,
    failOnMissingFallback,
    failOnWeakeningSkills,
    failOnRecoveringSkills,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let memoryTrend:
    | {
        weakeningSkills?: string[];
        effectiveSkills?: string[];
        recoveringSkills?: string[];
        stabilizedSkills?: string[];
        trend?: "stable" | "watch" | "regressing";
      }
    | undefined;
  if (args.workspaceDir && args.sessionId) {
    const { generateMemoryDiagnosticsReport } =
      await import("../src/context-engine/memory-system-store.js");
    const diagnostics = await generateMemoryDiagnosticsReport({
      workspaceDir: args.workspaceDir,
      sessionId: args.sessionId,
    });
    memoryTrend = diagnostics.agenticTrends
      ? {
          weakeningSkills: diagnostics.agenticTrends.weakeningSkills,
          effectiveSkills: diagnostics.agenticTrends.effectiveSkills,
          recoveringSkills: diagnostics.agenticTrends.recoveringSkills,
          stabilizedSkills: diagnostics.agenticTrends.stabilizedSkills,
          trend: diagnostics.agenticTrends.trend,
        }
      : undefined;
  }
  const report = runAgenticQualityGate({
    messages: args.messages,
    failOnEscalation: args.failOnEscalation,
    failOnMissingFallback: args.failOnMissingFallback,
    failOnWeakeningSkills: args.failOnWeakeningSkills,
    failOnRecoveringSkills: args.failOnRecoveringSkills,
    memoryTrend,
  });
  const payload = formatAgenticQualityGateReport(report, args.format);
  if (args.outputPath) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(args.outputPath, payload, "utf8");
  }
  process.stdout.write(payload);
  if (
    (args.failOnAcceptance && !report.acceptancePassed) ||
    (args.failOnSoak && !report.soakPassed) ||
    (args.failOnEscalation && !report.diagnosticsPassed) ||
    (args.failOnMissingFallback && !report.diagnosticsPassed) ||
    (args.failOnWeakeningSkills && !report.effectivenessPassed) ||
    (args.failOnRecoveringSkills && !report.effectivenessPassed)
  ) {
    process.exitCode = 1;
  }
}

await main();
