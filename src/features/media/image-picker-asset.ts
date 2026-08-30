export type PickerImageAsset = Readonly<{
  uri: string;
  fileName?: string | null;
  fileSize?: number | null;
  width: number;
  height: number;
  mimeType?: string | null;
  exif?: Readonly<Record<string, unknown>> | null;
}>;

export type NormalizedPickerImage = Readonly<{
  sourceUri: string;
  originalFilename?: string | null;
  mimeType: string;
  fileSizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  orientation?: number | null;
}>;

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

const SUPPORTED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

export function normalizePickerImage(
  asset: PickerImageAsset,
  fallbackCapturedAt?: string,
): NormalizedPickerImage {
  if (!asset.uri.trim()) {
    throw new Error("Le média sélectionné ne contient pas de fichier local exploitable.");
  }

  const mimeType = normalizeMimeType(asset.mimeType, asset.fileName, asset.uri);
  const capturedAt = readCapturedAt(asset.exif) ?? normalizeIsoDate(fallbackCapturedAt);
  const coordinates = readCoordinates(asset.exif);
  const orientation = readOrientation(asset.exif);

  return {
    sourceUri: asset.uri,
    mimeType,
    ...(asset.fileName !== undefined ? { originalFilename: asset.fileName } : {}),
    ...(validFileSize(asset.fileSize) ? { fileSizeBytes: asset.fileSize } : {}),
    ...(validDimension(asset.width) ? { width: asset.width } : {}),
    ...(validDimension(asset.height) ? { height: asset.height } : {}),
    ...(capturedAt ? { capturedAt } : {}),
    ...(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : {}),
    ...(orientation ? { orientation } : {}),
  };
}

function normalizeMimeType(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
  uri: string,
): string {
  const normalized =
    mimeType?.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType?.toLowerCase();
  if (normalized && SUPPORTED_MIME_TYPES.has(normalized)) return normalized;

  const extension = extensionOf(fileName) ?? extensionOf(uri);
  const inferred = extension ? MIME_BY_EXTENSION[extension] : undefined;
  if (inferred) return inferred;

  throw new Error("Format d’image non pris en charge par OverMiles.");
}

function extensionOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleanValue = value.split(/[?#]/, 1)[0] ?? value;
  const dotIndex = cleanValue.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === cleanValue.length - 1) return null;
  return cleanValue.slice(dotIndex + 1).toLowerCase();
}

function validFileSize(value: number | null | undefined): value is number {
  return value !== undefined && value !== null && Number.isSafeInteger(value) && value >= 0;
}

function validDimension(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function readCapturedAt(exif: Readonly<Record<string, unknown>> | null | undefined): string | null {
  if (!exif) return null;

  for (const key of ["DateTimeOriginal", "CreateDate", "DateTimeDigitized", "DateTime"]) {
    const value = exif[key];
    if (typeof value !== "string") continue;
    const parsed = parseExifDate(value);
    if (parsed) return parsed;
  }

  return null;
}

function parseExifDate(value: string): string | null {
  const iso = normalizeIsoDate(value);
  if (iso) return iso;

  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hours, minutes, seconds] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeIsoDate(value: string | undefined): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function readCoordinates(
  exif: Readonly<Record<string, unknown>> | null | undefined,
): Readonly<{ latitude: number; longitude: number }> | null {
  if (!exif) return null;

  const latitude = readGpsCoordinate(exif.GPSLatitude, exif.GPSLatitudeRef);
  const longitude = readGpsCoordinate(exif.GPSLongitude, exif.GPSLongitudeRef);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function readGpsCoordinate(value: unknown, reference: unknown): number | null {
  const decimal = readDecimalCoordinate(value);
  if (decimal === null) return null;

  const ref = typeof reference === "string" ? reference.trim().toUpperCase() : "";
  const sign = ref === "S" || ref === "W" ? -1 : 1;
  return Math.abs(decimal) * sign;
}

function readDecimalCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (Array.isArray(value) && value.length >= 3) {
    const degrees = toFiniteNumber(value[0]);
    const minutes = toFiniteNumber(value[1]);
    const seconds = toFiniteNumber(value[2]);
    if (degrees === null || minutes === null || seconds === null) return null;
    return degrees + minutes / 60 + seconds / 3600;
  }

  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  if (value.includes("/")) {
    const parts = value.split("/", 2);
    if (parts.length !== 2) return null;

    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readOrientation(
  exif: Readonly<Record<string, unknown>> | null | undefined,
): number | null {
  if (!exif) return null;
  const orientation = toFiniteNumber(exif.Orientation);
  if (
    orientation === null ||
    !Number.isSafeInteger(orientation) ||
    orientation < 1 ||
    orientation > 8
  ) {
    return null;
  }
  return orientation;
}
