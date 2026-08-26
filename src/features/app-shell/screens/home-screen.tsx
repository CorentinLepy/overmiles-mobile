import { Link } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useTrips } from "@/src/features/trips/use-trips";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function HomeScreen() {
  const theme = useOverMilesTheme();
  const { trips, isLoading, errorMessage } = useTrips();
  const nextTrip = trips.find((trip) => !trip.startsAt || Date.parse(trip.startsAt) >= Date.now()) ?? trips[0];

  return (
    <AppScreen>
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
          Préparez vos départs, gardez l’essentiel à portée de main et retrouvez vos souvenirs dans
          une expérience pensée pour le mobile.
        </Text>
      </View>

      <SectionCard>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.color.accentSoft,
          }}
        >
          <Text style={{ color: theme.color.accent, fontSize: 12, fontWeight: "800" }}>
            PROCHAIN DÉPART
          </Text>
        </View>

        {isLoading ? (
          <View style={{ minHeight: 90, alignItems: "center", justifyContent: "center", gap: 10 }}>
            <ActivityIndicator />
            <Text selectable style={{ color: theme.color.muted }}>
              Recherche de votre prochain voyage…
            </Text>
          </View>
        ) : null}

        {!isLoading && errorMessage ? (
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            {errorMessage}
          </Text>
        ) : null}

        {!isLoading && !errorMessage && nextTrip ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text
              selectable
              style={{ color: theme.color.ink, fontSize: 24, lineHeight: 29, fontWeight: "700" }}
            >
              {nextTrip.name}
            </Text>
            <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
              {formatDates(nextTrip.startsAt, nextTrip.endsAt)}
              {nextTrip.countries.length > 0 ? ` · ${nextTrip.countries.join(" · ")}` : ""}
            </Text>
          </View>
        ) : null}

        {!isLoading && !errorMessage && !nextTrip ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text
              selectable
              style={{ color: theme.color.ink, fontSize: 22, lineHeight: 28, fontWeight: "700" }}
            >
              Une nouvelle aventure vous attend
            </Text>
            <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
              Créez votre prochain voyage sur OverMiles Web ; il apparaîtra ici automatiquement.
            </Text>
          </View>
        ) : null}

        <Link href="/trips" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir mes voyages"
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
            <Text style={{ color: theme.color.surface, fontSize: 15, fontWeight: "800" }}>
              Voir mes voyages
            </Text>
          </Pressable>
        </Link>
      </SectionCard>

      <View style={{ gap: theme.spacing.md }}>
        <Text selectable style={{ color: theme.color.ink, fontSize: 20, fontWeight: "700" }}>
          Pensé pour le terrain
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
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
              <Text selectable style={{ color: theme.color.ink, fontSize: 13, fontWeight: "600" }}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

function formatDates(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "Dates à définir";
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const start = startsAt ? formatter.format(new Date(startsAt)) : "?";
  const end = endsAt ? formatter.format(new Date(endsAt)) : "?";
  return start === end ? start : `${start} → ${end}`;
}
