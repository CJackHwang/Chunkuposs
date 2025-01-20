import { ref, onMounted } from 'vue';
import Toastify from 'toastify-js';
const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB
const UPLOAD_URL = 'https://api.pgaot.com/user/up_cat_file';
const file = ref(null);
const chunkSize = ref(0);
const chunkSizeVisible = ref(false);
const fileInfo = ref('');
const chunkValue = ref(0);
const totalChunks = ref(0);
const sjurl = ref('');
const status = ref('');
const debugOutput = ref('');
const uploadHistory = ref([]);
const isChunkedMode = ref(false);
const downloadButtonDisabled = ref(false);
const estimatedCompletionTime = ref('');
let intervalId = null;
onMounted(loadLog);
function showToast(message) {
    Toastify({
        text: message,
        duration: 5000,
        gravity: "bottom",
        position: 'right',
        style: {
            background: "linear-gradient(to right, #FF4C4C, #FFB2B2)",
            borderRadius: "10px",
            padding: "20px",
            color: "#fff"
        }
    }).showToast();
}
function updateFileInfo(event) {
    file.value = event.target.files[0];
    chunkSizeVisible.value = !!file.value;
    if (file.value) {
        const fileSizeMB = (file.value.size / (1024 * 1024)).toFixed(2);
        fileInfo.value = `文件大小: ${fileSizeMB} MB`;
        chunkSize.value = Math.min(file.value.size / 2, MAX_CHUNK_SIZE);
        chunkValue.value = (chunkSize.value / (1024 * 1024)).toFixed(2);
        totalChunks.value = Math.ceil(file.value.size / chunkSize.value);
    }
}
async function uploadFile() {
    if (!file.value) {
        showToast('请选择文件!');
        return;
    }
    status.value = "上传处理中...";
    addDebugOutput("开始上传任务，请耐心等待...");
    if (!isChunkedMode.value) {
        await uploadSingleFile();
    }
    else {
        await uploadChunks();
    }
}
async function uploadSingleFile() {
    const formData = new FormData();
    formData.append('file', file.value, file.value.name);
    formData.append('path', 'pickduck');
    try {
        const response = await fetchWithRetry(UPLOAD_URL, {
            method: 'POST', body: formData
        });
        const data = await response.json();
        handleUploadResponse(data);
    }
    catch (error) {
        showToast('上传发生错误，确保文件≤ 30 MB 和检查网络并重试');
        addDebugOutput(`上传失败: ${error.message}`);
    }
}
async function uploadChunks() {
    const reader = file.value.stream().getReader();
    let index = 0;
    const urls = [];
    let byteArray = [];
    let currentChunkSize = 0;
    async function readAndUpload() {
        const { done, value } = await reader.read();
        if (done) {
            if (currentChunkSize > 0) {
                await uploadChunkWithRetry(index, new Blob(byteArray), urls);
            }
            handleChunkUploadCompletion(urls);
            return;
        }
        byteArray.push(value);
        currentChunkSize += value.byteLength;
        while (currentChunkSize >= chunkSize.value && index < totalChunks.value) {
            const startTime = Date.now();
            await uploadChunkWithRetry(index, new Blob(byteArray), urls);
            const endTime = Date.now();
            const uploadTime = endTime - startTime;
            updateEstimatedCompletionTime(uploadTime, totalChunks.value - index - 1);
            index++;
            byteArray = [];
            currentChunkSize = 0;
        }
        status.value = `上传中...（已上传 ${index} 块）`;
        readAndUpload();
    }
    readAndUpload();
}
async function uploadChunkWithRetry(i, chunk, urls) {
    const formData = new FormData();
    formData.append('file', chunk, file.value.name);
    formData.append('path', 'pickduck');
    let retries = 3;
    while (retries > 0) {
        try {
            const response = await fetchWithRetry(UPLOAD_URL, {
                method: 'POST', body: formData
            });
            const data = await response.json();
            handleUploadResponse(data, i, urls);
            return;
        }
        catch (error) {
            retries--;
            addDebugOutput(`上传块 ${i + 1} 失败，尝试重新上传中...`);
        }
    }
    addDebugOutput(`最终上传块 ${i + 1} 失败，已达最大重试次数`);
}
async function fetchWithRetry(url, options, retries = 3) {
    while (retries > 0) {
        try {
            return await fetch(url, options);
        }
        catch (error) {
            retries--;
            addDebugOutput(`Fetch error, retries left: ${retries}`);
        }
    }
    throw new Error('最大重试次数已达到');
}
function handleUploadResponse(data, i, urls) {
    if (data.url) {
        if (i !== undefined) {
            urls[i] = data.url;
            addDebugOutput(`上传块 ${i + 1} 成功: ${data.url}`);
        }
        else {
            sjurl.value = data.url;
            status.value = "上传完成!";
            addDebugOutput("上传完成!");
            saveUploadHistory(data.url);
            showToast('上传成功');
        }
    }
    else {
        showToast(data.msg);
        throw new Error(data.msg);
    }
}
function handleChunkUploadCompletion(urls) {
    const formattedUrls = urls.map(url => {
        const filename = url.split('/').pop().split('?')[0];
        const hash = url.split('hash=')[1];
        return `${filename}?${hash}`;
    }).join(',');
    sjurl.value = `[${file.value.name}]${formattedUrls}`;
    showToast('上传完成');
    addDebugOutput(`上传完成: [${file.value.name}]${formattedUrls}`);
    status.value = "上传完成!";
    saveUploadHistory(formattedUrls);
    resetEstimatedCompletionTime();
}
function updateEstimatedCompletionTime(uploadTime, remainingChunks) {
    let estimatedSeconds = Math.ceil((uploadTime * remainingChunks) / 1000);
    if (intervalId)
        clearInterval(intervalId);
    estimatedCompletionTime.value = `预计完成还需: ${Math.floor(estimatedSeconds / 60)} 分 ${estimatedSeconds % 60} 秒`;
    intervalId = setInterval(() => {
        if (estimatedSeconds > 0) {
            estimatedSeconds--;
            const minutes = Math.floor(estimatedSeconds / 60);
            const seconds = estimatedSeconds % 60;
            estimatedCompletionTime.value = `预计完成还需: ${minutes} 分 ${seconds} 秒`;
        }
        else {
            clearInterval(intervalId);
            estimatedCompletionTime.value = '';
        }
    }, 1000);
}
function resetEstimatedCompletionTime() {
    clearInterval(intervalId);
    estimatedCompletionTime.value = '';
}
function copyToClipboard() {
    navigator.clipboard.writeText(sjurl.value).then(() => {
        showToast('链接已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
    });
}
function resetAll() {
    if (confirm('确定要刷新网页吗？')) {
        location.reload();
    }
}
async function downloadFiles() {
    const longUrl = sjurl.value;
    if (!longUrl) {
        showToast('请先上传文件并生成链接。');
        return;
    }
    const isNormalUrl = /^https?:\/\/.+/.test(longUrl);
    if (isNormalUrl) {
        window.open(longUrl, '_blank');
        return;
    }
    const matches = longUrl.match(/^\[(.+?)\](.+)$/);
    if (!matches) {
        showToast('输入格式不正确，请确保格式为标准链接或分块链接 "[文件名]xxx?xxx,xxx2?xxx,..."');
        return;
    }
    const filename = matches[1];
    const urls = matches[2].split(',').map(url => {
        const [filename, hash] = url.split('?');
        return `https://static.codemao.cn/pickduck/${filename}?hash=${hash}`;
    });
    status.value = "下载中...";
    addDebugOutput("开始下载...");
    try {
        const blobs = await Promise.all(urls.map(fetchBlob));
        await mergeAndDownload(blobs, filename);
    }
    catch (error) {
        showToast('下载发生错误：' + error.message);
        status.value = "下载失败!";
        addDebugOutput(`下载失败: ${error.message}`);
    }
}
async function fetchBlob(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`无法获取 ${url}: ${res.statusText}`);
    return res.blob();
}
async function mergeAndDownload(blobs, filename) {
    const mergedBlob = new Blob(blobs);
    const downloadUrl = URL.createObjectURL(mergedBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    status.value = "下载完成!";
    addDebugOutput("下载完成!");
    downloadButtonDisabled.value = true;
    showToast('温馨提示：下载完成，可能需要点击重置按钮或刷新页面以继续使用下载或导出功能');
}
function addDebugOutput(message) {
    const timestamp = new Date().toLocaleString();
    debugOutput.value += `[${timestamp}] ${message}\n---------\n`;
    const history = JSON.parse(localStorage.getItem('uploadLog')) || [];
    history.push(`[${timestamp}] ${message}`);
    localStorage.setItem('uploadLog', JSON.stringify(history));
}
function saveUploadHistory(urls) {
    const history = JSON.parse(localStorage.getItem('uploadHistory')) || [];
    const existing = history.find(entry => entry.link === sjurl.value);
    if (!existing) {
        history.push({
            time: new Date().toLocaleString(), link: sjurl.value
        });
        localStorage.setItem('uploadHistory', JSON.stringify(history));
    }
    uploadHistory.value = history;
}
function clearLog() {
    debugOutput.value = '';
    localStorage.removeItem('uploadLog');
}
function clearHistory() {
    uploadHistory.value = [];
    localStorage.removeItem('uploadHistory');
}
function exportHistory() {
    const links = uploadHistory.value.map(entry => entry.link).join('\n');
    downloadFile('upload_history.txt', links);
}
function exportLog() {
    const log = localStorage.getItem('uploadLog');
    const logEntries = log ? JSON.parse(log).join('\n') : '没有日志记录。';
    downloadFile('upload_log.txt', logEntries);
}
function downloadFile(filename, content) {
    const blob = new Blob([content], {
        type: 'text/plain'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    downloadButtonDisabled.value = true;
    showToast(`${filename} 已导出，可能需要点击重置按钮或刷新页面以继续使用下载或导出功能`);
}
function loadLog() {
    const log = localStorage.getItem('uploadLog');
    if (log) {
        const logEntries = JSON.parse(log);
        debugOutput.value = logEntries.join('\n');
    }
    loadUploadHistory();
}
function loadUploadHistory() {
    uploadHistory.value = JSON.parse(localStorage.getItem('uploadHistory')) || [];
}
; /* PartiallyEnd: #3632/scriptSetup.vue */
function __VLS_template() {
    const __VLS_ctx = {};
    let __VLS_components;
    let __VLS_directives;
    __VLS_elementAsFunction(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: ("file-upload") },
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input, __VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.updateFileInfo) },
        type: ("file"),
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        id: ("fileInfo"),
    });
    (__VLS_ctx.fileInfo);
    if (__VLS_ctx.chunkSizeVisible) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            id: ("chunkSize"),
            ...{ class: ("chunk-info") },
        });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (__VLS_ctx.chunkValue);
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (__VLS_ctx.totalChunks);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.input, __VLS_intrinsicElements.input)({
        type: ("checkbox"),
    });
    (__VLS_ctx.isChunkedMode);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: ("button-group") },
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.uploadFile) },
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.resetAll) },
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input, __VLS_intrinsicElements.input)({
        type: ("text"),
        id: ("sjurl"),
        value: ((__VLS_ctx.sjurl)),
        placeholder: ("输入链接下载；上传链接也会显示在此"),
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: ("action-buttons") },
    });
    if (__VLS_ctx.sjurl) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.copyToClipboard) },
        });
    }
    if (__VLS_ctx.sjurl && !__VLS_ctx.downloadButtonDisabled) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.downloadFiles) },
        });
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        id: ("status"),
        ...{ class: ("status-message") },
    });
    (__VLS_ctx.status);
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.estimatedCompletionTime);
    __VLS_elementAsFunction(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        id: ("debugOutput"),
        ...{ class: ("debug-output") },
    });
    (__VLS_ctx.debugOutput);
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearLog) },
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.exportLog) },
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        id: ("uploadHistory"),
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
        id: ("uploadHistoryTable"),
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [entry] of __VLS_getVForSourceType((__VLS_ctx.uploadHistory))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            key: ((entry.time)),
        });
        __VLS_elementAsFunction(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (entry.time);
        __VLS_elementAsFunction(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (entry.link);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: ("history-buttons") },
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearHistory) },
    });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.exportHistory) },
    });
    ['file-upload', 'chunk-info', 'button-group', 'action-buttons', 'status-message', 'debug-output', 'history-buttons',];
    var __VLS_slots;
    var $slots;
    let __VLS_inheritedAttrs;
    var $attrs;
    const __VLS_refs = {};
    var $refs;
    var $el;
    return {
        attrs: {},
        slots: __VLS_slots,
        refs: $refs,
        rootEl: $el,
    };
}
;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            chunkSizeVisible: chunkSizeVisible,
            fileInfo: fileInfo,
            chunkValue: chunkValue,
            totalChunks: totalChunks,
            sjurl: sjurl,
            status: status,
            debugOutput: debugOutput,
            uploadHistory: uploadHistory,
            isChunkedMode: isChunkedMode,
            downloadButtonDisabled: downloadButtonDisabled,
            estimatedCompletionTime: estimatedCompletionTime,
            updateFileInfo: updateFileInfo,
            uploadFile: uploadFile,
            copyToClipboard: copyToClipboard,
            resetAll: resetAll,
            downloadFiles: downloadFiles,
            clearLog: clearLog,
            clearHistory: clearHistory,
            exportHistory: exportHistory,
            exportLog: exportLog,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEl: {},
});
; /* PartiallyEnd: #4569/main.vue */
