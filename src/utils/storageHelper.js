// 本地存储键名常量
export const STORAGE_KEYS = {
    UPLOAD_LOG: 'uploadLog',
    UPLOAD_HISTORY: 'uploadHistory'
};

// 调试日志管理
export const addDebugOutput = (message, debugOutputRef) => {
    const timestamp = new Date().toLocaleString();
    const newEntry = `[${timestamp}] ${message}`;

    // 更新组件的 debugOutput 响应式变量
    debugOutputRef.value += `${newEntry}\n---------\n`;

    // 操作 localStorage
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_LOG)) || [];
    history.push(newEntry);
    localStorage.setItem(STORAGE_KEYS.UPLOAD_LOG, JSON.stringify(history));
};

// 上传历史管理
export const saveUploadHistory = (sjurl, uploadHistoryRef) => {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY)) || [];
    const existing = history.find(entry => entry.link === sjurl);
    if (!existing) {
        history.push({
            time: new Date().toLocaleString(),
            link: sjurl
        });
        localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(history));
        uploadHistoryRef.value = history; // 更新组件的响应式变量
    }
};

export const loadUploadHistory = (uploadHistoryRef) => {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY)) || [];
    uploadHistoryRef.value = history;
};

// 清理操作
export const clearLog = (debugOutputRef) => {
    debugOutputRef.value = '';
    localStorage.removeItem(STORAGE_KEYS.UPLOAD_LOG);
};

export const clearHistory = (uploadHistoryRef) => {
    uploadHistoryRef.value = [];
    localStorage.removeItem(STORAGE_KEYS.UPLOAD_HISTORY);
};