import {
  primeMemoryContextPacket,
  primeMemoryStoreSnapshot,
  listRecentMemoryQueries,
} from "./memory-system-cache.js";
import {
  inspectMemoryStoreHealth,
  loadMemoryStoreMetadata,
  loadMemoryStoreSnapshot,
  persistMemoryStoreSnapshot,
  retrieveMemoryContextPacket,
  runMemorySleepReview,
  type MemoryStoreBackendKind,
} from "./memory-system-store.js";

type RefreshJob = {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  reason: "after-turn" | "memory-store" | "review" | "compact" | "maintenance";
};

export type MemoryBackgroundWorkerStats = {
  queued: number;
  completed: number;
  failed: number;
  active: number;
  maintenanceRuns: number;
  lastReason?: RefreshJob["reason"];
};

const queue = new Map<string, RefreshJob>();
let loopScheduled = false;
let activeJobs = 0;
let idleResolver: (() => void) | null = null;
const stats: MemoryBackgroundWorkerStats = {
  queued: 0,
  completed: 0,
  failed: 0,
  active: 0,
  maintenanceRuns: 0,
};
const lastMaintenanceAt = new Map<string, number>();
const MAINTENANCE_COOLDOWN_MS = 1000 * 60 * 5;

function buildJobKey(job: Omit<RefreshJob, "reason">): string {
  return `${job.workspaceDir}::${job.sessionId}::${job.backendKind ?? "fs-json"}`;
}

async function runJob(job: RefreshJob): Promise<void> {
  const sessionKey = buildJobKey(job);
  const metadata = await loadMemoryStoreMetadata({
    workspaceDir: job.workspaceDir,
    sessionId: job.sessionId,
    backendKind: job.backendKind,
  });
  const snapshot = await loadMemoryStoreSnapshot({
    workspaceDir: job.workspaceDir,
    sessionId: job.sessionId,
    backendKind: job.backendKind,
  });
  let nextMetadata = metadata;
  let nextSnapshot = snapshot;
  const now = Date.now();
  const lastMaintenance = lastMaintenanceAt.get(sessionKey) ?? 0;
  if (job.reason !== "review" && now - lastMaintenance >= MAINTENANCE_COOLDOWN_MS) {
    const health = await inspectMemoryStoreHealth({
      workspaceDir: job.workspaceDir,
      sessionId: job.sessionId,
      backendKind: job.backendKind,
    });
    if (
      health.staleMemoryCount >
        Math.max(8, Math.floor((snapshot.longTermMemory.length || 0) * 0.3)) ||
      health.supersededMemoryCount >
        Math.max(5, Math.floor((snapshot.longTermMemory.length || 0) * 0.2))
    ) {
      const reviewed = runMemorySleepReview({
        sessionId: job.sessionId,
        snapshot,
      });
      await persistMemoryStoreSnapshot({
        workspaceDir: job.workspaceDir,
        sessionId: job.sessionId,
        workingMemory: reviewed.workingMemory,
        longTermMemory: reviewed.longTermMemory,
        pendingSignificance: reviewed.pendingSignificance,
        permanentMemory: reviewed.permanentMemory,
        graph: reviewed.graph,
        backendKind: job.backendKind,
      });
      nextMetadata = await loadMemoryStoreMetadata({
        workspaceDir: job.workspaceDir,
        sessionId: job.sessionId,
        backendKind: job.backendKind,
      });
      nextSnapshot = await loadMemoryStoreSnapshot({
        workspaceDir: job.workspaceDir,
        sessionId: job.sessionId,
        backendKind: job.backendKind,
      });
      lastMaintenanceAt.set(sessionKey, now);
      stats.maintenanceRuns += 1;
    }
  }
  primeMemoryStoreSnapshot({
    workspaceDir: job.workspaceDir,
    sessionId: job.sessionId,
    backendKind: job.backendKind,
    metadata: nextMetadata,
    snapshot: nextSnapshot,
  });

  for (const recent of listRecentMemoryQueries({
    workspaceDir: job.workspaceDir,
    sessionId: job.sessionId,
    backendKind: job.backendKind,
  })) {
    primeMemoryContextPacket({
      workspaceDir: job.workspaceDir,
      sessionId: job.sessionId,
      backendKind: job.backendKind,
      metadata: nextMetadata,
      querySignature: recent.querySignature,
      queryParams: recent.params,
      packet: retrieveMemoryContextPacket(nextSnapshot, {
        messages: recent.params.messages,
        workingItemsMax: recent.params.workingItemsMax,
        includeLongTermMemory: recent.params.includeLongTermMemory,
      }),
    });
  }
}

async function processQueue(): Promise<void> {
  loopScheduled = false;
  while (queue.size > 0) {
    const [key, job] = queue.entries().next().value as [string, RefreshJob];
    queue.delete(key);
    activeJobs += 1;
    stats.active = activeJobs;
    stats.lastReason = job.reason;
    try {
      await runJob(job);
      stats.completed += 1;
    } catch {
      stats.failed += 1;
    } finally {
      activeJobs -= 1;
      stats.active = activeJobs;
    }
  }
  if (activeJobs === 0 && queue.size === 0 && idleResolver) {
    const resolve = idleResolver;
    idleResolver = null;
    resolve();
  }
}

function scheduleLoop(): void {
  if (loopScheduled) {
    return;
  }
  loopScheduled = true;
  setTimeout(() => {
    void processQueue();
  }, 0);
}

export function enqueueMemoryBackgroundRefresh(job: RefreshJob): void {
  queue.set(buildJobKey(job), job);
  stats.queued += 1;
  scheduleLoop();
}

export function getMemoryBackgroundWorkerStats(): MemoryBackgroundWorkerStats {
  return { ...stats };
}

export async function waitForMemoryBackgroundWorkerIdle(): Promise<void> {
  if (queue.size === 0 && activeJobs === 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    idleResolver = resolve;
  });
}
