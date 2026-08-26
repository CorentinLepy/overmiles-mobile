import { Stack } from "expo-router/stack";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export default function HomeLayout() {
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
      <Stack.Screen name="index" options={{ title: "Accueil" }} />
    </Stack>
  );
}
