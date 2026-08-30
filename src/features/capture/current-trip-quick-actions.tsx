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
      <QuickAction
        href={{ pathname: "/trips/[tripId]/journal", params: { tripId } }}
        accessibilityLabel={`Écrire dans le Carnet de ${tripName}`}
        label="Carnet"
      />
      <QuickAction
        href={{ pathname: "/trips/[tripId]/moment", params: { tripId } }}
        accessibilityLabel={`Ajouter un moment à ${tripName}`}
        label="Moment"
      />
      <QuickAction
        href={{ pathname: "/trips/[tripId]/photos", params: { tripId } }}
        accessibilityLabel={`Ajouter des photos à ${tripName}`}
        label="Photos"
      />
    </View>
  );
}

function QuickAction({
  href,
  accessibilityLabel,
  label,
}: {
  href:
    | { pathname: "/trips/[tripId]/journal"; params: { tripId: string } }
    | { pathname: "/trips/[tripId]/moment"; params: { tripId: string } }
    | { pathname: "/trips/[tripId]/photos"; params: { tripId: string } };
  accessibilityLabel: string;
  label: string;
}) {
  const theme = useOverMilesTheme();

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
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
        <Text style={{ color: theme.color.ink, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      </Pressable>
    </Link>
  );
}
