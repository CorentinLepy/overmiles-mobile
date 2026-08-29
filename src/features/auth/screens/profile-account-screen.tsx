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
          Retrouvez ici votre compte et les réglages liés à votre application OverMiles.
        </Text>
      </View>

      <SectionCard>
        <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "700" }}>
          Sécurité du compte
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          Votre connexion est protégée par le stockage sécurisé de l’appareil et les contrôles de
          sécurité de votre compte OverMiles.
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
    </AppScreen>
  );
}
