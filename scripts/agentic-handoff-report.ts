import process from "node:process";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  buildAgenticExecutionState,
  buildAgenticHandoffReport,
  formatAgenticHandoffReport,
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
  failOnBlocked: boolean;
} {
  let format: "json" | "summary" | "markdown" = "json";
  let outputPath: string | undefined;
  let failOnBlocked = false;
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
    if (arg === "--fail-on-blocked") {
      failOnBlocked = true;
    }
  }
  return {
    messages: parseMessages(argv),
    format,
    outputPath,
    failOnBlocked,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const state = buildAgenticExecutionState({
    messages: args.messages,
  });
  const report = buildAgenticHandoffReport(state);
  const payload = formatAgenticHandoffReport(report, args.format);
  if (args.outputPath) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(args.outputPath, payload, "utf8");
  }
  process.stdout.write(payload);
  if (args.failOnBlocked && report.blockedSteps.length > 0) {
    process.exitCode = 1;
  }
}

await main();
