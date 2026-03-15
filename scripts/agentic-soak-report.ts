import process from "node:process";
import {
  formatAgenticSoakReport,
  runAgenticSoakSuite,
} from "../src/agents/pi-embedded-runner/run/agentic-state.js";

function parseArgs(argv: string[]): {
  format: "json" | "summary" | "markdown";
  outputPath?: string;
  failOnSoak: boolean;
} {
  let format: "json" | "summary" | "markdown" = "json";
  let outputPath: string | undefined;
  let failOnSoak = false;
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
    if (arg === "--fail-on-soak") {
      failOnSoak = true;
    }
  }
  return { format, outputPath, failOnSoak };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = runAgenticSoakSuite();
  const payload = formatAgenticSoakReport(report, args.format);
  if (args.outputPath) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(args.outputPath, payload, "utf8");
  }
  process.stdout.write(payload);
  if (args.failOnSoak && !report.passed) {
    process.exitCode = 1;
  }
}

await main();
