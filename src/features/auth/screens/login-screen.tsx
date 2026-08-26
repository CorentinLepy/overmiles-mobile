import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function LoginScreen() {
  const theme = useOverMilesTheme();
  const router = useRouter();
  const { status, errorMessage, isBusy, login, retryRestore } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/home");
    }
  }, [router, status]);

  async function submit() {
    const normalizedEmail = email.trim();
    if (isBusy || !normalizedEmail || !password) return;
    await login(normalizedEmail, password);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.color.canvas }}
    >
      <AppScreen contentContainerStyle={{ justifyContent: "center" }}>
        <View style={{ gap: theme.spacing.sm }}>
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
              fontSize: 36,
              lineHeight: 40,
              fontWeight: "800",
              letterSpacing: -1.2,
            }}
          >
            Reprenez la route.
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 16, lineHeight: 23 }}>
            Connectez-vous pour retrouver vos voyages, vos étapes et vos souvenirs sur cet appareil.
          </Text>
        </View>

        <SectionCard>
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.color.ink, fontSize: 14, fontWeight: "700" }}>E-mail</Text>
            <TextInput
              accessibilityLabel="Adresse e-mail"
              accessibilityHint="Saisissez l’adresse e-mail de votre compte OverMiles"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="vous@exemple.fr"
              placeholderTextColor={theme.color.muted}
              textContentType="emailAddress"
              value={email}
              style={{
                minHeight: 52,
                borderWidth: 1,
                borderColor: theme.color.border,
                borderRadius: theme.radius.control,
                paddingHorizontal: theme.spacing.md,
                backgroundColor: theme.color.surfaceMuted,
                color: theme.color.ink,
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.color.ink, fontSize: 14, fontWeight: "700" }}>
              Mot de passe
            </Text>
            <TextInput
              accessibilityLabel="Mot de passe"
              accessibilityHint="Saisissez le mot de passe de votre compte OverMiles"
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              onChangeText={setPassword}
              placeholder="Votre mot de passe"
              placeholderTextColor={theme.color.muted}
              secureTextEntry
              textContentType="password"
              value={password}
              onSubmitEditing={() => void submit()}
              style={{
                minHeight: 52,
                borderWidth: 1,
                borderColor: theme.color.border,
                borderRadius: theme.radius.control,
                paddingHorizontal: theme.spacing.md,
                backgroundColor: theme.color.surfaceMuted,
                color: theme.color.ink,
                fontSize: 16,
              }}
            />
          </View>

          {errorMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radius.control,
                backgroundColor: theme.color.accentSoft,
              }}
            >
              <Text selectable style={{ color: theme.color.ink, fontSize: 14, lineHeight: 20 }}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {status === "offline_auth_pending" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Réessayer de vérifier la session"
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
              disabled={isBusy}
              onPress={() => void retryRestore()}
              style={({ pressed }) => ({
                minHeight: 46,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: theme.color.border,
                borderRadius: theme.radius.pill,
                opacity: isBusy ? 0.45 : pressed ? 0.72 : 1,
              })}
            >
              <Text style={{ color: theme.color.ink, fontSize: 14, fontWeight: "700" }}>
                Réessayer la vérification
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
            accessibilityState={{
              disabled: isBusy || !email.trim() || !password,
              busy: isBusy,
            }}
            disabled={isBusy || !email.trim() || !password}
            onPress={() => void submit()}
            style={({ pressed }) => ({
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.ink,
              opacity: isBusy || !email.trim() || !password ? 0.45 : pressed ? 0.82 : 1,
            })}
          >
            <Text style={{ color: theme.color.surface, fontSize: 15, fontWeight: "800" }}>
              {isBusy ? "Connexion…" : "Se connecter"}
            </Text>
          </Pressable>

          <Text selectable style={{ color: theme.color.muted, fontSize: 13, lineHeight: 19 }}>
            Votre mot de passe n’est pas conservé par l’application sur cet appareil.
          </Text>
        </SectionCard>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}
