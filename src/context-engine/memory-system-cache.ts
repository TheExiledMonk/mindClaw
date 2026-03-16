import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  MemoryContextPacket,
  MemoryStoreBackendKind,
  MemoryStoreMetadata,
  MemoryStoreSnapshot,
} from "./memory-system-store.js";

type SnapshotCacheEntry = {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  metadata: MemoryStoreMetadata;
  snapshot: MemoryStoreSnapshot;
};

type PacketCacheEntry = {
  key: string;
  packet: MemoryContextPacket;
};

type RecentQueryEntry = {
  querySignature: string;
  params: {
    messages?: AgentMessage[];
    workingItemsMax?: number;
    includeLongTermMemory?: boolean;
  };
};

type MemoryCacheStats = {
  snapshotHits: number;
  snapshotMisses: number;
  packetHits: number;
  packetMisses: number;
  invalidations: number;
};

const snapshotCache = new Map<string, SnapshotCacheEntry>();
const packetCache = new Map<string, PacketCacheEntry>();
const recentQueryCache = new Map<string, RecentQueryEntry[]>();
const stats: MemoryCacheStats = {
  snapshotHits: 0,
  snapshotMisses: 0,
  packetHits: 0,
  packetMisses: 0,
  invalidations: 0,
};

function buildSessionKey(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
}): string {
  return `${params.workspaceDir}::${params.sessionId}::${params.backendKind ?? "fs-json"}`;
}

function buildPacketKey(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  metadata: MemoryStoreMetadata;
  querySignature: string;
}): string {
  const meta = params.metadata;
  return [
    buildSessionKey(params),
    meta.snapshotVersion ?? 0,
    meta.workingMemoryVersion ?? 0,
    meta.longTermMemoryVersion ?? 0,
    meta.permanentMemoryVersion ?? 0,
    meta.graphVersion ?? 0,
    params.querySignature,
  ].join("::");
}

function extractMessageText(message: AgentMessage): string {
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .flatMap((block) => {
      if (!block || typeof block !== "object") {
        return [];
      }
      const text = (block as { text?: unknown }).text;
      return typeof text === "string" && text.trim() ? [text.trim()] : [];
    })
    .join("\n")
    .trim();
}

function normalizeComparable(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildMemoryQuerySignature(params: {
  messages?: AgentMessage[];
  workingItemsMax?: number;
  includeLongTermMemory?: boolean;
}): string {
  const latestTexts = (params.messages ?? [])
    .map((message) => extractMessageText(message))
    .filter(Boolean)
    .slice(-4)
    .map((text) => normalizeComparable(text));
  return [
    `working=${params.workingItemsMax ?? "default"}`,
    `longTerm=${params.includeLongTermMemory === false ? "off" : "on"}`,
    ...latestTexts,
  ].join("||");
}

function sameMetadata(a: MemoryStoreMetadata, b: MemoryStoreMetadata): boolean {
  return (
    (a.snapshotVersion ?? 0) === (b.snapshotVersion ?? 0) &&
    (a.workingMemoryVersion ?? 0) === (b.workingMemoryVersion ?? 0) &&
    (a.longTermMemoryVersion ?? 0) === (b.longTermMemoryVersion ?? 0) &&
    (a.permanentMemoryVersion ?? 0) === (b.permanentMemoryVersion ?? 0) &&
    (a.graphVersion ?? 0) === (b.graphVersion ?? 0)
  );
}

export async function getCachedMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  loadMetadata: () => Promise<MemoryStoreMetadata>;
  loadSnapshot: () => Promise<MemoryStoreSnapshot>;
}): Promise<{ snapshot: MemoryStoreSnapshot; metadata: MemoryStoreMetadata; cacheHit: boolean }> {
  const key = buildSessionKey(params);
  const metadata = await params.loadMetadata();
  const cached = snapshotCache.get(key);
  if (cached && sameMetadata(cached.metadata, metadata)) {
    stats.snapshotHits += 1;
    return { snapshot: cached.snapshot, metadata: cached.metadata, cacheHit: true };
  }
  stats.snapshotMisses += 1;
  const snapshot = await params.loadSnapshot();
  snapshotCache.set(key, {
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind: params.backendKind,
    metadata,
    snapshot,
  });
  return { snapshot, metadata, cacheHit: false };
}

export function primeMemoryStoreSnapshot(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  metadata: MemoryStoreMetadata;
  snapshot: MemoryStoreSnapshot;
}): void {
  snapshotCache.set(buildSessionKey(params), {
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind: params.backendKind,
    metadata: params.metadata,
    snapshot: params.snapshot,
  });
}

export function getCachedMemoryContextPacket(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  metadata: MemoryStoreMetadata;
  querySignature: string;
  queryParams?: {
    messages?: AgentMessage[];
    workingItemsMax?: number;
    includeLongTermMemory?: boolean;
  };
  buildPacket: () => MemoryContextPacket;
}): { packet: MemoryContextPacket; cacheHit: boolean } {
  rememberRecentQuery({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind: params.backendKind,
    querySignature: params.querySignature,
    params: params.queryParams,
  });
  const key = buildPacketKey(params);
  const cached = packetCache.get(key);
  if (cached) {
    stats.packetHits += 1;
    return { packet: cached.packet, cacheHit: true };
  }
  stats.packetMisses += 1;
  const packet = params.buildPacket();
  packetCache.set(key, { key, packet });
  return { packet, cacheHit: false };
}

export function primeMemoryContextPacket(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  metadata: MemoryStoreMetadata;
  querySignature: string;
  queryParams?: {
    messages?: AgentMessage[];
    workingItemsMax?: number;
    includeLongTermMemory?: boolean;
  };
  packet: MemoryContextPacket;
}): void {
  rememberRecentQuery({
    workspaceDir: params.workspaceDir,
    sessionId: params.sessionId,
    backendKind: params.backendKind,
    querySignature: params.querySignature,
    params: params.queryParams,
  });
  packetCache.set(buildPacketKey(params), {
    key: buildPacketKey(params),
    packet: params.packet,
  });
}

function rememberRecentQuery(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  querySignature: string;
  params?: {
    messages?: AgentMessage[];
    workingItemsMax?: number;
    includeLongTermMemory?: boolean;
  };
}): void {
  const sessionKey = buildSessionKey(params);
  const existing = recentQueryCache.get(sessionKey) ?? [];
  const nextEntry: RecentQueryEntry = {
    querySignature: params.querySignature,
    params: {
      messages: params.params?.messages,
      workingItemsMax: params.params?.workingItemsMax,
      includeLongTermMemory: params.params?.includeLongTermMemory,
    },
  };
  const deduped = [
    nextEntry,
    ...existing.filter((entry) => entry.querySignature !== params.querySignature),
  ].slice(0, 8);
  recentQueryCache.set(sessionKey, deduped);
}

export function listRecentMemoryQueries(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
}): RecentQueryEntry[] {
  return [...(recentQueryCache.get(buildSessionKey(params)) ?? [])];
}

export function invalidateMemoryCache(params: {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
}): void {
  const prefix = `${buildSessionKey(params)}::`;
  snapshotCache.delete(buildSessionKey(params));
  for (const key of packetCache.keys()) {
    if (key.startsWith(prefix)) {
      packetCache.delete(key);
    }
  }
  stats.invalidations += 1;
}

export function getMemoryCacheStats(): MemoryCacheStats {
  return { ...stats };
}
