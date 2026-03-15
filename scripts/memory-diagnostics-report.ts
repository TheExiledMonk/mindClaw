import process from "node:process";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { generateMemoryDiagnosticsReport } from "../src/context-engine/memory-system-store.js";

type CliArgs = {
  workspaceDir: string;
  sessionId: string;
  backendKind?: "fs-json" | "sqlite-doc" | "sqlite-graph";
  includeAcceptance: boolean;
  acceptanceBackendKinds?: Array<"fs-json" | "sqlite-doc" | "sqlite-graph">;
  messages: AgentMessage[];
};

function parseArgs(argv: string[]): CliArgs {
  let workspaceDir = process.cwd();
  let sessionId = "default";
  let backendKind: CliArgs["backendKind"];
  let includeAcceptance = false;
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
    if (arg === "--acceptance-backend" && next) {
      if (next === "fs-json" || next === "sqlite-doc" || next === "sqlite-graph") {
        acceptanceBackendKinds.push(next);
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
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();
