import { resetToolStream } from "../app-tool-stream.ts";
import { extractText } from "../chat/message-extract.ts";
import { formatConnectError } from "../connect-error.ts";
import type { GatewayBrowserClient } from "../gateway.ts";
import type { ChatAttachment } from "../ui-types.ts";
import { generateUUID } from "../uuid.ts";

const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;

function isSilentReplyStream(text: string): boolean {
  return SILENT_REPLY_PATTERN.test(text);
}
/** Client-side defense-in-depth: detect assistant messages whose text is purely NO_REPLY. */
function isAssistantSilentReply(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  const entry = message as Record<string, unknown>;
  const role = typeof entry.role === "string" ? entry.role.toLowerCase() : "";
  if (role !== "assistant") {
    return false;
  }
  // entry.text takes precedence — matches gateway extractAssistantTextForSilentCheck
  if (typeof entry.text === "string") {
    return isSilentReplyStream(entry.text);
  }
  const text = extractText(message);
  return typeof text === "string" && isSilentReplyStream(text);
}

export type ChatState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  sessionKey: string;
  chatLoading: boolean;
  chatMessages: unknown[];
  chatResetCutoffTs?: number | null;
  chatThinkingLevel: string | null;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: ChatAttachment[];
  chatRunId: string | null;
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  lastError: string | null;
};

export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

type OptimisticUserMessage = Record<string, unknown> & {
  role: "user";
  pending?: boolean;
  localOnly?: boolean;
  clientRequestId?: string;
};

function getComparableRequestId(message: Record<string, unknown>): string {
  const clientRequestId =
    typeof message.clientRequestId === "string" ? message.clientRequestId.trim() : "";
  if (clientRequestId) {
    return clientRequestId;
  }
  const idempotencyKey =
    typeof message.idempotencyKey === "string" ? message.idempotencyKey.trim() : "";
  return idempotencyKey;
}

function normalizeComparableUserText(message: Record<string, unknown>): string {
  return (extractText(message) ?? "").replace(/\r\n/g, "\n").trim();
}

function isResetControlText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === "/new" || normalized === "/reset";
}

function isResetControlUserMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  const record = message as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role.toLowerCase() : "";
  if (role !== "user") {
    return false;
  }
  return isResetControlText(normalizeComparableUserText(record));
}

function maybeResetToolStream(state: ChatState) {
  const toolHost = state as ChatState & Partial<Parameters<typeof resetToolStream>[0]>;
  if (
    toolHost.toolStreamById instanceof Map &&
    Array.isArray(toolHost.toolStreamOrder) &&
    Array.isArray(toolHost.chatToolMessages) &&
    Array.isArray(toolHost.chatStreamSegments)
  ) {
    resetToolStream(toolHost as Parameters<typeof resetToolStream>[0]);
  }
}

function getImageAttachmentCount(message: unknown): number {
  if (!message || typeof message !== "object") {
    return 0;
  }
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return 0;
  }
  return content.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    return (item as Record<string, unknown>).type === "image";
  }).length;
}

function getLocalUserMessages(messages: unknown[]): OptimisticUserMessage[] {
  return messages.filter((message): message is OptimisticUserMessage => {
    if (!message || typeof message !== "object") {
      return false;
    }
    const record = message as Record<string, unknown>;
    return record.role === "user" && record.localOnly === true;
  });
}

function sameUserMessage(a: unknown, b: unknown): boolean {
  if (!a || typeof a !== "object" || !b || typeof b !== "object") {
    return false;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftRole = typeof left.role === "string" ? left.role.toLowerCase() : "";
  const rightRole = typeof right.role === "string" ? right.role.toLowerCase() : "";
  if (leftRole !== "user" || rightRole !== "user") {
    return false;
  }
  const leftRequestId = getComparableRequestId(left);
  const rightRequestId = getComparableRequestId(right);
  if (leftRequestId && rightRequestId) {
    return leftRequestId === rightRequestId;
  }
  const leftText = normalizeComparableUserText(left);
  const rightText = normalizeComparableUserText(right);
  if (leftText !== rightText) {
    return false;
  }
  return getImageAttachmentCount(left) === getImageAttachmentCount(right);
}

function mergeLocalUserMessages(history: unknown[], current: unknown[]): unknown[] {
  const localUsers = getLocalUserMessages(current);
  if (localUsers.length === 0) {
    return history;
  }
  const merged = [...history];
  for (const localMessage of localUsers) {
    if (history.some((message) => sameUserMessage(message, localMessage))) {
      continue;
    }
    merged.push(localMessage);
  }
  return merged;
}

function toTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getMessageTimestampMs(message: unknown): number | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const record = message as Record<string, unknown>;
  return toTimestampMs(record.timestamp ?? record.ts ?? record.createdAt);
}

