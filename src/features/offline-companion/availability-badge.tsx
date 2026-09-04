import { Text, View } from "react-native";

import type { TripSummary } from "@/src/features/trips/trips.types";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { formatCompanionAvailability } from "./availability";
import { useCompanionAvailability } from "./prefetch-provider";

export function CompanionAvailabilityBadge({ trip }: { trip: TripSummary }) {
  const theme = useOverMilesTheme();
  const availability = useCompanionAvailability(trip);
  const label = formatCompanionAvailability(availability);
  const isWarning = availability.state === "stale";
  const isReady = availability.state === "available";
  const isPreparing = availability.state === "preparing";

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Disponibilité hors ligne : ${label}`}
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: theme.radius.pill,
        backgroundColor: isReady || isPreparing ? theme.color.accentSoft : theme.color.surfaceMuted,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 7,
          height: 7,
          borderRadius: theme.radius.pill,
          backgroundColor: isWarning
            ? theme.color.warning
            : isReady || isPreparing
              ? theme.color.accent
              : theme.color.muted,
        }}
      />
      <Text
        selectable
        style={{
          color: isWarning
            ? theme.color.warning
            : isReady || isPreparing
              ? theme.color.accent
              : theme.color.muted,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
