import type { TripSummary } from "@/src/features/trips/trips.types";

import type { MapSnapshotMetadata } from "./local-map-store";
import type { MapSourceKind } from "./map.types";

export type MapSourceRefresh = Readonly<{
  trip: TripSummary;
  kind: MapSourceKind;
}>;

const MAP_SOURCE_KINDS: readonly MapSourceKind[] = ["stop", "timeline"];

export function selectStaleMapSources(
  trips: readonly TripSummary[],
  snapshots: readonly MapSnapshotMetadata[],
): readonly MapSourceRefresh[] {
  const snapshotBySource = new Map(
    snapshots.map((snapshot) => [`${snapshot.tripId}:${snapshot.kind}`, snapshot] as const),
  );

  return trips.flatMap((trip) =>
    MAP_SOURCE_KINDS.flatMap((kind) => {
      const snapshot = snapshotBySource.get(`${trip.id}:${kind}`);
      return snapshot && isSnapshotFreshForTrip(snapshot, trip) ? [] : [{ trip, kind }];
    }),
  );
}

export function createAllMapSources(trips: readonly TripSummary[]): readonly MapSourceRefresh[] {
  return trips.flatMap((trip) => MAP_SOURCE_KINDS.map((kind) => ({ trip, kind })));
}

export function isSnapshotFreshForTrip(
  snapshot: MapSnapshotMetadata,
  trip: TripSummary,
): boolean {
  return (
    snapshot.tripId === trip.id &&
    snapshot.tripVersion === (trip.version ?? null) &&
    snapshot.tripUpdatedAt === (trip.updatedAt ?? null)
  );
}
