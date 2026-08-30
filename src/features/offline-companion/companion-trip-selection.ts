import type { TripSummary } from "@/src/features/trips/trips.types";

type CompanionTripCandidate = Readonly<{
  trip: TripSummary;
  startsAt: number;
  endsAt: number | null;
}>;

export function selectCompanionTrips(
  trips: readonly TripSummary[],
  now: number = Date.now(),
): readonly TripSummary[] {
  const candidates = trips.flatMap<CompanionTripCandidate>((trip) => {
    if (trip.status === "ARCHIVED") return [];

    const startsAt = parseTimestamp(trip.startsAt);
    if (startsAt === null) return [];

    return [{ trip, startsAt, endsAt: parseTimestamp(trip.endsAt) }];
  });

  const current = candidates
    .filter(
      (candidate) =>
        candidate.startsAt <= now && (candidate.endsAt === null || candidate.endsAt >= now),
    )
    .sort((left, right) => right.startsAt - left.startsAt)[0]?.trip;

  const upcoming = candidates
    .filter((candidate) => candidate.startsAt > now)
    .sort((left, right) => left.startsAt - right.startsAt)[0]?.trip;

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

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}
