export type OfflineStorageClass =
  | "private_unsynced"
  | "durable_business"
  | "rehydratable_cache";

export type CompanionTripStoragePriority =
  | "current"
  | "upcoming"
  | "prepared_recent"
  | "history";

export type OfflineStorageDecision = "keep" | "evictable" | "stop_prefetch";
export type OfflineStorageIntent = "retain" | "prefetch";

export type OfflineStorageArtifact = Readonly<{
  id: string;
  accountUserId: string;
  tripId: string | null;
  storageClass: OfflineStorageClass;
  tripPriority: CompanionTripStoragePriority;
  sizeBytes: number;
  lastAccessedAt: number | null;
}>;

export type OfflineStorageContext = Readonly<{
  freeBytes: number;
  rehydratableBytes: number;
  minimumFreeBytes: number;
  maxRehydratableBytes: number;
}>;

const EVICTION_PRIORITY: Readonly<Record<CompanionTripStoragePriority, number>> = {
  history: 0,
  prepared_recent: 1,
  upcoming: 2,
  current: 3,
};

export function decideOfflineStorageAction(
  artifact: OfflineStorageArtifact,
  context: OfflineStorageContext,
  intent: OfflineStorageIntent,
): OfflineStorageDecision {
  assertStorageArtifact(artifact);
  assertStorageContext(context);

  if (artifact.storageClass !== "rehydratable_cache") return "keep";

  if (intent === "prefetch") {
    const remainingFreeBytes = context.freeBytes - artifact.sizeBytes;
    const projectedRehydratableBytes = context.rehydratableBytes + artifact.sizeBytes;

    if (
      remainingFreeBytes < context.minimumFreeBytes ||
      projectedRehydratableBytes > context.maxRehydratableBytes
    ) {
      return "stop_prefetch";
    }

    return "keep";
  }

  const underPressure =
    context.freeBytes < context.minimumFreeBytes ||
    context.rehydratableBytes > context.maxRehydratableBytes;
  if (!underPressure) return "keep";

  return artifact.tripPriority === "current" || artifact.tripPriority === "upcoming"
    ? "keep"
    : "evictable";
}

export function rankRehydratableEvictionCandidates(
  artifacts: readonly OfflineStorageArtifact[],
  context: OfflineStorageContext,
  accountUserId: string,
): readonly OfflineStorageArtifact[] {
  assertScopeValue(accountUserId, "accountUserId");
  assertStorageContext(context);

  return artifacts
    .filter(
      (artifact) =>
        artifact.accountUserId === accountUserId &&
        decideOfflineStorageAction(artifact, context, "retain") === "evictable",
    )
    .sort((left, right) => {
      const priorityDifference =
        EVICTION_PRIORITY[left.tripPriority] - EVICTION_PRIORITY[right.tripPriority];
      if (priorityDifference !== 0) return priorityDifference;

      const accessDifference =
        (left.lastAccessedAt ?? Number.NEGATIVE_INFINITY) -
        (right.lastAccessedAt ?? Number.NEGATIVE_INFINITY);
      if (accessDifference !== 0) return accessDifference;

      return right.sizeBytes - left.sizeBytes;
    });
}

function assertStorageArtifact(artifact: OfflineStorageArtifact): void {
  assertScopeValue(artifact.id, "id");
  assertScopeValue(artifact.accountUserId, "accountUserId");
  if (artifact.tripId !== null) assertScopeValue(artifact.tripId, "tripId");
  assertByteCount(artifact.sizeBytes, "sizeBytes");
  if (artifact.lastAccessedAt !== null && !Number.isFinite(artifact.lastAccessedAt)) {
    throw new Error("lastAccessedAt doit être un timestamp fini ou null.");
  }
}

function assertStorageContext(context: OfflineStorageContext): void {
  assertByteCount(context.freeBytes, "freeBytes");
  assertByteCount(context.rehydratableBytes, "rehydratableBytes");
  assertByteCount(context.minimumFreeBytes, "minimumFreeBytes");
  assertByteCount(context.maxRehydratableBytes, "maxRehydratableBytes");
}

function assertByteCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} doit être un nombre d’octets entier positif ou nul.`);
  }
}

function assertScopeValue(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`${field} ne peut pas être vide.`);
}
