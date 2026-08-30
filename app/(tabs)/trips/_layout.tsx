import { Stack } from "expo-router/stack";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export default function TripsLayout() {
  const theme = useOverMilesTheme();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: theme.color.ink,
        headerStyle: { backgroundColor: theme.color.canvas },
        contentStyle: { backgroundColor: theme.color.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Voyages" }} />
      <Stack.Screen name="[tripId]" options={{ title: "Voyage" }} />
      <Stack.Screen name="[tripId]/journal" options={{ title: "Carnet" }} />
    </Stack>
  );
}
