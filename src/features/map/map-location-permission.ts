export type MapLocationPermissionResult = "granted" | "denied" | "unavailable";

export type MapLocationPermissionAdapter = Readonly<{
  getCurrentPosition(): Promise<unknown | undefined>;
  requestPermissions(): Promise<boolean>;
}>;

type RequestForegroundMapLocationOptions = Readonly<{
  currentPositionTimeoutMs?: number;
  nativeBridgeWarmupMs?: number;
  permissionTimeoutMs?: number;
}>;

const CURRENT_POSITION_TIMEOUT_MS = 1_500;
const NATIVE_BRIDGE_WARMUP_MS = 250;
const PERMISSION_TIMEOUT_MS = 30_000;
const TIMEOUT = Symbol("map-location-timeout");

export async function requestForegroundMapLocation(
  adapter: MapLocationPermissionAdapter,
  options: RequestForegroundMapLocationOptions = {},
): Promise<MapLocationPermissionResult> {
  let currentPosition = await readCurrentPosition(adapter, options);

  if (isAvailablePosition(currentPosition)) {
    return "granted";
  }

  // MapLibre iOS creates its CLLocationManager asynchronously when the native
  // location module is first touched. Give that bridge one bounded turn to
  // finish initialization, then re-read the position before asking for
  // permission. This keeps the request user-initiated while avoiding the race
  // where requestPermissions() is invoked against an incompletely initialized
  // native manager and never resolves.
  await waitForNativeBridge(options.nativeBridgeWarmupMs ?? NATIVE_BRIDGE_WARMUP_MS);
  currentPosition = await readCurrentPosition(adapter, options);

  if (isAvailablePosition(currentPosition)) {
    return "granted";
  }

  const permission = await settleWithTimeout(
    adapter.requestPermissions(),
    options.permissionTimeoutMs ?? PERMISSION_TIMEOUT_MS,
  );

  if (permission === TIMEOUT) return "unavailable";
  return permission ? "granted" : "denied";
}

function readCurrentPosition(
  adapter: MapLocationPermissionAdapter,
  options: RequestForegroundMapLocationOptions,
): Promise<unknown | undefined | typeof TIMEOUT> {
  return settleWithTimeout(
    adapter.getCurrentPosition(),
    options.currentPositionTimeoutMs ?? CURRENT_POSITION_TIMEOUT_MS,
  );
}

function isAvailablePosition(position: unknown | undefined | typeof TIMEOUT): boolean {
  return position !== TIMEOUT && position !== undefined;
}

async function waitForNativeBridge(delayMs: number): Promise<void> {
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
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
