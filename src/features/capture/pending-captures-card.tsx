import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { SectionCard } from "@/src/components/ui/section-card";
import { localJournalDraftStore } from "@/src/features/journal/journal-draft-store";
import { localMediaStore } from "@/src/features/media/local-media-store";
import { localMomentDraftStore } from "@/src/features/timeline/local-moment-draft-store";
import { localDatabase } from "@/src/lib/storage/local-database";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

type PendingCaptureState = Readonly<{
  loadKey: string | null;
  journal: boolean;
  moment: boolean;
  photos: number;
}>;

const EMPTY_PENDING_CAPTURES: PendingCaptureState = {
  loadKey: null,
  journal: false,
  moment: false,
  photos: 0,
};

export function PendingCapturesCard({ tripId }: { tripId: string }) {
  const theme = useOverMilesTheme();
  const { user } = useAuth();
  const accountUserId = user?.id ?? null;
  const loadKey = accountUserId ? `${accountUserId}:${tripId}` : null;
  const [pending, setPending] = useState<PendingCaptureState>(EMPTY_PENDING_CAPTURES);

  useFocusEffect(
    useCallback(() => {
      if (!accountUserId || !loadKey) return;

      const generation = localDatabase.captureGeneration();
      let active = true;

      void Promise.all([
        localJournalDraftStore.getActive(accountUserId, tripId, generation),
        localMomentDraftStore.getActive(accountUserId, tripId, generation),
        localMediaStore.listForTrip(accountUserId, tripId, generation),
      ])
        .then(([journalDraft, momentDraft, photoItems]) => {
          if (!active || !localDatabase.canUseGeneration(generation)) return;
          setPending({
            loadKey,
            journal: journalDraft !== null,
            moment: momentDraft !== null,
            photos: photoItems.length,
          });
        })
        .catch(() => {
          if (!active || !localDatabase.canUseGeneration(generation)) return;
          setPending({ loadKey, journal: false, moment: false, photos: 0 });
        });

      return () => {
        active = false;
      };
    }, [accountUserId, loadKey, tripId]),
  );

  if (
    pending.loadKey !== loadKey ||
    (!pending.journal && !pending.moment && pending.photos === 0)
  ) {
    return null;
  }

  return (
    <SectionCard>
      <View style={{ gap: theme.spacing.xs }}>
        <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "800" }}>
          À compléter
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 14, lineHeight: 21 }}>
          Reprenez tranquillement ce que vous avez commencé sur le terrain.
        </Text>
      </View>

      {pending.journal ? (
        <PendingCaptureLink
          href={{ pathname: "/trips/[tripId]/journal", params: { tripId } }}
          label="Reprendre le Carnet"
          accessibilityLabel="Reprendre le brouillon du Carnet"
        />
      ) : null}

      {pending.moment ? (
        <PendingCaptureLink
          href={{ pathname: "/trips/[tripId]/moment", params: { tripId } }}
          label="Reprendre le moment"
          accessibilityLabel="Reprendre le brouillon du moment"
        />
      ) : null}

      {pending.photos > 0 ? (
        <PendingCaptureLink
          href={{ pathname: "/trips/[tripId]/photos", params: { tripId } }}
          label={`${pending.photos} photo${pending.photos > 1 ? "s" : ""} sur cet appareil`}
          accessibilityLabel={`Voir les ${pending.photos} photo${pending.photos > 1 ? "s" : ""} enregistrée${pending.photos > 1 ? "s" : ""} sur cet appareil`}
        />
      ) : null}
    </SectionCard>
  );
}

function PendingCaptureLink({
  href,
  label,
  accessibilityLabel,
}: {
  href:
    | { pathname: "/trips/[tripId]/journal"; params: { tripId: string } }
    | { pathname: "/trips/[tripId]/moment"; params: { tripId: string } }
    | { pathname: "/trips/[tripId]/photos"; params: { tripId: string } };
  label: string;
  accessibilityLabel: string;
}) {
  const theme = useOverMilesTheme();

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.control,
          borderWidth: 1,
          borderColor: theme.color.border,
          backgroundColor: theme.color.surfaceMuted,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Text style={{ color: theme.color.ink, fontSize: 14, fontWeight: "700" }}>{label}</Text>
        <Text accessibilityElementsHidden style={{ color: theme.color.muted, fontSize: 18 }}>
          ›
        </Text>
      </Pressable>
    </Link>
  );
}
