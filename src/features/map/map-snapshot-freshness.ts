import type { TripSummary } from "@/src/features/trips/trips.types";

import type { MapSnapshotMetadata } from "./local-map-store";

export type RefreshableMapSourceKind = "stop" | "timeline";

export type MapSourceRefresh = Readonly<{
  trip: TripSummary;
  kind: RefreshableMapSourceKind;
}>;

const MAP_SOURCE_KINDS = ["stop", "timeline"] as const;

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
      if (snapshot && isSnapshotFreshForTrip(snapshot, trip)) return [];
      return [{ trip, kind }];
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
