import type {
  CompanionTripStoragePriority,
  OfflineStorageArtifact,
} from "./storage-policy";

export const REHYDRATABLE_CACHE_KINDS = ["remote_media", "document", "map_region"] as const;

export type RehydratableCacheKind = (typeof REHYDRATABLE_CACHE_KINDS)[number];

export type RehydratableCacheItem = Readonly<{
  accountUserId: string;
  cacheId: string;
  tripId: string | null;
  kind: RehydratableCacheKind;
  storageKey: string;
  sourceFingerprint: string;
  sizeBytes: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export type SaveRehydratableCacheItemInput = Readonly<{
  accountUserId: string;
  cacheId: string;
  tripId?: string | null;
  kind: RehydratableCacheKind;
  storageKey: string;
  sourceFingerprint: string;
  sizeBytes: number;
  lastAccessedAt?: string;
}>;

const SAFE_PATH_COMPONENT = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_FINGERPRINT = /^[A-Za-z0-9._:-]{1,256}$/;
const STORAGE_PREFIX = "rehydratable";

export function createRehydratableCacheStorageKey(
  accountUserId: string,
  kind: RehydratableCacheKind,
  cacheId: string,
): string {
  assertSafeComponent(accountUserId, "accountUserId");
  assertKind(kind);
  assertSafeComponent(cacheId, "cacheId");
  return `${STORAGE_PREFIX}/${accountUserId}/${kind}/${cacheId}`;
}

export function assertRehydratableCacheInput(input: SaveRehydratableCacheItemInput): void {
  assertSafeComponent(input.accountUserId, "accountUserId");
  assertSafeComponent(input.cacheId, "cacheId");
  if (input.tripId !== undefined && input.tripId !== null) {
    assertSafeComponent(input.tripId, "tripId");
  }
  assertKind(input.kind);
  assertStorageKey(input.storageKey, input.accountUserId, input.kind, input.cacheId);

  if (!SAFE_FINGERPRINT.test(input.sourceFingerprint)) {
    throw new Error("sourceFingerprint doit être un identifiant opaque et borné, jamais une URL signée.");
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0) {
    throw new Error("sizeBytes doit être un nombre d’octets entier positif ou nul.");
  }
  if (input.lastAccessedAt !== undefined) assertIsoDate(input.lastAccessedAt, "lastAccessedAt");
}

export function toOfflineStorageArtifact(
  item: RehydratableCacheItem,
  tripPriority: CompanionTripStoragePriority,
): OfflineStorageArtifact {
  return {
    id: item.cacheId,
    accountUserId: item.accountUserId,
    tripId: item.tripId,
    storageClass: "rehydratable_cache",
    tripPriority,
    sizeBytes: item.sizeBytes,
    lastAccessedAt: Date.parse(item.lastAccessedAt),
  };
}

function assertStorageKey(
  storageKey: string,
  accountUserId: string,
  kind: RehydratableCacheKind,
  cacheId: string,
): void {
  if (storageKey.startsWith("/") || storageKey.includes("\\") || storageKey.includes("..")) {
    throw new Error("storageKey doit rester relatif et détenu par OverMiles.");
  }

  const segments = storageKey.split("/");
  if (
    segments.length !== 4 ||
    segments[0] !== STORAGE_PREFIX ||
    segments[1] !== accountUserId ||
    segments[2] !== kind ||
    segments[3] !== cacheId
  ) {
    throw new Error("storageKey ne correspond pas au compte, au type et à l’artefact déclarés.");
  }
}

function assertKind(value: string): asserts value is RehydratableCacheKind {
  if (!REHYDRATABLE_CACHE_KINDS.includes(value as RehydratableCacheKind)) {
    throw new Error("Type de cache réhydratable invalide.");
  }
}

function assertSafeComponent(value: string, field: string): void {
  if (!SAFE_PATH_COMPONENT.test(value)) {
    throw new Error(`${field} contient des caractères non autorisés.`);
  }
}

function assertIsoDate(value: string, field: string): void {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`${field} doit être une date ISO normalisée.`);
  }
}
