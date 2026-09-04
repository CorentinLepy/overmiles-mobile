import { Text, View } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import type { MapDataState, TripMapPoint } from "./map.types";
import { useMapData } from "./use-map-data";

export function MapRevisitContext({ point }: { point: TripMapPoint }) {
  const theme = useOverMilesTheme();
  const { state } = useMapData();
  const summary = summarizeExactRevisits(point, state);

  if (!summary) return null;

  const label = `${summary.pointCount} repères OverMiles ici · ${summary.tripCount} voyage${summary.tripCount > 1 ? "s" : ""}`;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.control,
        borderCurve: "continuous",
        backgroundColor: theme.color.surfaceMuted,
      }}
    >
      <Text
        selectable
        style={{
          color: theme.color.muted,
          fontSize: 12,
          lineHeight: 17,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function summarizeExactRevisits(
  point: TripMapPoint,
  state: MapDataState,
): Readonly<{ pointCount: number; tripCount: number }> | null {
  const points =
    state.status === "ready" || state.status === "offline" || state.status === "error"
      ? state.points
      : [];

  const matchingPoints = points.filter(
    (candidate) =>
      candidate.coordinate.latitude === point.coordinate.latitude &&
      candidate.coordinate.longitude === point.coordinate.longitude,
  );

  if (matchingPoints.length < 2) return null;

  return Object.freeze({
    pointCount: matchingPoints.length,
    tripCount: new Set(matchingPoints.map((candidate) => candidate.tripId)).size,
  });
}
