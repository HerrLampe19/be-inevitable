// Datenbank-Schicht.
// Nutzt better-sqlite3 wenn installiert (empfohlen, robust auf Windows),
// sonst das in Node 22+ eingebaute node:sqlite als Fallback.
// Beide bieten dieselbe Mini-API: db.run(sql, params), db.get(sql, params), db.all(sql, params), db.exec(sql)

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
    bdb.pragma('foreign_keys = ON'); // ON DELETE CASCADE explizit aktivieren (Treiber-Default nicht voraussetzen)
    impl = {
      run: (sql, params = []) => { const s = bdb.prepare(sql); return s.run(...params); },
      get: (sql, params = []) => { const s = bdb.prepare(sql); return s.get(...params); },
      all: (sql, params = []) => { const s = bdb.prepare(sql); return s.all(...params); },
      exec: (sql) => bdb.exec(sql),
      close: () => bdb.close(),
    };
    console.log('[db] better-sqlite3 aktiv');
    return;
  } catch (e) {
    betterErr = String(e && e.message || e).split('\n')[0].slice(0, 160); // fällt durch zum Fallback (Grund fürs Log merken)
  }

  // 2) Fallback: eingebautes node:sqlite (Node 22+)
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const ndb = new DatabaseSync(DB_PATH);
    ndb.exec('PRAGMA journal_mode = WAL');
    ndb.exec('PRAGMA foreign_keys = ON'); // ON DELETE CASCADE explizit aktivieren
    impl = {
      run: (sql, params = []) => { const s = ndb.prepare(sql); return s.run(...params); },
      get: (sql, params = []) => { const s = ndb.prepare(sql); return s.get(...params); },
      all: (sql, params = []) => { const s = ndb.prepare(sql); return s.all(...params); },
      exec: (sql) => ndb.exec(sql),
      close: () => ndb.close(),
    };
    console.log('[db] node:sqlite (eingebaut) aktiv');
    // Der eingebaute Treiber gilt in Node als experimentell. Im Produktivbetrieb ist better-sqlite3 die
    // empfohlene Engine – meist fehlt nur das native Binding für die laufende Node-Version (npm rebuild better-sqlite3).
    if (process.env.NODE_ENV === 'production') console.warn('[db] WARNUNG: better-sqlite3 nicht ladbar (' + (betterErr || 'unbekannt') + ') – Fallback node:sqlite aktiv. Empfohlen: npm rebuild better-sqlite3');
    return;
  } catch (e) {
    console.error('Keine SQLite-Engine verfügbar. Bitte "npm install" ausführen.');
    throw e;
  }
}

let betterErr = null;
await load();

// undefined -> null normalisieren (node:sqlite akzeptiert kein undefined)
const clean = (params) => (params || []).map(p => p === undefined ? null : p);

// Transaktion: fn() läuft komplett oder gar nicht (BEGIN/COMMIT/ROLLBACK, beide Engines).
// Verschachtelte Aufrufe nutzen SAVEPOINTs, damit z.B. buildAndStoreMealPlan() innerhalb des
// Onboardings sauber in die äußere Transaktion eingebettet wird. Rückgabewert = Ergebnis von fn().
let txDepth = 0;
function tx(fn) {
  const outer = txDepth === 0, sp = 'sp' + txDepth;
  impl.exec(outer ? 'BEGIN' : 'SAVEPOINT ' + sp);
  txDepth++;
  let result;
  try { result = fn(); }
  catch (e) {
    txDepth--;
    try { if (outer) impl.exec('ROLLBACK'); else { impl.exec('ROLLBACK TO ' + sp); impl.exec('RELEASE ' + sp); } } catch (_) {}
    throw e;
  }
  txDepth--;
  try { impl.exec(outer ? 'COMMIT' : 'RELEASE ' + sp); }
  catch (e) { try { if (outer) impl.exec('ROLLBACK'); } catch (_) {} throw e; }
  return result;
}

// WAL-Checkpoint: schreibt den Inhalt von data.db-wal zurück in data.db und leert die WAL-Datei.
// Ohne das bleibt praktisch der gesamte Schreibstand in data.db-wal liegen – eine Kopie von data.db
// allein (Backup, Download von der Render-Platte, Umzug der Dev-DB) wäre dann fast leer.
// Wird stündlich vom Zeitgeber in server.js und beim Herunterfahren aufgerufen.
function checkpoint() {
  try { impl.exec('PRAGMA wal_checkpoint(TRUNCATE)'); return true; }
  catch (e) { console.error('[db] Checkpoint fehlgeschlagen:', e && e.message || e); return false; }
}

// Zusätzlich alle 5 Minuten automatisch: so bleibt data.db auch im laufenden Betrieb aktuell und eine
// Kopie der Datei (Backup/Download) enthält höchstens die letzten Minuten nicht. unref() = hält den
// Prozess nicht am Leben (wichtig für seed.js und Tests).
const walTimer = setInterval(() => { try { checkpoint(); } catch (_) {} }, 5 * 60 * 1000);
if (walTimer.unref) walTimer.unref();

// Sauberes Herunterfahren: erst das WAL zurückschreiben, dann die Verbindung schließen.
// Render schickt beim Deploy/Stop SIGTERM, Strg+C schickt SIGINT – danach steht alles in data.db.
let closed = false;
function shutdown() {
  if (closed) return;
  closed = true;
  checkpoint();
  try { if (impl.close) impl.close(); } catch (_) {}
}
process.on('exit', shutdown);              // auch bei normalem Prozessende (z.B. seed.js)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { shutdown(); process.exit(0); });
}

export const db = {
  run: (sql, params) => impl.run(sql, clean(params)),
  get: (sql, params) => impl.get(sql, clean(params)),
  all: (sql, params) => impl.all(sql, clean(params)),
  exec: (sql) => impl.exec(sql),
  tx,
  checkpoint,
  close: shutdown,
};
