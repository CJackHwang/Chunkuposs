// 本地存储键名常量
export const STORAGE_KEYS = {
    UPLOAD_LOG: 'uploadLog',
    UPLOAD_HISTORY: 'uploadHistory'
};

// 调试日志管理
/**
 * 写入调试日志，附带时间戳，并同步到 localStorage
 * @param {string} message
 * @param {{ value: string }} debugOutputRef
 */
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
/**
 * 保存上传历史（去重，头插），并同步到组件状态
 * @param {string} sjurl
 * @param {{ value: Array }} uploadHistoryRef
 */
export const saveUploadHistory = (sjurl, uploadHistoryRef) => {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY)) || [];
    const existing = history.find(entry => entry.link === sjurl);
    if (!existing) {
        // 使用 unshift 将新记录添加到数组开头
        history.unshift({
            time: new Date().toLocaleString(),
            link: sjurl
        });
        // 可选：限制历史记录数量，例如只保留最近 50 条
        // if (history.length > 50) {
        //     history.pop(); // 移除最旧的记录
        // }
        localStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(history));
        // 直接更新 ref，因为 unshift 修改了原数组
        uploadHistoryRef.value = history;
    }
};

/**
 * 加载上传历史
 * @param {{ value: Array }} uploadHistoryRef
 */
export const loadUploadHistory = (uploadHistoryRef) => {
    // 加载时已经是倒序的了
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY)) || [];
    uploadHistoryRef.value = history;
};

// 清理操作
/** 清空调试日志（内存与 localStorage） */
export const clearLog = (debugOutputRef) => {
    debugOutputRef.value = '';
    localStorage.removeItem(STORAGE_KEYS.UPLOAD_LOG);
};

/** 清空上传历史（内存与 localStorage） */
export const clearHistory = (uploadHistoryRef) => {
    uploadHistoryRef.value = [];
    localStorage.removeItem(STORAGE_KEYS.UPLOAD_HISTORY);
};
