import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { formatCountries, formatTripDateRange, tripTemporalLabel } from "../trip-formatters";
import { useTripsData } from "../trips-data-provider";
import type { TripSummary } from "../trips.types";

export function TripDetailScreen({ tripId }: { tripId: string }) {
  const theme = useOverMilesTheme();
  const { findTrip, ensureTrip, isOffline, errorMessage, refresh, isRefreshing } =
    useTripsData();
  const cachedTrip = findTrip(tripId);
  const [loadedTrip, setLoadedTrip] = useState<TripSummary | null>(null);
  const [isResolving, setIsResolving] = useState(cachedTrip === null);

  useEffect(() => {
    if (cachedTrip) return;

    let active = true;
    async function resolveTrip() {
      const trip = await ensureTrip(tripId);
      if (!active) return;
      setLoadedTrip(trip);
      setIsResolving(false);
    }

    void resolveTrip();
    return () => {
      active = false;
    };
  }, [cachedTrip, ensureTrip, tripId]);

  const trip = cachedTrip ?? loadedTrip;

  if (isResolving && !trip) {
    return (
      <AppScreen>
        <SectionCard>
          <View
            style={{
              alignItems: "center",
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.xl,
            }}
          >
            <ActivityIndicator />
            <Text selectable style={{ color: theme.color.muted, fontSize: 14 }}>
              Ouverture du voyage…
            </Text>
          </View>
        </SectionCard>
      </AppScreen>
    );
  }

  if (!trip) {
    return (
      <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 22, fontWeight: "800" }}>
            Voyage indisponible
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            {errorMessage ??
              "Ce voyage n’est plus accessible ou n’a pas encore pu être synchronisé sur cet appareil."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réessayer d’ouvrir le voyage"
            onPress={() => {
              setIsResolving(true);
              void ensureTrip(tripId).then((nextTrip) => {
                setLoadedTrip(nextTrip);
                setIsResolving(false);
              });
            }}
            style={({ pressed }) => ({
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.ink,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: theme.color.surface, fontSize: 14, fontWeight: "800" }}>
              Réessayer
            </Text>
          </Pressable>
        </SectionCard>
      </AppScreen>
    );
  }

  const count = trip._count;
  const moments = (count?.photos ?? 0) + (count?.journalEntries ?? 0) + (count?.events ?? 0);

  return (
    <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <View
            style={{
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.accentSoft,
            }}
          >
            <Text selectable style={{ color: theme.color.accent, fontSize: 12, fontWeight: "800" }}>
              {tripTemporalLabel(trip)}
            </Text>
          </View>
          {isOffline ? (
            <Text selectable style={{ color: theme.color.warning, fontSize: 12, fontWeight: "700" }}>
              Hors-ligne
            </Text>
          ) : null}
        </View>

        <Text
          selectable
          style={{
            color: theme.color.ink,
            fontSize: 34,
            lineHeight: 39,
            fontWeight: "800",
            letterSpacing: -1,
          }}
        >
          {trip.name}
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 16, lineHeight: 23 }}>
          {formatCountries(trip)}
        </Text>
        <Text selectable style={{ color: theme.color.ink, fontSize: 15, lineHeight: 22 }}>
          {formatTripDateRange(trip)}
        </Text>
      </View>

      {trip.description ? (
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "800" }}>
            À propos du voyage
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 23 }}>
            {trip.description}
          </Text>
        </SectionCard>
      ) : null}

      <View style={{ gap: theme.spacing.md }}>
        <Text selectable style={{ color: theme.color.ink, fontSize: 20, fontWeight: "800" }}>
          Votre voyage en un coup d’œil
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <DetailMetric label="Étapes" value={count?.stops ?? 0} />
          <DetailMetric label="Moments" value={moments} />
          <DetailMetric label="Dépenses" value={count?.expenses ?? 0} />
          <DetailMetric label="Documents" value={count?.documents ?? 0} />
        </View>
      </View>

      <SectionCard>
        <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "800" }}>
          Prêt pour la suite
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          Les prochaines tranches ouvriront ici les étapes, la carte, les documents, le budget et les
          souvenirs. Cette page utilise déjà le vrai voyage OverMiles et le contrat de session mobile.
        </Text>
        {trip.version ? (
          <Text
            selectable
            style={{
              color: theme.color.muted,
              fontSize: 12,
              fontVariant: ["tabular-nums"],
            }}
          >
            Version synchronisée : {trip.version}
          </Text>
        ) : null}
      </SectionCard>
    </AppScreen>
  );
}

function DetailMetric({ label, value }: { label: string; value: number }) {
  const theme = useOverMilesTheme();

  return (
    <View
      style={{
        width: "48%",
        minWidth: 140,
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
        borderRadius: theme.radius.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: theme.color.border,
        backgroundColor: theme.color.surface,
      }}
    >
      <Text
        selectable
        style={{
          color: theme.color.ink,
          fontSize: 27,
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
