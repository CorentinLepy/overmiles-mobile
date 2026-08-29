import { ActivityIndicator, Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function AuthLoadingScreen() {
  const theme = useOverMilesTheme();

  return (
    <AppScreen contentContainerStyle={{ justifyContent: "center", alignItems: "center" }}>
      <View style={{ alignItems: "center", gap: theme.spacing.md }}>
        <View
          style={{
            width: 70,
            height: 70,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.card,
            backgroundColor: theme.color.ink,
          }}
        >
          <Text style={{ color: theme.color.surface, fontSize: 22, fontWeight: "800" }}>OM</Text>
        </View>
        <ActivityIndicator color={theme.color.accent} />
        <Text selectable style={{ color: theme.color.muted, fontSize: 15 }}>
          Ouverture de votre espace OverMiles…
        </Text>
      </View>
    </AppScreen>
  );
}
