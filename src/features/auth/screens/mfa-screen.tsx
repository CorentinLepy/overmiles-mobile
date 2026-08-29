import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import type { MobileMfaFactor } from "@/src/lib/auth/mobile-auth-transport";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function MfaScreen() {
  const theme = useOverMilesTheme();
  const router = useRouter();
  const { status, pendingMfa, errorMessage, isBusy, completeMfa, cancelMfa } = useAuth();
  const [factor, setFactor] = useState<MobileMfaFactor>("totp");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/home");
    } else if (status !== "mfa_required" || !pendingMfa) {
      router.replace("/login");
    }
  }, [pendingMfa, router, status]);

  function switchFactor(next: MobileMfaFactor) {
    if (isBusy || factor === next) return;
    setFactor(next);
    setCode("");
  }

  async function submit() {
    const normalizedCode = code.trim();
    if (isBusy || !normalizedCode) return;
    await completeMfa(factor, normalizedCode);
  }

  function goBackToLogin() {
    if (isBusy) return;
    cancelMfa();
    router.replace("/login");
  }

  const isTotp = factor === "totp";

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
            SÉCURITÉ OVERMILES
          </Text>
          <Text
            selectable
            style={{
              color: theme.color.ink,
              fontSize: 34,
              lineHeight: 39,
              fontWeight: "800",
              letterSpacing: -1.1,
            }}
          >
            Confirmez que c’est bien vous.
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 16, lineHeight: 23 }}>
            Votre mot de passe est validé. Un second facteur est nécessaire avant d’ouvrir votre
            session mobile.
          </Text>
        </View>

        <SectionCard>
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: "row",
              gap: theme.spacing.xs,
              padding: 4,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.surfaceMuted,
            }}
          >
            <FactorButton
              label="Application d’authentification"
              selected={isTotp}
              disabled={isBusy}
              onPress={() => switchFactor("totp")}
            />
            <FactorButton
              label="Code de récupération"
              selected={!isTotp}
              disabled={isBusy}
              onPress={() => switchFactor("recovery")}
            />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.color.ink, fontSize: 14, fontWeight: "700" }}>
              {isTotp ? "Code à 6 chiffres" : "Code de récupération"}
            </Text>
            <TextInput
              accessibilityLabel={isTotp ? "Code MFA à 6 chiffres" : "Code de récupération MFA"}
              accessibilityHint={
                isTotp
                  ? "Saisissez le code affiché par votre application d’authentification"
                  : "Saisissez un code de récupération OverMiles inutilisé"
              }
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete={isTotp ? "one-time-code" : "off"}
              keyboardType={isTotp ? "number-pad" : "default"}
              maxLength={isTotp ? 6 : 64}
              onChangeText={(value) => setCode(isTotp ? value.replace(/\D/g, "") : value)}
              onSubmitEditing={() => void submit()}
              placeholder={isTotp ? "000000" : "Votre code de récupération"}
              placeholderTextColor={theme.color.muted}
              textContentType={isTotp ? "oneTimeCode" : "none"}
              value={code}
              style={{
                minHeight: 56,
                borderWidth: 1,
                borderColor: theme.color.border,
                borderRadius: theme.radius.control,
                paddingHorizontal: theme.spacing.md,
                backgroundColor: theme.color.surfaceMuted,
                color: theme.color.ink,
                fontSize: isTotp ? 24 : 16,
                fontWeight: isTotp ? "700" : "500",
                letterSpacing: isTotp ? 5 : 0,
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Valider le second facteur"
            accessibilityState={{ disabled: isBusy || !code.trim(), busy: isBusy }}
            disabled={isBusy || !code.trim()}
            onPress={() => void submit()}
            style={({ pressed }) => ({
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.ink,
              opacity: isBusy || !code.trim() ? 0.45 : pressed ? 0.82 : 1,
            })}
          >
            <Text style={{ color: theme.color.surface, fontSize: 15, fontWeight: "800" }}>
              {isBusy ? "Vérification…" : "Continuer"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annuler la vérification et revenir à la connexion"
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            onPress={goBackToLogin}
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
              Revenir à la connexion
            </Text>
          </Pressable>

          <Text selectable style={{ color: theme.color.muted, fontSize: 13, lineHeight: 19 }}>
            Votre session ne s’ouvrira qu’après cette vérification.
          </Text>
        </SectionCard>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

type FactorButtonProps = Readonly<{
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress(): void;
}>;

function FactorButton({ label, selected, disabled, onPress }: FactorButtonProps) {
  const theme = useOverMilesTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 42,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.pill,
        backgroundColor: selected ? theme.color.surface : "transparent",
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        numberOfLines={2}
        style={{
          color: selected ? theme.color.ink : theme.color.muted,
          fontSize: 12,
          lineHeight: 16,
          fontWeight: selected ? "800" : "600",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
