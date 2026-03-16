#!/usr/bin/env -S node --import tsx

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type PackageJson = {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  repository?: { url?: string } | string;
  bin?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

export type ParsedReleaseVersion = {
  version: string;
  channel: "stable" | "beta";
  year: number;
  month: number;
  releaseNumber: number;
  betaNumber?: number;
};

const STABLE_PACKAGE_VERSION_REGEX = /^(?<year>\d{4})\.(?<month>[1-9]\d?)\.(?<release>[1-9]\d*)$/;
const STABLE_TAG_VERSION_REGEX = /^(?<year>\d{4})\.(?<month>[1-9]\d?)-(?<release>[1-9]\d*)$/;
const BETA_VERSION_REGEX =
  /^(?<year>\d{4})\.(?<month>[1-9]\d?)(?:\.|-)(?<release>[1-9]\d*)-beta\.(?<beta>[1-9]\d*)$/;
const EXPECTED_REPOSITORY_URL = "https://github.com/openclaw/openclaw";

function normalizeRepoUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
}

function parseVersionParts(
  version: string,
  groups: Record<string, string | undefined>,
  channel: "stable" | "beta",
): ParsedReleaseVersion | null {
  const year = Number.parseInt(groups.year ?? "", 10);
  const month = Number.parseInt(groups.month ?? "", 10);
  const releaseNumber = Number.parseInt(groups.release ?? "", 10);
  const betaNumber = channel === "beta" ? Number.parseInt(groups.beta ?? "", 10) : undefined;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(releaseNumber) ||
    month < 1 ||
    month > 12 ||
    releaseNumber < 1
  ) {
    return null;
  }
  if (channel === "beta" && (!Number.isInteger(betaNumber) || (betaNumber ?? 0) < 1)) {
    return null;
  }

  return {
    version,
    channel,
    year,
    month,
    releaseNumber,
    betaNumber,
  };
}

export function parseReleaseVersion(version: string): ParsedReleaseVersion | null {
  const trimmed = version.trim();
  if (!trimmed) {
    return null;
  }

  const stableMatch = STABLE_PACKAGE_VERSION_REGEX.exec(trimmed);
  if (stableMatch?.groups) {
    return parseVersionParts(trimmed, stableMatch.groups, "stable");
  }

  const betaMatch = BETA_VERSION_REGEX.exec(trimmed);
  if (betaMatch?.groups) {
    return parseVersionParts(trimmed, betaMatch.groups, "beta");
  }

  return null;
}

export function parseReleaseTagVersion(version: string): ParsedReleaseVersion | null {
  const trimmed = version.trim();
  if (!trimmed) {
    return null;
  }

  const stableMatch = STABLE_TAG_VERSION_REGEX.exec(trimmed);
  if (stableMatch?.groups) {
    return parseVersionParts(trimmed, stableMatch.groups, "stable");
  }

  const betaMatch = BETA_VERSION_REGEX.exec(trimmed);
  if (betaMatch?.groups) {
    return parseVersionParts(trimmed, betaMatch.groups, "beta");
  }

  return null;
}

export function releaseTagFromPackageVersion(version: string): string | null {
  const parsed = parseReleaseVersion(version);
  if (parsed === null) {
    return null;
  }
  const base = `${parsed.year}.${parsed.month}-${parsed.releaseNumber}`;
  return parsed.channel === "beta" ? `v${base}-beta.${parsed.betaNumber}` : `v${base}`;
}

