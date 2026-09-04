import { parseLocalMediaStorageKey } from "./secure-media-path";

export type LocalMediaState = "local_only" | "ready_to_upload" | "uploading" | "failed";

export type LocalMediaItem = Readonly<{
  accountUserId: string;
  tripId: string;
  localMediaId: string;
  storageKey: string;
  originalFilename: string | null;
  mimeType: string;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  orientation: number | null;
  stopId: string | null;
  caption: string | null;
  state: LocalMediaState;
  createdAt: string;
  updatedAt: string;
}>;

export type SaveLocalMediaItemInput = Readonly<{
  accountUserId: string;
  tripId: string;
  localMediaId: string;
  storageKey: string;
  originalFilename?: string | null;
  mimeType: string;
  fileSizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  orientation?: number | null;
  stopId?: string | null;
  caption?: string | null;
  state?: LocalMediaState;
}>;

export function assertLocalMediaInput(input: SaveLocalMediaItemInput): void {
  const parsedStorageKey = parseLocalMediaStorageKey(input.storageKey);
  if (parsedStorageKey.accountUserId !== input.accountUserId) {
    throw new Error("La clé média locale ne correspond pas au compte actif.");
  }
  if (!input.mimeType.startsWith("image/")) {
    throw new Error("Le média local doit être une image.");
  }
  if (input.fileSizeBytes !== undefined && input.fileSizeBytes !== null) {
    if (!Number.isSafeInteger(input.fileSizeBytes) || input.fileSizeBytes < 0) {
      throw new Error("Taille de fichier média locale invalide.");
    }
  }
  validateDimension(input.width, "largeur");
  validateDimension(input.height, "hauteur");
  validateCoordinates(input.latitude, input.longitude);
}

export function isLocalMediaStorageKey(value: string): boolean {
  try {
    parseLocalMediaStorageKey(value);
    return true;
  } catch {
    return false;
  }
}

function validateDimension(value: number | null | undefined, label: string): void {
  if (value === undefined || value === null) return;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Dimension média locale invalide (${label}).`);
  }
}

function validateCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): void {
  if (latitude === undefined || latitude === null) {
    if (longitude !== undefined && longitude !== null) {
      throw new Error("Les coordonnées média locales doivent être fournies ensemble.");
    }
    return;
  }
  if (longitude === undefined || longitude === null) {
    throw new Error("Les coordonnées média locales doivent être fournies ensemble.");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Coordonnées média locales invalides.");
  }
}
