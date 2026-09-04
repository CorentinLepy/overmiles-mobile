import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appJson = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const eas = JSON.parse(await readFile(new URL("../eas.json", import.meta.url), "utf8"));
const readiness = await readFile(
  new URL("../docs/cor-104-store-release-readiness.md", import.meta.url),
  "utf8",
);

test("store identity remains stable across iOS and Android", () => {
  assert.equal(appJson.expo.name, "OVERMILES");
  assert.equal(appJson.expo.ios.bundleIdentifier, "app.overmiles.mobile");
  assert.equal(appJson.expo.android.package, "app.overmiles.mobile");
  assert.equal(appJson.expo.scheme, "overmiles");
  assert.deepEqual(appJson.expo.platforms, ["ios", "android"]);
});

test("EAS owns monotonic production build numbers and targets the canonical API", () => {
  assert.equal(eas.cli.appVersionSource, "remote");
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.build.production.channel, "production");
  assert.equal(eas.build.production.env.EXPO_PUBLIC_APP_ENV, "production");
  assert.equal(eas.build.production.env.EXPO_PUBLIC_API_BASE_URL, "https://overmiles.app/api/v1");
});

test("development and preview distributions cannot masquerade as public store releases", () => {
  assert.equal(eas.build.development.distribution, "internal");
  assert.equal(eas.build.development.developmentClient, true);
  assert.equal(eas.build.preview.distribution, "internal");
  assert.equal(eas.build.development.channel, "development");
  assert.equal(eas.build.preview.channel, "preview");
});

test("store credentials stay out of repository configuration", () => {
  const serialized = JSON.stringify(eas);
  assert.doesNotMatch(
    serialized,
    /appleId|ascAppId|serviceAccountKeyPath|EXPO_TOKEN|keystore|password|privateKey/i,
  );
  assert.deepEqual(eas.submit.production, {});
});

test("release documentation keeps public publication behind an explicit human gate", () => {
  assert.match(readiness, /publication seulement après validation humaine/i);
  assert.match(readiness, /production seulement après validation humaine/i);
  assert.match(readiness, /TestFlight/i);
  assert.match(readiness, /Google Play Internal Testing/i);
  assert.match(readiness, /Aucune case de privacy store ne doit être cochée/i);
  assert.match(readiness, /ne passe Done que lorsque/i);
});

test("release readiness forbids secrets in public Expo variables", () => {
  assert.match(readiness, /EXPO_PUBLIC_\*/);
  assert.match(readiness, /ne contiennent jamais de secret/i);
  assert.match(readiness, /EXPO_TOKEN/);
  assert.match(readiness, /keystore Android/i);
});
