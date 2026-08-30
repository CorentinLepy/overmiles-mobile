import type { MapSnapshotMetadata } from "@/src/features/map/local-map-store";
import type { TripSummary } from "@/src/features/trips/trips.types";

export type CompanionAvailabilityState = "available" | "preparing" | "stale" | "not_prepared";

export type CompanionAvailability = Readonly<{
  state: CompanionAvailabilityState;
  completedAt: string | null;
}>;

const REQUIRED_KINDS = ["stop", "timeline"] as const;

export function deriveCompanionAvailability(
  trip: TripSummary,
  snapshots: readonly MapSnapshotMetadata[],
  isPreparing: boolean,
): CompanionAvailability {
  const tripSnapshots = snapshots.filter((snapshot) => snapshot.tripId === trip.id);
  const requiredSnapshots = REQUIRED_KINDS.map((kind) =>
    tripSnapshots.find((snapshot) => snapshot.kind === kind),
  );
  const complete = requiredSnapshots.every(
    (snapshot): snapshot is MapSnapshotMetadata => snapshot !== undefined,
  );

  if (complete && requiredSnapshots.every((snapshot) => snapshotMatchesTrip(snapshot, trip))) {
    return {
      state: "available",
      completedAt: latestCachedAt(requiredSnapshots),
    };
  }

  if (isPreparing) {
    return {
      state: "preparing",
      completedAt: complete ? latestCachedAt(requiredSnapshots) : null,
    };
  }

  if (complete) {
    return {
      state: "stale",
      completedAt: latestCachedAt(requiredSnapshots),
    };
  }

  return {
    state: "not_prepared",
    completedAt: null,
  };
}

export function formatCompanionAvailability(
  availability: CompanionAvailability,
  now = new Date(),
): string {
  switch (availability.state) {
    case "available":
      return availability.completedAt
        ? `Disponible hors ligne · ${formatFreshness(availability.completedAt, now)}`
        : "Disponible hors ligne";
    case "preparing":
      return "Préparation hors ligne…";
    case "stale":
      return "À actualiser avant le départ";
    case "not_prepared":
      return "Non préparé hors ligne";
  }
}

function snapshotMatchesTrip(snapshot: MapSnapshotMetadata, trip: TripSummary): boolean {
  if (trip.version !== undefined && snapshot.tripVersion !== trip.version) {
    return false;
  }

  if (snapshot.tripUpdatedAt !== null && snapshot.tripUpdatedAt !== trip.updatedAt) {
    return false;
  }

  return true;
}

function latestCachedAt(snapshots: readonly MapSnapshotMetadata[]): string | null {
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  let latestValue: string | null = null;

  for (const snapshot of snapshots) {
    const timestamp = Date.parse(snapshot.cachedAt);
    if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestValue = snapshot.cachedAt;
    }
  }

  return latestValue;
}

function formatFreshness(cachedAt: string, now: Date): string {
  const timestamp = Date.parse(cachedAt);
  if (!Number.isFinite(timestamp)) return "préparé sur cet appareil";

  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "actualisé à l’instant";
  if (elapsedMinutes < 60) return `actualisé il y a ${elapsedMinutes} min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `actualisé il y a ${elapsedHours} h`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays === 1) return "actualisé hier";
  if (elapsedDays < 7) return `actualisé il y a ${elapsedDays} jours`;

  return `actualisé le ${new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp))}`;
}
