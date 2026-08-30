import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const appConfig = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const assetSource = await readFile(
  new URL("../src/features/media/image-picker-asset.ts", import.meta.url),
  "utf8",
);
const captureSource = await readFile(
  new URL("../src/features/media/native-photo-capture.ts", import.meta.url),
  "utf8",
);
const screenSource = await readFile(
  new URL("../src/features/media/screens/photo-capture-screen.tsx", import.meta.url),
  "utf8",
);
const routeSource = await readFile(
  new URL("../app/(tabs)/trips/[tripId]/photos.tsx", import.meta.url),
  "utf8",
);
const stackSource = await readFile(
  new URL("../app/(tabs)/trips/_layout.tsx", import.meta.url),
  "utf8",
);
const tripDetailSource = await readFile(
  new URL("../src/features/trips/screens/trip-detail-screen.tsx", import.meta.url),
  "utf8",
);
const quickActionsSource = await readFile(
  new URL("../src/features/capture/current-trip-quick-actions.tsx", import.meta.url),
  "utf8",
);
const pendingCaptureSource = await readFile(
  new URL("../src/features/capture/pending-captures-card.tsx", import.meta.url),
  "utf8",
);

function executeTypeScript(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const evaluate = new Function("module", "exports", output);
  evaluate(module, module.exports);
  return module.exports;
}

test("COR-201 installs ImagePicker with explicit privacy-oriented native permissions", () => {
  assert.equal(packageJson.dependencies["expo-image-picker"], "~57.0.14");

  const plugin = appConfig.expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === "expo-image-picker",
  );
  assert.ok(plugin);
  assert.match(plugin[1].photosPermission, /photos.*voyages OverMiles/i);
  assert.match(plugin[1].cameraPermission, /appareil photo.*OverMiles/i);
  assert.equal(plugin[1].microphonePermission, false);
});

test("COR-201 normalizes supported images and useful EXIF metadata before local persistence", () => {
  const { normalizePickerImage } = executeTypeScript(assetSource);
  const normalized = normalizePickerImage({
    uri: "file:///picker/IMG_2042.HEIC",
    fileName: "IMG_2042.HEIC",
    fileSize: 4_200_000,
    width: 4032,
    height: 3024,
    exif: {
      DateTimeOriginal: "2026-08-20T12:34:56.000Z",
      GPSLatitude: 48.8566,
      GPSLatitudeRef: "N",
      GPSLongitude: 2.3522,
      GPSLongitudeRef: "E",
      Orientation: 6,
    },
  });

  assert.equal(normalized.mimeType, "image/heic");
  assert.equal(normalized.capturedAt, "2026-08-20T12:34:56.000Z");
  assert.equal(normalized.latitude, 48.8566);
  assert.equal(normalized.longitude, 2.3522);
  assert.equal(normalized.orientation, 6);
  assert.equal(normalized.fileSizeBytes, 4_200_000);
  assert.throws(() =>
    normalizePickerImage({
      uri: "file:///picker/movie.mp4",
      fileName: "movie.mp4",
      width: 1920,
      height: 1080,
      mimeType: "video/mp4",
    }),
  );
});

test("COR-201 uses system multi-photo selection and camera then stages every asset privately", () => {
  assert.match(captureSource, /launchImageLibraryAsync/);
  assert.match(captureSource, /allowsMultipleSelection: true/);
  assert.match(captureSource, /selectionLimit: PHOTO_SELECTION_LIMIT/);
  assert.match(captureSource, /orderedSelection: true/);
  assert.match(captureSource, /exif: true/);
  assert.match(captureSource, /requestCameraPermissionsAsync/);
  assert.match(captureSource, /launchCameraAsync/);
  assert.match(captureSource, /getPendingResultAsync/);
  assert.match(captureSource, /secureMediaStaging\.stage/);
  assert.match(captureSource, /Crypto\.randomUUID\(\)/);
  assert.doesNotMatch(captureSource, /apiClient|fetch\(|FormData|\/api\//);
});

test("COR-201 photo UI stays offline-first, resumable and destructive actions use secure staging", () => {
  assert.match(screenSource, /Choisir des photos/);
  assert.match(screenSource, /Prendre une photo/);
  assert.match(screenSource, /recoverPendingPhotoCapture/);
  assert.match(screenSource, /localMediaStore\.listForTrip/);
  assert.match(screenSource, /secureMediaStaging\.discard/);
  assert.match(screenSource, /Linking\.openSettings/);
  assert.match(screenSource, /accessibilityLiveRegion="polite"/);
  assert.doesNotMatch(screenSource, /apiClient|fetch\(|FormData|\/api\//);
});

test("COR-201 is reachable from Trip detail and current-trip quick actions and remains visible in À compléter", () => {
  assert.match(routeSource, /PhotoCaptureScreen/);
  assert.match(stackSource, /\[tripId\]\/photos/);
  assert.match(tripDetailSource, /Ajouter des photos/);
  assert.match(tripDetailSource, /\/trips\/\[tripId\]\/photos/);
  assert.match(quickActionsSource, /label="Photos"/);
  assert.match(pendingCaptureSource, /localMediaStore\.listForTrip/);
  assert.match(pendingCaptureSource, /photo.*sur cet appareil/s);
});
