import { Pressable, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function ProfileAccountScreen() {
  const theme = useOverMilesTheme();
  const { user, isBusy, logout } = useAuth();

  const identity = user?.displayName || user?.email || "Compte OverMiles";
  const secondaryIdentity = user?.displayName && user.email ? user.email : null;

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
        {secondaryIdentity ? (
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 21 }}>
            {secondaryIdentity}
          </Text>
        ) : null}
        <Text selectable style={{ color: theme.color.muted, fontSize: 16, lineHeight: 23 }}>
          Votre compte, vos appareils et vos réglages de sécurité mobile.
        </Text>
      </View>

      <SectionCard>
        <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "700" }}>
          Session mobile sécurisée
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          Votre session longue durée est protégée par le stockage sécurisé de l’appareil. Les accès
          courts restent uniquement en mémoire pendant l’utilisation.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
          accessibilityState={{ disabled: isBusy, busy: isBusy }}
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
          Protection de l’appareil
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          Un verrou biométrique local pourra protéger l’ouverture de l’application sans remplacer
          la vérification de votre session par OverMiles.
        </Text>
      </SectionCard>
    </AppScreen>
  );
}
