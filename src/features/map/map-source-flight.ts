export type MapSourceFlightIdentity = Readonly<{
  accountUserId: string;
  tripId: string;
  kind: "stop" | "timeline";
  tripVersion?: number | null;
  tripUpdatedAt?: string | null;
}>;

const inFlightMapSources = new Map<string, Promise<unknown>>();

export function runMapSourceFlight<T>(
  identity: MapSourceFlightIdentity,
  task: () => Promise<T>,
): Promise<T> {
  const key = createMapSourceFlightKey(identity);
  const existing = inFlightMapSources.get(key);
  if (existing) return existing as Promise<T>;

  const flight = Promise.resolve().then(task);
  inFlightMapSources.set(key, flight);
  void flight.finally(() => {
    if (inFlightMapSources.get(key) === flight) {
      inFlightMapSources.delete(key);
    }
  });
  return flight;
}

export function createMapSourceFlightKey(identity: MapSourceFlightIdentity): string {
  return [
    identity.accountUserId,
    identity.tripId,
    identity.kind,
    identity.tripVersion ?? "",
    identity.tripUpdatedAt ?? "",
  ].join(":");
}
