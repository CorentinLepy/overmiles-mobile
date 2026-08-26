import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { AuthLoadingScreen } from "@/src/features/auth/screens/auth-loading-screen";
import { TripsDataProvider } from "@/src/features/trips/trips-data-provider";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export default function TabLayout() {
  const theme = useOverMilesTheme();
  const { status } = useAuth();

  if (status === "restoring") {
    return <AuthLoadingScreen />;
  }

  if (status !== "authenticated") {
    return <Redirect href="/login" />;
  }

  return (
    <TripsDataProvider>
      <NativeTabs tintColor={theme.color.accent} minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
          <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="trips">
          <NativeTabs.Trigger.Icon
            sf={{ default: "suitcase", selected: "suitcase.fill" }}
            md="luggage"
          />
          <NativeTabs.Trigger.Label>Voyages</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="map">
          <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} md="map" />
          <NativeTabs.Trigger.Label>Carte</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
            md="person"
          />
          <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </TripsDataProvider>
  );
}
