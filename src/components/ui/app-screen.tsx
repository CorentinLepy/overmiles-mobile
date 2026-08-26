import type { ComponentProps, PropsWithChildren } from "react";
import { ScrollView, type StyleProp, type ViewStyle } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

type AppScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ComponentProps<typeof ScrollView>["refreshControl"];
}>;

export function AppScreen({ children, contentContainerStyle, refreshControl }: AppScreenProps) {
  const theme = useOverMilesTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={refreshControl}
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
