import { Link } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { CompanionAvailabilityBadge } from "@/src/features/offline-companion/availability-badge";
import { TripCover } from "@/src/features/trips/components/trip-cover";
import {
  daysUntilTrip,
  formatCountries,
  formatTripDateRange,
} from "@/src/features/trips/trip-formatters";
import { useTripsData } from "@/src/features/trips/trips-data-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function HomeScreen() {
  const theme = useOverMilesTheme();
  const { trips, nextTrip, isLoading, isRefreshing, isOffline, errorMessage, refresh } =
    useTripsData();
  const daysUntil = nextTrip ? daysUntilTrip(nextTrip) : null;
  const moments = trips.reduce(
    (total, trip) =>
      total +
      (trip._count?.photos ?? 0) +
      (trip._count?.journalEntries ?? 0) +
      (trip._count?.events ?? 0),
    0,
  );

  return (
    <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
        <Text
          selectable
          style={{
            color: theme.color.accent,
            fontSize: 12,
            fontWeight: "800",
            letterSpacing: 1.8,
          }}
        >
          OVERMILES
        </Text>
        <Text
          selectable
          style={{
            color: theme.color.ink,
            fontSize: 34,
            lineHeight: 38,
            fontWeight: "800",
            letterSpacing: -1.2,
          }}
        >
          Vos voyages, partout avec vous.
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 17, lineHeight: 25 }}>
          Votre prochain départ, vos essentiels et vos souvenirs réunis dans une expérience pensée
          pour le terrain.
        </Text>
      </View>

      {isOffline ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 12,
            borderRadius: theme.radius.control,
            backgroundColor: theme.color.surfaceMuted,
          }}
        >
          <Text
            selectable
            style={{
              color: theme.color.warning,
              fontSize: 13,
              fontWeight: "800",
            }}
          >
            Hors-ligne · dernière vue conservée
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <SectionCard>
          <View
            style={{
              alignItems: "center",
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.lg,
            }}
          >
            <ActivityIndicator />
            <Text selectable style={{ color: theme.color.muted, fontSize: 14 }}>
              Préparation de votre espace voyage…
            </Text>
          </View>
        </SectionCard>
      ) : nextTrip ? (
        <SectionCard>
          <TripCover trip={nextTrip} />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 7,
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
                PROCHAIN DÉPART
              </Text>
            </View>
            {daysUntil !== null ? (
              <Text
                selectable
                style={{
                  color: theme.color.ink,
                  fontSize: 13,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {daysUntil === 0 ? "Aujourd’hui" : `J-${daysUntil}`}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text
              selectable
              style={{
                color: theme.color.ink,
                fontSize: 27,
                lineHeight: 32,
                fontWeight: "800",
              }}
            >
              {nextTrip.name}
            </Text>
            <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
              {formatCountries(nextTrip)}
            </Text>
            <Text selectable style={{ color: theme.color.ink, fontSize: 14, lineHeight: 20 }}>
              {formatTripDateRange(nextTrip)}
            </Text>
          </View>

          <CompanionAvailabilityBadge trip={nextTrip} />

          <Link
            href={{
              pathname: "/trips/[tripId]",
              params: { tripId: nextTrip.id },
            }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir le voyage ${nextTrip.name}`}
              style={({ pressed }) => ({
                minHeight: 50,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.color.ink,
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text
                style={{
                  color: theme.color.surface,
                  fontSize: 15,
                  fontWeight: "800",
                }}
              >
                Ouvrir le voyage
              </Text>
            </Pressable>
          </Link>
        </SectionCard>
      ) : (
        <SectionCard>
          <Text
            selectable
            style={{
              color: theme.color.ink,
              fontSize: 23,
              lineHeight: 28,
              fontWeight: "800",
            }}
          >
            Aucun départ à l’horizon pour le moment.
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            {trips.length > 0
              ? "Vos anciens voyages restent disponibles dans l’onglet Voyages."
              : "Créez votre premier voyage sur OverMiles : il apparaîtra ici dès la prochaine synchronisation."}
          </Text>
          <Link href="/trips" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voir mes voyages"
              style={({ pressed }) => ({
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: theme.radius.pill,
                backgroundColor: theme.color.ink,
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text
                style={{
                  color: theme.color.surface,
                  fontSize: 14,
                  fontWeight: "800",
                }}
              >
                Voir mes voyages
              </Text>
            </Pressable>
          </Link>
        </SectionCard>
      )}

      {errorMessage && trips.length === 0 && !isLoading ? (
        <Text selectable style={{ color: theme.color.warning, fontSize: 13, lineHeight: 19 }}>
          {errorMessage}
        </Text>
      ) : null}

      <View style={{ gap: theme.spacing.md }}>
        <Text selectable style={{ color: theme.color.ink, fontSize: 20, fontWeight: "700" }}>
          Votre OverMiles
        </Text>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <SummaryMetric label="Voyages" value={trips.length} />
          <SummaryMetric label="Moments" value={moments} />
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text selectable style={{ color: theme.color.ink, fontSize: 20, fontWeight: "700" }}>
          Pensé pour le terrain
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.spacing.sm,
          }}
        >
          {["Voyages", "Carte", "Mode hors-ligne", "Souvenirs"].map((label) => (
            <View
              key={label}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.color.surfaceMuted,
              }}
            >
              <Text
                selectable
                style={{
                  color: theme.color.ink,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  const theme = useOverMilesTheme();

  return (
    <View
      style={{
        flex: 1,
        minHeight: 92,
        justifyContent: "space-between",
        padding: theme.spacing.md,
        borderRadius: theme.radius.card,
        borderCurve: "continuous",
        backgroundColor: theme.color.surface,
        borderWidth: 1,
        borderColor: theme.color.border,
      }}
    >
      <Text
        selectable
        style={{
          color: theme.color.ink,
          fontSize: 28,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text selectable style={{ color: theme.color.muted, fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}
