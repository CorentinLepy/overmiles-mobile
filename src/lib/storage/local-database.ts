import * as SQLite from "expo-sqlite";

import { DatabaseKeyStore } from "./database-key-store";
import { runLocalMigrations } from "./migrations";

const DATABASE_NAME = "overmiles.db";
const DATABASE_KEY_PATTERN = /^[0-9a-f]{64}$/;

function sqlCipherKeyPragma(hexKey: string): string {
  if (!DATABASE_KEY_PATTERN.test(hexKey)) {
    throw new Error("Format de clé SQLCipher invalide.");
  }
  return `PRAGMA key = \"x'${hexKey}'\";`;
}

export class LocalDatabase {
  private database: SQLite.SQLiteDatabase | null = null;
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;

  constructor(private readonly keyStore = new DatabaseKeyStore()) {}

  async open(): Promise<SQLite.SQLiteDatabase> {
    if (this.database) return this.database;
    if (!this.opening) {
      this.opening = this.openEncryptedDatabase().finally(() => {
        this.opening = null;
      });
    }
    return this.opening;
  }

  async close(): Promise<void> {
    if (!this.database) return;
    await this.database.closeAsync();
    this.database = null;
  }

  async purge(): Promise<void> {
    await this.close();
    try {
      await SQLite.deleteDatabaseAsync(DATABASE_NAME);
    } finally {
      await this.keyStore.clearKey();
    }
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
