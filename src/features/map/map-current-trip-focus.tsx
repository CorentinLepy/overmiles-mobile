import { Pressable, Text } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";
import type { TripSummary } from "@/src/features/trips/trips.types";

export function MapCurrentTripFocus({
  trip,
  isFocused,
  onToggle,
}: {
  trip: TripSummary;
  isFocused: boolean;
  onToggle: () => void;
}) {
  const theme = useOverMilesTheme();
  const label = isFocused ? "Tous les voyages" : `Voyage en cours · ${trip.name}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isFocused
          ? "Afficher les repères de tous les voyages"
          : `Afficher uniquement les repères du voyage en cours ${trip.name}`
      }
      accessibilityState={{ selected: isFocused }}
      onPress={onToggle}
      style={({ pressed }) => ({
        minHeight: 44,
        alignSelf: "flex-start",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: isFocused ? theme.color.accent : theme.color.border,
        backgroundColor: theme.color.surface,
        boxShadow: "0 3px 12px rgba(0, 0, 0, 0.10)",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text
        selectable
        numberOfLines={1}
        style={{
          maxWidth: 260,
          color: isFocused ? theme.color.accent : theme.color.ink,
          fontSize: 13,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
