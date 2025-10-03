export const STORAGE_KEYS = {
  UPLOAD_LOG: 'uploadLog',
  UPLOAD_HISTORY: 'uploadHistory'
} as const;

type VueRef<T> = { value: T };

// Dispatch a global event so other pages (e.g., Manager) can refresh
function dispatchHistoryUpdated() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('fcf:history-updated'));
    }
  } catch {/* no-op */}
}

export const addDebugOutput = (message: string, debugOutputRef: VueRef<string>) => {
  const timestamp = new Date().toLocaleString();
  const newEntry = `[${timestamp}] ${message}`;
  debugOutputRef.value += `${newEntry}\n---------\n`;
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_LOG) || '[]');
  history.push(newEntry);
  localStorage.setItem(STORAGE_KEYS.UPLOAD_LOG, JSON.stringify(history));
};

export const saveUploadHistory = (sjurl: string, uploadHistoryRef: VueRef<any[]>) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  const existing = history.find((entry: any) => entry.link === sjurl);
  if (!existing) {
    history.unshift({ time: new Date().toLocaleString(), link: sjurl, note: '' });
    localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(history));
    uploadHistoryRef.value = history;
    dispatchHistoryUpdated();
    // 同步到 WebDAV myupload（仅对清单格式）
    maybeSyncMyuploadAdd(sjurl);
  }
};

export const saveUploadHistoryWithNote = (sjurl: string, note: string, uploadHistoryRef: VueRef<any[]>) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  const existing = history.find((entry: any) => entry.link === sjurl);
  if (!existing) {
    history.unshift({ time: new Date().toLocaleString(), link: sjurl, note });
    localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(history));
    uploadHistoryRef.value = history;
    dispatchHistoryUpdated();
  }
};

export const loadUploadHistory = (uploadHistoryRef: VueRef<any[]>) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  uploadHistoryRef.value = history;
};

export const clearLog = (debugOutputRef: VueRef<string>) => {
  debugOutputRef.value = '';
  localStorage.removeItem(STORAGE_KEYS.UPLOAD_LOG);
};

export const clearHistory = (uploadHistoryRef: VueRef<any[]>) => {
  // 删除 myupload 中对应的文件（仅对清单格式）
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  if (Array.isArray(history)) {
    for (const entry of history) { maybeSyncMyuploadRemove(entry.link); }
  }
  uploadHistoryRef.value = [];
  localStorage.removeItem(STORAGE_KEYS.UPLOAD_HISTORY);
  dispatchHistoryUpdated();
};

export const removeHistoryItem = (link: string, uploadHistoryRef: VueRef<any[]>) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  const next = history.filter((entry: any) => entry.link !== link);
  localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(next));
  uploadHistoryRef.value = next;
  dispatchHistoryUpdated();
  // 同步删除 myupload 中对应的文件（仅对清单格式）
  maybeSyncMyuploadRemove(link);
};

export const updateHistoryItem = (time: string, newLink: string, uploadHistoryRef: VueRef<any[]>) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  const next = history.map((entry: any) => {
    if (entry.time === time) return { ...entry, link: newLink };
    return entry;
  });
  localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(next));
  uploadHistoryRef.value = next;
  dispatchHistoryUpdated();
};

export const updateHistoryEntry = (
  originalTime: string,
  newTime: string,
  newLink: string,
  uploadHistoryRef: VueRef<any[]>,
  newNote?: string
) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  const next = history.map((entry: any) => {
    if (entry.time === originalTime) {
      const updated = { ...entry, time: newTime, link: newLink };
      if (typeof newNote === 'string') updated.note = newNote;
      return updated;
    }
    return entry;
  });
  localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(next));
  uploadHistoryRef.value = next;
  dispatchHistoryUpdated();
  // 如果链接发生变更，尝试同步 myupload：旧删新加
  const oldEntry = history.find((e: any) => e.time === originalTime);
  if (oldEntry && oldEntry.link !== newLink) {
    maybeSyncMyuploadRemove(oldEntry.link);
    maybeSyncMyuploadAdd(newLink);
  }
};

// Add a new history entry (avoid duplicate by link)
export const addHistoryEntry = (
  time: string,
  link: string,
  uploadHistoryRef: VueRef<any[]>,
  note: string = ''
) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  const exists = history.find((entry: any) => entry.link === link);
  if (exists) return; // skip duplicates by link
  history.unshift({ time, link, note });
  localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(history));
  uploadHistoryRef.value = history;
  dispatchHistoryUpdated();
  // 同步新增 myupload 文件（仅对清单格式）
  maybeSyncMyuploadAdd(link);
};

// Update the latest (most recent) history entry's note in a single place
export const updateLatestHistoryNote = (note: string, uploadHistoryRef: VueRef<any[]>) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  if (!Array.isArray(history) || history.length === 0) return;
  const next = [...history];
  // 合并备注，避免覆盖已有（例如文件大小备注与来源备注冲突）
  const existing = typeof next[0]?.note === 'string' ? next[0].note : '';
  const incoming = (note || '').trim();
  let merged = existing;
  if (incoming) {
    if (!existing) {
      merged = incoming;
    } else if (!existing.includes(incoming)) {
      merged = `${existing} | ${incoming}`;
    }
  }
  next[0] = { ...next[0], note: merged };
  localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(next));
  uploadHistoryRef.value = next;
  dispatchHistoryUpdated();
};

// ===== WebDAV myupload 同步辅助 =====
function parseManifest(link: string): { filename: string, ids: string } | null {
  const m = link.match(/^\[(.+?)\]([A-Za-z0-9_,.-]+)$/);
  if (!m) return null;
  try {
    const filename = decodeURIComponent(m[1]);
    return { filename, ids: m[2] };
  } catch { return null; }
}

async function maybeSyncMyuploadAdd(link: string) {
  const parsed = parseManifest(link);
  if (!parsed) return;
  try {
    const base = (import.meta as any).env?.VITE_DAV_BASE_PATH || '/dav';
    const url = `${base.replace(/\/$/, '')}/myupload/${encodeURIComponent(parsed.filename)}`;
    await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: link });
  } catch { /* ignore network errors */ }
}

async function maybeSyncMyuploadRemove(link: string) {
  const parsed = parseManifest(link);
  if (!parsed) return;
  try {
    const base = (import.meta as any).env?.VITE_DAV_BASE_PATH || '/dav';
    const url = `${base.replace(/\/$/, '')}/myupload/${encodeURIComponent(parsed.filename)}`;
    await fetch(url, { method: 'DELETE' });
  } catch { /* ignore */ }
}

// ===== Unified helper for direct history write (no ref required) =====
export function addHistoryDirect(link: string, note: string = '') {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]';
    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return;
    const exists = history.find((e: any) => e.link === link);
    if (!exists) {
      history.unshift({ time: new Date().toLocaleString(), link, note });
      localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(history));
      dispatchHistoryUpdated();
    }
  } catch { /* ignore */ }
}

export function removeHistoryDirect(link: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]';
    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return;
    const next = history.filter((e: any) => e.link !== link);
    localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(next));
    dispatchHistoryUpdated();
  } catch { /* ignore */ }
}