export function collectReleasePackageMetadataErrors(pkg: PackageJson): string[] {
  const actualRepositoryUrl = normalizeRepoUrl(
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url,
  );
  const errors: string[] = [];

  if (pkg.name !== "openclaw") {
    errors.push(`package.json name must be "openclaw"; found "${pkg.name ?? ""}".`);
  }
  if (!pkg.description?.trim()) {
    errors.push("package.json description must be non-empty.");
  }
  if (pkg.license !== "MIT") {
    errors.push(`package.json license must be "MIT"; found "${pkg.license ?? ""}".`);
  }
  if (actualRepositoryUrl !== EXPECTED_REPOSITORY_URL) {
    errors.push(
      `package.json repository.url must resolve to ${EXPECTED_REPOSITORY_URL}; found ${
        actualRepositoryUrl || "<missing>"
      }.`,
    );
  }
  if (pkg.bin?.openclaw !== "openclaw.mjs") {
    errors.push(
      `package.json bin.openclaw must be "openclaw.mjs"; found "${pkg.bin?.openclaw ?? ""}".`,
    );
  }
  if (pkg.peerDependencies?.["node-llama-cpp"] !== "3.16.2") {
    errors.push(
      `package.json peerDependencies["node-llama-cpp"] must be "3.16.2"; found "${
        pkg.peerDependencies?.["node-llama-cpp"] ?? ""
      }".`,
    );
  }
  if (pkg.peerDependenciesMeta?.["node-llama-cpp"]?.optional !== true) {
    errors.push('package.json peerDependenciesMeta["node-llama-cpp"].optional must be true.');
  }

  return errors;
}

export function collectReleaseTagErrors(params: {
  packageVersion: string;
  releaseTag: string;
  releaseSha?: string;
  releaseMainRef?: string;
}): string[] {
  const errors: string[] = [];
  const releaseTag = params.releaseTag.trim();
  const packageVersion = params.packageVersion.trim();

  const parsedVersion = parseReleaseVersion(packageVersion);
  if (parsedVersion === null) {
    errors.push(
      `package.json version must match YYYY.M.R or YYYY.M.R-beta.N; found "${packageVersion || "<missing>"}".`,
    );
  }

  if (!releaseTag.startsWith("v")) {
    errors.push(`Release tag must start with "v"; found "${releaseTag || "<missing>"}".`);
  }

  const tagVersion = releaseTag.startsWith("v") ? releaseTag.slice(1) : releaseTag;
  const parsedTag = parseReleaseTagVersion(tagVersion);
  if (parsedTag === null) {
    errors.push(
      `Release tag must match vYYYY.M-R or vYYYY.M-R-beta.N; found "${releaseTag || "<missing>"}".`,
    );
  }

  const expectedTag = packageVersion ? (releaseTagFromPackageVersion(packageVersion) ?? "") : "";
  if (releaseTag !== expectedTag) {
    errors.push(
      `Release tag ${releaseTag || "<missing>"} does not match package.json version ${
        packageVersion || "<missing>"
      }; expected ${expectedTag || "<missing>"}.`,
    );
  }

  if (params.releaseSha?.trim() && params.releaseMainRef?.trim()) {
    try {
      execFileSync(
        "git",
        ["merge-base", "--is-ancestor", params.releaseSha, params.releaseMainRef],
        { stdio: "ignore" },
      );
    } catch {
      errors.push(
        `Tagged commit ${params.releaseSha} is not contained in ${params.releaseMainRef}.`,
      );
    }
  }

  return errors;
}

function loadPackageJson(): PackageJson {
  return JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
}

function main(): number {
  const pkg = loadPackageJson();
  const metadataErrors = collectReleasePackageMetadataErrors(pkg);
  const tagErrors = collectReleaseTagErrors({
    packageVersion: pkg.version ?? "",
    releaseTag: process.env.RELEASE_TAG ?? "",
    releaseSha: process.env.RELEASE_SHA,
    releaseMainRef: process.env.RELEASE_MAIN_REF,
  });
  const errors = [...metadataErrors, ...tagErrors];

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`openclaw-npm-release-check: ${error}`);
    }
    return 1;
  }

  const parsedVersion = parseReleaseVersion(pkg.version ?? "");
  const channel = parsedVersion?.channel ?? "unknown";
  console.log(`openclaw-npm-release-check: validated ${channel} release ${pkg.version}.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(main());
}
