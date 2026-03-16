/**
 * Session memory hook handler
 *
 * Retired: legacy markdown memory files are no longer used by MindClaw.
 */

import { createSubsystemLogger } from "../../../logging/subsystem.js";
import type { HookHandler } from "../../hooks.js";

const log = createSubsystemLogger("hooks/session-memory");
const saveSessionToMemory: HookHandler = async (event) => {
  const isResetCommand = event.action === "new" || event.action === "reset";
  if (event.type !== "command" || !isResetCommand) {
    return;
  }
  log.debug("Legacy session-memory hook skipped; integrated memory store is authoritative.", {
    action: event.action,
    sessionKey: event.sessionKey,
  });
};

export default saveSessionToMemory;