function filterHistoryAfterReset(
  messages: unknown[],
  cutoffTs: number | null | undefined,
): unknown[] {
  const nonControlMessages = messages.filter((message) => !isResetControlUserMessage(message));
  if (!cutoffTs) {
    return nonControlMessages;
  }
  return nonControlMessages.filter((message) => {
    const timestamp = getMessageTimestampMs(message);
    return timestamp != null && timestamp >= cutoffTs;
  });
}

function settleLocalUserMessage(messages: unknown[], runId: string | null): unknown[] {
  if (!runId) {
    return messages;
  }
  return messages.map((message) => {
    if (!message || typeof message !== "object") {
      return message;
    }
    const record = message as Record<string, unknown>;
    if (record.role !== "user" || record.localOnly !== true) {
      return message;
    }
    if (getComparableRequestId(record) !== runId) {
      return message;
    }
    return {
      ...record,
      pending: false,
    };
  });
}

export async function loadChatHistory(state: ChatState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.chatLoading = true;
  state.lastError = null;
  try {
    const res = await state.client.request<{ messages?: Array<unknown>; thinkingLevel?: string }>(
      "chat.history",
      {
        sessionKey: state.sessionKey,
        limit: 200,
      },
    );
    const messages = Array.isArray(res.messages) ? res.messages : [];
    const filteredMessages = filterHistoryAfterReset(
      messages.filter((message) => !isAssistantSilentReply(message)),
      state.chatResetCutoffTs,
    );
    state.chatMessages = mergeLocalUserMessages(filteredMessages, state.chatMessages);
    state.chatThinkingLevel = res.thinkingLevel ?? null;
    // Clear all streaming state — history includes tool results and text
    // inline, so keeping streaming artifacts would cause duplicates.
    maybeResetToolStream(state);
    state.chatStream = null;
    state.chatStreamStartedAt = null;
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.chatLoading = false;
  }
}

function dataUrlToBase64(dataUrl: string): { content: string; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mimeType: match[1], content: match[2] };
}

type AssistantMessageNormalizationOptions = {
  roleRequirement: "required" | "optional";
  roleCaseSensitive?: boolean;
  requireContentArray?: boolean;
  allowTextField?: boolean;
};

function normalizeAssistantMessage(
  message: unknown,
  options: AssistantMessageNormalizationOptions,
): Record<string, unknown> | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const candidate = message as Record<string, unknown>;
  const roleValue = candidate.role;
  if (typeof roleValue === "string") {
    const role = options.roleCaseSensitive ? roleValue : roleValue.toLowerCase();
    if (role !== "assistant") {
      return null;
    }
  } else if (options.roleRequirement === "required") {
    return null;
  }

  if (options.requireContentArray) {
    return Array.isArray(candidate.content) ? candidate : null;
  }
  if (!("content" in candidate) && !(options.allowTextField && "text" in candidate)) {
    return null;
  }
  return candidate;
}

function normalizeAbortedAssistantMessage(message: unknown): Record<string, unknown> | null {
  return normalizeAssistantMessage(message, {
    roleRequirement: "required",
    roleCaseSensitive: true,
    requireContentArray: true,
  });
}

function normalizeFinalAssistantMessage(message: unknown): Record<string, unknown> | null {
  return normalizeAssistantMessage(message, {
    roleRequirement: "optional",
    allowTextField: true,
  });
}

