import { Paths } from "expo-file-system";

import { localDatabase } from "@/src/lib/storage/local-database";

import { rehydratableCacheStore } from "./rehydratable-cache-store";
import {
  decidePrefetchStoragePressure,
  type DiskSpaceSnapshot,
  type PrefetchStoragePressureResult,
} from "./storage-pressure-policy";
import type { OfflineStorageArtifact } from "./storage-policy";

export type EvaluatePrefetchStoragePressureInput = Readonly<{
  accountUserId: string;
  artifact: OfflineStorageArtifact;
}>;

export async function evaluatePrefetchStoragePressure(
  input: EvaluatePrefetchStoragePressureInput,
): Promise<PrefetchStoragePressureResult> {
  if (input.artifact.storageClass !== "rehydratable_cache") {
    return decidePrefetchStoragePressure(input.artifact, null, null);
  }

  const generation = localDatabase.captureGeneration();
  const disk = readDiskSpaceSnapshot();

  try {
    const rehydratableBytes = await rehydratableCacheStore.totalBytesForAccount(
      input.accountUserId,
      generation,
    );

    if (!localDatabase.canUseGeneration(generation)) {
      return decidePrefetchStoragePressure(input.artifact, null, null);
    }

    return decidePrefetchStoragePressure(input.artifact, disk, rehydratableBytes);
  } catch {
    return decidePrefetchStoragePressure(input.artifact, null, null);
  }
}

export function readDiskSpaceSnapshot(): DiskSpaceSnapshot | null {
  try {
    const availableBytes = Paths.availableDiskSpace;
    const totalBytes = Paths.totalDiskSpace;

    if (
      !Number.isSafeInteger(availableBytes) ||
      availableBytes < 0 ||
      !Number.isSafeInteger(totalBytes) ||
      totalBytes <= 0 ||
      availableBytes > totalBytes
    ) {
      return null;
    }

    return { availableBytes, totalBytes };
  } catch {
    return null;
  }
}
