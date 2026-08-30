// Diagnostic temporaire COR-205 : Expo 57 fournit déjà ce module transitivement.
// Si Metro le résout pendant la gate native, la dépendance directe sera alignée avec COR-199.
// @ts-expect-error expo-file-system n'est pas encore déclaré comme dépendance directe.
import { Directory, File, Paths } from "expo-file-system";

import {
  localDatabase,
  type LocalDatabase,
  type LocalDatabaseGeneration,
} from "@/src/lib/storage/local-database";

import type { LocalMediaItem, SaveLocalMediaItemInput } from "./local-media-item";
import { localMediaStore, type LocalMediaStore } from "./local-media-store";
import {
  createLocalMediaStorageKey,
  isLocalMediaStorageKeyForAccount,
  parseLocalMediaStorageKey,
} from "./secure-media-path";

const PRIVATE_ROOT = "overmiles-private";
const MEDIA_ROOT = "media";

type StageLocalMediaInput = Omit<SaveLocalMediaItemInput, "storageKey" | "state"> &
  Readonly<{ sourceUri: string }>;

export type MediaReconciliationReport = Readonly<{
  removedOrphanFiles: number;
  missingFiles: number;
}>;

export class SecureMediaStaging {
  private operationQueue: Promise<void> = Promise.resolve();
  private lifecycleGeneration = 0;
  private stagingLocked = false;

  constructor(
    private readonly database: LocalDatabase = localDatabase,
    private readonly mediaStore: LocalMediaStore = localMediaStore,
  ) {}

  allowAfterAuthentication(): void {
    this.stagingLocked = false;
  }

  async stage(input: StageLocalMediaInput): Promise<LocalMediaItem | null> {
    if (this.stagingLocked) return null;

    const stagingGeneration = this.lifecycleGeneration;
    const databaseGeneration = this.database.captureGeneration();
    if (databaseGeneration === null) return null;

    return this.enqueue(async () => {
      if (!this.canStage(stagingGeneration, databaseGeneration)) return null;

      const storageKey = createLocalMediaStorageKey(
        input.accountUserId,
        input.localMediaId,
        input.mimeType,
      );
      const { filename } = parseLocalMediaStorageKey(storageKey);
      const accountDirectory = this.accountDirectory(input.accountUserId);
      accountDirectory.create({ idempotent: true, intermediates: true });

      const source = new File(input.sourceUri);
      if (!source.exists) {
        throw new Error("Le fichier média sélectionné n’est plus disponible.");
      }

      const stagedFile = new File(accountDirectory, filename);
      const temporaryFile = new File(accountDirectory, `.${input.localMediaId}.staging`);
      if (temporaryFile.exists) temporaryFile.delete();
      if (stagedFile.exists) {
        throw new Error("Un média local avec cet identifiant existe déjà.");
      }

      await source.copy(temporaryFile);
      if (!this.canStage(stagingGeneration, databaseGeneration)) {
        if (temporaryFile.exists) temporaryFile.delete();
        return null;
      }

      await temporaryFile.move(stagedFile);
      if (!this.canStage(stagingGeneration, databaseGeneration)) {
        if (stagedFile.exists) stagedFile.delete();
        return null;
      }

      try {
        const saved = await this.mediaStore.save(
          createSaveInput(input, storageKey, input.fileSizeBytes ?? stagedFile.size),
          databaseGeneration,
        );

        if (!saved && stagedFile.exists) stagedFile.delete();
        return saved;
      } catch (error) {
        if (stagedFile.exists) stagedFile.delete();
        throw error;
      }
    });
  }

  async discard(item: LocalMediaItem): Promise<boolean> {
    const databaseGeneration = this.database.captureGeneration();
    if (databaseGeneration === null || this.stagingLocked) return false;

    return this.enqueue(async () => {
      if (!this.database.canUseGeneration(databaseGeneration) || this.stagingLocked) return false;
      if (!isLocalMediaStorageKeyForAccount(item.storageKey, item.accountUserId)) {
        throw new Error("Le média à supprimer ne correspond pas au compte actif.");
      }

      const file = this.fileForStorageKey(item.storageKey);
      if (file.exists) file.delete();
      return this.mediaStore.remove(item.accountUserId, item.localMediaId, databaseGeneration);
    });
  }

  async reconcileAccount(accountUserId: string): Promise<MediaReconciliationReport> {
    if (this.stagingLocked) return { removedOrphanFiles: 0, missingFiles: 0 };
    const databaseGeneration = this.database.captureGeneration();
    if (databaseGeneration === null) return { removedOrphanFiles: 0, missingFiles: 0 };

    return this.enqueue(async () => {
      if (!this.database.canUseGeneration(databaseGeneration) || this.stagingLocked) {
        return { removedOrphanFiles: 0, missingFiles: 0 };
      }

      const items = await this.mediaStore.listForAccount(accountUserId, databaseGeneration);
      const expectedKeys = new Set(items.map((item) => item.storageKey));
      const accountDirectory = this.accountDirectory(accountUserId);
      let removedOrphanFiles = 0;
      let missingFiles = 0;

      if (accountDirectory.exists) {
        for (const entry of accountDirectory.list()) {
          if (entry instanceof Directory) {
            entry.delete();
            removedOrphanFiles += 1;
            continue;
          }

          const storageKey = `media/${accountUserId}/${entry.name}`;
          if (entry.name.startsWith(".") || !expectedKeys.has(storageKey)) {
            entry.delete();
            removedOrphanFiles += 1;
          }
        }
      }

      for (const item of items) {
        if (!this.fileForStorageKey(item.storageKey).exists) {
          missingFiles += 1;
          await this.mediaStore.setState(
            item.accountUserId,
            item.localMediaId,
            "failed",
            databaseGeneration,
          );
        }
      }

      return { removedOrphanFiles, missingFiles };
    });
  }

  purgeAllAndLock(): Promise<void> {
    this.lifecycleGeneration += 1;
    this.stagingLocked = true;

    return this.enqueue(async () => {
      const root = this.mediaRootDirectory();
      if (root.exists) root.delete();
    });
  }

  private canStage(
    stagingGeneration: number,
    databaseGeneration: LocalDatabaseGeneration,
  ): boolean {
    return (
      !this.stagingLocked &&
      stagingGeneration === this.lifecycleGeneration &&
      this.database.canUseGeneration(databaseGeneration)
    );
  }

  private mediaRootDirectory(): Directory {
    return new Directory(Paths.document, PRIVATE_ROOT, MEDIA_ROOT);
  }

  private accountDirectory(accountUserId: string): Directory {
    createLocalMediaStorageKey(accountUserId, "probe", "image/jpeg");
    return new Directory(Paths.document, PRIVATE_ROOT, MEDIA_ROOT, accountUserId);
  }

  private fileForStorageKey(storageKey: string): File {
    const { accountUserId, filename } = parseLocalMediaStorageKey(storageKey);
    return new File(Paths.document, PRIVATE_ROOT, MEDIA_ROOT, accountUserId, filename);
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(work, work);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function createSaveInput(
  input: StageLocalMediaInput,
  storageKey: string,
  fileSizeBytes: number,
): SaveLocalMediaItemInput {
  return {
    accountUserId: input.accountUserId,
    tripId: input.tripId,
    localMediaId: input.localMediaId,
    storageKey,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    fileSizeBytes,
    width: input.width,
    height: input.height,
    capturedAt: input.capturedAt,
    latitude: input.latitude,
    longitude: input.longitude,
    orientation: input.orientation,
    stopId: input.stopId,
    caption: input.caption,
    state: "local_only",
  };
}

export const secureMediaStaging = new SecureMediaStaging();
