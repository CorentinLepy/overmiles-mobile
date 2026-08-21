import Constants from "expo-constants";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { readPublicRuntimeConfig } from "@/src/config/env";
import { createSecureStoreTokenStore } from "@/src/lib/auth/secure-store-token-store";
import { theme } from "@/src/theme/tokens";

const CAPABILITIES = [
  "Expo SDK 57",
  "React Native 0.86",
  "Expo Router",
  "TypeScript strict",
  "EAS development / preview / production",
] as const;

type SecureStoreCheckState = "idle" | "running" | "pass" | "fail";

export function TechnicalBootstrapScreen() {
  const insets = useSafeAreaInsets();
  const runtime = readPublicRuntimeConfig();
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";
  const [secureStoreCheck, setSecureStoreCheck] = useState<SecureStoreCheckState>("idle");

  async function runSecureStoreCheck() {
    setSecureStoreCheck("running");
    const tokenStore = createSecureStoreTokenStore();
    const probeToken = `omr1_${"S".repeat(43)}`;

    try {
      await tokenStore.clearRefreshToken();
      await tokenStore.writeRefreshToken(probeToken);
      const restored = await tokenStore.readRefreshToken();
      if (restored !== probeToken) throw new Error("SecureStore read mismatch");
      await tokenStore.clearRefreshToken();
      const cleared = await tokenStore.readRefreshToken();
      if (cleared !== null) throw new Error("SecureStore clear mismatch");
      setSecureStoreCheck("pass");
    } catch {
      await tokenStore.clearRefreshToken().catch(() => undefined);
      setSecureStoreCheck("fail");
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + theme.spacing.xl,
          paddingBottom: insets.bottom + theme.spacing.xl,
        },
      ]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.mark} accessibilityRole="image" accessibilityLabel="OVERMILES">
        <Text style={styles.markText}>OM</Text>
      </View>

      <Text style={styles.eyebrow}>SOCLE TECHNIQUE MOBILE</Text>
      <Text style={styles.title}>OVERMILES</Text>
      <Text style={styles.subtitle}>
        Le routeur, le thème et la configuration publique démarrent. Aucun écran métier n’est
        volontairement inclus dans COR-54.
      </Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Bootstrap v{appVersion}</Text>
          <View
            style={[styles.statusPill, runtime.isValid ? styles.statusOk : styles.statusWarning]}
          >
            <Text style={styles.statusText}>{runtime.isValid ? "PRÊT" : "CONFIG À COMPLÉTER"}</Text>
          </View>
        </View>

        <Text style={styles.label}>Environnement</Text>
        <Text style={styles.value}>{runtime.appEnvironment}</Text>

        <Text style={styles.label}>API publique</Text>
        <Text style={styles.value}>{runtime.apiBaseUrl ?? "Non configurée"}</Text>

        {runtime.errors.map((error) => (
          <Text key={error} style={styles.errorText}>
            • {error}
          </Text>
        ))}
      </View>

      {__DEV__ ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Diagnostic COR-55</Text>
          <Text style={styles.value}>
            Vérifie sur l’appareil physique l’écriture, la lecture puis la suppression d’un jeton
            synthétique via Keychain/Keystore. Aucun identifiant ni vrai jeton n’est utilisé.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tester SecureStore"
            disabled={secureStoreCheck === "running"}
            onPress={runSecureStoreCheck}
            style={styles.diagnosticButton}
          >
            <Text style={styles.diagnosticButtonText}>
              {secureStoreCheck === "running" ? "TEST EN COURS…" : "TESTER SECURESTORE"}
            </Text>
          </Pressable>
          <Text style={styles.diagnosticResult}>
            {secureStoreCheck === "idle" && "État : non testé"}
            {secureStoreCheck === "running" && "État : test en cours"}
            {secureStoreCheck === "pass" && "État : PASS — write/read/delete validés"}
            {secureStoreCheck === "fail" && "État : FAIL — SecureStore indisponible ou incohérent"}
          </Text>
        </View>
      ) : null}

      <View style={styles.capabilities}>
        {CAPABILITIES.map((capability) => (
          <View key={capability} style={styles.capabilityPill}>
            <Text style={styles.capabilityText}>{capability}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.color.canvas,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.ink,
    marginBottom: theme.spacing.lg,
  },
  markText: {
    color: theme.color.surface,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -1,
  },
  eyebrow: {
    color: theme.color.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.color.ink,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "800",
    letterSpacing: -1.8,
  },
  subtitle: {
    color: theme.color.muted,
    fontSize: 17,
    lineHeight: 25,
    marginTop: theme.spacing.md,
    maxWidth: 620,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderWidth: 1,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  cardHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    color: theme.color.ink,
    fontSize: 20,
    fontWeight: "700",
  },
  statusPill: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusOk: {
    backgroundColor: "#DDECE5",
  },
  statusWarning: {
    backgroundColor: "#F4DFC6",
  },
  statusText: {
    color: theme.color.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  label: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: theme.spacing.md,
  },
  value: {
    color: theme.color.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: theme.spacing.xs,
  },
  errorText: {
    color: theme.color.warning,
    fontSize: 14,
    lineHeight: 21,
    marginTop: theme.spacing.sm,
  },
  diagnosticButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.ink,
  },
  diagnosticButtonText: {
    color: theme.color.surface,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  diagnosticResult: {
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: theme.spacing.md,
  },
  capabilities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  capabilityPill: {
    backgroundColor: "#E9DFD0",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  capabilityText: {
    color: theme.color.ink,
    fontSize: 13,
    fontWeight: "600",
  },
});
