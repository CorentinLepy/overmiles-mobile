import { ActivityIndicator, Pressable, RefreshControl, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";
import { useTrips } from "./use-trips";

export function TripsScreen() {
  const theme = useOverMilesTheme();
  const { trips, isLoading, isRefreshing, errorMessage, refresh } = useTrips();

  return (
    <AppScreen
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} />}
    >
      <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
        <Text
          selectable
          style={{
            color: theme.color.accent,
            fontSize: 12,
            fontWeight: "800",
            letterSpacing: 1.5,
          }}
        >
          VOS VOYAGES
        </Text>
        <Text
          selectable
          style={{ color: theme.color.ink, fontSize: 30, lineHeight: 35, fontWeight: "800" }}
        >
          Tous vos départs au même endroit.
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 16, lineHeight: 23 }}>
          Préparez les prochains, retrouvez les anciens et gardez l’essentiel accessible en mobilité.
        </Text>
      </View>

      {isLoading ? (
        <SectionCard>
          <View style={{ minHeight: 120, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator />
            <Text selectable style={{ color: theme.color.muted }}>
              Chargement de vos voyages…
            </Text>
          </View>
        </SectionCard>
      ) : null}

      {!isLoading && errorMessage ? (
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "700" }}>
            Vos voyages ne sont pas accessibles
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            {errorMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réessayer le chargement des voyages"
            onPress={() => void refresh()}
            style={({ pressed }) => ({
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.ink,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <Text style={{ color: theme.color.surface, fontSize: 15, fontWeight: "800" }}>
              Réessayer
            </Text>
          </Pressable>
        </SectionCard>
      ) : null}

      {!isLoading && !errorMessage && trips.length === 0 ? (
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 20, fontWeight: "700" }}>
            Votre prochaine aventure commence ici
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            Aucun voyage n’est encore enregistré sur ce compte. La création mobile arrivera dans une
            tranche dédiée ; vos voyages créés sur le Web apparaîtront automatiquement ici.
          </Text>
        </SectionCard>
      ) : null}

      {!isLoading && !errorMessage
        ? trips.map((trip) => (
            <SectionCard key={trip.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text
                    selectable
                    style={{ color: theme.color.ink, fontSize: 21, lineHeight: 26, fontWeight: "700" }}
                  >
                    {trip.name}
                  </Text>
                  <Text selectable style={{ color: theme.color.muted, fontSize: 14 }}>
                    {formatTripDates(trip.startsAt, trip.endsAt)}
                  </Text>
                  {trip.countries.length > 0 ? (
                    <Text selectable style={{ color: theme.color.muted, fontSize: 14 }}>
                      {trip.countries.join(" · ")}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius.pill,
                    backgroundColor: theme.color.surfaceMuted,
                  }}
                >
                  <Text style={{ color: theme.color.ink, fontSize: 11, fontWeight: "700" }}>
                    {trip.status}
                  </Text>
                </View>
              </View>

              {trip._count ? (
                <Text selectable style={{ color: theme.color.muted, fontSize: 13 }}>
                  {trip._count.stops ?? 0} étapes · {trip._count.photos ?? 0} photos ·{" "}
                  {trip._count.expenses ?? 0} dépenses
                </Text>
              ) : null}
            </SectionCard>
          ))
        : null}
    </AppScreen>
  );
}

function formatTripDates(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "Dates à définir";
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const start = startsAt ? formatter.format(new Date(startsAt)) : "?";
  const end = endsAt ? formatter.format(new Date(endsAt)) : "?";
  return start === end ? start : `${start} → ${end}`;
}
