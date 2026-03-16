import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HookHandler } from "../../hooks.js";
import { createHookEvent } from "../../hooks.js";

let handler: HookHandler;
let suiteWorkspaceRoot = "";

beforeAll(async () => {
  ({ default: handler } = await import("./handler.js"));
  suiteWorkspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-session-memory-"));
});

afterAll(async () => {
  if (suiteWorkspaceRoot) {
    await fs.rm(suiteWorkspaceRoot, { recursive: true, force: true });
  }
});

describe("session-memory hook", () => {
  it("does nothing for /new now that legacy markdown memory is retired", async () => {
    const workspaceDir = path.join(suiteWorkspaceRoot, "workspace-new");
    await fs.mkdir(workspaceDir, { recursive: true });

    const event = createHookEvent("command", "new", "agent:main:main", {
      workspaceDir,
    });

    await expect(handler(event)).resolves.toBeUndefined();
    await expect(fs.access(path.join(workspaceDir, "memory"))).rejects.toThrow();
  });

  it("does nothing for /reset now that legacy markdown memory is retired", async () => {
    const workspaceDir = path.join(suiteWorkspaceRoot, "workspace-reset");
    await fs.mkdir(workspaceDir, { recursive: true });

    const event = createHookEvent("command", "reset", "agent:main:main", {
      workspaceDir,
    });

    await expect(handler(event)).resolves.toBeUndefined();
    await expect(fs.access(path.join(workspaceDir, "memory"))).rejects.toThrow();
  });
});
