import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { SectionCard } from "@/src/components/ui/section-card";
import { useTripsData } from "@/src/features/trips/trips-data-provider";
import {
  localDatabase,
  type LocalDatabaseGeneration,
} from "@/src/lib/storage/local-database";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { localJournalDraftStore } from "../journal-draft-store";

type SaveState = "loading" | "idle" | "saving" | "saved" | "error";

export function QuickJournalScreen({ tripId }: { tripId: string }) {
  const theme = useOverMilesTheme();
  const { user } = useAuth();
  const { findTrip, isLoading } = useTripsData();
  const trip = findTrip(tripId);
  const accountUserId = user?.id ?? null;
  const tripAvailable = trip !== null;
  const generationRef = useRef<LocalDatabaseGeneration | null>(null);
  const saveRevisionRef = useRef(0);
  const [draftId, setDraftId] = useState(() => Crypto.randomUUID());
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString());
  const [content, setContent] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");

  useEffect(() => {
    if (!accountUserId || !tripAvailable) return;

    const generation = localDatabase.captureGeneration();
    generationRef.current = generation;
    const revision = ++saveRevisionRef.current;
    let active = true;

    void localJournalDraftStore
      .getActive(accountUserId, tripId, generation)
      .then((draft) => {
        if (!active || revision !== saveRevisionRef.current) return;

        if (draft) {
          setDraftId(draft.draftId);
          setOccurredAt(draft.occurredAt);
          setContent(draft.content);
          setSaveState("saved");
        } else if (generation !== null && localDatabase.canUseGeneration(generation)) {
          setDraftId(Crypto.randomUUID());
          setOccurredAt(new Date().toISOString());
          setContent("");
          setSaveState("idle");
        } else {
          setSaveState("error");
        }
        setIsReady(true);
      })
      .catch(() => {
        if (!active || revision !== saveRevisionRef.current) return;
        setSaveState("error");
        setIsReady(true);
      });

    return () => {
      active = false;
      saveRevisionRef.current += 1;
    };
  }, [accountUserId, tripAvailable, tripId]);

  function updateContent(nextContent: string) {
    setContent(nextContent);
    if (!accountUserId || !trip || !isReady) return;

    const generation = generationRef.current;
    const revision = ++saveRevisionRef.current;
    setSaveState("saving");

    void localJournalDraftStore
      .save(
        {
          accountUserId,
          tripId,
          draftId,
          content: nextContent,
          occurredAt,
          state: "draft_local",
        },
        generation,
      )
      .then((savedDraft) => {
        if (revision !== saveRevisionRef.current) return;
        setSaveState(savedDraft ? "saved" : "error");
      })
      .catch(() => {
        if (revision !== saveRevisionRef.current) return;
        setSaveState("error");
      });
  }

  const statusLabel = saveStateLabel(saveState);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.color.canvas }}
      contentContainerStyle={{
        flexGrow: 1,
        gap: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
      }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text
          selectable
          style={{
            color: theme.color.ink,
            fontSize: 30,
            lineHeight: 35,
            fontWeight: "800",
            letterSpacing: -0.7,
          }}
        >
          Écrire dans le Carnet
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          {trip ? trip.name : "Votre voyage"}
        </Text>
      </View>

      {!user || (!trip && !isLoading) ? (
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "800" }}>
            Carnet indisponible
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            Ce voyage n’est pas disponible sur cet appareil pour le moment.
          </Text>
        </SectionCard>
      ) : (
        <SectionCard>
          <TextInput
            accessibilityLabel={`Texte du Carnet pour ${trip?.name ?? "ce voyage"}`}
            autoFocus
            editable={isReady}
            maxLength={30000}
            multiline
            onChangeText={updateContent}
            placeholder="Qu’avez-vous envie de retenir de ce moment ?"
            placeholderTextColor={theme.color.muted}
            selectionColor={theme.color.accent}
            textAlignVertical="top"
            value={content}
            style={{
              minHeight: 280,
              color: theme.color.ink,
              fontSize: 18,
              lineHeight: 27,
              padding: 0,
            }}
          />

          <View
            accessible
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            accessibilityLabel={statusLabel}
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.surfaceMuted,
            }}
          >
            <Text
              selectable
              style={{
                color: saveState === "error" ? theme.color.warning : theme.color.muted,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {statusLabel}
            </Text>
          </View>
        </SectionCard>
      )}

      <Text selectable style={{ color: theme.color.muted, fontSize: 13, lineHeight: 19 }}>
        Votre brouillon reste disponible sur cet appareil, même sans réseau.
      </Text>
    </ScrollView>
  );
}

function saveStateLabel(state: SaveState): string {
  switch (state) {
    case "loading":
      return "Ouverture du brouillon…";
    case "idle":
      return "Commencez à écrire";
    case "saving":
      return "Enregistrement…";
    case "saved":
      return "Enregistré sur cet appareil";
    case "error":
      return "Impossible d’enregistrer pour le moment";
  }
}