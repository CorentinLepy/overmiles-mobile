const MEDIA_STORAGE_PREFIX = "media";
const SAFE_PATH_COMPONENT = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_EXTENSION = /^[a-z0-9]{1,10}$/;

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function createLocalMediaStorageKey(
  accountUserId: string,
  localMediaId: string,
  mimeType: string,
): string {
  assertSafeMediaPathComponent(accountUserId, "compte");
  assertSafeMediaPathComponent(localMediaId, "média");

  const extension = MIME_EXTENSIONS[mimeType.toLowerCase()];
  if (!extension) {
    throw new Error("Format d’image non pris en charge pour le staging local.");
  }

  return `${MEDIA_STORAGE_PREFIX}/${accountUserId}/${localMediaId}.${extension}`;
}

export function parseLocalMediaStorageKey(storageKey: string): Readonly<{
  accountUserId: string;
  filename: string;
}> {
  if (storageKey !== storageKey.trim() || storageKey.length > 320) {
    throw new Error("Clé de stockage média locale invalide.");
  }

  const segments = storageKey.split("/");
  if (segments.length !== 3 || segments[0] !== MEDIA_STORAGE_PREFIX) {
    throw new Error("Clé de stockage média locale invalide.");
  }

  const accountUserId = segments[1] ?? "";
  const filename = segments[2] ?? "";
  assertSafeMediaPathComponent(accountUserId, "compte");

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    throw new Error("Clé de stockage média locale invalide.");
  }

  const localMediaId = filename.slice(0, dotIndex);
  const extension = filename.slice(dotIndex + 1);
  assertSafeMediaPathComponent(localMediaId, "média");
  if (!SAFE_EXTENSION.test(extension)) {
    throw new Error("Extension média locale invalide.");
  }

  return { accountUserId, filename };
}

export function isLocalMediaStorageKeyForAccount(storageKey: string, accountUserId: string): boolean {
  try {
    return parseLocalMediaStorageKey(storageKey).accountUserId === accountUserId;
  } catch {
    return false;
  }
}

function assertSafeMediaPathComponent(value: string, label: string): void {
  if (!SAFE_PATH_COMPONENT.test(value)) {
    throw new Error(`Identifiant ${label} invalide pour le stockage média local.`);
  }
}
