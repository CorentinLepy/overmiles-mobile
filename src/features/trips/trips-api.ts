import type { ApiClient } from "@/src/lib/api/api-client";

export type TripSummary = Readonly<{
  id: string;
  name: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  countries: string[];
  coverImageUrl: string | null;
  version?: number;
  _count?: Readonly<{
    stops?: number;
    photos?: number;
    journalEntries?: number;
    expenses?: number;
    documents?: number;
  }>;
}>;

export async function fetchTrips(apiClient: ApiClient): Promise<TripSummary[]> {
  const trips = await apiClient.request<TripSummary[]>({ path: "/trips", method: "GET" });
  return [...trips].sort(compareTrips);
}

function compareTrips(left: TripSummary, right: TripSummary): number {
  const leftDate = left.startsAt ? Date.parse(left.startsAt) : Number.POSITIVE_INFINITY;
  const rightDate = right.startsAt ? Date.parse(right.startsAt) : Number.POSITIVE_INFINITY;
  return leftDate - rightDate;
}
