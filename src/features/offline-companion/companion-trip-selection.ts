import type { TripSummary } from "@/src/features/trips/trips.types";

export function selectCompanionTrips(
  trips: readonly TripSummary[],
  now: number = Date.now(),
): readonly TripSummary[] {
  const candidates = trips
    .filter((trip) => trip.status !== "ARCHIVED")
    .map((trip) => ({ trip, startsAt: parseTimestamp(trip.startsAt), endsAt: parseTimestamp(trip.endsAt) }))
    .filter((candidate) => candidate.startsAt !== null);

  const current = candidates
    .filter(
      (candidate) =>
        candidate.startsAt !== null &&
        candidate.startsAt <= now &&
        (candidate.endsAt === null || candidate.endsAt >= now),
    )
    .sort((left, right) => (right.startsAt ?? 0) - (left.startsAt ?? 0))[0]?.trip;

  const upcoming = candidates
    .filter((candidate) => candidate.startsAt !== null && candidate.startsAt > now)
    .sort((left, right) => (left.startsAt ?? Number.MAX_SAFE_INTEGER) - (right.startsAt ?? Number.MAX_SAFE_INTEGER))[0]
    ?.trip;

  if (current && upcoming && current.id !== upcoming.id) return [current, upcoming];
  if (current) return [current];
  return upcoming ? [upcoming] : [];
}

export function createCompanionPrefetchKey(
  accountUserId: string,
  trips: readonly TripSummary[],
): string {
  return `${accountUserId}:${trips
    .map((trip) => `${trip.id}:${trip.updatedAt}:${trip.version ?? ""}`)
    .join("|")}`;
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}
