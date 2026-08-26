import type { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, type StyleProp, type ViewStyle } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

type AppScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function AppScreen({
  children,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
}: AppScreenProps) {
  const theme = useOverMilesTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.color.accent}
          />
        ) : undefined
      }
      style={{ flex: 1, backgroundColor: theme.color.canvas }}
      contentContainerStyle={[
        {
          flexGrow: 1,
          gap: theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.xxl,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
