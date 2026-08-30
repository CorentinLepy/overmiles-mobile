import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import type { TripMapPoint } from "./map.types";

export function MapTerrainActions({
  point,
  onNavigate,
}: {
  point: TripMapPoint;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const theme = useOverMilesTheme();

  const actions = [
    {
      key: "journal",
      label: "Carnet",
      accessibilityLabel: `Écrire dans le Carnet pour ${point.tripName}`,
      onPress: () => router.push(`/trips/${point.tripId}/journal`),
    },
    {
      key: "photos",
      label: "Photos",
      accessibilityLabel: `Ajouter des photos à ${point.tripName}`,
      onPress: () => router.push(`/trips/${point.tripId}/photos`),
    },
    {
      key: "moment",
      label: "Moment",
      accessibilityLabel: `Créer un moment dans ${point.tripName}`,
      onPress: () => router.push(`/trips/${point.tripId}/moment`),
    },
    {
      key: "navigate",
      label: "Naviguer",
      accessibilityLabel: `Naviguer vers ${point.label}`,
      onPress: onNavigate,
    },
  ] as const;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: "47%",
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.control,
            borderCurve: "continuous",
            backgroundColor:
              action.key === "navigate" ? theme.color.accentSoft : theme.color.surfaceMuted,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text
            selectable
            style={{
              color: action.key === "navigate" ? theme.color.accent : theme.color.ink,
              fontSize: 14,
              fontWeight: "800",
            }}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
