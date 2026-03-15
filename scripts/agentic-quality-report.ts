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
  failOnAcceptance: boolean;
  failOnSoak: boolean;
  failOnEscalation: boolean;
  failOnMissingFallback: boolean;
} {
  let format: "json" | "summary" | "markdown" = "json";
  let outputPath: string | undefined;
  let failOnAcceptance = false;
  let failOnSoak = false;
  let failOnEscalation = false;
  let failOnMissingFallback = false;
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
    }
  }
  return {
    messages: parseMessages(argv),
    format,
    outputPath,
    failOnAcceptance,
    failOnSoak,
    failOnEscalation,
    failOnMissingFallback,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = runAgenticQualityGate({
    messages: args.messages,
    failOnEscalation: args.failOnEscalation,
    failOnMissingFallback: args.failOnMissingFallback,
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
    (args.failOnMissingFallback && !report.diagnosticsPassed)
  ) {
    process.exitCode = 1;
  }
}

await main();
