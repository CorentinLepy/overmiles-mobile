import { useCurrentPosition } from "@maplibre/maplibre-react-native";
import { Text, View } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { calculateMapDistanceMeters, formatMapDistance } from "./map-distance";
import type { TripMapPoint } from "./map.types";

export function MapPointDistance({ point }: { point: TripMapPoint }) {
  const theme = useOverMilesTheme();
  const position = useCurrentPosition();

  if (!position) return null;

  const distanceMeters = calculateMapDistanceMeters(
    {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    },
    point.coordinate,
  );
  const distanceLabel = distanceMeters === null ? null : formatMapDistance(distanceMeters);
  if (!distanceLabel) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`À ${distanceLabel} de votre position`}
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 6,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.color.accentSoft,
      }}
    >
      <Text selectable style={{ color: theme.color.accent, fontSize: 12, fontWeight: "800" }}>
        À {distanceLabel} de vous
      </Text>
    </View>
  );
}
