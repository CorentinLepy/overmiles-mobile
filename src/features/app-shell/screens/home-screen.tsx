import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function HomeScreen() {
  const theme = useOverMilesTheme();

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
        <Text
          selectable
          style={{
            maxWidth: 560,
            color: theme.color.muted,
            fontSize: 17,
            lineHeight: 25,
          }}
        >
          Préparez vos départs, gardez l’essentiel à portée de main et retrouvez vos souvenirs dans
          une expérience pensée pour le mobile.
        </Text>
      </View>

      <SectionCard>
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
                letterSpacing: 0.5,
              }}
            >
              PROCHAIN DÉPART
            </Text>
          </View>
        </View>

        <Text
          selectable
          style={{ color: theme.color.ink, fontSize: 24, lineHeight: 29, fontWeight: "700" }}
        >
          Vos voyages arrivent bientôt ici
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          La prochaine tranche connectera cette vue à vos vrais voyages OverMiles. La navigation
          mobile est déjà prête à les accueillir.
        </Text>

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
