import * as SQLite from "expo-sqlite";

import { DatabaseKeyStore } from "./database-key-store";
import { runLocalMigrations } from "./migrations";

const DATABASE_NAME = "overmiles.db";
const DATABASE_KEY_PATTERN = /^[0-9a-f]{64}$/;

export type LocalDatabaseGeneration = number;

function sqlCipherKeyPragma(hexKey: string): string {
  if (!DATABASE_KEY_PATTERN.test(hexKey)) {
    throw new Error("Format de clé SQLCipher invalide.");
  }
  return `PRAGMA key = \"x'${hexKey}'\";`;
}

export class LocalDatabase {
  private database: SQLite.SQLiteDatabase | null = null;
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;
  private closing: Promise<void> | null = null;
  private purging: Promise<void> | null = null;
  private purgeRequested = false;
  private lifecycleGeneration = 0;

  constructor(private readonly keyStore = new DatabaseKeyStore()) {}

  captureGeneration(): LocalDatabaseGeneration | null {
    return this.purgeRequested ? null : this.lifecycleGeneration;
  }

  canUseGeneration(generation: LocalDatabaseGeneration | null): boolean {
    return (
      generation !== null &&
      !this.purgeRequested &&
      generation === this.lifecycleGeneration
    );
  }

  async openForGeneration(
    generation: LocalDatabaseGeneration | null,
  ): Promise<SQLite.SQLiteDatabase | null> {
    return this.openIf(() => this.canUseGeneration(generation));
  }

  async open(): Promise<SQLite.SQLiteDatabase> {
    if (this.purgeRequested) {
      if (this.purging) {
        await this.purging;
      } else {
        await Promise.resolve();
      }
      return this.open();
    }

    if (this.closing) {
      await this.closing;
      return this.open();
    }

    if (this.database) return this.database;
    if (!this.opening) {
      const opening = this.openEncryptedDatabase();
      let trackedOpening: Promise<SQLite.SQLiteDatabase>;
      trackedOpening = opening.finally(() => {
        if (this.opening === trackedOpening) {
          this.opening = null;
        }
      });
      this.opening = trackedOpening;
    }
    return this.opening;
  }

  async openIf(shouldOpen: () => boolean): Promise<SQLite.SQLiteDatabase | null> {
    if (!shouldOpen()) return null;

    if (this.purgeRequested) {
      if (this.purging) {
        await this.purging;
      } else {
        await Promise.resolve();
      }
      return this.openIf(shouldOpen);
    }

    if (this.closing) {
      await this.closing;
      return this.openIf(shouldOpen);
    }

    if (!shouldOpen()) return null;
    const database = await this.open();
    return shouldOpen() ? database : null;
  }

  async close(): Promise<void> {
    if (this.purging) {
      await this.purging;
      return;
    }

    if (!this.closing) {
      const closing = (async () => {
        const opening = this.opening;
        if (opening) {
          await opening.catch(() => undefined);
        }
        await this.closeActiveDatabase();
      })();

      let trackedClosing: Promise<void>;
      trackedClosing = closing.finally(() => {
        if (this.closing === trackedClosing) {
          this.closing = null;
        }
      });
      this.closing = trackedClosing;
    }

    return this.closing;
  }

  async purge(): Promise<void> {
    if (this.purging) {
      return this.purging;
    }

    this.lifecycleGeneration += 1;
    this.purgeRequested = true;

    const purging = (async () => {
      const closing = this.closing;
      if (closing) {
        await closing.catch(() => undefined);
      }

      const opening = this.opening;
      if (opening) {
        await opening.catch(() => undefined);
      }

      let closeError: unknown;
      try {
        await this.closeActiveDatabase();
      } catch (error) {
        closeError = error;
      }

      let purgeError: unknown;
      try {
        try {
          await SQLite.deleteDatabaseAsync(DATABASE_NAME);
        } catch (error) {
          purgeError = error;
        }
      } finally {
        try {
          await this.keyStore.clearKey();
        } catch (error) {
          purgeError ??= error;
        }
      }

      if (closeError) throw closeError;
      if (purgeError) throw purgeError;
    })();

    let trackedPurge: Promise<void>;
    trackedPurge = purging.finally(() => {
      if (this.purging === trackedPurge) {
        this.purging = null;
        this.purgeRequested = false;
      }
    });
    this.purging = trackedPurge;

    return trackedPurge;
  }

  private async closeActiveDatabase(): Promise<void> {
    const database = this.database;
    this.database = null;
    if (!database) return;
    await database.closeAsync();
  }

  private async configureDatabase(
    db: SQLite.SQLiteDatabase,
    key: string,
  ): Promise<SQLite.SQLiteDatabase> {
    await db.execAsync(sqlCipherKeyPragma(key));
    await db.getFirstAsync("SELECT count(*) AS count FROM sqlite_master");
    await db.execAsync("PRAGMA foreign_keys = ON;");

    // Expo SDK 57.0.1 can leave WAL/SHM sidecars behind on delete. Until the upstream
    // deletion fix is released, DELETE journaling gives us predictable secure purges.
    await db.execAsync("PRAGMA journal_mode = DELETE;");
    await runLocalMigrations(db);
    return db;
  }

  private async openWithStoredKey(key: string): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    try {
      await this.configureDatabase(db, key);
      this.database = db;
      return db;
    } catch (error) {
      await db.closeAsync().catch(() => undefined);
      throw error;
    }
  }

  private async openWithoutStoredKey(): Promise<SQLite.SQLiteDatabase> {
    const candidateKey = await this.keyStore.generateKey();
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    try {
      await this.configureDatabase(db, candidateKey);
      await this.keyStore.storeKey(candidateKey);
      this.database = db;
      return db;
    } catch {
      // If a database survived without its SecureStore key, it is cryptographically
      // unrecoverable. The open above guarantees that a DB file exists, so deletion is
      // deterministic even on SDK 57 where deleting a missing file throws.
      await db.closeAsync().catch(() => undefined);
      await SQLite.deleteDatabaseAsync(DATABASE_NAME);

      const recoveredDb = await SQLite.openDatabaseAsync(DATABASE_NAME);
      try {
        await this.configureDatabase(recoveredDb, candidateKey);
        await this.keyStore.storeKey(candidateKey);
        this.database = recoveredDb;
        return recoveredDb;
      } catch (recoveryError) {
        await recoveredDb.closeAsync().catch(() => undefined);
        throw recoveryError;
      }
    }
  }

  private async openEncryptedDatabase(): Promise<SQLite.SQLiteDatabase> {
    const storedKey = await this.keyStore.readKey();
    return storedKey ? this.openWithStoredKey(storedKey) : this.openWithoutStoredKey();
  }
}

export const localDatabase = new LocalDatabase();