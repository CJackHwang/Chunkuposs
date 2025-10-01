export const STORAGE_KEYS = {
  UPLOAD_LOG: 'uploadLog',
  UPLOAD_HISTORY: 'uploadHistory'
} as const;

type VueRef<T> = { value: T };

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
    history.unshift({ time: new Date().toLocaleString(), link: sjurl });
    localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(history));
    uploadHistoryRef.value = history;
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
};

