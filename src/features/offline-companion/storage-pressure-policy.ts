import {
  decideOfflineStorageAction,
  type OfflineStorageArtifact,
  type OfflineStorageContext,
  type OfflineStorageDecision,
} from "./storage-policy";

const GIB = 1024 ** 3;

export type DiskSpaceSnapshot = Readonly<{
  availableBytes: number;
  totalBytes: number;
}>;

export type OfflineStoragePressureLimits = Readonly<{
  minimumFreeRatio: number;
  minimumFreeFloorBytes: number;
  maxRehydratableRatio: number;
  maxRehydratableCeilingBytes: number;
}>;

export type PrefetchStoragePressureResult = Readonly<{
  decision: Extract<OfflineStorageDecision, "keep" | "stop_prefetch">;
  context: OfflineStorageContext | null;
  reason: "allowed" | "minimum_free_reserve" | "rehydratable_budget" | "measurement_unavailable";
}>;

export const DEFAULT_OFFLINE_STORAGE_PRESSURE_LIMITS: OfflineStoragePressureLimits = {
  minimumFreeRatio: 0.08,
  minimumFreeFloorBytes: 1 * GIB,
  maxRehydratableRatio: 0.08,
  maxRehydratableCeilingBytes: 4 * GIB,
};

export function buildOfflineStorageContext(
  disk: DiskSpaceSnapshot,
  rehydratableBytes: number,
  limits: OfflineStoragePressureLimits = DEFAULT_OFFLINE_STORAGE_PRESSURE_LIMITS,
): OfflineStorageContext {
  assertDiskSpaceSnapshot(disk);
  assertByteCount(rehydratableBytes, "rehydratableBytes");
  assertLimits(limits);

  const minimumFreeBytes = Math.max(
    limits.minimumFreeFloorBytes,
    Math.floor(disk.totalBytes * limits.minimumFreeRatio),
  );
  const maxRehydratableBytes = Math.min(
    limits.maxRehydratableCeilingBytes,
    Math.floor(disk.totalBytes * limits.maxRehydratableRatio),
  );

  return {
    freeBytes: disk.availableBytes,
    rehydratableBytes,
    minimumFreeBytes,
    maxRehydratableBytes,
  };
}

export function decidePrefetchStoragePressure(
  artifact: OfflineStorageArtifact,
  disk: DiskSpaceSnapshot | null,
  rehydratableBytes: number | null,
  limits: OfflineStoragePressureLimits = DEFAULT_OFFLINE_STORAGE_PRESSURE_LIMITS,
): PrefetchStoragePressureResult {
  if (artifact.storageClass !== "rehydratable_cache") {
    return { decision: "keep", context: null, reason: "allowed" };
  }

  if (disk === null || rehydratableBytes === null) {
    return { decision: "stop_prefetch", context: null, reason: "measurement_unavailable" };
  }

  const context = buildOfflineStorageContext(disk, rehydratableBytes, limits);
  const decision = decideOfflineStorageAction(artifact, context, "prefetch");

  if (decision === "keep") {
    return { decision, context, reason: "allowed" };
  }

  const remainingFreeBytes = context.freeBytes - artifact.sizeBytes;
  if (remainingFreeBytes < context.minimumFreeBytes) {
    return { decision: "stop_prefetch", context, reason: "minimum_free_reserve" };
  }

  return { decision: "stop_prefetch", context, reason: "rehydratable_budget" };
}

function assertDiskSpaceSnapshot(snapshot: DiskSpaceSnapshot): void {
  assertByteCount(snapshot.availableBytes, "availableBytes");
  assertByteCount(snapshot.totalBytes, "totalBytes");
  if (snapshot.totalBytes === 0 || snapshot.availableBytes > snapshot.totalBytes) {
    throw new Error("Mesure disque incohérente.");
  }
}

function assertLimits(limits: OfflineStoragePressureLimits): void {
  assertRatio(limits.minimumFreeRatio, "minimumFreeRatio");
  assertRatio(limits.maxRehydratableRatio, "maxRehydratableRatio");
  assertByteCount(limits.minimumFreeFloorBytes, "minimumFreeFloorBytes");
  assertByteCount(limits.maxRehydratableCeilingBytes, "maxRehydratableCeilingBytes");
}

function assertRatio(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`${field} doit être un ratio compris entre 0 et 1.`);
  }
}

function assertByteCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} doit être un nombre d’octets entier positif ou nul.`);
  }
}
