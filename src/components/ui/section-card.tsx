import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function SectionCard({ children }: PropsWithChildren) {
  const theme = useOverMilesTheme();

  return (
    <View
      style={{
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.color.border,
        borderRadius: theme.radius.card,
        borderCurve: "continuous",
        backgroundColor: theme.color.surface,
        boxShadow: "0 8px 28px rgba(22, 33, 30, 0.06)",
      }}
    >
      {children}
    </View>
  );
}
