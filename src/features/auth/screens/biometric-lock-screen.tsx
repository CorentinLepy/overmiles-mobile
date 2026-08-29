import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function BiometricLockScreen() {
  const theme = useOverMilesTheme();
  const {
    biometricState,
    biometricBusy,
    biometricMessage,
    unlockBiometricLock,
    reauthenticateFromBiometricLock,
  } = useAuth();

  const requiresReauthentication = biometricState === "reauth_required";

  return (
    <View
      accessibilityViewIsModal
      style={{
        flex: 1,
        justifyContent: "center",
        backgroundColor: theme.color.canvas,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <View
        style={{
          gap: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.color.border,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.color.surface,
          padding: theme.spacing.lg,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: theme.color.ink, fontSize: 28, lineHeight: 33, fontWeight: "800" }}
        >
          OverMiles est verrouillé
        </Text>
        <Text style={{ color: theme.color.muted, fontSize: 16, lineHeight: 23 }}>
          {requiresReauthentication
            ? "Votre identité doit être vérifiée à nouveau avant d’accéder à vos voyages."
            : "Utilisez la biométrie de cet appareil pour retrouver vos voyages."}
        </Text>

        {biometricMessage ? (
          <Text accessibilityLiveRegion="polite" style={{ color: theme.color.muted, lineHeight: 21 }}>
            {biometricMessage}
          </Text>
        ) : null}

        {requiresReauthentication ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se reconnecter à OverMiles"
            accessibilityState={{ disabled: biometricBusy, busy: biometricBusy }}
            disabled={biometricBusy}
            onPress={() => void reauthenticateFromBiometricLock()}
            style={({ pressed }) => ({
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.accent,
              opacity: biometricBusy ? 0.45 : pressed ? 0.78 : 1,
            })}
          >
            <Text style={{ color: theme.color.accentInk, fontSize: 16, fontWeight: "800" }}>
              Se reconnecter
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Déverrouiller OverMiles"
            accessibilityState={{ disabled: biometricBusy, busy: biometricBusy }}
            disabled={biometricBusy}
            onPress={() => void unlockBiometricLock()}
            style={({ pressed }) => ({
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.accent,
              opacity: biometricBusy ? 0.45 : pressed ? 0.78 : 1,
            })}
          >
            <Text style={{ color: theme.color.accentInk, fontSize: 16, fontWeight: "800" }}>
              {biometricBusy ? "Vérification…" : "Déverrouiller"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
