import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";

import type { LocalMediaItem } from "./local-media-item";
import { normalizePickerImage, type PickerImageAsset } from "./image-picker-asset";
import { secureMediaStaging } from "./secure-media-staging";

export const PHOTO_SELECTION_LIMIT = 20;

export type NativePhotoCaptureContext = Readonly<{
  accountUserId: string;
  tripId: string;
}>;

export type NativePhotoCaptureResult = Readonly<{
  status: "saved" | "canceled" | "permission_denied" | "failed";
  saved: readonly LocalMediaItem[];
  failedCount: number;
  message: string | null;
}>;

const EMPTY_RESULT: NativePhotoCaptureResult = {
  status: "canceled",
  saved: [],
  failedCount: 0,
  message: null,
};

export async function choosePhotosFromLibrary(
  context: NativePhotoCaptureContext,
): Promise<NativePhotoCaptureResult> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: PHOTO_SELECTION_LIMIT,
      orderedSelection: true,
      allowsEditing: false,
      exif: true,
      quality: 1,
    });

    return stagePickerResult(context, result);
  } catch (error) {
    return failedResult(error, "Impossible d’ouvrir la photothèque pour le moment.");
  }
}

export async function takePhotoWithCamera(
  context: NativePhotoCaptureContext,
): Promise<NativePhotoCaptureResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return {
        status: "permission_denied",
        saved: [],
        failedCount: 0,
        message: "Autorisez l’appareil photo pour capturer un moment dans OverMiles.",
      };
    }

    const capturedAt = new Date().toISOString();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      exif: true,
      quality: 1,
      cameraType: ImagePicker.CameraType.back,
    });

    return stagePickerResult(context, result, capturedAt);
  } catch (error) {
    return failedResult(error, "Impossible d’utiliser l’appareil photo pour le moment.");
  }
}

export async function recoverPendingPhotoCapture(
  context: NativePhotoCaptureContext,
): Promise<NativePhotoCaptureResult | null> {
  try {
    const result = await ImagePicker.getPendingResultAsync();
    if (!result) return null;
    if ("code" in result) {
      return {
        status: "failed",
        saved: [],
        failedCount: 1,
        message: result.message || "La sélection précédente n’a pas pu être récupérée.",
      };
    }
    return stagePickerResult(context, result);
  } catch (error) {
    return failedResult(error, "La sélection précédente n’a pas pu être récupérée.");
  }
}

async function stagePickerResult(
  context: NativePhotoCaptureContext,
  result: ImagePicker.ImagePickerResult,
  fallbackCapturedAt?: string,
): Promise<NativePhotoCaptureResult> {
  if (result.canceled || !result.assets?.length) return EMPTY_RESULT;

  const saved: LocalMediaItem[] = [];
  let failedCount = 0;

  for (const asset of result.assets) {
    try {
      const normalized = normalizePickerImage(toPickerImageAsset(asset), fallbackCapturedAt);
      const item = await secureMediaStaging.stage({
        accountUserId: context.accountUserId,
        tripId: context.tripId,
        localMediaId: Crypto.randomUUID(),
        sourceUri: normalized.sourceUri,
        mimeType: normalized.mimeType,
        ...(normalized.originalFilename !== undefined
          ? { originalFilename: normalized.originalFilename }
          : {}),
        ...(normalized.fileSizeBytes !== undefined
          ? { fileSizeBytes: normalized.fileSizeBytes }
          : {}),
        ...(normalized.width !== undefined ? { width: normalized.width } : {}),
        ...(normalized.height !== undefined ? { height: normalized.height } : {}),
        ...(normalized.capturedAt !== undefined ? { capturedAt: normalized.capturedAt } : {}),
        ...(normalized.latitude !== undefined ? { latitude: normalized.latitude } : {}),
        ...(normalized.longitude !== undefined ? { longitude: normalized.longitude } : {}),
        ...(normalized.orientation !== undefined ? { orientation: normalized.orientation } : {}),
      });

      if (item) saved.push(item);
      else failedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  if (saved.length > 0) {
    return {
      status: "saved",
      saved,
      failedCount,
      message:
        failedCount > 0
          ? `${saved.length} photo${saved.length > 1 ? "s" : ""} enregistrée${saved.length > 1 ? "s" : ""}, ${failedCount} ignorée${failedCount > 1 ? "s" : ""}.`
          : null,
    };
  }

  return {
    status: "failed",
    saved: [],
    failedCount,
    message: "Aucune photo n’a pu être enregistrée sur cet appareil.",
  };
}

function toPickerImageAsset(asset: ImagePicker.ImagePickerAsset): PickerImageAsset {
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    ...(asset.fileName !== undefined ? { fileName: asset.fileName } : {}),
    ...(asset.fileSize !== undefined ? { fileSize: asset.fileSize } : {}),
    ...(asset.mimeType !== undefined ? { mimeType: asset.mimeType } : {}),
    ...(asset.exif !== undefined ? { exif: asset.exif } : {}),
  };
}

function failedResult(error: unknown, fallback: string): NativePhotoCaptureResult {
  return {
    status: "failed",
    saved: [],
    failedCount: 1,
    message: error instanceof Error && error.message ? error.message : fallback,
  };
}
