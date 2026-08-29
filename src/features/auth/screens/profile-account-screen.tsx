import { Pressable, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function ProfileAccountScreen() {
  const theme = useOverMilesTheme();
  const {
    user,
    isBusy,
    logout,
    biometricState,
    biometricBusy,
    biometricMessage,
    enableBiometricLock,
    disableBiometricLock,
  } = useAuth();

  const identity = user?.displayName || user?.email || "Compte OverMiles";
  const secondaryIdentity = user?.displayName && user.email ? user.email : null;
  const biometricEnabled = biometricState !== "disabled";
  const securityBusy = isBusy || biometricBusy;

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
          Verrou biométrique
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          Optionnel, ce verrou protège l’accès local à OverMiles avec Face ID, Touch ID ou une
          biométrie Android forte. Il ne remplace jamais votre connexion OverMiles.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            biometricEnabled ? "Désactiver le verrou biométrique" : "Activer le verrou biométrique"
          }
          accessibilityState={{ disabled: securityBusy, busy: biometricBusy }}
          disabled={securityBusy}
          onPress={() =>
            void (biometricEnabled ? disableBiometricLock() : enableBiometricLock())
          }
          style={({ pressed }) => ({
            minHeight: 50,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.pill,
            backgroundColor: biometricEnabled ? theme.color.surfaceMuted : theme.color.accent,
            opacity: securityBusy ? 0.45 : pressed ? 0.72 : 1,
          })}
        >
          <Text
            style={{
              color: biometricEnabled ? theme.color.ink : theme.color.canvas,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            {biometricBusy
              ? "Vérification…"
              : biometricEnabled
                ? "Désactiver le verrou"
                : "Activer le verrou"}
          </Text>
        </Pressable>
        {biometricMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            selectable
            style={{ color: theme.color.muted, fontSize: 14, lineHeight: 20 }}
          >
            {biometricMessage}
          </Text>
        ) : null}
      </SectionCard>

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
          accessibilityState={{ disabled: securityBusy, busy: isBusy }}
          disabled={securityBusy}
          onPress={() => void logout()}
          style={({ pressed }) => ({
            minHeight: 50,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: theme.color.border,
            borderRadius: theme.radius.pill,
            opacity: securityBusy ? 0.45 : pressed ? 0.72 : 1,
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
