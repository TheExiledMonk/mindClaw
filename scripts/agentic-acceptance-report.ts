import process from "node:process";
import {
  formatAgenticAcceptanceReport,
  runAgenticAcceptanceSuite,
} from "../src/agents/pi-embedded-runner/run/agentic-state.js";

function parseArgs(argv: string[]): {
  format: "json" | "summary" | "markdown";
  outputPath?: string;
  failOnAcceptance: boolean;
} {
  let format: "json" | "summary" | "markdown" = "json";
  let outputPath: string | undefined;
  let failOnAcceptance = false;
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
    }
  }
  return { format, outputPath, failOnAcceptance };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = runAgenticAcceptanceSuite();
  const payload = formatAgenticAcceptanceReport(report, args.format);
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
