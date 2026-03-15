import process from "node:process";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  formatMemoryDiagnosticsReport,
  generateMemoryDiagnosticsReport,
} from "../src/context-engine/memory-system-store.js";

type CliArgs = {
  workspaceDir: string;
  sessionId: string;
  backendKind?: "fs-json" | "sqlite-doc" | "sqlite-graph";
  includeAcceptance: boolean;
  acceptanceBackendKinds?: Array<"fs-json" | "sqlite-doc" | "sqlite-graph">;
  failOnIssues: boolean;
  failOnAcceptance: boolean;
  failOnWeakWinners: boolean;
  failOnFragileWinners: boolean;
  failOnEntityConflicts: boolean;
  failOnAgenticRegressions: boolean;
  runRepair: boolean;
  runRecover: boolean;
  outputPath?: string;
  format: "json" | "summary" | "markdown";
  messages: AgentMessage[];
};

function parseArgs(argv: string[]): CliArgs {
  let workspaceDir = process.cwd();
  let sessionId = "default";
  let backendKind: CliArgs["backendKind"];
  let includeAcceptance = false;
  let failOnIssues = false;
  let failOnAcceptance = false;
  let failOnWeakWinners = false;
  let failOnFragileWinners = false;
  let failOnEntityConflicts = false;
  let failOnAgenticRegressions = false;
  let runRepair = false;
  let runRecover = false;
  let outputPath: string | undefined;
  let format: CliArgs["format"] = "json";
  const acceptanceBackendKinds: Array<"fs-json" | "sqlite-doc" | "sqlite-graph"> = [];
  const messages: AgentMessage[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
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
    if (arg === "--backend" && next) {
      if (next === "fs-json" || next === "sqlite-doc" || next === "sqlite-graph") {
        backendKind = next;
      }
      index += 1;
      continue;
    }
    if (arg === "--acceptance") {
      includeAcceptance = true;
      continue;
    }
    if (arg === "--fail-on-issues") {
      failOnIssues = true;
      continue;
    }
    if (arg === "--fail-on-acceptance") {
      failOnAcceptance = true;
      continue;
    }
    if (arg === "--fail-on-weak-winners") {
      failOnWeakWinners = true;
      continue;
    }
    if (arg === "--fail-on-fragile-winners") {
      failOnFragileWinners = true;
      continue;
    }
    if (arg === "--fail-on-entity-conflicts") {
      failOnEntityConflicts = true;
      continue;
    }
    if (arg === "--fail-on-agentic-regressions") {
      failOnAgenticRegressions = true;
      continue;
    }
    if (arg === "--run-repair") {
      runRepair = true;
      continue;
    }
    if (arg === "--run-recover") {
      runRecover = true;
      continue;
    }
    if (arg === "--acceptance-backend" && next) {
      if (next === "fs-json" || next === "sqlite-doc" || next === "sqlite-graph") {
        acceptanceBackendKinds.push(next);
      }
      index += 1;
      continue;
    }
    if (arg === "--out" && next) {
      outputPath = next;
      index += 1;
      continue;
    }
    if (arg === "--summary-only") {
      format = "summary";
      continue;
    }
    if (arg === "--format" && next) {
      if (next === "json" || next === "summary" || next === "markdown") {
        format = next;
      }
      index += 1;
      continue;
    }
    if (arg === "--message" && next) {
      messages.push({
        role: "user",
        content: next,
        timestamp: Date.now(),
      } as AgentMessage);
      index += 1;
      continue;
    }
  }

  return {
    workspaceDir,
    sessionId,
    backendKind,
    includeAcceptance,
    acceptanceBackendKinds: acceptanceBackendKinds.length > 0 ? acceptanceBackendKinds : undefined,
    failOnIssues,
    failOnAcceptance,
    failOnWeakWinners,
    failOnFragileWinners,
    failOnEntityConflicts,
    failOnAgenticRegressions,
    runRepair,
    runRecover,
    outputPath,
    format,
    messages,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await generateMemoryDiagnosticsReport({
    workspaceDir: args.workspaceDir,
    sessionId: args.sessionId,
    backendKind: args.backendKind,
    messages: args.messages.length > 0 ? args.messages : undefined,
    includeAcceptance: args.includeAcceptance,
    acceptanceBackendKinds: args.acceptanceBackendKinds,
    runRepair: args.runRepair,
    runRecover: args.runRecover,
  });
  const payload = formatMemoryDiagnosticsReport(report, args.format);
  if (args.outputPath) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(args.outputPath, payload, "utf8");
  }
  process.stdout.write(payload);
  if (args.failOnIssues && report.health.issues.length > 0) {
    process.exitCode = 1;
  }
  if (args.failOnAcceptance && report.failedAcceptanceScenarios.length > 0) {
    process.exitCode = 1;
  }
  if (args.failOnWeakWinners && report.health.weakEvidenceWinnerCount > 0) {
    process.exitCode = 1;
  }
  if (args.failOnFragileWinners && report.health.fragileWinnerCount > 0) {
    process.exitCode = 1;
  }
  if (args.failOnEntityConflicts && report.health.contestedEntityConflictCount > 0) {
    process.exitCode = 1;
  }
  if (args.failOnAgenticRegressions && report.agenticTrends?.trend === "regressing") {
    process.exitCode = 1;
  }
}

await main();