export async function sendChatMessage(
  state: ChatState,
  message: string,
  attachments?: ChatAttachment[],
  opts?: { suppressLocalEcho?: boolean },
): Promise<string | null> {
  if (!state.client || !state.connected) {
    return null;
  }
  const msg = message.trim();
  const hasAttachments = attachments && attachments.length > 0;
  if (!msg && !hasAttachments) {
    return null;
  }

  const now = Date.now();
  const runId = generateUUID();

  // Build user message content blocks
  const contentBlocks: Array<{ type: string; text?: string; source?: unknown }> = [];
  if (msg) {
    contentBlocks.push({ type: "text", text: msg });
  }
  // Add image previews to the message for display
  if (hasAttachments) {
    for (const att of attachments) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: att.mimeType, data: att.dataUrl },
      });
    }
  }

  if (!opts?.suppressLocalEcho) {
    state.chatMessages = [
      ...state.chatMessages,
      {
        role: "user",
        content: contentBlocks,
        timestamp: now,
        pending: true,
        localOnly: true,
        clientRequestId: runId,
      },
    ];
  }

  state.chatSending = true;
  state.lastError = null;
  state.chatRunId = runId;
  state.chatStream = "";
  state.chatStreamStartedAt = now;

  // Convert attachments to API format
  const apiAttachments = hasAttachments
    ? attachments
        .map((att) => {
          const parsed = dataUrlToBase64(att.dataUrl);
          if (!parsed) {
            return null;
          }
          return {
            type: "image",
            mimeType: parsed.mimeType,
            content: parsed.content,
          };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null)
    : undefined;

  try {
    await state.client.request("chat.send", {
      sessionKey: state.sessionKey,
      message: msg,
      deliver: false,
      idempotencyKey: runId,
      attachments: apiAttachments,
    });
    return runId;
  } catch (err) {
    const error = formatConnectError(err);
    state.chatRunId = null;
    state.chatStream = null;
    state.chatStreamStartedAt = null;
    state.lastError = error;
    state.chatMessages = [
      ...state.chatMessages,
      {
        role: "assistant",
        content: [{ type: "text", text: "Error: " + error }],
        timestamp: Date.now(),
      },
    ];
    return null;
  } finally {
    state.chatSending = false;
  }
}

export async function abortChatRun(state: ChatState): Promise<boolean> {
  if (!state.client || !state.connected) {
    return false;
  }
  const runId = state.chatRunId;
  try {
    await state.client.request(
      "chat.abort",
      runId ? { sessionKey: state.sessionKey, runId } : { sessionKey: state.sessionKey },
    );
    return true;
  } catch (err) {
    state.lastError = formatConnectError(err);
    return false;
  }
}

export function handleChatEvent(state: ChatState, payload?: ChatEventPayload) {
  if (!payload) {
    return null;
  }
  if (payload.sessionKey !== state.sessionKey) {
    return null;
  }

  // Final from another run (e.g. sub-agent announce): refresh history to show new message.
  // See https://github.com/openclaw/openclaw/issues/1909
  if (payload.runId && state.chatRunId && payload.runId !== state.chatRunId) {
    if (payload.state === "final") {
      const finalMessage = normalizeFinalAssistantMessage(payload.message);
      if (finalMessage && !isAssistantSilentReply(finalMessage)) {
        state.chatMessages = [...state.chatMessages, finalMessage];
        return null;
      }
      return "final";
    }
    return null;
  }

  if (payload.state === "delta") {
    const next = extractText(payload.message);
    if (typeof next === "string" && !isSilentReplyStream(next)) {
      const current = state.chatStream ?? "";
      if (!current || next.length >= current.length) {
        state.chatStream = next;
      }
    }
  } else if (payload.state === "final") {
    state.chatMessages = settleLocalUserMessage(state.chatMessages, payload.runId);
    const finalMessage = normalizeFinalAssistantMessage(payload.message);
    if (finalMessage && !isAssistantSilentReply(finalMessage)) {
      state.chatMessages = [...state.chatMessages, finalMessage];
    } else if (state.chatStream?.trim() && !isSilentReplyStream(state.chatStream)) {
      state.chatMessages = [
        ...state.chatMessages,
        {
          role: "assistant",
          content: [{ type: "text", text: state.chatStream }],
          timestamp: Date.now(),
        },
      ];
    }
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  } else if (payload.state === "aborted") {
    state.chatMessages = settleLocalUserMessage(state.chatMessages, payload.runId);
    const normalizedMessage = normalizeAbortedAssistantMessage(payload.message);
    if (normalizedMessage && !isAssistantSilentReply(normalizedMessage)) {
      state.chatMessages = [...state.chatMessages, normalizedMessage];
    } else {
      const streamedText = state.chatStream ?? "";
      if (streamedText.trim() && !isSilentReplyStream(streamedText)) {
        state.chatMessages = [
          ...state.chatMessages,
          {
            role: "assistant",
            content: [{ type: "text", text: streamedText }],
            timestamp: Date.now(),
          },
        ];
      }
    }
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  } else if (payload.state === "error") {
    state.chatMessages = settleLocalUserMessage(state.chatMessages, payload.runId);
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
    state.lastError = payload.errorMessage ?? "chat error";
  }
  return payload.state;
}
