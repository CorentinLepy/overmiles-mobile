import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { SectionCard } from "./section-card";

export type FeedbackStateTone = "neutral" | "warning";

export type FeedbackStateProps = Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  loading?: boolean;
  tone?: FeedbackStateTone;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  onAction?: () => void;
}>;

export function FeedbackState({
  eyebrow,
  title,
  description,
  loading = false,
  tone = "neutral",
  actionLabel,
  actionAccessibilityLabel,
  onAction,
}: FeedbackStateProps) {
  const theme = useOverMilesTheme();
  const accentColor = tone === "warning" ? theme.color.warning : theme.color.accent;

  return (
    <SectionCard>
      <View style={{ gap: theme.spacing.sm }}>
        {loading ? <ActivityIndicator accessibilityLabel="Chargement" /> : null}
        {eyebrow ? (
          <Text
            selectable
            style={{
              color: accentColor,
              fontSize: 12,
              fontWeight: "800",
              letterSpacing: 1.3,
            }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          selectable
          style={{
            color: theme.color.ink,
            fontSize: 20,
            lineHeight: 26,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={{
              color: theme.color.muted,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          onPress={onAction}
          style={({ pressed }) => ({
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.color.ink,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: theme.color.surface, fontSize: 14, fontWeight: "800" }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}
