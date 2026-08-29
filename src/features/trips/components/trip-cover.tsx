import { useState } from "react";
import { Image, Text, View } from "react-native";

import { readPublicRuntimeConfig } from "@/src/config/env";
import { resolveApiAssetUrl } from "@/src/lib/api/asset-url";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import type { TripSummary } from "../trips.types";

type TripCoverProps = Readonly<{
  trip: Pick<TripSummary, "name" | "coverImageUrl">;
}>;

export function TripCover({ trip }: TripCoverProps) {
  const theme = useOverMilesTheme();
  const { apiBaseUrl } = readPublicRuntimeConfig();
  const uri = resolveApiAssetUrl(trip.coverImageUrl, apiBaseUrl);
  const [failedUri, setFailedUri] = useState<string | null>(null);

  const showImage = uri !== null && uri !== failedUri;

  if (showImage) {
    return (
      <View
        accessible={false}
        style={{
          width: "100%",
          aspectRatio: 16 / 9,
          overflow: "hidden",
          borderRadius: theme.radius.control,
          borderCurve: "continuous",
          backgroundColor: theme.color.surfaceMuted,
        }}
      >
        <Image
          source={{ uri }}
          resizeMode="cover"
          accessible={false}
          accessibilityIgnoresInvertColors
          onError={() => setFailedUri(uri)}
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  return (
    <View
      accessible={false}
      style={{
        width: "100%",
        aspectRatio: 16 / 9,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.radius.control,
        borderCurve: "continuous",
        backgroundColor: theme.color.surfaceMuted,
      }}
    >
      <Text
        style={{
          color: theme.color.accent,
          fontSize: 32,
          fontWeight: "800",
        }}
      >
        {trip.name.trim().charAt(0).toLocaleUpperCase() || "O"}
      </Text>
    </View>
  );
}
