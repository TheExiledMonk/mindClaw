import process from "node:process";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  buildAgenticExecutionState,
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

async function main(): Promise<void> {
  const messages = parseMessages(process.argv.slice(2));
  const state = buildAgenticExecutionState({
    messages,
  });
  const report = inspectAgenticExecutionObservability(state);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();
