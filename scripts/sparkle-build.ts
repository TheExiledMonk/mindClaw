#!/usr/bin/env -S node --import tsx

import { pathToFileURL } from "node:url";

export type SparkleBuildFloors = {
  releaseKey: number;
  legacyFloor: number;
  laneFloor: number;
  lane: number;
};

const CALVER_REGEX = /^([0-9]{4})\.([0-9]{1,2})\.([0-9]{1,2})([.-].*)?$/;

export function sparkleBuildFloorsFromShortVersion(
  shortVersion: string,
): SparkleBuildFloors | null {
  const match = CALVER_REGEX.exec(shortVersion.trim());
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const releaseNumber = Number.parseInt(match[3], 10);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(releaseNumber) ||
    month < 1 ||
    month > 12 ||
    releaseNumber < 1 ||
    releaseNumber > 99
  ) {
    return null;
  }

  const releaseKey = Number(
    `${year}${String(month).padStart(2, "0")}${String(releaseNumber).padStart(2, "0")}`,
  );
  const legacyFloor = Number(`${releaseKey}0`);

  let lane = 90;
  const suffix = match[4] ?? "";
  if (suffix.length > 0) {
    const numericSuffix = /([0-9]+)$/.exec(suffix)?.[1];
    if (numericSuffix) {
      lane = Math.min(Number.parseInt(numericSuffix, 10), 89);
    } else {
      lane = 1;
    }
  }

  const laneFloor = Number(`${releaseKey}${String(lane).padStart(2, "0")}`);
  return { releaseKey, legacyFloor, laneFloor, lane };
}

export function canonicalSparkleBuildFromVersion(shortVersion: string): number | null {
  return sparkleBuildFloorsFromShortVersion(shortVersion)?.laneFloor ?? null;
}

function runCli(args: string[]): number {
  const [command, version] = args;
  if (command !== "canonical-build" || !version) {
    return 1;
  }

  const build = canonicalSparkleBuildFromVersion(version);
  if (build === null) {
    return 1;
  }

  console.log(String(build));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(runCli(process.argv.slice(2)));
}
