export type MapMomentContext = Readonly<{
  label: string;
  latitude: number;
  longitude: number;
}>;

export type MapMomentRouteParams = Readonly<{
  source?: unknown;
  pointLabel?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}>;

export function parseMapMomentContext(params: MapMomentRouteParams): MapMomentContext | null {
  const source = readSingleString(params.source);
  const label = readSingleString(params.pointLabel)?.trim() ?? "";
  const latitudeValue = readSingleString(params.latitude);
  const longitudeValue = readSingleString(params.longitude);

  if (source !== "map" || label.length === 0 || label.length > 180) return null;
  if (latitudeValue === null || longitudeValue === null) return null;

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { label, latitude, longitude };
}

function readSingleString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
