export type MapCoordinate = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type MapSourceKind = "stop" | "location" | "timeline";

export type TripMapPoint = Readonly<{
  id: string;
  tripId: string;
  tripName: string;
  label: string;
  coordinate: MapCoordinate;
  kind: MapSourceKind;
  occurredAt?: string | null;
  visited: true;
}>;

export type VisitedPlace = Readonly<{
  id: string;
  label: string;
  coordinate: MapCoordinate;
  visitCount: number;
  latestVisitAt?: string | null;
  tripIds: readonly string[];
}>;

export type DestinationSuggestion = Readonly<{
  id: string;
  label: string;
  subtitle?: string | null;
  countryCode?: string | null;
  coordinate: MapCoordinate;
}>;

export type SelectedDestination = Readonly<{
  id: string;
  label: string;
  subtitle?: string | null;
  countryCode?: string | null;
  coordinate?: MapCoordinate | null;
  status: "visited" | "unvisited";
  source: "overmiles" | "explore";
}>;

export type MapDataState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready"; points: readonly TripMapPoint[] }>
  | Readonly<{ status: "offline"; points: readonly TripMapPoint[] }>
  | Readonly<{ status: "error"; message: string; points: readonly TripMapPoint[] }>;

export type MapSourcePoint = Readonly<{
  id: string;
  tripId: string;
  tripName: string;
  label: string;
  latitude: number | string;
  longitude: number | string;
  kind: MapSourceKind;
  occurredAt?: string | null;
}>;
