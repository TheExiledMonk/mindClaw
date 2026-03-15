import process from "node:process";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  buildAgenticExecutionState,
  formatAgenticExecutionObservabilityReport,
  inspectAgenticExecutionObservability,
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
  failOnEscalation: boolean;
  failOnMissingFallback: boolean;
} {
  let format: "json" | "summary" | "markdown" = "json";
  let outputPath: string | undefined;
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
    failOnEscalation,
    failOnMissingFallback,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const state = buildAgenticExecutionState({
    messages: args.messages,
  });
  const report = inspectAgenticExecutionObservability(state);
  const payload = formatAgenticExecutionObservabilityReport(report, args.format);
  if (args.outputPath) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(args.outputPath, payload, "utf8");
  }
  process.stdout.write(payload);
  if (
    (args.failOnEscalation && report.escalationRequired) ||
    (args.failOnMissingFallback && !report.hasViableFallback)
  ) {
    process.exitCode = 1;
  }
}

await main();
