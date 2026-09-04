import { secureMediaStaging } from "@/src/features/media/secure-media-staging";

import { localDatabase } from "./local-database";

export async function purgePrivateLocalData(): Promise<void> {
  const [databaseResult, mediaResult] = await Promise.allSettled([
    localDatabase.purge(),
    secureMediaStaging.purgeAllAndLock(),
  ]);

  if (databaseResult.status === "rejected") {
    throw databaseResult.reason;
  }
  if (mediaResult.status === "rejected") {
    throw mediaResult.reason;
  }
}

export async function activatePrivateMediaForAccount(accountUserId: string): Promise<void> {
  secureMediaStaging.allowAfterAuthentication();
  await secureMediaStaging.reconcileAccount(accountUserId);
}
