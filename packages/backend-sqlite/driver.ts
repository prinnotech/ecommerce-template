// Node's built-in SQLite (node:sqlite, no native dependency) behind the driver interface
// Kysely's SqliteDialect expects (the better-sqlite3 shape).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type { SqliteDatabase, SqliteStatement } from "kysely";

export function openSqlite(file: string): SqliteDatabase {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // WAL lets the store and the admin (two processes) read while the other writes.
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

  return {
    close: () => db.close(),
    prepare(sql: string): SqliteStatement {
      const statement = db.prepare(sql);
      const params = (parameters: ReadonlyArray<unknown>) => parameters as SQLInputValue[];
      return {
        reader: statement.columns().length > 0,
        all: (parameters) => statement.all(...params(parameters)),
        run: (parameters) => statement.run(...params(parameters)),
        iterate: (parameters) => statement.iterate(...params(parameters)),
      };
    },
  };
}
