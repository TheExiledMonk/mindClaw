import {
  primeMemoryContextPacket,
  primeMemoryStoreSnapshot,
  listRecentMemoryQueries,
} from "./memory-system-cache.js";
import {
  loadMemoryStoreMetadata,
  loadMemoryStoreSnapshot,
  retrieveMemoryContextPacket,
  type MemoryStoreBackendKind,
} from "./memory-system-store.js";

type RefreshJob = {
  workspaceDir: string;
  sessionId: string;
  backendKind?: MemoryStoreBackendKind;
  reason: "after-turn" | "memory-store" | "review" | "compact";
};

type MemoryBackgroundWorkerStats = {
  queued: number;
  completed: number;
  failed: number;
  active: number;
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
};

function buildJobKey(job: Omit<RefreshJob, "reason">): string {
  return `${job.workspaceDir}::${job.sessionId}::${job.backendKind ?? "fs-json"}`;
}

async function runJob(job: RefreshJob): Promise<void> {
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
  primeMemoryStoreSnapshot({
    workspaceDir: job.workspaceDir,
    sessionId: job.sessionId,
    backendKind: job.backendKind,
    metadata,
    snapshot,
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
      metadata,
      querySignature: recent.querySignature,
      queryParams: recent.params,
      packet: retrieveMemoryContextPacket(snapshot, {
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
