import process from "node:process";
import {
  formatMemoryAcceptanceReport,
  runMemoryAcceptanceSuite,
} from "../src/context-engine/memory-system-store.js";

type CliArgs = {
  workspaceDir: string;
  sessionIdPrefix: string;
  backendKinds?: Array<"fs-json" | "sqlite-doc" | "sqlite-graph">;
  format: "json" | "summary" | "markdown";
  outputPath?: string;
  failOnAcceptance: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  let workspaceDir = process.cwd();
  let sessionIdPrefix = `acceptance-${process.pid}`;
  let format: CliArgs["format"] = "json";
  let outputPath: string | undefined;
  let failOnAcceptance = false;
  const backendKinds: Array<"fs-json" | "sqlite-doc" | "sqlite-graph"> = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--workspace" && next) {
      workspaceDir = next;
      index += 1;
      continue;
    }
    if (arg === "--session-prefix" && next) {
      sessionIdPrefix = next;
      index += 1;
      continue;
    }
    if (arg === "--backend" && next) {
      if (next === "fs-json" || next === "sqlite-doc" || next === "sqlite-graph") {
        backendKinds.push(next);
      }
      index += 1;
      continue;
    }
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
  }

  return {
    workspaceDir,
    sessionIdPrefix,
    backendKinds: backendKinds.length > 0 ? backendKinds : undefined,
    format,
    outputPath,
    failOnAcceptance,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await runMemoryAcceptanceSuite({
    workspaceDir: args.workspaceDir,
    sessionIdPrefix: args.sessionIdPrefix,
    backendKinds: args.backendKinds,
  });
  const payload = formatMemoryAcceptanceReport(report, args.format);
  if (args.outputPath) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(args.outputPath, payload, "utf8");
  }
  process.stdout.write(payload);
  if (args.failOnAcceptance && !report.passed) {
    process.exitCode = 1;
  }
}

await main();
