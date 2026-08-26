import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { SectionCard } from "@/src/components/ui/section-card";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { formatCountries, formatTripDateRange, tripTemporalLabel } from "../trip-formatters";
import type { TripSummary } from "../trips.types";
import { TripCover } from "./trip-cover";

export function TripCard({ trip }: { trip: TripSummary }) {
  const theme = useOverMilesTheme();
  const moments =
    (trip._count?.photos ?? 0) + (trip._count?.journalEntries ?? 0) + (trip._count?.events ?? 0);

  return (
    <Link href={{ pathname: "/trips/[tripId]", params: { tripId: trip.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir le voyage ${trip.name}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
      >
        <SectionCard>
          <TripCover trip={trip} />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.color.accentSoft,
              }}
            >
              <Text
                selectable
                style={{
                  color: theme.color.accent,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {tripTemporalLabel(trip)}
              </Text>
            </View>
            {trip.version ? (
              <Text selectable style={{ color: theme.color.muted, fontSize: 12 }}>
                v{trip.version}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text
              selectable
              style={{
                color: theme.color.ink,
                fontSize: 22,
                lineHeight: 27,
                fontWeight: "800",
              }}
            >
              {trip.name}
            </Text>
            <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 21 }}>
              {formatCountries(trip)}
            </Text>
            <Text selectable style={{ color: theme.color.ink, fontSize: 14, lineHeight: 20 }}>
              {formatTripDateRange(trip)}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: theme.spacing.sm,
            }}
          >
            <Metric label="Étapes" value={trip._count?.stops ?? 0} />
            <Metric label="Moments" value={moments} />
            <Metric label="Docs" value={trip._count?.documents ?? 0} />
          </View>
        </SectionCard>
      </Pressable>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const theme = useOverMilesTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.color.surfaceMuted,
      }}
    >
      <Text
        selectable
        style={{
          color: theme.color.ink,
          fontSize: 13,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text selectable style={{ color: theme.color.muted, fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}
