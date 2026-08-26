import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { TripCard } from "../components/trip-card";
import { useTripsData } from "../trips-data-provider";

export function TripsScreen() {
  const theme = useOverMilesTheme();
  const { trips, isLoading, isRefreshing, isOffline, errorMessage, refresh } =
    useTripsData();

  return (
    <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
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
          style={{ color: theme.color.ink, fontSize: 31, lineHeight: 36, fontWeight: "800" }}
        >
          Tous vos départs, au même endroit.
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 16, lineHeight: 23 }}>
          {trips.length > 0
            ? `${trips.length} voyage${trips.length > 1 ? "s" : ""} synchronisé${trips.length > 1 ? "s" : ""} avec OverMiles.`
            : "Préparez votre prochain départ puis retrouvez-le ici, même quand le réseau devient capricieux."}
        </Text>
      </View>

      {isOffline ? (
        <SectionCard>
          <Text selectable style={{ color: theme.color.warning, fontSize: 14, fontWeight: "800" }}>
            MODE HORS-LIGNE
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 14, lineHeight: 21 }}>
            Le serveur n’est pas joignable. Les données déjà chargées restent visibles ; le cache
            chiffré persistant arrivera avec COR-56/COR-57.
          </Text>
        </SectionCard>
      ) : null}

      {errorMessage && !isOffline ? (
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 17, fontWeight: "700" }}>
            Impossible d’actualiser les voyages
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 14, lineHeight: 21 }}>
            {errorMessage}
          </Text>
          <RetryButton onPress={() => void refresh()} />
        </SectionCard>
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
              Synchronisation de vos voyages…
            </Text>
          </View>
        </SectionCard>
      ) : trips.length === 0 ? (
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 22, fontWeight: "800" }}>
            Votre prochaine aventure commence ici.
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            Aucun voyage n’est encore associé à ce compte. Dès qu’un voyage existe côté OverMiles,
            il apparaîtra ici automatiquement.
          </Text>
        </SectionCard>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </View>
      )}
    </AppScreen>
  );
}

function RetryButton({ onPress }: { onPress: () => void }) {
  const theme = useOverMilesTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Réessayer le chargement des voyages"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.color.ink,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: theme.color.surface, fontSize: 14, fontWeight: "800" }}>Réessayer</Text>
    </Pressable>
  );
}
