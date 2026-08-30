import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { SectionCard } from "@/src/components/ui/section-card";
import { useTripsData } from "@/src/features/trips/trips-data-provider";
import { localDatabase, type LocalDatabaseGeneration } from "@/src/lib/storage/local-database";
import { useAuth } from "@/src/providers/auth-provider";
import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

import { localMomentDraftStore } from "../local-moment-draft-store";
import type { MapMomentContext } from "../map-moment-context";

type SaveState = "loading" | "idle" | "saving" | "saved" | "error";

export function QuickMomentScreen({
  tripId,
  mapContext = null,
}: {
  tripId: string;
  mapContext?: MapMomentContext | null;
}) {
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");

  useEffect(() => {
    if (!accountUserId || !tripAvailable) return;

    const generation = localDatabase.captureGeneration();
    generationRef.current = generation;
    const revision = ++saveRevisionRef.current;
    let active = true;

    void localMomentDraftStore
      .getActive(accountUserId, tripId, generation)
      .then(async (draft) => {
        if (!active || revision !== saveRevisionRef.current) return;

        if (draft) {
          setDraftId(draft.draftId);
          setOccurredAt(draft.occurredAt);
          setTitle(draft.title);
          setDescription(draft.description ?? "");
          setLatitude(draft.latitude);
          setLongitude(draft.longitude);
          setLocationLabel(null);
          setSaveState("saved");
        } else if (generation !== null && localDatabase.canUseGeneration(generation)) {
          const nextDraftId = Crypto.randomUUID();
          const nextOccurredAt = new Date().toISOString();

          if (mapContext) {
            const seededDraft = await localMomentDraftStore.save(
              {
                accountUserId,
                tripId,
                draftId: nextDraftId,
                type: "MANUAL",
                title: mapContext.label,
                description: null,
                occurredAt: nextOccurredAt,
                latitude: mapContext.latitude,
                longitude: mapContext.longitude,
                state: "draft_local",
              },
              generation,
            );
            if (!active || revision !== saveRevisionRef.current) return;

            if (!seededDraft) {
              setSaveState("error");
              setIsReady(true);
              return;
            }

            setDraftId(seededDraft.draftId);
            setOccurredAt(seededDraft.occurredAt);
            setTitle(seededDraft.title);
            setDescription(seededDraft.description ?? "");
            setLatitude(seededDraft.latitude);
            setLongitude(seededDraft.longitude);
            setLocationLabel(mapContext.label);
            setSaveState("saved");
          } else {
            setDraftId(nextDraftId);
            setOccurredAt(nextOccurredAt);
            setTitle("");
            setDescription("");
            setLatitude(null);
            setLongitude(null);
            setLocationLabel(null);
            setSaveState("idle");
          }
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
  }, [
    accountUserId,
    mapContext?.label,
    mapContext?.latitude,
    mapContext?.longitude,
    tripAvailable,
    tripId,
  ]);

  function saveDraft(nextTitle: string, nextDescription: string) {
    if (!accountUserId || !trip || !isReady) return;

    const generation = generationRef.current;
    const revision = ++saveRevisionRef.current;
    setSaveState("saving");

    void localMomentDraftStore
      .save(
        {
          accountUserId,
          tripId,
          draftId,
          type: "MANUAL",
          title: nextTitle,
          description: nextDescription || null,
          occurredAt,
          latitude,
          longitude,
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

  function updateTitle(nextTitle: string) {
    setTitle(nextTitle);
    saveDraft(nextTitle, description);
  }

  function updateDescription(nextDescription: string) {
    setDescription(nextDescription);
    saveDraft(title, nextDescription);
  }

  const statusLabel = saveStateLabel(saveState);
  const hasLocation = latitude !== null && longitude !== null;
  const locationContextLabel = locationLabel ? `Lieu associé · ${locationLabel}` : "Position associée";

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
          Ajouter un moment
        </Text>
        <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
          {trip ? trip.name : "Votre voyage"}
        </Text>
      </View>

      {!user || (!trip && !isLoading) ? (
        <SectionCard>
          <Text selectable style={{ color: theme.color.ink, fontSize: 18, fontWeight: "800" }}>
            Moment indisponible
          </Text>
          <Text selectable style={{ color: theme.color.muted, fontSize: 15, lineHeight: 22 }}>
            Ce voyage n’est pas disponible sur cet appareil pour le moment.
          </Text>
        </SectionCard>
      ) : (
        <SectionCard>
          {hasLocation ? (
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={locationContextLabel}
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.color.accentSoft,
              }}
            >
              <Text
                selectable
                style={{ color: theme.color.accent, fontSize: 12, fontWeight: "800" }}
              >
                {locationContextLabel}
              </Text>
            </View>
          ) : null}

          <TextInput
            accessibilityLabel={`Titre du moment pour ${trip?.name ?? "ce voyage"}`}
            autoFocus
            editable={isReady}
            maxLength={180}
            onChangeText={updateTitle}
            placeholder="Un coucher de soleil à Lisbonne…"
            placeholderTextColor={theme.color.muted}
            selectionColor={theme.color.accent}
            value={title}
            style={{
              color: theme.color.ink,
              fontSize: 21,
              lineHeight: 28,
              fontWeight: "700",
              padding: 0,
            }}
          />

          <View style={{ height: 1, backgroundColor: theme.color.border }} />

          <TextInput
            accessibilityLabel="Note facultative pour ce moment"
            editable={isReady}
            maxLength={5000}
            multiline
            onChangeText={updateDescription}
            placeholder="Ajouter quelques détails, une sensation, une anecdote…"
            placeholderTextColor={theme.color.muted}
            selectionColor={theme.color.accent}
            textAlignVertical="top"
            value={description}
            style={{
              minHeight: 150,
              color: theme.color.ink,
              fontSize: 16,
              lineHeight: 24,
              padding: 0,
            }}
          />

          <Text selectable style={{ color: theme.color.muted, fontSize: 12, lineHeight: 18 }}>
            {formatCapturedAt(occurredAt)}
          </Text>

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
      return "Commencez à raconter";
    case "saving":
      return "Enregistrement…";
    case "saved":
      return "Enregistré sur cet appareil";
    case "error":
      return "Impossible d’enregistrer pour le moment";
  }
}

function formatCapturedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Heure de capture indisponible";
  return `Capturé ${new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
}
