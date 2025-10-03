import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_FILE = new URL('./meta.db', import.meta.url);

function normalizePath(p) {
  let s = decodeURIComponent(p || '/');
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/+/, '/');
  return s;
}
function ensureDirPath(p) { const s = normalizePath(p); return s.endsWith('/') ? s : s + '/'; }
function getParent(p) {
  const s = normalizePath(p);
  if (s === '/') return '/';
  const parts = s.split('/').filter(Boolean);
  parts.pop();
  if (parts.length === 0) return '/';
  return '/' + parts.join('/') + '/';
}

let useSqlite = false;

function sqliteExec(sql) {
  try {
    const out = execFileSync('sqlite3', [fileURLToPath(DB_FILE), sql], { encoding: 'utf-8' });
    return out;
  } catch (e) {
    return null;
  }
}

export function loadStore() {
  // Initialize sqlite or throw
  const init = sqliteExec(`PRAGMA journal_mode=WAL;\nCREATE TABLE IF NOT EXISTS entries (path TEXT PRIMARY KEY, type TEXT, name TEXT, size INTEGER, mtime TEXT, singleUrl TEXT, manifest TEXT, chunkUrls TEXT, chunkLengths TEXT);`);
  // Migrate legacy schema if needed (add missing columns)
  const info = sqliteExec(`PRAGMA table_info(entries);`) || '';
  if (!/\|chunkLengths\|/i.test(info)) {
    sqliteExec(`ALTER TABLE entries ADD COLUMN chunkLengths TEXT;`);
  }
  if (init === null) {
    throw new Error('sqlite3 CLI is required but not available in this environment');
  }
  useSqlite = true;
  sqliteExec(`INSERT OR IGNORE INTO entries(path,type,name,mtime) VALUES ('/','dir','/',datetime('now'));`);
  sqliteExec(`INSERT OR IGNORE INTO entries(path,type,name,mtime) VALUES ('/myupload/','dir','myupload',datetime('now'));`);
  return { entries: {} };
}

export function saveStore() { /* no-op for sqlite */ }

export function getEntry(store, p) {
  const key = normalizePath(p);
  if (useSqlite) {
    const out = sqliteExec(`SELECT path,type,name,size,mtime,singleUrl,manifest,chunkUrls,chunkLengths FROM entries WHERE path='${key.replace(/'/g, "''")}';`);
    if (!out) return undefined;
    const row = out.trim().split('|');
    if (!row[0]) return undefined;
    const [path, type, name, size, mtime, singleUrl, manifest, chunkUrls, chunkLengths] = row;
    return { type, name, size: size? Number(size): undefined, mtime, singleUrl: singleUrl||undefined, manifest: manifest||undefined, chunkUrls: chunkUrls? chunkUrls.split(','): undefined, chunkLengths: chunkLengths? chunkLengths.split(',').map(n=>Number(n)): undefined };
  }
  return undefined;
}

export function listChildren(store, dirPath) {
  const base = ensureDirPath(dirPath);
  if (useSqlite) {
    const out = sqliteExec(`SELECT path,type,name,size,mtime,singleUrl,manifest,chunkUrls,chunkLengths FROM entries WHERE path LIKE '${base.replace(/'/g, "''")}%' AND path!='${base.replace(/'/g, "''")}';`);
    const lines = (out || '').trim().split('\n').filter(Boolean);
    const results = lines.map(line => {
      const [path, type, name, size, mtime, singleUrl, manifest, chunkUrls, chunkLengths] = line.split('|');
      return { path, entry: { type, name, size: size? Number(size): undefined, mtime, singleUrl: singleUrl||undefined, manifest: manifest||undefined, chunkUrls: chunkUrls? chunkUrls.split(','): undefined, chunkLengths: chunkLengths? chunkLengths.split(',').map(n=>Number(n)): undefined } };
    }).filter(({ path }) => getParent(path) === base);
    return results;
  }
  return [];
}

export function makeDir(store, dirPath) {
  const p = ensureDirPath(dirPath);
  if (useSqlite) {
    sqliteExec(`INSERT OR REPLACE INTO entries(path,type,name,mtime) VALUES ('${p.replace(/'/g, "''")}','dir','${p.split('/').filter(Boolean).pop()}',datetime('now'));`);
    return;
  }
  // sqlite-only; already handled
}

export function setFile(store, filePath, fileInfo) {
  const p = normalizePath(filePath);
  if (useSqlite) {
    const chunkStr = fileInfo.chunkUrls ? fileInfo.chunkUrls.join(',') : null;
    const lensStr = fileInfo.chunkLengths ? fileInfo.chunkLengths.join(',') : null;
    sqliteExec(`INSERT OR REPLACE INTO entries(path,type,name,size,mtime,singleUrl,manifest,chunkUrls,chunkLengths) VALUES ('${p.replace(/'/g, "''")}','file','${fileInfo.name}','${fileInfo.size||0}',datetime('now'),'${(fileInfo.singleUrl||'').replace(/'/g, "''")}','${(fileInfo.manifest||'').replace(/'/g, "''")}','${(chunkStr||'').replace(/'/g, "''")}','${(lensStr||'').replace(/'/g, "''")}');`);
    return;
  }
  // sqlite-only; already handled
}

export function removeEntry(store, p) {
  const key = normalizePath(p);
  if (useSqlite) {
    const base = ensureDirPath(key);
    sqliteExec(`DELETE FROM entries WHERE path='${key.replace(/'/g, "''")}';`);
    // also delete children if dir
    sqliteExec(`DELETE FROM entries WHERE path LIKE '${base.replace(/'/g, "''")}%' AND path!='${base.replace(/'/g, "''")}';`);
    return;
  }
  // sqlite-only; already handled
}

export function moveEntry(store, from, to) {
  const src = normalizePath(from);
  const dst = normalizePath(to);
  if (useSqlite) {
    const srcEntry = getEntry(store, src);
    if (!srcEntry) return false;
    const isDir = srcEntry.type === 'dir';
    if (!isDir) {
      // simple move
      sqliteExec(`UPDATE entries SET path='${dst.replace(/'/g, "''")}', name='${dst.split('/').filter(Boolean).pop()}', mtime=datetime('now') WHERE path='${src.replace(/'/g, "''")}';`);
      return true;
    }
    // move dir and children by prefix replacement
    const base = ensureDirPath(src);
    const newBase = ensureDirPath(dst);
    const out = sqliteExec(`SELECT path FROM entries WHERE path LIKE '${base.replace(/'/g, "''")}%' ORDER BY path;`);
    const lines = (out || '').trim().split('\n').filter(Boolean);
    for (const path of lines) {
      const newPath = (newBase + path.slice(base.length)).replace(/\/+/, '/');
      const newName = newPath.split('/').filter(Boolean).pop();
      sqliteExec(`UPDATE entries SET path='${newPath.replace(/'/g, "''")}', name='${newName}', mtime=datetime('now') WHERE path='${path.replace(/'/g, "''")}';`);
    }
    // ensure dir row exists
    sqliteExec(`INSERT OR REPLACE INTO entries(path,type,name,mtime) VALUES ('${ensureDirPath(dst).replace(/'/g, "''")}','dir','${dst.split('/').filter(Boolean).pop()}',datetime('now'));`);
    return true;
  }
  return false;
}

export const utils = { normalizePath, ensureDirPath, getParent };
