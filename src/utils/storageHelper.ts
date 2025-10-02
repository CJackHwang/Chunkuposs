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
};

// Update the latest (most recent) history entry's note in a single place
export const updateLatestHistoryNote = (note: string, uploadHistoryRef: VueRef<any[]>) => {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY) || '[]');
  if (!Array.isArray(history) || history.length === 0) return;
  const next = [...history];
  next[0] = { ...next[0], note };
  localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(next));
  uploadHistoryRef.value = next;
  dispatchHistoryUpdated();
};
