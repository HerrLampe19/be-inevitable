// Datenbank-Schicht.
// Nutzt better-sqlite3 wenn installiert (empfohlen, robust auf Windows),
// sonst das in Node 22+ eingebaute node:sqlite als Fallback.
// Beide bieten dieselbe Mini-API: db.run(sql, params), db.get(sql, params), db.all(sql, params), db.exec(sql)

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Online kann der Pfad per DB_PATH auf eine persistente Festplatte gelegt werden,
// z.B. DB_PATH=/var/data/data.db. Lokal bleibt es standardmäßig im Projektordner.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');

let impl;

async function load() {
  // 1) Versuch: better-sqlite3
  try {
    const mod = await import('better-sqlite3');
    const Database = mod.default;
    const bdb = new Database(DB_PATH);
    bdb.pragma('journal_mode = WAL');
    impl = {
      run: (sql, params = []) => { const s = bdb.prepare(sql); return s.run(...params); },
      get: (sql, params = []) => { const s = bdb.prepare(sql); return s.get(...params); },
      all: (sql, params = []) => { const s = bdb.prepare(sql); return s.all(...params); },
      exec: (sql) => bdb.exec(sql),
    };
    console.log('[db] better-sqlite3 aktiv');
    return;
  } catch (e) {
    // fällt durch zum Fallback
  }

  // 2) Fallback: eingebautes node:sqlite (Node 22+)
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const ndb = new DatabaseSync(DB_PATH);
    ndb.exec('PRAGMA journal_mode = WAL');
    impl = {
      run: (sql, params = []) => { const s = ndb.prepare(sql); return s.run(...params); },
      get: (sql, params = []) => { const s = ndb.prepare(sql); return s.get(...params); },
      all: (sql, params = []) => { const s = ndb.prepare(sql); return s.all(...params); },
      exec: (sql) => ndb.exec(sql),
    };
    console.log('[db] node:sqlite (eingebaut) aktiv');
    return;
  } catch (e) {
    console.error('Keine SQLite-Engine verfügbar. Bitte "npm install" ausführen.');
    throw e;
  }
}

await load();

// undefined -> null normalisieren (node:sqlite akzeptiert kein undefined)
const clean = (params) => (params || []).map(p => p === undefined ? null : p);

export const db = {
  run: (sql, params) => impl.run(sql, clean(params)),
  get: (sql, params) => impl.get(sql, clean(params)),
  all: (sql, params) => impl.all(sql, clean(params)),
  exec: (sql) => impl.exec(sql),
};

export const isFreshDb = !existsSync(DB_PATH) || true; // Schema wird idempotent angelegt
