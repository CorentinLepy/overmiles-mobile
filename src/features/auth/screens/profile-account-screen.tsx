import { Pressable, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function ProfileAccountScreen() {
  const theme = useOverMilesTheme();
  const { user, isBusy, logout } = useAuth();

  const identity = user?.displayName || user?.email || "Compte OverMiles";

  return (
    <AppScreen>
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
          PROFIL
        </Text>
        <Text
          selectable
          style={{ color: theme.color.ink, fontSize: 30, lineHeight: 35, fontWeight: "800" }}
        >
          {identity}
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 16, lineHeight: 23 }}>
          Votre compte, vos appareils et vos réglages de sécurité mobile.
        </Text>
      </View>

      <SectionCard>
        <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "700" }}>
          Session mobile sécurisée
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          Le Refresh Token reste dans le stockage sécurisé de l’appareil. L’Access Token reste
          uniquement en mémoire.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
          disabled={isBusy}
          onPress={() => void logout()}
          style={({ pressed }) => ({
            minHeight: 50,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: theme.color.border,
            borderRadius: theme.radius.pill,
            opacity: isBusy ? 0.45 : pressed ? 0.72 : 1,
          })}
        >
          <Text style={{ color: theme.color.ink, fontSize: 15, fontWeight: "800" }}>
            {isBusy ? "Déconnexion…" : "Se déconnecter"}
          </Text>
        </Pressable>
      </SectionCard>

      <SectionCard>
        <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "700" }}>
          Prochaines protections
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          Face ID / biométrie arrivera avec COR-58. Les sessions et appareils restent contrôlés côté
          serveur OverMiles.
        </Text>
      </SectionCard>
    </AppScreen>
  );
}
