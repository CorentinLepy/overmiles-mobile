import { Text, View } from "react-native";

import { AppScreen } from "@/src/components/ui/app-screen";
import { SectionCard } from "@/src/components/ui/section-card";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

type SectionPlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
};

export function SectionPlaceholderScreen({
  eyebrow,
  title,
  description,
  status,
}: SectionPlaceholderScreenProps) {
  const theme = useOverMilesTheme();

  return (
    <AppScreen>
      <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
        <Text
          selectable
          style={{
            color: theme.color.accent,
            fontSize: 12,
            fontWeight: "800",
            letterSpacing: 1.5,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          selectable
          style={{
            color: theme.color.ink,
            fontSize: 32,
            lineHeight: 37,
            fontWeight: "800",
            letterSpacing: -1,
          }}
        >
          {title}
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 17, lineHeight: 25 }}>
          {description}
        </Text>
      </View>

      <SectionCard>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.color.surfaceMuted,
          }}
        >
          <Text selectable style={{ color: theme.color.muted, fontSize: 12, fontWeight: "800" }}>
            {status}
          </Text>
        </View>
        <Text
          selectable
          style={{ color: theme.color.ink, fontSize: 18, lineHeight: 24, fontWeight: "700" }}
        >
          Le socle natif est prêt pour cette section.
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          Les données réelles seront branchées ticket par ticket afin de garder une application
          stable, testable et cohérente sur iOS comme Android.
        </Text>
      </SectionCard>
    </AppScreen>
  );
}
