import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

export function CurrentTripQuickActions({
  tripId,
  tripName,
}: {
  tripId: string;
  tripName: string;
}) {
  const theme = useOverMilesTheme();

  return (
    <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
      <Link href={{ pathname: "/trips/[tripId]/journal", params: { tripId } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Écrire dans le Carnet de ${tripName}`}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.pill,
            borderWidth: 1,
            borderColor: theme.color.border,
            backgroundColor: theme.color.surfaceMuted,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text style={{ color: theme.color.ink, fontSize: 14, fontWeight: "700" }}>Carnet</Text>
        </Pressable>
      </Link>

      <Link href={{ pathname: "/trips/[tripId]/moment", params: { tripId } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ajouter un moment à ${tripName}`}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.pill,
            borderWidth: 1,
            borderColor: theme.color.border,
            backgroundColor: theme.color.surfaceMuted,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text style={{ color: theme.color.ink, fontSize: 14, fontWeight: "700" }}>Moment</Text>
        </Pressable>
      </Link>
    </View>
  );
}
