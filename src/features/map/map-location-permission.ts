export type MapLocationPermissionResult = "granted" | "denied" | "unavailable";

export type MapLocationPermissionAdapter = Readonly<{
  getCurrentPosition(): Promise<unknown | undefined>;
  requestPermissions(): Promise<boolean>;
}>;

type RequestForegroundMapLocationOptions = Readonly<{
  currentPositionTimeoutMs?: number;
  permissionTimeoutMs?: number;
}>;

const CURRENT_POSITION_TIMEOUT_MS = 1_500;
const PERMISSION_TIMEOUT_MS = 30_000;
const TIMEOUT = Symbol("map-location-timeout");

export async function requestForegroundMapLocation(
  adapter: MapLocationPermissionAdapter,
  options: RequestForegroundMapLocationOptions = {},
): Promise<MapLocationPermissionResult> {
  const currentPosition = await settleWithTimeout(
    adapter.getCurrentPosition(),
    options.currentPositionTimeoutMs ?? CURRENT_POSITION_TIMEOUT_MS,
  );

  if (currentPosition !== TIMEOUT && currentPosition !== undefined) {
    return "granted";
  }

  const permission = await settleWithTimeout(
    adapter.requestPermissions(),
    options.permissionTimeoutMs ?? PERMISSION_TIMEOUT_MS,
  );

  if (permission === TIMEOUT) return "unavailable";
  return permission ? "granted" : "denied";
}

async function settleWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | typeof TIMEOUT> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return TIMEOUT;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof TIMEOUT>((resolve) => {
        timeoutId = setTimeout(() => resolve(TIMEOUT), timeoutMs);
      }),
    ]);
  } catch {
    return TIMEOUT;
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}
