import { describe, expect, it } from "vitest";
import {
  collectReleasePackageMetadataErrors,
  collectReleaseTagErrors,
  parseReleaseVersion,
  parseReleaseTagVersion,
  releaseTagFromPackageVersion,
} from "../scripts/openclaw-npm-release-check.ts";

describe("parseReleaseVersion", () => {
  it("parses stable monthly releases", () => {
    expect(parseReleaseVersion("2026.3.1")).toMatchObject({
      version: "2026.3.1",
      channel: "stable",
      year: 2026,
      month: 3,
      releaseNumber: 1,
    });
  });

  it("parses beta monthly releases", () => {
    expect(parseReleaseVersion("2026.3.2-beta.2")).toMatchObject({
      version: "2026.3.2-beta.2",
      channel: "beta",
      year: 2026,
      month: 3,
      releaseNumber: 2,
      betaNumber: 2,
    });
  });

  it("rejects legacy and malformed release formats", () => {
    expect(parseReleaseVersion("2026.3-1")).toBeNull();
    expect(parseReleaseVersion("2026.03.09")).toBeNull();
    expect(parseReleaseVersion("v2026.3-1")).toBeNull();
    expect(parseReleaseVersion("2.0.0-beta2")).toBeNull();
  });
});

describe("parseReleaseTagVersion", () => {
  it("parses the public git-tag format", () => {
    expect(parseReleaseTagVersion("2026.3-2-beta.3")).toMatchObject({
      version: "2026.3-2-beta.3",
      channel: "beta",
      year: 2026,
      month: 3,
      releaseNumber: 2,
      betaNumber: 3,
    });
  });
});

describe("releaseTagFromPackageVersion", () => {
  it("maps semver package versions to public tag versions", () => {
    expect(releaseTagFromPackageVersion("2026.3.2")).toBe("v2026.3-2");
    expect(releaseTagFromPackageVersion("2026.3.2-beta.4")).toBe("v2026.3-2-beta.4");
  });
});

describe("collectReleaseTagErrors", () => {
  it("accepts matching package and tag versions in the new scheme", () => {
    expect(
      collectReleaseTagErrors({
        packageVersion: "2026.3.1",
        releaseTag: "v2026.3-1",
      }),
    ).toEqual([]);
  });

  it("rejects tags that do not match the current release format", () => {
    expect(
      collectReleaseTagErrors({
        packageVersion: "2026.3.1",
        releaseTag: "v2026.3.1",
      }),
    ).toContainEqual(expect.stringContaining("must match vYYYY.M-R or vYYYY.M-R-beta.N"));
  });
});

describe("collectReleasePackageMetadataErrors", () => {
  it("validates the expected npm package metadata", () => {
    expect(
      collectReleasePackageMetadataErrors({
        name: "openclaw",
        description: "Multi-channel AI gateway with extensible messaging integrations",
        license: "MIT",
        repository: { url: "git+https://github.com/openclaw/openclaw.git" },
        bin: { openclaw: "openclaw.mjs" },
        peerDependencies: { "node-llama-cpp": "3.16.2" },
        peerDependenciesMeta: { "node-llama-cpp": { optional: true } },
      }),
    ).toEqual([]);
  });

  it("requires node-llama-cpp to stay an optional peer", () => {
    expect(
      collectReleasePackageMetadataErrors({
        name: "openclaw",
        description: "Multi-channel AI gateway with extensible messaging integrations",
        license: "MIT",
        repository: { url: "git+https://github.com/openclaw/openclaw.git" },
        bin: { openclaw: "openclaw.mjs" },
        peerDependencies: { "node-llama-cpp": "3.16.2" },
      }),
    ).toContain('package.json peerDependenciesMeta["node-llama-cpp"].optional must be true.');
  });
});
